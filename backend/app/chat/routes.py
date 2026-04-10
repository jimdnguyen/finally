"""FastAPI routes for chat endpoints."""

import sqlite3

from fastapi import APIRouter, Depends

from app.chat.models import ChatAPIResponse, ChatRequest, ChatResponse
from app.chat.service import execute_chat
from app.dependencies import get_db, get_price_cache
from app.market import PriceCache


def create_chat_router() -> APIRouter:
    """Create and return the chat API router.

    Returns an APIRouter with one endpoint:
        - POST /api/chat: Send message, receive LLM response with auto-executed trades
    """
    router = APIRouter(prefix="/api/chat", tags=["chat"])

    @router.post("", response_model=ChatAPIResponse)
    async def chat(
        request: ChatRequest,
        db: sqlite3.Connection = Depends(get_db),
        cache: PriceCache = Depends(get_price_cache),
    ) -> ChatAPIResponse:
        """Send a chat message and receive LLM response with auto-executed trades.

        Accepts a ChatRequest with a user message, injects current portfolio context
        and conversation history, calls the LLM with structured output, auto-executes
        any validated trades and watchlist changes, and returns the structured response
        including execution results and any errors.

        Args:
            request: ChatRequest with user message
            db: SQLite connection (injected)
            cache: PriceCache instance (injected)

        Returns:
            ChatAPIResponse with message, LLM-requested actions, execution results, and errors
        """
        result = await execute_chat(db, request.message, cache)
        llm_response = result["llm_response"]
        executed = result["executed_actions"]
        return ChatAPIResponse(
            message=llm_response.message,
            trades=llm_response.trades,
            watchlist_changes=llm_response.watchlist_changes,
            executed_trades=executed["trades"],
            executed_watchlist=executed["watchlist_changes"],
            errors=executed["errors"],
        )

    return router
