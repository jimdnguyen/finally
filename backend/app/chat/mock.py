"""Hardcoded mock LLM response for LLM_MOCK=true mode."""

MOCK_RESPONSE = {
    "message": "I've analyzed your portfolio. I'll buy 1 share of AAPL for you.",
    "trades": [{"ticker": "AAPL", "side": "buy", "quantity": 1}],
    "watchlist_changes": [],
}
