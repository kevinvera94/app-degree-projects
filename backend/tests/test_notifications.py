"""
Tests unitarios para app.services.notifications.send_system_message (T-F08-10).
"""
from unittest.mock import AsyncMock, call, patch
from uuid import uuid4

import pytest

from app.services.notifications import send_system_message


@pytest.mark.asyncio
async def test_send_system_message_con_recipient():
    """Inserta mensaje con recipient_id y sender_display por defecto 'Sistema'."""
    db = AsyncMock()
    project_id = uuid4()
    sender_id = uuid4()
    recipient_id = uuid4()

    await send_system_message(db, project_id, sender_id, recipient_id, "Hola")

    db.execute.assert_called_once()
    _, kwargs = db.execute.call_args
    params = kwargs if kwargs else db.execute.call_args[0][1]
    # El segundo argumento posicional es el dict de parámetros
    call_args = db.execute.call_args[0]
    assert len(call_args) == 2
    sent_params = call_args[1]
    assert sent_params["pid"] == project_id
    assert sent_params["sid"] == sender_id
    assert sent_params["rid"] == recipient_id
    assert sent_params["content"] == "Hola"
    assert sent_params["display"] == "Sistema"


@pytest.mark.asyncio
async def test_send_system_message_sin_recipient():
    """Inserta mensaje broadcast con recipient_id = None."""
    db = AsyncMock()
    project_id = uuid4()
    sender_id = uuid4()

    await send_system_message(db, project_id, sender_id, None, "Broadcast")

    call_args = db.execute.call_args[0]
    sent_params = call_args[1]
    assert sent_params["rid"] is None
    assert sent_params["content"] == "Broadcast"


@pytest.mark.asyncio
async def test_send_system_message_sender_display_personalizado():
    """Permite sobreescribir sender_display."""
    db = AsyncMock()
    project_id = uuid4()
    sender_id = uuid4()

    await send_system_message(
        db, project_id, sender_id, None, "Mensaje", sender_display="CTG"
    )

    call_args = db.execute.call_args[0]
    sent_params = call_args[1]
    assert sent_params["display"] == "CTG"


@pytest.mark.asyncio
async def test_send_system_message_sql_correcto():
    """Verifica que el SQL generado inserta en la tabla correcta."""
    db = AsyncMock()

    await send_system_message(db, uuid4(), uuid4(), None, "Contenido")

    sql_obj = db.execute.call_args[0][0]
    sql_str = str(sql_obj)
    assert "messages" in sql_str
    assert "INSERT" in sql_str.upper()
