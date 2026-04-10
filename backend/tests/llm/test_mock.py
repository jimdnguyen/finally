"""Tests for mock LLM mode."""

from app.llm.mock import get_mock_response
from app.llm.models import ChatResponse


def test_mock_response_is_valid():
    """Mock response is a valid ChatResponse."""
    response = get_mock_response()
    assert isinstance(response, ChatResponse)


def test_mock_response_deterministic():
    """Mock response is deterministic."""
    response1 = get_mock_response()
    response2 = get_mock_response()

    assert response1.message == response2.message
    assert response1.trades == response2.trades
    assert response1.watchlist_changes == response2.watchlist_changes


def test_mock_response_content():
    """Mock response has expected content."""
    response = get_mock_response()

    assert "FinAlly" in response.message
    assert "Hello" in response.message
    assert response.trades == []
    assert response.watchlist_changes == []
