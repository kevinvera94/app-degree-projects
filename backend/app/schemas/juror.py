from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class JurorCreate(BaseModel):
    user_id: UUID
    juror_number: int = Field(..., ge=1, le=3)
    stage: str = Field(..., pattern="^(anteproyecto|producto_final|sustentacion)$")


class JurorResponse(BaseModel):
    """
    Respuesta completa para Admin y Docente.
    Los campos opcionales quedan en None cuando el receptor es Estudiante
    (anonimato aplicado en la capa de servicio, no en el frontend).
    """

    id: UUID
    project_id: UUID
    juror_number: int
    stage: str
    is_active: bool
    assigned_at: datetime
    # Campos de identidad — None para Estudiante
    docente_id: Optional[UUID] = None
    full_name: Optional[str] = None
    assigned_by: Optional[UUID] = None


class JurorStudentResponse(BaseModel):
    """Respuesta reducida enviada a Estudiantes — sin identidad del jurado."""

    juror_number: int
    stage: str
    is_active: bool
