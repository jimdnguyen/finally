"""Pydantic v2 models for LLM chat request/response schemas.

Defines the contract between the chat endpoint and the LLM service layer.
ChatResponse is validated via .model_validate_json() from OpenRouter LiteLLM responses.
"""

from typing import Literal

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    """User message sent to the chat endpoint.

    Simple request body for POST /api/chat. The message is passed to the LLM
    along with portfolio context and conversation history.
    """

    message: str = Field(..., description="User's chat input message")


class TradeAction(BaseModel):
    """Trade action extracted from LLM structured output.

    Represents a single trade instruction from the LLM. The service layer
    validates these against portfolio state before execution.
    """

    ticker: str = Field(..., description="Ticker symbol (uppercase, 1-5 chars)")
    side: Literal["buy", "sell"] = Field(
        ..., description="Order side: 'buy' or 'sell'"
    )
    quantity: float = Field(
        ..., gt=0, description="Number of shares to trade (must be > 0)"
    )


class WatchlistAction(BaseModel):
    """Watchlist modification from LLM structured output.

    Represents a single watchlist change instruction from the LLM.
    The service layer validates the ticker exists before applying changes.
    """

    ticker: str = Field(..., description="Ticker symbol (uppercase, 1-5 chars)")
    action: Literal["add", "remove"] = Field(
        ..., description="Watchlist action: 'add' or 'remove'"
    )


class ChatResponse(BaseModel):
    """Structured response from LLM.

    Contains the conversational message sent to the user and zero or more
    trade/watchlist actions to execute automatically. Parsed from OpenRouter
    LiteLLM structured output via .model_validate_json().
    """

    message: str = Field(
        ..., description="Conversational response to the user"
    )
    trades: list[TradeAction] = Field(
        default_factory=list,
        description="Trade actions to execute (buy/sell instructions)",
    )
    watchlist_changes: list[WatchlistAction] = Field(
        default_factory=list,
        description="Watchlist modifications (add/remove tickers)",
    )


class ChatHistoryMessage(BaseModel):
    """Single chat message returned by GET /api/chat/history."""

    id: str
    role: Literal["user", "assistant"]
    content: str
    actions: dict | None = None
    created_at: str


class ChatAPIResponse(ChatResponse):
    """API response for POST /api/chat.

    Extends ChatResponse with execution results so the frontend can display
    which trades succeeded, which watchlist changes were applied, and any errors.
    """

    executed_trades: list[dict] = Field(
        default_factory=list,
        description="Trade execution results (one entry per executed trade)",
    )
    executed_watchlist: list[dict] = Field(
        default_factory=list,
        description="Watchlist change results (one entry per applied change)",
    )
    errors: list[str] = Field(
        default_factory=list,
        description="Error messages for failed trades or watchlist changes",
    )
