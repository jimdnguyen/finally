"""Database package — connection factory and initialization."""

from .connection import get_db
from .init import init_db

__all__ = ["get_db", "init_db"]
