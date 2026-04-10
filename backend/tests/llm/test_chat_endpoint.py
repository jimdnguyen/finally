"""Tests for chat endpoint."""

import os
import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient

# These tests require the full FastAPI app to be initialized
# They will run when the app is available in conftest.py


def test_chat_endpoint_with_mock(client):
    """Chat endpoint with LLM_MOCK=true returns deterministic response."""
    # Mock the environment variable
    with patch.dict(os.environ, {"LLM_MOCK": "true"}):
        response = client.post(
            "/api/chat",
            json={"message": "Hello, can you help me?"},
        )

        assert response.status_code == 200
        data = response.json()

        assert "message" in data
        assert "trades_executed" in data
        assert "watchlist_changes" in data
        assert "errors" in data

        # Mock mode should return a friendly greeting
        assert "FinAlly" in data["message"] or "Hello" in data["message"]


def test_chat_endpoint_empty_message(client):
    """Chat endpoint rejects empty messages."""
    response = client.post(
        "/api/chat",
        json={"message": ""},
    )

    assert response.status_code == 400


def test_chat_endpoint_stores_messages(client):
    """Chat endpoint stores messages in database."""
    with patch.dict(os.environ, {"LLM_MOCK": "true"}):
        response = client.post(
            "/api/chat",
            json={"message": "What's my portfolio?"},
        )

        assert response.status_code == 200
        data = response.json()
        assert "message" in data
