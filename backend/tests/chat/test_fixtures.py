"""Tests for chat module LiteLLM mock fixtures (CHAT-04).

Verifies that mock_llm_response and related fixtures return deterministic,
JSON-serializable ChatResponse objects suitable for testing.
"""

from app.chat.models import ChatResponse


def test_mock_llm_response_fixture(mock_llm_response: ChatResponse) -> None:
    """Test that mock_llm_response returns the expected deterministic response."""
    assert mock_llm_response.message == (
        "I'll help you manage your portfolio. Buying 1 AAPL at market price."
    )
    assert len(mock_llm_response.trades) == 1
    assert mock_llm_response.trades[0].ticker == "AAPL"
    assert mock_llm_response.trades[0].side == "buy"
    assert mock_llm_response.trades[0].quantity == 1
    assert mock_llm_response.watchlist_changes == []


def test_mock_llm_response_serializable(
    mock_llm_response: ChatResponse,
) -> None:
    """Test that mock_llm_response can be serialized to JSON and back."""
    # Serialize to JSON
    json_str = mock_llm_response.model_dump_json()
    assert isinstance(json_str, str)

    # Deserialize from JSON
    restored = ChatResponse.model_validate_json(json_str)
    assert restored.message == mock_llm_response.message
    assert len(restored.trades) == len(mock_llm_response.trades)
    assert restored.trades[0].ticker == mock_llm_response.trades[0].ticker


def test_mock_llm_response_multi_action_fixture(
    mock_llm_response_multi_action: ChatResponse,
) -> None:
    """Test that mock_llm_response_multi_action returns multiple actions."""
    assert len(mock_llm_response_multi_action.trades) == 1
    assert mock_llm_response_multi_action.trades[0].ticker == "GOOGL"
    assert mock_llm_response_multi_action.trades[0].side == "sell"
    assert len(mock_llm_response_multi_action.watchlist_changes) == 1
    assert (
        mock_llm_response_multi_action.watchlist_changes[0].ticker == "TSLA"
    )
    assert (
        mock_llm_response_multi_action.watchlist_changes[0].action == "add"
    )


def test_mock_llm_response_no_action_fixture(
    mock_llm_response_no_action: ChatResponse,
) -> None:
    """Test that mock_llm_response_no_action returns message-only response."""
    assert "portfolio" in mock_llm_response_no_action.message.lower()
    assert mock_llm_response_no_action.trades == []
    assert mock_llm_response_no_action.watchlist_changes == []
