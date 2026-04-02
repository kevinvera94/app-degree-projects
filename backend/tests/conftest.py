"""
Fixtures y helpers compartidos para toda la suite de tests del backend.

Fixtures disponibles:
  - admin_user, student_user, docente_user  → CurrentUser por rol
  - admin_token, docente_token, estudiante_token  → JWT válidos por rol
  - db_session  → AsyncMock de sesión de BD
  - test_client  → TestClient con admin + DB mockeada (uso general)

Helpers exportados (importables desde los módulos de test):
  - mapping_result()  → mock de resultado de db.execute()
  - make_client()     → TestClient con usuario y BD arbitrarios
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from jose import jwt

from app.core.config import settings
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
# Helpers de mock reutilizables
# ---------------------------------------------------------------------------


class _Mappings:
    """Simula el objeto retornado por result.mappings()."""

    def __init__(self, rows: list):
        self._rows = rows

    def first(self):
        return self._rows[0] if self._rows else None

    def __iter__(self):
        return iter(self._rows)


def mapping_result(
    rows: Optional[list] = None,
    rowcount: int = 1,
    scalar=None,
) -> MagicMock:
    """
    Crea un mock compatible con el resultado de db.execute().

    Args:
        rows: Filas a retornar en .mappings()
        rowcount: Valor de .rowcount (útil para UPDATE/DELETE)
        scalar: Valor explícito para .scalar_one(); si no se indica, usa len(rows)
    """
    rows = rows or []
    result = MagicMock()
    result.mappings.return_value = _Mappings(rows)
    result.scalar_one.return_value = scalar if scalar is not None else len(rows)
    result.scalar_one_or_none.return_value = rows[0] if rows else None
    result.rowcount = rowcount
    return result


def make_client(user: CurrentUser, mock_db: AsyncMock) -> TestClient:
    """
    Crea un TestClient con todas las dependencias de auth y BD sobreescritas.

    Llama a app.dependency_overrides.clear() después de usar el cliente.
    """

    async def override_db():
        yield mock_db

    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[require_admin] = lambda: user
    app.dependency_overrides[require_estudiante] = lambda: user
    app.dependency_overrides[require_docente] = lambda: user
    app.dependency_overrides[get_db] = override_db
    return TestClient(app)


def make_jwt(
    role: str,
    user_id: Optional[UUID] = None,
    email: Optional[str] = None,
) -> str:
    """Genera un JWT firmado con el secreto de Supabase para usar en tests."""
    uid = str(user_id or uuid4())
    addr = email or f"{role}@usc.edu.co"
    exp = datetime.now(timezone.utc) + timedelta(hours=1)
    payload = {"sub": uid, "email": addr, "role": role, "exp": exp}
    return jwt.encode(payload, settings.supabase_jwt_secret, algorithm="HS256")


# ---------------------------------------------------------------------------
# Fixtures de usuario (CurrentUser sin autenticación real)
# ---------------------------------------------------------------------------


@pytest.fixture
def admin_user() -> CurrentUser:
    return CurrentUser(id=uuid4(), email="admin@usc.edu.co", role="administrador")


@pytest.fixture
def student_user() -> CurrentUser:
    return CurrentUser(id=uuid4(), email="est@usc.edu.co", role="estudiante")


@pytest.fixture
def docente_user() -> CurrentUser:
    return CurrentUser(id=uuid4(), email="doc@usc.edu.co", role="docente")


# ---------------------------------------------------------------------------
# Fixtures de tokens JWT
# ---------------------------------------------------------------------------


@pytest.fixture
def admin_token() -> str:
    """JWT válido con rol administrador."""
    return make_jwt("administrador")


@pytest.fixture
def docente_token() -> str:
    """JWT válido con rol docente."""
    return make_jwt("docente")


@pytest.fixture
def estudiante_token() -> str:
    """JWT válido con rol estudiante."""
    return make_jwt("estudiante")


# ---------------------------------------------------------------------------
# Fixtures de base de datos y cliente HTTP
# ---------------------------------------------------------------------------


@pytest.fixture
def db_session() -> AsyncMock:
    """Mock de sesión asíncrona de base de datos (AsyncSession)."""
    mock_db = AsyncMock()
    mock_db.commit = AsyncMock()
    mock_db.rollback = AsyncMock()
    mock_db.close = AsyncMock()
    return mock_db


@pytest.fixture
def test_client(admin_user: CurrentUser, db_session: AsyncMock):
    """
    TestClient genérico con usuario admin y BD mockeada.

    Para tests que necesiten un usuario distinto o mock_db específico,
    usa make_client() directamente y limpia app.dependency_overrides.clear().
    """
    client = make_client(admin_user, db_session)
    yield client
    app.dependency_overrides.clear()
