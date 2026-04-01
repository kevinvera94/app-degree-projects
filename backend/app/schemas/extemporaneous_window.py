from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.date_window import WindowType


class ExtemporaneousWindowCreate(BaseModel):
    model_config = ConfigDict(json_schema_extra={"example": {
        "window_type": "radicacion_anteproyecto",
        "valid_until": "2026-04-15",
        "notes": "Prórroga aprobada por el comité por fuerza mayor.",
    }})

    window_type: WindowType
    valid_until: date
    notes: Optional[str] = Field(None, max_length=1000)


class ExtemporaneousWindowResponse(BaseModel):
    model_config = ConfigDict(json_schema_extra={"example": {
        "id": "c9d0e1f2-9012-def0-2345-678901234567",
        "project_id": "f6a7b8c9-6789-abcd-f012-345678901234",
        "stage": "radicacion_anteproyecto",
        "granted_by": "1a2b3c4d-1234-5678-9abc-def012345678",
        "granted_at": "2026-03-20T09:00:00Z",
        "valid_until": "2026-04-15",
        "notes": "Prórroga aprobada por el comité por fuerza mayor.",
    }})

    id: UUID
    project_id: UUID
    stage: WindowType
    granted_by: UUID
    granted_at: datetime
    valid_until: date
    notes: Optional[str]
