from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import CurrentUser, require_admin
from app.schemas.date_window import WindowType
from app.schemas.extemporaneous_window import (
    ExtemporaneousWindowCreate,
    ExtemporaneousWindowResponse,
)

router = APIRouter(prefix="/projects", tags=["projects"])

_SELECT_EXT = (
    "id, project_id, stage, granted_by, granted_at, valid_until, notes"
)


async def _get_project_or_404(project_id: UUID, db: AsyncSession) -> None:
    result = await db.execute(
        text("SELECT id FROM public.thesis_projects WHERE id = :id"),
        {"id": project_id},
    )
    if result.mappings().first() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trabajo de grado no encontrado",
        )


@router.post(
    "/{project_id}/extemporaneous-window",
    response_model=ExtemporaneousWindowResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_extemporaneous_window(
    project_id: UUID,
    body: ExtemporaneousWindowCreate,
    current_user: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> ExtemporaneousWindowResponse:
    await _get_project_or_404(project_id, db)

    # Solo puede existir una ventana extemporánea activa por proyecto + stage
    existing = await db.execute(
        text(
            "SELECT id FROM public.extemporaneous_windows"
            " WHERE project_id = :project_id AND stage = :stage"
        ),
        {"project_id": project_id, "stage": body.window_type.value},
    )
    if existing.mappings().first() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe una ventana extemporánea activa para este proyecto y etapa",
        )

    result = await db.execute(
        text(
            f"""
            INSERT INTO public.extemporaneous_windows
                (project_id, stage, granted_by, valid_until, notes)
            VALUES
                (:project_id, :stage, :granted_by, :valid_until, :notes)
            RETURNING {_SELECT_EXT}
            """
        ),
        {
            "project_id": project_id,
            "stage": body.window_type.value,
            "granted_by": current_user.id,
            "valid_until": body.valid_until,
            "notes": body.notes,
        },
    )
    row = result.mappings().first()
    await db.commit()
    return ExtemporaneousWindowResponse(**row)


@router.delete(
    "/{project_id}/extemporaneous-window",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_extemporaneous_window(
    project_id: UUID,
    window_type: WindowType,
    _: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> None:
    await _get_project_or_404(project_id, db)

    result = await db.execute(
        text(
            "DELETE FROM public.extemporaneous_windows"
            " WHERE project_id = :project_id AND stage = :stage"
        ),
        {"project_id": project_id, "stage": window_type.value},
    )
    if result.rowcount == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ventana extemporánea no encontrada",
        )
    await db.commit()
