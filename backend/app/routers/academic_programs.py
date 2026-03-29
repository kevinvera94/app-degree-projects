from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import CurrentUser, get_current_user, require_admin
from app.schemas.academic_program import (
    AcademicProgramCreate,
    AcademicProgramResponse,
    AcademicProgramUpdate,
    VALID_LEVELS,
)

router = APIRouter(prefix="/academic-programs", tags=["academic-programs"])

_SELECT_FIELDS = "id, name, level, faculty, is_active"


@router.get("", response_model=list[AcademicProgramResponse])
async def list_academic_programs(
    is_active: Optional[bool] = Query(None),
    _: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[AcademicProgramResponse]:
    where = "WHERE is_active = :is_active" if is_active is not None else ""
    params = {"is_active": is_active} if is_active is not None else {}

    result = await db.execute(
        text(f"SELECT {_SELECT_FIELDS} FROM public.academic_programs {where} ORDER BY name"),
        params,
    )
    return [AcademicProgramResponse(**row) for row in result.mappings()]


@router.post("", response_model=AcademicProgramResponse, status_code=status.HTTP_201_CREATED)
async def create_academic_program(
    body: AcademicProgramCreate,
    _: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AcademicProgramResponse:
    body.validate_level()

    result = await db.execute(
        text(f"""
            INSERT INTO public.academic_programs (name, level, faculty)
            VALUES (:name, :level, :faculty)
            RETURNING {_SELECT_FIELDS}
        """),
        {"name": body.name, "level": body.level, "faculty": body.faculty},
    )
    row = result.mappings().first()
    await db.commit()
    return AcademicProgramResponse(**row)


@router.patch("/{program_id}", response_model=AcademicProgramResponse)
async def update_academic_program(
    program_id: UUID,
    body: AcademicProgramUpdate,
    _: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AcademicProgramResponse:
    body.validate_level()

    allowed = {"name", "level", "is_active"}
    updates = {k: v for k, v in body.model_dump(exclude_none=True).items() if k in allowed}

    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Sin campos para actualizar")

    set_clause = ", ".join(f"{k} = :{k}" for k in updates)
    result = await db.execute(
        text(f"UPDATE public.academic_programs SET {set_clause} WHERE id = :id RETURNING {_SELECT_FIELDS}"),
        {**updates, "id": program_id},
    )
    row = result.mappings().first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Programa académico no encontrado")
    await db.commit()
    return AcademicProgramResponse(**row)
