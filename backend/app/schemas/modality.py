from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.academic_program import VALID_LEVELS


class ModalityCreate(BaseModel):
    model_config = ConfigDict(json_schema_extra={"example": {
        "name": "Investigación",
        "levels": ["profesional", "maestria_investigacion"],
        "max_members": 2,
        "requires_sustentation": True,
        "requires_ethics_approval": True,
        "requires_business_plan_cert": False,
    }})

    name: str = Field(..., max_length=100)
    levels: list[str]
    max_members: int = Field(..., ge=1)
    requires_sustentation: bool = True
    requires_ethics_approval: bool = False
    requires_business_plan_cert: bool = False

    @model_validator(mode="after")
    def validate_levels(self) -> "ModalityCreate":
        if not self.levels:
            raise ValueError("Debe especificar al menos un nivel académico")
        invalid = [lvl for lvl in self.levels if lvl not in VALID_LEVELS]
        if invalid:
            raise ValueError(f"Niveles inválidos: {', '.join(invalid)}")
        return self


class ModalityUpdate(BaseModel):
    model_config = ConfigDict(json_schema_extra={"example": {
        "name": "Investigación Aplicada",
        "levels": ["profesional", "maestria_investigacion"],
        "max_members": 3,
        "is_active": True,
    }})

    name: Optional[str] = Field(None, max_length=100)
    levels: Optional[list[str]] = None
    max_members: Optional[int] = Field(None, ge=1)
    is_active: Optional[bool] = None

    @model_validator(mode="after")
    def validate_levels(self) -> "ModalityUpdate":
        if self.levels is not None:
            if len(self.levels) == 0:
                raise ValueError("Debe especificar al menos un nivel académico")
            invalid = [lvl for lvl in self.levels if lvl not in VALID_LEVELS]
            if invalid:
                raise ValueError(f"Niveles inválidos: {', '.join(invalid)}")
        return self


class ModalityResponse(BaseModel):
    model_config = ConfigDict(json_schema_extra={"example": {
        "id": "b2c3d4e5-2345-6789-bcde-f01234567890",
        "name": "Investigación",
        "levels": ["profesional", "maestria_investigacion"],
        "max_members": 2,
        "requires_sustentation": True,
        "requires_ethics_approval": True,
        "requires_business_plan_cert": False,
        "is_active": True,
        "created_at": "2026-01-10T08:00:00Z",
    }})

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
    model_config = ConfigDict(json_schema_extra={"example": {
        "max_members": 3,
    }})

    max_members: int = Field(..., ge=1)


class ModalityLimitResponse(BaseModel):
    model_config = ConfigDict(json_schema_extra={"example": {
        "id": "c3d4e5f6-3456-789a-cdef-012345678901",
        "modality_id": "b2c3d4e5-2345-6789-bcde-f01234567890",
        "level": "maestria_investigacion",
        "max_members": 1,
        "updated_at": "2026-01-12T10:00:00Z",
    }})

    id: UUID
    modality_id: UUID
    level: str
    max_members: int
    updated_at: datetime
