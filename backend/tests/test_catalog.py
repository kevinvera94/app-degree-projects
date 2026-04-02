"""
Tests de integración para endpoints de catálogo:
  - routers/modalities.py   (GET, POST, PATCH, GET limits, PUT limit, DELETE limit)
  - routers/date_windows.py (GET, POST, PATCH)
  - routers/academic_programs.py (GET, POST, PATCH)

Los DELETE de date_windows ya están cubiertos en test_config.py.
"""
from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Optional
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.core.database import get_db
from app.core.dependencies import CurrentUser, get_current_user, require_admin
from app.main import app


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


class _Mappings:
    def __init__(self, rows: list):
        self._rows = rows

    def first(self):
        return self._rows[0] if self._rows else None

    def __iter__(self):
        return iter(self._rows)


def mapping_result(rows: Optional[list] = None, rowcount: int = 1, scalar=None) -> MagicMock:
    rows = rows or []
    result = MagicMock()
    result.mappings.return_value = _Mappings(rows)
    result.scalar_one.return_value = scalar if scalar is not None else len(rows)
    result.scalar_one_or_none.return_value = rows[0] if rows else None
    result.rowcount = rowcount
    return result


def make_client(user: CurrentUser, mock_db: AsyncMock) -> TestClient:
    async def override_db():
        yield mock_db

    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[require_admin] = lambda: user
    app.dependency_overrides[get_db] = override_db
    return TestClient(app)


@pytest.fixture
def admin_user() -> CurrentUser:
    return CurrentUser(id=uuid4(), email="admin@usc.edu.co", role="administrador")


# ============================================================================
# MODALIDADES
# ============================================================================


def _modality_row(mod_id=None) -> dict:
    return {
        "id": mod_id or uuid4(),
        "name": "Investigación",
        "levels": ["profesional"],
        "max_members": 3,
        "requires_sustentation": True,
        "requires_ethics_approval": False,
        "requires_business_plan_cert": False,
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
    }


def test_list_modalities_retorna_200(admin_user):
    """GET /modalities retorna lista vacía con 200."""
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=mapping_result([]))

    client = make_client(admin_user, mock_db)
    try:
        response = client.get("/api/v1/modalities")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_list_modalities_retorna_items(admin_user):
    """GET /modalities retorna las modalidades registradas."""
    mod_id = uuid4()
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=mapping_result([_modality_row(mod_id)]))

    client = make_client(admin_user, mock_db)
    try:
        response = client.get("/api/v1/modalities")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "Investigación"


def test_create_modality_retorna_201(admin_user):
    """POST /modalities crea modalidad y retorna 201."""
    mod_id = uuid4()
    mock_db = AsyncMock()
    mock_db.commit = AsyncMock()
    mock_db.execute = AsyncMock(return_value=mapping_result([_modality_row(mod_id)]))

    client = make_client(admin_user, mock_db)
    try:
        response = client.post(
            "/api/v1/modalities",
            json={
                "name": "Investigación",
                "levels": ["profesional"],
                "max_members": 3,
                "requires_sustentation": True,
                "requires_ethics_approval": False,
                "requires_business_plan_cert": False,
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201
    assert response.json()["name"] == "Investigación"


def test_create_modality_nivel_invalido_retorna_422(admin_user):
    """POST /modalities con nivel inválido → 422 (validación Pydantic)."""
    mock_db = AsyncMock()

    client = make_client(admin_user, mock_db)
    try:
        response = client.post(
            "/api/v1/modalities",
            json={
                "name": "Test",
                "levels": ["nivel_inexistente"],
                "max_members": 1,
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 422


def test_update_modality_sin_campos_retorna_400(admin_user):
    """PATCH /modalities/{id} sin campos → 400."""
    mod_id = uuid4()
    mock_db = AsyncMock()

    client = make_client(admin_user, mock_db)
    try:
        response = client.patch(f"/api/v1/modalities/{mod_id}", json={})
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 400
    assert "sin campos" in response.json()["detail"].lower()


def test_update_modality_no_encontrada_retorna_404(admin_user):
    """PATCH /modalities/{id}: modalidad no encontrada → 404."""
    mod_id = uuid4()
    mock_db = AsyncMock()
    mock_db.commit = AsyncMock()
    mock_db.execute = AsyncMock(return_value=mapping_result([]))  # UPDATE retorna 0 filas

    client = make_client(admin_user, mock_db)
    try:
        response = client.patch(f"/api/v1/modalities/{mod_id}", json={"name": "Nuevo"})
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 404


def test_list_modality_limits_no_encontrada_retorna_404(admin_user):
    """GET /modalities/{id}/limits: modalidad no existe → 404."""
    mod_id = uuid4()
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=mapping_result([]))  # no existe

    client = make_client(admin_user, mock_db)
    try:
        response = client.get(f"/api/v1/modalities/{mod_id}/limits")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 404


def test_list_modality_limits_retorna_200(admin_user):
    """GET /modalities/{id}/limits: modalidad existe → 200."""
    mod_id = uuid4()
    limit_row = {
        "id": uuid4(),
        "modality_id": mod_id,
        "level": "profesional",
        "max_members": 3,
        "updated_at": datetime.now(timezone.utc),
    }
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        mapping_result([{"id": mod_id}]),   # modalidad existe
        mapping_result([limit_row]),          # límites
    ])

    client = make_client(admin_user, mock_db)
    try:
        response = client.get(f"/api/v1/modalities/{mod_id}/limits")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()[0]["level"] == "profesional"


def test_upsert_modality_limit_nivel_invalido_retorna_400(admin_user):
    """PUT /modalities/{id}/limits/{level}: nivel inválido → 400."""
    mod_id = uuid4()
    mock_db = AsyncMock()

    client = make_client(admin_user, mock_db)
    try:
        response = client.put(
            f"/api/v1/modalities/{mod_id}/limits/nivel_inexistente",
            json={"max_members": 2},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 400
    assert "nivel" in response.json()["detail"].lower()


def test_upsert_modality_limit_modalidad_no_existe_retorna_404(admin_user):
    """PUT /modalities/{id}/limits/{level}: modalidad no existe → 404."""
    mod_id = uuid4()
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=mapping_result([]))  # no existe

    client = make_client(admin_user, mock_db)
    try:
        response = client.put(
            f"/api/v1/modalities/{mod_id}/limits/profesional",
            json={"max_members": 2},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 404


def test_delete_modality_limit_no_encontrado_retorna_404(admin_user):
    """DELETE /modalities/{id}/limits/{level}: no existe → 404."""
    mod_id = uuid4()
    del_result = MagicMock()
    del_result.rowcount = 0

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=del_result)

    client = make_client(admin_user, mock_db)
    try:
        response = client.delete(f"/api/v1/modalities/{mod_id}/limits/profesional")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 404


def test_delete_modality_limit_exitoso_retorna_204(admin_user):
    """DELETE /modalities/{id}/limits/{level}: existe → 204."""
    mod_id = uuid4()
    del_result = MagicMock()
    del_result.rowcount = 1

    mock_db = AsyncMock()
    mock_db.commit = AsyncMock()
    mock_db.execute = AsyncMock(return_value=del_result)

    client = make_client(admin_user, mock_db)
    try:
        response = client.delete(f"/api/v1/modalities/{mod_id}/limits/profesional")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 204


# ============================================================================
# VENTANAS DE FECHAS (GET y POST — DELETE ya cubierto en test_config.py)
# ============================================================================


def _window_row(wid=None, start: str = "2026-06-01", end: str = "2026-06-30") -> dict:
    return {
        "id": wid or uuid4(),
        "period": "2026-1",
        "window_type": "inscripcion_idea",
        "start_date": date.fromisoformat(start),
        "end_date": date.fromisoformat(end),
        "is_active": True,
        "created_by": uuid4(),
        "created_at": datetime.now(timezone.utc),
    }


def test_list_date_windows_sin_filtros_retorna_200(admin_user):
    """GET /date-windows sin filtros → 200 con lista."""
    wid = uuid4()
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=mapping_result([_window_row(wid)]))

    client = make_client(admin_user, mock_db)
    try:
        response = client.get("/api/v1/date-windows")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert len(response.json()) == 1


def test_list_date_windows_con_filtro_window_type(admin_user):
    """GET /date-windows?window_type=... → filtra y retorna 200."""
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=mapping_result([]))

    client = make_client(admin_user, mock_db)
    try:
        response = client.get("/api/v1/date-windows?window_type=inscripcion_idea")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    # Verificar que se pasó el filtro a la BD
    call_str = str(mock_db.execute.call_args_list)
    assert "window_type" in call_str


def test_list_date_windows_con_filtro_is_active(admin_user):
    """GET /date-windows?is_active=true → incluye filtro is_active."""
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=mapping_result([]))

    client = make_client(admin_user, mock_db)
    try:
        response = client.get("/api/v1/date-windows?is_active=true")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    call_str = str(mock_db.execute.call_args_list)
    assert "is_active" in call_str


def test_create_date_window_retorna_201(admin_user):
    """POST /date-windows crea ventana y retorna 201."""
    wid = uuid4()
    mock_db = AsyncMock()
    mock_db.commit = AsyncMock()
    mock_db.execute = AsyncMock(return_value=mapping_result([_window_row(wid)]))

    client = make_client(admin_user, mock_db)
    try:
        response = client.post(
            "/api/v1/date-windows",
            json={
                "period": "2026-1",
                "window_type": "inscripcion_idea",
                "start_date": "2026-06-01",
                "end_date": "2026-06-30",
                "is_active": True,
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201
    assert response.json()["period"] == "2026-1"


def test_update_date_window_no_encontrada_retorna_404(admin_user):
    """PATCH /date-windows/{id}: ventana no encontrada → 404."""
    wid = uuid4()
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=mapping_result([]))  # no existe

    client = make_client(admin_user, mock_db)
    try:
        response = client.patch(
            f"/api/v1/date-windows/{wid}",
            json={"is_active": False},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 404


def test_update_date_window_inicio_en_pasado_retorna_400(admin_user):
    """PATCH /date-windows/{id}: start_date <= hoy → 400."""
    wid = uuid4()
    # start_date en el pasado (2020-01-01)
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=mapping_result([_window_row(wid, start="2020-01-01")]))

    client = make_client(admin_user, mock_db)
    try:
        response = client.patch(
            f"/api/v1/date-windows/{wid}",
            json={"is_active": False},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 400
    assert "inicio" in response.json()["detail"].lower() or "fecha" in response.json()["detail"].lower()


def test_update_date_window_sin_campos_retorna_400(admin_user):
    """PATCH /date-windows/{id} sin campos → 400."""
    wid = uuid4()
    # start_date en el futuro para pasar el primer check
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=mapping_result([_window_row(wid, start="2030-06-01")]))

    client = make_client(admin_user, mock_db)
    try:
        response = client.patch(f"/api/v1/date-windows/{wid}", json={})
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 400
    assert "sin campos" in response.json()["detail"].lower()


# ============================================================================
# PROGRAMAS ACADÉMICOS
# ============================================================================


def _prog_row(pid=None) -> dict:
    return {
        "id": pid or uuid4(),
        "name": "Ingeniería de Sistemas",
        "level": "profesional",
        "faculty": "Ingeniería",
        "is_active": True,
    }


def test_list_academic_programs_retorna_200(admin_user):
    """GET /academic-programs retorna 200."""
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=mapping_result([_prog_row()]))

    client = make_client(admin_user, mock_db)
    try:
        response = client.get("/api/v1/academic-programs")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()[0]["name"] == "Ingeniería de Sistemas"


def test_list_academic_programs_filtro_is_active(admin_user):
    """GET /academic-programs?is_active=true aplica filtro."""
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=mapping_result([]))

    client = make_client(admin_user, mock_db)
    try:
        response = client.get("/api/v1/academic-programs?is_active=true")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    call_str = str(mock_db.execute.call_args_list)
    assert "is_active" in call_str


def test_create_academic_program_retorna_201(admin_user):
    """POST /academic-programs crea programa y retorna 201."""
    mock_db = AsyncMock()
    mock_db.commit = AsyncMock()
    mock_db.execute = AsyncMock(return_value=mapping_result([_prog_row()]))

    client = make_client(admin_user, mock_db)
    try:
        response = client.post(
            "/api/v1/academic-programs",
            json={"name": "Ingeniería de Sistemas", "level": "profesional", "faculty": "Ingeniería"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201
    assert response.json()["level"] == "profesional"


def test_create_academic_program_nivel_invalido_retorna_422(admin_user):
    """POST /academic-programs con nivel inválido → 422."""
    mock_db = AsyncMock()

    client = make_client(admin_user, mock_db)
    try:
        response = client.post(
            "/api/v1/academic-programs",
            json={"name": "Test", "level": "nivel_raro", "faculty": "Ingeniería"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 422


def test_update_academic_program_sin_campos_retorna_400(admin_user):
    """PATCH /academic-programs/{id} sin campos → 400."""
    prog_id = uuid4()
    mock_db = AsyncMock()

    client = make_client(admin_user, mock_db)
    try:
        response = client.patch(f"/api/v1/academic-programs/{prog_id}", json={})
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 400
    assert "sin campos" in response.json()["detail"].lower()


def test_update_academic_program_no_encontrado_retorna_404(admin_user):
    """PATCH /academic-programs/{id}: no encontrado → 404."""
    prog_id = uuid4()
    mock_db = AsyncMock()
    mock_db.commit = AsyncMock()
    mock_db.execute = AsyncMock(return_value=mapping_result([]))  # no encontrado

    client = make_client(admin_user, mock_db)
    try:
        response = client.patch(
            f"/api/v1/academic-programs/{prog_id}",
            json={"is_active": False},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 404
    assert "no encontrado" in response.json()["detail"].lower()
