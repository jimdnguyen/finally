"""Tests for portfolio snapshot background task."""

import asyncio
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.db.init import init_db
from app.market import PriceCache
from app.portfolio import db as portfolio_db
from app.snapshots import snapshot_loop


@pytest.fixture(autouse=True)
def use_temp_db(tmp_path, monkeypatch):
    db_file = tmp_path / "test.db"
    monkeypatch.setattr("app.db.config.DB_PATH", db_file)
    return db_file


@pytest.fixture
async def setup_db(use_temp_db):
    """Initialize DB with schema + seed data."""
    await init_db()


async def test_snapshot_inserts_correct_total_value(setup_db):
    """After one interval, a snapshot is inserted with cash only (no positions)."""
    cache = PriceCache()
    task = asyncio.create_task(snapshot_loop(cache, interval=0.05))
    await asyncio.sleep(0.15)
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

    from app.db.connection import get_db

    async with get_db() as conn:
        snapshots = await portfolio_db.get_snapshots(conn)

    assert len(snapshots) >= 1
    # Default seed: $10,000 cash, no positions
    assert snapshots[0]["total_value"] == 10000.0


async def test_snapshot_uses_live_prices(setup_db):
    """Snapshot uses PriceCache prices when available."""
    cache = PriceCache()
    cache.update("AAPL", 200.0)

    from app.db.connection import get_db

    # Buy 10 shares of AAPL at $150 to create a position
    async with get_db() as conn:
        await portfolio_db.upsert_position(conn, "AAPL", 10, 150.0)
        await portfolio_db.update_cash_balance(conn, 8500.0)

    task = asyncio.create_task(snapshot_loop(cache, interval=0.05))
    await asyncio.sleep(0.15)
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

    async with get_db() as conn:
        snapshots = await portfolio_db.get_snapshots(conn)

    assert len(snapshots) >= 1
    # 8500 cash + 10 * 200.0 (live price) = 10500.0
    assert snapshots[0]["total_value"] == 10500.0


async def test_snapshot_falls_back_to_avg_cost(setup_db):
    """When PriceCache has no price, snapshot falls back to avg_cost."""
    cache = PriceCache()
    # No price set for AAPL in cache

    from app.db.connection import get_db

    async with get_db() as conn:
        await portfolio_db.upsert_position(conn, "AAPL", 10, 150.0)
        await portfolio_db.update_cash_balance(conn, 8500.0)

    task = asyncio.create_task(snapshot_loop(cache, interval=0.05))
    await asyncio.sleep(0.15)
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

    async with get_db() as conn:
        snapshots = await portfolio_db.get_snapshots(conn)

    assert len(snapshots) >= 1
    # 8500 cash + 10 * 150.0 (avg_cost fallback) = 10000.0
    assert snapshots[0]["total_value"] == 10000.0


async def test_snapshot_loop_cancellable(setup_db):
    """Loop exits cleanly when cancelled."""
    cache = PriceCache()
    task = asyncio.create_task(snapshot_loop(cache, interval=0.05))
    await asyncio.sleep(0.1)
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

    assert task.done()


# --- Integration: lifespan starts and stops snapshot task cleanly ---


async def test_lifespan_starts_and_stops_snapshot_task(use_temp_db, monkeypatch):
    """App lifespan starts the snapshot task on startup and cancels it on shutdown."""
    mock = AsyncMock()
    mock.start = AsyncMock()
    mock.stop = AsyncMock()
    monkeypatch.setattr("app.main.market_source", mock)

    await init_db()

    from app.main import create_app

    test_app = create_app()
    async with AsyncClient(
        transport=ASGITransport(app=test_app), base_url="http://test"
    ) as client:
        resp = await client.get("/api/health")
        assert resp.status_code == 200

    # If we reach here without hanging or errors, the lifespan
    # successfully started and stopped the snapshot task.
