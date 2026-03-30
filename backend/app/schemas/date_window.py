from datetime import date, datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


class WindowType(str, Enum):
    inscripcion_idea = "inscripcion_idea"
    radicacion_anteproyecto = "radicacion_anteproyecto"
    radicacion_producto_final = "radicacion_producto_final"


class DateWindowCreate(BaseModel):
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
    id: UUID
    period: str
    window_type: WindowType
    start_date: date
    end_date: date
    is_active: bool
    created_by: UUID
    created_at: datetime
