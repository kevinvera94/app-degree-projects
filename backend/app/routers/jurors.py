"""
Router de jurados de proyectos.

Rutas implementadas (T-F05-02):
  POST   /projects/{id}/jurors           — asignar jurado (Administrador)
  GET    /projects/{id}/jurors           — listar jurados (anonimizados para Estudiante)
  DELETE /projects/{id}/jurors/{jurorId} — remover jurado (Admin, solo sin calificación)
"""

from datetime import datetime, timezone
from typing import Union
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import CurrentUser, get_current_user, require_admin
from app.schemas.juror import JurorCreate, JurorResponse, JurorStudentResponse
from app.utils.business_days import add_business_days

router = APIRouter(prefix="/projects", tags=["jurors"])

_SELECT_JUROR = (
    "pj.id, pj.project_id, pj.docente_id, pj.juror_number, pj.stage,"
    " pj.is_active, pj.assigned_at, pj.assigned_by,"
    " u.full_name"
)


async def _check_membership(
    project_id: UUID, user: CurrentUser, db: AsyncSession
) -> None:
    """Lanza 403 si el usuario no es admin ni tiene pertenencia activa al proyecto."""
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


# ---------------------------------------------------------------------------
# GET /projects/{id}/jurors — Listar jurados (T-F05-02)
# ---------------------------------------------------------------------------


@router.get(
    "/{project_id}/jurors",
    response_model=list[Union[JurorResponse, JurorStudentResponse]],
)
async def list_jurors(
    project_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list:
    """
    Lista jurados del proyecto.
    Estudiantes ven solo juror_number y stage (sin identidad).
    Admin y Docente ven visibilidad completa.
    """
    await _check_membership(project_id, current_user, db)

    is_student = current_user.role == "estudiante"

    if is_student:
        result = await db.execute(
            text(
                "SELECT pj.juror_number, pj.stage, pj.is_active"
                " FROM public.project_jurors pj"
                " WHERE pj.project_id = :pid ORDER BY pj.stage, pj.juror_number"
            ),
            {"pid": project_id},
        )
        return [JurorStudentResponse(**r) for r in result.mappings()]

    result = await db.execute(
        text(
            f"SELECT {_SELECT_JUROR}"
            " FROM public.project_jurors pj"
            " JOIN public.users u ON u.id = pj.docente_id"
            " WHERE pj.project_id = :pid ORDER BY pj.stage, pj.juror_number"
        ),
        {"pid": project_id},
    )
    return [JurorResponse(**r) for r in result.mappings()]


# ---------------------------------------------------------------------------
# POST /projects/{id}/jurors — Asignar jurado (T-F05-02)
# ---------------------------------------------------------------------------


@router.post(
    "/{project_id}/jurors",
    response_model=JurorResponse,
    status_code=status.HTTP_201_CREATED,
)
async def assign_juror(
    project_id: UUID,
    body: JurorCreate,
    current_user: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> JurorResponse:
    """
    Asigna un jurado al proyecto.
    - J1/J2: solo en estado anteproyecto_pendiente_evaluacion.
    - J3: además requiere divergencia comprobada entre J1 y J2.
    - Crea el registro en project_jurors y en evaluations con plazo de 15 días hábiles.
    """
    # Obtener proyecto
    proj_result = await db.execute(
        text(
            "SELECT id, status, period, title"
            " FROM public.thesis_projects WHERE id = :id"
        ),
        {"id": project_id},
    )
    project = proj_result.mappings().first()
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trabajo de grado no encontrado",
        )

    # Validar estado del proyecto según etapa del jurado
    _valid_states = {
        "anteproyecto": {"anteproyecto_pendiente_evaluacion"},
        "producto_final": {"producto_final_entregado", "en_revision_jurados_producto_final"},
    }
    if project["status"] not in _valid_states.get(body.stage, set()):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"No se pueden asignar jurados de '{body.stage}' en el estado actual. "
                f"Estado actual: {project['status']}"
            ),
        )

    # Validación extra para Jurado 3: debe existir divergencia real
    if body.juror_number == 3:
        div_result = await db.execute(
            text(
                "SELECT juror_number, score FROM public.evaluations"
                " WHERE project_id = :pid AND stage = :stage"
                " AND juror_number IN (1, 2) AND score IS NOT NULL"
                " AND revision_number = ("
                "   SELECT MAX(revision_number) FROM public.evaluations"
                "   WHERE project_id = :pid AND stage = :stage"
                "   AND juror_number IN (1, 2) AND score IS NOT NULL"
                " )"
            ),
            {"pid": project_id, "stage": body.stage},
        )
        scored = {r["juror_number"]: r["score"] for r in div_result.mappings()}
        s1, s2 = scored.get(1), scored.get(2)
        has_divergence = (
            s1 is not None and s2 is not None
            and ((s1 >= 4.0 and s2 < 3.0) or (s1 < 3.0 and s2 >= 4.0))
        )
        if not has_divergence:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "No se puede asignar Jurado 3 sin divergencia comprobada "
                    "(se requiere que un jurado apruebe ≥ 4.0 y el otro repruebe < 3.0)"
                ),
            )

    # Validar que el docente existe, está activo y tiene rol docente
    docente_result = await db.execute(
        text(
            "SELECT id FROM public.users"
            " WHERE id = :uid AND role = 'docente' AND is_active = true"
        ),
        {"uid": body.user_id},
    )
    if docente_result.mappings().first() is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El usuario no existe, no es docente o está inactivo",
        )

    # No permitir asignar el mismo docente como J1 y J2 (ambos activos)
    cross_check = await db.execute(
        text(
            "SELECT id FROM public.project_jurors"
            " WHERE project_id = :pid AND docente_id = :uid"
            " AND stage = :stage AND is_active = true"
        ),
        {"pid": project_id, "uid": body.user_id, "stage": body.stage},
    )
    if cross_check.mappings().first() is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este docente ya está asignado como jurado en esta etapa",
        )

    # No permitir duplicar el número de jurado para esta etapa
    num_check = await db.execute(
        text(
            "SELECT id FROM public.project_jurors"
            " WHERE project_id = :pid AND juror_number = :num"
            " AND stage = :stage AND is_active = true"
        ),
        {"pid": project_id, "num": body.juror_number, "stage": body.stage},
    )
    if num_check.mappings().first() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Ya existe un Jurado {body.juror_number} activo"
                " asignado para esta etapa"
            ),
        )

    # Para producto_final: buscar el jurado equivalente del anteproyecto para trazabilidad
    replaced_docente_id = None
    if body.stage == "producto_final" and body.juror_number in (1, 2):
        prev_result = await db.execute(
            text(
                "SELECT docente_id FROM public.project_jurors"
                " WHERE project_id = :pid AND stage = 'anteproyecto'"
                " AND juror_number = :num AND is_active = true LIMIT 1"
            ),
            {"pid": project_id, "num": body.juror_number},
        )
        prev = prev_result.mappings().first()
        if prev and prev["docente_id"] != body.user_id:
            replaced_docente_id = prev["docente_id"]

    # Insertar en project_jurors
    now = datetime.now(timezone.utc)
    juror_result = await db.execute(
        text(
            "INSERT INTO public.project_jurors"
            " (project_id, docente_id, juror_number, stage, assigned_by, assigned_at,"
            "  replaced_docente_id)"
            " VALUES (:pid, :did, :num, :stage, :by, :now, :replaced)"
            " RETURNING id, project_id, docente_id, juror_number, stage,"
            "           is_active, assigned_at, assigned_by"
        ),
        {
            "pid": project_id,
            "did": body.user_id,
            "num": body.juror_number,
            "stage": body.stage,
            "by": current_user.id,
            "now": now,
            "replaced": replaced_docente_id,
        },
    )
    juror_row = dict(juror_result.mappings().first())

    # Obtener la submission activa (en_revision) para esta etapa
    sub_result = await db.execute(
        text(
            "SELECT id FROM public.submissions"
            " WHERE project_id = :pid AND stage = :stage AND status = 'en_revision'"
            " ORDER BY submitted_at DESC LIMIT 1"
        ),
        {"pid": project_id, "stage": body.stage},
    )
    sub_row = sub_result.mappings().first()
    submission_id = sub_row["id"] if sub_row else None

    # Calcular due_date: 15 días hábiles desde assigned_at
    assigned_date = now.date()
    due_date = add_business_days(assigned_date, 15, project["period"])

    # Determinar revision_number: J3 hereda el de J1/J2; J1/J2 usan 1 por defecto
    revision_number = 1
    if body.juror_number == 3:
        rev_result = await db.execute(
            text(
                "SELECT revision_number FROM public.evaluations"
                " WHERE project_id = :pid AND stage = :stage"
                " AND juror_number IN (1, 2) AND score IS NOT NULL"
                " ORDER BY revision_number DESC LIMIT 1"
            ),
            {"pid": project_id, "stage": body.stage},
        )
        rev_row = rev_result.mappings().first()
        if rev_row:
            revision_number = rev_row["revision_number"]

    # Crear registro en evaluations (sin calificación aún)
    await db.execute(
        text(
            """
            INSERT INTO public.evaluations
                (project_id, submission_id, juror_id, juror_number, stage,
                 start_date, due_date, revision_number)
            VALUES
                (:project_id, :submission_id, :juror_id, :juror_number, :stage,
                 :start_date, :due_date, :revision_number)
            """
        ),
        {
            "project_id": project_id,
            "submission_id": submission_id,
            "juror_id": body.user_id,
            "juror_number": body.juror_number,
            "stage": body.stage,
            "start_date": now,
            "due_date": due_date,
            "revision_number": revision_number,
        },
    )

    # Mensaje automático al docente asignado
    await db.execute(
        text(
            "INSERT INTO public.messages"
            " (project_id, sender_id, recipient_id, content, sender_display)"
            " VALUES (:pid, :sid, :rid, :content, 'Sistema')"
        ),
        {
            "pid": project_id,
            "sid": current_user.id,
            "rid": body.user_id,
            "content": (
                f"Has sido asignado como Jurado {body.juror_number}"
                f" del trabajo '{project['title']}'."
                f" Plazo de evaluación: {due_date.strftime('%d/%m/%Y')}"
            ),
        },
    )

    # Para producto_final: si J1 y J2 están ahora asignados → en_revision_jurados_producto_final
    if body.stage == "producto_final" and body.juror_number in (1, 2):
        count_result = await db.execute(
            text(
                "SELECT COUNT(*) FROM public.project_jurors"
                " WHERE project_id = :pid AND stage = 'producto_final'"
                " AND juror_number IN (1, 2) AND is_active = true"
            ),
            {"pid": project_id},
        )
        active_count = count_result.scalar_one()
        if active_count >= 2:
            await db.execute(
                text(
                    "UPDATE public.thesis_projects"
                    " SET status = 'en_revision_jurados_producto_final', updated_at = now()"
                    " WHERE id = :pid"
                ),
                {"pid": project_id},
            )
            await db.execute(
                text(
                    "INSERT INTO public.project_status_history"
                    " (project_id, previous_status, new_status, changed_by, notes)"
                    " VALUES (:pid, :prev, 'en_revision_jurados_producto_final', :by, :notes)"
                ),
                {
                    "pid": project_id,
                    "prev": project["status"],
                    "by": current_user.id,
                    "notes": "Jurado 1 y Jurado 2 asignados para producto final. Inicia período de evaluación.",
                },
            )

    await db.commit()

    # Enriquecer con full_name
    name_result = await db.execute(
        text("SELECT full_name FROM public.users WHERE id = :id"),
        {"id": body.user_id},
    )
    juror_row["full_name"] = name_result.scalar_one()
    juror_row["project_id"] = project_id
    return JurorResponse(**juror_row)


# ---------------------------------------------------------------------------
# DELETE /projects/{id}/jurors/{juror_id} — Remover jurado (T-F05-02)
# ---------------------------------------------------------------------------


@router.delete(
    "/{project_id}/jurors/{juror_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_juror(
    project_id: UUID,
    juror_id: UUID,
    current_user: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> None:
    """
    Remueve un jurado solo si aún no ha registrado ninguna calificación.
    También elimina el registro de evaluations pendiente asociado.
    """
    # Verificar que el jurado existe en este proyecto
    juror_result = await db.execute(
        text(
            "SELECT id, docente_id, juror_number, stage"
            " FROM public.project_jurors"
            " WHERE id = :jid AND project_id = :pid AND is_active = true"
        ),
        {"jid": juror_id, "pid": project_id},
    )
    juror = juror_result.mappings().first()
    if juror is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Jurado no encontrado en este proyecto",
        )

    # Verificar que no haya calificación registrada para este jurado en esta etapa
    eval_result = await db.execute(
        text(
            "SELECT id FROM public.evaluations"
            " WHERE project_id = :pid AND juror_id = :did"
            " AND stage = :stage AND score IS NOT NULL"
            " LIMIT 1"
        ),
        {
            "pid": project_id,
            "did": juror["docente_id"],
            "stage": juror["stage"],
        },
    )
    if eval_result.mappings().first() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se puede remover un jurado que ya registró una calificación",
        )

    # Marcar como inactivo en project_jurors
    await db.execute(
        text("UPDATE public.project_jurors SET is_active = false WHERE id = :jid"),
        {"jid": juror_id},
    )

    # Eliminar el registro de evaluations pendiente (sin calificación) para este jurado
    await db.execute(
        text(
            "DELETE FROM public.evaluations"
            " WHERE project_id = :pid AND juror_id = :did"
            " AND stage = :stage AND score IS NULL"
        ),
        {
            "pid": project_id,
            "did": juror["docente_id"],
            "stage": juror["stage"],
        },
    )

    await db.commit()
