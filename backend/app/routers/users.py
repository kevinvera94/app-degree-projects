from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from gotrue.errors import AuthApiError
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import CurrentUser, get_current_user, require_admin
from app.core.supabase_client import get_supabase_admin
from app.services.notifications import send_system_message
from app.schemas.user import (
    DeactivateUserResponse,
    PaginatedUsersResponse,
    StudentSearchResult,
    UserCreate,
    UserResponse,
    UserUpdate,
    VALID_ROLES,
)

router = APIRouter(prefix="/users", tags=["users"])

_SELECT_FIELDS = "id, full_name, email, role, is_active, created_at"


@router.get("", response_model=PaginatedUsersResponse)
async def list_users(
    role: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    _: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> PaginatedUsersResponse:
    if role is not None and role not in VALID_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Rol inválido"
        )

    filters = []
    params: dict = {"limit": size, "offset": (page - 1) * size}

    if role is not None:
        filters.append("role = :role")
        params["role"] = role
    if is_active is not None:
        filters.append("is_active = :is_active")
        params["is_active"] = is_active

    where = ("WHERE " + " AND ".join(filters)) if filters else ""

    count_result = await db.execute(
        text(f"SELECT COUNT(*) FROM public.users {where}"),
        params,
    )
    total: int = count_result.scalar_one()

    rows_result = await db.execute(
        text(
            f"SELECT {_SELECT_FIELDS} FROM public.users"
            f" {where} ORDER BY created_at DESC LIMIT :limit OFFSET :offset"
        ),
        params,
    )
    items = [UserResponse(**row) for row in rows_result.mappings()]

    return PaginatedUsersResponse(items=items, total=total, page=page, size=size)


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    body: UserCreate,
    _: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    try:
        get_supabase_admin().auth.admin.create_user(
            {
                "email": body.email,
                "password": body.password,
                "user_metadata": {"full_name": body.full_name, "role": body.role},
                "app_metadata": {"role": body.role},
                "email_confirm": True,
            }
        )
    except AuthApiError as e:
        if (
            "already registered" in str(e).lower()
            or "already been registered" in str(e).lower()
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El email ya está registrado",
            )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    result = await db.execute(
        text(f"SELECT {_SELECT_FIELDS} FROM public.users WHERE email = :email"),
        {"email": body.email},
    )
    row = result.mappings().first()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al crear el usuario",
        )

    return UserResponse(**row)


@router.get("/search-students", response_model=list[StudentSearchResult])
async def search_students(
    q: str = Query(..., min_length=2, max_length=100),
    _: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[StudentSearchResult]:
    """
    Busca estudiantes activos por nombre o email (coincidencia parcial).
    Accesible para cualquier usuario autenticado — expone solo id, full_name, email.
    Se usa en el formulario de inscripción de idea para añadir integrantes.
    """
    result = await db.execute(
        text(
            "SELECT id, full_name, email FROM public.users"
            " WHERE role = 'estudiante' AND is_active = true"
            " AND (full_name ILIKE :q OR email ILIKE :q)"
            " ORDER BY full_name ASC LIMIT 20"
        ),
        {"q": f"%{q}%"},
    )
    return [StudentSearchResult(**row) for row in result.mappings()]


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: UUID,
    _: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    result = await db.execute(
        text(f"SELECT {_SELECT_FIELDS} FROM public.users WHERE id = :id"),
        {"id": user_id},
    )
    row = result.mappings().first()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado"
        )
    return UserResponse(**row)


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    body: UserUpdate,
    _: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    allowed = {"full_name", "email", "role"}
    updates = {
        k: v for k, v in body.model_dump(exclude_none=True).items() if k in allowed
    }

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Sin campos para actualizar"
        )

    set_clause = ", ".join(f"{k} = :{k}" for k in updates)
    result = await db.execute(
        text(
            f"UPDATE public.users"
            f" SET {set_clause} WHERE id = :id RETURNING {_SELECT_FIELDS}"
        ),
        {**updates, "id": user_id},
    )
    row = result.mappings().first()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado"
        )
    await db.commit()

    # Sincronizar email y/o rol en Supabase Auth
    auth_updates: dict = {}
    if "email" in updates:
        auth_updates["email"] = updates["email"]
    if "role" in updates:
        auth_updates["app_metadata"] = {"role": updates["role"]}
    if auth_updates:
        try:
            get_supabase_admin().auth.admin.update_user_by_id(str(user_id), auth_updates)
        except AuthApiError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return UserResponse(**row)


@router.patch("/{user_id}/deactivate", response_model=DeactivateUserResponse)
async def deactivate_user(
    user_id: UUID,
    current_user: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> DeactivateUserResponse:
    # Verificar que el usuario existe
    result = await db.execute(
        text("SELECT id FROM public.users WHERE id = :id"),
        {"id": user_id},
    )
    if result.mappings().first() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado"
        )

    # Bloquear login en Supabase Auth primero (si falla, no se toca la BD)
    try:
        get_supabase_admin().auth.admin.update_user_by_id(
            str(user_id), {"ban_duration": "876600h"}
        )
    except AuthApiError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    # Marcar usuario como inactivo
    await db.execute(
        text("UPDATE public.users SET is_active = false WHERE id = :id"),
        {"id": user_id},
    )

    # Obtener proyectos afectados (antes de desactivar asignaciones)
    dirs = await db.execute(
        text(
            "SELECT DISTINCT project_id FROM public.project_directors"
            " WHERE docente_id = :id AND is_active = true"
        ),
        {"id": user_id},
    )
    jurors = await db.execute(
        text(
            "SELECT DISTINCT project_id FROM public.project_jurors"
            " WHERE docente_id = :id AND is_active = true"
        ),
        {"id": user_id},
    )
    affected_project_ids = list(
        {
            *(r["project_id"] for r in dirs.mappings()),
            *(r["project_id"] for r in jurors.mappings()),
        }
    )

    # Desactivar asignaciones activas
    await db.execute(
        text(
            "UPDATE public.project_directors"
            " SET is_active = false WHERE docente_id = :id AND is_active = true"
        ),
        {"id": user_id},
    )
    await db.execute(
        text(
            "UPDATE public.project_jurors"
            " SET is_active = false WHERE docente_id = :id AND is_active = true"
        ),
        {"id": user_id},
    )

    # Crear mensaje de alerta por cada proyecto afectado
    for project_id in affected_project_ids:
        await send_system_message(
            db, project_id, current_user.id, current_user.id,
            (
                "Un docente asignado a este trabajo ha sido desactivado. "
                "Se requiere reasignación de director o jurado."
            ),
        )

    await db.commit()

    return DeactivateUserResponse(
        user_id=user_id, affected_project_ids=affected_project_ids
    )
