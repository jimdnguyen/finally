"""Chat API route — POST /chat."""

from fastapi import APIRouter, Request
from slowapi import Limiter

from app.db import get_db
from app.market import PriceCache

from .models import ChatRequest, ChatResponse
from .service import process_chat


def create_chat_router(price_cache: PriceCache, limiter: Limiter) -> APIRouter:
    router = APIRouter()

    @router.post("/chat", response_model=ChatResponse)
    @limiter.limit("10/minute")
    async def chat(request: Request, body: ChatRequest) -> ChatResponse:
        async with get_db() as conn:
            return await process_chat(body.message, price_cache, conn)

    @router.delete("/chat/history", status_code=204)
    async def clear_history():
        async with get_db() as conn:
            await conn.execute("DELETE FROM chat_messages WHERE user_id = 'default'")
            await conn.commit()

    return router
