"""이메일 템플릿 resolver + 변수 검증.

워크스페이스 override 우선, 없으면 services/email.py 의 _TEMPLATES 시스템 기본.

대상 (CUSTOMIZABLE_EVENT_TYPES) 은 외부 고객용 3종만: 내부 알림은 운영자가 받기
때문에 커스텀 가치 낮음. event_type 화이트리스트로 confused-deputy 방지.
"""

from __future__ import annotations

import html
import re

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import BusinessError
from app.models.email_template import WorkspaceEmailTemplate


def make_brand_html(organization_name: str, logo_url: str | None) -> str:
    """헤더에 들어갈 워크스페이스 로고/이름 HTML 조각.

    logo_url 등록 시 <img>, 미등록 시 워크스페이스 이름 텍스트로 fallback.
    더미 이미지 사용 X: 등록 안 한 워크스페이스는 텍스트만 보임.
    """
    name_esc = html.escape(organization_name or "")
    if logo_url:
        url_esc = html.escape(logo_url, quote=True)
        return (
            f'<img src="{url_esc}" alt="{name_esc}" '
            'style="height:32px; display:block; max-width:200px;"/>'
        )
    return (
        '<span style="display:inline-block; font-size:14px; font-weight:600; '
        f'letter-spacing:1px; color:#65435c;">{name_esc}</span>'
    )

# 화이트리스트: 이 이외 event_type 으로는 override 저장 불가
CUSTOMIZABLE_EVENT_TYPES: dict[str, str] = {
    "booking_received_customer": "예약 접수: 고객",
    "booking_cancelled_customer": "예약 취소: 고객",
    "booking_rescheduled_customer": "예약 시간 변경: 고객",
    "event_invited": "일정 초대",
    "event_invitation_response": "일정 초대 응답",
    "event_reminder": "일정 시작 전 알림",
}

# 각 event 에 사용 가능한 {변수} 키: render 시 항상 채워짐
KNOWN_VARIABLES: dict[str, list[str]] = {
    "booking_received_customer": [
        "customer_name",
        "title",
        "slot_start_local",
        "cancel_url",
        "organization_name",
        "organization_logo_url",
        "organization_brand",
        "base_url",
    ],
    "booking_cancelled_customer": [
        "customer_name",
        "title",
        "slot_start_local",
        "book_url",
        "organization_name",
        "organization_logo_url",
        "organization_brand",
        "base_url",
    ],
    "booking_rescheduled_customer": [
        "customer_name",
        "title",
        "old_slot_local",
        "new_slot_local",
        "cancel_url",
        "organization_name",
        "organization_logo_url",
        "organization_brand",
        "base_url",
    ],
    "event_invited": [
        "actor_name",
        "title",
        "start_at",
        "organization_name",
        "organization_logo_url",
        "organization_brand",
        "base_url",
    ],
    "event_invitation_response": [
        "actor_name",
        "title",
        "response",
        "organization_name",
        "organization_logo_url",
        "organization_brand",
        "base_url",
    ],
    "event_reminder": [
        "title",
        "minutes_before",
        "occurrence_start",
        "organization_name",
        "organization_logo_url",
        "organization_brand",
        "base_url",
    ],
}

# render 미리보기: 운영자가 편집 중 보는 sample data
SAMPLE_VARIABLES: dict[str, dict[str, str]] = {
    "booking_received_customer": {
        "customer_name": "홍길동",
        "title": "1:1 상담 예약",
        "slot_start_local": "2026년 6월 10일 (수) 14:00",
        "cancel_url": "https://example.com/book/cancel/abc123",
        "organization_name": "Ashfield",
        "organization_logo_url": "",
        "organization_brand": make_brand_html("Ashfield", None),
        "base_url": "https://calendar.example.com",
    },
    "booking_cancelled_customer": {
        "customer_name": "홍길동",
        "title": "1:1 상담 예약",
        "slot_start_local": "2026년 6월 10일 (수) 14:00",
        "book_url": "https://calendar.example.com/book/xyz",
        "organization_name": "Ashfield",
        "organization_logo_url": "",
        "organization_brand": make_brand_html("Ashfield", None),
        "base_url": "https://calendar.example.com",
    },
    "booking_rescheduled_customer": {
        "customer_name": "홍길동",
        "title": "1:1 상담 예약",
        "old_slot_local": "2026년 6월 10일 (수) 14:00",
        "new_slot_local": "2026년 6월 11일 (목) 16:00",
        "cancel_url": "https://example.com/book/cancel/abc123",
        "organization_name": "Ashfield",
        "organization_logo_url": "",
        "organization_brand": make_brand_html("Ashfield", None),
        "base_url": "https://calendar.example.com",
    },
    "event_invited": {
        "actor_name": "김담당",
        "title": "주간 회의",
        "start_at": "2026년 6월 10일 (수) 10:00",
        "organization_name": "Ashfield",
        "organization_logo_url": "",
        "organization_brand": make_brand_html("Ashfield", None),
        "base_url": "https://calendar.example.com",
    },
    "event_invitation_response": {
        "actor_name": "이참석",
        "title": "주간 회의",
        "response": "수락",
        "organization_name": "Ashfield",
        "organization_logo_url": "",
        "organization_brand": make_brand_html("Ashfield", None),
        "base_url": "https://calendar.example.com",
    },
    "event_reminder": {
        "title": "주간 회의",
        "minutes_before": "15",
        "occurrence_start": "2026년 6월 10일 (수) 10:00",
        "organization_name": "Ashfield",
        "organization_logo_url": "",
        "organization_brand": make_brand_html("Ashfield", None),
        "base_url": "https://calendar.example.com",
    },
}

# 시스템 기본 정의는 services/email.py 의 _TEMPLATES: 단방향 참조 회피용 lazy import
_VAR_PATTERN = re.compile(r"\{([a-zA-Z_][a-zA-Z0-9_]*)\}")


def extract_variables(text: str) -> set[str]:
    """{var} 패턴 추출. {{ 와 }} (literal brace) 는 제외."""
    # str.format 의 escape: {{ → {, }} → }: 추출 전 제거
    stripped = text.replace("{{", "").replace("}}", "")
    return set(_VAR_PATTERN.findall(stripped))


def validate_template(
    event_type: str,
    subject: str,
    body: str,
    *,
    text_fallback: str | None = None,
) -> None:
    """subject/body/text_fallback 가 화이트리스트 외 변수를 쓰지 않는지 검증.

    빈 값 / 너무 긴 값도 BusinessError. text_fallback 은 옵션: 주어졌으면 검증.
    """
    if event_type not in CUSTOMIZABLE_EVENT_TYPES:
        raise BusinessError(
            "EMAIL_TEMPLATE_NOT_CUSTOMIZABLE",
            status=400,
            message="이 이메일 종류는 커스텀 대상이 아닙니다.",
            params={"event_type": event_type},
        )
    if not subject.strip():
        raise BusinessError(
            "EMAIL_TEMPLATE_SUBJECT_EMPTY", status=400, message="제목을 입력해주세요."
        )
    if not body.strip():
        raise BusinessError(
            "EMAIL_TEMPLATE_BODY_EMPTY", status=400, message="본문을 입력해주세요."
        )
    if len(subject) > 500:
        raise BusinessError(
            "EMAIL_TEMPLATE_SUBJECT_TOO_LONG",
            status=400,
            message="제목은 500자 이하로 입력해주세요.",
        )
    if len(body) > 20000:
        raise BusinessError(
            "EMAIL_TEMPLATE_BODY_TOO_LONG",
            status=400,
            message="본문은 20000자 이하로 입력해주세요.",
        )
    if text_fallback is not None and len(text_fallback) > 20000:
        raise BusinessError(
            "EMAIL_TEMPLATE_BODY_TOO_LONG",
            status=400,
            message="대체 본문도 20000자 이하로 입력해주세요.",
        )

    allowed = set(KNOWN_VARIABLES[event_type])
    used = extract_variables(subject) | extract_variables(body)
    if text_fallback:
        used |= extract_variables(text_fallback)
    unknown = used - allowed
    if unknown:
        raise BusinessError(
            "EMAIL_TEMPLATE_UNKNOWN_VARS",
            status=400,
            message=f"사용할 수 없는 변수가 있습니다: {', '.join(sorted(unknown))}",
            params={"unknown_variables": sorted(unknown)},
        )


async def resolve_template(
    db: AsyncSession, *, event_type: str, workspace_id: str | None
) -> tuple[str, str] | None:
    """workspace override → 시스템 기본 (_TEMPLATES). 둘 다 없으면 None.

    리턴: (subject_template, body_template). 호환용: render 는 resolve_full_template 사용.
    """
    full = await resolve_full_template(
        db, event_type=event_type, workspace_id=workspace_id
    )
    if full is None:
        return None
    subject, body, _is_html, _text_fb = full
    return subject, body


async def resolve_full_template(
    db: AsyncSession, *, event_type: str, workspace_id: str | None
) -> tuple[str, str, bool, str | None] | None:
    """workspace override → 시스템 기본. 시스템 기본은 항상 plain text.

    리턴: (subject, body, is_html, text_fallback_template_or_None).
    """
    if workspace_id:
        row = await db.get(WorkspaceEmailTemplate, (workspace_id, event_type))
        if row is not None:
            return row.subject, row.body, row.is_html, row.text_fallback
    # lazy import to avoid circular
    from app.services.email import _TEMPLATES

    tpl = _TEMPLATES.get(event_type)
    if tpl is None:
        return None
    subject, body, is_html = tpl
    return subject, body, is_html, None
