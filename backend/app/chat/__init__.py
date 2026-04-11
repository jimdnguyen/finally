"""Chat module for LLM integration.

Provides Pydantic schemas for structured chat request/response validation,
LLM service orchestration, and FastAPI router factory.
"""

from .models import ChatAPIResponse, ChatRequest, ChatResponse, TradeAction, WatchlistAction
from .routes import create_chat_router

__all__ = [
    "ChatAPIResponse",
    "ChatRequest",
    "ChatResponse",
    "TradeAction",
    "WatchlistAction",
    "create_chat_router",
]
