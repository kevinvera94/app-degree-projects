from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

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

    def validate_level(self) -> None:
        if self.level not in VALID_LEVELS:
            raise ValueError(f"Nivel inválido. Debe ser uno de: {', '.join(sorted(VALID_LEVELS))}")


class AcademicProgramUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=150)
    level: Optional[str] = None
    is_active: Optional[bool] = None

    def validate_level(self) -> None:
        if self.level is not None and self.level not in VALID_LEVELS:
            raise ValueError(f"Nivel inválido. Debe ser uno de: {', '.join(sorted(VALID_LEVELS))}")


class AcademicProgramResponse(BaseModel):
    id: UUID
    name: str
    level: str
    faculty: str
    is_active: bool
