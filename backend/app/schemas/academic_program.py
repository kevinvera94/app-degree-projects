from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

VALID_LEVELS = {
    "tecnologico",
    "profesional",
    "especializacion",
    "maestria_profundizacion",
    "maestria_investigacion",
    "doctorado",
}


class AcademicProgramCreate(BaseModel):
    name: str = Field(..., max_length=150)
    level: str
    faculty: str = Field("Ingeniería", max_length=100)

    @field_validator("level")
    @classmethod
    def validate_level(cls, v: str) -> str:
        if v not in VALID_LEVELS:
            raise ValueError(
                f"Nivel inválido. Debe ser uno de: {', '.join(sorted(VALID_LEVELS))}"
            )
        return v


class AcademicProgramUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=150)
    level: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("level")
    @classmethod
    def validate_level(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_LEVELS:
            raise ValueError(
                f"Nivel inválido. Debe ser uno de: {', '.join(sorted(VALID_LEVELS))}"
            )
        return v


class AcademicProgramResponse(BaseModel):
    id: UUID
    name: str
    level: str
    faculty: str
    is_active: bool
