"""
Tests de integración para FASE-05: flujo completo del anteproyecto.
Cubre MOD-05 (radicación), MOD-06 (jurados) y MOD-07 (evaluación, correcciones).
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
# Helpers (mismo patrón que test_ideas.py)
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


def make_client(user: CurrentUser, mock_db: AsyncMock, role_override=None) -> TestClient:
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
SUB_ID = uuid4()


def _future_dt(days: int = 30) -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=days)


def _past_dt(days: int = 30) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=days)


# ---------------------------------------------------------------------------
# 1. Radicar anteproyecto sin ventana activa → 409
# ---------------------------------------------------------------------------


def test_radicar_anteproyecto_sin_ventana_activa(student_user):
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        # 1. Validar pertenencia del estudiante → miembro activo
        mapping_result([{"id": uuid4()}]),
        # 2. Obtener proyecto
        mapping_result([{
            "id": PROJECT_ID, "status": "idea_aprobada",
            "period": "2026-1", "modality_id": uuid4(), "title": "T",
        }]),
        # 3. Verificar radicación existente → ninguna
        mapping_result([]),
        # 4. Ventana global → vacía
        mapping_result([]),
        # 5. Ventana extemporánea → vacía
        mapping_result([]),
    ])
    mock_db.commit = AsyncMock()

    client = make_client(student_user, mock_db)
    try:
        response = client.post(
            f"/api/v1/projects/{PROJECT_ID}/submissions",
            json={"stage": "anteproyecto"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 409
    assert "ventana" in response.json()["detail"].lower()


# ---------------------------------------------------------------------------
# 2. Confirmar radicación sin adjunto obligatorio → 400
# ---------------------------------------------------------------------------


def test_confirmar_sin_adjunto_obligatorio(student_user):
    sub_id = uuid4()
    proj_id = uuid4()
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        # 1. Validar pertenencia
        mapping_result([{"id": uuid4()}]),
        # 2. GET submission (pendiente)
        mapping_result([{
            "id": sub_id, "project_id": proj_id, "stage": "anteproyecto",
            "submitted_at": _past_dt(1), "submitted_by": student_user.id,
            "date_window_id": None, "is_extemporaneous": False,
            "revision_number": 1, "status": "pendiente",
        }]),
        # 3. GET proyecto + modalidad (no requiere aval ética)
        mapping_result([{
            "id": proj_id, "status": "idea_aprobada", "title": "T",
            "period": "2026-1", "requires_ethics_approval": False,
        }]),
        # 4. GET adjuntos → solo plantilla (falta carta_aval y reporte_similitud)
        mapping_result([{"attachment_type": "plantilla"}]),
    ])
    mock_db.commit = AsyncMock()

    client = make_client(student_user, mock_db)
    try:
        response = client.patch(f"/api/v1/projects/{proj_id}/submissions/{sub_id}/confirm")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 400
    detail = response.json()["detail"]
    missing = detail["missing"]
    assert "carta_aval" in missing or "reporte_similitud" in missing


# ---------------------------------------------------------------------------
# 3. Modalidad Investigación sin aval_etica → 400
# ---------------------------------------------------------------------------


def test_confirmar_sin_aval_etica_investigacion(student_user):
    sub_id = uuid4()
    proj_id = uuid4()
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        # 1. Validar pertenencia
        mapping_result([{"id": uuid4()}]),
        # 2. GET submission (pendiente)
        mapping_result([{
            "id": sub_id, "project_id": proj_id, "stage": "anteproyecto",
            "submitted_at": _past_dt(1), "submitted_by": student_user.id,
            "date_window_id": None, "is_extemporaneous": False,
            "revision_number": 1, "status": "pendiente",
        }]),
        # 3. GET proyecto: Investigación requiere aval ética
        mapping_result([{
            "id": proj_id, "status": "idea_aprobada", "title": "T",
            "period": "2026-1", "requires_ethics_approval": True,
        }]),
        # 4. Adjuntos: tiene plantilla + carta_aval + reporte_similitud, falta aval_etica
        mapping_result([
            {"attachment_type": "plantilla"},
            {"attachment_type": "carta_aval"},
            {"attachment_type": "reporte_similitud"},
        ]),
    ])
    mock_db.commit = AsyncMock()

    client = make_client(student_user, mock_db)
    try:
        response = client.patch(f"/api/v1/projects/{proj_id}/submissions/{sub_id}/confirm")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 400
    assert "aval_etica" in response.json()["detail"]["missing"]


# ---------------------------------------------------------------------------
# 4. Jurado no asignado intenta calificar → 403
# ---------------------------------------------------------------------------


def test_jurado_no_asignado_calificar_403(docente_user):
    proj_id = uuid4()
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        # 1. Buscar jurado asignado → no encontrado
        mapping_result([]),
    ])
    mock_db.commit = AsyncMock()

    client = make_client(docente_user, mock_db)
    try:
        response = client.post(
            f"/api/v1/projects/{proj_id}/evaluations",
            json={"stage": "anteproyecto", "score": 4.5, "observations": "Bien"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 403
    assert "jurado" in response.json()["detail"].lower()


# ---------------------------------------------------------------------------
# 5. Flujo completo: ambas calificaciones ≥ 4.0 → en_desarrollo
# ---------------------------------------------------------------------------


def test_evaluacion_ambas_aprobadas_transicion_en_desarrollo(docente_user):
    proj_id = uuid4()
    eval_id = uuid4()
    sub_id = uuid4()
    due = _future_dt(10)
    now = datetime.now(timezone.utc)

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        # 1. Buscar jurado asignado → J1
        mapping_result([{"id": uuid4(), "juror_number": 1, "stage": "anteproyecto"}]),
        # 2. Buscar evaluación pendiente (score IS NULL) → rev=1, due en el futuro
        mapping_result([{
            "id": eval_id, "project_id": proj_id, "submission_id": sub_id,
            "juror_id": docente_user.id, "juror_number": 1, "stage": "anteproyecto",
            "score": None, "observations": None, "submitted_at": None,
            "start_date": _past_dt(1), "due_date": due,
            "is_extemporaneous": False, "revision_number": 1,
        }]),
        # 3. UPDATE evaluations → calificación registrada
        mapping_result([{
            "id": eval_id, "project_id": proj_id, "submission_id": sub_id,
            "juror_id": docente_user.id, "juror_number": 1, "stage": "anteproyecto",
            "score": 4.5, "observations": "Excelente", "submitted_at": now,
            "start_date": _past_dt(1), "due_date": due,
            "is_extemporaneous": False, "revision_number": 1,
        }]),
        # --- evaluate_anteproyecto_result ---
        # 4. GET proyecto
        mapping_result([{
            "id": proj_id, "status": "anteproyecto_pendiente_evaluacion",
            "period": "2026-1", "title": "T",
        }]),
        # 5. GET scores J1/J2 → ambas calificadas (J1=4.5, J2=4.2)
        mapping_result([
            {"juror_number": 1, "score": 4.5},
            {"juror_number": 2, "score": 4.2},
        ]),
        # 6. UPDATE project → anteproyecto_aprobado
        mapping_result(),
        # 7. INSERT project_status_history (aprobado)
        mapping_result(),
        # 8. UPDATE project → en_desarrollo
        mapping_result(),
        # 9. INSERT project_status_history (en_desarrollo)
        mapping_result(),
        # 10. UPDATE submission → aprobado
        mapping_result(),
        # 11. INSERT message
        mapping_result(),
        # --- fin evaluate_anteproyecto_result ---
        # 12. SELECT full_name del jurado
        mapping_result([], scalar="Docente Prueba"),
    ])
    mock_db.commit = AsyncMock()

    client = make_client(docente_user, mock_db)
    try:
        response = client.post(
            f"/api/v1/projects/{proj_id}/evaluations",
            json={"stage": "anteproyecto", "score": 4.5, "observations": "Excelente"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201
    data = response.json()
    assert data["score"] == 4.5
    assert data["stage"] == "anteproyecto"


# ---------------------------------------------------------------------------
# 6. Flujo correcciones (3.0–3.9) → correcciones_anteproyecto_solicitadas
# ---------------------------------------------------------------------------


def test_evaluacion_correcciones_solicitadas(docente_user):
    proj_id = uuid4()
    eval_id = uuid4()
    sub_id = uuid4()
    due = _future_dt(10)
    now = datetime.now(timezone.utc)

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        # 1. Buscar jurado → J2
        mapping_result([{"id": uuid4(), "juror_number": 2, "stage": "anteproyecto"}]),
        # 2. Eval pendiente rev=1
        mapping_result([{
            "id": eval_id, "project_id": proj_id, "submission_id": sub_id,
            "juror_id": docente_user.id, "juror_number": 2, "stage": "anteproyecto",
            "score": None, "observations": None, "submitted_at": None,
            "start_date": _past_dt(1), "due_date": due,
            "is_extemporaneous": False, "revision_number": 1,
        }]),
        # 3. UPDATE evaluations → score 3.5
        mapping_result([{
            "id": eval_id, "project_id": proj_id, "submission_id": sub_id,
            "juror_id": docente_user.id, "juror_number": 2, "stage": "anteproyecto",
            "score": 3.5, "observations": "Con correcciones", "submitted_at": now,
            "start_date": _past_dt(1), "due_date": due,
            "is_extemporaneous": False, "revision_number": 1,
        }]),
        # --- evaluate_anteproyecto_result ---
        # 4. GET proyecto
        mapping_result([{
            "id": proj_id, "status": "anteproyecto_pendiente_evaluacion",
            "period": "2026-1", "title": "T",
        }]),
        # 5. GET scores J1/J2 → J1=4.0, J2=3.5 (caso correcciones: no ambas ≥4, no ambas <3, no div)
        mapping_result([
            {"juror_number": 1, "score": 4.0},
            {"juror_number": 2, "score": 3.5},
        ]),
        # 6. UPDATE project → correcciones_anteproyecto_solicitadas
        mapping_result(),
        # 7. INSERT project_status_history
        mapping_result(),
        # 8. UPDATE submission → con_correcciones
        mapping_result(),
        # 9. INSERT message
        mapping_result(),
        # 10. SELECT full_name
        mapping_result([], scalar="Docente Prueba"),
    ])
    mock_db.commit = AsyncMock()

    client = make_client(docente_user, mock_db)
    try:
        response = client.post(
            f"/api/v1/projects/{proj_id}/evaluations",
            json={"stage": "anteproyecto", "score": 3.5, "observations": "Con correcciones"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201
    assert response.json()["score"] == 3.5


# ---------------------------------------------------------------------------
# 7. Flujo reprobación unánime (ambas < 3.0) → idea_aprobada
# ---------------------------------------------------------------------------


def test_evaluacion_ambas_reprobadas_retorna_idea_aprobada(docente_user):
    proj_id = uuid4()
    eval_id = uuid4()
    sub_id = uuid4()
    due = _future_dt(10)
    now = datetime.now(timezone.utc)

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        # 1. Jurado → J1
        mapping_result([{"id": uuid4(), "juror_number": 1, "stage": "anteproyecto"}]),
        # 2. Eval pendiente
        mapping_result([{
            "id": eval_id, "project_id": proj_id, "submission_id": sub_id,
            "juror_id": docente_user.id, "juror_number": 1, "stage": "anteproyecto",
            "score": None, "observations": None, "submitted_at": None,
            "start_date": _past_dt(1), "due_date": due,
            "is_extemporaneous": False, "revision_number": 1,
        }]),
        # 3. UPDATE evaluations → score 2.0
        mapping_result([{
            "id": eval_id, "project_id": proj_id, "submission_id": sub_id,
            "juror_id": docente_user.id, "juror_number": 1, "stage": "anteproyecto",
            "score": 2.0, "observations": "Insuficiente", "submitted_at": now,
            "start_date": _past_dt(1), "due_date": due,
            "is_extemporaneous": False, "revision_number": 1,
        }]),
        # --- evaluate_anteproyecto_result ---
        # 4. GET proyecto
        mapping_result([{
            "id": proj_id, "status": "anteproyecto_pendiente_evaluacion",
            "period": "2026-1", "title": "T",
        }]),
        # 5. Scores: J1=2.0, J2=1.5 → ambas < 3.0 → reprobado
        mapping_result([
            {"juror_number": 1, "score": 2.0},
            {"juror_number": 2, "score": 1.5},
        ]),
        # 6. UPDATE project → anteproyecto_reprobado
        mapping_result(),
        # 7. INSERT history (reprobado)
        mapping_result(),
        # 8. UPDATE project → idea_aprobada
        mapping_result(),
        # 9. INSERT history (idea_aprobada)
        mapping_result(),
        # 10. UPDATE submission → reprobado
        mapping_result(),
        # 11. INSERT message
        mapping_result(),
        # 12. SELECT full_name
        mapping_result([], scalar="Docente Prueba"),
    ])
    mock_db.commit = AsyncMock()

    client = make_client(docente_user, mock_db)
    try:
        response = client.post(
            f"/api/v1/projects/{proj_id}/evaluations",
            json={"stage": "anteproyecto", "score": 2.0, "observations": "Insuficiente"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201
    assert response.json()["score"] == 2.0


# ---------------------------------------------------------------------------
# 8. Divergencia → Jurado 3 aprueba → en_desarrollo
# ---------------------------------------------------------------------------


def test_jurado3_aprueba_transicion_en_desarrollo(docente_user):
    proj_id = uuid4()
    eval_id = uuid4()
    sub_id = uuid4()
    due = _future_dt(10)
    now = datetime.now(timezone.utc)

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        # 1. Jurado → J3
        mapping_result([{"id": uuid4(), "juror_number": 3, "stage": "anteproyecto"}]),
        # 2. Eval pendiente rev=1
        mapping_result([{
            "id": eval_id, "project_id": proj_id, "submission_id": sub_id,
            "juror_id": docente_user.id, "juror_number": 3, "stage": "anteproyecto",
            "score": None, "observations": None, "submitted_at": None,
            "start_date": _past_dt(1), "due_date": due,
            "is_extemporaneous": False, "revision_number": 1,
        }]),
        # J3 score validation: no está en [3.0, 4.0) → pasa
        # 3. UPDATE evaluations → score 4.0
        mapping_result([{
            "id": eval_id, "project_id": proj_id, "submission_id": sub_id,
            "juror_id": docente_user.id, "juror_number": 3, "stage": "anteproyecto",
            "score": 4.0, "observations": "Aprobado por J3", "submitted_at": now,
            "start_date": _past_dt(1), "due_date": due,
            "is_extemporaneous": False, "revision_number": 1,
        }]),
        # --- evaluate_j3_result ---
        # 4. GET proyecto
        mapping_result([{
            "id": proj_id, "status": "anteproyecto_pendiente_evaluacion",
            "period": "2026-1", "title": "T",
        }]),
        # 5. GET score J3 → 4.0
        mapping_result([{"score": 4.0}]),
        # 6. UPDATE project → anteproyecto_aprobado
        mapping_result(),
        # 7. INSERT history (aprobado)
        mapping_result(),
        # 8. UPDATE project → en_desarrollo
        mapping_result(),
        # 9. INSERT history (en_desarrollo)
        mapping_result(),
        # 10. UPDATE submission → aprobado
        mapping_result(),
        # 11. INSERT message
        mapping_result(),
        # 12. SELECT full_name
        mapping_result([], scalar="Docente Prueba"),
    ])
    mock_db.commit = AsyncMock()

    client = make_client(docente_user, mock_db)
    try:
        response = client.post(
            f"/api/v1/projects/{proj_id}/evaluations",
            json={"stage": "anteproyecto", "score": 4.0, "observations": "Aprobado por J3"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201
    assert response.json()["score"] == 4.0


# ---------------------------------------------------------------------------
# 9. Divergencia → Jurado 3 reprueba → idea_aprobada
# ---------------------------------------------------------------------------


def test_jurado3_reprueba_transicion_idea_aprobada(docente_user):
    proj_id = uuid4()
    eval_id = uuid4()
    sub_id = uuid4()
    due = _future_dt(10)
    now = datetime.now(timezone.utc)

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        # 1. Jurado → J3
        mapping_result([{"id": uuid4(), "juror_number": 3, "stage": "anteproyecto"}]),
        # 2. Eval pendiente
        mapping_result([{
            "id": eval_id, "project_id": proj_id, "submission_id": sub_id,
            "juror_id": docente_user.id, "juror_number": 3, "stage": "anteproyecto",
            "score": None, "observations": None, "submitted_at": None,
            "start_date": _past_dt(1), "due_date": due,
            "is_extemporaneous": False, "revision_number": 1,
        }]),
        # 3. UPDATE evaluations → score 2.5
        mapping_result([{
            "id": eval_id, "project_id": proj_id, "submission_id": sub_id,
            "juror_id": docente_user.id, "juror_number": 3, "stage": "anteproyecto",
            "score": 2.5, "observations": "Reprobado J3", "submitted_at": now,
            "start_date": _past_dt(1), "due_date": due,
            "is_extemporaneous": False, "revision_number": 1,
        }]),
        # --- evaluate_j3_result ---
        # 4. GET proyecto
        mapping_result([{
            "id": proj_id, "status": "anteproyecto_pendiente_evaluacion",
            "period": "2026-1", "title": "T",
        }]),
        # 5. GET score J3 → 2.5
        mapping_result([{"score": 2.5}]),
        # 6. UPDATE project → anteproyecto_reprobado
        mapping_result(),
        # 7. INSERT history (reprobado)
        mapping_result(),
        # 8. UPDATE project → idea_aprobada
        mapping_result(),
        # 9. INSERT history (idea_aprobada)
        mapping_result(),
        # 10. UPDATE submission → reprobado
        mapping_result(),
        # 11. INSERT message
        mapping_result(),
        # 12. SELECT full_name
        mapping_result([], scalar="Docente Prueba"),
    ])
    mock_db.commit = AsyncMock()

    client = make_client(docente_user, mock_db)
    try:
        response = client.post(
            f"/api/v1/projects/{proj_id}/evaluations",
            json={"stage": "anteproyecto", "score": 2.5, "observations": "Reprobado J3"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201
    assert response.json()["score"] == 2.5


# ---------------------------------------------------------------------------
# 10. Entrega de correcciones con plazo vencido y sin ventana activa → 409
# ---------------------------------------------------------------------------


def test_correcciones_vencidas_sin_ventana_409(student_user):
    proj_id = uuid4()
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        # 1. Validar pertenencia
        mapping_result([{"id": uuid4()}]),
        # 2. GET proyecto
        mapping_result([{
            "id": proj_id, "status": "correcciones_anteproyecto_solicitadas",
            "period": "2026-1", "modality_id": uuid4(), "title": "T",
        }]),
        # 3. Verificar corrección existente → ninguna
        mapping_result([]),
        # --- check_correction_window ---
        # 4. Ventana global → vacía
        mapping_result([]),
        # 5. Historial → changed_at hace 30 días (plazo de 10 días hábiles vencido)
        mapping_result([{"changed_at": _past_dt(30)}]),
    ])
    mock_db.commit = AsyncMock()

    client = make_client(student_user, mock_db)
    try:
        response = client.post(
            f"/api/v1/projects/{proj_id}/submissions",
            json={"stage": "anteproyecto", "is_correction": True},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 409
    assert "plazo" in response.json()["detail"].lower()


# ---------------------------------------------------------------------------
# 11. Segunda revisión: score [3.0, 4.0) → 400
# ---------------------------------------------------------------------------


def test_segunda_revision_no_acepta_correcciones(docente_user):
    proj_id = uuid4()
    eval_id = uuid4()
    sub_id = uuid4()
    due = _future_dt(10)

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        # 1. Jurado → J1
        mapping_result([{"id": uuid4(), "juror_number": 1, "stage": "anteproyecto"}]),
        # 2. Eval pendiente → revision_number = 2
        mapping_result([{
            "id": eval_id, "project_id": proj_id, "submission_id": sub_id,
            "juror_id": docente_user.id, "juror_number": 1, "stage": "anteproyecto",
            "score": None, "observations": None, "submitted_at": None,
            "start_date": _past_dt(1), "due_date": due,
            "is_extemporaneous": False, "revision_number": 2,
        }]),
    ])
    mock_db.commit = AsyncMock()

    client = make_client(docente_user, mock_db)
    try:
        response = client.post(
            f"/api/v1/projects/{proj_id}/evaluations",
            json={"stage": "anteproyecto", "score": 3.5, "observations": "Solo correcciones"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 400
    assert "segunda revisión" in response.json()["detail"].lower()


# ---------------------------------------------------------------------------
# 12. Calificación extemporánea marcada correctamente
# ---------------------------------------------------------------------------


def test_calificacion_extemporanea_marcada(docente_user):
    proj_id = uuid4()
    eval_id = uuid4()
    sub_id = uuid4()
    # due_date ya venció
    due = _past_dt(5)
    now = datetime.now(timezone.utc)

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        # 1. Jurado → J2
        mapping_result([{"id": uuid4(), "juror_number": 2, "stage": "anteproyecto"}]),
        # 2. Eval pendiente → due_date pasado
        mapping_result([{
            "id": eval_id, "project_id": proj_id, "submission_id": sub_id,
            "juror_id": docente_user.id, "juror_number": 2, "stage": "anteproyecto",
            "score": None, "observations": None, "submitted_at": None,
            "start_date": _past_dt(20), "due_date": due,
            "is_extemporaneous": False, "revision_number": 1,
        }]),
        # 3. UPDATE evaluations → is_extemporaneous=True
        mapping_result([{
            "id": eval_id, "project_id": proj_id, "submission_id": sub_id,
            "juror_id": docente_user.id, "juror_number": 2, "stage": "anteproyecto",
            "score": 4.0, "observations": "Tardía", "submitted_at": now,
            "start_date": _past_dt(20), "due_date": due,
            "is_extemporaneous": True, "revision_number": 1,
        }]),
        # --- evaluate_anteproyecto_result → solo J2 calificó aún, retorna sin acción ---
        # 4. GET proyecto
        mapping_result([{
            "id": proj_id, "status": "anteproyecto_pendiente_evaluacion",
            "period": "2026-1", "title": "T",
        }]),
        # 5. Scores → solo J2 (J1 aún no calificó)
        mapping_result([{"juror_number": 2, "score": 4.0}]),
        # 6. SELECT full_name
        mapping_result([], scalar="Docente Prueba"),
    ])
    mock_db.commit = AsyncMock()

    client = make_client(docente_user, mock_db)
    try:
        response = client.post(
            f"/api/v1/projects/{proj_id}/evaluations",
            json={"stage": "anteproyecto", "score": 4.0, "observations": "Tardía"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201
    assert response.json()["is_extemporaneous"] is True


# ---------------------------------------------------------------------------
# 13. Estudiante ve jurados sin identidad (anonimato)
# ---------------------------------------------------------------------------


def test_estudiante_ve_jurados_anonimos(student_user):
    proj_id = uuid4()
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        # 1. _check_membership → miembro activo
        mapping_result([{"id": uuid4()}]),
        # 2. GET jurados (solo juror_number, stage, is_active para estudiante)
        mapping_result([
            {"juror_number": 1, "stage": "anteproyecto", "is_active": True},
            {"juror_number": 2, "stage": "anteproyecto", "is_active": True},
        ]),
    ])
    mock_db.commit = AsyncMock()

    client = make_client(student_user, mock_db)
    try:
        response = client.get(f"/api/v1/projects/{proj_id}/jurors")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    jurors = response.json()
    assert len(jurors) == 2
    # Los estudiantes no deben ver docente_id ni full_name
    for j in jurors:
        assert "docente_id" not in j
        assert "full_name" not in j
        assert "juror_number" in j
