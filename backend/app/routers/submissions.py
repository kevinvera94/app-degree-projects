"""
Router de radicaciones (submissions) y sus adjuntos.

Rutas implementadas (T-F05-01):
  POST   /projects/{id}/submissions               — crear radicación (Estudiante)
  POST   /projects/{id}/submissions/{subId}/attachments — subir adjunto (Estudiante)
  GET    /projects/{id}/submissions/{subId}/attachments/{attId}
         — URL firmada (todos con pertenencia)
  DELETE /projects/{id}/submissions/{subId}/attachments/{attId}
         — eliminar adjunto (Estudiante, solo pendiente)
  PATCH  /projects/{id}/submissions/{subId}/confirm — confirmar radicación (Estudiante)

Extensión (T-F05-06):
  El mismo POST y PATCH/confirm manejan correcciones cuando body.is_correction=true.

Rutas de consulta (T-F05-09):
  GET    /projects/{id}/submissions               — historial de radicaciones
  GET    /projects/{id}/submissions/{subId}       — detalle con adjuntos
"""

import os
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import CurrentUser, get_current_user, require_estudiante
from app.core.supabase_client import supabase_admin
from app.schemas.submission import (
    REQUIRED_ATTACHMENTS_BASE,
    REQUIRED_ATTACHMENTS_CORRECTION,
    REQUIRED_ATTACHMENT_ETHICS,
    AttachmentResponse,
    AttachmentSignedURLResponse,
    AttachmentType,
    SubmissionCreate,
    SubmissionDetailResponse,
    SubmissionResponse,
)
from app.utils.business_days import add_business_days

router = APIRouter(prefix="/projects", tags=["submissions"])

_MAX_FILE_BYTES = 20 * 1024 * 1024  # 20 MB

_SELECT_SUB = (
    "id, project_id, stage, submitted_at, submitted_by, "
    "date_window_id, is_extemporaneous, revision_number, status"
)
_SELECT_ATT = (
    "id, submission_id, attachment_type, file_name, file_url, uploaded_at, uploaded_by"
)


# ---------------------------------------------------------------------------
# Helpers compartidos
# ---------------------------------------------------------------------------


async def _get_submission_or_404(
    sub_id: UUID, project_id: UUID, db: AsyncSession
) -> dict:
    result = await db.execute(
        text(
            f"SELECT {_SELECT_SUB} FROM public.submissions"
            " WHERE id = :sid AND project_id = :pid"
        ),
        {"sid": sub_id, "pid": project_id},
    )
    row = result.mappings().first()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Radicación no encontrada en este proyecto",
        )
    return dict(row)


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


def _extract_storage_path(file_url: str) -> str:
    """
    Extrae la ruta relativa dentro del bucket a partir del valor almacenado en file_url.
    Si el valor ya es un path relativo (no empieza con 'http'), lo devuelve tal cual.
    """
    prefix = (
        f"{settings.supabase_url}/storage/v1/object/{settings.supabase_storage_bucket}/"
    )
    if file_url.startswith(prefix):
        return file_url[len(prefix) :]
    return file_url


# ---------------------------------------------------------------------------
# GET /projects/{id}/submissions — Historial de radicaciones (T-F05-09)
# ---------------------------------------------------------------------------


@router.get("/{project_id}/submissions", response_model=list[SubmissionResponse])
async def list_submissions(
    project_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[SubmissionResponse]:
    await _check_membership(project_id, current_user, db)

    result = await db.execute(
        text(
            f"SELECT {_SELECT_SUB} FROM public.submissions"
            " WHERE project_id = :pid ORDER BY submitted_at DESC"
        ),
        {"pid": project_id},
    )
    return [SubmissionResponse(**row) for row in result.mappings()]


# ---------------------------------------------------------------------------
# POST /projects/{id}/submissions — Crear radicación (T-F05-01, Paso 1)
# ---------------------------------------------------------------------------


@router.post(
    "/{project_id}/submissions",
    response_model=SubmissionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_submission(
    project_id: UUID,
    body: SubmissionCreate,
    current_user: CurrentUser = Depends(require_estudiante),
    db: AsyncSession = Depends(get_db),
) -> SubmissionResponse:
    """
    Paso 1 de la radicación: crea el registro con status='pendiente'.
    - Sin is_correction: primera radicación de anteproyecto (estado idea_aprobada).
    - Con is_correction=true: entrega de correcciones (estado correcciones_anteproyecto_solicitadas).
    """
    from datetime import date as date_type

    # Validar pertenencia activa del estudiante
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

    # Obtener proyecto
    proj_result = await db.execute(
        text(
            "SELECT id, status, period, modality_id, title"
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

    today = date_type.today()

    # ------------------------------------------------------------------
    # Rama A: Entrega de correcciones (T-F05-06)
    # ------------------------------------------------------------------
    if body.is_correction:
        if project["status"] != "correcciones_anteproyecto_solicitadas":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Solo se pueden entregar correcciones cuando el estado es "
                    f"'correcciones_anteproyecto_solicitadas'. Estado actual: {project['status']}"
                ),
            )

        # Verificar que no exista ya una corrección activa
        existing_corr = await db.execute(
            text(
                "SELECT id FROM public.submissions"
                " WHERE project_id = :pid AND stage = 'correcciones_anteproyecto'"
                " AND status IN ('pendiente', 'en_revision') LIMIT 1"
            ),
            {"pid": project_id},
        )
        if existing_corr.mappings().first() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe una entrega de correcciones activa para este proyecto",
            )

        # Ventana activa O plazo de corrección no vencido
        global_window = await db.execute(
            text(
                "SELECT id FROM public.date_windows"
                " WHERE window_type = 'radicacion_anteproyecto' AND is_active = true"
                " AND start_date <= :today AND end_date >= :today LIMIT 1"
            ),
            {"today": today},
        )
        has_window = global_window.mappings().first() is not None

        if not has_window:
            # Calcular si el plazo de corrección (10 días hábiles) aún no venció
            hist_result = await db.execute(
                text(
                    "SELECT changed_at FROM public.project_status_history"
                    " WHERE project_id = :pid"
                    " AND new_status = 'correcciones_anteproyecto_solicitadas'"
                    " ORDER BY changed_at DESC LIMIT 1"
                ),
                {"pid": project_id},
            )
            hist_row = hist_result.mappings().first()
            deadline_passed = True
            if hist_row:
                correction_deadline = add_business_days(
                    hist_row["changed_at"].date(), 10, project["period"]
                )
                deadline_passed = today > correction_deadline

            if deadline_passed:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        "El plazo para entregar correcciones ha vencido y no hay ventana activa. "
                        "Podrás radicar cuando abra la siguiente ventana de fechas."
                    ),
                )

        sub_result = await db.execute(
            text(
                f"""
                INSERT INTO public.submissions
                    (project_id, stage, submitted_by, date_window_id,
                     is_extemporaneous, revision_number, status)
                VALUES
                    (:project_id, 'correcciones_anteproyecto', :submitted_by, NULL,
                     false, 2, 'pendiente')
                RETURNING {_SELECT_SUB}
                """
            ),
            {
                "project_id": project_id,
                "submitted_by": current_user.id,
            },
        )
        sub_row = sub_result.mappings().first()
        await db.commit()
        return SubmissionResponse(**sub_row)

    # ------------------------------------------------------------------
    # Rama B: Primera radicación de anteproyecto (T-F05-01)
    # ------------------------------------------------------------------
    if project["status"] != "idea_aprobada":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Solo se puede radicar el anteproyecto cuando la idea está aprobada. "
                f"Estado actual: {project['status']}"
            ),
        )

    # Verificar que no exista ya una radicación activa (pendiente/en_revision)
    # para esta etapa
    existing = await db.execute(
        text(
            "SELECT id FROM public.submissions"
            " WHERE project_id = :pid AND stage = 'anteproyecto'"
            " AND status IN ('pendiente', 'en_revision') LIMIT 1"
        ),
        {"pid": project_id},
    )
    if existing.mappings().first() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe una radicación de anteproyecto activa para este proyecto",
        )

    # Ventana global
    global_window = await db.execute(
        text(
            "SELECT id, period FROM public.date_windows"
            " WHERE window_type = 'radicacion_anteproyecto' AND is_active = true"
            " AND start_date <= :today AND end_date >= :today LIMIT 1"
        ),
        {"today": today},
    )
    global_row = global_window.mappings().first()

    # Ventana extemporánea individual
    ext_window = await db.execute(
        text(
            "SELECT id FROM public.extemporaneous_windows"
            " WHERE project_id = :pid AND stage = 'radicacion_anteproyecto'"
            " AND valid_until >= :today LIMIT 1"
        ),
        {"pid": project_id, "today": today},
    )
    ext_row = ext_window.mappings().first()

    if global_row is None and ext_row is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No hay una ventana de fechas activa para radicación de anteproyecto",  # noqa: E501
        )

    is_extemporaneous = global_row is None and ext_row is not None
    date_window_id: Optional[UUID] = None if is_extemporaneous else global_row["id"]

    sub_result = await db.execute(
        text(
            f"""
            INSERT INTO public.submissions
                (project_id, stage, submitted_by, date_window_id,
                 is_extemporaneous, revision_number, status)
            VALUES
                (:project_id, 'anteproyecto', :submitted_by, :date_window_id,
                 :is_extemporaneous, 1, 'pendiente')
            RETURNING {_SELECT_SUB}
            """
        ),
        {
            "project_id": project_id,
            "submitted_by": current_user.id,
            "date_window_id": date_window_id,
            "is_extemporaneous": is_extemporaneous,
        },
    )
    sub_row = sub_result.mappings().first()
    await db.commit()
    return SubmissionResponse(**sub_row)


# ---------------------------------------------------------------------------
# GET /projects/{id}/submissions/{sub_id} — Detalle (T-F05-09)
# ---------------------------------------------------------------------------


@router.get(
    "/{project_id}/submissions/{sub_id}",
    response_model=SubmissionDetailResponse,
)
async def get_submission(
    project_id: UUID,
    sub_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SubmissionDetailResponse:
    await _check_membership(project_id, current_user, db)
    sub = await _get_submission_or_404(sub_id, project_id, db)

    att_result = await db.execute(
        text(
            "SELECT id, submission_id, attachment_type,"
            " file_name, uploaded_at, uploaded_by"
            " FROM public.attachments WHERE submission_id = :sid ORDER BY uploaded_at"
        ),
        {"sid": sub_id},
    )
    attachments = [AttachmentResponse(**r) for r in att_result.mappings()]
    return SubmissionDetailResponse(**sub, attachments=attachments)


# ---------------------------------------------------------------------------
# POST /projects/{id}/submissions/{sub_id}/attachments
# Subir adjunto (T-F05-01, Paso 2)
# ---------------------------------------------------------------------------


@router.post(
    "/{project_id}/submissions/{sub_id}/attachments",
    response_model=AttachmentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_attachment(
    project_id: UUID,
    sub_id: UUID,
    attachment_type: AttachmentType = Form(...),
    file: UploadFile = File(...),
    current_user: CurrentUser = Depends(require_estudiante),
    db: AsyncSession = Depends(get_db),
) -> AttachmentResponse:
    """Sube un adjunto a una radicación en estado 'pendiente'."""
    # Validar pertenencia
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

    sub = await _get_submission_or_404(sub_id, project_id, db)
    if sub["status"] != "pendiente":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Solo se pueden agregar adjuntos"
                " a una radicación en estado 'pendiente'"
            ),
        )

    # Validar tipo MIME (solo PDF)
    allowed_types = {"application/pdf"}
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El adjunto debe ser un archivo PDF",
        )

    file_bytes = await file.read()
    if len(file_bytes) > _MAX_FILE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El adjunto supera el límite de 20 MB",
        )

    ts = int(datetime.now(timezone.utc).timestamp())
    ext = os.path.splitext(file.filename or "")[-1] or ".pdf"
    storage_path = (
        f"submissions/{project_id}/{sub_id}/{attachment_type.value}_{ts}{ext}"
    )

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

    # Guardar registro (file_url = ruta relativa al bucket para generar URLs firmadas)
    att_result = await db.execute(
        text(
            f"""
            INSERT INTO public.attachments
                (submission_id, attachment_type, file_name, file_url, uploaded_by)
            VALUES
                (:sub_id, :att_type, :file_name, :file_url, :uploaded_by)
            RETURNING {_SELECT_ATT}
            """
        ),
        {
            "sub_id": sub_id,
            "att_type": attachment_type.value,
            "file_name": file.filename or f"{attachment_type.value}{ext}",
            "file_url": storage_path,
            "uploaded_by": current_user.id,
        },
    )
    att_row = att_result.mappings().first()
    await db.commit()
    return AttachmentResponse(**{k: v for k, v in att_row.items() if k != "file_url"})


# ---------------------------------------------------------------------------
# GET /projects/{id}/submissions/{sub_id}/attachments/{att_id} — URL firmada (T-F05-01)
# ---------------------------------------------------------------------------


@router.get(
    "/{project_id}/submissions/{sub_id}/attachments/{att_id}",
    response_model=AttachmentSignedURLResponse,
)
async def get_attachment_signed_url(
    project_id: UUID,
    sub_id: UUID,
    att_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AttachmentSignedURLResponse:
    """Genera una URL firmada (TTL 1h) para descargar el adjunto."""
    await _check_membership(project_id, current_user, db)
    await _get_submission_or_404(sub_id, project_id, db)

    att_result = await db.execute(
        text(
            f"SELECT {_SELECT_ATT} FROM public.attachments"
            " WHERE id = :aid AND submission_id = :sid"
        ),
        {"aid": att_id, "sid": sub_id},
    )
    att = att_result.mappings().first()
    if att is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Adjunto no encontrado",
        )

    storage_path = _extract_storage_path(att["file_url"])
    try:
        signed_response = supabase_admin.storage.from_(
            settings.supabase_storage_bucket
        ).create_signed_url(storage_path, 3600)
        # supabase-py v2 returns an object with signed_url attribute
        signed_url: str = getattr(
            signed_response, "signed_url", None
        ) or signed_response.get("signedURL", "")
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Error al generar URL firmada: {exc}",
        )

    return AttachmentSignedURLResponse(
        id=att["id"],
        submission_id=att["submission_id"],
        attachment_type=att["attachment_type"],
        file_name=att["file_name"],
        uploaded_at=att["uploaded_at"],
        uploaded_by=att["uploaded_by"],
        signed_url=signed_url,
    )


# ---------------------------------------------------------------------------
# DELETE /projects/{id}/submissions/{sub_id}/attachments/{att_id}
# Eliminar adjunto (T-F05-01)
# ---------------------------------------------------------------------------


@router.delete(
    "/{project_id}/submissions/{sub_id}/attachments/{att_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_attachment(
    project_id: UUID,
    sub_id: UUID,
    att_id: UUID,
    current_user: CurrentUser = Depends(require_estudiante),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Elimina un adjunto solo si la radicación está en estado 'pendiente'."""
    # Validar pertenencia
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

    sub = await _get_submission_or_404(sub_id, project_id, db)
    if sub["status"] != "pendiente":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se pueden eliminar adjuntos de una radicación ya confirmada",
        )

    att_result = await db.execute(
        text(
            "SELECT id, file_url FROM public.attachments"
            " WHERE id = :aid AND submission_id = :sid"
        ),
        {"aid": att_id, "sid": sub_id},
    )
    att = att_result.mappings().first()
    if att is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Adjunto no encontrado",
        )

    # Eliminar del Storage
    storage_path = _extract_storage_path(att["file_url"])
    try:
        supabase_admin.storage.from_(settings.supabase_storage_bucket).remove(
            [storage_path]
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Error al eliminar el archivo de Storage: {exc}",
        )

    await db.execute(
        text("DELETE FROM public.attachments WHERE id = :aid"),
        {"aid": att_id},
    )
    await db.commit()


# ---------------------------------------------------------------------------
# PATCH /projects/{id}/submissions/{sub_id}/confirm
# Confirmar radicación (T-F05-01, Paso 3)
# ---------------------------------------------------------------------------


@router.patch(
    "/{project_id}/submissions/{sub_id}/confirm",
    response_model=SubmissionResponse,
)
async def confirm_submission(
    project_id: UUID,
    sub_id: UUID,
    current_user: CurrentUser = Depends(require_estudiante),
    db: AsyncSession = Depends(get_db),
) -> SubmissionResponse:
    """
    Confirma la radicación. Maneja dos flujos según la etapa:
    - 'anteproyecto': primera radicación → anteproyecto_pendiente_evaluacion
    - 'correcciones_anteproyecto': correcciones → anteproyecto_corregido_entregado
                                   + nuevos registros evaluations revision_number=2
    """
    # Validar pertenencia activa
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

    sub = await _get_submission_or_404(sub_id, project_id, db)
    if sub["status"] != "pendiente":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Solo se puede confirmar una radicación en estado 'pendiente'",
        )

    # Obtener proyecto y modalidad
    proj_result = await db.execute(
        text(
            "SELECT p.id, p.status, p.title, p.period, m.requires_ethics_approval"
            " FROM public.thesis_projects p"
            " JOIN public.modalities m ON m.id = p.modality_id"
            " WHERE p.id = :id"
        ),
        {"id": project_id},
    )
    project = proj_result.mappings().first()
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trabajo de grado no encontrado",
        )

    # Obtener adjuntos presentes
    att_result = await db.execute(
        text("SELECT attachment_type FROM public.attachments WHERE submission_id = :sid"),
        {"sid": sub_id},
    )
    present_types = {row["attachment_type"] for row in att_result.mappings()}

    is_correction = sub["stage"] == "correcciones_anteproyecto"

    # Validar adjuntos obligatorios según el tipo de radicación
    if is_correction:
        required = set(REQUIRED_ATTACHMENTS_CORRECTION)
    else:
        required = set(REQUIRED_ATTACHMENTS_BASE)
        if project["requires_ethics_approval"]:
            required.add(REQUIRED_ATTACHMENT_ETHICS)

    missing = [t.value for t in required if t.value not in present_types]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "Faltan adjuntos obligatorios para confirmar la radicación",
                "missing": sorted(missing),
            },
        )

    prev_status = project["status"]

    # Actualizar submission
    updated_sub = await db.execute(
        text(
            f"UPDATE public.submissions SET status = 'en_revision'"
            f" WHERE id = :sid RETURNING {_SELECT_SUB}"
        ),
        {"sid": sub_id},
    )
    sub_row = updated_sub.mappings().first()

    if is_correction:
        # ------------------------------------------------------------------
        # Flujo correcciones (T-F05-06)
        # ------------------------------------------------------------------
        from datetime import datetime as _dt, timezone as _tz

        now = _dt.now(_tz.utc)
        new_due = add_business_days(now.date(), 10, project["period"])
        due_str = new_due.strftime("%d/%m/%Y")

        # Cambiar estado del proyecto
        await db.execute(
            text(
                "UPDATE public.thesis_projects"
                " SET status = 'anteproyecto_corregido_entregado', updated_at = now()"
                " WHERE id = :pid"
            ),
            {"pid": project_id},
        )
        await db.execute(
            text(
                "INSERT INTO public.project_status_history"
                " (project_id, previous_status, new_status, changed_by, notes)"
                " VALUES (:pid, :prev, 'anteproyecto_corregido_entregado', :by, :notes)"
            ),
            {
                "pid": project_id,
                "prev": prev_status,
                "by": current_user.id,
                "notes": f"Correcciones entregadas por el estudiante. Nuevo plazo de evaluación: {due_str}",
            },
        )

        # Obtener jurados activos J1 y J2 para crear evaluations revision_number=2
        jurors_result = await db.execute(
            text(
                "SELECT pj.docente_id, pj.juror_number"
                " FROM public.project_jurors pj"
                " WHERE pj.project_id = :pid AND pj.stage = 'anteproyecto'"
                " AND pj.juror_number IN (1, 2) AND pj.is_active = true"
            ),
            {"pid": project_id},
        )
        jurors = list(jurors_result.mappings())

        for j in jurors:
            await db.execute(
                text(
                    """
                    INSERT INTO public.evaluations
                        (project_id, submission_id, juror_id, juror_number, stage,
                         start_date, due_date, revision_number)
                    VALUES
                        (:project_id, :submission_id, :juror_id, :juror_number,
                         'anteproyecto', :start_date, :due_date, 2)
                    """
                ),
                {
                    "project_id": project_id,
                    "submission_id": sub_id,
                    "juror_id": j["docente_id"],
                    "juror_number": j["juror_number"],
                    "start_date": now,
                    "due_date": new_due,
                },
            )
            # Mensaje individual a cada jurado
            await db.execute(
                text(
                    "INSERT INTO public.messages"
                    " (project_id, sender_id, recipient_id, content, sender_display)"
                    " VALUES (:pid, :sid, :rid, :content, 'Sistema')"
                ),
                {
                    "pid": project_id,
                    "sid": current_user.id,
                    "rid": j["docente_id"],
                    "content": (
                        f"El estudiante entregó correcciones del anteproyecto "
                        f"'{project['title']}'. Plazo de evaluación: {due_str}"
                    ),
                },
            )

    else:
        # ------------------------------------------------------------------
        # Flujo primera radicación (T-F05-01)
        # ------------------------------------------------------------------
        await db.execute(
            text(
                "UPDATE public.thesis_projects"
                " SET status = 'anteproyecto_pendiente_evaluacion', updated_at = now()"
                " WHERE id = :pid"
            ),
            {"pid": project_id},
        )
        await db.execute(
            text(
                "INSERT INTO public.project_status_history"
                " (project_id, previous_status, new_status, changed_by, notes)"
                " VALUES (:pid, :prev, 'anteproyecto_pendiente_evaluacion', :by, :notes)"
            ),
            {
                "pid": project_id,
                "prev": prev_status,
                "by": current_user.id,
                "notes": "Anteproyecto radicado y confirmado por el estudiante",
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
                "content": f"Nuevo anteproyecto radicado: {project['title']}",
            },
        )

    await db.commit()
    return SubmissionResponse(**sub_row)
