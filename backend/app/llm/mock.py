"""Mock LLM responses for testing."""

from .models import ChatResponse


def get_mock_response() -> ChatResponse:
    """Return a deterministic mock chat response."""
    return ChatResponse(
        message="Hello! I'm FinAlly, your AI trading assistant. How can I help you today?",
        trades=[],
        watchlist_changes=[],
    )
