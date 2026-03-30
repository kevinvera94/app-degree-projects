"""
Router de calificaciones de jurados.

Rutas implementadas (T-F05-03):
  POST /projects/{id}/evaluations              — registrar calificación (Docente/Jurado)
  GET  /projects/{id}/evaluations              — listar calificaciones (respuesta diferenciada por rol)
  GET  /projects/{id}/evaluations/{evalId}     — detalle de calificación (Admin, Docente)

Lógica de resultado (T-F05-04): evaluate_anteproyecto_result se invoca
automáticamente desde POST /evaluations al registrar la segunda calificación.
"""

from datetime import datetime, timezone
from typing import Optional, Union
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import CurrentUser, get_current_user, require_docente
from app.services.evaluation_service import evaluate_anteproyecto_result
from app.schemas.evaluation import (
    EvaluationAdminResponse,
    EvaluationCreate,
    EvaluationDirectorResponse,
    EvaluationStudentResponse,
)

router = APIRouter(prefix="/projects", tags=["evaluations"])

_SELECT_EVAL = (
    "e.id, e.project_id, e.submission_id, e.juror_id, e.juror_number, e.stage,"
    " e.score, e.observations, e.submitted_at, e.start_date, e.due_date,"
    " e.is_extemporaneous, e.revision_number"
)


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
    else:  # docente
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


async def _is_project_director(
    project_id: UUID, user_id: UUID, db: AsyncSession
) -> bool:
    """Retorna True si el docente es director activo del proyecto."""
    result = await db.execute(
        text(
            "SELECT id FROM public.project_directors"
            " WHERE project_id = :pid AND docente_id = :uid AND is_active = true"
        ),
        {"pid": project_id, "uid": user_id},
    )
    return result.mappings().first() is not None


def _build_student_response(row: dict) -> EvaluationStudentResponse:
    return EvaluationStudentResponse(
        id=row["id"],
        juror_number=row["juror_number"],
        stage=row["stage"],
        revision_number=row["revision_number"],
        score=row["score"],
        observations=row["observations"],
        submitted_at=row["submitted_at"],
    )


def _build_director_response(row: dict, juror_name: str) -> EvaluationDirectorResponse:
    return EvaluationDirectorResponse(
        id=row["id"],
        juror_id=row["juror_id"],
        juror_name=juror_name,
        juror_number=row["juror_number"],
        stage=row["stage"],
        revision_number=row["revision_number"],
        score=row["score"],
        observations=row["observations"],
        submitted_at=row["submitted_at"],
    )


def _build_admin_response(row: dict, juror_name: str) -> EvaluationAdminResponse:
    return EvaluationAdminResponse(
        id=row["id"],
        juror_id=row["juror_id"],
        juror_name=juror_name,
        juror_number=row["juror_number"],
        stage=row["stage"],
        revision_number=row["revision_number"],
        score=row["score"],
        observations=row["observations"],
        submitted_at=row["submitted_at"],
        due_date=row["due_date"],
        is_extemporaneous=row["is_extemporaneous"],
    )


# ---------------------------------------------------------------------------
# POST /projects/{id}/evaluations — Registrar calificación (T-F05-03)
# ---------------------------------------------------------------------------


@router.post(
    "/{project_id}/evaluations",
    response_model=EvaluationAdminResponse,
    status_code=status.HTTP_201_CREATED,
)
async def submit_evaluation(
    project_id: UUID,
    body: EvaluationCreate,
    current_user: CurrentUser = Depends(require_docente),
    db: AsyncSession = Depends(get_db),
) -> EvaluationAdminResponse:
    """
    El jurado registra su calificación.
    - Solo el docente asignado como jurado en esta etapa puede calificar.
    - Marca automáticamente como extemporánea si submitted_at > due_date.
    - Llama a evaluate_anteproyecto_result (T-F05-04) antes del commit para que
      la transición de estado quede en la misma transacción.
    """
    # Verificar que el docente es jurado activo asignado para esta etapa
    juror_result = await db.execute(
        text(
            "SELECT pj.id, pj.juror_number, pj.stage"
            " FROM public.project_jurors pj"
            " WHERE pj.project_id = :pid AND pj.docente_id = :uid"
            " AND pj.stage = :stage AND pj.is_active = true"
            " LIMIT 1"
        ),
        {"pid": project_id, "uid": current_user.id, "stage": body.stage},
    )
    juror = juror_result.mappings().first()
    if juror is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No estás asignado como jurado para esta etapa del proyecto",
        )

    # Buscar el registro de evaluations pendiente (score IS NULL) para este jurado/etapa
    eval_result = await db.execute(
        text(
            f"SELECT {_SELECT_EVAL}"
            " FROM public.evaluations e"
            " WHERE e.project_id = :pid AND e.juror_id = :uid"
            " AND e.stage = :stage AND e.score IS NULL"
            " ORDER BY e.revision_number DESC LIMIT 1"
        ),
        {"pid": project_id, "uid": current_user.id, "stage": body.stage},
    )
    eval_row = eval_result.mappings().first()
    if eval_row is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya registraste tu calificación para esta etapa y revisión",
        )

    now = datetime.now(timezone.utc)
    is_extemporaneous: bool = now > eval_row["due_date"].replace(tzinfo=timezone.utc) if eval_row["due_date"].tzinfo is None else now > eval_row["due_date"]

    # Actualizar el registro de evaluations
    updated = await db.execute(
        text(
            f"UPDATE public.evaluations"
            f" SET score = :score, observations = :obs,"
            f"     submitted_at = :submitted_at, is_extemporaneous = :is_ext"
            f" WHERE id = :eid"
            f" RETURNING {_SELECT_EVAL}"
        ),
        {
            "score": round(body.score, 1),
            "obs": body.observations,
            "submitted_at": now,
            "is_ext": is_extemporaneous,
            "eid": eval_row["id"],
        },
    )
    updated_row = dict(updated.mappings().first())

    # Disparar lógica de resultado (T-F05-04) — dentro de la misma transacción
    if body.stage == "anteproyecto":
        await evaluate_anteproyecto_result(
            project_id=project_id,
            db=db,
            triggered_by=current_user.id,
            revision_number=updated_row["revision_number"],
        )

    await db.commit()

    # Enriquecer con nombre del jurado
    name_result = await db.execute(
        text("SELECT full_name FROM public.users WHERE id = :id"),
        {"id": current_user.id},
    )
    juror_name = name_result.scalar_one()

    return _build_admin_response(updated_row, juror_name)


# ---------------------------------------------------------------------------
# GET /projects/{id}/evaluations — Listar calificaciones (T-F05-03)
# ---------------------------------------------------------------------------


@router.get(
    "/{project_id}/evaluations",
    response_model=list[
        Union[EvaluationAdminResponse, EvaluationDirectorResponse, EvaluationStudentResponse]
    ],
)
async def list_evaluations(
    project_id: UUID,
    stage: Optional[str] = None,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list:
    """
    Lista calificaciones con visibilidad diferenciada por rol:
    - Estudiante: sin identidad del jurado.
    - Administrador: visibilidad completa (incluye is_extemporaneous).
    - Docente Director: ve identidad del jurado.
    - Docente Jurado-solo: sin identidad (igual que estudiante).
    """
    await _check_membership(project_id, current_user, db)

    params: dict = {"pid": project_id}
    stage_filter = ""
    if stage:
        stage_filter = " AND e.stage = :stage"
        params["stage"] = stage

    rows_result = await db.execute(
        text(
            f"SELECT {_SELECT_EVAL}, u.full_name AS juror_name"
            " FROM public.evaluations e"
            " JOIN public.users u ON u.id = e.juror_id"
            f" WHERE e.project_id = :pid{stage_filter}"
            " ORDER BY e.stage, e.revision_number, e.juror_number"
        ),
        params,
    )
    rows = [dict(r) for r in rows_result.mappings()]

    if current_user.role == "administrador":
        return [_build_admin_response(r, r["juror_name"]) for r in rows]

    if current_user.role == "estudiante":
        return [_build_student_response(r) for r in rows]

    # Docente: verificar si es director de este proyecto
    is_director = await _is_project_director(project_id, current_user.id, db)
    if is_director:
        return [_build_director_response(r, r["juror_name"]) for r in rows]

    # Docente jurado (no director): anonimato igual que estudiante
    return [_build_student_response(r) for r in rows]


# ---------------------------------------------------------------------------
# GET /projects/{id}/evaluations/{eval_id} — Detalle (T-F05-03)
# ---------------------------------------------------------------------------


@router.get(
    "/{project_id}/evaluations/{eval_id}",
    response_model=Union[EvaluationAdminResponse, EvaluationDirectorResponse],
)
async def get_evaluation(
    project_id: UUID,
    eval_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Union[EvaluationAdminResponse, EvaluationDirectorResponse]:
    """Detalle de una calificación. Solo Admin y Docente (con pertenencia)."""
    if current_user.role == "estudiante":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Los estudiantes no pueden consultar el detalle de calificaciones individuales",
        )

    await _check_membership(project_id, current_user, db)

    result = await db.execute(
        text(
            f"SELECT {_SELECT_EVAL}, u.full_name AS juror_name"
            " FROM public.evaluations e"
            " JOIN public.users u ON u.id = e.juror_id"
            " WHERE e.id = :eid AND e.project_id = :pid"
        ),
        {"eid": eval_id, "pid": project_id},
    )
    row = result.mappings().first()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Calificación no encontrada",
        )

    row = dict(row)
    if current_user.role == "administrador":
        return _build_admin_response(row, row["juror_name"])

    return _build_director_response(row, row["juror_name"])
