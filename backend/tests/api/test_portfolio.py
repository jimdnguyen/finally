"""Tests for portfolio endpoints."""


def test_get_portfolio(client):
    """Test GET /portfolio returns cash balance, positions, and total value."""
    response = client.get("/api/portfolio")
    assert response.status_code == 200
    data = response.json()

    assert "cash_balance" in data
    assert "positions" in data
    assert "total_value" in data

    # Default seed: $10,000 cash, no positions
    assert data["cash_balance"] == 10000.0
    assert data["positions"] == []
    assert data["total_value"] == 10000.0


def test_buy_shares(client):
    """Test POST /portfolio/trade buy: cash decreases, position appears."""
    # Buy 10 shares of AAPL at $100 = $1,000
    response = client.post(
        "/api/portfolio/trade",
        json={"ticker": "AAPL", "quantity": 10, "side": "buy"}
    )
    assert response.status_code == 200
    data = response.json()

    # Cash should be reduced by $1,000
    assert data["cash_balance"] == 9000.0

    # Position should exist
    assert len(data["positions"]) == 1
    position = data["positions"][0]
    assert position["ticker"] == "AAPL"
    assert position["quantity"] == 10
    assert position["avg_cost"] == 100.0
    assert position["current_price"] == 100.0

    # Total value should be $10,000 (9000 cash + 1000 in AAPL)
    assert data["total_value"] == 10000.0


def test_sell_shares(client):
    """Test POST /portfolio/trade sell: cash increases, position updates."""
    # First buy
    client.post(
        "/api/portfolio/trade",
        json={"ticker": "AAPL", "quantity": 10, "side": "buy"}
    )

    # Then sell 5 shares
    response = client.post(
        "/api/portfolio/trade",
        json={"ticker": "AAPL", "quantity": 5, "side": "sell"}
    )
    assert response.status_code == 200
    data = response.json()

    # Cash should be 9000 + 500 = 9500
    assert data["cash_balance"] == 9500.0

    # Position should have 5 shares remaining
    position = data["positions"][0]
    assert position["quantity"] == 5


def test_sell_all_shares(client):
    """Test selling all shares removes the position."""
    # Buy 10 shares
    client.post(
        "/api/portfolio/trade",
        json={"ticker": "AAPL", "quantity": 10, "side": "buy"}
    )

    # Sell all 10
    response = client.post(
        "/api/portfolio/trade",
        json={"ticker": "AAPL", "quantity": 10, "side": "sell"}
    )
    data = response.json()

    # Position should be gone
    assert data["positions"] == []

    # Cash should be back to $10,000
    assert data["cash_balance"] == 10000.0


def test_insufficient_cash(client):
    """Test buying with insufficient cash returns 400."""
    response = client.post(
        "/api/portfolio/trade",
        json={"ticker": "AAPL", "quantity": 200, "side": "buy"}  # 200 * 100 = $20,000
    )
    assert response.status_code == 400
    assert "Insufficient cash" in response.json()["detail"]


def test_insufficient_shares(client):
    """Test selling more shares than owned returns 400."""
    # Buy 10 shares
    client.post(
        "/api/portfolio/trade",
        json={"ticker": "AAPL", "quantity": 10, "side": "buy"}
    )

    # Try to sell 20
    response = client.post(
        "/api/portfolio/trade",
        json={"ticker": "AAPL", "quantity": 20, "side": "sell"}
    )
    assert response.status_code == 400
    assert "Insufficient shares" in response.json()["detail"]


def test_sell_unknown_ticker(client):
    """Test selling a ticker with no position returns 400."""
    response = client.post(
        "/api/portfolio/trade",
        json={"ticker": "AAPL", "quantity": 10, "side": "sell"}
    )
    assert response.status_code == 400
    assert "Insufficient shares" in response.json()["detail"]


def test_invalid_trade_side(client):
    """Test invalid side parameter returns 400."""
    response = client.post(
        "/api/portfolio/trade",
        json={"ticker": "AAPL", "quantity": 10, "side": "invalid"}
    )
    assert response.status_code == 400
    assert "buy" in response.json()["detail"] or "sell" in response.json()["detail"]


def test_get_portfolio_history(client):
    """Test GET /portfolio/history returns snapshots."""
    response = client.get("/api/portfolio/history")
    assert response.status_code == 200
    data = response.json()

    # Should be a list
    assert isinstance(data, list)

    # Each entry should have total_value and recorded_at
    for entry in data:
        assert "total_value" in entry
        assert "recorded_at" in entry
