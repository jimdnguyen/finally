"""Chat API route — POST /chat."""

from fastapi import APIRouter

from app.db import get_db
from app.market import PriceCache

from .models import ChatRequest, ChatResponse
from .service import process_chat


def create_chat_router(price_cache: PriceCache) -> APIRouter:
    router = APIRouter()

    @router.post("/chat", response_model=ChatResponse)
    async def chat(body: ChatRequest) -> ChatResponse:
        async with get_db() as conn:
            return await process_chat(body.message, price_cache, conn)

    return router
