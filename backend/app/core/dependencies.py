from dataclasses import dataclass
from typing import Optional
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError

from app.core.security import decode_jwt

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


@dataclass
class CurrentUser:
    id: UUID
    email: str
    role: str


async def get_current_user(
    token: str = Depends(oauth2_scheme),
) -> CurrentUser:
    """Valida el JWT de Supabase y retorna el usuario autenticado."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token inválido o expirado",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_jwt(token)
        user_id: Optional[str] = payload.get("sub")
        email: Optional[str] = payload.get("email")
        role: Optional[str] = payload.get("role")
        if not user_id or not email or not role:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    return CurrentUser(id=UUID(user_id), email=email, role=role)


async def require_admin(
    user: CurrentUser = Depends(get_current_user),
) -> CurrentUser:
    """Lanza 403 si el rol no es administrador."""
    if user.role != "administrador":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requiere rol administrador",
        )
    return user


async def require_docente(
    user: CurrentUser = Depends(get_current_user),
) -> CurrentUser:
    """Lanza 403 si el rol no es docente."""
    if user.role != "docente":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requiere rol docente",
        )
    return user


async def require_estudiante(
    user: CurrentUser = Depends(get_current_user),
) -> CurrentUser:
    """Lanza 403 si el rol no es estudiante."""
    if user.role != "estudiante":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requiere rol estudiante",
        )
    return user


async def require_project_member(
    project_id: UUID,
    user: CurrentUser = Depends(get_current_user),
) -> CurrentUser:
    """
    Valida que el usuario tenga acceso al proyecto.
    La verificación real contra la BD se hace en cada router;
    esta dependencia solo garantiza que el usuario está autenticado
    y expone el project_id para las consultas posteriores.
    """
    return user
