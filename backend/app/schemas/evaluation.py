from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class EvaluationCreate(BaseModel):
    stage: str = Field(..., pattern="^(anteproyecto|producto_final)$")
    score: float = Field(..., ge=0.0, le=5.0)
    observations: str = Field(..., min_length=1)


# ---------------------------------------------------------------------------
# Respuestas diferenciadas por rol (anonimato aplicado en capa de servicio)
# ---------------------------------------------------------------------------


class EvaluationStudentResponse(BaseModel):
    """Solo juror_number — sin identidad del jurado."""
    id: UUID
    juror_number: int
    stage: str
    revision_number: int
    score: Optional[float]
    observations: Optional[str]
    submitted_at: Optional[datetime]


class EvaluationDirectorResponse(BaseModel):
    """Director ve identidad del jurado pero no is_extemporaneous."""
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
