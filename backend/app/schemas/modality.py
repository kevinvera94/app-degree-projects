from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.academic_program import VALID_LEVELS


class ModalityCreate(BaseModel):
    name: str = Field(..., max_length=100)
    levels: list[str]
    max_members: int = Field(..., ge=1)
    requires_sustentation: bool = True
    requires_ethics_approval: bool = False
    requires_business_plan_cert: bool = False

    def validate_levels(self) -> None:
        invalid = [l for l in self.levels if l not in VALID_LEVELS]
        if invalid:
            raise ValueError(f"Niveles inválidos: {', '.join(invalid)}")
        if not self.levels:
            raise ValueError("Debe especificar al menos un nivel académico")


class ModalityUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    max_members: Optional[int] = Field(None, ge=1)
    is_active: Optional[bool] = None


class ModalityResponse(BaseModel):
    id: UUID
    name: str
    levels: list[str]
    max_members: int
    requires_sustentation: bool
    requires_ethics_approval: bool
    requires_business_plan_cert: bool
    is_active: bool
    created_at: datetime


class ModalityLimitUpsert(BaseModel):
    max_members: int = Field(..., ge=1)


class ModalityLimitResponse(BaseModel):
    id: UUID
    modality_id: UUID
    level: str
    max_members: int
    updated_at: datetime
