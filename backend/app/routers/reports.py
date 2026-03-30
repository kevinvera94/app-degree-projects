"""
Router de reportes para el Administrador.

Rutas implementadas:
  GET /reports/projects/pending-review      — proyectos pendientes de evaluación (T-F06-10)
  GET /reports/projects/pending-corrections — proyectos con correcciones sin respuesta (T-F06-11)
"""

from datetime import date, datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import CurrentUser, require_admin
from app.utils.business_days import add_business_days, count_business_days_between

router = APIRouter(prefix="/reports", tags=["reports"])

_CORRECTION_DEADLINE_DAYS = 10


# ---------------------------------------------------------------------------
# Schemas de respuesta
# ---------------------------------------------------------------------------


class PendingReviewItem(BaseModel):
    project_id: UUID
    title: str
    status: str
    period: str
    days_elapsed: int


class PendingCorrectionItem(BaseModel):
    project_id: UUID
    title: str
    status: str
    deadline_date: date
    days_remaining: int


# ---------------------------------------------------------------------------
# GET /reports/projects/pending-review (T-F06-10)
# ---------------------------------------------------------------------------


@router.get(
    "/projects/pending-review",
    response_model=List[PendingReviewItem],
)
async def get_pending_review(
    current_user: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> List[PendingReviewItem]:
    """
    Lista proyectos que requieren acción del Administrador en el flujo de evaluación:
    - anteproyecto_pendiente_evaluacion: el admin debe asignar jurados.
    - producto_final_entregado: el admin debe asignar jurados.
    - en_revision_jurados_producto_final: jurados asignados pero evaluación incompleta.

    Cada ítem incluye el número de días calendario transcurridos desde que el
    proyecto entró en el estado actual.
    """
    result = await db.execute(
        text(
            """
            SELECT
                p.id         AS project_id,
                p.title,
                p.status,
                p.period,
                COALESCE(
                    EXTRACT(
                        DAY FROM NOW() - (
                            SELECT h.changed_at
                            FROM public.project_status_history h
                            WHERE h.project_id = p.id
                              AND h.new_status = p.status
                            ORDER BY h.changed_at DESC
                            LIMIT 1
                        )
                    )::integer,
                    0
                ) AS days_elapsed
            FROM public.thesis_projects p
            WHERE p.status IN (
                'anteproyecto_pendiente_evaluacion',
                'producto_final_entregado',
                'en_revision_jurados_producto_final'
            )
            ORDER BY days_elapsed DESC
            """
        )
    )
    rows = list(result.mappings())
    return [PendingReviewItem(**row) for row in rows]


# ---------------------------------------------------------------------------
# GET /reports/projects/pending-corrections (T-F06-11)
# ---------------------------------------------------------------------------


@router.get(
    "/projects/pending-corrections",
    response_model=List[PendingCorrectionItem],
)
async def get_pending_corrections(
    current_user: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> List[PendingCorrectionItem]:
    """
    Lista proyectos con correcciones solicitadas donde el estudiante aún no ha respondido.
    Incluye días hábiles restantes (negativo si el plazo ya venció).
    """
    today = date.today()

    result = await db.execute(
        text(
            """
            SELECT
                p.id     AS project_id,
                p.title,
                p.status,
                p.period,
                (
                    SELECT h.changed_at
                    FROM public.project_status_history h
                    WHERE h.project_id = p.id
                      AND h.new_status = p.status
                    ORDER BY h.changed_at DESC
                    LIMIT 1
                ) AS correction_requested_at
            FROM public.thesis_projects p
            WHERE p.status IN (
                'correcciones_anteproyecto_solicitadas',
                'correcciones_producto_final_solicitadas'
            )
            ORDER BY correction_requested_at ASC
            """
        )
    )
    rows = list(result.mappings())

    items: List[PendingCorrectionItem] = []
    for row in rows:
        requested_at = row["correction_requested_at"]
        if requested_at is None:
            continue

        requested_date = requested_at.date() if hasattr(requested_at, "date") else requested_at
        deadline = add_business_days(requested_date, _CORRECTION_DEADLINE_DAYS, row["period"])

        if today <= deadline:
            days_remaining = count_business_days_between(today, deadline, row["period"])
        else:
            days_remaining = -count_business_days_between(deadline, today, row["period"])

        items.append(
            PendingCorrectionItem(
                project_id=row["project_id"],
                title=row["title"],
                status=row["status"],
                deadline_date=deadline,
                days_remaining=days_remaining,
            )
        )

    return items


# ---------------------------------------------------------------------------
# GET /reports/jurors/late — Calificaciones extemporáneas (T-F07-08)
# ---------------------------------------------------------------------------


class LateEvaluationItem(BaseModel):
    docente_name: str
    project_title: str
    stage: str
    deadline_date: date
    submitted_at: datetime
    days_late: int


@router.get(
    "/jurors/late",
    response_model=List[LateEvaluationItem],
)
async def get_late_jurors(
    current_user: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> List[LateEvaluationItem]:
    """
    Lista evaluaciones registradas fuera del plazo (is_extemporaneous = true).
    Calcula los días de retraso a partir de due_date y submitted_at.
    """
    result = await db.execute(
        text(
            """
            SELECT
                u.full_name    AS docente_name,
                p.title        AS project_title,
                e.stage,
                e.due_date     AS deadline_date,
                e.submitted_at,
                GREATEST(
                    EXTRACT(DAY FROM e.submitted_at - e.due_date)::integer,
                    0
                ) AS days_late
            FROM public.evaluations e
            JOIN public.users u ON u.id = e.juror_id
            JOIN public.thesis_projects p ON p.id = e.project_id
            WHERE e.is_extemporaneous = true
              AND e.submitted_at IS NOT NULL
            ORDER BY e.submitted_at DESC
            """
        )
    )
    rows = list(result.mappings())
    return [LateEvaluationItem(**row) for row in rows]


# ---------------------------------------------------------------------------
# GET /reports/jurors/expiring — Plazo próximo a vencer (T-F07-09)
# ---------------------------------------------------------------------------


class ExpiringEvaluationItem(BaseModel):
    docente_name: str
    project_title: str
    stage: str
    deadline_date: date
    business_days_remaining: int


_DEFAULT_EXPIRING_DAYS = 3  # días hábiles por defecto (RF-01-07 configurable)


@router.get(
    "/jurors/expiring",
    response_model=List[ExpiringEvaluationItem],
)
async def get_expiring_jurors(
    days: int = _DEFAULT_EXPIRING_DAYS,
    current_user: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> List[ExpiringEvaluationItem]:
    """
    Lista evaluaciones sin calificar cuyo due_date vence en los próximos N días hábiles.
    N se pasa como query param `days` (default: 3).
    """
    today = date.today()

    result = await db.execute(
        text(
            """
            SELECT
                u.full_name    AS docente_name,
                p.title        AS project_title,
                e.stage,
                e.due_date     AS deadline_date,
                p.period
            FROM public.evaluations e
            JOIN public.users u ON u.id = e.juror_id
            JOIN public.thesis_projects p ON p.id = e.project_id
            WHERE e.score IS NULL
              AND e.due_date IS NOT NULL
              AND e.due_date >= :today
            ORDER BY e.due_date ASC
            """
        ),
        {"today": today},
    )
    rows = list(result.mappings())

    items: List[ExpiringEvaluationItem] = []
    for row in rows:
        deadline = row["deadline_date"]
        if isinstance(deadline, datetime):
            deadline = deadline.date()

        remaining = count_business_days_between(today, deadline, row["period"])
        if remaining <= days:
            items.append(
                ExpiringEvaluationItem(
                    docente_name=row["docente_name"],
                    project_title=row["project_title"],
                    stage=row["stage"],
                    deadline_date=deadline,
                    business_days_remaining=remaining,
                )
            )

    return items
