from datetime import date
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import CurrentUser, require_admin, require_estudiante
from app.schemas.date_window import WindowType
from app.schemas.extemporaneous_window import (
    ExtemporaneousWindowCreate,
    ExtemporaneousWindowResponse,
)
from app.schemas.project import ProjectCreate, ProjectResponse, TERMINAL_STATUSES
from app.services.modality_service import get_max_members

router = APIRouter(prefix="/projects", tags=["projects"])

_SELECT_PROJECT = (
    "id, title, modality_id, academic_program_id, research_group, research_line, "
    "suggested_director, period, status, has_company_link, plagiarism_suspended, "
    "created_at, updated_at"
)
_SELECT_EXT = "id, project_id, stage, granted_by, granted_at, valid_until, notes"


async def _get_project_or_404(project_id: UUID, db: AsyncSession) -> None:
    result = await db.execute(
        text("SELECT id FROM public.thesis_projects WHERE id = :id"),
        {"id": project_id},
    )
    if result.mappings().first() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trabajo de grado no encontrado",
        )


# ---------------------------------------------------------------------------
# POST /projects — Inscripción de idea
# ---------------------------------------------------------------------------


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    body: ProjectCreate,
    current_user: CurrentUser = Depends(require_estudiante),
    db: AsyncSession = Depends(get_db),
) -> ProjectResponse:
    """Inscribe una nueva idea de trabajo de grado (solo Estudiante)."""

    # 1. Verificar ventana activa para inscripción de idea
    window_result = await db.execute(
        text(
            """
            SELECT id, period FROM public.date_windows
            WHERE window_type = 'inscripcion_idea'
              AND is_active = true
              AND start_date <= :today
              AND end_date >= :today
            LIMIT 1
            """
        ),
        {"today": date.today()},
    )
    window_row = window_result.mappings().first()
    if window_row is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No hay una ventana de fechas activa para inscripción de ideas",
        )
    period = window_row["period"]

    # 2. El estudiante solicitante debe estar en la lista de integrantes
    if current_user.id not in body.member_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El estudiante solicitante debe incluirse en la lista de integrantes",
        )

    # 3. Todos los member_ids deben ser estudiantes activos pre-registrados
    param_names = [f"mid_{i}" for i in range(len(body.member_ids))]
    placeholders = ", ".join(f":{n}" for n in param_names)
    params = {n: mid for n, mid in zip(param_names, body.member_ids)}

    members_result = await db.execute(
        text(
            f"SELECT id FROM public.users"
            f" WHERE id IN ({placeholders}) AND role = 'estudiante' AND is_active = true"
        ),
        params,
    )
    valid_members = {row["id"] for row in members_result.mappings()}
    invalid = [str(mid) for mid in body.member_ids if mid not in valid_members]
    if invalid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Integrantes no válidos (deben ser estudiantes activos): {', '.join(invalid)}",
        )

    # 4. Obtener nivel del programa para calcular límite de integrantes
    program_result = await db.execute(
        text(
            "SELECT level FROM public.academic_programs"
            " WHERE id = :id AND is_active = true"
        ),
        {"id": body.academic_program_id},
    )
    program_row = program_result.mappings().first()
    if program_row is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Programa académico no encontrado o inactivo",
        )

    try:
        max_members = await get_max_members(db, body.modality_id, program_row["level"])
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Modalidad no encontrada",
        )

    if len(body.member_ids) > max_members:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"El número de integrantes ({len(body.member_ids)}) supera el límite "
                f"permitido ({max_members}) para esta modalidad y nivel académico"
            ),
        )

    # 5. El estudiante no debe tener un trabajo activo (no en estado terminal)
    terminal_list = list(TERMINAL_STATUSES)
    term_param_names = [f"ts_{i}" for i in range(len(terminal_list))]
    term_placeholders = ", ".join(f":{n}" for n in term_param_names)
    term_params = {n: s for n, s in zip(term_param_names, terminal_list)}

    active_project = await db.execute(
        text(
            f"""
            SELECT p.id FROM public.thesis_projects p
            JOIN public.project_members pm ON pm.project_id = p.id
            WHERE pm.student_id = :student_id
              AND pm.is_active = true
              AND p.status NOT IN ({term_placeholders})
            LIMIT 1
            """
        ),
        {"student_id": current_user.id, **term_params},
    )
    if active_project.mappings().first() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya tienes un trabajo de grado activo. No puedes inscribir una nueva idea",
        )

    # 6. Crear el proyecto
    project_result = await db.execute(
        text(
            f"""
            INSERT INTO public.thesis_projects
                (title, modality_id, academic_program_id, research_group,
                 research_line, suggested_director, period, status)
            VALUES
                (:title, :modality_id, :academic_program_id, :research_group,
                 :research_line, :suggested_director, :period, 'pendiente_evaluacion_idea')
            RETURNING {_SELECT_PROJECT}
            """
        ),
        {
            "title": body.title,
            "modality_id": body.modality_id,
            "academic_program_id": body.academic_program_id,
            "research_group": body.research_group,
            "research_line": body.research_line,
            "suggested_director": body.suggested_director,
            "period": period,
        },
    )
    project_row = project_result.mappings().first()
    project_id = project_row["id"]

    # 7. Crear registros en project_members
    for member_id in body.member_ids:
        await db.execute(
            text(
                "INSERT INTO public.project_members (project_id, student_id)"
                " VALUES (:project_id, :student_id)"
            ),
            {"project_id": project_id, "student_id": member_id},
        )

    # 8. Registrar en project_status_history
    await db.execute(
        text(
            """
            INSERT INTO public.project_status_history
                (project_id, previous_status, new_status, changed_by, notes)
            VALUES
                (:project_id, NULL, 'pendiente_evaluacion_idea', :changed_by, 'Idea inscrita')
            """
        ),
        {"project_id": project_id, "changed_by": current_user.id},
    )

    # 9. Mensaje automático a todos los integrantes
    await db.execute(
        text(
            """
            INSERT INTO public.messages
                (project_id, sender_id, recipient_id, content, sender_display)
            VALUES
                (:project_id, :sender_id, NULL,
                 'Tu idea ha sido inscrita. Estado: Pendiente de evaluación', 'Sistema')
            """
        ),
        {"project_id": project_id, "sender_id": current_user.id},
    )

    await db.commit()
    return ProjectResponse(**project_row)


# ---------------------------------------------------------------------------
# POST/DELETE /projects/{id}/extemporaneous-window
# ---------------------------------------------------------------------------


@router.post(
    "/{project_id}/extemporaneous-window",
    response_model=ExtemporaneousWindowResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_extemporaneous_window(
    project_id: UUID,
    body: ExtemporaneousWindowCreate,
    current_user: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> ExtemporaneousWindowResponse:
    await _get_project_or_404(project_id, db)

    existing = await db.execute(
        text(
            "SELECT id FROM public.extemporaneous_windows"
            " WHERE project_id = :project_id AND stage = :stage"
        ),
        {"project_id": project_id, "stage": body.window_type.value},
    )
    if existing.mappings().first() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe una ventana extemporánea activa para este proyecto y etapa",
        )

    result = await db.execute(
        text(
            f"""
            INSERT INTO public.extemporaneous_windows
                (project_id, stage, granted_by, valid_until, notes)
            VALUES
                (:project_id, :stage, :granted_by, :valid_until, :notes)
            RETURNING {_SELECT_EXT}
            """
        ),
        {
            "project_id": project_id,
            "stage": body.window_type.value,
            "granted_by": current_user.id,
            "valid_until": body.valid_until,
            "notes": body.notes,
        },
    )
    row = result.mappings().first()
    await db.commit()
    return ExtemporaneousWindowResponse(**row)


@router.delete(
    "/{project_id}/extemporaneous-window",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_extemporaneous_window(
    project_id: UUID,
    window_type: WindowType,
    _: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> None:
    await _get_project_or_404(project_id, db)

    result = await db.execute(
        text(
            "DELETE FROM public.extemporaneous_windows"
            " WHERE project_id = :project_id AND stage = :stage"
        ),
        {"project_id": project_id, "stage": window_type.value},
    )
    if result.rowcount == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ventana extemporánea no encontrada",
        )
    await db.commit()
