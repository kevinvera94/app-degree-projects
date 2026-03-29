from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import CurrentUser, get_current_user, require_admin
from app.schemas.academic_program import VALID_LEVELS
from app.schemas.modality import (
    ModalityCreate,
    ModalityLimitResponse,
    ModalityLimitUpsert,
    ModalityResponse,
    ModalityUpdate,
)

router = APIRouter(prefix="/modalities", tags=["modalities"])

_SELECT_MODALITY = (
    "id, name, levels, max_members, requires_sustentation, "
    "requires_ethics_approval, requires_business_plan_cert, is_active, created_at"
)
_SELECT_LIMIT = "id, modality_id, level, max_members, updated_at"


def _to_modality_response(row: dict) -> ModalityResponse:
    data = dict(row)
    # asyncpg retorna arrays de PostgreSQL como listas de Python
    data["levels"] = list(data["levels"]) if data["levels"] else []
    return ModalityResponse(**data)


@router.get("", response_model=list[ModalityResponse])
async def list_modalities(
    _: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ModalityResponse]:
    result = await db.execute(
        text(f"SELECT {_SELECT_MODALITY} FROM public.modalities ORDER BY name"),
    )
    return [_to_modality_response(row) for row in result.mappings()]


@router.post("", response_model=ModalityResponse, status_code=status.HTTP_201_CREATED)
async def create_modality(
    body: ModalityCreate,
    current_user: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> ModalityResponse:
    result = await db.execute(
        text(
            f"""
            INSERT INTO public.modalities
                (name, levels, max_members, requires_sustentation,
                 requires_ethics_approval, requires_business_plan_cert, created_by)
            VALUES
                (:name, :levels, :max_members, :requires_sustentation,
                 :requires_ethics_approval, :requires_business_plan_cert, :created_by)
            RETURNING {_SELECT_MODALITY}
        """
        ),
        {
            "name": body.name,
            "levels": body.levels,
            "max_members": body.max_members,
            "requires_sustentation": body.requires_sustentation,
            "requires_ethics_approval": body.requires_ethics_approval,
            "requires_business_plan_cert": body.requires_business_plan_cert,
            "created_by": current_user.id,
        },
    )
    row = result.mappings().first()
    await db.commit()
    return _to_modality_response(row)


@router.patch("/{modality_id}", response_model=ModalityResponse)
async def update_modality(
    modality_id: UUID,
    body: ModalityUpdate,
    _: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> ModalityResponse:
    allowed = {"name", "max_members", "is_active"}
    updates = {
        k: v for k, v in body.model_dump(exclude_none=True).items() if k in allowed
    }

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Sin campos para actualizar"
        )

    set_clause = ", ".join(f"{k} = :{k}" for k in updates)
    result = await db.execute(
        text(
            f"UPDATE public.modalities"
            f" SET {set_clause} WHERE id = :id RETURNING {_SELECT_MODALITY}"
        ),
        {**updates, "id": modality_id},
    )
    row = result.mappings().first()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Modalidad no encontrada"
        )
    await db.commit()
    return _to_modality_response(row)


@router.get("/{modality_id}/limits", response_model=list[ModalityLimitResponse])
async def list_modality_limits(
    modality_id: UUID,
    _: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> list[ModalityLimitResponse]:
    # Verificar que la modalidad existe
    exists = await db.execute(
        text("SELECT id FROM public.modalities WHERE id = :id"),
        {"id": modality_id},
    )
    if exists.mappings().first() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Modalidad no encontrada"
        )

    result = await db.execute(
        text(
            f"SELECT {_SELECT_LIMIT} FROM public.modality_level_limits"
            " WHERE modality_id = :id ORDER BY level"
        ),
        {"id": modality_id},
    )
    return [ModalityLimitResponse(**row) for row in result.mappings()]


@router.put("/{modality_id}/limits/{level}", response_model=ModalityLimitResponse)
async def upsert_modality_limit(
    modality_id: UUID,
    level: str,
    body: ModalityLimitUpsert,
    current_user: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
    response: Response = None,
) -> ModalityLimitResponse:
    if level not in VALID_LEVELS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Nivel académico inválido"
        )

    # Verificar que la modalidad existe
    exists = await db.execute(
        text("SELECT id FROM public.modalities WHERE id = :id"),
        {"id": modality_id},
    )
    if exists.mappings().first() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Modalidad no encontrada"
        )

    # Determinar si es insert o update para el status code
    existing = await db.execute(
        text(
            "SELECT id FROM public.modality_level_limits"
            " WHERE modality_id = :mid AND level = :level"
        ),
        {"mid": modality_id, "level": level},
    )
    is_new = existing.mappings().first() is None

    result = await db.execute(
        text(
            f"""
            INSERT INTO public.modality_level_limits
                (modality_id, level, max_members, updated_by)
            VALUES (:modality_id, :level, :max_members, :updated_by)
            ON CONFLICT (modality_id, level) DO UPDATE
                SET max_members = :max_members,
                    updated_by = :updated_by,
                    updated_at = now()
            RETURNING {_SELECT_LIMIT}
        """
        ),
        {
            "modality_id": modality_id,
            "level": level,
            "max_members": body.max_members,
            "updated_by": current_user.id,
        },
    )
    row = result.mappings().first()
    await db.commit()

    if is_new:
        response.status_code = status.HTTP_201_CREATED
    return ModalityLimitResponse(**row)


@router.delete("/{modality_id}/limits/{level}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_modality_limit(
    modality_id: UUID,
    level: str,
    _: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        text(
            "DELETE FROM public.modality_level_limits"
            " WHERE modality_id = :mid AND level = :level"
        ),
        {"mid": modality_id, "level": level},
    )
    if result.rowcount == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Límite no encontrado"
        )
    await db.commit()
