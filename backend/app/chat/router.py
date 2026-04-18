"""Chat API route — POST /chat."""

from slowapi import Limiter
from fastapi import APIRouter, Request

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

    return router
