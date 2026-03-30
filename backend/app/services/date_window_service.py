"""
Servicios de lógica de negocio para ventanas de fechas.
"""

from datetime import date
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def is_window_active(
    window_type: str,
    db: AsyncSession,
    project_id: UUID | None = None,
) -> bool:
    """
    Verifica si hay una ventana activa para un tipo de radicación dado.

    Orden de verificación:
    1. Si se proporciona project_id, busca ventana extemporánea activa para ese proyecto.
    2. En ambos casos, también busca ventana global activa (is_active=True y fecha vigente).

    Retorna True si al menos una de las dos aplica.
    """
    today = date.today()

    # Ventana global activa con fecha vigente
    global_result = await db.execute(
        text(
            """
            SELECT id FROM public.date_windows
            WHERE window_type = :window_type
              AND is_active = true
              AND start_date <= :today
              AND end_date >= :today
            LIMIT 1
            """
        ),
        {"window_type": window_type, "today": today},
    )
    if global_result.mappings().first() is not None:
        return True

    # Ventana extemporánea individual del proyecto
    if project_id is not None:
        ext_result = await db.execute(
            text(
                """
                SELECT id FROM public.extemporaneous_windows
                WHERE project_id = :project_id
                  AND stage = :stage
                  AND valid_until >= :today
                LIMIT 1
                """
            ),
            {"project_id": project_id, "stage": window_type, "today": today},
        )
        if ext_result.mappings().first() is not None:
            return True

    return False
