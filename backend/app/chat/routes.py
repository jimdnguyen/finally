"""FastAPI routes for chat endpoints."""

import sqlite3

from fastapi import APIRouter, Depends

from app.chat.models import ChatAPIResponse, ChatHistoryMessage, ChatRequest, ChatResponse
from app.chat.service import execute_chat
from app.dependencies import get_db, get_market_source, get_price_cache
from app.market import MarketDataSource, PriceCache


def create_chat_router() -> APIRouter:
    """Create and return the chat API router.

    Returns an APIRouter with one endpoint:
        - POST /api/chat: Send message, receive LLM response with auto-executed trades
    """
    router = APIRouter(prefix="/api/chat", tags=["chat"])

    @router.get("/history", response_model=list[ChatHistoryMessage])
    async def get_chat_history(
        db: sqlite3.Connection = Depends(get_db),
    ) -> list[ChatHistoryMessage]:
        """Return conversation history in chronological order."""
        import json
        from fastapi.concurrency import run_in_threadpool

        def _fetch():
            cursor = db.cursor()
            cursor.execute(
                """
                SELECT id, role, content, actions, created_at
                FROM chat_messages
                WHERE user_id='default'
                ORDER BY created_at ASC
                """
            )
            rows = cursor.fetchall()
            return [
                ChatHistoryMessage(
                    id=row[0],
                    role=row[1],
                    content=row[2],
                    actions=json.loads(row[3]) if row[3] else None,
                    created_at=row[4],
                )
                for row in rows
            ]

        return await run_in_threadpool(_fetch)

    @router.post("", response_model=ChatAPIResponse)
    async def chat(
        request: ChatRequest,
        db: sqlite3.Connection = Depends(get_db),
        cache: PriceCache = Depends(get_price_cache),
        source: MarketDataSource = Depends(get_market_source),
    ) -> ChatAPIResponse:
        """Send a chat message and receive LLM response with auto-executed trades."""
        result = await execute_chat(db, request.message, cache, source)
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
