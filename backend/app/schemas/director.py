from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class DirectorCreate(BaseModel):
    user_id: UUID
    order: int = Field(..., ge=1, le=2)

    @field_validator("order")
    @classmethod
    def validate_order(cls, v: int) -> int:
        if v not in (1, 2):
            raise ValueError("El orden del director debe ser 1 (principal) o 2 (co-director)")
        return v


class DirectorResponse(BaseModel):
    id: UUID
    project_id: UUID
    docente_id: UUID
    full_name: str
    order: int
    is_active: bool
    assigned_at: datetime


class ProjectStatusUpdate(BaseModel):
    action: str
    reason: Optional[str] = None
