"""Unit tests for chat database functions."""

import pytest

from app.chat.db import load_history, save_message
from app.db import init_db
from app.db.connection import get_db


@pytest.fixture(autouse=True)
def temp_db(tmp_path, monkeypatch):
    monkeypatch.setattr("app.db.config.DB_PATH", tmp_path / "test.db")


@pytest.fixture
async def conn():
    await init_db()
    async with get_db() as c:
        yield c


async def test_load_history_empty(conn):
    history = await load_history(conn)
    assert history == []


async def test_save_and_load_user_message(conn):
    await save_message(conn, "user", "Hello!")
    history = await load_history(conn)
    assert len(history) == 1
    assert history[0]["role"] == "user"
    assert history[0]["content"] == "Hello!"


async def test_save_user_and_assistant(conn):
    await save_message(conn, "user", "What stocks should I buy?")
    await save_message(conn, "assistant", "Consider AAPL.")
    history = await load_history(conn)
    assert len(history) == 2
    # Oldest first
    assert history[0]["role"] == "user"
    assert history[1]["role"] == "assistant"


async def test_load_history_respects_limit(conn):
    for i in range(25):
        await save_message(conn, "user", f"message {i}")
    history = await load_history(conn, limit=20)
    assert len(history) == 20
    # Should be the most recent 20, oldest first
    assert history[-1]["content"] == "message 24"


async def test_save_message_with_actions(conn):
    actions = {"trades": [{"ticker": "AAPL", "status": "executed"}]}
    await save_message(conn, "assistant", "Done!", actions=actions)
    # Verify directly in DB
    cursor = await conn.execute(
        "SELECT actions FROM chat_messages WHERE role = 'assistant'"
    )
    row = await cursor.fetchone()
    assert row is not None
    import json
    stored = json.loads(row[0])
    assert stored["trades"][0]["ticker"] == "AAPL"


async def test_save_user_message_has_null_actions(conn):
    await save_message(conn, "user", "No actions here")
    cursor = await conn.execute(
        "SELECT actions FROM chat_messages WHERE role = 'user'"
    )
    row = await cursor.fetchone()
    assert row[0] is None
