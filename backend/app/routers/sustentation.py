"""
Router de sustentación pública.

Rutas implementadas:
  POST /projects/{id}/sustentation                  — programar sustentación (T-F07-01)
  GET  /projects/{id}/sustentation                  — detalle + calificaciones (T-F07-01)
  POST /projects/{id}/sustentation/evaluations      — calificación individual jurado (T-F07-02)
"""

from datetime import date as date_type, datetime, timezone
from typing import List, Optional, Union
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import CurrentUser, get_current_user, require_admin
from app.services.notifications import send_system_message

router = APIRouter(prefix="/projects", tags=["sustentation"])

_SELECT_SUT = (
    "id, project_id, scheduled_at, location, final_score, is_approved, "
    "registered_at, registered_by"
)
_SELECT_SE = (
    "id, sustentation_id, juror_id, juror_number, score, submitted_at, submitted_by"
)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class SustentationCreate(BaseModel):
    model_config = ConfigDict(json_schema_extra={"example": {
        "scheduled_date": "2026-04-25",
        "scheduled_time": "09:30",
        "location": "Sala de conferencias B, Edificio de Ingenierías",
    }})

    scheduled_date: date_type
    scheduled_time: str  # "HH:MM"
    location: str


class SustentationEvalCreate(BaseModel):
    model_config = ConfigDict(json_schema_extra={"example": {"score": 4.2}})

    score: float


class SustentationEvalStudentResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={"example": {
            "id": "b1c2d3e4-bcde-2345-6789-0abcdef12345",
            "sustentation_id": "c2d3e4f5-cdef-3456-789a-bcdef0123456",
            "juror_number": 1,
            "score": 4.2,
            "submitted_at": "2026-04-25T11:15:00Z",
        }},
    )

    id: UUID
    sustentation_id: UUID
    juror_number: int
    score: float
    submitted_at: datetime


class SustentationEvalAdminResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={"example": {
            "id": "b1c2d3e4-bcde-2345-6789-0abcdef12345",
            "sustentation_id": "c2d3e4f5-cdef-3456-789a-bcdef0123456",
            "juror_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
            "juror_number": 1,
            "score": 4.2,
            "submitted_at": "2026-04-25T11:15:00Z",
            "submitted_by": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        }},
    )

    id: UUID
    sustentation_id: UUID
    juror_id: UUID
    juror_number: int
    score: float
    submitted_at: datetime
    submitted_by: UUID


class SustentationResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={"example": {
            "id": "c2d3e4f5-cdef-3456-789a-bcdef0123456",
            "project_id": "f6a7b8c9-6789-abcd-f012-345678901234",
            "scheduled_at": "2026-04-25T09:30:00Z",
            "location": "Sala de conferencias B, Edificio de Ingenierías",
            "final_score": 4.1,
            "is_approved": True,
            "registered_at": "2026-04-10T09:00:00Z",
            "registered_by": "1a2b3c4d-1234-5678-9abc-def012345678",
            "evaluations": [],
        }},
    )

    id: UUID
    project_id: UUID
    scheduled_at: datetime
    location: str
    final_score: Optional[float]
    is_approved: Optional[bool]
    registered_at: datetime
    registered_by: UUID
    evaluations: List[Union[SustentationEvalAdminResponse, SustentationEvalStudentResponse]] = []


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


async def _get_project(project_id: UUID, db: AsyncSession) -> dict:
    result = await db.execute(
        text(
            "SELECT p.id, p.status, p.title, p.period,"
            " m.requires_sustentation"
            " FROM public.thesis_projects p"
            " JOIN public.modalities m ON m.id = p.modality_id"
            " WHERE p.id = :id"
        ),
        {"id": project_id},
    )
    row = result.mappings().first()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trabajo de grado no encontrado",
        )
    return dict(row)


# ---------------------------------------------------------------------------
# POST /projects/{id}/sustentation — Programar sustentación (T-F07-01)
# ---------------------------------------------------------------------------


@router.post(
    "/{project_id}/sustentation",
    response_model=SustentationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def schedule_sustentation(
    project_id: UUID,
    body: SustentationCreate,
    current_user: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> SustentationResponse:
    """
    El Administrador programa la sustentación pública.
    Valida estado aprobado_para_sustentacion y que no sea modalidad Diplomado.
    Transiciona a sustentacion_programada y notifica a todos los actores.
    """
    project = await _get_project(project_id, db)

    if project["status"] != "aprobado_para_sustentacion":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Solo se puede programar la sustentación cuando el proyecto está en "
                f"'aprobado_para_sustentacion'. Estado actual: {project['status']}"
            ),
        )

    # Diplomado tecnológico no pasa por sustentación (llega a trabajo_aprobado directamente)
    if not project["requires_sustentation"]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Los proyectos de modalidad Diplomado tecnológico no requieren sustentación",
        )

    # Construir timestamp combinando fecha + hora
    try:
        scheduled_at = datetime.strptime(
            f"{body.scheduled_date} {body.scheduled_time}", "%Y-%m-%d %H:%M"
        ).replace(tzinfo=timezone.utc)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato de hora inválido. Use HH:MM (ej. 09:30)",
        )

    # Verificar que no exista ya una sustentación registrada para este proyecto
    existing = await db.execute(
        text("SELECT id FROM public.sustentations WHERE project_id = :pid"),
        {"pid": project_id},
    )
    if existing.mappings().first() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe una sustentación registrada para este proyecto",
        )

    # Crear registro en sustentations
    sut_result = await db.execute(
        text(
            f"INSERT INTO public.sustentations"
            f" (project_id, scheduled_at, location, registered_by)"
            f" VALUES (:pid, :scheduled_at, :location, :by)"
            f" RETURNING {_SELECT_SUT}"
        ),
        {
            "pid": project_id,
            "scheduled_at": scheduled_at,
            "location": body.location.strip(),
            "by": current_user.id,
        },
    )
    sut_row = dict(sut_result.mappings().first())

    # Transición de estado
    await db.execute(
        text(
            "UPDATE public.thesis_projects"
            " SET status = 'sustentacion_programada', updated_at = now()"
            " WHERE id = :pid"
        ),
        {"pid": project_id},
    )
    await db.execute(
        text(
            "INSERT INTO public.project_status_history"
            " (project_id, previous_status, new_status, changed_by, notes)"
            " VALUES (:pid, 'aprobado_para_sustentacion', 'sustentacion_programada', :by, :notes)"
        ),
        {
            "pid": project_id,
            "by": current_user.id,
            "notes": (
                f"Sustentación programada: {body.scheduled_date} {body.scheduled_time} — {body.location}"
            ),
        },
    )

    # Mensaje de notificación
    msg = (
        f"Sustentación programada para '{project['title']}'. "
        f"Fecha: {body.scheduled_date}, Hora: {body.scheduled_time}, "
        f"Lugar: {body.location.strip()}"
    )

    # Notificar a estudiantes (broadcast: recipient_id = NULL)
    await send_system_message(db, project_id, current_user.id, None, msg)

    # Notificar a directores activos
    directors_result = await db.execute(
        text(
            "SELECT docente_id FROM public.project_directors"
            " WHERE project_id = :pid AND is_active = true"
        ),
        {"pid": project_id},
    )
    for director in directors_result.mappings():
        await send_system_message(db, project_id, current_user.id, director["docente_id"], msg)

    # Notificar a jurados de sustentación si ya están asignados
    jurors_result = await db.execute(
        text(
            "SELECT docente_id FROM public.project_jurors"
            " WHERE project_id = :pid AND stage = 'sustentacion' AND is_active = true"
        ),
        {"pid": project_id},
    )
    for juror in jurors_result.mappings():
        await send_system_message(db, project_id, current_user.id, juror["docente_id"], msg)

    await db.commit()
    return SustentationResponse(**sut_row, evaluations=[])


# ---------------------------------------------------------------------------
# GET /projects/{id}/sustentation — Detalle y calificaciones (T-F07-01)
# ---------------------------------------------------------------------------


@router.get(
    "/{project_id}/sustentation",
    response_model=SustentationResponse,
)
async def get_sustentation(
    project_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SustentationResponse:
    """
    Retorna el detalle de la sustentación y sus calificaciones.
    Para Estudiante: juror_id oculto (respuesta anónima).
    """
    await _check_membership(project_id, current_user, db)

    sut_result = await db.execute(
        text(f"SELECT {_SELECT_SUT} FROM public.sustentations WHERE project_id = :pid"),
        {"pid": project_id},
    )
    sut_row = sut_result.mappings().first()
    if sut_row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No hay sustentación registrada para este proyecto",
        )

    evals_result = await db.execute(
        text(f"SELECT {_SELECT_SE} FROM public.sustentation_evaluations WHERE sustentation_id = :sid"),
        {"sid": sut_row["id"]},
    )
    evals = list(evals_result.mappings())

    if current_user.role == "estudiante":
        eval_responses = [
            SustentationEvalStudentResponse(
                id=e["id"],
                sustentation_id=e["sustentation_id"],
                juror_number=e["juror_number"],
                score=e["score"],
                submitted_at=e["submitted_at"],
            )
            for e in evals
        ]
    else:
        eval_responses = [
            SustentationEvalAdminResponse(
                id=e["id"],
                sustentation_id=e["sustentation_id"],
                juror_id=e["juror_id"],
                juror_number=e["juror_number"],
                score=e["score"],
                submitted_at=e["submitted_at"],
                submitted_by=e["submitted_by"],
            )
            for e in evals
        ]

    return SustentationResponse(**sut_row, evaluations=eval_responses)


# ---------------------------------------------------------------------------
# POST /projects/{id}/sustentation/evaluations — Calificación individual (T-F07-02)
# ---------------------------------------------------------------------------


@router.post(
    "/{project_id}/sustentation/evaluations",
    response_model=SustentationEvalAdminResponse,
    status_code=status.HTTP_201_CREATED,
)
async def submit_sustentation_evaluation(
    project_id: UUID,
    body: SustentationEvalCreate,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SustentationEvalAdminResponse:
    """
    El jurado registra su calificación de la sustentación.
    Solo puede calificar el docente asignado como jurado en stage='sustentacion',
    o el Administrador en su lugar.
    Cuando ambos jurados han calificado: calcula final_score, determina is_approved
    y transiciona el estado del proyecto.
    """
    # Determinar el juror_number del usuario actual (o validar que es Admin)
    if current_user.role == "administrador":
        # Admin puede registrar en nombre de cualquier jurado — obtener juror_number por user_id
        # pero el Admin no tiene un juror_number asignado; necesita indicar el juror_number
        # Usamos un workaround: el Admin envía juror_number en el body (campo opcional)
        # Para simplificar, Admin puede pasar un juror_id query param o usamos
        # el primer jurado sin calificación. Sin embargo, el spec dice solo:
        # "Docente (Jurado asignado), Administrador" sin especificar cómo el Admin lo elige.
        # Implementación: Admin registra como el primer jurado activo sin calificación.
        juror_result = await db.execute(
            text(
                "SELECT pj.id, pj.docente_id, pj.juror_number"
                " FROM public.project_jurors pj"
                " WHERE pj.project_id = :pid AND pj.stage = 'sustentacion'"
                " AND pj.is_active = true"
                " ORDER BY pj.juror_number LIMIT 1"
            ),
            {"pid": project_id},
        )
        juror = juror_result.mappings().first()
    else:
        # Docente: debe ser jurado activo para stage=sustentacion
        juror_result = await db.execute(
            text(
                "SELECT pj.id, pj.docente_id, pj.juror_number"
                " FROM public.project_jurors pj"
                " WHERE pj.project_id = :pid AND pj.docente_id = :uid"
                " AND pj.stage = 'sustentacion' AND pj.is_active = true LIMIT 1"
            ),
            {"pid": project_id, "uid": current_user.id},
        )
        juror = juror_result.mappings().first()

    if juror is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No estás asignado como jurado para la sustentación de este proyecto",
        )

    # Verificar que la sustentación existe
    sut_result = await db.execute(
        text(f"SELECT {_SELECT_SUT} FROM public.sustentations WHERE project_id = :pid"),
        {"pid": project_id},
    )
    sut_row = sut_result.mappings().first()
    if sut_row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No hay sustentación registrada para este proyecto",
        )
    sut_id = sut_row["id"]

    # Verificar que este jurado no haya calificado ya
    existing_eval = await db.execute(
        text(
            "SELECT id FROM public.sustentation_evaluations"
            " WHERE sustentation_id = :sid AND juror_id = :uid"
        ),
        {"sid": sut_id, "uid": juror["docente_id"]},
    )
    if existing_eval.mappings().first() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya registraste tu calificación para esta sustentación",
        )

    # Validar rango de calificación
    if not (0.0 <= body.score <= 5.0):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La calificación debe estar entre 0.0 y 5.0",
        )

    now = datetime.now(timezone.utc)

    # Insertar calificación
    eval_result = await db.execute(
        text(
            f"INSERT INTO public.sustentation_evaluations"
            f" (sustentation_id, juror_id, juror_number, score, submitted_at, submitted_by)"
            f" VALUES (:sid, :juror_id, :juror_number, :score, :now, :by)"
            f" RETURNING {_SELECT_SE}"
        ),
        {
            "sid": sut_id,
            "juror_id": juror["docente_id"],
            "juror_number": juror["juror_number"],
            "score": round(body.score, 1),
            "now": now,
            "by": current_user.id,
        },
    )
    eval_row = dict(eval_result.mappings().first())

    # Verificar si ambos jurados ya han calificado → calcular resultado
    all_evals_result = await db.execute(
        text(
            "SELECT juror_number, score FROM public.sustentation_evaluations"
            " WHERE sustentation_id = :sid"
        ),
        {"sid": sut_id},
    )
    all_evals = {r["juror_number"]: r["score"] for r in all_evals_result.mappings()}

    if len(all_evals) >= 2:
        # Calcular promedio de J1 y J2
        s1 = all_evals.get(1)
        s2 = all_evals.get(2)
        if s1 is not None and s2 is not None:
            final_score = round((s1 + s2) / 2, 1)
            is_approved = final_score >= 4.0

            # Actualizar sustentations con resultado
            await db.execute(
                text(
                    "UPDATE public.sustentations"
                    " SET final_score = :fs, is_approved = :ia"
                    " WHERE id = :sid"
                ),
                {"fs": final_score, "ia": is_approved, "sid": sut_id},
            )

            # Obtener estado actual del proyecto
            proj_result = await db.execute(
                text("SELECT status FROM public.thesis_projects WHERE id = :id"),
                {"id": project_id},
            )
            proj = proj_result.mappings().first()
            prev_status = proj["status"]

            if is_approved:
                new_status = "trabajo_aprobado"
                msg = f"Sustentación aprobada. Promedio: {final_score}. Estado: Trabajo aprobado."
            else:
                new_status = "reprobado_en_sustentacion"
                msg = (
                    f"Sustentación reprobada. Promedio: {final_score}. "
                    "Debes iniciar el proceso desde cero."
                )

            # Transición de estado
            await db.execute(
                text(
                    "UPDATE public.thesis_projects"
                    " SET status = :new_status, updated_at = now() WHERE id = :pid"
                ),
                {"new_status": new_status, "pid": project_id},
            )
            await db.execute(
                text(
                    "INSERT INTO public.project_status_history"
                    " (project_id, previous_status, new_status, changed_by, notes)"
                    " VALUES (:pid, :prev, :new, :by, :notes)"
                ),
                {
                    "pid": project_id,
                    "prev": prev_status,
                    "new": new_status,
                    "by": current_user.id,
                    "notes": (
                        f"Sustentación {'aprobada' if is_approved else 'reprobada'}. "
                        f"Promedio: {final_score} (J1={s1}, J2={s2})"
                    ),
                },
            )
            # Notificar al estudiante (broadcast)
            await send_system_message(db, project_id, current_user.id, None, msg)

    await db.commit()
    return SustentationEvalAdminResponse(**eval_row)
