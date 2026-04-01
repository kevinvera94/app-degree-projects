from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

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
    model_config = ConfigDict(json_schema_extra={"example": {
        "title": "Sistema de gestión de trabajos de grado USC",
        "modality_id": "b2c3d4e5-2345-6789-bcde-f01234567890",
        "academic_program_id": "a1b2c3d4-1234-5678-abcd-ef0123456789",
        "research_group": "GIEIAM",
        "research_line": "Ingeniería de software y sistemas de información",
        "suggested_director": "Dr. Carlos Rodríguez",
        "member_ids": ["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
        "prerequisite_declaration": True,
    }})

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
    model_config = ConfigDict(json_schema_extra={"example": {
        "id": "f6a7b8c9-6789-abcd-f012-345678901234",
        "title": "Sistema de gestión de trabajos de grado USC",
        "modality_id": "b2c3d4e5-2345-6789-bcde-f01234567890",
        "academic_program_id": "a1b2c3d4-1234-5678-abcd-ef0123456789",
        "research_group": "GIEIAM",
        "research_line": "Ingeniería de software y sistemas de información",
        "suggested_director": "Dr. Carlos Rodríguez",
        "period": "2026-1",
        "status": "idea_inscrita",
        "has_company_link": False,
        "plagiarism_suspended": False,
        "created_at": "2026-02-05T09:00:00Z",
        "updated_at": "2026-02-05T09:00:00Z",
    }})

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
    model_config = ConfigDict(json_schema_extra={"example": {
        "items": [],
        "total": 0,
        "page": 1,
        "size": 20,
    }})

    items: list[ProjectResponse]
    total: int
    page: int
    size: int


# ---------------------------------------------------------------------------
# Sub-schemas para el detalle de proyecto
# ---------------------------------------------------------------------------


class ProjectMemberInfo(BaseModel):
    model_config = ConfigDict(json_schema_extra={"example": {
        "id": "1a2b3c4d-1234-5678-9abc-def012345678",
        "student_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "full_name": "Ana María Torres",
        "email": "ana.torres@usc.edu.co",
        "is_active": True,
        "joined_at": "2026-02-05T09:00:00Z",
    }})

    id: UUID
    student_id: UUID
    full_name: str
    email: str
    is_active: bool
    joined_at: datetime


class ProjectDirectorInfo(BaseModel):
    model_config = ConfigDict(json_schema_extra={"example": {
        "id": "e5f6a7b8-5678-9abc-ef01-234567890123",
        "docente_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "full_name": "Dr. Carlos Rodríguez",
        "order": 1,
        "is_active": True,
        "assigned_at": "2026-02-10T10:00:00Z",
    }})

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
    model_config = ConfigDict(json_schema_extra={"example": {
        "juror_number": 1,
        "stage": "anteproyecto",
        "is_active": True,
        "id": "a7b8c9d0-7890-bcde-0123-456789012345",
        "docente_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "full_name": "Dra. Laura Martínez",
        "assigned_at": "2026-02-15T11:00:00Z",
    }})

    juror_number: int
    stage: str
    is_active: bool
    id: Optional[UUID] = None
    docente_id: Optional[UUID] = None
    full_name: Optional[str] = None
    assigned_at: Optional[datetime] = None


class SubmissionBasicInfo(BaseModel):
    model_config = ConfigDict(json_schema_extra={"example": {
        "id": "d0e1f2a3-0123-ef01-3456-789012345678",
        "stage": "anteproyecto",
        "submitted_at": "2026-02-20T16:00:00Z",
        "status": "pendiente",
        "revision_number": 1,
        "is_extemporaneous": False,
    }})

    id: UUID
    stage: str
    submitted_at: datetime
    status: str
    revision_number: int
    is_extemporaneous: bool


class MemberAdd(BaseModel):
    model_config = ConfigDict(json_schema_extra={"example": {
        "user_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    }})

    user_id: UUID


class SuggestedJurorInfo(BaseModel):
    """Jurado del anteproyecto sugerido para producto final (Admin/Docente solamente)."""
    model_config = ConfigDict(json_schema_extra={"example": {
        "juror_number": 1,
        "docente_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "full_name": "Dra. Laura Martínez",
    }})

    juror_number: int
    docente_id: UUID
    full_name: str


class ProjectDetailResponse(ProjectResponse):
    model_config = ConfigDict(json_schema_extra={"example": {
        "id": "f6a7b8c9-6789-abcd-f012-345678901234",
        "title": "Sistema de gestión de trabajos de grado USC",
        "modality_id": "b2c3d4e5-2345-6789-bcde-f01234567890",
        "academic_program_id": "a1b2c3d4-1234-5678-abcd-ef0123456789",
        "research_group": "GIEIAM",
        "research_line": "Ingeniería de software y sistemas de información",
        "suggested_director": "Dr. Carlos Rodríguez",
        "period": "2026-1",
        "status": "en_desarrollo",
        "has_company_link": False,
        "plagiarism_suspended": False,
        "created_at": "2026-02-05T09:00:00Z",
        "updated_at": "2026-03-01T10:00:00Z",
        "members": [],
        "directors": [],
        "jurors": [],
        "submissions": [],
        "suggested_jurors": [],
    }})

    members: list[ProjectMemberInfo] = []
    directors: list[ProjectDirectorInfo] = []
    jurors: list[ProjectJurorInfo] = []
    submissions: list[SubmissionBasicInfo] = []
    suggested_jurors: list[SuggestedJurorInfo] = []
