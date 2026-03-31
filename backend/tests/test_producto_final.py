"""
Tests de integración para FASE-06: flujo completo del producto final.
Cubre MOD-09 (radicación), MOD-10 (jurados / evaluación), MOD-11 (correcciones),
MOD-14 (suspensión por plagio).
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
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
# Helpers (mismo patrón que test_anteproyecto.py)
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
SUB_ID = uuid4()


def _future_dt(days: int = 30) -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=days)


def _past_dt(days: int = 30) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=days)


def _project_row(status: str = "en_desarrollo", period: str = "2026-1") -> dict:
    """Fila completa compatible con _SELECT_PROJECT."""
    return {
        "id": PROJECT_ID,
        "title": "Proyecto de prueba",
        "modality_id": uuid4(),
        "academic_program_id": uuid4(),
        "research_group": "GI",
        "research_line": "RL",
        "suggested_director": None,
        "period": period,
        "status": status,
        "has_company_link": False,
        "plagiarism_suspended": False,
        "created_at": _past_dt(10),
        "updated_at": _past_dt(1),
    }


def _eval_row(
    juror_number: int = 1,
    stage: str = "producto_final",
    revision_number: int = 1,
    score=None,
) -> dict:
    """Fila de evaluations compatible con _SELECT_EVAL."""
    return {
        "id": uuid4(),
        "project_id": PROJECT_ID,
        "submission_id": SUB_ID,
        "juror_id": uuid4(),
        "juror_number": juror_number,
        "stage": stage,
        "score": score,
        "observations": None,
        "submitted_at": None if score is None else datetime.now(timezone.utc),
        "start_date": _past_dt(5),
        "due_date": _future_dt(10),
        "is_extemporaneous": False,
        "revision_number": revision_number,
    }


# ---------------------------------------------------------------------------
# 1. Radicar producto final sin ventana activa → 409
# ---------------------------------------------------------------------------


def test_radicar_producto_final_sin_ventana_activa(student_user):
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        # 1. membership check → miembro activo
        mapping_result([{"id": uuid4()}]),
        # 2. proyecto → en_desarrollo
        mapping_result([{
            "id": PROJECT_ID, "status": "en_desarrollo",
            "period": "2026-1", "modality_id": uuid4(), "title": "T",
        }]),
        # _create_producto_final_submission:
        # 3. radicación existente → ninguna
        mapping_result([]),
        # 4. ventana global radicacion_producto_final → ninguna
        mapping_result([]),
        # 5. ventana extemporánea → ninguna
        mapping_result([]),
    ])
    mock_db.commit = AsyncMock()

    client = make_client(student_user, mock_db)
    try:
        response = client.post(
            f"/api/v1/projects/{PROJECT_ID}/submissions",
            json={"stage": "producto_final"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 409
    assert "ventana" in response.json()["detail"].lower()


# ---------------------------------------------------------------------------
# 2. Innovación sin certificacion_plan_negocio → 400
# ---------------------------------------------------------------------------


def test_confirmar_producto_final_innovacion_sin_cert_plan_negocio(student_user):
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        # 1. membership → miembro activo
        mapping_result([{"id": uuid4()}]),
        # 2. GET submission → pendiente, stage=producto_final
        mapping_result([{
            "id": SUB_ID, "project_id": PROJECT_ID, "stage": "producto_final",
            "submitted_at": _past_dt(1), "submitted_by": student_user.id,
            "date_window_id": None, "is_extemporaneous": False,
            "revision_number": 1, "status": "pendiente",
        }]),
        # 3. proyecto + modalidad → Innovación requiere cert plan de negocio
        mapping_result([{
            "id": PROJECT_ID, "status": "en_desarrollo", "title": "T",
            "period": "2026-1",
            "requires_ethics_approval": False,
            "requires_business_plan_cert": True,
        }]),
        # 4. adjuntos → sin certificacion_plan_negocio
        mapping_result([
            {"attachment_type": "plantilla"},
            {"attachment_type": "carta_aval"},
            {"attachment_type": "reporte_similitud"},
        ]),
    ])
    mock_db.commit = AsyncMock()

    client = make_client(student_user, mock_db)
    try:
        response = client.patch(
            f"/api/v1/projects/{PROJECT_ID}/submissions/{SUB_ID}/confirm"
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 400
    detail = response.json()["detail"]
    assert "certificacion_plan_negocio" in detail["missing"]


# ---------------------------------------------------------------------------
# 3. Producto final aprobado (ambas ≥ 4.0) → aprobado_para_sustentacion
# ---------------------------------------------------------------------------


def test_evaluacion_producto_final_ambas_aprobadas(docente_user):
    eval_row_initial = _eval_row(juror_number=2, stage="producto_final", revision_number=1)
    eval_row_updated = {**eval_row_initial, "score": 4.5, "submitted_at": datetime.now(timezone.utc)}

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        # 1. jurado asignado → J2
        mapping_result([{"id": uuid4(), "juror_number": 2, "stage": "producto_final"}]),
        # 2. guard: proyecto no suspendido
        mapping_result([{"status": "en_revision_jurados_producto_final"}]),
        # 3. eval pendiente (score IS NULL) → rev=1
        mapping_result([eval_row_initial]),
        # 4. UPDATE evaluations SET score
        mapping_result([eval_row_updated]),
        # --- evaluate_producto_final_result ---
        # 5. GET proyecto
        mapping_result([{
            "id": PROJECT_ID, "status": "en_revision_jurados_producto_final",
            "period": "2026-1", "title": "T",
        }]),
        # 6. scores J1/J2 → ambas aprobadas
        mapping_result([
            {"juror_number": 1, "score": 4.5},
            {"juror_number": 2, "score": 4.5},
        ]),
        # --- _approved_transition → _is_diplomado ---
        # 7. modalidad → requiere sustentación (no Diplomado)
        mapping_result([{"requires_sustentation": True}]),
        # 8. UPDATE project → producto_final_aprobado
        mapping_result(),
        # 9. INSERT history (aprobado)
        mapping_result(),
        # 10. UPDATE project → aprobado_para_sustentacion
        mapping_result(),
        # 11. INSERT history (aprobado_para_sustentacion)
        mapping_result(),
        # 12. UPDATE submission → aprobado
        mapping_result(),
        # 13. INSERT message → estudiante
        mapping_result(),
        # --- fin evaluate_producto_final_result ---
        # 14. SELECT full_name del docente
        mapping_result([], scalar="Docente Prueba"),
    ])
    mock_db.commit = AsyncMock()

    client = make_client(docente_user, mock_db)
    try:
        response = client.post(
            f"/api/v1/projects/{PROJECT_ID}/evaluations",
            json={"stage": "producto_final", "score": 4.5, "observations": "Bien"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201
    assert response.json()["score"] == 4.5
    assert response.json()["stage"] == "producto_final"


# ---------------------------------------------------------------------------
# 4. Diplomado tecnológico aprobado → trabajo_aprobado (sin sustentación)
# ---------------------------------------------------------------------------


def test_evaluacion_diplomado_aprobado_trabajo_aprobado(docente_user):
    eval_row_initial = _eval_row(juror_number=2, stage="producto_final", revision_number=1)
    eval_row_updated = {**eval_row_initial, "score": 4.8, "submitted_at": datetime.now(timezone.utc)}

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        # 1. jurado → J2
        mapping_result([{"id": uuid4(), "juror_number": 2, "stage": "producto_final"}]),
        # 2. guard: no suspendido
        mapping_result([{"status": "en_revision_jurados_producto_final"}]),
        # 3. eval pendiente rev=1
        mapping_result([eval_row_initial]),
        # 4. UPDATE evaluations
        mapping_result([eval_row_updated]),
        # 5. GET proyecto
        mapping_result([{
            "id": PROJECT_ID, "status": "en_revision_jurados_producto_final",
            "period": "2026-1", "title": "T",
        }]),
        # 6. scores → ambas >= 4.0
        mapping_result([
            {"juror_number": 1, "score": 4.8},
            {"juror_number": 2, "score": 4.8},
        ]),
        # 7. modalidad → Diplomado tecnológico (no requiere sustentación)
        mapping_result([{"requires_sustentation": False}]),
        # 8. UPDATE → producto_final_aprobado
        mapping_result(),
        # 9. INSERT history (aprobado)
        mapping_result(),
        # 10. UPDATE → trabajo_aprobado
        mapping_result(),
        # 11. INSERT history (trabajo_aprobado)
        mapping_result(),
        # 12. UPDATE submission → aprobado
        mapping_result(),
        # 13. INSERT message
        mapping_result(),
        # 14. SELECT full_name
        mapping_result([], scalar="Docente Diplomado"),
    ])
    mock_db.commit = AsyncMock()

    client = make_client(docente_user, mock_db)
    try:
        response = client.post(
            f"/api/v1/projects/{PROJECT_ID}/evaluations",
            json={"stage": "producto_final", "score": 4.8, "observations": "Excelente"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201
    assert response.json()["score"] == 4.8


# ---------------------------------------------------------------------------
# 5. Producto final reprobado (ambas < 3.0) → en_desarrollo (no idea_aprobada)
# ---------------------------------------------------------------------------


def test_evaluacion_producto_final_reprobado_retorna_en_desarrollo(docente_user):
    eval_row_initial = _eval_row(juror_number=1, stage="producto_final", revision_number=1)
    eval_row_updated = {**eval_row_initial, "score": 2.0, "submitted_at": datetime.now(timezone.utc)}

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        # 1. jurado → J1
        mapping_result([{"id": uuid4(), "juror_number": 1, "stage": "producto_final"}]),
        # 2. guard
        mapping_result([{"status": "en_revision_jurados_producto_final"}]),
        # 3. eval pendiente
        mapping_result([eval_row_initial]),
        # 4. UPDATE eval
        mapping_result([eval_row_updated]),
        # 5. GET proyecto
        mapping_result([{
            "id": PROJECT_ID, "status": "en_revision_jurados_producto_final",
            "period": "2026-1", "title": "T",
        }]),
        # 6. scores → ambas < 3.0
        mapping_result([
            {"juror_number": 1, "score": 2.0},
            {"juror_number": 2, "score": 2.5},
        ]),
        # _reprobado_transition (sin _is_diplomado)
        # 7. UPDATE → producto_final_reprobado
        mapping_result(),
        # 8. INSERT history (reprobado)
        mapping_result(),
        # 9. UPDATE → en_desarrollo
        mapping_result(),
        # 10. INSERT history (en_desarrollo)
        mapping_result(),
        # 11. UPDATE submission → reprobado
        mapping_result(),
        # 12. INSERT message
        mapping_result(),
        # 13. SELECT full_name
        mapping_result([], scalar="Docente Prueba"),
    ])
    mock_db.commit = AsyncMock()

    client = make_client(docente_user, mock_db)
    try:
        response = client.post(
            f"/api/v1/projects/{PROJECT_ID}/evaluations",
            json={"stage": "producto_final", "score": 2.0, "observations": "Reprobado"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201
    assert response.json()["score"] == 2.0


# ---------------------------------------------------------------------------
# 6. Divergencia → J3 aprueba → aprobado_para_sustentacion
# ---------------------------------------------------------------------------


def test_j3_aprueba_producto_final(docente_user):
    eval_row_initial = _eval_row(juror_number=3, stage="producto_final", revision_number=1)
    eval_row_updated = {**eval_row_initial, "score": 4.5, "submitted_at": datetime.now(timezone.utc)}

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        # 1. jurado → J3
        mapping_result([{"id": uuid4(), "juror_number": 3, "stage": "producto_final"}]),
        # 2. guard: no suspendido
        mapping_result([{"status": "en_revision_jurados_producto_final"}]),
        # 3. eval pendiente J3 rev=1
        mapping_result([eval_row_initial]),
        # 4. UPDATE eval → 4.5 (J3, >= 4.0: no bloqueo)
        mapping_result([eval_row_updated]),
        # --- evaluate_j3_producto_final_result ---
        # 5. GET proyecto
        mapping_result([{
            "id": PROJECT_ID, "status": "en_revision_jurados_producto_final",
            "period": "2026-1", "title": "T",
        }]),
        # 6. J3 score → aprueba
        mapping_result([{"score": 4.5}]),
        # --- _approved_transition → _is_diplomado ---
        # 7. modalidad → requiere sustentación
        mapping_result([{"requires_sustentation": True}]),
        # 8. UPDATE → producto_final_aprobado
        mapping_result(),
        # 9. INSERT history
        mapping_result(),
        # 10. UPDATE → aprobado_para_sustentacion
        mapping_result(),
        # 11. INSERT history
        mapping_result(),
        # 12. UPDATE submission → aprobado
        mapping_result(),
        # 13. INSERT message
        mapping_result(),
        # 14. SELECT full_name
        mapping_result([], scalar="Docente J3"),
    ])
    mock_db.commit = AsyncMock()

    client = make_client(docente_user, mock_db)
    try:
        response = client.post(
            f"/api/v1/projects/{PROJECT_ID}/evaluations",
            json={"stage": "producto_final", "score": 4.5, "observations": "J3 aprueba"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201
    assert response.json()["score"] == 4.5


# ---------------------------------------------------------------------------
# 7. Correcciones → segunda revisión → aprobado → aprobado_para_sustentacion
# ---------------------------------------------------------------------------


def test_segunda_revision_producto_final_aprobado(docente_user):
    # La segunda revisión usa stage="producto_final" y revision_number=2
    eval_row_initial = _eval_row(juror_number=1, stage="producto_final", revision_number=2)
    eval_row_updated = {**eval_row_initial, "score": 4.5, "submitted_at": datetime.now(timezone.utc)}

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        # 1. jurado → J1 (stage="producto_final")
        mapping_result([{"id": uuid4(), "juror_number": 1, "stage": "producto_final"}]),
        # 2. guard: no suspendido
        mapping_result([{"status": "producto_final_corregido_entregado"}]),
        # 3. eval pendiente stage="producto_final", score IS NULL → rev=2
        mapping_result([eval_row_initial]),
        # (J1, rev=2, score=4.5: 3.0<=4.5<4.0? No → no bloqueo)
        # 4. UPDATE eval
        mapping_result([eval_row_updated]),
        # --- evaluate_producto_final_result(revision_number=2) ---
        # 5. GET proyecto
        mapping_result([{
            "id": PROJECT_ID, "status": "producto_final_corregido_entregado",
            "period": "2026-1", "title": "T",
        }]),
        # 6. scores rev=2 → J1=4.5, J2=4.5
        mapping_result([
            {"juror_number": 1, "score": 4.5},
            {"juror_number": 2, "score": 4.5},
        ]),
        # --- _approved_transition (stage="correcciones_producto_final") ---
        # 7. _is_diplomado
        mapping_result([{"requires_sustentation": True}]),
        # 8. UPDATE → producto_final_aprobado
        mapping_result(),
        # 9. INSERT history
        mapping_result(),
        # 10. UPDATE → aprobado_para_sustentacion
        mapping_result(),
        # 11. INSERT history
        mapping_result(),
        # 12. UPDATE submission (correcciones_producto_final, rev=2) → aprobado
        mapping_result(),
        # 13. INSERT message
        mapping_result(),
        # 14. SELECT full_name
        mapping_result([], scalar="Docente Rev2"),
    ])
    mock_db.commit = AsyncMock()

    client = make_client(docente_user, mock_db)
    try:
        response = client.post(
            f"/api/v1/projects/{PROJECT_ID}/evaluations",
            json={"stage": "producto_final", "score": 4.5, "observations": "Aprobado en segunda revisión"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201
    assert response.json()["score"] == 4.5


# ---------------------------------------------------------------------------
# 8. Correcciones → segunda revisión → reprobado → en_desarrollo
# ---------------------------------------------------------------------------


def test_segunda_revision_producto_final_reprobado(docente_user):
    eval_row_initial = _eval_row(juror_number=1, stage="producto_final", revision_number=2)
    eval_row_updated = {**eval_row_initial, "score": 2.0, "submitted_at": datetime.now(timezone.utc)}

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        # 1. jurado → J1
        mapping_result([{"id": uuid4(), "juror_number": 1, "stage": "producto_final"}]),
        # 2. guard
        mapping_result([{"status": "producto_final_corregido_entregado"}]),
        # 3. eval pendiente rev=2
        mapping_result([eval_row_initial]),
        # (J1, rev=2, score=2.0: 3.0<=2.0<4.0? No, 2.0<3.0 → no bloqueo)
        # 4. UPDATE eval
        mapping_result([eval_row_updated]),
        # 5. GET proyecto
        mapping_result([{
            "id": PROJECT_ID, "status": "producto_final_corregido_entregado",
            "period": "2026-1", "title": "T",
        }]),
        # 6. scores rev=2 → J1=2.0, J2=1.5 (ambas < 3.0)
        mapping_result([
            {"juror_number": 1, "score": 2.0},
            {"juror_number": 2, "score": 1.5},
        ]),
        # _reprobado_transition (stage="correcciones_producto_final")
        # 7. UPDATE → producto_final_reprobado
        mapping_result(),
        # 8. INSERT history
        mapping_result(),
        # 9. UPDATE → en_desarrollo
        mapping_result(),
        # 10. INSERT history
        mapping_result(),
        # 11. UPDATE submission → reprobado
        mapping_result(),
        # 12. INSERT message
        mapping_result(),
        # 13. SELECT full_name
        mapping_result([], scalar="Docente Rev2"),
    ])
    mock_db.commit = AsyncMock()

    client = make_client(docente_user, mock_db)
    try:
        response = client.post(
            f"/api/v1/projects/{PROJECT_ID}/evaluations",
            json={"stage": "producto_final", "score": 2.0, "observations": "Reprobado en segunda revisión"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201
    assert response.json()["score"] == 2.0


# ---------------------------------------------------------------------------
# 9. Suspensión por plagio en estado en_desarrollo → suspendido_por_plagio
# ---------------------------------------------------------------------------


def test_suspender_plagio_en_desarrollo(admin_user):
    project_row = _project_row(status="en_desarrollo")
    project_row_suspended = {**project_row, "status": "suspendido_por_plagio"}

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        # 1. GET proyecto (load para update_project_status)
        mapping_result([project_row]),
        # 2. UPDATE → suspendido_por_plagio (RETURNING)
        mapping_result([project_row_suspended]),
        # 3. INSERT history
        mapping_result(),
        # 4. INSERT message → estudiante
        mapping_result(),
    ])
    mock_db.commit = AsyncMock()

    client = make_client(admin_user, mock_db)
    try:
        response = client.patch(
            f"/api/v1/projects/{PROJECT_ID}/status",
            json={"action": "suspender_plagio", "reason": "Plagio detectado en capítulo 3"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["status"] == "suspendido_por_plagio"


def test_suspender_plagio_sin_razon_devuelve_400(admin_user):
    project_row = _project_row(status="en_desarrollo")

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        # 1. GET proyecto
        mapping_result([project_row]),
    ])
    mock_db.commit = AsyncMock()

    client = make_client(admin_user, mock_db)
    try:
        response = client.patch(
            f"/api/v1/projects/{PROJECT_ID}/status",
            json={"action": "suspender_plagio", "reason": ""},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 400


# ---------------------------------------------------------------------------
# 10. Intentar avanzar proyecto suspendido → 409
# ---------------------------------------------------------------------------


def test_avanzar_proyecto_suspendido_devuelve_409(admin_user):
    project_row = _project_row(status="suspendido_por_plagio")

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        # 1. GET proyecto → suspendido
        mapping_result([project_row]),
    ])
    mock_db.commit = AsyncMock()

    client = make_client(admin_user, mock_db)
    try:
        # Intentar aprobar (cualquier acción que no sea suspender_plagio)
        response = client.patch(
            f"/api/v1/projects/{PROJECT_ID}/status",
            json={"action": "aprobar"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 409
    assert "suspendido" in response.json()["detail"].lower()


def test_jurado_calificar_proyecto_suspendido_devuelve_409(docente_user):
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[
        # 1. jurado asignado → J1
        mapping_result([{"id": uuid4(), "juror_number": 1, "stage": "producto_final"}]),
        # 2. guard: proyecto suspendido
        mapping_result([{"status": "suspendido_por_plagio"}]),
    ])
    mock_db.commit = AsyncMock()

    client = make_client(docente_user, mock_db)
    try:
        response = client.post(
            f"/api/v1/projects/{PROJECT_ID}/evaluations",
            json={"stage": "producto_final", "score": 4.5, "observations": "Bien"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 409
    assert "suspendido" in response.json()["detail"].lower()
