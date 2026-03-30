from datetime import date
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import CurrentUser, get_current_user, require_admin
from app.schemas.date_window import (
    DateWindowCreate,
    DateWindowResponse,
    DateWindowUpdate,
    WindowType,
)

router = APIRouter(prefix="/date-windows", tags=["date-windows"])

_SELECT = (
    "id, period, window_type, start_date, end_date, is_active, created_by, created_at"
)


@router.get("", response_model=list[DateWindowResponse])
async def list_date_windows(
    window_type: Optional[WindowType] = None,
    academic_period: Optional[str] = None,
    is_active: Optional[bool] = None,
    _: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[DateWindowResponse]:
    conditions = []
    params: dict = {}

    if window_type is not None:
        conditions.append("window_type = :window_type")
        params["window_type"] = window_type.value
    if academic_period is not None:
        conditions.append("period = :period")
        params["period"] = academic_period
    if is_active is not None:
        conditions.append("is_active = :is_active")
        params["is_active"] = is_active

    where = f" WHERE {' AND '.join(conditions)}" if conditions else ""
    result = await db.execute(
        text(
            f"SELECT {_SELECT} FROM public.date_windows{where} ORDER BY start_date DESC"
        ),
        params,
    )
    return [DateWindowResponse(**row) for row in result.mappings()]


@router.post("", response_model=DateWindowResponse, status_code=status.HTTP_201_CREATED)
async def create_date_window(
    body: DateWindowCreate,
    current_user: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> DateWindowResponse:
    result = await db.execute(
        text(
            f"""
            INSERT INTO public.date_windows
                (period, window_type, start_date, end_date, is_active, created_by)
            VALUES
                (:period, :window_type, :start_date, :end_date, :is_active, :created_by)
            RETURNING {_SELECT}
            """
        ),
        {
            "period": body.period,
            "window_type": body.window_type.value,
            "start_date": body.start_date,
            "end_date": body.end_date,
            "is_active": body.is_active,
            "created_by": current_user.id,
        },
    )
    row = result.mappings().first()
    await db.commit()
    return DateWindowResponse(**row)


@router.patch("/{window_id}", response_model=DateWindowResponse)
async def update_date_window(
    window_id: UUID,
    body: DateWindowUpdate,
    _: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> DateWindowResponse:
    # Solo se puede editar si start_date aún no ha llegado
    existing = await db.execute(
        text(f"SELECT {_SELECT} FROM public.date_windows WHERE id = :id"),
        {"id": window_id},
    )
    row = existing.mappings().first()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ventana de fechas no encontrada",
        )
    if row["start_date"] <= date.today():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede editar una ventana cuya fecha de inicio ya ocurrió",
        )

    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Sin campos para actualizar"
        )

    # Validar coherencia de fechas fusionando valores actuales con los nuevos
    new_start = updates.get("start_date", row["start_date"])
    new_end = updates.get("end_date", row["end_date"])
    if new_start >= new_end:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_date debe ser anterior a end_date",
        )

    if "window_type" in updates:
        updates["window_type"] = updates["window_type"].value

    set_clause = ", ".join(f"{k} = :{k}" for k in updates)
    result = await db.execute(
        text(
            f"UPDATE public.date_windows"
            f" SET {set_clause} WHERE id = :id RETURNING {_SELECT}"
        ),
        {**updates, "id": window_id},
    )
    updated_row = result.mappings().first()
    await db.commit()
    return DateWindowResponse(**updated_row)


@router.delete("/{window_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_date_window(
    window_id: UUID,
    _: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> None:
    exists = await db.execute(
        text("SELECT id FROM public.date_windows WHERE id = :id"),
        {"id": window_id},
    )
    if exists.mappings().first() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ventana de fechas no encontrada",
        )

    # No eliminar si hay radicaciones asociadas
    submissions = await db.execute(
        text("SELECT id FROM public.submissions WHERE date_window_id = :id LIMIT 1"),
        {"id": window_id},
    )
    if submissions.mappings().first() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se puede eliminar: existen radicaciones asociadas a esta ventana",  # noqa: E501
        )

    await db.execute(
        text("DELETE FROM public.date_windows WHERE id = :id"),
        {"id": window_id},
    )
    await db.commit()
