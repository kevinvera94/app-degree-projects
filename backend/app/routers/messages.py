"""
Router de mensajería asíncrona.

Rutas implementadas:
  GET   /projects/{id}/messages              — bandeja de mensajes (T-F08-01)
  POST  /projects/{id}/messages              — enviar mensaje (T-F08-01)
  PATCH /projects/{id}/messages/{msgId}/read — marcar como leído (T-F08-02)
"""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import CurrentUser, get_current_user

router = APIRouter(prefix="/projects", tags=["messages"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class MessageResponse(BaseModel):
    id: UUID
    sender_display: str
    content: str
    is_read: bool
    sent_at: datetime


class MessageCreate(BaseModel):
    content: str
    recipient_id: Optional[UUID] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _check_membership_and_get_role(
    project_id: UUID, user: CurrentUser, db: AsyncSession
) -> dict:
    """
    Verifica pertenencia activa y devuelve el rol del usuario en el proyecto.

    Returns dict con:
      project_role: "administrador" | "director" | "jurado" | "estudiante"
      juror_number: int | None  (solo relevante si project_role == "jurado")
    """
    if user.role == "administrador":
        return {"project_role": "administrador", "juror_number": None}

    if user.role == "estudiante":
        result = await db.execute(
            text(
                "SELECT id FROM public.project_members"
                " WHERE project_id = :pid AND student_id = :uid AND is_active = true"
            ),
            {"pid": project_id, "uid": user.id},
        )
        if result.mappings().first() is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes acceso a este trabajo de grado",
            )
        return {"project_role": "estudiante", "juror_number": None}

    # docente: puede ser director, jurado, o ambos en el mismo proyecto
    dir_result = await db.execute(
        text(
            "SELECT id FROM public.project_directors"
            " WHERE project_id = :pid AND docente_id = :uid AND is_active = true"
        ),
        {"pid": project_id, "uid": user.id},
    )
    is_director = dir_result.mappings().first() is not None

    jur_result = await db.execute(
        text(
            "SELECT juror_number FROM public.project_jurors"
            " WHERE project_id = :pid AND docente_id = :uid AND is_active = true"
            " ORDER BY juror_number LIMIT 1"
        ),
        {"pid": project_id, "uid": user.id},
    )
    juror_row = jur_result.mappings().first()
    is_juror = juror_row is not None

    if not is_director and not is_juror:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes acceso a este trabajo de grado",
        )

    # Si el docente es Director y Jurado a la vez, el rol Director tiene precedencia
    if is_director:
        return {"project_role": "director", "juror_number": None}
    return {"project_role": "jurado", "juror_number": juror_row["juror_number"]}


async def _get_recipient_project_role(
    project_id: UUID, recipient_id: UUID, db: AsyncSession
) -> str:
    """
    Devuelve el rol del receptor en el proyecto.
    Lanza 400 si el receptor no existe o no pertenece al proyecto.
    """
    result = await db.execute(
        text("SELECT role FROM public.users WHERE id = :uid AND is_active = true"),
        {"uid": recipient_id},
    )
    row = result.mappings().first()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Receptor no encontrado",
        )

    recipient_role = row["role"]

    if recipient_role == "administrador":
        return "administrador"

    if recipient_role == "estudiante":
        mem = await db.execute(
            text(
                "SELECT id FROM public.project_members"
                " WHERE project_id = :pid AND student_id = :uid AND is_active = true"
            ),
            {"pid": project_id, "uid": recipient_id},
        )
        if mem.mappings().first() is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El receptor no pertenece a este proyecto",
            )
        return "estudiante"

    # docente: director > jurado
    dir_r = await db.execute(
        text(
            "SELECT id FROM public.project_directors"
            " WHERE project_id = :pid AND docente_id = :uid AND is_active = true"
        ),
        {"pid": project_id, "uid": recipient_id},
    )
    if dir_r.mappings().first() is not None:
        return "director"

    jur_r = await db.execute(
        text(
            "SELECT id FROM public.project_jurors"
            " WHERE project_id = :pid AND docente_id = :uid AND is_active = true"
        ),
        {"pid": project_id, "uid": recipient_id},
    )
    if jur_r.mappings().first() is not None:
        return "jurado"

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="El receptor no pertenece a este proyecto",
    )


_ALLOWED_TARGETS: dict = {
    # rol_emisor → set de roles permitidos de receptor
    "administrador": {"administrador", "director", "jurado", "estudiante"},
    "director": {"estudiante", "administrador"},
    "jurado": {"estudiante"},
    "estudiante": {"director", "jurado"},
}


# ---------------------------------------------------------------------------
# GET /projects/{id}/messages — Bandeja de mensajes (T-F08-01)
# ---------------------------------------------------------------------------


@router.get(
    "/{project_id}/messages",
    response_model=List[MessageResponse],
)
async def list_messages(
    project_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[MessageResponse]:
    """
    Retorna todos los mensajes del trabajo de grado, ordenados por sent_at DESC.
    Requiere pertenencia activa (Admin, Director, Jurado o Estudiante del proyecto).
    El campo sender_display ya incorpora el anonimato del jurado desde el momento
    en que se guardó el mensaje.
    """
    await _check_membership_and_get_role(project_id, current_user, db)

    result = await db.execute(
        text(
            """
            SELECT id, sender_display, content, is_read, sent_at
            FROM public.messages
            WHERE project_id = :pid
            ORDER BY sent_at DESC
            """
        ),
        {"pid": project_id},
    )
    rows = list(result.mappings())
    return [MessageResponse(**row) for row in rows]


# ---------------------------------------------------------------------------
# POST /projects/{id}/messages — Enviar mensaje (T-F08-01)
# ---------------------------------------------------------------------------


@router.post(
    "/{project_id}/messages",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
)
async def send_message(
    project_id: UUID,
    body: MessageCreate,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """
    Envía un mensaje a un actor del trabajo o a todos (solo Administrador puede
    omitir recipient_id para broadcast).

    Reglas de mensajería (RF-15-02..RF-15-07):
      Estudiante  → Director o Jurado
      Director    → Estudiante o Administrador
      Jurado      → Estudiante
      Admin       → cualquiera (broadcast si recipient_id es null)

    El anonimato del jurado se aplica en sender_display: si el emisor es Jurado,
    el campo se establece como "Jurado N" independientemente del receptor.
    """
    # 1. Verificar pertenencia del emisor y obtener su rol en el proyecto
    sender_info = await _check_membership_and_get_role(project_id, current_user, db)
    sender_role = sender_info["project_role"]

    # 2. Broadcast solo permitido para Administrador
    if body.recipient_id is None and sender_role != "administrador":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el Administrador puede enviar mensajes a todos los actores del proyecto",
        )

    # 3. Validar rol del receptor (si se especifica)
    if body.recipient_id is not None:
        recipient_role = await _get_recipient_project_role(
            project_id, body.recipient_id, db
        )
        allowed = _ALLOWED_TARGETS.get(sender_role, set())
        if recipient_role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Un {sender_role} no puede enviar mensajes a un {recipient_role}"
                ),
            )

    # 4. Determinar sender_display
    if sender_role == "jurado":
        # Anonimato: siempre se muestra "Jurado N"
        sender_display = f"Jurado {sender_info['juror_number']}"
    else:
        # Nombre real del emisor
        name_result = await db.execute(
            text("SELECT full_name FROM public.users WHERE id = :uid"),
            {"uid": current_user.id},
        )
        name_row = name_result.mappings().first()
        sender_display = name_row["full_name"] if name_row else "Sistema"

    # 5. Insertar mensaje
    insert_result = await db.execute(
        text(
            """
            INSERT INTO public.messages
                (project_id, sender_id, recipient_id, content, sender_display, is_read)
            VALUES
                (:pid, :sid, :rid, :content, :display, false)
            RETURNING id, sender_display, content, is_read, sent_at
            """
        ),
        {
            "pid": project_id,
            "sid": current_user.id,
            "rid": body.recipient_id,
            "content": body.content,
            "display": sender_display,
        },
    )
    await db.commit()

    row = insert_result.mappings().first()
    return MessageResponse(**row)


# ---------------------------------------------------------------------------
# PATCH /projects/{id}/messages/{msg_id}/read — Marcar como leído (T-F08-02)
# ---------------------------------------------------------------------------


@router.patch(
    "/{project_id}/messages/{msg_id}/read",
    response_model=MessageResponse,
)
async def mark_message_read(
    project_id: UUID,
    msg_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """
    Marca un mensaje como leído. Solo el receptor puede hacerlo.
    Si el mensaje ya está leído, responde 200 (idempotente).
    """
    # 1. Verificar pertenencia al proyecto
    await _check_membership_and_get_role(project_id, current_user, db)

    # 2. Cargar el mensaje
    result = await db.execute(
        text(
            "SELECT id, project_id, recipient_id, sender_display, content, is_read, sent_at"
            " FROM public.messages"
            " WHERE id = :mid AND project_id = :pid"
        ),
        {"mid": msg_id, "pid": project_id},
    )
    row = result.mappings().first()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mensaje no encontrado",
        )

    # 3. Solo el receptor puede marcarlo como leído
    # recipient_id = null significa broadcast; en ese caso todos son receptores implícitos
    if row["recipient_id"] is not None and row["recipient_id"] != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el receptor del mensaje puede marcarlo como leído",
        )

    # 4. Idempotente: si ya está leído, devolver sin tocar BD
    if row["is_read"]:
        return MessageResponse(
            id=row["id"],
            sender_display=row["sender_display"],
            content=row["content"],
            is_read=row["is_read"],
            sent_at=row["sent_at"],
        )

    # 5. Actualizar
    update_result = await db.execute(
        text(
            "UPDATE public.messages"
            " SET is_read = true, read_at = NOW()"
            " WHERE id = :mid"
            " RETURNING id, sender_display, content, is_read, sent_at"
        ),
        {"mid": msg_id},
    )
    await db.commit()

    updated = update_result.mappings().first()
    return MessageResponse(**updated)
