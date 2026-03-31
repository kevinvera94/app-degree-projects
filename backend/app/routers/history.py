"""
Router de historial de trazabilidad de proyectos.

Rutas implementadas:
  GET /projects/{id}/history — historial cronológico de eventos (T-F08-04)

Tipos de evento:
  - status_change:       cambios de estado del proyecto (project_status_history)
  - document_uploaded:   documentos adjuntos a radicaciones (attachments → submissions)
  - evaluation_submitted: calificaciones de jurados (evaluations)
"""

from datetime import datetime
from typing import List, Literal, Optional, Union
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import CurrentUser, get_current_user

router = APIRouter(prefix="/projects", tags=["history"])


# ---------------------------------------------------------------------------
# Schemas de eventos
# ---------------------------------------------------------------------------


class StatusChangeEvent(BaseModel):
    type: Literal["status_change"]
    previous_status: Optional[str]
    new_status: str
    changed_by_name: str
    reason: Optional[str]
    changed_at: datetime


class DocumentUploadedEvent(BaseModel):
    type: Literal["document_uploaded"]
    attachment_type: str
    file_name: str
    stage: str
    uploaded_by_name: str
    uploaded_at: datetime


class EvaluationSubmittedEvent(BaseModel):
    type: Literal["evaluation_submitted"]
    juror_number: int
    score: float
    stage: str
    submitted_at: datetime
    is_extemporaneous: bool
    juror_name: Optional[str] = None  # Oculto para Estudiante


HistoryEvent = Union[StatusChangeEvent, DocumentUploadedEvent, EvaluationSubmittedEvent]


# ---------------------------------------------------------------------------
# Helper: verificar pertenencia y retornar rol en el proyecto
# ---------------------------------------------------------------------------


async def _check_membership(
    project_id: UUID, user: CurrentUser, db: AsyncSession
) -> str:
    """
    Verifica que el usuario tiene acceso al proyecto y retorna su rol:
      "administrador" | "director" | "jurado" | "estudiante"

    Reglas:
      - Administrador: acceso a cualquier proyecto
      - Estudiante: solo sus propios proyectos (vía project_members)
      - Docente: solo proyectos donde tiene función (director o jurado)
    """
    if user.role == "administrador":
        # Verificar que el proyecto existe
        result = await db.execute(
            text("SELECT id FROM public.thesis_projects WHERE id = :pid"),
            {"pid": project_id},
        )
        if result.mappings().first() is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Trabajo de grado no encontrado",
            )
        return "administrador"

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
        return "estudiante"

    # Docente: director tiene precedencia sobre jurado
    dir_result = await db.execute(
        text(
            "SELECT id FROM public.project_directors"
            " WHERE project_id = :pid AND docente_id = :uid AND is_active = true"
        ),
        {"pid": project_id, "uid": user.id},
    )
    if dir_result.mappings().first() is not None:
        return "director"

    jur_result = await db.execute(
        text(
            "SELECT id FROM public.project_jurors"
            " WHERE project_id = :pid AND docente_id = :uid AND is_active = true"
        ),
        {"pid": project_id, "uid": user.id},
    )
    if jur_result.mappings().first() is not None:
        return "jurado"

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="No tienes acceso a este trabajo de grado",
    )


# ---------------------------------------------------------------------------
# GET /projects/{id}/history — Historial de trazabilidad (T-F08-04)
# ---------------------------------------------------------------------------


@router.get(
    "/{project_id}/history",
    response_model=List[HistoryEvent],
)
async def get_project_history(
    project_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[HistoryEvent]:
    """
    Retorna el historial cronológico (ASC) de todos los eventos del proyecto:
      1. Cambios de estado (project_status_history)
      2. Documentos adjuntos (attachments → submissions)
      3. Calificaciones de jurados (evaluations)

    Control de acceso:
      - Administrador: historial completo de cualquier trabajo
      - Estudiante: historial de su propio trabajo (sin identidad de jurados)
      - Docente: historial de trabajos donde tiene función asignada

    Los jurados son anónimos para el Estudiante en eventos de calificación.
    """
    project_role = await _check_membership(project_id, current_user, db)
    events: List[HistoryEvent] = []

    # ------------------------------------------------------------------
    # 1. Cambios de estado
    # ------------------------------------------------------------------
    status_rows = await db.execute(
        text(
            """
            SELECT
                psh.previous_status,
                psh.new_status,
                u.full_name  AS changed_by_name,
                psh.notes    AS reason,
                psh.changed_at
            FROM public.project_status_history psh
            JOIN public.users u ON u.id = psh.changed_by
            WHERE psh.project_id = :pid
            ORDER BY psh.changed_at ASC
            """
        ),
        {"pid": project_id},
    )
    for row in status_rows.mappings():
        events.append(
            StatusChangeEvent(
                type="status_change",
                previous_status=row["previous_status"],
                new_status=row["new_status"],
                changed_by_name=row["changed_by_name"],
                reason=row["reason"],
                changed_at=row["changed_at"],
            )
        )

    # ------------------------------------------------------------------
    # 2. Documentos adjuntos (a través de radicaciones)
    # ------------------------------------------------------------------
    attachment_rows = await db.execute(
        text(
            """
            SELECT
                a.attachment_type,
                a.file_name,
                s.stage,
                u.full_name  AS uploaded_by_name,
                a.uploaded_at
            FROM public.attachments a
            JOIN public.submissions s ON s.id = a.submission_id
            JOIN public.users u ON u.id = a.uploaded_by
            WHERE s.project_id = :pid
            ORDER BY a.uploaded_at ASC
            """
        ),
        {"pid": project_id},
    )
    for row in attachment_rows.mappings():
        events.append(
            DocumentUploadedEvent(
                type="document_uploaded",
                attachment_type=row["attachment_type"],
                file_name=row["file_name"],
                stage=row["stage"],
                uploaded_by_name=row["uploaded_by_name"],
                uploaded_at=row["uploaded_at"],
            )
        )

    # ------------------------------------------------------------------
    # 3. Calificaciones de jurados
    #    juror_name se incluye solo para Administrador y Director;
    #    el Estudiante y el propio Jurado no ven la identidad del evaluador.
    # ------------------------------------------------------------------
    show_juror_identity = project_role in ("administrador", "director")

    if show_juror_identity:
        eval_rows = await db.execute(
            text(
                """
                SELECT
                    e.juror_number,
                    e.score,
                    e.stage,
                    e.submitted_at,
                    e.is_extemporaneous,
                    u.full_name AS juror_name
                FROM public.evaluations e
                JOIN public.users u ON u.id = e.juror_id
                WHERE e.project_id = :pid
                ORDER BY e.submitted_at ASC
                """
            ),
            {"pid": project_id},
        )
    else:
        eval_rows = await db.execute(
            text(
                """
                SELECT
                    juror_number,
                    score,
                    stage,
                    submitted_at,
                    is_extemporaneous
                FROM public.evaluations
                WHERE project_id = :pid
                ORDER BY submitted_at ASC
                """
            ),
            {"pid": project_id},
        )

    for row in eval_rows.mappings():
        events.append(
            EvaluationSubmittedEvent(
                type="evaluation_submitted",
                juror_number=row["juror_number"],
                score=float(row["score"]),
                stage=row["stage"],
                submitted_at=row["submitted_at"],
                is_extemporaneous=row["is_extemporaneous"],
                juror_name=row.get("juror_name"),
            )
        )

    # ------------------------------------------------------------------
    # Ordenar todos los eventos por fecha ASC
    # ------------------------------------------------------------------
    def _event_date(evt: HistoryEvent) -> datetime:
        if isinstance(evt, StatusChangeEvent):
            return evt.changed_at
        if isinstance(evt, DocumentUploadedEvent):
            return evt.uploaded_at
        return evt.submitted_at  # EvaluationSubmittedEvent

    events.sort(key=_event_date)
    return events
