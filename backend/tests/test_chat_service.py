"""Unit tests for chat service — 8 core scenarios."""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from app.chat.db import save_message
from app.chat.service import process_chat
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


@pytest.fixture
def price_cache():
    prices = {"AAPL": 150.0, "GOOGL": 175.0}
    mock = MagicMock()
    mock.get_price.side_effect = lambda t: prices.get(t)
    return mock


def _mock_llm(payload: dict):
    """Build a fake litellm response from a dict payload."""
    resp = MagicMock()
    resp.choices[0].message.content = json.dumps(payload)
    return resp


# ─── 1. Mock mode ────────────────────────────────────────────────────────────

async def test_chat_mock_mode(conn, price_cache, monkeypatch):
    monkeypatch.setenv("LLM_MOCK", "true")
    result = await process_chat("Hello", price_cache, conn)
    assert len(result.message) > 0
    assert len(result.trades_executed) == 1
    assert result.trades_executed[0]["ticker"] == "AAPL"
    assert result.trades_executed[0]["status"] == "executed"


# ─── 2. Messages stored ──────────────────────────────────────────────────────

async def test_chat_stores_messages(conn, price_cache, monkeypatch):
    monkeypatch.setenv("LLM_MOCK", "true")
    await process_chat("Test message", price_cache, conn)
    cursor = await conn.execute(
        "SELECT role, content FROM chat_messages WHERE user_id = 'default' ORDER BY created_at"
    )
    rows = await cursor.fetchall()
    assert len(rows) == 2
    assert rows[0][0] == "user"
    assert rows[0][1] == "Test message"
    assert rows[1][0] == "assistant"


# ─── 3. Trade execution ───────────────────────────────────────────────────────

async def test_chat_trade_execution(conn, price_cache, monkeypatch):
    monkeypatch.delenv("LLM_MOCK", raising=False)
    payload = {
        "message": "Buying AAPL for you.",
        "trades": [{"ticker": "AAPL", "side": "buy", "quantity": 5}],
        "watchlist_changes": [],
    }
    with patch("app.chat.service.litellm.acompletion", new_callable=AsyncMock,
               return_value=_mock_llm(payload)):
        result = await process_chat("Buy AAPL", price_cache, conn)

    assert result.trades_executed[0]["status"] == "executed"
    cursor = await conn.execute("SELECT quantity FROM positions WHERE ticker = 'AAPL'")
    row = await cursor.fetchone()
    assert row is not None and row[0] == 5.0


# ─── 4. Insufficient cash — error collected, not raised ──────────────────────

async def test_chat_trade_insufficient_cash(conn, price_cache, monkeypatch):
    monkeypatch.delenv("LLM_MOCK", raising=False)
    # 1000 shares @ $150 = $150,000 > $10,000 cash
    payload = {
        "message": "Buying lots of AAPL.",
        "trades": [{"ticker": "AAPL", "side": "buy", "quantity": 1000}],
        "watchlist_changes": [],
    }
    with patch("app.chat.service.litellm.acompletion", new_callable=AsyncMock,
               return_value=_mock_llm(payload)):
        result = await process_chat("Buy lots of AAPL", price_cache, conn)

    # Must NOT raise — error must be in response
    assert result.trades_executed[0]["status"] == "error"
    assert "cash" in result.trades_executed[0]["error"].lower()


# ─── 5. Watchlist add ────────────────────────────────────────────────────────

async def test_chat_watchlist_add(conn, price_cache, monkeypatch):
    monkeypatch.delenv("LLM_MOCK", raising=False)
    payload = {
        "message": "Added PYPL to your watchlist.",
        "trades": [],
        "watchlist_changes": [{"ticker": "PYPL", "action": "add"}],
    }
    with patch("app.chat.service.litellm.acompletion", new_callable=AsyncMock,
               return_value=_mock_llm(payload)):
        result = await process_chat("Watch PYPL", price_cache, conn)

    assert result.watchlist_changes_applied[0]["status"] == "added"
    cursor = await conn.execute("SELECT ticker FROM watchlist WHERE ticker = 'PYPL'")
    assert await cursor.fetchone() is not None


# ─── 6. Watchlist remove ─────────────────────────────────────────────────────

async def test_chat_watchlist_remove(conn, price_cache, monkeypatch):
    monkeypatch.delenv("LLM_MOCK", raising=False)
    # AAPL is seeded in the default watchlist
    payload = {
        "message": "Removed AAPL from your watchlist.",
        "trades": [],
        "watchlist_changes": [{"ticker": "AAPL", "action": "remove"}],
    }
    with patch("app.chat.service.litellm.acompletion", new_callable=AsyncMock,
               return_value=_mock_llm(payload)):
        result = await process_chat("Remove AAPL", price_cache, conn)

    assert result.watchlist_changes_applied[0]["status"] == "removed"
    cursor = await conn.execute("SELECT ticker FROM watchlist WHERE ticker = 'AAPL'")
    assert await cursor.fetchone() is None


# ─── 7. History loaded into LLM call ─────────────────────────────────────────

async def test_chat_history_loaded(conn, price_cache, monkeypatch):
    monkeypatch.delenv("LLM_MOCK", raising=False)
    await save_message(conn, "user", "What is my portfolio?")
    await save_message(conn, "assistant", "You have $10,000 cash.")

    captured: list[dict] = []

    async def fake_completion(**kwargs):
        captured.extend(kwargs["messages"])
        return _mock_llm({"message": "Here you go.", "trades": [], "watchlist_changes": []})

    with patch("app.chat.service.litellm.acompletion", new=fake_completion):
        await process_chat("Tell me more", price_cache, conn)

    contents = [m["content"] for m in captured]
    assert any("system" in m["role"] for m in captured)
    assert "What is my portfolio?" in contents
    assert "You have $10,000 cash." in contents


# ─── 8. System prompt contains AC1 portfolio context fields ──────────────────

async def test_chat_system_prompt_contains_portfolio_context(conn, price_cache, monkeypatch):
    monkeypatch.delenv("LLM_MOCK", raising=False)
    captured: list[dict] = []

    async def fake_completion(**kwargs):
        captured.extend(kwargs["messages"])
        return _mock_llm({"message": "ok", "trades": [], "watchlist_changes": []})

    with patch("app.chat.service.litellm.acompletion", new=fake_completion):
        await process_chat("Hello", price_cache, conn)

    system_msgs = [m for m in captured if m["role"] == "system"]
    assert len(system_msgs) == 1
    content = system_msgs[0]["content"]
    assert "Cash:" in content
    assert "Total Value:" in content
    assert "Positions:" in content
    assert "Watchlist:" in content


# ─── 9. LLM failure → 503 LLM_ERROR ─────────────────────────────────────────

async def test_chat_llm_failure(conn, price_cache, monkeypatch):
    monkeypatch.delenv("LLM_MOCK", raising=False)
    with patch("app.chat.service.litellm.acompletion",
               new_callable=AsyncMock, side_effect=Exception("API down")):
        with pytest.raises(HTTPException) as exc_info:
            await process_chat("Hello", price_cache, conn)

    assert exc_info.value.status_code == 503
    assert exc_info.value.detail["code"] == "LLM_ERROR"
    assert exc_info.value.detail["error"] == "LLM request failed"


# ─── 10. Missing API key → 503 LLM_ERROR (AC4) ───────────────────────────────

async def test_chat_no_api_key(conn, price_cache, monkeypatch):
    monkeypatch.delenv("LLM_MOCK", raising=False)
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    with patch("app.chat.service.litellm.acompletion",
               new_callable=AsyncMock, side_effect=Exception("No auth")):
        with pytest.raises(HTTPException) as exc_info:
            await process_chat("Hello", price_cache, conn)

    assert exc_info.value.status_code == 503
    assert exc_info.value.detail["code"] == "LLM_ERROR"
