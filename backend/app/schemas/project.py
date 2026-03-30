from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator

VALID_RESEARCH_GROUPS = {"GIEIAM", "COMBA_ID"}

# Estados que dan por cerrado un trabajo — el estudiante puede inscribir uno nuevo
TERMINAL_STATUSES = frozenset(
    {
        "idea_rechazada",
        "cancelado",
        "reprobado_en_sustentacion",
        "acta_generada",
    }
)


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


class PaginatedProjectsResponse(BaseModel):
    items: list[ProjectResponse]
    total: int
    page: int
    size: int


# ---------------------------------------------------------------------------
# Sub-schemas para el detalle de proyecto
# ---------------------------------------------------------------------------


class ProjectMemberInfo(BaseModel):
    id: UUID
    student_id: UUID
    full_name: str
    email: str
    is_active: bool
    joined_at: datetime


class ProjectDirectorInfo(BaseModel):
    id: UUID
    docente_id: UUID
    full_name: str
    order: int
    is_active: bool
    assigned_at: datetime


class ProjectJurorInfo(BaseModel):
    """
    Información de jurado. Los campos de identidad son None cuando
    el receptor es un estudiante (anonimato garantizado por el router).
    """

    juror_number: int
    stage: str
    is_active: bool
    id: Optional[UUID] = None
    docente_id: Optional[UUID] = None
    full_name: Optional[str] = None
    assigned_at: Optional[datetime] = None


class SubmissionBasicInfo(BaseModel):
    id: UUID
    stage: str
    submitted_at: datetime
    status: str
    revision_number: int
    is_extemporaneous: bool


class MemberAdd(BaseModel):
    user_id: UUID


class SuggestedJurorInfo(BaseModel):
    """Jurado del anteproyecto sugerido para producto final (Admin/Docente solamente)."""
    juror_number: int
    docente_id: UUID
    full_name: str


class ProjectDetailResponse(ProjectResponse):
    members: list[ProjectMemberInfo] = []
    directors: list[ProjectDirectorInfo] = []
    jurors: list[ProjectJurorInfo] = []
    submissions: list[SubmissionBasicInfo] = []
    suggested_jurors: list[SuggestedJurorInfo] = []
