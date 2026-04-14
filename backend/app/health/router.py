"""Health check endpoint."""

import aiosqlite
from fastapi import APIRouter, HTTPException

from app.db.config import DB_PATH

router = APIRouter()


@router.get("/health")
async def health():
    """Health check that verifies database connectivity."""
    try:
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute("SELECT 1")
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {e}")
