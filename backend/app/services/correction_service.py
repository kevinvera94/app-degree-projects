"""
Servicio de validación de ventanas de corrección.

Centraliza la lógica de negocio que determina si un estudiante puede
entregar correcciones del anteproyecto en un momento dado.

Reglas (Resolución 004/2025, Art. RF-07-04, RF-07-05):
  - El estudiante tiene 10 días hábiles desde la solicitud de correcciones.
  - Si el plazo no ha vencido → puede entregar (aunque no haya ventana abierta).
  - Si el plazo venció Y hay ventana global activa → puede entregar.
  - Si el plazo venció Y no hay ventana activa → bloqueado (409).
  - El estado NO cambia automáticamente al vencer el plazo (no hay cron job en MVP).
    La restricción se aplica solo en el momento de intentar radicar.
"""

from datetime import date
from typing import Optional
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.utils.business_days import add_business_days

_CORRECTION_DEADLINE_DAYS = 10


async def check_correction_window(
    project_id: UUID,
    project_period: str,
    db: AsyncSession,
) -> None:
    """
    Valida si el estudiante puede entregar correcciones ahora mismo.
    Lanza ValueError con mensaje explicativo si no puede.
    El endpoint convierte ValueError a HTTPException 409.

    Lógica:
      1. ¿Hay ventana global activa para radicacion_anteproyecto? → permitido.
      2. ¿El plazo de 10 días hábiles desde la solicitud de correcciones no ha vencido?
         (calculado desde project_status_history) → permitido.
      3. Ninguna de las anteriores → bloqueado.
    """
    today = date.today()

    # 1. Ventana global activa
    window_result = await db.execute(
        text(
            "SELECT id FROM public.date_windows"
            " WHERE window_type = 'radicacion_anteproyecto'"
            " AND is_active = true"
            " AND start_date <= :today AND end_date >= :today"
            " LIMIT 1"
        ),
        {"today": today},
    )
    if window_result.mappings().first() is not None:
        return  # Ventana activa → permitido

    # 2. Verificar si el plazo de corrección no ha vencido
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

    if hist_row is not None:
        correction_deadline = add_business_days(
            hist_row["changed_at"].date(),
            _CORRECTION_DEADLINE_DAYS,
            project_period,
        )
        if today <= correction_deadline:
            return  # Plazo vigente → permitido

    # 3. Plazo vencido y sin ventana activa → bloqueado
    raise ValueError(
        "El plazo para entregar correcciones ha vencido y no hay ventana de fechas activa. "
        "Podrás radicar cuando abra la siguiente ventana de radicación de anteproyecto."
    )


async def correction_deadline_date(
    project_id: UUID,
    project_period: str,
    db: AsyncSession,
) -> Optional[date]:
    """
    Retorna la fecha límite de entrega de correcciones, o None si no hay registro.
    Útil para mostrar el plazo al estudiante en el frontend.
    """
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
    if hist_row is None:
        return None
    return add_business_days(
        hist_row["changed_at"].date(),
        _CORRECTION_DEADLINE_DAYS,
        project_period,
    )
