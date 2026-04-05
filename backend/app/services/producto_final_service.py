"""
Servicio de evaluación del producto final.

Función principal: evaluate_producto_final_result
  — Se ejecuta automáticamente cuando J1 y J2 han registrado sus calificaciones.
  — Determina el resultado, transiciona el estado del proyecto y envía mensajes.

Reglas de negocio (Resolución 004/2025 + BRIEF.md):
  Ambas ≥ 4.0              → aprobado_para_sustentacion
                            (Diplomado: modality.requires_sustentation=false → trabajo_aprobado directamente)
  Ambas entre 3.0 y 3.9   → correcciones_producto_final_solicitadas (plazo 10 días hábiles)
  Ambas < 3.0              → producto_final_reprobado → en_desarrollo (conserva integrantes)
  Una ≥ 4.0 y otra < 3.0  → divergencia → notifica Admin, espera Jurado 3

evaluate_j3_producto_final_result:
  score ≥ 4.0 → aprobado_para_sustentacion (o trabajo_aprobado para Diplomado)
  score < 3.0 → producto_final_reprobado → en_desarrollo
"""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.notifications import send_system_message
from app.utils.business_days import add_business_days


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
        {"pid": project_id, "prev": prev_status, "new": new_status, "by": changed_by, "notes": notes},
    )


async def _update_project_status(
    project_id: UUID, new_status: str, db: AsyncSession
) -> None:
    await db.execute(
        text(
            "UPDATE public.thesis_projects"
            " SET status = :new_status, updated_at = now() WHERE id = :pid"
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
        {"new_status": new_status, "pid": project_id, "stage": stage, "rev": revision_number},
    )


async def _is_diplomado(project_id: UUID, db: AsyncSession) -> bool:
    """Retorna True si la modalidad del proyecto no requiere sustentación (Diplomado tecnológico)."""
    result = await db.execute(
        text(
            "SELECT m.requires_sustentation"
            " FROM public.thesis_projects p"
            " JOIN public.modalities m ON m.id = p.modality_id"
            " WHERE p.id = :pid"
        ),
        {"pid": project_id},
    )
    row = result.mappings().first()
    return row is not None and not row["requires_sustentation"]


async def _approved_transition(
    project_id: UUID,
    prev_status: str,
    revision_number: int,
    triggered_by: UUID,
    stage: str,
    score_note: str,
    db: AsyncSession,
) -> None:
    """
    Transición aprobado: aprobado_para_sustentacion o trabajo_aprobado (Diplomado).
    Nota: no existe estado intermedio 'producto_final_aprobado' en el enum,
    la transición es directa desde el estado actual al estado final.
    """
    diplomado = await _is_diplomado(project_id, db)
    final_status = "trabajo_aprobado" if diplomado else "aprobado_para_sustentacion"

    await _update_project_status(project_id, final_status, db)
    await _record_history(
        project_id, prev_status, final_status, triggered_by,
        f"Producto final aprobado. {score_note}."
        + (" Diplomado tecnológico: omite sustentación." if diplomado else " Procede a sustentación."),
        db,
    )
    await _update_submission_status(project_id, stage, revision_number, "aprobado", db)

    msg = "Tu producto final fue aprobado. "
    msg += "Trabajo aprobado (Diplomado)." if diplomado else "Procede a sustentación."
    await send_system_message(db, project_id, triggered_by, None, msg)


async def _reprobado_transition(
    project_id: UUID,
    prev_status: str,
    revision_number: int,
    triggered_by: UUID,
    stage: str,
    score_note: str,
    db: AsyncSession,
) -> None:
    """
    Transición reprobado: producto_final_reprobado → en_desarrollo (conserva integrantes).
    """
    await _update_project_status(project_id, "producto_final_reprobado", db)
    await _record_history(
        project_id, prev_status, "producto_final_reprobado", triggered_by,
        f"Producto final reprobado. {score_note}",
        db,
    )
    await _update_project_status(project_id, "en_desarrollo", db)
    await _record_history(
        project_id, "producto_final_reprobado", "en_desarrollo", triggered_by,
        "Retorno automático a en_desarrollo. El estudiante puede radicar un nuevo producto final.",
        db,
    )
    await _update_submission_status(project_id, stage, revision_number, "reprobado", db)
    await send_system_message(
        db, project_id, triggered_by, None,
        "Tu producto final fue reprobado. Puedes radicar uno nuevo en la siguiente ventana.",
    )


async def evaluate_j3_producto_final_result(
    project_id: UUID,
    db: AsyncSession,
    triggered_by: UUID,
    revision_number: int = 1,
) -> None:
    """
    Evalúa el resultado del Jurado 3 para producto_final.
    J3 solo puede aprobar (≥ 4.0) o reprobar (< 3.0) — el endpoint ya valida.
    """
    proj_result = await db.execute(
        text("SELECT id, status, period, title FROM public.thesis_projects WHERE id = :id"),
        {"id": project_id},
    )
    project = proj_result.mappings().first()
    if project is None:
        return

    prev_status = project["status"]
    stage = "correcciones_producto_final" if revision_number > 1 else "producto_final"

    j3_result = await db.execute(
        text(
            "SELECT score FROM public.evaluations"
            " WHERE project_id = :pid AND stage = 'producto_final'"
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
        await _approved_transition(
            project_id, prev_status, revision_number, triggered_by, stage,
            f"Jurado 3 aprueba. Calificación: {score}", db,
        )
    else:
        await _reprobado_transition(
            project_id, prev_status, revision_number, triggered_by, stage,
            f"Jurado 3 reprueba. Calificación: {score}", db,
        )


async def evaluate_producto_final_result(
    project_id: UUID,
    db: AsyncSession,
    triggered_by: UUID,
    revision_number: int = 1,
) -> None:
    """
    Evalúa el resultado del producto final cuando J1 y J2 han calificado.
    Debe llamarse SIN commit previo — opera dentro de la misma transacción.
    La etapa evaluada puede ser 'producto_final' (rev=1) o 'correcciones_producto_final' (rev=2).
    """
    proj_result = await db.execute(
        text("SELECT id, status, period, title FROM public.thesis_projects WHERE id = :id"),
        {"id": project_id},
    )
    project = proj_result.mappings().first()
    if project is None:
        return

    prev_status = project["status"]
    # La etapa en evaluations puede ser producto_final o correcciones_producto_final
    stage = "correcciones_producto_final" if revision_number > 1 else "producto_final"

    evals_result = await db.execute(
        text(
            "SELECT juror_number, score FROM public.evaluations"
            " WHERE project_id = :pid AND stage = 'producto_final'"
            " AND revision_number = :rev AND juror_number IN (1, 2) AND score IS NOT NULL"
        ),
        {"pid": project_id, "rev": revision_number},
    )
    scored = {row["juror_number"]: row["score"] for row in evals_result.mappings()}

    if len(scored) < 2:
        return

    s1 = scored.get(1)
    s2 = scored.get(2)

    # -----------------------------------------------------------------------
    # Caso 1: Ambas ≥ 4.0 → Aprobado (con bifurcación Diplomado)
    # -----------------------------------------------------------------------
    if s1 >= 4.0 and s2 >= 4.0:
        await _approved_transition(
            project_id, prev_status, revision_number, triggered_by, stage,
            f"Calificaciones: J1={s1}, J2={s2}", db,
        )
        return

    # -----------------------------------------------------------------------
    # Caso 2: Ambas < 3.0 → Reprobado → en_desarrollo
    # -----------------------------------------------------------------------
    if s1 < 3.0 and s2 < 3.0:
        await _reprobado_transition(
            project_id, prev_status, revision_number, triggered_by, stage,
            f"Calificaciones: J1={s1}, J2={s2}", db,
        )
        return

    # -----------------------------------------------------------------------
    # Caso 3: Una ≥ 4.0 y la otra < 3.0 → Divergencia → Jurado 3
    # -----------------------------------------------------------------------
    if (s1 >= 4.0 and s2 < 3.0) or (s1 < 3.0 and s2 >= 4.0):
        await send_system_message(
            db, project_id, triggered_by, None,
            (
                f"Divergencia en evaluación del producto final '{project['title']}'. "
                f"Calificaciones: J1={s1}, J2={s2}. Se requiere asignar Jurado 3."
            ),
        )
        await _record_history(
            project_id, prev_status, prev_status, triggered_by,
            f"Divergencia detectada en producto final: J1={s1}, J2={s2}. Pendiente Jurado 3.",
            db,
        )
        return

    # -----------------------------------------------------------------------
    # Caso 4: Alguna entre 3.0 y 3.9 → Correcciones (solo en rev=1)
    # Guard: en rev=2 el endpoint ya rechaza [3.0, 4.0), pero si llega → reprobado
    # -----------------------------------------------------------------------
    if revision_number == 2:
        await _reprobado_transition(
            project_id, prev_status, revision_number, triggered_by, stage,
            f"Segunda revisión — puntuación inválida detectada: J1={s1}, J2={s2}",
            db,
        )
        return

    now = datetime.now(timezone.utc)
    correction_due = add_business_days(now.date(), 10, project["period"])
    due_str = correction_due.strftime("%d/%m/%Y")

    await _update_project_status(project_id, "correcciones_producto_final_solicitadas", db)
    await _record_history(
        project_id, prev_status, "correcciones_producto_final_solicitadas", triggered_by,
        f"Correcciones solicitadas. Calificaciones: J1={s1}, J2={s2}. Plazo: {due_str}",
        db,
    )
    await _update_submission_status(project_id, stage, revision_number, "con_correcciones", db)
    await send_system_message(
        db, project_id, triggered_by, None,
        f"Tienes correcciones pendientes en el producto final. Plazo: {due_str}. Ver evaluaciones.",
    )
