"""Health check endpoint for Docker healthcheck and deployment verification.

Provides a simple GET /api/health endpoint that verifies database connectivity
and returns system status. Used by Docker HEALTHCHECK and deployment orchestration.
"""

import logging
import sqlite3
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse

from app.dependencies import get_db

logger = logging.getLogger(__name__)


def create_health_router() -> APIRouter:
    """Create and return a health check router.

    Returns an APIRouter configured with GET /api/health endpoint.
    """
    router = APIRouter(prefix="/health", tags=["health"])

    @router.get("")
    async def health_check(db: sqlite3.Connection = Depends(get_db)):
        """Check application health and database connectivity.

        Performs a minimal database query (SELECT 1) to verify the database is
        accessible. Returns status JSON with timestamp.

        Returns:
            dict: Health status with keys:
                - status: "healthy" if all checks pass, "unhealthy" on error
                - database: "connected" if DB is accessible, "error" on failure
                - timestamp: ISO 8601 timestamp in UTC

        Response Codes:
            200: Application is healthy and database is connected
            503: Database is unavailable or connection error
        """
        try:
            # Test database connectivity with minimal query
            cursor = db.cursor()
            cursor.execute("SELECT 1")
            cursor.fetchone()

            # All checks passed
            timestamp = datetime.now(timezone.utc).isoformat()
            return JSONResponse(
                status_code=200,
                content={
                    "status": "healthy",
                    "database": "connected",
                    "timestamp": timestamp,
                },
            )
        except Exception as exc:
            logger.exception("Health check failed: database error")
            timestamp = datetime.now(timezone.utc).isoformat()
            return JSONResponse(
                status_code=503,
                content={
                    "status": "unhealthy",
                    "database": "error",
                    "timestamp": timestamp,
                },
            )

    return router


__all__ = ["create_health_router"]
