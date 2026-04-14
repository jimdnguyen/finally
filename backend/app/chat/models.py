"""Pydantic models for the chat API."""

from typing import Literal

from pydantic import BaseModel, Field, model_validator


class TradeRequest(BaseModel):
    ticker: str = Field(default="")
    side: Literal["buy", "sell"] = Field(default="buy")
    quantity: float = Field(gt=0)

    @model_validator(mode="before")
    @classmethod
    def normalize_fields(cls, data: dict) -> dict:
        """Normalize LLM field variations: symbol->ticker, action->side, case."""
        if isinstance(data, dict):
            # symbol -> ticker (uppercase)
            if "symbol" in data and "ticker" not in data:
                data["ticker"] = data.pop("symbol").upper()
            # ticker -> uppercase
            if "ticker" in data and isinstance(data["ticker"], str):
                data["ticker"] = data["ticker"].upper()
            # action -> side (lowercase)
            if "action" in data and "side" not in data:
                data["side"] = data.pop("action").lower()
            # side -> lowercase
            if "side" in data and isinstance(data["side"], str):
                data["side"] = data["side"].lower()
        return data


class WatchlistChange(BaseModel):
    ticker: str
    action: Literal["add", "remove"]


class LLMResponse(BaseModel):
    message: str
    trades: list[TradeRequest] = []
    watchlist_changes: list[WatchlistChange] = []


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


class ChatResponse(BaseModel):
    message: str
    trades_executed: list[dict] = []
    watchlist_changes_applied: list[dict] = []
