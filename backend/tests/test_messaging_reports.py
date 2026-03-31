"""
Tests de integración para FASE-08: mensajería, historial y reportes.
Cubre MOD-15 (mensajes), MOD-16 (historial), MOD-17 (reportes).
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Optional
from unittest.mock import AsyncMock, MagicMock
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


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _past_dt(days: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=days)


def _future_date(days: int) -> date:
    return (datetime.now(timezone.utc) + timedelta(days=days)).date()


def _past_date(days: int) -> date:
    return (datetime.now(timezone.utc) - timedelta(days=days)).date()


# ---------------------------------------------------------------------------
# 1. Estudiante envía mensaje a Jurado → 201, sender_display es nombre real
# ---------------------------------------------------------------------------


def test_estudiante_envia_mensaje_a_jurado(student_user):
    proj_id = uuid4()
    jurado_id = uuid4()
    msg_id = uuid4()
    now = _now()

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        # _check_membership_and_get_role (estudiante)
        # 1. SELECT project_members → encontrado
        mapping_result([{"id": uuid4()}]),
        # _get_recipient_project_role (jurado_id)
        # 2. SELECT role FROM users → docente
        mapping_result([{"role": "docente"}]),
        # 3. SELECT project_directors → no es director
        mapping_result([]),
        # 4. SELECT project_jurors → es jurado
        mapping_result([{"id": uuid4()}]),
        # sender_display: estudiante → nombre real
        # 5. SELECT full_name FROM users
        mapping_result([{"full_name": "Ana García"}]),
        # 6. INSERT INTO messages RETURNING
        mapping_result([{
            "id": msg_id,
            "sender_display": "Ana García",
            "content": "Hola jurado",
            "is_read": False,
            "sent_at": now,
        }]),
    ])
    mock_db.commit = AsyncMock()

    client = make_client(student_user, mock_db)
    try:
        response = client.post(
            f"/api/v1/projects/{proj_id}/messages",
            json={"content": "Hola jurado", "recipient_id": str(jurado_id)},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201
    data = response.json()
    assert data["sender_display"] == "Ana García"
    assert data["content"] == "Hola jurado"
    assert data["is_read"] is False


# ---------------------------------------------------------------------------
# 2. Jurado envía mensaje al Estudiante → sender_display = "Jurado N"
# ---------------------------------------------------------------------------


def test_jurado_envia_mensaje_a_estudiante_anonimato(docente_user):
    proj_id = uuid4()
    student_id = uuid4()
    msg_id = uuid4()
    now = _now()

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        # _check_membership_and_get_role (docente)
        # 1. SELECT project_directors → no director
        mapping_result([]),
        # 2. SELECT project_jurors → jurado 2
        mapping_result([{"juror_number": 2}]),
        # _get_recipient_project_role (student_id)
        # 3. SELECT role FROM users → estudiante
        mapping_result([{"role": "estudiante"}]),
        # 4. SELECT project_members → encontrado
        mapping_result([{"id": uuid4()}]),
        # sender_display: jurado → "Jurado 2" (sin query extra)
        # 5. INSERT INTO messages RETURNING
        mapping_result([{
            "id": msg_id,
            "sender_display": "Jurado 2",
            "content": "Revise las correcciones",
            "is_read": False,
            "sent_at": now,
        }]),
    ])
    mock_db.commit = AsyncMock()

    client = make_client(docente_user, mock_db)
    try:
        response = client.post(
            f"/api/v1/projects/{proj_id}/messages",
            json={"content": "Revise las correcciones", "recipient_id": str(student_id)},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201
    data = response.json()
    assert data["sender_display"] == "Jurado 2"


# ---------------------------------------------------------------------------
# 3. Jurado intenta enviar mensaje al Admin → 403
# ---------------------------------------------------------------------------


def test_jurado_no_puede_enviar_a_admin(docente_user):
    proj_id = uuid4()
    admin_id = uuid4()

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        # _check_membership_and_get_role (docente)
        # 1. SELECT project_directors → no
        mapping_result([]),
        # 2. SELECT project_jurors → jurado 1
        mapping_result([{"juror_number": 1}]),
        # _get_recipient_project_role (admin_id)
        # 3. SELECT role FROM users → administrador
        mapping_result([{"role": "administrador"}]),
        # No project_members check needed for admin role
    ])
    mock_db.commit = AsyncMock()

    client = make_client(docente_user, mock_db)
    try:
        response = client.post(
            f"/api/v1/projects/{proj_id}/messages",
            json={"content": "Mensaje al admin", "recipient_id": str(admin_id)},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 403


# ---------------------------------------------------------------------------
# 4. Marcar como leído por usuario que no es receptor → 403
# ---------------------------------------------------------------------------


def test_marcar_leido_no_receptor_devuelve_403(student_user):
    proj_id = uuid4()
    msg_id = uuid4()
    otro_user_id = uuid4()  # el receptor real es otro usuario

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        # _check_membership_and_get_role (estudiante)
        # 1. SELECT project_members → encontrado
        mapping_result([{"id": uuid4()}]),
        # 2. SELECT message → recipient_id = otro_user_id (distinto al solicitante)
        mapping_result([{
            "id": msg_id,
            "project_id": proj_id,
            "recipient_id": otro_user_id,
            "sender_display": "Sistema",
            "content": "Mensaje",
            "is_read": False,
            "sent_at": _now(),
        }]),
    ])
    mock_db.commit = AsyncMock()

    client = make_client(student_user, mock_db)
    try:
        response = client.patch(
            f"/api/v1/projects/{proj_id}/messages/{msg_id}/read"
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 403


# ---------------------------------------------------------------------------
# 5. Historial incluye cambios de estado en orden cronológico
# ---------------------------------------------------------------------------


def test_historial_incluye_cambios_de_estado_ordenados(admin_user):
    proj_id = uuid4()
    t1 = _now() - timedelta(days=10)
    t2 = _now() - timedelta(days=5)
    t3 = _now() - timedelta(days=1)

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        # _check_membership (admin)
        # 1. SELECT id FROM thesis_projects → existe
        mapping_result([{"id": proj_id}]),
        # 2. SELECT project_status_history → 2 eventos
        mapping_result([
            {
                "previous_status": None,
                "new_status": "idea_registrada",
                "changed_by_name": "Admin",
                "reason": None,
                "changed_at": t1,
            },
            {
                "previous_status": "idea_registrada",
                "new_status": "idea_aprobada",
                "changed_by_name": "Admin",
                "reason": None,
                "changed_at": t3,  # más reciente, pero el sort lo pondrá después
            },
        ]),
        # 3. SELECT attachments → vacío
        mapping_result([]),
        # 4. SELECT evaluations (admin) → vacío
        mapping_result([]),
    ])
    mock_db.commit = AsyncMock()

    client = make_client(admin_user, mock_db)
    try:
        response = client.get(f"/api/v1/projects/{proj_id}/history")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["type"] == "status_change"
    assert data[0]["new_status"] == "idea_registrada"
    assert data[1]["new_status"] == "idea_aprobada"
    # Verificar orden cronológico ASC
    assert data[0]["changed_at"] < data[1]["changed_at"]


# ---------------------------------------------------------------------------
# 6. Historial no revela juror_id al Estudiante
# ---------------------------------------------------------------------------


def test_historial_no_revela_jurado_al_estudiante(student_user):
    proj_id = uuid4()
    now = _now()

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        # _check_membership (estudiante)
        # 1. SELECT project_members → encontrado
        mapping_result([{"id": uuid4()}]),
        # 2. SELECT project_status_history → vacío
        mapping_result([]),
        # 3. SELECT attachments → vacío
        mapping_result([]),
        # 4. SELECT evaluations SIN juror_name (query para no-admin)
        mapping_result([{
            "juror_number": 1,
            "score": 4.0,
            "stage": "anteproyecto",
            "submitted_at": now,
            "is_extemporaneous": False,
        }]),
    ])
    mock_db.commit = AsyncMock()

    client = make_client(student_user, mock_db)
    try:
        response = client.get(f"/api/v1/projects/{proj_id}/history")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    eval_events = [e for e in data if e["type"] == "evaluation_submitted"]
    assert len(eval_events) == 1
    # El campo juror_name no debe estar presente o debe ser null
    assert eval_events[0].get("juror_name") is None


# ---------------------------------------------------------------------------
# 7. Reporte de jurados extemporáneos incluye days_late correcto
# ---------------------------------------------------------------------------


def test_reporte_jurados_late_incluye_days_late(admin_user):
    submitted = _now() - timedelta(days=2)
    due = (_now() - timedelta(days=5)).date()

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        mapping_result([{
            "docente_name": "Prof. Pérez",
            "project_title": "Trabajo A",
            "stage": "anteproyecto",
            "deadline_date": due,
            "submitted_at": submitted,
            "days_late": 3,
        }]),
    ])
    mock_db.commit = AsyncMock()

    client = make_client(admin_user, mock_db)
    try:
        response = client.get("/api/v1/reports/jurors/late")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["docente_name"] == "Prof. Pérez"
    assert data[0]["days_late"] == 3
    assert data[0]["stage"] == "anteproyecto"


# ---------------------------------------------------------------------------
# 8. Reporte de vencimiento próximo filtra correctamente por N días
# ---------------------------------------------------------------------------


def test_reporte_jurados_expiring_filtra_por_dias(admin_user):
    # Una evaluación vence en 2 días hábiles y otra en 10 días hábiles
    # Con days=3, solo debe aparecer la primera
    near_deadline = _future_date(2)
    far_deadline = _future_date(10)
    period = "2026-1"

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        mapping_result([
            {
                "docente_name": "Prof. García",
                "project_title": "Trabajo B",
                "stage": "producto_final",
                "deadline_date": near_deadline,
                "period": period,
            },
            {
                "docente_name": "Prof. López",
                "project_title": "Trabajo C",
                "stage": "anteproyecto",
                "deadline_date": far_deadline,
                "period": period,
            },
        ]),
    ])
    mock_db.commit = AsyncMock()

    client = make_client(admin_user, mock_db)
    try:
        response = client.get("/api/v1/reports/jurors/expiring?days=3")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    # Solo el que vence en 2 días debe pasar el filtro de ≤3 días hábiles
    titles = [item["project_title"] for item in data]
    assert "Trabajo B" in titles
    assert "Trabajo C" not in titles
