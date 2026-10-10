"""SMTP 발송 어댑터 + 알림 템플릿.

DEV: settings.smtp_enabled=False 이면 발송 안 하고 로그만 남김.
PROD: aiosmtplib 없이 stdlib smtplib 로 충분: 호출 빈도 낮고 동기 OK (background task).

수신자 확정:
  - users 테이블에서 email 조회 (lazy upsert 된 캐시)
  - UserNotificationPreference.email_enabled=False 면 skip
"""

from __future__ import annotations

import asyncio
import re
from dataclasses import dataclass
from email.message import EmailMessage
from smtplib import SMTP, SMTP_SSL

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.db import AsyncSessionLocal
from app.core.logging import logger
from app.models.user import User
from app.models.user_notification_preference import UserNotificationPreference
from app.models.workspace import Workspace
from app.services.email_template import make_brand_html
from app.services.smtp_config import SmtpRuntime
from app.services.smtp_config import resolve as resolve_smtp


@dataclass(frozen=True)
class RenderedEmail:
    """render() 결과: sync send 가 multipart 분기에 쓰는 평탄 구조.

    is_html=True 면 _send_sync 가 text/plain + text/html 두 part 발송.
    text_fallback 이 비어 있으면 body 의 태그를 strip 해서 자동 생성.
    """

    subject: str
    body: str
    is_html: bool = False
    text_fallback: str | None = None


_TAG_RE = re.compile(r"<[^>]+>")


def _html_to_text(html: str) -> str:
    """HTML 태그 strip → plain text fallback. <br>·</p> 는 newline 변환."""
    s = re.sub(r"(?i)<br\s*/?>", "\n", html)
    s = re.sub(r"(?i)</p\s*>", "\n\n", s)
    s = _TAG_RE.sub("", s)
    # HTML entity 일부만 처리: 외부 lib 회피
    s = (
        s.replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", '"')
    )
    return re.sub(r"\n{3,}", "\n\n", s).strip()

# ---------------------------------------------------------------------------
# 템플릿: 단순 문자열 포맷. Jinja2 도입은 Phase 3a-3 범위 밖.
# ---------------------------------------------------------------------------

# 시스템 기본 HTML: 워크스페이스가 커스텀 안 했을 때 외부 고객에게 가는 메일.
# 워크스페이스 로고는 일부러 안 박음: 등록 안 한 워크스페이스도 깔끔하게 보이게 + 로고 등록한
# 워크스페이스는 워크스페이스 설정 → 이메일 템플릿에서 직접 <img> 태그 추가.

_BOOKING_HTML_RECEIVED = """\
<table cellspacing="0" cellpadding="0" border="0" width="100%" align="center" role="presentation" style="background-color:#e9ecef; padding:32px 0; font-family:'Arial','Helvetica Neue',Helvetica,sans-serif; color:#212529;">
  <tr><td>
    <table cellspacing="0" cellpadding="0" border="0" width="100%" align="center" role="presentation" style="max-width:720px; margin:0 auto; background-color:#ffffff;">
      <tr><td style="padding:32px 40px 18px 40px;">
        <a href="{base_url}" target="_blank" style="text-decoration:none; color:#111827;">
          <div style="margin-bottom:8px;">{organization_brand}</div>
          <div style="font-size:30px; font-weight:800; line-height:1.3; color:#111827;">예약이 접수되었습니다.</div>
        </a>
        <div style="height:1px; background-color:#E5E5E5; width:100%; margin:24px 0 0 0;"></div>
      </td></tr>
      <tr><td style="padding:0 40px 16px 40px; font-size:16px; line-height:1.85; color:#121212;">
        <p style="margin:0 0 16px 0;">{customer_name}님, 안녕하세요.</p>
        <p style="margin:0 0 16px 0;"><strong>{title}</strong> 예약이 접수되었습니다.<br/>예약하신 시간에 뵙겠습니다.</p>
      </td></tr>
      <tr><td style="padding:8px 40px 24px 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F9F9F9; border-radius:8px;">
          <tr><td style="padding:20px 24px;">
            <div style="font-size:12px; letter-spacing:0.5px; color:#9ca3af; margin-bottom:6px;">일정</div>
            <div style="font-size:18px; font-weight:700; color:#111827;">{slot_start_local}</div>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:0 40px 32px 40px;">
        <p style="margin:0 0 12px 0; font-size:14px; color:#6b7280;">예약을 변경하거나 취소하려면 아래 버튼을 사용해주세요.</p>
        <a href="{cancel_url}" target="_blank" style="display:inline-block; padding:12px 24px; background-color:#111827; color:#ffffff; text-decoration:none; border-radius:6px; font-size:14px; font-weight:600;">예약 관리</a>
      </td></tr>
      <tr><td style="padding:24px 40px 32px 40px; border-top:1px solid #E5E5E5; font-size:12px; color:#9ca3af;">이 메일은 자동 발송됩니다. 문의는 {organization_name} 담당자에게 연락주세요.</td></tr>
    </table>
  </td></tr>
</table>
"""

_BOOKING_HTML_CANCELLED = """\
<table cellspacing="0" cellpadding="0" border="0" width="100%" align="center" role="presentation" style="background-color:#e9ecef; padding:32px 0; font-family:'Arial','Helvetica Neue',Helvetica,sans-serif; color:#212529;">
  <tr><td>
    <table cellspacing="0" cellpadding="0" border="0" width="100%" align="center" role="presentation" style="max-width:720px; margin:0 auto; background-color:#ffffff;">
      <tr><td style="padding:32px 40px 18px 40px;">
        <a href="{base_url}" target="_blank" style="text-decoration:none; color:#111827;">
          <div style="margin-bottom:8px;">{organization_brand}</div>
          <div style="font-size:30px; font-weight:800; line-height:1.3; color:#111827;">예약이 취소되었습니다.</div>
        </a>
        <div style="height:1px; background-color:#E5E5E5; width:100%; margin:24px 0 0 0;"></div>
      </td></tr>
      <tr><td style="padding:0 40px 16px 40px; font-size:16px; line-height:1.85; color:#121212;">
        <p style="margin:0 0 16px 0;">{customer_name}님,</p>
        <p style="margin:0 0 16px 0;"><strong>{title}</strong> 예약이 취소되었습니다.</p>
      </td></tr>
      <tr><td style="padding:8px 40px 24px 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F9F9F9; border-radius:8px;">
          <tr><td style="padding:20px 24px;">
            <div style="font-size:12px; letter-spacing:0.5px; color:#9ca3af; margin-bottom:6px;">취소된 일정</div>
            <div style="font-size:18px; font-weight:700; color:#6b7280; text-decoration:line-through;">{slot_start_local}</div>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:0 40px 32px 40px;">
        <p style="margin:0 0 12px 0; font-size:14px; color:#6b7280;">다시 예약하려면 아래 버튼을 사용해주세요.</p>
        <a href="{book_url}" target="_blank" style="display:inline-block; padding:12px 24px; background-color:#111827; color:#ffffff; text-decoration:none; border-radius:6px; font-size:14px; font-weight:600;">다시 예약하기</a>
      </td></tr>
      <tr><td style="padding:24px 40px 32px 40px; border-top:1px solid #E5E5E5; font-size:12px; color:#9ca3af;">이 메일은 자동 발송됩니다. 문의는 {organization_name} 담당자에게 연락주세요.</td></tr>
    </table>
  </td></tr>
</table>
"""

_BOOKING_HTML_RESCHEDULED = """\
<table cellspacing="0" cellpadding="0" border="0" width="100%" align="center" role="presentation" style="background-color:#e9ecef; padding:32px 0; font-family:'Arial','Helvetica Neue',Helvetica,sans-serif; color:#212529;">
  <tr><td>
    <table cellspacing="0" cellpadding="0" border="0" width="100%" align="center" role="presentation" style="max-width:720px; margin:0 auto; background-color:#ffffff;">
      <tr><td style="padding:32px 40px 18px 40px;">
        <a href="{base_url}" target="_blank" style="text-decoration:none; color:#111827;">
          <div style="margin-bottom:8px;">{organization_brand}</div>
          <div style="font-size:30px; font-weight:800; line-height:1.3; color:#111827;">예약 시간이 변경되었습니다.</div>
        </a>
        <div style="height:1px; background-color:#E5E5E5; width:100%; margin:24px 0 0 0;"></div>
      </td></tr>
      <tr><td style="padding:0 40px 16px 40px; font-size:16px; line-height:1.85; color:#121212;">
        <p style="margin:0 0 16px 0;">{customer_name}님,</p>
        <p style="margin:0 0 16px 0;"><strong>{title}</strong> 예약 시간이 다음과 같이 변경되었습니다.<br/>변경된 시간을 다시 확인해주세요.</p>
      </td></tr>
      <tr><td style="padding:8px 40px 24px 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F9F9F9; border-radius:8px;">
          <tr><td style="padding:20px 24px;">
            <div style="font-size:12px; letter-spacing:0.5px; color:#9ca3af; margin-bottom:6px;">기존 일정</div>
            <div style="font-size:15px; color:#6b7280; text-decoration:line-through; margin-bottom:16px;">{old_slot_local}</div>
            <div style="font-size:12px; letter-spacing:0.5px; color:#9ca3af; margin-bottom:6px;">변경된 일정</div>
            <div style="font-size:18px; font-weight:700; color:#111827;">{new_slot_local}</div>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:0 40px 32px 40px;">
        <p style="margin:0 0 12px 0; font-size:14px; color:#6b7280;">변경된 시간이 어려우면 아래에서 취소할 수 있습니다.</p>
        <a href="{cancel_url}" target="_blank" style="display:inline-block; padding:12px 24px; background-color:#111827; color:#ffffff; text-decoration:none; border-radius:6px; font-size:14px; font-weight:600;">예약 관리</a>
      </td></tr>
      <tr><td style="padding:24px 40px 32px 40px; border-top:1px solid #E5E5E5; font-size:12px; color:#9ca3af;">이 메일은 자동 발송됩니다. 문의는 {organization_name} 담당자에게 연락주세요.</td></tr>
    </table>
  </td></tr>
</table>
"""



# 시그너처: (subject, body, is_html)
# 외부 고객용 booking_*_customer 3종만 HTML 디자인. 내부 알림은 plain text 유지.
# is_html=True 일 때 _send_sync 가 multipart/alternative 로 발송 (text fallback 자동 생성).
_TEMPLATES: dict[str, tuple[str, str, bool]] = {
    "event_invited": (
        "[Ashfield] '{title}' 일정에 초대되었습니다",
        "{actor_name}님이 '{title}' 일정에 초대했습니다.\n"
        "시작: {start_at}\n\n"
        "수락/거절: {base_url}/calendar\n",
        False,
    ),
    # 외부 게스트에게: 계정 없이 RSVP 링크로 수락/거절.
    # send_to_address 경로라 actor_name/organization_name 자동 주입 없음 → payload 로 직접 전달.
    "event_guest_invited": (
        "[{organization_name}] '{title}' 일정에 초대되었습니다",
        "{inviter_name}님이 '{title}' 일정에 초대했습니다.\n"
        "시작: {start_at}\n\n"
        "아래 링크에서 참석 여부를 알려주세요:\n"
        "{base_url}/rsvp/{rsvp_token}\n",
        False,
    ),
    "event_invitation_response": (
        "[Ashfield] '{title}' 일정 응답 도착",
        "{actor_name}님이 '{title}' 일정 초대에 {response} 응답했습니다.\n\n"
        "확인: {base_url}/calendar\n",
        False,
    ),
    "event_reminder": (
        "[Ashfield] '{title}': {minutes_before}분 전 알림",
        "'{title}' 일정 시작 {minutes_before}분 전입니다.\n"
        "시작: {occurrence_start}\n\n"
        "확인: {base_url}/calendar\n",
        False,
    ),
    # 외부 고객에게: 예약 접수 안내 (HTML 디자인)
    "booking_received_customer": (
        "[{organization_name}] '{title}' 예약을 접수했습니다",
        _BOOKING_HTML_RECEIVED,
        True,
    ),
    # 운영자에게: 새 예약 들어옴 (plain text 유지)
    "booking_received_operator": (
        "[Ashfield] 새 예약이 들어왔습니다: {title}",
        "{customer_name}({customer_email})님이 '{title}' 예약을 신청했습니다.\n"
        "일시: {slot_start_local}\n"
        "메시지: {customer_message}\n\n"
        "확인: {base_url}/booking-types\n",
        False,
    ),
    # 고객 취소: 운영자에게 통지 (plain text)
    "booking_cancelled_operator": (
        "[Ashfield] 예약이 취소되었습니다: {title}",
        "{customer_name}님이 '{title}' 예약을 취소했습니다.\n"
        "취소된 일시: {slot_start_local}\n",
        False,
    ),
    # 취소 완료: 고객에게 (HTML)
    "booking_cancelled_customer": (
        "[{organization_name}] '{title}' 예약 취소 완료",
        _BOOKING_HTML_CANCELLED,
        True,
    ),
    # 시간 변경: 고객에게 (HTML)
    "booking_rescheduled_customer": (
        "[{organization_name}] '{title}' 예약 시간 변경 안내",
        _BOOKING_HTML_RESCHEDULED,
        True,
    ),
    # 시간 변경: 운영자(들)에게 (plain text)
    "booking_rescheduled_operator": (
        "[Ashfield] 예약 시간이 변경되었습니다: {title}",
        "{customer_name}님의 '{title}' 예약 시간이 변경되었습니다.\n"
        "이전: {old_slot_local}\n"
        "변경: {new_slot_local}\n",
        False,
    ),
}


async def render(
    db: AsyncSession | None,
    event_type: str,
    payload: dict,
    actor_name: str,
    *,
    workspace_id: str | None = None,
) -> RenderedEmail | None:
    """Render subject/body: 워크스페이스 override(있으면) → 시스템 기본.

    db=None 인 경우는 시스템 기본만 사용 (백그라운드 worker 등 db 가용 불가시).
    워크스페이스 override 가 is_html=True 면 RenderedEmail.is_html=True, text_fallback 동봉.
    시스템 기본은 항상 plain text.
    """
    is_html = False
    text_fallback: str | None = None
    if db is not None:
        from app.services.email_template import resolve_full_template

        full = await resolve_full_template(
            db, event_type=event_type, workspace_id=workspace_id
        )
        if full is None:
            return None
        subject_tpl, body_tpl, is_html, text_fallback_tpl = full
    else:
        tpl = _TEMPLATES.get(event_type)
        if tpl is None:
            return None
        subject_tpl, body_tpl, is_html = tpl
        text_fallback_tpl = None

    base_url = settings.calendar_base_url
    ctx = {**payload, "actor_name": actor_name, "base_url": base_url}
    try:
        subject = subject_tpl.format(**ctx)
        body = body_tpl.format(**ctx)
        text_fallback = (
            text_fallback_tpl.format(**ctx) if text_fallback_tpl else None
        )
    except KeyError:
        return None
    return RenderedEmail(
        subject=subject, body=body, is_html=is_html, text_fallback=text_fallback
    )


# ---------------------------------------------------------------------------
# 수신자 확정
# ---------------------------------------------------------------------------


# 알림 유형 → 사용자 이메일 설정 카테고리. 없는 유형(event_reminder 등)은 게이팅 안 함.
_TYPE_CATEGORY: dict[str, str] = {
    "event_invited": "event",
    "event_invitation_response": "event",
    "booking_received": "booking",
    "booking_cancelled": "booking",
    "booking_rescheduled": "booking",
}


def category_of(event_type: str) -> str | None:
    return _TYPE_CATEGORY.get(event_type)


async def resolve_recipient(
    db: AsyncSession, *, recipient_sub: str, event_type: str | None = None
) -> str | None:
    """수신 이메일: 마스터 off거나 해당 카테고리 off면 None(발송 안 함)."""
    pref = await db.get(UserNotificationPreference, recipient_sub)
    if pref is not None:
        if not pref.email_enabled:
            return None
        cat = category_of(event_type) if event_type else None
        if cat and pref.email_categories.get(cat) is False:
            return None
    user = await db.get(User, recipient_sub)
    if user is None or not user.email:
        return None
    return user.email


async def resolve_actor_name(db: AsyncSession, *, actor_sub: str | None) -> str:
    if not actor_sub:
        return "시스템"
    u = await db.get(User, actor_sub)
    return (u.name if u and u.name else (u.email if u else actor_sub)) or actor_sub


# ---------------------------------------------------------------------------
# 발송
# ---------------------------------------------------------------------------


def _check_connection_sync(cfg: SmtpRuntime) -> None:
    """발송 없이 SMTP 연결 + (optional) AUTH 만 시도.

    EHLO → [STARTTLS + EHLO] → [AUTH LOGIN] → QUIT. 실패 시 예외 raise.
    """
    if cfg.tls_mode == "ssl":
        smtp = SMTP_SSL(cfg.host, cfg.port, timeout=10)
    else:
        smtp = SMTP(cfg.host, cfg.port, timeout=10)
    try:
        smtp.ehlo()
        if cfg.tls_mode == "starttls":
            smtp.starttls()
            smtp.ehlo()
        if cfg.user:
            smtp.login(cfg.user, cfg.password)
    finally:
        try:
            smtp.quit()
        except Exception:
            pass


def _send_sync(cfg: SmtpRuntime, to_email: str, email: RenderedEmail) -> None:
    msg = EmailMessage()
    msg["Subject"] = email.subject
    msg["From"] = f"{cfg.from_name} <{cfg.from_addr}>"
    msg["To"] = to_email
    if email.is_html:
        # multipart/alternative: plain 먼저, html 가 alternative.
        # RFC 2046: text/plain 을 먼저 set_content, html 은 add_alternative.
        text_part = email.text_fallback or _html_to_text(email.body)
        msg.set_content(text_part)
        msg.add_alternative(email.body, subtype="html")
    else:
        msg.set_content(email.body)

    # tls_mode:
    #   'ssl'      → SMTP_SSL (implicit TLS, 보통 465)
    #   'starttls' → SMTP plain → starttls() 후 인증·발송 (보통 587)
    #   'none'     → 평문 SMTP (보통 25 / 2525: 운영 비추천)
    if cfg.tls_mode == "ssl":
        with SMTP_SSL(cfg.host, cfg.port, timeout=10) as smtp:
            if cfg.user:
                smtp.login(cfg.user, cfg.password)
            smtp.send_message(msg)
    else:
        with SMTP(cfg.host, cfg.port, timeout=10) as smtp:
            if cfg.tls_mode == "starttls":
                smtp.starttls()
            if cfg.user:
                smtp.login(cfg.user, cfg.password)
            smtp.send_message(msg)


async def send_to_address(
    *,
    to_email: str,
    event_type: str,
    payload: dict,
    workspace_id: str | None = None,
) -> None:
    """User 테이블 lookup 없이 직접 발송: 외부 고객(booking 알림 등)."""
    async with AsyncSessionLocal() as db:
        cfg = await resolve_smtp(db, workspace_id=workspace_id)
        if cfg is None:
            logger.debug(
                "email_skipped_no_config",
                extra={"category": "email", "event": event_type, "to": to_email},
            )
            return
        rendered = await render(
            db, event_type, payload, actor_name="", workspace_id=workspace_id
        )
    if rendered is None:
        return
    try:
        await asyncio.to_thread(_send_sync, cfg, to_email, rendered)
        logger.info(
            "email_sent",
            extra={
                "category": "email",
                "event": event_type,
                "to": to_email,
                "smtp_source": cfg.source,
            },
        )
    except Exception as exc:
        logger.warning(
            "email_send_failed",
            extra={
                "category": "email",
                "event": event_type,
                "to": to_email,
                "error": str(exc),
            },
        )


async def send_for_event(
    *,
    recipient_sub: str,
    actor_sub: str | None,
    event_type: str,
    payload: dict,
    workspace_id: str | None = None,
) -> str:
    """본인 행동이 아닌 알림에 한해 이메일 발송.

    반환값(outbox 스탬프 판정용, #2):
      - "sent"    발송 성공 → emailed_at 스탬프(terminal)
      - "skipped" 수신거부·주소없음·템플릿없음·본인행동 → 스탬프(terminal, 재시도 무의미)
      - "failed"  SMTP 미설정·전송 예외 → 스탬프 안 함(relay 가 재시도)

    workspace_id 는 워크스페이스 override resolve 에 사용.
    """
    if recipient_sub == actor_sub:
        return "skipped"

    async with AsyncSessionLocal() as db:
        cfg = await resolve_smtp(db, workspace_id=workspace_id)
        if cfg is None:
            logger.debug(
                "email_skipped_no_config",
                extra={"category": "email", "event": event_type},
            )
            return "failed"
        to_email = await resolve_recipient(
            db, recipient_sub=recipient_sub, event_type=event_type
        )
        if to_email is None:
            return "skipped"
        actor_name = await resolve_actor_name(db, actor_sub=actor_sub)
        # organization_* 자동 fill: booking 외 알림 (event_invited 등) 도
        # 워크스페이스 브랜드 헤더를 사용한 HTML 템플릿 커스터마이즈 가능하게. 호출처가 이미
        # payload 에 채웠으면 보존 (booking 의 dispatch_*_emails 호환).
        if workspace_id and "organization_name" not in payload:
            workspace = await db.get(Workspace, workspace_id)
            if workspace is not None:
                org_name = workspace.name or workspace_id
                logo_url = getattr(workspace, "logo_url", None)
                payload = {
                    **payload,
                    "organization_name": org_name,
                    "organization_logo_url": logo_url or "",
                    "organization_brand": make_brand_html(org_name, logo_url),
                }
        rendered = await render(
            db, event_type, payload, actor_name, workspace_id=workspace_id
        )
    if rendered is None:
        return "skipped"
    try:
        await asyncio.to_thread(_send_sync, cfg, to_email, rendered)
        logger.info(
            "email_sent",
            extra={
                "category": "email",
                "event": event_type,
                "to": to_email,
                "smtp_source": cfg.source,
            },
        )
        return "sent"
    except Exception as exc:
        logger.warning(
            "email_send_failed",
            extra={
                "category": "email",
                "event": event_type,
                "to": to_email,
                "error": str(exc),
            },
        )
        return "failed"


# ---------------------------------------------------------------------------
# preferences API helper
# ---------------------------------------------------------------------------


async def get_or_create_pref(
    db: AsyncSession, *, user_sub: str
) -> UserNotificationPreference:
    stmt = select(UserNotificationPreference).where(
        UserNotificationPreference.user_sub == user_sub
    )
    pref = (await db.execute(stmt)).scalar_one_or_none()
    if pref is None:
        pref = UserNotificationPreference(user_sub=user_sub, email_enabled=True)
        db.add(pref)
    return pref
