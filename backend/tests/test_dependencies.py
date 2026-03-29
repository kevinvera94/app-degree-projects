"""Tests unitarios para las dependencias de autenticación JWT."""
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import uuid4

import pytest
from fastapi import HTTPException
from jose import jwt

from app.core.config import settings
from app.core.dependencies import (
    CurrentUser,
    get_current_user,
    require_admin,
    require_docente,
)


def make_token(
    role: str = "estudiante",
    user_id: Optional[str] = None,
    email: str = "test@usc.edu.co",
    expired: bool = False,
    secret: Optional[str] = None,
) -> str:
    uid = user_id or str(uuid4())
    exp = datetime.now(timezone.utc) + (
        timedelta(seconds=-1) if expired else timedelta(hours=1)
    )
    payload = {"sub": uid, "email": email, "role": role, "exp": exp}
    key = secret or settings.supabase_jwt_secret
    return jwt.encode(payload, key, algorithm="HS256")


# ---------------------------------------------------------------------------
# get_current_user
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_current_user_valid_token():
    token = make_token(role="estudiante")
    user = await get_current_user(token)
    assert isinstance(user, CurrentUser)
    assert user.role == "estudiante"
    assert user.email == "test@usc.edu.co"


@pytest.mark.asyncio
async def test_get_current_user_expired_token():
    token = make_token(expired=True)
    with pytest.raises(HTTPException) as exc:
        await get_current_user(token)
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_get_current_user_invalid_signature():
    token = make_token(secret="clave-incorrecta")
    with pytest.raises(HTTPException) as exc:
        await get_current_user(token)
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_get_current_user_missing_claims():
    # Token sin campo 'role'
    payload = {
        "sub": str(uuid4()),
        "email": "test@usc.edu.co",
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
    }
    token = jwt.encode(payload, settings.supabase_jwt_secret, algorithm="HS256")
    with pytest.raises(HTTPException) as exc:
        await get_current_user(token)
    assert exc.value.status_code == 401


# ---------------------------------------------------------------------------
# require_admin
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_require_admin_correct_role():
    user = CurrentUser(id=uuid4(), email="admin@usc.edu.co", role="administrador")
    result = await require_admin(user)
    assert result.role == "administrador"


@pytest.mark.asyncio
async def test_require_admin_wrong_role():
    user = CurrentUser(id=uuid4(), email="doc@usc.edu.co", role="docente")
    with pytest.raises(HTTPException) as exc:
        await require_admin(user)
    assert exc.value.status_code == 403


# ---------------------------------------------------------------------------
# require_docente
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_require_docente_correct_role():
    user = CurrentUser(id=uuid4(), email="doc@usc.edu.co", role="docente")
    result = await require_docente(user)
    assert result.role == "docente"


@pytest.mark.asyncio
async def test_require_docente_wrong_role():
    user = CurrentUser(id=uuid4(), email="est@usc.edu.co", role="estudiante")
    with pytest.raises(HTTPException) as exc:
        await require_docente(user)
    assert exc.value.status_code == 403
