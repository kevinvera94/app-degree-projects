"""
Router de actas y autorización de biblioteca.

Rutas implementadas:
  PATCH /projects/{id}/library-authorization  — estudiante autoriza publicación (T-F07-04)
  POST  /projects/{id}/act                    — Admin emite el acta (T-F07-05)
  GET   /projects/{id}/act                    — detalle del acta con URL firmada (T-F07-05)
"""

import os
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import CurrentUser, get_current_user, require_admin, require_estudiante
from app.core.supabase_client import get_supabase_admin
from app.services.notifications import send_system_message

router = APIRouter(prefix="/projects", tags=["act"])

_SELECT_ACT = "id, project_id, issued_at, issued_by, library_authorization, act_file_url"
_MAX_FILE_BYTES = 20 * 1024 * 1024  # 20 MB


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class LibraryAuthorizationUpdate(BaseModel):
    library_authorization: bool


class ActResponse(BaseModel):
    id: UUID
    project_id: UUID
    issued_at: Optional[datetime]
    issued_by: Optional[UUID]
    library_authorization: Optional[bool]
    act_file_url: Optional[str]

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _check_membership(
    project_id: UUID, user: CurrentUser, db: AsyncSession
) -> None:
    if user.role == "administrador":
        return
    if user.role == "estudiante":
        result = await db.execute(
            text(
                "SELECT id FROM public.project_members"
                " WHERE project_id = :pid AND student_id = :uid AND is_active = true"
            ),
            {"pid": project_id, "uid": user.id},
        )
    else:
        result = await db.execute(
            text(
                "SELECT id FROM public.project_directors"
                " WHERE project_id = :pid AND docente_id = :uid AND is_active = true"
                " UNION"
                " SELECT id FROM public.project_jurors"
                " WHERE project_id = :pid AND docente_id = :uid AND is_active = true"
            ),
            {"pid": project_id, "uid": user.id},
        )
    if result.mappings().first() is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes acceso a este trabajo de grado",
        )


def _extract_storage_path(file_url: str) -> str:
    prefix = (
        f"{settings.supabase_url}/storage/v1/object/{settings.supabase_storage_bucket}/"
    )
    if file_url.startswith(prefix):
        return file_url[len(prefix):]
    return file_url


# ---------------------------------------------------------------------------
# PATCH /projects/{id}/library-authorization — T-F07-04
# ---------------------------------------------------------------------------


@router.patch(
    "/{project_id}/library-authorization",
    response_model=ActResponse,
)
async def set_library_authorization(
    project_id: UUID,
    body: LibraryAuthorizationUpdate,
    current_user: CurrentUser = Depends(require_estudiante),
    db: AsyncSession = Depends(get_db),
) -> ActResponse:
    """
    El estudiante autoriza (o revoca) la publicación en biblioteca.
    Solo disponible en estado trabajo_aprobado.
    Es idempotente: crea o actualiza el registro en acts.
    """
    # Validar pertenencia del estudiante
    membership = await db.execute(
        text(
            "SELECT id FROM public.project_members"
            " WHERE project_id = :pid AND student_id = :uid AND is_active = true"
        ),
        {"pid": project_id, "uid": current_user.id},
    )
    if membership.mappings().first() is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No eres integrante activo de este trabajo de grado",
        )

    # Verificar estado del proyecto
    proj_result = await db.execute(
        text("SELECT id, status, title FROM public.thesis_projects WHERE id = :id"),
        {"id": project_id},
    )
    project = proj_result.mappings().first()
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trabajo de grado no encontrado",
        )
    if project["status"] != "trabajo_aprobado":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "La autorización de biblioteca solo puede diligenciarse cuando el trabajo "
                f"está aprobado. Estado actual: {project['status']}"
            ),
        )

    # Upsert en acts (idempotente)
    existing = await db.execute(
        text(f"SELECT {_SELECT_ACT} FROM public.acts WHERE project_id = :pid"),
        {"pid": project_id},
    )
    existing_row = existing.mappings().first()

    if existing_row is None:
        act_result = await db.execute(
            text(
                f"INSERT INTO public.acts (project_id, library_authorization)"
                f" VALUES (:pid, :auth)"
                f" RETURNING {_SELECT_ACT}"
            ),
            {"pid": project_id, "auth": body.library_authorization},
        )
    else:
        act_result = await db.execute(
            text(
                f"UPDATE public.acts SET library_authorization = :auth"
                f" WHERE project_id = :pid"
                f" RETURNING {_SELECT_ACT}"
            ),
            {"auth": body.library_authorization, "pid": project_id},
        )
    act_row = dict(act_result.mappings().first())

    # Notificar al Administrador
    # Obtener nombre del estudiante
    student_result = await db.execute(
        text("SELECT full_name FROM public.users WHERE id = :id"),
        {"id": current_user.id},
    )
    student_name = student_result.scalar_one()

    await send_system_message(
        db, project_id, current_user.id, None,
        (
            f"El estudiante {student_name} ha diligenciado la autorización de biblioteca "
            f"para '{project['title']}'. Valor: {'Autorizado' if body.library_authorization else 'No autorizado'}."
        ),
    )

    await db.commit()
    return ActResponse(**act_row)


# ---------------------------------------------------------------------------
# POST /projects/{id}/act — Emitir acta (T-F07-05)
# ---------------------------------------------------------------------------


@router.post(
    "/{project_id}/act",
    response_model=ActResponse,
    status_code=status.HTTP_201_CREATED,
)
async def issue_act(
    project_id: UUID,
    file: Optional[UploadFile] = File(default=None),
    current_user: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> ActResponse:
    """
    El Administrador emite el acta de sustentación/aprobación.
    Requiere que el estudiante haya diligenciado la autorización de biblioteca.
    El archivo PDF es opcional.
    """
    # Verificar estado del proyecto
    proj_result = await db.execute(
        text("SELECT id, status, title FROM public.thesis_projects WHERE id = :id"),
        {"id": project_id},
    )
    project = proj_result.mappings().first()
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trabajo de grado no encontrado",
        )
    if project["status"] != "trabajo_aprobado":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Solo se puede emitir el acta cuando el trabajo está aprobado. "
                f"Estado actual: {project['status']}"
            ),
        )

    # Verificar que el estudiante haya diligenciado la autorización de biblioteca
    act_existing = await db.execute(
        text(
            f"SELECT {_SELECT_ACT} FROM public.acts WHERE project_id = :pid"
        ),
        {"pid": project_id},
    )
    act_row = act_existing.mappings().first()
    if act_row is None or act_row["library_authorization"] is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El estudiante aún no ha diligenciado la autorización de biblioteca",
        )

    # Subir archivo al Storage si se adjuntó
    act_file_url: Optional[str] = None
    if file is not None:
        content = await file.read()
        if len(content) > _MAX_FILE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El archivo supera el tamaño máximo permitido (20 MB)",
            )
        ext = os.path.splitext(file.filename or "act.pdf")[1] or ".pdf"
        storage_path = f"acts/{project_id}/acta{ext}"
        try:
            get_supabase_admin().storage.from_(settings.supabase_storage_bucket).upload(
                storage_path,
                content,
                {"content-type": file.content_type or "application/pdf", "upsert": "true"},
            )
            act_file_url = (
                f"{settings.supabase_url}/storage/v1/object/"
                f"{settings.supabase_storage_bucket}/{storage_path}"
            )
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Error al subir el archivo: {exc}",
            )

    now = datetime.now(timezone.utc)

    # Actualizar el registro de acts con issued_at, issued_by y act_file_url
    updated_act = await db.execute(
        text(
            f"UPDATE public.acts"
            f" SET issued_at = :now, issued_by = :by, act_file_url = :url"
            f" WHERE project_id = :pid"
            f" RETURNING {_SELECT_ACT}"
        ),
        {
            "now": now,
            "by": current_user.id,
            "url": act_file_url,
            "pid": project_id,
        },
    )
    updated_row = dict(updated_act.mappings().first())

    # Transición de estado → acta_generada
    await db.execute(
        text(
            "UPDATE public.thesis_projects"
            " SET status = 'acta_generada', updated_at = now() WHERE id = :pid"
        ),
        {"pid": project_id},
    )
    await db.execute(
        text(
            "INSERT INTO public.project_status_history"
            " (project_id, previous_status, new_status, changed_by, notes)"
            " VALUES (:pid, 'trabajo_aprobado', 'acta_generada', :by, :notes)"
        ),
        {
            "pid": project_id,
            "by": current_user.id,
            "notes": "Acta emitida por el Administrador.",
        },
    )
    # Notificar al estudiante
    await send_system_message(
        db, project_id, current_user.id, None,
        "Tu acta ha sido emitida. Puedes descargarla desde el sistema.",
    )

    await db.commit()
    return ActResponse(**updated_row)


# ---------------------------------------------------------------------------
# GET /projects/{id}/act — Detalle del acta (T-F07-05)
# ---------------------------------------------------------------------------


@router.get(
    "/{project_id}/act",
    response_model=ActResponse,
)
async def get_act(
    project_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ActResponse:
    """
    Retorna el detalle del acta. Si existe act_file_url, genera URL firmada (TTL 1h).
    """
    await _check_membership(project_id, current_user, db)

    act_result = await db.execute(
        text(f"SELECT {_SELECT_ACT} FROM public.acts WHERE project_id = :pid"),
        {"pid": project_id},
    )
    act_row = act_result.mappings().first()
    if act_row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No hay acta registrada para este proyecto",
        )

    act_data = dict(act_row)

    # Si tiene archivo, generar URL firmada
    if act_data.get("act_file_url"):
        storage_path = _extract_storage_path(act_data["act_file_url"])
        try:
            signed_response = get_supabase_admin().storage.from_(
                settings.supabase_storage_bucket
            ).create_signed_url(storage_path, 3600)
            signed_url: str = (
                getattr(signed_response, "signed_url", None)
                or signed_response.get("signedURL", "")
            )
            act_data["act_file_url"] = signed_url
        except Exception:
            pass  # Devolver sin URL firmada si falla

    return ActResponse(**act_data)
