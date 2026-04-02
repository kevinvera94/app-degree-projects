from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

VALID_ROLES = {"administrador", "docente", "estudiante"}


class UserMeResponse(BaseModel):
    model_config = ConfigDict(json_schema_extra={"example": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "full_name": "Ana María Torres",
        "email": "ana.torres@usc.edu.co",
        "role": "estudiante",
        "is_active": True,
    }})

    id: UUID
    full_name: str
    email: EmailStr
    role: str
    is_active: bool


class UserCreate(BaseModel):
    model_config = ConfigDict(json_schema_extra={"example": {
        "full_name": "Carlos Rodríguez Gómez",
        "email": "carlos.rodriguez@usc.edu.co",
        "password": "Segura1234",
        "role": "docente",
    }})

    full_name: str = Field(..., max_length=150)
    email: EmailStr
    password: str = Field(..., min_length=8)
    role: str

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        if v not in VALID_ROLES:
            raise ValueError(
                f"Rol inválido. Debe ser uno de: {', '.join(sorted(VALID_ROLES))}"
            )
        return v


class UserUpdate(BaseModel):
    model_config = ConfigDict(json_schema_extra={"example": {
        "full_name": "Carlos Rodríguez Gómez",
        "email": "carlos.rodriguez@usc.edu.co",
        "role": "docente",
    }})

    full_name: Optional[str] = Field(None, max_length=150)
    email: Optional[EmailStr] = None
    role: Optional[str] = None

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_ROLES:
            raise ValueError(
                f"Rol inválido. Debe ser uno de: {', '.join(sorted(VALID_ROLES))}"
            )
        return v


class UserResponse(BaseModel):
    model_config = ConfigDict(json_schema_extra={"example": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "full_name": "Carlos Rodríguez Gómez",
        "email": "carlos.rodriguez@usc.edu.co",
        "role": "docente",
        "is_active": True,
        "created_at": "2026-01-15T08:00:00Z",
    }})

    id: UUID
    full_name: str
    email: EmailStr
    role: str
    is_active: bool
    created_at: datetime


class PaginatedUsersResponse(BaseModel):
    model_config = ConfigDict(json_schema_extra={"example": {
        "items": [],
        "total": 0,
        "page": 1,
        "size": 20,
    }})

    items: list[UserResponse]
    total: int
    page: int
    size: int


class StudentSearchResult(BaseModel):
    """Resultado mínimo para el buscador de integrantes en inscripción de idea.
    No expone rol, estado activo ni fecha de creación."""

    model_config = ConfigDict(json_schema_extra={"example": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "full_name": "Ana María Torres",
        "email": "ana.torres@usc.edu.co",
    }})

    id: UUID
    full_name: str
    email: str


class DeactivateUserResponse(BaseModel):
    model_config = ConfigDict(json_schema_extra={"example": {
        "user_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "affected_project_ids": ["a1b2c3d4-1234-5678-abcd-ef0123456789"],
    }})

    user_id: UUID
    affected_project_ids: list[UUID]
