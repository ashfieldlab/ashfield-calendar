"""/api/v1/companies/{id}/profile — 회사 표시 정보 (Company Admin).

현재는 외부 고객 이메일에 노출되는 로고 URL 만 — 이후 brand color 등 확장 가능.
회사 이름(name)은 JWT groups·Keycloak 캐시라 여기서 수정 X (ADR-0004).
"""

from fastapi import APIRouter, Depends, Path
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.context import UserContext
from app.auth.dependencies import require_company_admin
from app.core.db import get_db
from app.core.errors import BusinessError
from app.core.logging import logger
from app.models.company import Company

router = APIRouter(
    prefix="/companies/{company_id}/profile", tags=["company"]
)


class CompanyProfileResponse(BaseModel):
    company_id: str
    name: str
    logo_url: str | None


class CompanyProfilePatch(BaseModel):
    logo_url: str | None = Field(default=None, max_length=1024)

    @field_validator("logo_url")
    @classmethod
    def _validate_url(cls, v: str | None) -> str | None:
        if v is None or v == "":
            return None
        v = v.strip()
        if not (v.startswith("https://") or v.startswith("http://")):
            raise ValueError("URL 은 http(s):// 로 시작해야 합니다.")
        return v


@router.get(
    "",
    response_model=CompanyProfileResponse,
    summary="회사 표시 정보 조회 (Company Admin)",
)
async def get_profile(
    company_id: str = Path(...),
    _: UserContext = Depends(require_company_admin),
    db: AsyncSession = Depends(get_db),
) -> CompanyProfileResponse:
    c = await db.get(Company, company_id)
    if c is None:
        raise BusinessError("COMPANY_NOT_FOUND", status=404, message="회사 없음")
    return CompanyProfileResponse(
        company_id=c.id, name=c.name, logo_url=c.logo_url
    )


@router.put(
    "",
    response_model=CompanyProfileResponse,
    summary="회사 표시 정보 수정 (Company Admin)",
)
async def put_profile(
    body: CompanyProfilePatch,
    company_id: str = Path(...),
    actor: UserContext = Depends(require_company_admin),
    db: AsyncSession = Depends(get_db),
) -> CompanyProfileResponse:
    c = await db.get(Company, company_id)
    if c is None:
        raise BusinessError("COMPANY_NOT_FOUND", status=404, message="회사 없음")
    c.logo_url = body.logo_url
    await db.commit()
    logger.info(
        "company_profile_updated",
        extra={
            "category": "biz",
            "company_id": company_id,
            "actor": actor.sub,
            "logo_url_set": c.logo_url is not None,
        },
    )
    return CompanyProfileResponse(
        company_id=c.id, name=c.name, logo_url=c.logo_url
    )
