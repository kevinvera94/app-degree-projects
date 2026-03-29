from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator

VALID_ROLES = {"administrador", "docente", "estudiante"}


class UserMeResponse(BaseModel):
    id: UUID
    full_name: str
    email: EmailStr
    role: str
    is_active: bool


class UserCreate(BaseModel):
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
    id: UUID
    full_name: str
    email: EmailStr
    role: str
    is_active: bool
    created_at: datetime


class PaginatedUsersResponse(BaseModel):
    items: list[UserResponse]
    total: int
    page: int
    size: int


class DeactivateUserResponse(BaseModel):
    user_id: UUID
    affected_project_ids: list[UUID]
