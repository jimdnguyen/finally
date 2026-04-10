"""Core database module with initialization and context management."""

import aiosqlite
from contextlib import asynccontextmanager
from pathlib import Path

from app.db.schema import ALL_SCHEMAS
from app.db.seed import seed_database


def _get_db_path(db_path: str | None = None) -> Path:
    """Resolve db/finally.db relative to project root."""
    if db_path:
        return Path(db_path)

    # Resolve from backend/app/db/ three levels up to project root
    current = Path(__file__).parent  # backend/app/db
    project_root = current.parent.parent.parent  # finally
    db_file = project_root / "db" / "finally.db"
    return db_file


DB_PATH = _get_db_path()


async def init_db(db_path: str | None = None) -> None:
    """Create tables and seed default data if needed (idempotent)."""
    path = _get_db_path(db_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    async with aiosqlite.connect(str(path)) as db:
        # Enable WAL mode for better concurrency
        await db.execute("PRAGMA journal_mode=WAL")

        # Create all tables
        for schema in ALL_SCHEMAS:
            await db.execute(schema)

        # Seed default data if needed
        await seed_database(db)
        await db.commit()


@asynccontextmanager
async def get_db(db_path: str | None = None):
    """Async context manager yielding aiosqlite.Connection with WAL mode."""
    path = _get_db_path(db_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    async with aiosqlite.connect(str(path)) as db:
        # Set row factory to return Row objects for dict-like access
        db.row_factory = aiosqlite.Row
        # Enable WAL mode for better concurrency
        await db.execute("PRAGMA journal_mode=WAL")
        yield db
