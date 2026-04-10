"""Tests for watchlist endpoints."""


def test_get_watchlist(client):
    """Test GET /watchlist returns default 10 tickers."""
    response = client.get("/api/watchlist")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 10
    tickers = [item["ticker"] for item in data]
    assert "AAPL" in tickers
    assert "GOOGL" in tickers
    assert "MSFT" in tickers


def test_add_ticker(client):
    """Test POST /watchlist adds a new ticker."""
    # First add a ticker price to the cache
    client.app.state.price_cache.update("PYPL", 80.0)

    # Then add the ticker to watchlist
    response = client.post("/api/watchlist", json={"ticker": "PYPL"})
    assert response.status_code == 201
    assert response.json()["message"] == "Added PYPL to watchlist"

    # Verify it's in the watchlist
    response = client.get("/api/watchlist")
    tickers = [item["ticker"] for item in response.json()]
    assert "PYPL" in tickers


def test_add_duplicate_ticker(client):
    """Test adding a duplicate ticker returns 409."""
    response = client.post("/api/watchlist", json={"ticker": "AAPL"})
    assert response.status_code == 409
    assert "already on your watchlist" in response.json()["detail"]


def test_add_invalid_ticker(client):
    """Test invalid ticker format returns 400."""
    response = client.post("/api/watchlist", json={"ticker": "INVALID-TICKER"})
    assert response.status_code == 400


def test_delete_ticker(client):
    """Test DELETE /watchlist/{ticker} removes a ticker."""
    # Verify it exists
    response = client.get("/api/watchlist")
    tickers = [item["ticker"] for item in response.json()]
    assert "AAPL" in tickers

    # Delete it
    response = client.delete("/api/watchlist/AAPL")
    assert response.status_code == 200
    assert response.json()["message"] == "Removed AAPL from watchlist"

    # Verify it's gone
    response = client.get("/api/watchlist")
    tickers = [item["ticker"] for item in response.json()]
    assert "AAPL" not in tickers


def test_delete_nonexistent_ticker(client):
    """Test deleting a nonexistent ticker returns 404."""
    response = client.delete("/api/watchlist/XYZ123")
    assert response.status_code == 404
