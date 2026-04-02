"""
Tests de integración para routers/jurors.py.
Cubre: GET /projects/{id}/jurors, POST /projects/{id}/jurors,
       DELETE /projects/{id}/jurors/{juror_id}
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.core.database import get_db
from app.core.dependencies import CurrentUser, get_current_user, require_admin
from app.main import app


# ---------------------------------------------------------------------------
# Helpers locales (mismo patrón que el resto de la suite)
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


@pytest.fixture
def student_user() -> CurrentUser:
    return CurrentUser(id=uuid4(), email="est@usc.edu.co", role="estudiante")


# ---------------------------------------------------------------------------
# GET /projects/{id}/jurors
# ---------------------------------------------------------------------------


def test_list_jurors_admin_ve_identidad_completa(admin_user):
    """Admin recibe JurorResponse con docente_id y full_name."""
    project_id = uuid4()
    juror_id = uuid4()
    docente_id = uuid4()
    now = datetime.now(timezone.utc)

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(
        side_effect=[
            # _check_membership (admin → retorna sin consultar)
            mapping_result([{
                "id": juror_id,
                "project_id": project_id,
                "docente_id": docente_id,
                "juror_number": 1,
                "stage": "anteproyecto",
                "is_active": True,
                "assigned_at": now,
                "assigned_by": admin_user.id,
                "full_name": "Dr. Pérez",
            }]),
        ]
    )

    client = make_client(admin_user, mock_db)
    try:
        response = client.get(f"/api/v1/projects/{project_id}/jurors")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["juror_number"] == 1
    assert data[0]["full_name"] == "Dr. Pérez"


def test_list_jurors_estudiante_no_ve_identidad(student_user):
    """Estudiante recibe JurorStudentResponse (sin docente_id ni full_name)."""
    project_id = uuid4()

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(
        side_effect=[
            # _check_membership para estudiante: pertenece al proyecto
            mapping_result([{"id": uuid4()}]),
            # listar jurados (vista reducida)
            mapping_result([{
                "juror_number": 1,
                "stage": "anteproyecto",
                "is_active": True,
            }]),
        ]
    )

    client = make_client(student_user, mock_db)
    try:
        response = client.get(f"/api/v1/projects/{project_id}/jurors")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert "docente_id" not in data[0]
    assert data[0]["juror_number"] == 1


def test_list_jurors_estudiante_sin_pertenencia_403(student_user):
    """Estudiante sin pertenencia al proyecto recibe 403."""
    project_id = uuid4()

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(
        side_effect=[
            mapping_result([]),  # estudiante NO pertenece al proyecto
        ]
    )

    client = make_client(student_user, mock_db)
    try:
        response = client.get(f"/api/v1/projects/{project_id}/jurors")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 403


# ---------------------------------------------------------------------------
# POST /projects/{id}/jurors — assign_juror
# ---------------------------------------------------------------------------


def test_assign_juror_proyecto_no_encontrado(admin_user):
    """POST /projects/{id}/jurors retorna 404 si el proyecto no existe."""
    project_id = uuid4()
    docente_id = uuid4()

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        mapping_result([]),  # proyecto no encontrado
    ])

    client = make_client(admin_user, mock_db)
    try:
        response = client.post(
            f"/api/v1/projects/{project_id}/jurors",
            json={"user_id": str(docente_id), "juror_number": 1, "stage": "anteproyecto"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 404
    assert "no encontrado" in response.json()["detail"].lower()


def test_assign_juror3_en_sustentacion_retorna_400(admin_user):
    """POST jurors: Jurado 3 en sustentación → 400."""
    project_id = uuid4()
    docente_id = uuid4()

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        mapping_result([{
            "id": project_id,
            "status": "sustentacion_programada",
            "period": "2026-1",
            "title": "Trabajo Test",
        }]),
    ])

    client = make_client(admin_user, mock_db)
    try:
        response = client.post(
            f"/api/v1/projects/{project_id}/jurors",
            json={"user_id": str(docente_id), "juror_number": 3, "stage": "sustentacion"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 400
    assert "jurado 3" in response.json()["detail"].lower()


def test_assign_juror_estado_invalido_retorna_409(admin_user):
    """POST jurors: estado del proyecto no válido para la etapa → 409."""
    project_id = uuid4()
    docente_id = uuid4()

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        mapping_result([{
            "id": project_id,
            "status": "pendiente_evaluacion_idea",  # estado incorrecto para anteproyecto
            "period": "2026-1",
            "title": "Trabajo Test",
        }]),
    ])

    client = make_client(admin_user, mock_db)
    try:
        response = client.post(
            f"/api/v1/projects/{project_id}/jurors",
            json={"user_id": str(docente_id), "juror_number": 1, "stage": "anteproyecto"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 409
    assert "estado" in response.json()["detail"].lower()


def test_assign_juror_docente_no_existe_retorna_400(admin_user):
    """POST jurors: docente no activo o inexistente → 400."""
    project_id = uuid4()
    docente_id = uuid4()

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        mapping_result([{
            "id": project_id,
            "status": "anteproyecto_pendiente_evaluacion",
            "period": "2026-1",
            "title": "Trabajo Test",
        }]),
        mapping_result([]),   # docente no encontrado
    ])

    client = make_client(admin_user, mock_db)
    try:
        response = client.post(
            f"/api/v1/projects/{project_id}/jurors",
            json={"user_id": str(docente_id), "juror_number": 1, "stage": "anteproyecto"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 400
    assert "docente" in response.json()["detail"].lower()


def test_assign_juror_duplicado_docente_retorna_400(admin_user):
    """POST jurors: docente ya asignado en esta etapa → 400."""
    project_id = uuid4()
    docente_id = uuid4()

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        mapping_result([{
            "id": project_id,
            "status": "anteproyecto_pendiente_evaluacion",
            "period": "2026-1",
            "title": "Trabajo Test",
        }]),
        mapping_result([{"id": docente_id}]),   # docente existe y activo
        mapping_result([{"id": uuid4()}]),       # ya está asignado como jurado
    ])

    client = make_client(admin_user, mock_db)
    try:
        response = client.post(
            f"/api/v1/projects/{project_id}/jurors",
            json={"user_id": str(docente_id), "juror_number": 2, "stage": "anteproyecto"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 400
    assert "ya está asignado" in response.json()["detail"].lower()


def test_assign_juror_numero_duplicado_retorna_409(admin_user):
    """POST jurors: Jurado N ya existe activo para esta etapa → 409."""
    project_id = uuid4()
    docente_id = uuid4()

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        mapping_result([{
            "id": project_id,
            "status": "anteproyecto_pendiente_evaluacion",
            "period": "2026-1",
            "title": "Trabajo Test",
        }]),
        mapping_result([{"id": docente_id}]),   # docente existe
        mapping_result([]),                      # no está como jurado (docente check)
        mapping_result([{"id": uuid4()}]),       # pero ya existe J1 activo
    ])

    client = make_client(admin_user, mock_db)
    try:
        response = client.post(
            f"/api/v1/projects/{project_id}/jurors",
            json={"user_id": str(docente_id), "juror_number": 1, "stage": "anteproyecto"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 409
    assert "jurado 1" in response.json()["detail"].lower()


def test_assign_juror3_sin_divergencia_retorna_409(admin_user):
    """POST jurors: Jurado 3 sin divergencia entre J1 y J2 → 409."""
    project_id = uuid4()
    docente_id = uuid4()

    # J1 y J2 ambos aprueban (no hay divergencia)
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        mapping_result([{
            "id": project_id,
            "status": "anteproyecto_pendiente_evaluacion",
            "period": "2026-1",
            "title": "Trabajo Test",
        }]),
        # divergencia: J1=4.5, J2=4.0 (ambos aprueban — sin divergencia)
        mapping_result([
            {"juror_number": 1, "score": 4.5},
            {"juror_number": 2, "score": 4.0},
        ]),
    ])

    client = make_client(admin_user, mock_db)
    try:
        response = client.post(
            f"/api/v1/projects/{project_id}/jurors",
            json={"user_id": str(docente_id), "juror_number": 3, "stage": "anteproyecto"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 409
    assert "divergencia" in response.json()["detail"].lower()


# ---------------------------------------------------------------------------
# DELETE /projects/{id}/jurors/{juror_id}
# ---------------------------------------------------------------------------


def test_remove_juror_no_encontrado_retorna_404(admin_user):
    """DELETE /projects/{id}/jurors/{jid}: jurado no encontrado → 404."""
    project_id = uuid4()
    juror_id = uuid4()

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        mapping_result([]),  # jurado no encontrado
    ])

    client = make_client(admin_user, mock_db)
    try:
        response = client.delete(f"/api/v1/projects/{project_id}/jurors/{juror_id}")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 404
    assert "jurado no encontrado" in response.json()["detail"].lower()


def test_remove_juror_con_calificacion_retorna_409(admin_user):
    """DELETE /jurors/{id}: jurado ya calificó → 409."""
    project_id = uuid4()
    juror_id = uuid4()
    docente_id = uuid4()

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        mapping_result([{
            "id": juror_id,
            "docente_id": docente_id,
            "juror_number": 1,
            "stage": "anteproyecto",
        }]),
        mapping_result([{"id": uuid4()}]),  # tiene calificación
    ])

    client = make_client(admin_user, mock_db)
    try:
        response = client.delete(f"/api/v1/projects/{project_id}/jurors/{juror_id}")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 409
    assert "calificación" in response.json()["detail"].lower()


def test_remove_juror_sin_calificacion_retorna_204(admin_user):
    """DELETE /jurors/{id}: jurado sin calificación → 204."""
    project_id = uuid4()
    juror_id = uuid4()
    docente_id = uuid4()

    mock_db = AsyncMock()
    mock_db.commit = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        mapping_result([{
            "id": juror_id,
            "docente_id": docente_id,
            "juror_number": 1,
            "stage": "anteproyecto",
        }]),
        mapping_result([]),    # sin calificación
        MagicMock(),           # UPDATE is_active = false
        MagicMock(),           # DELETE evaluations pendientes
    ])

    client = make_client(admin_user, mock_db)
    try:
        response = client.delete(f"/api/v1/projects/{project_id}/jurors/{juror_id}")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 204
