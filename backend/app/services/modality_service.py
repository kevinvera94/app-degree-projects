from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def get_max_members(db: AsyncSession, modality_id: UUID, level: str) -> int:
    """
    Retorna el máximo de integrantes para una modalidad y nivel académico.
    Consulta modality_level_limits primero; si no existe límite específico,
    cae de regreso al max_members por defecto de la modalidad.
    """
    result = await db.execute(
        text("""
            SELECT COALESCE(
                (SELECT max_members FROM public.modality_level_limits
                 WHERE modality_id = :modality_id AND level = :level),
                (SELECT max_members FROM public.modalities
                 WHERE id = :modality_id)
            ) AS max_members
        """),
        {"modality_id": modality_id, "level": level},
    )
    value = result.scalar_one_or_none()
    if value is None:
        raise ValueError(f"Modalidad {modality_id} no encontrada")
    return int(value)
