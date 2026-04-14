"""Centralized database configuration."""

import os
from pathlib import Path

# DB_PATH can be set via environment variable for Docker
# Default calculation: 4 levels up from config.py to project root, then db/finally.db
# In Docker, set DATABASE_PATH=/app/db/finally.db
_default_path = Path(__file__).parent.parent.parent.parent / "db" / "finally.db"
DB_PATH = Path(os.environ.get("DATABASE_PATH", str(_default_path)))
