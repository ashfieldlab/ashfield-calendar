"""/api/v1/companies/{id}/email-templates — Company Admin 이메일 템플릿 override.

대상 event_type 은 services/email_template.CUSTOMIZABLE_EVENT_TYPES 화이트리스트.
override row 가 있으면 services/email.render 가 시스템 기본보다 우선 적용.
"""

from fastapi import APIRouter, Depends, HTTPException, Path
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.context import UserContext
from app.auth.dependencies import require_company_admin
from app.core.db import get_db
from app.core.logging import logger
from app.models.email_template import CompanyEmailTemplate
from app.services.email import _TEMPLATES
from app.services.email_template import (
    CUSTOMIZABLE_EVENT_TYPES,
    KNOWN_VARIABLES,
    SAMPLE_VARIABLES,
    validate_template,
)

router = APIRouter(
    prefix="/companies/{company_id}/email-templates", tags=["company"]
)


class EmailTemplateItem(BaseModel):
    """리스트 응답의 한 행 — 어떤 event_type 이 커스텀돼 있는지."""

    event_type: str
    label: str
    overridden: bool
    variables: list[str]


class EmailTemplateListResponse(BaseModel):
    items: list[EmailTemplateItem]


class EmailTemplateDetail(BaseModel):
    event_type: str
    label: str
    overridden: bool
    variables: list[str]
    subject: str
    body: str
    is_html: bool = False
    text_fallback: str | None = None
    default_subject: str
    default_body: str
    # 시스템 기본 템플릿이 HTML 인지 — 회사가 커스텀 안 한 새 row 의 초기값 결정에 사용.
    default_is_html: bool = False


class EmailTemplatePut(BaseModel):
    subject: str
    body: str
    is_html: bool = False
    text_fallback: str | None = None


class EmailTemplatePreviewRequest(BaseModel):
    subject: str
    body: str
    is_html: bool = False
    text_fallback: str | None = None


class EmailTemplatePreviewResponse(BaseModel):
    subject: str
    body: str
    is_html: bool
    text_fallback: str | None = None


def _default_for(event_type: str) -> tuple[str, str, bool]:
    default = _TEMPLATES.get(event_type)
    if default is None:
        return "", "", False
    return default


def _assert_supported(event_type: str) -> None:
    if event_type not in CUSTOMIZABLE_EVENT_TYPES:
        raise HTTPException(404, "Unknown or non-customizable event_type")


@router.get(
    "",
    response_model=EmailTemplateListResponse,
    summary="회사 이메일 템플릿 목록 (Company Admin)",
)
async def list_templates(
    company_id: str = Path(...),
    _: UserContext = Depends(require_company_admin),
    db: AsyncSession = Depends(get_db),
) -> EmailTemplateListResponse:
    items: list[EmailTemplateItem] = []
    for event_type, label in CUSTOMIZABLE_EVENT_TYPES.items():
        row = await db.get(CompanyEmailTemplate, (company_id, event_type))
        items.append(
            EmailTemplateItem(
                event_type=event_type,
                label=label,
                overridden=row is not None,
                variables=KNOWN_VARIABLES[event_type],
            )
        )
    return EmailTemplateListResponse(items=items)


@router.get(
    "/{event_type}",
    response_model=EmailTemplateDetail,
    summary="이메일 템플릿 단건 — 현재 active (override 또는 기본)",
)
async def get_template(
    company_id: str = Path(...),
    event_type: str = Path(...),
    _: UserContext = Depends(require_company_admin),
    db: AsyncSession = Depends(get_db),
) -> EmailTemplateDetail:
    _assert_supported(event_type)
    row = await db.get(CompanyEmailTemplate, (company_id, event_type))
    default_subject, default_body, default_is_html = _default_for(event_type)
    return EmailTemplateDetail(
        event_type=event_type,
        label=CUSTOMIZABLE_EVENT_TYPES[event_type],
        overridden=row is not None,
        variables=KNOWN_VARIABLES[event_type],
        subject=row.subject if row else default_subject,
        body=row.body if row else default_body,
        is_html=row.is_html if row else default_is_html,
        text_fallback=row.text_fallback if row else None,
        default_subject=default_subject,
        default_body=default_body,
        default_is_html=default_is_html,
    )


@router.put(
    "/{event_type}",
    response_model=EmailTemplateDetail,
    summary="이메일 템플릿 override 저장",
)
async def put_template(
    body: EmailTemplatePut,
    company_id: str = Path(...),
    event_type: str = Path(...),
    actor: UserContext = Depends(require_company_admin),
    db: AsyncSession = Depends(get_db),
) -> EmailTemplateDetail:
    _assert_supported(event_type)
    validate_template(
        event_type, body.subject, body.body, text_fallback=body.text_fallback
    )
    row = await db.get(CompanyEmailTemplate, (company_id, event_type))
    is_new = row is None
    if row is None:
        row = CompanyEmailTemplate(
            company_id=company_id, event_type=event_type, subject="", body=""
        )
        db.add(row)
    row.subject = body.subject
    row.body = body.body
    row.is_html = body.is_html
    row.text_fallback = body.text_fallback if body.is_html else None
    row.updated_by_sub = actor.sub
    await db.commit()
    logger.info(
        "email_template_saved",
        extra={
            "category": "biz",
            "company_id": company_id,
            "event_type": event_type,
            "actor": actor.sub,
            "is_new": is_new,
        },
    )
    default_subject, default_body, default_is_html = _default_for(event_type)
    return EmailTemplateDetail(
        event_type=event_type,
        label=CUSTOMIZABLE_EVENT_TYPES[event_type],
        overridden=True,
        variables=KNOWN_VARIABLES[event_type],
        subject=row.subject,
        body=row.body,
        is_html=row.is_html,
        text_fallback=row.text_fallback,
        default_subject=default_subject,
        default_body=default_body,
        default_is_html=default_is_html,
    )


@router.delete(
    "/{event_type}",
    status_code=204,
    summary="회사 override 삭제 — 시스템 기본 사용으로 복귀",
)
async def delete_template(
    company_id: str = Path(...),
    event_type: str = Path(...),
    actor: UserContext = Depends(require_company_admin),
    db: AsyncSession = Depends(get_db),
) -> None:
    _assert_supported(event_type)
    row = await db.get(CompanyEmailTemplate, (company_id, event_type))
    if row is None:
        return
    await db.delete(row)
    await db.commit()
    logger.info(
        "email_template_removed",
        extra={
            "category": "biz",
            "company_id": company_id,
            "event_type": event_type,
            "actor": actor.sub,
        },
    )


@router.post(
    "/{event_type}/preview",
    response_model=EmailTemplatePreviewResponse,
    summary="템플릿 미리보기 — 샘플 변수로 렌더링",
)
async def preview_template(
    body: EmailTemplatePreviewRequest,
    company_id: str = Path(...),
    event_type: str = Path(...),
    _: UserContext = Depends(require_company_admin),
    db: AsyncSession = Depends(get_db),
) -> EmailTemplatePreviewResponse:
    _assert_supported(event_type)
    # 저장 전 검증 — 운영자에게 즉시 에러 피드백
    validate_template(
        event_type, body.subject, body.body, text_fallback=body.text_fallback
    )
    # 회사 등록 정보가 있으면 placeholder 대신 실제 값 사용 — 미리보기가 발송과 일치하게.
    ctx = dict(SAMPLE_VARIABLES[event_type])
    from app.models.company import Company
    from app.services.email_template import make_brand_html

    company = await db.get(Company, company_id)
    if company is not None:
        ctx["organization_name"] = company.name
        ctx["organization_logo_url"] = company.logo_url or ""
        ctx["organization_brand"] = make_brand_html(company.name, company.logo_url)
    try:
        return EmailTemplatePreviewResponse(
            subject=body.subject.format(**ctx),
            body=body.body.format(**ctx),
            is_html=body.is_html,
            text_fallback=(
                body.text_fallback.format(**ctx)
                if body.is_html and body.text_fallback
                else None
            ),
        )
    except KeyError as exc:
        # validate_template 이 잡았어야 하나 방어
        raise HTTPException(400, f"Unknown variable: {exc}") from exc
