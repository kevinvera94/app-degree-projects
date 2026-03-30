from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.date_window import WindowType


class ExtemporaneousWindowCreate(BaseModel):
    window_type: WindowType
    valid_until: date
    notes: Optional[str] = Field(None, max_length=1000)


class ExtemporaneousWindowResponse(BaseModel):
    id: UUID
    project_id: UUID
    stage: WindowType
    granted_by: UUID
    granted_at: datetime
    valid_until: date
    notes: Optional[str]
