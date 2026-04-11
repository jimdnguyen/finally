# Phase 3: LLM Chat Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-10
**Phase:** 03-llm-chat-integration
**Areas discussed:** Portfolio context injection

---

## Portfolio Context Injection

### Context depth

| Option | Description | Selected |
|--------|-------------|----------|
| Full context | Cash + positions (ticker, qty, avg cost, current price, unrealized P&L) + total value + watchlist with live prices | ✓ |
| Positions + cash only | Cash balance + positions with basic fields; leaner prompt | |
| Minimal — on demand | No context by default; LLM requests data via tool calls | |

**User's choice:** Full context (Recommended)
**Notes:** None

---

### Context format

| Option | Description | Selected |
|--------|-------------|----------|
| Structured prose | Human-readable paragraph block with natural language | ✓ |
| JSON block | Raw JSON matching /api/portfolio response shape | |
| Markdown table | Tabular format: Ticker \| Qty \| Avg Cost \| Price \| P&L | |

**User's choice:** Structured prose (Recommended)
**Notes:** None

---

### Context timing

| Option | Description | Selected |
|--------|-------------|----------|
| System prompt on every call | Rebuild fresh context on every request | ✓ |
| User message prefix | Prepend context block to each user message | |
| Only on first message | Inject once at conversation start | |

**User's choice:** System prompt on every call (Recommended)
**Notes:** None

---

## Claude's Discretion

- **History window** — Load last N turns (recommend 10–20) from chat_messages
- **Partial trade failure handling** — Continue-and-report (not abort-all)
- **Mock response design** — Fixed message + sample buy trade for LLM_MOCK=true
- **Chat module structure** — Follow backend/app/portfolio/ pattern

## Deferred Ideas

None
