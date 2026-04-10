"""Integration tests for chat endpoint (POST /api/chat).

Tests endpoint structure (CHAT-01), response schema validation, mock mode integration (CHAT-04),
and auto-execution of trades through the HTTP interface.
"""

import os
import sqlite3

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.chat import create_chat_router
from app.chat.models import ChatResponse
from app.market import PriceCache


@pytest.fixture
def chat_client(test_db: sqlite3.Connection, price_cache: PriceCache) -> TestClient:
    """Create a test client with chat router wired."""
    app = FastAPI()
    app.state.db = test_db
    app.state.price_cache = price_cache

    # Wire chat router
    app.include_router(create_chat_router())

    return TestClient(app)


class TestChatEndpoint:
    """Test POST /api/chat endpoint."""

    def test_chat_endpoint_post_structure(self, chat_client: TestClient):
        """Test that POST /api/chat accepts request and returns ChatResponse structure (CHAT-01).

        Verifies the endpoint accepts a ChatRequest with a message field and returns
        a ChatResponse with message, trades, and watchlist_changes fields.
        """
        # Make request with mock mode enabled (to avoid LLM call)
        with patch_llm_mock():
            response = chat_client.post("/api/chat", json={"message": "What's my portfolio?"})

        # Assert: 200 OK
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        # Assert: response has ChatResponse fields
        data = response.json()
        assert "message" in data
        assert "trades" in data
        assert "watchlist_changes" in data

        # Assert: fields are correct types
        assert isinstance(data["message"], str)
        assert isinstance(data["trades"], list)
        assert isinstance(data["watchlist_changes"], list)

    def test_chat_endpoint_with_mock_llm(self, chat_client: TestClient):
        """Test that endpoint returns mock response when LLM_MOCK=true (CHAT-04).

        When LLM_MOCK environment variable is set, the endpoint should return
        the deterministic mock response without calling OpenRouter.
        """
        with patch_llm_mock():
            response = chat_client.post("/api/chat", json={"message": "Test message"})

        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()

        # Assert: mock response content
        assert data["message"] == "I'll help you manage your portfolio. Buying 1 AAPL at market price."
        assert len(data["trades"]) == 1
        assert data["trades"][0]["ticker"] == "AAPL"

    def test_chat_endpoint_invalid_request(self, chat_client: TestClient):
        """Test that endpoint returns 422 for invalid request (missing message field)."""
        with patch_llm_mock():
            response = chat_client.post("/api/chat", json={})

        # Assert: 422 Unprocessable Entity (Pydantic validation failed)
        assert response.status_code == 422

    def test_chat_endpoint_empty_message(self, chat_client: TestClient):
        """Test that endpoint accepts empty message (no validation on content)."""
        with patch_llm_mock():
            response = chat_client.post("/api/chat", json={"message": ""})

        # Should still succeed (message validation happens at LLM level, not request level)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

    def test_chat_endpoint_response_model_validation(self, chat_client: TestClient):
        """Test that endpoint response is valid ChatResponse (FastAPI validation)."""
        with patch_llm_mock():
            response = chat_client.post("/api/chat", json={"message": "Test"})

        # If response_model validation failed, would be 500
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        # Response can be parsed as ChatResponse
        data = response.json()
        validated = ChatResponse(**data)
        assert isinstance(validated, ChatResponse)


def patch_llm_mock():
    """Context manager to set LLM_MOCK=true during test."""
    import contextlib

    @contextlib.contextmanager
    def _patch():
        old_val = os.environ.get("LLM_MOCK")
        os.environ["LLM_MOCK"] = "true"
        try:
            yield
        finally:
            if old_val is None:
                os.environ.pop("LLM_MOCK", None)
            else:
                os.environ["LLM_MOCK"] = old_val

    return _patch()
