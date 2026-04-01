from datetime import date, datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class WindowType(str, Enum):
    inscripcion_idea = "inscripcion_idea"
    radicacion_anteproyecto = "radicacion_anteproyecto"
    radicacion_producto_final = "radicacion_producto_final"


class DateWindowCreate(BaseModel):
    model_config = ConfigDict(json_schema_extra={"example": {
        "period": "2026-1",
        "window_type": "inscripcion_idea",
        "start_date": "2026-02-01",
        "end_date": "2026-02-28",
        "is_active": True,
    }})

    period: str = Field(..., max_length=10)
    window_type: WindowType
    start_date: date
    end_date: date
    is_active: bool = True

    @model_validator(mode="after")
    def validate_dates(self) -> "DateWindowCreate":
        if self.start_date >= self.end_date:
            raise ValueError("start_date debe ser anterior a end_date")
        return self


class DateWindowUpdate(BaseModel):
    model_config = ConfigDict(json_schema_extra={"example": {
        "end_date": "2026-03-07",
        "is_active": True,
    }})

    period: Optional[str] = Field(None, max_length=10)
    window_type: Optional[WindowType] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_active: Optional[bool] = None

    @model_validator(mode="after")
    def validate_dates(self) -> "DateWindowUpdate":
        if self.start_date and self.end_date and self.start_date >= self.end_date:
            raise ValueError("start_date debe ser anterior a end_date")
        return self


class DateWindowResponse(BaseModel):
    model_config = ConfigDict(json_schema_extra={"example": {
        "id": "d4e5f6a7-4567-89ab-def0-123456789012",
        "period": "2026-1",
        "window_type": "inscripcion_idea",
        "start_date": "2026-02-01",
        "end_date": "2026-02-28",
        "is_active": True,
        "created_by": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "created_at": "2026-01-20T09:00:00Z",
    }})

    id: UUID
    period: str
    window_type: WindowType
    start_date: date
    end_date: date
    is_active: bool
    created_by: UUID
    created_at: datetime
