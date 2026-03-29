from uuid import UUID

from pydantic import BaseModel, EmailStr


class UserMeResponse(BaseModel):
    id: UUID
    full_name: str
    email: EmailStr
    role: str
    is_active: bool
