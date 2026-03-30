from datetime import date, datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import (
    CurrentUser,
    get_current_user,
    require_admin,
    require_estudiante,
)
from app.core.supabase_client import supabase_admin
from app.schemas.date_window import WindowType
from app.schemas.extemporaneous_window import (
    ExtemporaneousWindowCreate,
    ExtemporaneousWindowResponse,
)
from app.schemas.director import DirectorCreate, DirectorResponse, ProjectStatusUpdate
from app.schemas.project import (
    MemberAdd,
    PaginatedProjectsResponse,
    ProjectCreate,
    ProjectDetailResponse,
    ProjectDirectorInfo,
    ProjectJurorInfo,
    ProjectMemberInfo,
    ProjectResponse,
    SubmissionBasicInfo,
    TERMINAL_STATUSES,
)
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
# GET /projects — Listado (solo Administrador, paginado con filtros)
# ---------------------------------------------------------------------------


@router.get("", response_model=PaginatedProjectsResponse)
async def list_projects(
    project_status: Optional[str] = None,
    modality_id: Optional[UUID] = None,
    academic_period: Optional[str] = None,
    academic_program_id: Optional[UUID] = None,
    page: int = 1,
    size: int = 20,
    _: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> PaginatedProjectsResponse:
    conditions = []
    params: dict = {"limit": size, "offset": (page - 1) * size}

    if project_status is not None:
        conditions.append("status = :project_status")
        params["project_status"] = project_status
    if modality_id is not None:
        conditions.append("modality_id = :modality_id")
        params["modality_id"] = modality_id
    if academic_period is not None:
        conditions.append("period = :academic_period")
        params["academic_period"] = academic_period
    if academic_program_id is not None:
        conditions.append("academic_program_id = :academic_program_id")
        params["academic_program_id"] = academic_program_id

    where = f" WHERE {' AND '.join(conditions)}" if conditions else ""

    count_result = await db.execute(
        text(f"SELECT COUNT(*) FROM public.thesis_projects{where}"), params
    )
    total: int = count_result.scalar_one()

    rows_result = await db.execute(
        text(
            f"SELECT {_SELECT_PROJECT} FROM public.thesis_projects{where}"
            " ORDER BY created_at DESC LIMIT :limit OFFSET :offset"
        ),
        params,
    )
    items = [ProjectResponse(**row) for row in rows_result.mappings()]
    return PaginatedProjectsResponse(items=items, total=total, page=page, size=size)


# ---------------------------------------------------------------------------
# GET /projects/my — Proyectos del usuario autenticado (Docente / Estudiante)
# ---------------------------------------------------------------------------


@router.get("/my", response_model=list[ProjectResponse])
async def list_my_projects(
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ProjectResponse]:
    if current_user.role == "estudiante":
        result = await db.execute(
            text(
                f"SELECT DISTINCT p.{_SELECT_PROJECT.replace(', ', ', p.')}"
                " FROM public.thesis_projects p"
                " JOIN public.project_members pm ON pm.project_id = p.id"
                " WHERE pm.student_id = :uid AND pm.is_active = true"
                " ORDER BY p.created_at DESC"
            ),
            {"uid": current_user.id},
        )
    elif current_user.role == "docente":
        result = await db.execute(
            text(
                f"SELECT DISTINCT p.{_SELECT_PROJECT.replace(', ', ', p.')}"
                " FROM public.thesis_projects p"
                " LEFT JOIN public.project_directors pd"
                "   ON pd.project_id = p.id AND pd.is_active = true"
                " LEFT JOIN public.project_jurors pj"
                "   ON pj.project_id = p.id AND pj.is_active = true"
                " WHERE pd.docente_id = :uid OR pj.docente_id = :uid"
                " ORDER BY p.created_at DESC"
            ),
            {"uid": current_user.id},
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Este endpoint es solo para docentes y estudiantes",
        )

    return [ProjectResponse(**row) for row in result.mappings()]


# ---------------------------------------------------------------------------
# GET /projects/{id} — Detalle completo (con validación de pertenencia)
# ---------------------------------------------------------------------------


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


@router.get("/{project_id}", response_model=ProjectDetailResponse)
async def get_project(
    project_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProjectDetailResponse:
    # Obtener proyecto
    result = await db.execute(
        text(f"SELECT {_SELECT_PROJECT} FROM public.thesis_projects WHERE id = :id"),
        {"id": project_id},
    )
    row = result.mappings().first()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trabajo de grado no encontrado",
        )

    await _check_membership(project_id, current_user, db)

    # Integrantes
    members_result = await db.execute(
        text(
            "SELECT pm.id, pm.student_id, u.full_name,"
            " u.email, pm.is_active, pm.joined_at"
            " FROM public.project_members pm"
            " JOIN public.users u ON u.id = pm.student_id"
            " WHERE pm.project_id = :pid ORDER BY pm.joined_at"
        ),
        {"pid": project_id},
    )
    members = [ProjectMemberInfo(**r) for r in members_result.mappings()]

    # Directores
    directors_result = await db.execute(
        text(
            "SELECT pd.id, pd.docente_id, u.full_name,"
            ' pd."order", pd.is_active, pd.assigned_at'
            " FROM public.project_directors pd"
            " JOIN public.users u ON u.id = pd.docente_id"
            " WHERE pd.project_id = :pid ORDER BY pd.order"
        ),
        {"pid": project_id},
    )
    directors = [ProjectDirectorInfo(**r) for r in directors_result.mappings()]

    # Jurados — anonimato para estudiantes
    is_student = current_user.role == "estudiante"
    if is_student:
        jurors_result = await db.execute(
            text(
                "SELECT pj.juror_number, pj.stage, pj.is_active"
                " FROM public.project_jurors pj"
                " WHERE pj.project_id = :pid ORDER BY pj.stage, pj.juror_number"
            ),
            {"pid": project_id},
        )
    else:
        jurors_result = await db.execute(
            text(
                "SELECT pj.id, pj.docente_id, u.full_name, pj.juror_number,"
                " pj.stage, pj.is_active, pj.assigned_at"
                " FROM public.project_jurors pj"
                " JOIN public.users u ON u.id = pj.docente_id"
                " WHERE pj.project_id = :pid ORDER BY pj.stage, pj.juror_number"
            ),
            {"pid": project_id},
        )
    jurors = [ProjectJurorInfo(**r) for r in jurors_result.mappings()]

    # Radicaciones (básico)
    subs_result = await db.execute(
        text(
            "SELECT id, stage, submitted_at, status,"
            " revision_number, is_extemporaneous"
            " FROM public.submissions WHERE project_id = :pid"
            " ORDER BY submitted_at DESC"
        ),
        {"pid": project_id},
    )
    submissions = [SubmissionBasicInfo(**r) for r in subs_result.mappings()]

    return ProjectDetailResponse(
        **row,
        members=members,
        directors=directors,
        jurors=jurors,
        submissions=submissions,
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
            detail="El estudiante solicitante debe incluirse en la lista de integrantes",  # noqa: E501
        )

    # 3. Todos los member_ids deben ser estudiantes activos pre-registrados
    param_names = [f"mid_{i}" for i in range(len(body.member_ids))]
    placeholders = ", ".join(f":{n}" for n in param_names)
    params = {n: mid for n, mid in zip(param_names, body.member_ids)}

    members_result = await db.execute(
        text(
            f"SELECT id FROM public.users"
            f" WHERE id IN ({placeholders})"
            f" AND role = 'estudiante' AND is_active = true"
        ),
        params,
    )
    valid_members = {row["id"] for row in members_result.mappings()}
    invalid = [str(mid) for mid in body.member_ids if mid not in valid_members]
    if invalid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Integrantes no válidos (deben ser estudiantes activos):"
                f" {', '.join(invalid)}"
            ),
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
            detail=(
                "Ya tienes un trabajo de grado activo."
                " No puedes inscribir una nueva idea"
            ),
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
                 :research_line, :suggested_director, :period,
                 'pendiente_evaluacion_idea')
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
                (:project_id, NULL, 'pendiente_evaluacion_idea',
                 :changed_by, 'Idea inscrita')
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
# PATCH /projects/{id}/status — Cambio de estado (aprobar, rechazar, cancelar…)
# ---------------------------------------------------------------------------


@router.patch("/{project_id}/status", response_model=ProjectResponse)
async def update_project_status(
    project_id: UUID,
    body: ProjectStatusUpdate,
    current_user: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> ProjectResponse:
    # Cargar proyecto
    proj_result = await db.execute(
        text(f"SELECT {_SELECT_PROJECT} FROM public.thesis_projects WHERE id = :id"),
        {"id": project_id},
    )
    project = proj_result.mappings().first()
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trabajo de grado no encontrado",
        )

    action = body.action.lower()

    if action == "aprobar":
        if project["status"] != "pendiente_evaluacion_idea":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Solo se puede aprobar una idea en estado"
                    " 'pendiente_evaluacion_idea'."
                    f" Estado actual: {project['status']}"
                ),
            )

        # Verificar que existe al menos un director activo asignado
        dir_result = await db.execute(
            text(
                "SELECT pd.id, pd.docente_id, u.full_name"
                " FROM public.project_directors pd"
                " JOIN public.users u ON u.id = pd.docente_id"
                " WHERE pd.project_id = :pid AND pd.is_active = true"
                " ORDER BY pd.order LIMIT 1"
            ),
            {"pid": project_id},
        )
        director = dir_result.mappings().first()
        if director is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Debe asignar al menos un director antes de aprobar la idea",
            )

        new_status = "idea_aprobada"
        notes = "Idea aprobada por el CTG"

        # Actualizar estado
        updated = await db.execute(
            text(
                f"UPDATE public.thesis_projects"
                f" SET status = :new_status, updated_at = now()"
                f" WHERE id = :id RETURNING {_SELECT_PROJECT}"
            ),
            {"new_status": new_status, "id": project_id},
        )
        updated_row = updated.mappings().first()

        # Registrar en historial
        await db.execute(
            text(
                "INSERT INTO public.project_status_history"
                " (project_id, previous_status, new_status, changed_by, notes)"
                " VALUES (:pid, :prev, :new, :by, :notes)"
            ),
            {
                "pid": project_id,
                "prev": project["status"],
                "new": new_status,
                "by": current_user.id,
                "notes": notes,
            },
        )

        # Mensaje a todos los integrantes
        await db.execute(
            text(
                "INSERT INTO public.messages"
                " (project_id, sender_id, recipient_id, content, sender_display)"
                " VALUES (:pid, :sid, NULL, :content, 'Sistema')"
            ),
            {
                "pid": project_id,
                "sid": current_user.id,
                "content": (
                    f"Tu idea ha sido aprobada."
                    f" Director asignado: {director['full_name']}"
                ),
            },
        )

        # Mensaje al docente director
        await db.execute(
            text(
                "INSERT INTO public.messages"
                " (project_id, sender_id, recipient_id, content, sender_display)"
                " VALUES (:pid, :sid, :rid, :content, 'Sistema')"
            ),
            {
                "pid": project_id,
                "sid": current_user.id,
                "rid": director["docente_id"],
                "content": (
                    f"Has sido asignado como director"
                    f" del trabajo '{project['title']}'"
                ),
            },
        )

        await db.commit()
        return ProjectResponse(**updated_row)

    if action == "rechazar":
        if project["status"] != "pendiente_evaluacion_idea":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Solo se puede rechazar una idea en estado"
                    " 'pendiente_evaluacion_idea'."
                    f" Estado actual: {project['status']}"
                ),
            )
        if not body.reason or not body.reason.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El motivo del rechazo es obligatorio",
            )

        new_status = "idea_rechazada"

        updated = await db.execute(
            text(
                f"UPDATE public.thesis_projects"
                f" SET status = :new_status, updated_at = now()"
                f" WHERE id = :id RETURNING {_SELECT_PROJECT}"
            ),
            {"new_status": new_status, "id": project_id},
        )
        updated_row = updated.mappings().first()

        await db.execute(
            text(
                "INSERT INTO public.project_status_history"
                " (project_id, previous_status, new_status, changed_by, notes)"
                " VALUES (:pid, :prev, :new, :by, :notes)"
            ),
            {
                "pid": project_id,
                "prev": project["status"],
                "new": new_status,
                "by": current_user.id,
                "notes": body.reason.strip(),
            },
        )

        await db.execute(
            text(
                "INSERT INTO public.messages"
                " (project_id, sender_id, recipient_id, content, sender_display)"
                " VALUES (:pid, :sid, NULL, :content, 'Sistema')"
            ),
            {
                "pid": project_id,
                "sid": current_user.id,
                "content": f"Tu idea ha sido rechazada. Motivo: {body.reason.strip()}",
            },
        )

        await db.commit()
        return ProjectResponse(**updated_row)

    if action == "cancelar":
        if project["status"] == "cancelado":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="El proyecto ya está cancelado",
            )
        if not body.reason or not body.reason.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El motivo de cancelación es obligatorio",
            )

        new_status = "cancelado"

        updated = await db.execute(
            text(
                f"UPDATE public.thesis_projects"
                f" SET status = :new_status, updated_at = now()"
                f" WHERE id = :id RETURNING {_SELECT_PROJECT}"
            ),
            {"new_status": new_status, "id": project_id},
        )
        updated_row = updated.mappings().first()

        await db.execute(
            text(
                "INSERT INTO public.project_status_history"
                " (project_id, previous_status, new_status, changed_by, notes)"
                " VALUES (:pid, :prev, :new, :by, :notes)"
            ),
            {
                "pid": project_id,
                "prev": project["status"],
                "new": new_status,
                "by": current_user.id,
                "notes": body.reason.strip(),
            },
        )

        await db.execute(
            text(
                "INSERT INTO public.messages"
                " (project_id, sender_id, recipient_id, content, sender_display)"
                " VALUES (:pid, :sid, NULL, :content, 'Sistema')"
            ),
            {
                "pid": project_id,
                "sid": current_user.id,
                "content": f"Tu trabajo ha sido archivado. Motivo: {body.reason.strip()}",  # noqa: E501
            },
        )

        await db.commit()
        return ProjectResponse(**updated_row)

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Acción '{body.action}' no reconocida o no aplicable en este estado",
    )


# ---------------------------------------------------------------------------
# POST/DELETE /projects/{id}/directors
# ---------------------------------------------------------------------------


@router.post(
    "/{project_id}/directors",
    response_model=DirectorResponse,
    status_code=status.HTTP_201_CREATED,
)
async def assign_director(
    project_id: UUID,
    body: DirectorCreate,
    current_user: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> DirectorResponse:
    await _get_project_or_404(project_id, db)

    # Docente debe ser activo
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

    # Máx. 2 directores activos
    count_result = await db.execute(
        text(
            "SELECT COUNT(*) FROM public.project_directors"
            " WHERE project_id = :pid AND is_active = true"
        ),
        {"pid": project_id},
    )
    if count_result.scalar_one() >= 2:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El proyecto ya tiene 2 directores activos asignados",
        )

    # No asignar el mismo docente dos veces
    dup_result = await db.execute(
        text(
            "SELECT id FROM public.project_directors"
            " WHERE project_id = :pid AND docente_id = :uid AND is_active = true"
        ),
        {"pid": project_id, "uid": body.user_id},
    )
    if dup_result.mappings().first() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El docente ya está asignado como director de este proyecto",
        )

    result = await db.execute(
        text(
            "INSERT INTO public.project_directors"
            ' (project_id, docente_id, "order", assigned_by)'
            " VALUES (:pid, :did, :order, :by)"
            " RETURNING id, project_id, docente_id,"
            ' "order" AS order, assigned_by, assigned_at, is_active'
        ),
        {
            "pid": project_id,
            "did": body.user_id,
            "order": body.order,
            "by": current_user.id,
        },
    )
    row = dict(result.mappings().first())
    await db.commit()

    # Enriquecer con full_name del docente
    name_result = await db.execute(
        text("SELECT full_name FROM public.users WHERE id = :id"),
        {"id": row["docente_id"]},
    )
    row["full_name"] = name_result.scalar_one()
    return DirectorResponse(**row)


@router.delete(
    "/{project_id}/directors/{director_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_director(
    project_id: UUID,
    director_id: UUID,
    _: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        text(
            "DELETE FROM public.project_directors"
            " WHERE id = :did AND project_id = :pid"
        ),
        {"did": director_id, "pid": project_id},
    )
    if result.rowcount == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Director no encontrado en este proyecto",
        )
    await db.commit()


# ---------------------------------------------------------------------------
# GET/POST /projects/{id}/members
# ---------------------------------------------------------------------------

# Estados a partir de los cuales ya no se pueden agregar integrantes
_BLOCKED_FOR_MEMBERS = frozenset(
    {
        "en_desarrollo",
        "producto_final_entregado",
        "en_revision_jurados_producto_final",
        "correcciones_producto_final_solicitadas",
        "producto_final_corregido_entregado",
        "producto_final_reprobado",
        "aprobado_para_sustentacion",
        "sustentacion_programada",
        "trabajo_aprobado",
        "reprobado_en_sustentacion",
        "acta_generada",
        "suspendido_por_plagio",
        "cancelado",
    }
)


@router.get("/{project_id}/members", response_model=list[ProjectMemberInfo])
async def list_members(
    project_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ProjectMemberInfo]:
    await _get_project_or_404(project_id, db)
    await _check_membership(project_id, current_user, db)

    result = await db.execute(
        text(
            "SELECT pm.id, pm.student_id, u.full_name,"
            " u.email, pm.is_active, pm.joined_at"
            " FROM public.project_members pm"
            " JOIN public.users u ON u.id = pm.student_id"
            " WHERE pm.project_id = :pid ORDER BY pm.joined_at"
        ),
        {"pid": project_id},
    )
    return [ProjectMemberInfo(**row) for row in result.mappings()]


@router.post(
    "/{project_id}/members",
    response_model=ProjectMemberInfo,
    status_code=status.HTTP_201_CREATED,
)
async def add_member(
    project_id: UUID,
    body: MemberAdd,
    current_user: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> ProjectMemberInfo:
    # Obtener proyecto
    proj_result = await db.execute(
        text(f"SELECT {_SELECT_PROJECT} FROM public.thesis_projects WHERE id = :id"),
        {"id": project_id},
    )
    project = proj_result.mappings().first()
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trabajo de grado no encontrado",
        )

    # Solo antes de que el anteproyecto sea aprobado (estado < en_desarrollo)
    if project["status"] in _BLOCKED_FOR_MEMBERS:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se pueden agregar integrantes una vez aprobado el anteproyecto",
        )

    # El usuario debe ser estudiante activo
    student_result = await db.execute(
        text(
            "SELECT id FROM public.users"
            " WHERE id = :uid AND role = 'estudiante' AND is_active = true"
        ),
        {"uid": body.user_id},
    )
    if student_result.mappings().first() is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El usuario no existe, no es estudiante o está inactivo",
        )

    # No duplicar integrante activo
    dup_result = await db.execute(
        text(
            "SELECT id FROM public.project_members"
            " WHERE project_id = :pid AND student_id = :uid AND is_active = true"
        ),
        {"pid": project_id, "uid": body.user_id},
    )
    if dup_result.mappings().first() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El estudiante ya es integrante activo de este proyecto",
        )

    # Verificar límite de integrantes
    program_result = await db.execute(
        text(
            "SELECT ap.level FROM public.academic_programs ap"
            " JOIN public.thesis_projects p ON p.academic_program_id = ap.id"
            " WHERE p.id = :pid"
        ),
        {"pid": project_id},
    )
    program_row = program_result.mappings().first()

    count_result = await db.execute(
        text(
            "SELECT COUNT(*) FROM public.project_members"
            " WHERE project_id = :pid AND is_active = true"
        ),
        {"pid": project_id},
    )
    current_count = count_result.scalar_one()

    try:
        max_m = await get_max_members(db, project["modality_id"], program_row["level"])
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Modalidad no encontrada"
        )

    if current_count >= max_m:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El proyecto ya alcanzó el límite de {max_m} integrantes",
        )

    # Insertar integrante
    insert_result = await db.execute(
        text(
            "INSERT INTO public.project_members (project_id, student_id)"
            " VALUES (:pid, :uid)"
            " RETURNING id, project_id, student_id, is_active, joined_at"
        ),
        {"pid": project_id, "uid": body.user_id},
    )
    row = dict(insert_result.mappings().first())
    await db.commit()

    # Enriquecer con datos del usuario
    user_result = await db.execute(
        text("SELECT full_name, email FROM public.users WHERE id = :id"),
        {"id": row["student_id"]},
    )
    user_row = user_result.mappings().first()
    row["full_name"] = user_row["full_name"]
    row["email"] = user_row["email"]
    return ProjectMemberInfo(**row)


# ---------------------------------------------------------------------------
# PATCH /projects/{id}/members/{member_id}/remove — Retiro de integrante
# ---------------------------------------------------------------------------

_MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024  # 20 MB


@router.patch(
    "/{project_id}/members/{member_id}/remove", response_model=ProjectMemberInfo
)
async def remove_member(
    project_id: UUID,
    member_id: UUID,
    reason: str = Form(...),
    attachment: UploadFile = File(...),
    current_user: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> ProjectMemberInfo:
    if not reason.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El motivo del retiro es obligatorio",
        )

    # Validar tipo y tamaño del adjunto
    if attachment.content_type not in ("application/pdf",):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El adjunto debe ser un archivo PDF",
        )

    file_bytes = await attachment.read()
    if len(file_bytes) > _MAX_ATTACHMENT_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El adjunto supera el límite de 20 MB",
        )

    # Verificar que el integrante existe en este proyecto y está activo
    member_result = await db.execute(
        text(
            "SELECT pm.id, pm.student_id, u.full_name,"
            " u.email, pm.is_active, pm.joined_at"
            " FROM public.project_members pm"
            " JOIN public.users u ON u.id = pm.student_id"
            " WHERE pm.id = :mid AND pm.project_id = :pid AND pm.is_active = true"
        ),
        {"mid": member_id, "pid": project_id},
    )
    member = member_result.mappings().first()
    if member is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Integrante no encontrado o ya retirado",
        )

    # Subir adjunto a Supabase Storage
    ts = int(datetime.now(timezone.utc).timestamp())
    storage_path = f"{project_id}/integrantes/{member_id}/retiro_{ts}.pdf"
    try:
        supabase_admin.storage.from_(settings.supabase_storage_bucket).upload(
            path=storage_path,
            file=file_bytes,
            file_options={"content-type": "application/pdf"},
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Error al subir el archivo a Storage: {exc}",
        )

    file_url = (
        f"{settings.supabase_url}/storage/v1/object"
        f"/{settings.supabase_storage_bucket}/{storage_path}"
    )

    # Marcar integrante como retirado
    await db.execute(
        text(
            "UPDATE public.project_members"
            " SET is_active = false, removed_at = now(),"
            "     removal_reason = :reason, removal_attachment_url = :url"
            " WHERE id = :mid"
        ),
        {"reason": reason.strip(), "url": file_url, "mid": member_id},
    )

    # Registrar en historial
    await db.execute(
        text(
            "INSERT INTO public.project_status_history"
            " (project_id, previous_status, new_status, changed_by, notes)"
            " SELECT :pid, status, status, :by, :notes"
            " FROM public.thesis_projects WHERE id = :pid"
        ),
        {
            "pid": project_id,
            "by": current_user.id,
            "notes": (
                f"Retiro de integrante: {member['full_name']},"
                f" motivo: {reason.strip()}"
            ),
        },
    )

    await db.commit()

    return ProjectMemberInfo(
        id=member["id"],
        student_id=member["student_id"],
        full_name=member["full_name"],
        email=member["email"],
        is_active=False,
        joined_at=member["joined_at"],
    )


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
            detail=(
                "Ya existe una ventana extemporánea activa"
                " para este proyecto y etapa"
            ),
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
