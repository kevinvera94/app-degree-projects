"""
Servicio de evaluación del anteproyecto.

Función principal: evaluate_anteproyecto_result
  — Se ejecuta automáticamente cuando J1 y J2 han registrado sus calificaciones.
  — Determina el resultado, transiciona el estado del proyecto y envía mensajes.

Reglas de negocio (Resolución 004/2025 + BRIEF.md):
  Ambas ≥ 4.0              → anteproyecto_aprobado → en_desarrollo
  Ambas < 3.0              → anteproyecto_reprobado → idea_aprobada
  Una ≥ 4.0 y otra < 3.0  → divergencia → notifica Admin, espera Jurado 3
  Cualquier otro caso      → correcciones_anteproyecto_solicitadas (≥ 3.0 y < 4.0)
"""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.utils.business_days import add_business_days

# UUID ficticio de "Sistema" para registros automáticos en historial
_SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000"


async def _get_active_member(project_id: UUID, db: AsyncSession) -> UUID:
    """Retorna el student_id del primer integrante activo (para mensajes broadcast)."""
    result = await db.execute(
        text(
            "SELECT student_id FROM public.project_members"
            " WHERE project_id = :pid AND is_active = true"
            " ORDER BY joined_at LIMIT 1"
        ),
        {"pid": project_id},
    )
    row = result.mappings().first()
    return row["student_id"] if row else None


async def _send_message(
    project_id: UUID,
    sender_id: UUID,
    recipient_id,  # UUID | None
    content: str,
    db: AsyncSession,
) -> None:
    await db.execute(
        text(
            "INSERT INTO public.messages"
            " (project_id, sender_id, recipient_id, content, sender_display)"
            " VALUES (:pid, :sid, :rid, :content, 'Sistema')"
        ),
        {
            "pid": project_id,
            "sid": sender_id,
            "rid": recipient_id,
            "content": content,
        },
    )


async def _record_history(
    project_id: UUID,
    prev_status: str,
    new_status: str,
    changed_by: UUID,
    notes: str,
    db: AsyncSession,
) -> None:
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
            "by": changed_by,
            "notes": notes,
        },
    )


async def _update_project_status(
    project_id: UUID, new_status: str, db: AsyncSession
) -> None:
    await db.execute(
        text(
            "UPDATE public.thesis_projects"
            " SET status = :new_status, updated_at = now()"
            " WHERE id = :pid"
        ),
        {"new_status": new_status, "pid": project_id},
    )


async def _update_submission_status(
    project_id: UUID, stage: str, revision_number: int, new_status: str, db: AsyncSession
) -> None:
    await db.execute(
        text(
            "UPDATE public.submissions SET status = :new_status"
            " WHERE project_id = :pid AND stage = :stage"
            " AND revision_number = :rev AND status = 'en_revision'"
        ),
        {
            "new_status": new_status,
            "pid": project_id,
            "stage": stage,
            "rev": revision_number,
        },
    )


async def evaluate_j3_result(
    project_id: UUID,
    db: AsyncSession,
    triggered_by: UUID,
    revision_number: int = 1,
) -> None:
    """
    Evalúa el resultado del Jurado 3 (tiebreaker por divergencia).
    J3 solo puede aprobar (≥ 4.0) o reprobar (< 3.0) — la validación de rango
    la hace el endpoint antes de llamar a esta función.
    """
    proj_result = await db.execute(
        text("SELECT id, status, period, title FROM public.thesis_projects WHERE id = :id"),
        {"id": project_id},
    )
    project = proj_result.mappings().first()
    if project is None:
        return

    prev_status = project["status"]

    # Obtener calificación de J3
    j3_result = await db.execute(
        text(
            "SELECT score FROM public.evaluations"
            " WHERE project_id = :pid AND stage = 'anteproyecto'"
            " AND juror_number = 3 AND revision_number = :rev AND score IS NOT NULL"
            " ORDER BY submitted_at DESC LIMIT 1"
        ),
        {"pid": project_id, "rev": revision_number},
    )
    j3_row = j3_result.mappings().first()
    if j3_row is None:
        return

    score = j3_row["score"]

    if score >= 4.0:
        # J3 aprueba → anteproyecto_aprobado → en_desarrollo
        await _update_project_status(project_id, "anteproyecto_aprobado", db)
        await _record_history(
            project_id, prev_status, "anteproyecto_aprobado",
            triggered_by,
            f"Anteproyecto aprobado por Jurado 3. Calificación: {score}",
            db,
        )
        await _update_project_status(project_id, "en_desarrollo", db)
        await _record_history(
            project_id, "anteproyecto_aprobado", "en_desarrollo",
            triggered_by,
            "Transición automática: anteproyecto aprobado → en desarrollo",
            db,
        )
        await _update_submission_status(project_id, "anteproyecto", revision_number, "aprobado", db)
        await _send_message(
            project_id, triggered_by, None,
            "Tu anteproyecto fue aprobado. Estado: En desarrollo.",
            db,
        )
    else:
        # J3 reprueba → anteproyecto_reprobado → idea_aprobada
        await _update_project_status(project_id, "anteproyecto_reprobado", db)
        await _record_history(
            project_id, prev_status, "anteproyecto_reprobado",
            triggered_by,
            f"Anteproyecto reprobado por Jurado 3. Calificación: {score}",
            db,
        )
        await _update_project_status(project_id, "idea_aprobada", db)
        await _record_history(
            project_id, "anteproyecto_reprobado", "idea_aprobada",
            triggered_by,
            "Retorno automático a idea aprobada. El estudiante puede radicar un nuevo anteproyecto.",
            db,
        )
        await _update_submission_status(project_id, "anteproyecto", revision_number, "reprobado", db)
        await _send_message(
            project_id, triggered_by, None,
            "Tu anteproyecto fue reprobado. Puedes radicar uno nuevo.",
            db,
        )


async def evaluate_anteproyecto_result(
    project_id: UUID,
    db: AsyncSession,
    triggered_by: UUID,
    revision_number: int = 1,
) -> None:
    """
    Evalúa el resultado del anteproyecto cuando J1 y J2 han calificado.
    Debe llamarse SIN commit previo — opera dentro de la misma transacción.
    """
    # Obtener proyecto
    proj_result = await db.execute(
        text("SELECT id, status, period, title FROM public.thesis_projects WHERE id = :id"),
        {"id": project_id},
    )
    project = proj_result.mappings().first()
    if project is None:
        return

    prev_status = project["status"]

    # Obtener calificaciones de J1 y J2 para esta revisión
    evals_result = await db.execute(
        text(
            "SELECT e.juror_number, e.score"
            " FROM public.evaluations e"
            " WHERE e.project_id = :pid AND e.stage = 'anteproyecto'"
            " AND e.revision_number = :rev AND e.juror_number IN (1, 2)"
            " AND e.score IS NOT NULL"
        ),
        {"pid": project_id, "rev": revision_number},
    )
    scored = {row["juror_number"]: row["score"] for row in evals_result.mappings()}

    # Solo proceder cuando ambos jurados han calificado
    if len(scored) < 2:
        return

    s1 = scored.get(1)
    s2 = scored.get(2)

    # -----------------------------------------------------------------------
    # Caso 1: Ambas ≥ 4.0 → Aprobado
    # -----------------------------------------------------------------------
    if s1 >= 4.0 and s2 >= 4.0:
        # anteproyecto_aprobado (intermedio) → en_desarrollo (automático)
        await _update_project_status(project_id, "anteproyecto_aprobado", db)
        await _record_history(
            project_id, prev_status, "anteproyecto_aprobado",
            triggered_by,
            f"Anteproyecto aprobado. Calificaciones: J1={s1}, J2={s2}",
            db,
        )
        await _update_project_status(project_id, "en_desarrollo", db)
        await _record_history(
            project_id, "anteproyecto_aprobado", "en_desarrollo",
            triggered_by,
            "Transición automática: anteproyecto aprobado → en desarrollo",
            db,
        )
        await _update_submission_status(project_id, "anteproyecto", revision_number, "aprobado", db)

        await _send_message(
            project_id, triggered_by, None,
            "Tu anteproyecto fue aprobado. Estado: En desarrollo.",
            db,
        )
        return

    # -----------------------------------------------------------------------
    # Caso 2: Ambas < 3.0 → Reprobado → retorna a idea_aprobada
    # -----------------------------------------------------------------------
    if s1 < 3.0 and s2 < 3.0:
        await _update_project_status(project_id, "anteproyecto_reprobado", db)
        await _record_history(
            project_id, prev_status, "anteproyecto_reprobado",
            triggered_by,
            f"Anteproyecto reprobado. Calificaciones: J1={s1}, J2={s2}",
            db,
        )
        await _update_project_status(project_id, "idea_aprobada", db)
        await _record_history(
            project_id, "anteproyecto_reprobado", "idea_aprobada",
            triggered_by,
            "Retorno automático a idea aprobada. El estudiante puede radicar un nuevo anteproyecto.",
            db,
        )
        await _update_submission_status(project_id, "anteproyecto", revision_number, "reprobado", db)

        await _send_message(
            project_id, triggered_by, None,
            "Tu anteproyecto fue reprobado. Puedes radicar uno nuevo.",
            db,
        )
        return

    # -----------------------------------------------------------------------
    # Caso 3: Una ≥ 4.0 y la otra < 3.0 → Divergencia → Jurado 3
    # -----------------------------------------------------------------------
    if (s1 >= 4.0 and s2 < 3.0) or (s1 < 3.0 and s2 >= 4.0):
        # El proyecto permanece en anteproyecto_pendiente_evaluacion
        # Notificar al Administrador
        await _send_message(
            project_id, triggered_by, None,
            (
                f"Divergencia en evaluación del anteproyecto '{project['title']}'. "
                f"Calificaciones: J1={s1}, J2={s2}. "
                "Se requiere asignar Jurado 3."
            ),
            db,
        )
        # Registrar nota en historial sin cambiar estado
        await _record_history(
            project_id, prev_status, prev_status,
            triggered_by,
            f"Divergencia detectada: J1={s1}, J2={s2}. Pendiente asignación de Jurado 3.",
            db,
        )
        return

    # -----------------------------------------------------------------------
    # Caso 4: Cualquier otro caso (alguna entre 3.0 y 3.9) → Correcciones
    # Guard (T-F05-08): en segunda revisión no hay correcciones — el endpoint
    # ya rechaza [3.0, 4.0) con 400, pero si llegara aquí se trata como reprobado.
    # -----------------------------------------------------------------------
    if revision_number == 2:
        await _update_project_status(project_id, "anteproyecto_reprobado", db)
        await _record_history(
            project_id, prev_status, "anteproyecto_reprobado",
            triggered_by,
            f"Anteproyecto reprobado en segunda revisión. Calificaciones: J1={s1}, J2={s2}",
            db,
        )
        await _update_project_status(project_id, "idea_aprobada", db)
        await _record_history(
            project_id, "anteproyecto_reprobado", "idea_aprobada",
            triggered_by,
            "Retorno automático a idea aprobada. El estudiante puede radicar un nuevo anteproyecto.",
            db,
        )
        await _update_submission_status(project_id, "anteproyecto", revision_number, "reprobado", db)
        await _send_message(
            project_id, triggered_by, None,
            "Tu anteproyecto fue reprobado en segunda revisión. Puedes radicar uno nuevo.",
            db,
        )
        return

    now = datetime.now(timezone.utc)
    correction_due = add_business_days(now.date(), 10, project["period"])
    due_str = correction_due.strftime("%d/%m/%Y")

    await _update_project_status(project_id, "correcciones_anteproyecto_solicitadas", db)
    await _record_history(
        project_id, prev_status, "correcciones_anteproyecto_solicitadas",
        triggered_by,
        (
            f"Correcciones solicitadas. Calificaciones: J1={s1}, J2={s2}. "
            f"Plazo para entrega de correcciones: {due_str}"
        ),
        db,
    )
    await _update_submission_status(project_id, "anteproyecto", revision_number, "con_correcciones", db)

    await _send_message(
        project_id, triggered_by, None,
        f"Tienes correcciones pendientes. Plazo: {due_str}. Ver evaluaciones.",
        db,
    )
