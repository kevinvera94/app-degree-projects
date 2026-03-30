"""
Tests de integración (con mock DB) y unitarios para los endpoints de FASE-03:
auth, users, academic-programs, modalities y date-windows.
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Optional
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from app.core.database import get_db
from app.core.dependencies import CurrentUser, get_current_user, require_admin
from app.main import app
from app.schemas.date_window import DateWindowCreate, WindowType
from app.schemas.user import UserCreate
from app.services.modality_service import get_max_members


# ---------------------------------------------------------------------------
# Helpers de mock
# ---------------------------------------------------------------------------


class _Mappings:
    """Iterable que simula el resultado de result.mappings()."""

    def __init__(self, rows: list):
        self._rows = rows

    def first(self):
        return self._rows[0] if self._rows else None

    def __iter__(self):
        return iter(self._rows)


def mapping_result(rows: Optional[list] = None, rowcount: int = 1) -> MagicMock:
    """Crea un mock de resultado de db.execute() compatible con .mappings()."""
    rows = rows or []
    result = MagicMock()
    result.mappings.return_value = _Mappings(rows)
    result.scalar_one.return_value = len(rows)
    result.scalar_one_or_none.return_value = rows[0] if rows else None
    result.rowcount = rowcount
    return result


def make_client(admin_user: CurrentUser, mock_db: AsyncMock) -> TestClient:
    """Crea un TestClient con el usuario admin y la DB mockeada."""

    async def override_db():
        yield mock_db

    app.dependency_overrides[get_current_user] = lambda: admin_user
    app.dependency_overrides[require_admin] = lambda: admin_user
    app.dependency_overrides[get_db] = override_db
    return TestClient(app)


@pytest.fixture
def admin_user() -> CurrentUser:
    return CurrentUser(id=uuid4(), email="admin@usc.edu.co", role="administrador")


# ---------------------------------------------------------------------------
# 1. Crear usuario con rol incorrecto → ValidationError (→ 422 en endpoint)
# ---------------------------------------------------------------------------


def test_user_create_invalid_role():
    """UserCreate lanza ValidationError para roles que no existen en el sistema."""
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        UserCreate(
            full_name="Prueba",
            email="prueba@usc.edu.co",
            password="pass1234",
            role="superadmin",
        )


# ---------------------------------------------------------------------------
# 2. Desactivar docente con trabajos activos → mensajes de alerta generados
# ---------------------------------------------------------------------------


def test_deactivate_docente_generates_alert_messages(admin_user):
    """
    Al desactivar un docente con proyectos activos, la respuesta incluye
    los project_ids afectados y se insertan mensajes de alerta en la BD.
    """
    project1_id = uuid4()
    project2_id = uuid4()
    docente_id = uuid4()

    mock_db = AsyncMock()
    mock_db.commit = AsyncMock()
    mock_db.execute = AsyncMock(
        side_effect=[
            mapping_result([{"id": docente_id}]),           # usuario existe
            MagicMock(),                                     # UPDATE is_active
            mapping_result([{"project_id": project1_id}]),  # project_directors
            mapping_result([{"project_id": project2_id}]),  # project_jurors
            MagicMock(),                                     # UPDATE project_directors
            MagicMock(),                                     # UPDATE project_jurors
            MagicMock(),                                     # INSERT mensaje proyecto 1
            MagicMock(),                                     # INSERT mensaje proyecto 2
        ]
    )

    client = make_client(admin_user, mock_db)
    try:
        with patch("app.routers.users.supabase_admin") as mock_supa:
            mock_supa.auth.admin.update_user_by_id.return_value = None
            response = client.patch(f"/api/v1/users/{docente_id}/deactivate")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    body = response.json()
    assert body["user_id"] == str(docente_id)
    assert len(body["affected_project_ids"]) == 2
    assert str(project1_id) in body["affected_project_ids"]
    assert str(project2_id) in body["affected_project_ids"]

    # Verificar que se ejecutaron inserciones de mensajes para ambos proyectos
    # call.args[0] es el objeto text() de SQLAlchemy; str() retorna el SQL literal
    insert_calls = [
        c
        for c in mock_db.execute.call_args_list
        if "INSERT INTO public.messages" in str(c.args[0])
    ]
    assert len(insert_calls) == 2


# ---------------------------------------------------------------------------
# 3. Crear ventana de fechas con start_date >= end_date → ValidationError
# ---------------------------------------------------------------------------


def test_date_window_create_equal_dates_raises():
    """DateWindowCreate rechaza start_date == end_date."""
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        DateWindowCreate(
            period="2026-1",
            window_type=WindowType.inscripcion_idea,
            start_date=date(2026, 4, 1),
            end_date=date(2026, 4, 1),
        )


def test_date_window_create_inverted_dates_raises():
    """DateWindowCreate rechaza start_date > end_date."""
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        DateWindowCreate(
            period="2026-1",
            window_type=WindowType.inscripcion_idea,
            start_date=date(2026, 5, 1),
            end_date=date(2026, 4, 1),
        )


def test_date_window_create_valid_dates():
    """DateWindowCreate acepta start_date < end_date."""
    window = DateWindowCreate(
        period="2026-1",
        window_type=WindowType.inscripcion_idea,
        start_date=date(2026, 4, 1),
        end_date=date(2026, 4, 30),
    )
    assert window.start_date < window.end_date


# ---------------------------------------------------------------------------
# 4. Eliminar ventana con radicaciones → 409
# ---------------------------------------------------------------------------


def test_delete_date_window_with_submissions_returns_409(admin_user):
    """DELETE /date-windows/{id} retorna 409 si hay radicaciones asociadas."""
    window_id = uuid4()

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(
        side_effect=[
            mapping_result([{"id": window_id}]),    # ventana existe
            mapping_result([{"id": uuid4()}]),       # tiene radicaciones
        ]
    )

    client = make_client(admin_user, mock_db)
    try:
        response = client.delete(f"/api/v1/date-windows/{window_id}")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 409
    assert "radicaciones" in response.json()["detail"]


def test_delete_date_window_without_submissions_returns_204(admin_user):
    """DELETE /date-windows/{id} retorna 204 si no hay radicaciones."""
    window_id = uuid4()

    mock_db = AsyncMock()
    mock_db.commit = AsyncMock()
    mock_db.execute = AsyncMock(
        side_effect=[
            mapping_result([{"id": window_id}]),  # ventana existe
            mapping_result([]),                    # sin radicaciones
            MagicMock(),                           # DELETE
        ]
    )

    client = make_client(admin_user, mock_db)
    try:
        response = client.delete(f"/api/v1/date-windows/{window_id}")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 204


# ---------------------------------------------------------------------------
# 5. GET /users?role=docente&is_active=true → solo docentes activos
# ---------------------------------------------------------------------------


def test_list_users_docentes_activos_filter(admin_user):
    """
    GET /users?role=docente&is_active=true retorna únicamente docentes activos.
    Verifica que el endpoint pasa los filtros a la BD y serializa correctamente.
    """
    docente_rows = [
        {
            "id": uuid4(),
            "full_name": "Ana López",
            "email": "ana@usc.edu.co",
            "role": "docente",
            "is_active": True,
            "created_at": datetime(2026, 1, 1),
        },
        {
            "id": uuid4(),
            "full_name": "Luis Mora",
            "email": "luis@usc.edu.co",
            "role": "docente",
            "is_active": True,
            "created_at": datetime(2026, 1, 2),
        },
    ]

    count_result = MagicMock()
    count_result.scalar_one.return_value = 2
    rows_result = mapping_result(docente_rows)

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[count_result, rows_result])

    client = make_client(admin_user, mock_db)
    try:
        response = client.get("/api/v1/users?role=docente&is_active=true")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 2
    assert len(body["items"]) == 2
    for item in body["items"]:
        assert item["role"] == "docente"
        assert item["is_active"] is True

    # Verificar que los filtros se incluyeron en las queries a la BD
    execute_calls_str = str(mock_db.execute.call_args_list)
    assert "role" in execute_calls_str
    assert "is_active" in execute_calls_str


def test_list_users_invalid_role_returns_400(admin_user):
    """GET /users?role=invalido retorna 400 sin consultar la BD."""
    mock_db = AsyncMock()

    client = make_client(admin_user, mock_db)
    try:
        response = client.get("/api/v1/users?role=superadmin")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 400
    mock_db.execute.assert_not_called()


# ---------------------------------------------------------------------------
# 6. get_max_members con límite específico vs sin límite específico
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_max_members_with_specific_limit():
    """
    Cuando existe un registro en modality_level_limits, retorna ese valor
    (sobreescribe el max_members por defecto de la modalidad).
    """
    mock_db = AsyncMock()
    execute_result = MagicMock()
    execute_result.scalar_one_or_none.return_value = 3
    mock_db.execute.return_value = execute_result

    result = await get_max_members(mock_db, uuid4(), "maestria_investigacion")

    assert result == 3


@pytest.mark.asyncio
async def test_get_max_members_falls_back_to_default():
    """
    Cuando NO existe límite específico, COALESCE retorna el max_members
    por defecto de la modalidad.
    """
    mock_db = AsyncMock()
    execute_result = MagicMock()
    execute_result.scalar_one_or_none.return_value = 5
    mock_db.execute.return_value = execute_result

    result = await get_max_members(mock_db, uuid4(), "profesional")

    assert result == 5


@pytest.mark.asyncio
async def test_get_max_members_raises_for_unknown_modality():
    """get_max_members lanza ValueError si la modalidad no existe en la BD."""
    mock_db = AsyncMock()
    execute_result = MagicMock()
    execute_result.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = execute_result

    with pytest.raises(ValueError, match="no encontrada"):
        await get_max_members(mock_db, uuid4(), "profesional")
