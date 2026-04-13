# Project Learnings

Cross-story lessons worth carrying forward.

---

## Story 3.1 — Chat API with Portfolio Context (2026-04-13)

### LiteLLM / OpenRouter model string
Use `openrouter/openrouter/free` — LiteLLM strips the provider prefix from single-segment strings like `openrouter/free`, causing 502s. Always double the provider prefix for OpenRouter.

### Action loops: collect errors, don't raise
When executing a list of LLM-requested actions (trades, watchlist changes), catch all exceptions per-item and append `{status: "error"}` results — never raise. A single failing trade should not abort the LLM's reply or the other actions in the same response.

```python
try:
    await execute_trade(...)
    results.append({"status": "executed", ...})
except HTTPException as e:
    results.append({"status": "error", "error": ...})
except Exception as e:
    results.append({"status": "error", "error": str(e)})
```

### Normalize early, use everywhere
Compute derived values (e.g., `ticker_upper = change.ticker.upper()`) once and use that variable in every subsequent reference — DB inserts, result dicts, log messages. Using the raw input anywhere downstream breaks consistency silently.

### System prompt is the right place for portfolio context
Inject live portfolio state (cash, positions, watchlist) into the `system` message, not a user message. This gives the LLM stable, authoritative context that isn't confused with the conversational turn, and is correctly scoped for multi-turn history replay.

### Test the content of injected context, not just its presence
A test that only checks `m["role"] == "system"` exists is insufficient for AC coverage. Capture `kwargs["messages"]` in the fake completion and assert the specific fields (`Cash:`, `Total Value:`, `Positions:`, `Watchlist:`) are present in the system message content.

---
