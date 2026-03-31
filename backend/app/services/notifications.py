"""
Servicio centralizado de mensajes automáticos del sistema (T-F08-10).

Todos los mensajes generados automáticamente por eventos del flujo de trabajo
(cambios de estado, calificaciones, correcciones, etc.) pasan por esta función.
Los mensajes manuales enviados por usuarios se insertan directamente en messages.py.
"""

from typing import Optional
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def send_system_message(
    db: AsyncSession,
    project_id: UUID,
    sender_id: UUID,
    recipient_id: Optional[UUID],
    content: str,
    sender_display: str = "Sistema",
) -> None:
    """
    Inserta un mensaje automático del sistema en la tabla messages.

    Args:
        db:             sesión de base de datos activa
        project_id:     trabajo de grado al que pertenece el mensaje
        sender_id:      usuario que disparó la acción (admin, jurado, etc.)
        recipient_id:   destinatario; None = broadcast a todos los actores del proyecto
        content:        texto del mensaje
        sender_display: nombre visible; por defecto "Sistema"
    """
    await db.execute(
        text(
            "INSERT INTO public.messages"
            " (project_id, sender_id, recipient_id, content, sender_display)"
            " VALUES (:pid, :sid, :rid, :content, :display)"
        ),
        {
            "pid": project_id,
            "sid": sender_id,
            "rid": recipient_id,
            "content": content,
            "display": sender_display,
        },
    )
