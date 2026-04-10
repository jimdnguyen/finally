"""FastAPI routes for chat endpoints."""

import sqlite3

from fastapi import APIRouter, Depends

from app.chat.models import ChatRequest, ChatResponse
from app.chat.service import execute_chat
from app.dependencies import get_db, get_price_cache
from app.market import PriceCache


def create_chat_router() -> APIRouter:
    """Create and return the chat API router.

    Returns an APIRouter with one endpoint:
        - POST /api/chat: Send message, receive LLM response with auto-executed trades
    """
    router = APIRouter(prefix="/api/chat", tags=["chat"])

    @router.post("", response_model=ChatResponse)
    async def chat(
        request: ChatRequest,
        db: sqlite3.Connection = Depends(get_db),
        cache: PriceCache = Depends(get_price_cache),
    ) -> ChatResponse:
        """Send a chat message and receive LLM response with auto-executed trades.

        Accepts a ChatRequest with a user message, injects current portfolio context
        and conversation history, calls the LLM with structured output, auto-executes
        any validated trades and watchlist changes, and returns the structured response.

        Args:
            request: ChatRequest with user message
            db: SQLite connection (injected)
            cache: PriceCache instance (injected)

        Returns:
            ChatResponse with message, executed trades, and executed watchlist changes
        """
        result = await execute_chat(db, request.message, cache)
        return result["llm_response"]

    return router
