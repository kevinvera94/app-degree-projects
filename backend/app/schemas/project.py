from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator

VALID_RESEARCH_GROUPS = {"GIEIAM", "COMBA_ID"}

# Estados que dan por cerrado un trabajo — el estudiante puede inscribir uno nuevo
TERMINAL_STATUSES = frozenset({
    "idea_rechazada",
    "cancelado",
    "reprobado_en_sustentacion",
    "acta_generada",
})


class ProjectCreate(BaseModel):
    title: str = Field(..., max_length=100)
    modality_id: UUID
    academic_program_id: UUID
    research_group: str
    research_line: str = Field(..., max_length=200)
    suggested_director: Optional[str] = Field(None, max_length=150)
    member_ids: list[UUID] = Field(..., min_length=1)
    prerequisite_declaration: bool

    @field_validator("research_group")
    @classmethod
    def validate_research_group(cls, v: str) -> str:
        if v not in VALID_RESEARCH_GROUPS:
            raise ValueError(
                f"Grupo de investigación inválido. Debe ser uno de: "
                f"{', '.join(sorted(VALID_RESEARCH_GROUPS))}"
            )
        return v

    @field_validator("prerequisite_declaration")
    @classmethod
    def validate_prerequisite(cls, v: bool) -> bool:
        if not v:
            raise ValueError(
                "Debe declarar que cumple los requisitos previos "
                "(70% de créditos aprobados en pregrado o 50% del plan en posgrado)"
            )
        return v

    @model_validator(mode="after")
    def validate_unique_members(self) -> "ProjectCreate":
        if len(self.member_ids) != len(set(self.member_ids)):
            raise ValueError("Los IDs de integrantes no deben repetirse")
        return self


class ProjectResponse(BaseModel):
    id: UUID
    title: str
    modality_id: UUID
    academic_program_id: UUID
    research_group: str
    research_line: str
    suggested_director: Optional[str]
    period: str
    status: str
    has_company_link: bool
    plagiarism_suspended: bool
    created_at: datetime
    updated_at: datetime
