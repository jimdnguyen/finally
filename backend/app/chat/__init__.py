"""Chat module for LLM integration.

Provides Pydantic schemas for structured chat request/response validation,
and placeholder factory functions for service implementation.
"""

from .models import ChatRequest, ChatResponse, TradeAction, WatchlistAction

__all__ = [
    "ChatRequest",
    "ChatResponse",
    "TradeAction",
    "WatchlistAction",
]
