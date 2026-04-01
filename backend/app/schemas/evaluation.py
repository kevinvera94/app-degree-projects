from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class EvaluationCreate(BaseModel):
    model_config = ConfigDict(json_schema_extra={"example": {
        "stage": "anteproyecto",
        "score": 3.8,
        "observations": "El trabajo presenta una metodología sólida. Se recomienda ampliar el marco teórico.",
    }})

    stage: str = Field(..., pattern="^(anteproyecto|producto_final)$")
    score: float = Field(..., ge=0.0, le=5.0)
    observations: str = Field(..., min_length=1)


# ---------------------------------------------------------------------------
# Respuestas diferenciadas por rol (anonimato aplicado en capa de servicio)
# ---------------------------------------------------------------------------


class EvaluationStudentResponse(BaseModel):
    """Solo juror_number — sin identidad del jurado."""
    model_config = ConfigDict(json_schema_extra={"example": {
        "id": "b8c9d0e1-8901-cdef-1234-567890123456",
        "juror_number": 1,
        "stage": "anteproyecto",
        "revision_number": 1,
        "score": 3.8,
        "observations": "El trabajo presenta una metodología sólida.",
        "submitted_at": "2026-03-01T14:00:00Z",
    }})

    id: UUID
    juror_number: int
    stage: str
    revision_number: int
    score: Optional[float]
    observations: Optional[str]
    submitted_at: Optional[datetime]


class EvaluationDirectorResponse(BaseModel):
    """Director ve identidad del jurado pero no is_extemporaneous."""
    model_config = ConfigDict(json_schema_extra={"example": {
        "id": "b8c9d0e1-8901-cdef-1234-567890123456",
        "juror_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "juror_name": "Dra. Laura Martínez",
        "juror_number": 1,
        "stage": "anteproyecto",
        "revision_number": 1,
        "score": 3.8,
        "observations": "El trabajo presenta una metodología sólida.",
        "submitted_at": "2026-03-01T14:00:00Z",
    }})

    id: UUID
    juror_id: UUID
    juror_name: str
    juror_number: int
    stage: str
    revision_number: int
    score: Optional[float]
    observations: Optional[str]
    submitted_at: Optional[datetime]


class EvaluationAdminResponse(BaseModel):
    """Administrador ve todo, incluyendo extemporáneo."""
    model_config = ConfigDict(json_schema_extra={"example": {
        "id": "b8c9d0e1-8901-cdef-1234-567890123456",
        "juror_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "juror_name": "Dra. Laura Martínez",
        "juror_number": 1,
        "stage": "anteproyecto",
        "revision_number": 1,
        "score": 3.8,
        "observations": "El trabajo presenta una metodología sólida.",
        "submitted_at": "2026-03-01T14:00:00Z",
        "due_date": "2026-03-15T23:59:59Z",
        "is_extemporaneous": False,
    }})

    id: UUID
    juror_id: UUID
    juror_name: str
    juror_number: int
    stage: str
    revision_number: int
    score: Optional[float]
    observations: Optional[str]
    submitted_at: Optional[datetime]
    due_date: datetime
    is_extemporaneous: bool
