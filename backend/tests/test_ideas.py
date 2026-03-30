"""
Tests de integración para FASE-04: inscripción y evaluación de idea.
Cubre MOD-03 y MOD-04.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.core.database import get_db
from app.core.dependencies import (
    CurrentUser,
    get_current_user,
    require_admin,
    require_estudiante,
)
from app.main import app
from app.schemas.project import ProjectCreate, VALID_RESEARCH_GROUPS


# ---------------------------------------------------------------------------
# Helpers (mismos que test_config.py)
# ---------------------------------------------------------------------------


class _Mappings:
    def __init__(self, rows: list):
        self._rows = rows

    def first(self):
        return self._rows[0] if self._rows else None

    def __iter__(self):
        return iter(self._rows)


def mapping_result(rows: Optional[list] = None, rowcount: int = 1) -> MagicMock:
    rows = rows or []
    result = MagicMock()
    result.mappings.return_value = _Mappings(rows)
    result.scalar_one.return_value = len(rows)
    result.scalar_one_or_none.return_value = rows[0] if rows else None
    result.rowcount = rowcount
    return result


def make_client(user: CurrentUser, mock_db: AsyncMock) -> TestClient:
    async def override_db():
        yield mock_db

    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[require_admin] = lambda: user
    app.dependency_overrides[require_estudiante] = lambda: user
    app.dependency_overrides[get_db] = override_db
    return TestClient(app)


@pytest.fixture
def admin_user() -> CurrentUser:
    return CurrentUser(id=uuid4(), email="admin@usc.edu.co", role="administrador")


@pytest.fixture
def student_user() -> CurrentUser:
    return CurrentUser(id=uuid4(), email="est@usc.edu.co", role="estudiante")


def project_body(student_id, extra_members: Optional[list] = None) -> dict:
    """Cuerpo válido para POST /projects con el estudiante como integrante."""
    members = [str(student_id)] + [str(m) for m in (extra_members or [])]
    return {
        "title": "Trabajo de prueba",
        "modality_id": str(uuid4()),
        "academic_program_id": str(uuid4()),
        "research_group": "GIEIAM",
        "research_line": "Inteligencia Artificial",
        "member_ids": members,
        "prerequisite_declaration": True,
    }


# ---------------------------------------------------------------------------
# 1. Inscribir idea sin ventana activa → 409
# ---------------------------------------------------------------------------


def test_inscribir_idea_sin_ventana_activa(student_user):
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        mapping_result([]),  # date_windows sin resultados
    ])

    client = make_client(student_user, mock_db)
    try:
        response = client.post("/api/v1/projects", json=project_body(student_user.id))
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 409
    assert "ventana" in response.json()["detail"].lower()


# ---------------------------------------------------------------------------
# 2. Inscribir idea con integrante no pre-registrado → 400
# ---------------------------------------------------------------------------


def test_inscribir_idea_con_integrante_no_preregistrado(student_user):
    invalid_id = uuid4()
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        mapping_result([{"id": uuid4(), "period": "2026-1"}]),  # ventana activa
        # Sólo el estudiante solicitante es válido — el extra no aparece
        mapping_result([{"id": student_user.id}]),
    ])

    client = make_client(student_user, mock_db)
    try:
        body = project_body(student_user.id, extra_members=[invalid_id])
        response = client.post("/api/v1/projects", json=body)
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 400
    assert str(invalid_id) in response.json()["detail"]


# ---------------------------------------------------------------------------
# 3. Inscribir idea con más integrantes que el límite → 400
# ---------------------------------------------------------------------------


def test_inscribir_idea_excede_limite_integrantes(student_user):
    member2 = uuid4()
    coalesce_result = MagicMock()
    coalesce_result.scalar_one_or_none.return_value = 1  # límite = 1

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        mapping_result([{"id": uuid4(), "period": "2026-1"}]),           # ventana
        mapping_result([{"id": student_user.id}, {"id": member2}]),       # miembros válidos
        mapping_result([{"level": "profesional"}]),                        # programa
        coalesce_result,                                                   # get_max_members
    ])

    client = make_client(student_user, mock_db)
    try:
        body = project_body(student_user.id, extra_members=[member2])
        response = client.post("/api/v1/projects", json=body)
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 400
    assert "límite" in response.json()["detail"].lower()


# ---------------------------------------------------------------------------
# 4. Inscribir idea con prerequisite_declaration = false → ValidationError
# ---------------------------------------------------------------------------


def test_inscribir_idea_prerequisite_false():
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        ProjectCreate(
            title="Test",
            modality_id=uuid4(),
            academic_program_id=uuid4(),
            research_group="GIEIAM",
            research_line="IA",
            member_ids=[uuid4()],
            prerequisite_declaration=False,
        )


# ---------------------------------------------------------------------------
# 5. Estudiante con trabajo activo intenta inscribir otra idea → 409
# ---------------------------------------------------------------------------


def test_inscribir_idea_con_trabajo_activo(student_user):
    member2 = uuid4()
    coalesce_result = MagicMock()
    coalesce_result.scalar_one_or_none.return_value = 3  # límite no es problema

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        mapping_result([{"id": uuid4(), "period": "2026-1"}]),          # ventana
        mapping_result([{"id": student_user.id}, {"id": member2}]),      # miembros válidos
        mapping_result([{"level": "profesional"}]),                       # programa
        coalesce_result,                                                  # get_max_members
        mapping_result([{"id": uuid4()}]),                               # trabajo activo encontrado
    ])

    client = make_client(student_user, mock_db)
    try:
        body = project_body(student_user.id, extra_members=[member2])
        response = client.post("/api/v1/projects", json=body)
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 409
    assert "activo" in response.json()["detail"].lower()


# ---------------------------------------------------------------------------
# 6. Aprobar idea sin director asignado → 400
# ---------------------------------------------------------------------------


def test_aprobar_idea_sin_director(admin_user):
    project_id = uuid4()
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        mapping_result([{
            "id": project_id,
            "title": "Trabajo",
            "status": "pendiente_evaluacion_idea",
            "modality_id": uuid4(),
            "academic_program_id": uuid4(),
            "research_group": "GIEIAM",
            "research_line": "IA",
            "suggested_director": None,
            "period": "2026-1",
            "has_company_link": False,
            "plagiarism_suspended": False,
            "created_at": datetime(2026, 1, 1),
            "updated_at": datetime(2026, 1, 1),
        }]),
        mapping_result([]),  # sin directores activos
    ])

    client = make_client(admin_user, mock_db)
    try:
        response = client.patch(
            f"/api/v1/projects/{project_id}/status",
            json={"action": "aprobar"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 400
    assert "director" in response.json()["detail"].lower()


# ---------------------------------------------------------------------------
# 7. Rechazar idea sin motivo → 400
# ---------------------------------------------------------------------------


def test_rechazar_idea_sin_motivo(admin_user):
    project_id = uuid4()
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        mapping_result([{
            "id": project_id,
            "title": "Trabajo",
            "status": "pendiente_evaluacion_idea",
            "modality_id": uuid4(),
            "academic_program_id": uuid4(),
            "research_group": "GIEIAM",
            "research_line": "IA",
            "suggested_director": None,
            "period": "2026-1",
            "has_company_link": False,
            "plagiarism_suspended": False,
            "created_at": datetime(2026, 1, 1),
            "updated_at": datetime(2026, 1, 1),
        }]),
    ])

    client = make_client(admin_user, mock_db)
    try:
        # Sin reason
        response = client.patch(
            f"/api/v1/projects/{project_id}/status",
            json={"action": "rechazar"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 400
    assert "motivo" in response.json()["detail"].lower()


def test_rechazar_idea_con_motivo_vacio(admin_user):
    project_id = uuid4()
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        mapping_result([{
            "id": project_id,
            "title": "Trabajo",
            "status": "pendiente_evaluacion_idea",
            "modality_id": uuid4(),
            "academic_program_id": uuid4(),
            "research_group": "GIEIAM",
            "research_line": "IA",
            "suggested_director": None,
            "period": "2026-1",
            "has_company_link": False,
            "plagiarism_suspended": False,
            "created_at": datetime(2026, 1, 1),
            "updated_at": datetime(2026, 1, 1),
        }]),
    ])

    client = make_client(admin_user, mock_db)
    try:
        response = client.patch(
            f"/api/v1/projects/{project_id}/status",
            json={"action": "rechazar", "reason": "   "},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 400


# ---------------------------------------------------------------------------
# 8. Agregar integrante después de aprobación de anteproyecto → 409
# ---------------------------------------------------------------------------


def test_agregar_integrante_despues_de_anteproyecto_aprobado(admin_user):
    project_id = uuid4()
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        mapping_result([{
            "id": project_id,
            "title": "Trabajo",
            "status": "en_desarrollo",  # anteproyecto ya aprobado
            "modality_id": uuid4(),
            "academic_program_id": uuid4(),
            "research_group": "GIEIAM",
            "research_line": "IA",
            "suggested_director": None,
            "period": "2026-1",
            "has_company_link": False,
            "plagiarism_suspended": False,
            "created_at": datetime(2026, 1, 1),
            "updated_at": datetime(2026, 1, 1),
        }]),
    ])

    client = make_client(admin_user, mock_db)
    try:
        response = client.post(
            f"/api/v1/projects/{project_id}/members",
            json={"user_id": str(uuid4())},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 409
    assert "anteproyecto" in response.json()["detail"].lower()


# ---------------------------------------------------------------------------
# 9. Retirar integrante con adjunto de tipo incorrecto → 400
# ---------------------------------------------------------------------------


def test_retirar_integrante_adjunto_tipo_incorrecto(admin_user):
    project_id = uuid4()
    member_id = uuid4()
    mock_db = AsyncMock()
    # No se llega a consultar la BD porque la validación ocurre antes

    client = make_client(admin_user, mock_db)
    try:
        response = client.patch(
            f"/api/v1/projects/{project_id}/members/{member_id}/remove",
            data={"reason": "Abandono del programa"},
            files={"attachment": ("doc.txt", b"contenido", "text/plain")},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 400
    assert "pdf" in response.json()["detail"].lower()
    mock_db.execute.assert_not_called()
