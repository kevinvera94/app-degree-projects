from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

VALID_LEVELS = {
    "tecnologico",
    "profesional",
    "especializacion",
    "maestria_profundizacion",
    "maestria_investigacion",
    "doctorado",
}


class AcademicProgramCreate(BaseModel):
    model_config = ConfigDict(json_schema_extra={"example": {
        "name": "Ingeniería de Sistemas",
        "level": "profesional",
        "faculty": "Ingeniería",
    }})

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
    model_config = ConfigDict(json_schema_extra={"example": {
        "name": "Ingeniería de Sistemas y Computación",
        "level": "profesional",
        "is_active": True,
    }})

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
    model_config = ConfigDict(json_schema_extra={"example": {
        "id": "a1b2c3d4-1234-5678-abcd-ef0123456789",
        "name": "Ingeniería de Sistemas",
        "level": "profesional",
        "faculty": "Ingeniería",
        "is_active": True,
    }})

    id: UUID
    name: str
    level: str
    faculty: str
    is_active: bool
