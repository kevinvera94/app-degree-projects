"""
Tests de integración para FASE-07: sustentación y acta.
Cubre MOD-12 (sustentación, calificaciones) y MOD-13 (acta, biblioteca).
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
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
    require_docente,
    require_estudiante,
)
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


def mapping_result(rows: Optional[list] = None, scalar=None) -> MagicMock:
    rows = rows or []
    result = MagicMock()
    result.mappings.return_value = _Mappings(rows)
    result.scalar_one.return_value = scalar if scalar is not None else (rows[0] if rows else None)
    result.scalar_one_or_none.return_value = rows[0] if rows else None
    result.rowcount = len(rows)
    return result


def make_client(user: CurrentUser, mock_db: AsyncMock) -> TestClient:
    async def override_db():
        yield mock_db

    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[require_admin] = lambda: user
    app.dependency_overrides[require_estudiante] = lambda: user
    app.dependency_overrides[require_docente] = lambda: user
    app.dependency_overrides[get_db] = override_db
    return TestClient(app)


@pytest.fixture
def admin_user() -> CurrentUser:
    return CurrentUser(id=uuid4(), email="admin@usc.edu.co", role="administrador")


@pytest.fixture
def student_user() -> CurrentUser:
    return CurrentUser(id=uuid4(), email="est@usc.edu.co", role="estudiante")


@pytest.fixture
def docente_user() -> CurrentUser:
    return CurrentUser(id=uuid4(), email="doc@usc.edu.co", role="docente")


PROJECT_ID = uuid4()
SUT_ID = uuid4()


def _now():
    return datetime.now(timezone.utc)


def _future_dt(days: int = 10) -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=days)


# ---------------------------------------------------------------------------
# 1. Diplomado tecnológico no puede programar sustentación → 409
# ---------------------------------------------------------------------------


def test_diplomado_no_puede_programar_sustentacion(admin_user):
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        # 1. GET proyecto + modality → requires_sustentation=False (Diplomado)
        mapping_result([{
            "id": PROJECT_ID, "status": "aprobado_para_sustentacion",
            "title": "T", "period": "2026-1", "requires_sustentation": False,
        }]),
    ])
    mock_db.commit = AsyncMock()

    client = make_client(admin_user, mock_db)
    try:
        response = client.post(
            f"/api/v1/projects/{PROJECT_ID}/sustentation",
            json={"scheduled_date": "2026-06-15", "scheduled_time": "09:00", "location": "Aula 101"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 409
    assert "diplomado" in response.json()["detail"].lower()


# ---------------------------------------------------------------------------
# 2. Programar sustentación sin estado correcto → 409
# ---------------------------------------------------------------------------


def test_programar_sustentacion_estado_invalido(admin_user):
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        # 1. GET proyecto → estado incorrecto
        mapping_result([{
            "id": PROJECT_ID, "status": "en_desarrollo",
            "title": "T", "period": "2026-1", "requires_sustentation": True,
        }]),
    ])
    mock_db.commit = AsyncMock()

    client = make_client(admin_user, mock_db)
    try:
        response = client.post(
            f"/api/v1/projects/{PROJECT_ID}/sustentation",
            json={"scheduled_date": "2026-06-15", "scheduled_time": "09:00", "location": "Aula 101"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 409
    assert "aprobado_para_sustentacion" in response.json()["detail"]


# ---------------------------------------------------------------------------
# 3. Flujo completo aprobado (promedio ≥ 4.0) → trabajo_aprobado
# ---------------------------------------------------------------------------


def test_sustentacion_aprobada_trabajo_aprobado(docente_user):
    eval_id = uuid4()
    now = _now()

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        # POST /sustentation/evaluations — J1 califica
        # 1. Buscar jurado → J1 (docente es el jurado)
        mapping_result([{
            "id": uuid4(), "docente_id": docente_user.id, "juror_number": 1,
        }]),
        # 2. GET sustentation → existe
        mapping_result([{
            "id": SUT_ID, "project_id": PROJECT_ID, "scheduled_at": _future_dt(),
            "location": "Aula 101", "final_score": None, "is_approved": None,
            "registered_at": now, "registered_by": uuid4(),
        }]),
        # 3. Verificar que no haya calificación previa → ninguna
        mapping_result([]),
        # 4. INSERT sustentation_evaluations → J1 score=4.5
        mapping_result([{
            "id": eval_id, "sustentation_id": SUT_ID, "juror_id": docente_user.id,
            "juror_number": 1, "score": 4.5, "submitted_at": now,
            "submitted_by": docente_user.id,
        }]),
        # 5. GET all evaluations → solo J1 (aún espera J2)
        mapping_result([{"juror_number": 1, "score": 4.5}]),
        # Solo 1 evaluación → no calcula resultado aún
    ])
    mock_db.commit = AsyncMock()

    client = make_client(docente_user, mock_db)
    try:
        response = client.post(
            f"/api/v1/projects/{PROJECT_ID}/sustentation/evaluations",
            json={"score": 4.5},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201
    assert response.json()["score"] == 4.5
    assert response.json()["juror_number"] == 1


def test_sustentacion_segunda_calificacion_aprobada(docente_user):
    """Cuando J2 califica y el promedio >= 4.0 → trabajo_aprobado."""
    eval_id = uuid4()
    now = _now()

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        # 1. Jurado → J2
        mapping_result([{
            "id": uuid4(), "docente_id": docente_user.id, "juror_number": 2,
        }]),
        # 2. GET sustentation
        mapping_result([{
            "id": SUT_ID, "project_id": PROJECT_ID, "scheduled_at": _future_dt(),
            "location": "Aula 101", "final_score": None, "is_approved": None,
            "registered_at": now, "registered_by": uuid4(),
        }]),
        # 3. No calificación previa
        mapping_result([]),
        # 4. INSERT evaluación J2 score=4.2
        mapping_result([{
            "id": eval_id, "sustentation_id": SUT_ID, "juror_id": docente_user.id,
            "juror_number": 2, "score": 4.2, "submitted_at": now,
            "submitted_by": docente_user.id,
        }]),
        # 5. GET all evaluations → J1=4.5, J2=4.2 (ambos calificaron)
        mapping_result([
            {"juror_number": 1, "score": 4.5},
            {"juror_number": 2, "score": 4.2},
        ]),
        # → promedio=4.35 >= 4.0 → aprobado
        # 6. UPDATE sustentations.final_score / is_approved
        mapping_result(),
        # 7. GET proyecto (status y title)
        mapping_result([{"status": "sustentacion_programada", "title": "T"}]),
        # 8. UPDATE project → trabajo_aprobado
        mapping_result(),
        # 9. INSERT project_status_history
        mapping_result(),
        # 10. INSERT message
        mapping_result(),
    ])
    mock_db.commit = AsyncMock()

    client = make_client(docente_user, mock_db)
    try:
        response = client.post(
            f"/api/v1/projects/{PROJECT_ID}/sustentation/evaluations",
            json={"score": 4.2},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201
    assert response.json()["score"] == 4.2


# ---------------------------------------------------------------------------
# 4. Flujo completo reprobado (promedio < 4.0) → reprobado_en_sustentacion
# ---------------------------------------------------------------------------


def test_sustentacion_segunda_calificacion_reprobada(docente_user):
    eval_id = uuid4()
    now = _now()

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        # 1. Jurado → J2
        mapping_result([{
            "id": uuid4(), "docente_id": docente_user.id, "juror_number": 2,
        }]),
        # 2. GET sustentation
        mapping_result([{
            "id": SUT_ID, "project_id": PROJECT_ID, "scheduled_at": _future_dt(),
            "location": "Aula 101", "final_score": None, "is_approved": None,
            "registered_at": now, "registered_by": uuid4(),
        }]),
        # 3. No calificación previa
        mapping_result([]),
        # 4. INSERT evaluación J2 score=3.0
        mapping_result([{
            "id": eval_id, "sustentation_id": SUT_ID, "juror_id": docente_user.id,
            "juror_number": 2, "score": 3.0, "submitted_at": now,
            "submitted_by": docente_user.id,
        }]),
        # 5. Ambas calificadas → J1=3.5, J2=3.0 (promedio=3.25 < 4.0 → reprobado)
        mapping_result([
            {"juror_number": 1, "score": 3.5},
            {"juror_number": 2, "score": 3.0},
        ]),
        # 6. UPDATE sustentations
        mapping_result(),
        # 7. GET proyecto
        mapping_result([{"status": "sustentacion_programada", "title": "T"}]),
        # 8. UPDATE project → reprobado_en_sustentacion
        mapping_result(),
        # 9. INSERT history
        mapping_result(),
        # 10. INSERT message
        mapping_result(),
    ])
    mock_db.commit = AsyncMock()

    client = make_client(docente_user, mock_db)
    try:
        response = client.post(
            f"/api/v1/projects/{PROJECT_ID}/sustentation/evaluations",
            json={"score": 3.0},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201
    assert response.json()["score"] == 3.0


# ---------------------------------------------------------------------------
# 5. Intentar asignar J3 en sustentación → 400
# ---------------------------------------------------------------------------


def test_asignar_j3_sustentacion_devuelve_400(admin_user):
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        # 1. GET proyecto
        mapping_result([{
            "id": PROJECT_ID, "status": "aprobado_para_sustentacion",
            "period": "2026-1", "title": "T",
        }]),
        # guard de J3 en sustentacion se ejecuta ANTES de la query del proyecto,
        # pero en jurors.py el proyecto se carga primero, luego el guard de J3
    ])
    mock_db.commit = AsyncMock()

    client = make_client(admin_user, mock_db)
    try:
        response = client.post(
            f"/api/v1/projects/{PROJECT_ID}/jurors",
            json={"user_id": str(uuid4()), "juror_number": 3, "stage": "sustentacion"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 400
    assert "jurado 3" in response.json()["detail"].lower()


# ---------------------------------------------------------------------------
# 6. Emitir acta sin autorización de biblioteca → 409
# ---------------------------------------------------------------------------


def test_emitir_acta_sin_autorizacion_biblioteca(admin_user):
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        # 1. GET proyecto → trabajo_aprobado
        mapping_result([{
            "id": PROJECT_ID, "status": "trabajo_aprobado", "title": "T",
        }]),
        # 2. GET acts → no existe
        mapping_result([]),
    ])
    mock_db.commit = AsyncMock()

    client = make_client(admin_user, mock_db)
    try:
        response = client.post(f"/api/v1/projects/{PROJECT_ID}/act")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 409
    assert "biblioteca" in response.json()["detail"].lower()


# ---------------------------------------------------------------------------
# 7. Emitir acta en estado distinto a trabajo_aprobado → 409
# ---------------------------------------------------------------------------


def test_emitir_acta_estado_invalido(admin_user):
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        # 1. GET proyecto → estado incorrecto
        mapping_result([{
            "id": PROJECT_ID, "status": "en_desarrollo", "title": "T",
        }]),
    ])
    mock_db.commit = AsyncMock()

    client = make_client(admin_user, mock_db)
    try:
        response = client.post(f"/api/v1/projects/{PROJECT_ID}/act")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 409
    assert "aprobado" in response.json()["detail"].lower()


# ---------------------------------------------------------------------------
# 8. Emitir acta correctamente (sin PDF) → 201
# ---------------------------------------------------------------------------


def test_emitir_acta_sin_pdf(admin_user):
    act_id = uuid4()
    now = _now()

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        # 1. GET proyecto → trabajo_aprobado
        mapping_result([{"id": PROJECT_ID, "status": "trabajo_aprobado", "title": "T"}]),
        # 2. GET acts → existe con library_authorization=True
        mapping_result([{
            "id": act_id, "project_id": PROJECT_ID,
            "issued_at": None, "issued_by": None,
            "library_authorization": True, "act_file_url": None,
        }]),
        # (sin file → no sube storage)
        # 3. UPDATE acts SET issued_at, issued_by → RETURNING
        mapping_result([{
            "id": act_id, "project_id": PROJECT_ID,
            "issued_at": now, "issued_by": admin_user.id,
            "library_authorization": True, "act_file_url": None,
        }]),
        # 4. UPDATE project → acta_generada
        mapping_result(),
        # 5. INSERT history
        mapping_result(),
        # 6. INSERT message
        mapping_result(),
    ])
    mock_db.commit = AsyncMock()

    client = make_client(admin_user, mock_db)
    try:
        response = client.post(f"/api/v1/projects/{PROJECT_ID}/act")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201
    data = response.json()
    assert data["library_authorization"] is True
    assert data["act_file_url"] is None


# ---------------------------------------------------------------------------
# 9. Estudiante ve calificaciones sin identidad del jurado
# ---------------------------------------------------------------------------


def test_estudiante_ve_sustentacion_anonima(student_user):
    now = _now()

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        # 1. _check_membership → miembro activo
        mapping_result([{"id": uuid4()}]),
        # 2. GET sustentations → existe
        mapping_result([{
            "id": SUT_ID, "project_id": PROJECT_ID, "scheduled_at": _future_dt(),
            "location": "Aula 101", "final_score": 4.3, "is_approved": True,
            "registered_at": now, "registered_by": uuid4(),
        }]),
        # 3. GET sustentation_evaluations → J1 y J2 calificados
        mapping_result([
            {
                "id": uuid4(), "sustentation_id": SUT_ID, "juror_id": uuid4(),
                "juror_number": 1, "score": 4.5, "submitted_at": now,
                "submitted_by": uuid4(),
            },
            {
                "id": uuid4(), "sustentation_id": SUT_ID, "juror_id": uuid4(),
                "juror_number": 2, "score": 4.1, "submitted_at": now,
                "submitted_by": uuid4(),
            },
        ]),
    ])
    mock_db.commit = AsyncMock()

    client = make_client(student_user, mock_db)
    try:
        response = client.get(f"/api/v1/projects/{PROJECT_ID}/sustentation")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert data["final_score"] == 4.3
    evals = data["evaluations"]
    assert len(evals) == 2
    # Estudiante no debe ver juror_id
    for e in evals:
        assert "juror_id" not in e
        assert "juror_number" in e


# ---------------------------------------------------------------------------
# 10. Estudiante puede descargar acta (URL firmada generada)
# ---------------------------------------------------------------------------


def test_get_acta_genera_url_firmada(student_user):
    act_id = uuid4()
    now = _now()

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        # 1. membership
        mapping_result([{"id": uuid4()}]),
        # 2. GET acts → tiene act_file_url
        mapping_result([{
            "id": act_id, "project_id": PROJECT_ID,
            "issued_at": now, "issued_by": uuid4(),
            "library_authorization": True,
            "act_file_url": "acts/test/acta.pdf",
        }]),
    ])
    mock_db.commit = AsyncMock()

    # Mock del cliente de Supabase Storage
    mock_signed = MagicMock()
    mock_signed.signed_url = "https://storage.example.com/signed-url"

    with patch("app.routers.act.get_supabase_admin") as mock_get_supa:
        mock_supa = MagicMock()
        mock_get_supa.return_value = mock_supa
        mock_supa.storage.from_.return_value.create_signed_url.return_value = mock_signed

        client = make_client(student_user, mock_db)
        try:
            response = client.get(f"/api/v1/projects/{PROJECT_ID}/act")
        finally:
            app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert data["act_file_url"] == "https://storage.example.com/signed-url"
