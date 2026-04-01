from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class JurorCreate(BaseModel):
    model_config = ConfigDict(json_schema_extra={"example": {
        "user_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "juror_number": 1,
        "stage": "anteproyecto",
    }})

    user_id: UUID
    juror_number: int = Field(..., ge=1, le=3)
    stage: str = Field(..., pattern="^(anteproyecto|producto_final|sustentacion)$")


class JurorResponse(BaseModel):
    """
    Respuesta completa para Admin y Docente.
    Los campos opcionales quedan en None cuando el receptor es Estudiante
    (anonimato aplicado en la capa de servicio, no en el frontend).
    """
    model_config = ConfigDict(json_schema_extra={"example": {
        "id": "a7b8c9d0-7890-bcde-0123-456789012345",
        "project_id": "f6a7b8c9-6789-abcd-f012-345678901234",
        "juror_number": 1,
        "stage": "anteproyecto",
        "is_active": True,
        "assigned_at": "2026-02-15T11:00:00Z",
        "docente_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "full_name": "Dra. Laura Martínez",
        "assigned_by": "1a2b3c4d-1234-5678-9abc-def012345678",
    }})

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
    model_config = ConfigDict(json_schema_extra={"example": {
        "juror_number": 1,
        "stage": "anteproyecto",
        "is_active": True,
    }})

    juror_number: int
    stage: str
    is_active: bool
