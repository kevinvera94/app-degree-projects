from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

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

    def validate_role(self) -> None:
        if self.role not in VALID_ROLES:
            raise ValueError(f"Rol inválido. Debe ser uno de: {', '.join(VALID_ROLES)}")


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(None, max_length=150)
    email: Optional[EmailStr] = None
    role: Optional[str] = None

    def validate_role(self) -> None:
        if self.role is not None and self.role not in VALID_ROLES:
            raise ValueError(f"Rol inválido. Debe ser uno de: {', '.join(VALID_ROLES)}")


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
