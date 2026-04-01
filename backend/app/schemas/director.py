from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class DirectorCreate(BaseModel):
    model_config = ConfigDict(json_schema_extra={"example": {
        "user_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "order": 1,
    }})

    user_id: UUID
    order: int = Field(..., ge=1, le=2)

    @field_validator("order")
    @classmethod
    def validate_order(cls, v: int) -> int:
        if v not in (1, 2):
            raise ValueError(
                "El orden del director debe ser 1 (principal) o 2 (co-director)"
            )
        return v


class DirectorResponse(BaseModel):
    model_config = ConfigDict(json_schema_extra={"example": {
        "id": "e5f6a7b8-5678-9abc-ef01-234567890123",
        "project_id": "f6a7b8c9-6789-abcd-f012-345678901234",
        "docente_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "full_name": "Dr. Carlos Rodríguez",
        "order": 1,
        "is_active": True,
        "assigned_at": "2026-02-10T10:00:00Z",
    }})

    id: UUID
    project_id: UUID
    docente_id: UUID
    full_name: str
    order: int
    is_active: bool
    assigned_at: datetime


class ProjectStatusUpdate(BaseModel):
    model_config = ConfigDict(json_schema_extra={"example": {
        "action": "aprobar",
        "reason": "Cumple con todos los requisitos del comité.",
    }})

    action: str
    reason: Optional[str] = None
