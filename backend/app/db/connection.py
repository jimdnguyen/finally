"""aiosqlite connection factory with WAL mode."""

from contextlib import asynccontextmanager
from pathlib import Path

import aiosqlite

DB_PATH = Path(__file__).parent.parent.parent.parent / "db" / "finally.db"


@asynccontextmanager
async def get_db():
    """Async context manager yielding an aiosqlite connection with WAL mode."""
    async with aiosqlite.connect(DB_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        await conn.execute("PRAGMA journal_mode=WAL")
        await conn.execute("PRAGMA foreign_keys=ON")
        yield conn
