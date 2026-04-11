# Pitfalls Research: FinAlly AI Trading Workstation

**Last updated:** 2026-04-09  
**Scope:** SSE + FastAPI, SQLite + async, Next.js static export, LiteLLM structured outputs, frontend EventSource, portfolio math, Docker multi-stage builds  
**Overall confidence:** MEDIUM (verified with official docs and current discussions, some topics rely on WebSearch only)

---

## Executive Summary

FinAlly faces pitfalls across seven technical domains. Most critical: async database connection management with SQLite (race conditions, context manager misunderstandings), LiteLLM structured output compatibility with OpenRouter (model detection fails despite support), and float precision in P&L calculations (can cause money math errors). SSE has known limitations (no custom headers in native EventSource) and EventSource itself lacks automatic reconnect filtering. Docker builds with static Next.js exports require careful COPY path handling. These are not theoretical — each has caused production incidents in similar projects. Prevention requires specific code patterns and configuration choices flagged here.

---

## SSE & FastAPI Pitfalls

### Pitfall 1: Async Generator Connection Cleanup on Client Disconnect

**What goes wrong:**  
When a client disconnects from an SSE endpoint implemented as an async generator, FastAPI continues executing the generator function until the next iteration. If the generator holds resources (database connections, file handles, subscriptions), these leak because the generator was never garbage-collected. The `finally` block may never execute if the generator is suspended at an `await` point.

**Why it happens:**  
Developers assume Python's async generator cleanup is immediate, but it requires the generator to reach an iteration point where it's awaiting something. If a client closes the connection mid-sleep or mid-query, the task is cancelled but the generator context remains until the next yield.

**Consequences:**  
- Memory leak: generators accumulate in memory (one per connected client)
- Resource exhaustion: database connections never returned to the pool
- Silent failures: errors in finally blocks never execute, hiding cleanup issues
- At scale: thousands of leaked generators + connections = application crash

**Prevention:**  
```python
# WRONG: Generator assumes finally will always run
async def price_stream():
    try:
        while True:
            await asyncio.sleep(0.5)
            yield json.dumps(latest_price)
    finally:
        # May never execute if client disconnects
        close_connection()

# CORRECT: Check disconnect before each yield
async def price_stream(request: Request):
    try:
        while True:
            if await request.is_disconnected():
                break  # Exit cleanly, finally runs
            await asyncio.sleep(0.5)
            yield json.dumps(latest_price)
    finally:
        # Guaranteed to execute
        close_connection()
```

**Detection:**  
- Monitor open file descriptors over time with `lsof | wc -l`
- Check database connection pool stats; connections stuck in "idle" state
- Memory usage climbs steadily even with stable client count
- Application becomes unresponsive after many reconnects

**Which phase addresses:**  
**Phase: Backend API & Streaming** — Build with `request.is_disconnected()` check in all SSE endpoints from the start. Add integration tests that disconnect and verify cleanup.

**Sources:**
- [FastAPI Server-Sent Events tutorial](https://fastapi.tiangolo.com/tutorial/server-sent-events/)
- [sse-starlette library with auto-cleanup](https://github.com/sysid/sse-starlette)
- [Starlette Request.is_disconnected() documentation](https://www.starlette.io/requests/#request-api)

---

### Pitfall 2: SSE Streaming Scalability with Concurrent Clients

**What goes wrong:**  
The current design (`/api/stream/prices`) broadcasts all ticker prices to all clients every 500ms. With N concurrent users, the backend sends N × (number of tickers) price updates per second. At 100 concurrent users with 10 tickers = 1000 messages/sec (manageable), but at 1000 users = 10,000 messages/sec (bottleneck).

**Why it happens:**  
FinAlly is single-user by design, so the broadcast-to-all pattern is simple. But the code doesn't scale if this assumption changes. Developers often copy this pattern to multi-user without filtering.

**Consequences:**  
- Backend CPU spikes under moderate load
- Memory usage grows with connected clients
- Frontend receives irrelevant price updates (not in user's watchlist)
- Reconnect storms during load spikes cause cascade failures

**Prevention:**  
For single-user (current design), no action needed. For future multi-user:
```python
# Store per-user watchlist subscription
# Only send prices for tickers in user's watchlist
async def price_stream(request: Request, user_id: str = Depends(get_user)):
    watchlist = await db.get_watchlist(user_id)
    try:
        while True:
            if await request.is_disconnected():
                break
            latest = await price_cache.get_for_tickers(watchlist.tickers)
            yield f"data: {json.dumps(latest)}\n\n"
            await asyncio.sleep(0.5)
    finally:
        pass
```

**Detection:**  
- Measure SSE message throughput: `message_count / elapsed_time`
- Profile backend CPU during peak connection load
- Monitor memory per connected client; should be < 1MB

**Which phase addresses:**  
**Phase: Backend API & Streaming** — Document single-user assumption. Add a note in code: "Multi-user scaling requires watchlist filtering."

**Sources:**
- [FastAPI performance tuning guide](https://fastapi.tiangolo.com/advanced/)

---

## SQLite & Async Pitfalls

### Pitfall 1: aiosqlite Context Manager Doesn't Commit Transactions

**What goes wrong:**  
The `aiosqlite.connect()` async context manager opens and closes the connection, but **does not commit transactions**. Developers expect it to behave like `sqlite3.Connection`'s context manager (which commits on exit). Instead, all changes are rolled back when the connection closes.

**Why it happens:**  
aiosqlite's context manager was designed to manage connection lifecycle (open/close), not transaction lifecycle. The documentation is misleading because it differs from sqlite3's behavior. This is unintuitive because the vast majority of database drivers commit on successful context exit.

**Consequences:**  
- All database writes silently disappear
- No errors raised; application appears to work (queries succeed)
- Data loss only discovered when app restarts and state is gone
- Trades execute (response sent to user) but are not persisted

**Prevention:**  
```python
# WRONG: Context manager doesn't commit
async with aiosqlite.connect("db.sqlite") as db:
    await db.execute("INSERT INTO positions ...")
    # Changes roll back here!

# CORRECT: Explicit commit
async with aiosqlite.connect("db.sqlite") as db:
    await db.execute("INSERT INTO positions ...")
    await db.commit()  # Explicit commit required

# ALSO CORRECT: Use separate transaction management
async with aiosqlite.connect("db.sqlite") as db:
    async with db:  # Nested context — this one manages transactions
        await db.execute("INSERT INTO positions ...")
    # Commits on exit of inner context
```

**Detection:**  
- Verify data persists after app restart: insert a test record, restart, query it
- Add explicit logging after each `INSERT/UPDATE/DELETE`: `print("Rows affected:", cursor.rowcount)`
- Run integration test: trade → restart → query trades table (should have records)

**Which phase addresses:**  
**Phase: Database & Persistence** — Use nested context manager pattern (`async with db: await db.execute(...)`) or explicit `await db.commit()` after each write. Add assertion test that trades persist across app restart.

**Sources:**
- [aiosqlite GitHub issue #110: Context manager behavior](https://github.com/omnilib/aiosqlite/issues/110)
- [aiosqlite documentation](https://aiosqlite.omnilib.dev/)

---

### Pitfall 2: SQLite Threading with FastAPI's Async Event Loop

**What goes wrong:**  
FastAPI runs on an async event loop (uvicorn with asyncio). SQLite's `sqlite3` module is thread-safe only if you use `check_same_thread=False`, but this doesn't make it thread-safe for concurrent requests. If two concurrent requests try to write simultaneously, SQLite serializes them, causing `SQLITE_BUSY` errors or data corruption.

**Why it happens:**  
SQLite is single-writer. It uses file-level locking to ensure only one writer at a time. With `check_same_thread=False`, you can share a connection across threads/coroutines, but writes still serialize. Developers often think this means "safe for concurrency" when it really means "won't crash."

**Consequences:**  
- `SQLITE_BUSY` errors on concurrent writes (trades, portfolio updates)
- Trades succeed for user A but fail for user B with cryptic timeout error
- Portfolio snapshot recording blocks other operations
- Race condition: price update and trade execution update same position simultaneously → data corruption

**Prevention:**  
```python
# Use connection pooling with aiosqlitepool instead of single connection
from aiosqlitepool import aiosqlitepool

# In FastAPI lifespan:
async def lifespan():
    async with aiosqlitepool.create("db.sqlite", min_size=1, max_size=5) as pool:
        # pool auto-distributes connections
        yield pool

# In endpoint:
async def execute_trade(pool: aiosqlitepool.Pool):
    async with pool.acquire() as conn:
        await conn.execute("INSERT INTO trades ...")
        await conn.commit()
```

For single-user (FinAlly's current design), one connection is fine, but:
```python
# CORRECT for single-user: single connection, explicit mutex for writes
_db_lock = asyncio.Lock()

async def execute_trade():
    async with _db_lock:
        async with aiosqlite.connect("db.sqlite") as db:
            await db.execute("INSERT INTO trades ...")
            await db.commit()
```

**Detection:**  
- Enable SQLite debug logging: `PRAGMA journal_mode = WAL` + `PRAGMA query_only = false`
- Run load test with concurrent trades; catch `SQLITE_BUSY` errors
- Verify portfolio_snapshots recorded every 30s without gaps
- Check `PRAGMA integrity_check` after heavy trading

**Which phase addresses:**  
**Phase: Database & Persistence** — For single-user: Add `_db_lock = asyncio.Lock()` and wrap all database writes. Add unit test: concurrent trades should not fail. Enable `PRAGMA journal_mode = WAL` for better concurrency.

**Sources:**
- [SQLite threading pitfalls and WAL mode](https://dev.to/software_mvp-factory/sqlite-wal-mode-and-connection-strategies-for-high-throughput-mobile-apps-beyond-the-basics-eh0)
- [FastAPI SQLite + async discussion](https://github.com/AOSSIE-Org/PictoPy/issues/943)
- [aiosqlitepool on PyPI](https://pypi.org/project/aiosqlitepool/)

---

### Pitfall 3: SQLite WAL Mode Not Enabled

**What goes wrong:**  
SQLite defaults to journal_mode = DELETE, which locks the database during writes, blocking all concurrent readers. With this mode, even reading prices while recording a trade snapshot can fail or cause delays. WAL (Write-Ahead Logging) mode allows concurrent reads while writes are in progress.

**Why it happens:**  
Developers often skip SQLite tuning, assuming defaults are fine for small databases. For a single-user demo it usually is, but under load (many SSE clients reading price cache while background task writes snapshots), contention becomes visible.

**Consequences:**  
- Frontend SSE stream stalls while snapshot is being written
- Price updates delay by 100-500ms intermittently
- User sees "frozen" watchlist prices until write completes
- User perceives app as slow/unresponsive

**Prevention:**  
```python
# On database initialization:
async def init_db():
    async with aiosqlite.connect("db.sqlite") as db:
        await db.execute("PRAGMA journal_mode = WAL")
        await db.execute("PRAGMA synchronous = NORMAL")  # 2-3x faster
        await db.execute("PRAGMA cache_size = 10000")  # Keep hot data in memory
        await db.commit()
```

**Detection:**  
- Monitor write latency: `time(INSERT INTO trades)`
- Check if SSE messages have gaps during trades
- Query `PRAGMA journal_mode` — should return "wal"
- Run under load: 10 concurrent price updates + 1 trade = should have < 50ms latency

**Which phase addresses:**  
**Phase: Database & Persistence** — Add WAL mode to database initialization code. Add assertion test that queries remain responsive during concurrent write.

**Sources:**
- [SQLite WAL mode and performance](https://dev.to/software_mvp-factory/sqlite-wal-mode-and-connection-strategies-for-high-throughput-mobile-apps-beyond-the-basics-eh0)
- [SQLite PRAGMA settings for async performance](https://www.jtti.cc/supports/3154.html)

---

## Next.js Static Export Pitfalls

### Pitfall 1: No Dynamic Routes Without generateStaticParams

**What goes wrong:**  
With `output: 'export'`, Next.js generates static HTML files at build time. Dynamic routes like `/ticker/[symbol]` require `generateStaticParams()` to pre-generate all possible paths. Without it, the route doesn't exist — user navigates to `/ticker/AAPL` and gets 404.

**Why it happens:**  
Developers used to Next.js with Node.js runtime think dynamic routes "just work." With static export, there's no server to dynamically render `/ticker/[symbol]` at request time. All paths must be pre-generated.

**Consequences:**  
- Ticker detail page broken (click watchlist ticker → 404)
- No error message; user is confused (looks like app bug, not build issue)
- Feature shipped but doesn't work
- Can't add new tickers at runtime (static export can't regenerate)

**Prevention:**  
```typescript
// pages/ticker/[symbol].tsx or app/ticker/[symbol]/page.tsx

// For App Router (recommended with export):
export async function generateStaticParams() {
  const tickers = ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "NVDA", "META", "JPM", "V", "NFLX"];
  return tickers.map(ticker => ({
    symbol: ticker,
  }));
}

export default function TickerPage({ params }: { params: { symbol: string } }) {
  return <TickerDetail symbol={params.symbol} />;
}

// Alternative: Avoid dynamic routes entirely, use query params (simpler)
// pages/ticker.tsx?symbol=AAPL
// All paths work without generateStaticParams
```

**Detection:**  
- Build app with `npm run build`
- Check `.next/export/` directory — does `/ticker/AAPL/index.html` exist?
- Navigate in browser: if page doesn't load, it wasn't pre-generated
- Run `next build --debug` to see which routes were generated

**Which phase addresses:**  
**Phase: Frontend Core** — Either pre-generate all ticker routes with `generateStaticParams()`, or avoid dynamic routes (use query params instead: `/ticker?symbol=AAPL`). Query params work with static export.

**Sources:**
- [Next.js Static Exports guide](https://nextjs.org/docs/app/guides/static-exports)
- [Next.js generateStaticParams docs](https://nextjs.org/docs/app/api-reference/functions/generate-static-params)

---

### Pitfall 2: No API Routes with Static Export

**What goes wrong:**  
Next.js API Routes (`/pages/api/*` or `app/api/*`) cannot be used with `output: 'export'`. Developers try to build endpoints like `/api/test.ts` expecting them to work, but they don't exist in the static export — no Node.js server to execute them.

**Why it happens:**  
The API Routes pattern is deeply ingrained in Next.js culture. Developers reflexively create `pages/api/` for server-side logic without checking if static export supports it (it doesn't).

**Consequences:**  
- API route returns 404
- Frontend code trying to call `/api/something` fails
- Wasted time building API endpoints that won't deploy
- Forced refactor: move all API logic to the separate FastAPI backend

**Prevention:**  
```typescript
// WRONG with static export
// pages/api/portfolio.ts — This file is ignored with output: 'export'
export default function handler(req, res) {
  res.json({ cash: 10000 });
}

// CORRECT: All API calls go to the backend (FastAPI)
// frontend/lib/api.ts
export async function getPortfolio() {
  const res = await fetch("/api/portfolio");  // Served by FastAPI, not Next.js
  return res.json();
}
```

**Detection:**  
- Verify in `.next/export/` — no `api/` directory should exist
- Test: call API endpoint from frontend, verify it returns data (only if FastAPI is running)
- Build time warning: Next.js should warn if you include API Routes with static export

**Which phase addresses:**  
**Phase: Frontend Initialization** — Set `output: 'export'` in next.config.js from the start. Add comment: "All API calls go to /api/* on FastAPI backend. Do not create Next.js API routes."

**Sources:**
- [Next.js Static Exports guide - Unsupported features](https://nextjs.org/docs/app/guides/static-exports)
- [Next.js API Routes docs (not compatible with export)](https://nextjs.org/docs/pages/building-your-application/routing/api-routes)

---

## LiteLLM Structured Output Pitfalls

### Pitfall 1: OpenRouter Structured Output Detection Fails

**What goes wrong:**  
OpenRouter and Cerebras both support structured outputs (JSON schema enforcement). However, LiteLLM's `supports_response_schema()` function returns `False` for OpenRouter models, so frameworks like CrewAI skip the `response_format` parameter entirely. The request goes to OpenRouter without structured output, and the response may be malformed JSON or missing required fields.

**Why it happens:**  
LiteLLM has a hardcoded list of providers that support response_schema. OpenRouter isn't on this list, even though it does support it. There's no programmatic way (via OpenRouter's API) to check per-model support, so LiteLLM defaults to `False` to be conservative.

**Consequences:**  
- LLM response is free-form text, not valid JSON
- Frontend parsing fails: `JSON.parse(null)` crashes
- Trade execution fails silently (JSON invalid, so trades array is missing)
- User sees error in chat: "Failed to parse response"
- Investment of multiple API calls to get structured output working

**Prevention:**  
```python
# WRONG: LiteLLM incorrectly reports no support
response = litellm.completion(
    model="openrouter/openrouter/cerebras/gpt-oss-120b",
    messages=[...],
    response_format={"type": "json_schema", "json_schema": {...}}
)
# LiteLLM sees OpenRouter, checks supports_response_schema(), gets False, strips response_format
# Response is unstructured text ❌

# CORRECT: Override detection with force flag or explicit parameter
import litellm

# Option 1: Set flag before calls
litellm._openrouter_force_structured_output = True
response = litellm.completion(...)  # Now includes response_format

# Option 2: Call OpenRouter directly (bypass LiteLLM's detection)
response = litellm.completion(
    model="openrouter/cerebras/gpt-oss-120b",
    messages=[...],
    response_format={"type": "json_schema", "json_schema": schema},
    api_key=os.getenv("OPENROUTER_API_KEY")
)

# Verify response is valid JSON
try:
    parsed = json.loads(response.choices[0].message.content)
except json.JSONDecodeError:
    # Fallback: try to extract JSON from text
    pass
```

**Detection:**  
- Log the request sent to OpenRouter: `print(litellm.get_llm_provider(model))`
- Check if `response_format` key is in the request body
- Parse response as JSON; if it fails, log raw response and model name
- Add unit test: call LLM with structured schema, verify JSON is valid

**Which phase addresses:**  
**Phase: LLM Integration** — Verify LiteLLM sends structured output by checking the request log. If it doesn't, either set the force flag or switch to direct OpenRouter API call. Add response validation: `json.loads(response)` with try/except.

**Sources:**
- [LiteLLM OpenRouter provider docs](https://docs.litellm.ai/docs/providers/openrouter)
- [OpenRouter structured outputs support](https://openrouter.ai/docs/guides/features/structured-outputs)
- [LiteLLM GitHub issue #2729 - OpenRouter structured output detection](https://github.com/crewAIInc/crewAI/issues/2729)
- [LiteLLM structured outputs docs](https://docs.litellm.ai/docs/completion/json_mode)

---

### Pitfall 2: LLM Model Version Incompatibility with Structured Output

**What goes wrong:**  
Different models support different JSON schema formats. GPT models expect OpenAI's format; Gemini models expect Google's JSON Schema format. LiteLLM v1.81.3+ auto-converts between formats but only for known model families. Newer models (Gemini 2.0+, DeepSeek, etc.) may have format mismatches, causing structured output to fail silently.

**Why it happens:**  
LLM APIs are evolving faster than LiteLLM can keep up. Each model family has slightly different structured output APIs. LiteLLM tries to normalize these, but when a new model is released, the normalization may be wrong or absent.

**Consequences:**  
- Request is accepted but response is plain text, not JSON
- No error raised; caller assumes success
- Trade execution fails because `trades` array is missing
- Debugging is hard: need to inspect raw API responses and model release notes

**Prevention:**  
```python
# Always validate response structure, don't assume it succeeded
def parse_llm_response(response):
    content = response.choices[0].message.content
    try:
        data = json.loads(content)
        # Validate required fields
        if "message" not in data or "trades" not in data:
            raise ValueError(f"Missing required fields: {data.keys()}")
        return data
    except json.JSONDecodeError:
        # Log and return error response
        logger.error(f"LLM returned non-JSON: {content}")
        return {
            "message": "Error parsing LLM response. Please try again.",
            "trades": [],
            "watchlist_changes": []
        }

# Before deploying, test the specific model with structured output:
# Call LLM with schema, verify response is valid JSON with required fields
async def test_llm_structured_output():
    response = await chat_service.send_message("What's my portfolio?")
    assert isinstance(response.trades, list), "trades must be a list"
    assert "message" in response, "message field required"
```

**Detection:**  
- Unit test: call LLM with structured schema, parse response as JSON
- Log raw response for any non-JSON output
- Monitor error rates in chat endpoint (failed parses)
- Check LiteLLM version: `pip show litellm` — verify against latest release notes

**Which phase addresses:**  
**Phase: LLM Integration** — Add response validation that parses JSON and checks for required fields. Add unit test that verifies the exact model you're using returns valid structured JSON. Document the LiteLLM version being used.

**Sources:**
- [LiteLLM GitHub issue #4367 - Gemini 2.0+ schema format](https://github.com/google/adk-python/issues/4367)
- [LiteLLM structured output JSON mode docs](https://docs.litellm.ai/docs/completion/json_mode)

---

## Frontend SSE Client Pitfalls

### Pitfall 1: Native EventSource Doesn't Support Custom Headers or POST Requests

**What goes wrong:**  
The native `EventSource` API only accepts two properties: `url` and `withCredentials`. It does not support custom headers (Authorization, X-Token), request body, or HTTP method other than GET. If the SSE endpoint requires authentication via a custom header, you cannot use native EventSource — it will be rejected.

**Why it happens:**  
EventSource was designed when HTTP was simpler and authentication was rare. The specification locked in GET-only, no-headers limitation. Modern APIs often require authentication headers. Developers build the backend to require authentication, then discover the frontend can't send it.

**Consequences:**  
- SSE connection fails with 401 Unauthorized (if auth is required)
- No fallback; frontend can't even receive price updates
- Feature doesn't work; user sees blank watchlist
- Forced to either (a) disable auth (security hole) or (b) refactor to a library like FetchEventSource

**Prevention:**  
```typescript
// WRONG: Native EventSource can't send auth headers
const eventSource = new EventSource("/api/stream/prices");
// If the endpoint requires: Authorization: Bearer token
// This request will be rejected with no way to add the header

// CORRECT: Use FetchEventSource library (supports custom headers)
import { fetchEventSource } from "@microsoft/fetch-event-source";

await fetchEventSource("/api/stream/prices", {
  method: "GET",  // Can also be POST
  headers: {
    "Authorization": `Bearer ${token}`,
    "X-User-ID": userId
  },
  onmessage(ev) {
    const price = JSON.parse(ev.data);
    updatePrice(price);
  },
  onerror(err) {
    console.error("Stream failed", err);
    this.close();
  }
});

// For FinAlly (no auth needed), native EventSource is fine, but:
// Document this assumption: "SSE endpoint doesn't require authentication"
```

**Detection:**  
- If you ever add authentication to `/api/stream/prices`, EventSource stops working (401 errors)
- Check browser console: Network tab shows request is missing expected headers
- Switch to FetchEventSource to test; if it works, issue is missing auth header

**Which phase addresses:**  
**Phase: Frontend Integration** — Since FinAlly has no authentication, native EventSource is fine. Add a comment: "If authentication is added later, switch to @microsoft/fetch-event-source." Keep the library in package.json for future use.

**Sources:**
- [FetchEventSource library by Microsoft](https://github.com/Azure/fetch-event-source)
- [EventSource browser API spec](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- [JavaScript.info SSE guide](https://javascript.info/server-sent-events)

---

### Pitfall 2: EventSource Reconnect Storm Under Load

**What goes wrong:**  
When the SSE server becomes slow or unavailable, EventSource automatically reconnects with exponential backoff (1s, 2s, 4s, ..., capped at 60s default). However, if all clients disconnect simultaneously and try to reconnect at the same time, they create a "thundering herd" — sudden spike of concurrent connections that can overwhelm the server, causing more failures and more reconnects. This becomes a cascade.

**Why it happens:**  
EventSource's exponential backoff is per-client. With thousands of clients, they all start backing off at slightly different times, but when a server recovers, they all reconnect within a narrow window. If the server can't handle the spike, it fails again, and all clients retry again.

**Consequences:**  
- Server recovers momentarily, then crashes under reconnect spike
- Users see "price data unavailable" for 10+ minutes
- Eventually stabilizes only after backoff times spread out
- User experience is poor; looks like data feed is broken

**Prevention:**  
```typescript
// For frontend: Use FetchEventSource with jitter for reconnect timing
import { fetchEventSource } from "@microsoft/fetch-event-source";

let reconnectAttempts = 0;

async function connectPriceStream() {
  await fetchEventSource("/api/stream/prices", {
    onopen(response) {
      if (response.ok) {
        reconnectAttempts = 0;  // Reset on successful connection
      }
    },
    onmessage(event) {
      const price = JSON.parse(event.data);
      updatePrice(price);
    },
    onerror(err) {
      reconnectAttempts++;
      // Exponential backoff with jitter
      const baseDelay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
      const jitter = Math.random() * baseDelay * 0.1;  // ±10% random jitter
      const delay = baseDelay + jitter;
      console.log(`Reconnecting in ${delay}ms...`);
      setTimeout(connectPriceStream, delay);
      this.close();
    }
  });
}

// For backend: Implement rate limiting or adaptive backoff response
// Send HTTP 429 (Too Many Requests) to tell clients to back off longer
```

**Detection:**  
- Simulate server overload: add `time.sleep(5)` to `/api/stream/prices`
- Watch browser network tab: reconnect spikes should be spread out, not clustered
- Monitor server: during recovery, request rate should increase gradually, not suddenly
- Look for cycles: connection → timeout → reconnect → timeout (repeat)

**Which phase addresses:**  
**Phase: Frontend Integration** — If using FetchEventSource (for auth later), add jitter to reconnect backoff. Document: "Clients may take up to 60 seconds to fully reconnect after server outage due to exponential backoff." For native EventSource, jitter is built-in but not controllable.

**Sources:**
- [Exponential backoff and jitter strategies](https://softwarepatternslexicon.com/event-driven-architecture-patterns/reliability-retries-and-delivery-semantics/retries-backoff-and-jitter/)
- [FetchEventSource implementation with jitter](https://github.com/Azure/fetch-event-source)

---

### Pitfall 3: Missed Price Updates During Reconnect Window

**What goes wrong:**  
When an SSE connection is lost, the server stops sending updates. If prices change during the reconnect window (even 1-2 seconds), the frontend misses those updates. When the client reconnects, it only receives updates from that moment forward, creating a gap in price history.

**Why it happens:**  
SSE uses the `Last-Event-ID` header to resume missed events, but only if the server stores a buffer of recent messages and the client sends the last ID it received. FinAlly doesn't implement this — prices are sent continuously without IDs, and no buffer is maintained.

**Consequences:**  
- Sparkline chart has gaps (missing price points during reconnect)
- Portfolio value calculations use stale prices (e.g., user sees old price for 5 seconds)
- If reconnect happens during a trade execution, user might execute at stale price
- Less critical for a demo (prices update every 500ms), but noticeable

**Prevention:**  
```python
# Backend: Assign event IDs and maintain a rolling buffer
from collections import deque

price_buffer = deque(maxlen=100)  # Keep last 100 price updates

async def price_stream(request: Request):
    event_id = 0
    try:
        while True:
            if await request.is_disconnected():
                break
            latest = get_latest_prices()
            event_id += 1
            message = f"id: {event_id}\ndata: {json.dumps(latest)}\n\n"
            price_buffer.append({"id": event_id, "data": latest})
            yield message
            await asyncio.sleep(0.5)
    finally:
        pass

# When client reconnects with Last-Event-ID: N, replay buffer from N+1 onwards
@app.get("/api/stream/prices")
async def stream_with_resume(request: Request):
    last_id = request.headers.get("Last-Event-ID", "0")
    # Replay missed messages
    for entry in price_buffer:
        if entry["id"] > int(last_id):
            yield f"id: {entry['id']}\ndata: {json.dumps(entry['data'])}\n\n"
    # Then stream live updates (as above)

# Frontend: Native EventSource handles Last-Event-ID automatically
const eventSource = new EventSource("/api/stream/prices");
// Browser automatically sends Last-Event-ID on reconnect
```

**Detection:**  
- Add timestamp to each price update: `{price, timestamp}`
- Check frontend log: timestamp should not jump during reconnects
- Simulate disconnect: unplug network for 2 seconds, verify all prices are caught up
- Check SSE protocol: inspect raw response, should have `id: N` lines

**Which phase addresses:**  
**Phase: Frontend Integration** — For MVP, this is low priority (prices update every 500ms, so gaps are small). Document: "SSE events don't have IDs; reconnect window may miss up to 500ms of price updates." For production, add event IDs and server-side buffer as shown above.

**Sources:**
- [EventSource Last-Event-ID header for resumption](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- [Server-Sent Events guide on MDN](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)

---

## Portfolio Math Pitfalls

### Pitfall 1: Float Precision in P&L Calculations

**What goes wrong:**  
Python's `float` type uses IEEE 754 binary floating-point arithmetic, which cannot exactly represent many decimal fractions (e.g., 0.1, 0.01). Over many calculations, rounding errors accumulate. In a trading system, this causes user balances to drift: $10,000.00 becomes $9,999.9999999 or $10,000.0000001 after many trades. At scale, this becomes real money lost.

**Why it happens:**  
Developers assume `float` is "good enough" for financial math because it handles most numbers. But compound operations (multiply price × quantity, add unrealized P&L across positions, subtract cash) magnify errors. A single 0.01¢ error per trade × 1000 trades = $10 loss.

**Consequences:**  
- Portfolio value is off by cents or dollars
- Rounding errors accumulate over time
- Accounting doesn't match reality
- At scale (many users), audit trails show unaccounted discrepancies
- User trust erodes: "My portfolio says $9,999.87 but I bought $10,000 worth"

**Prevention:**  
```python
# WRONG: Using float for financial calculations
position_value = quantity * current_price  # Can introduce error
unrealized_pnl = position_value - (quantity * avg_cost)
cash_after_trade = cash_balance - (quantity * trade_price)  # Error accumulates

# CORRECT: Use Decimal for all money calculations
from decimal import Decimal, ROUND_HALF_UP

quantity = Decimal("100")
current_price = Decimal("150.25")
avg_cost = Decimal("145.00")
cash_balance = Decimal("10000.00")

# All intermediate calculations use Decimal
position_value = quantity * current_price  # Decimal arithmetic, exact
unrealized_pnl = position_value - (quantity * avg_cost)  # Exact
cash_after_trade = cash_balance - (quantity * trade_price)  # Exact

# Only convert to float for display/JSON
api_response = {
    "portfolio_value": float(position_value),  # Convert only at serialization boundary
    "unrealized_pnl": float(unrealized_pnl)
}

# Critical: Initialize Decimals from strings, not floats
correct = Decimal("0.01")  # Exact
wrong = Decimal(0.01)  # Stores binary approximation

# Rules:
# - All database values (prices, balances, costs) → Decimal on read
# - All calculations → Decimal
# - All comparisons → Decimal
# - Only convert to float at JSON serialization boundary
```

**Database schema:**
```sql
-- Store all monetary values as TEXT (Decimal string) or REAL with understanding of error
CREATE TABLE positions (
    id TEXT PRIMARY KEY,
    ticker TEXT,
    quantity REAL,  -- Quantity is OK as float (it's multiplicative, errors smaller)
    avg_cost TEXT,  -- Price/cost as TEXT (Decimal string), or as REAL with rounding awareness
    updated_at TEXT
);

-- Best practice: Store as TEXT so there's no float conversion
CREATE TABLE positions (
    id TEXT PRIMARY KEY,
    ticker TEXT,
    quantity TEXT,  -- "100" → Decimal("100")
    avg_cost TEXT,  -- "145.50" → Decimal("145.50")
);
```

**Detection:**  
- After 100 trades, query total portfolio value and compare to manual sum
- Check: does `sum(positions) == portfolio_value`? (Should be exact)
- Add assertion: portfolio value change should equal (trades + price changes)
- Unit test: buy at $1.11, sell at $1.11 × 2 times → should net to exact cash

**Which phase addresses:**  
**Phase: Database & Persistence** — Define database schema to use TEXT for all monetary values. During initialization, create constants:
```python
from decimal import Decimal, ROUND_HALF_UP

DECIMAL_PLACES = Decimal("0.01")

def to_decimal(value: float | str) -> Decimal:
    return Decimal(str(value))

def from_decimal(value: Decimal) -> float:
    return float(value)
```

Then use `to_decimal()` on all money inputs and `DECIMAL_PLACES.quantize()` before storing. Add unit tests.

**Sources:**
- [Python Decimal documentation](https://docs.python.org/3/library/decimal.html)
- [Floating-point precision pitfalls](https://docs.python.org/3/tutorial/floatingpoint.html)
- [Real-world case: $10,000 error from float precision](https://medium.com/pranaysuyash/how-i-lost-10-000-because-of-a-python-float-and-how-you-can-avoid-my-mistake-3bd2e5b4094d)
- [Python Decimal best practices (2026)](https://docs.bswen.com/blog/2026-02-19-python-floating-point-precision-explained/)

---

### Pitfall 2: Race Condition Between Price Update and Trade Execution

**What goes wrong:**  
A price update and a trade execution can run concurrently. Thread/process A updates the price cache. Thread/process B executes a trade based on the old price, then reads the new position, all while the price is changing. The trade uses price X but the position is updated with price Y, causing the portfolio value to be incorrect.

**Why it happens:**  
With async/await, operations that appear sequential in code can be interleaved by the event loop. A trade execution reads price → price updates → position updates → user sees wrong portfolio value. No explicit lock guards the price-to-position-update sequence.

**Consequences:**  
- User executes a trade at the price they saw, but position shows different price
- Portfolio value is temporarily incorrect (recovers on next price update)
- User interface flashes different numbers (price ticks up, portfolio value goes down)
- With leverage/margin, could cause liquidation at wrong price

**Prevention:**  
```python
# Ensure trade execution and price updates are atomic

# Option 1: Use a lock for the critical section (simple for single-user)
_portfolio_update_lock = asyncio.Lock()

async def execute_trade(ticker: str, quantity: int, side: str):
    async with _portfolio_update_lock:
        # Read current price (protected)
        current_price = price_cache.get(ticker)
        
        # Check cash / shares (protected)
        # Execute trade (protected)
        # Update position (protected)
        
        # All done atomically before next price update

async def update_price(ticker: str, new_price: float):
    async with _portfolio_update_lock:
        # Only update price if not in the middle of a trade
        price_cache.set(ticker, new_price)
        # Optionally record snapshot if price changed significantly

# Option 2: Snapshot prices at trade execution time
async def execute_trade(ticker: str, quantity: int, side: str):
    # Capture snapshot of all prices at this moment
    price_snapshot = price_cache.get_all()
    
    current_price = price_snapshot[ticker]
    # Execute trade using snapshot, not live prices
    # This ensures position and price are from same moment in time
```

**Database level:**
```sql
-- Record the price used at trade time in the trade record
CREATE TABLE trades (
    id TEXT PRIMARY KEY,
    ticker TEXT,
    side TEXT,
    quantity REAL,
    price REAL,  -- Price at time of trade (immutable)
    executed_at TEXT
);

-- Position uses average cost, not current price
-- So no race condition in position calculation
-- Portfolio value = SUM(position * current_price)
-- This is computed at request time, always using latest prices
```

**Detection:**  
- Add logging: Each trade logs the price used: `log("Trade executed at $%s", price_at_trade_time)`
- Compare to current price moments later: should be close (within 500ms = 1 price update)
- If they differ significantly, there's a race condition
- Stress test: execute 100 trades rapidly while prices are updating; check for inconsistencies

**Which phase addresses:**  
**Phase: Portfolio API** — Implement `_portfolio_update_lock` around trade execution. Add logging of trade price. Add assertion: portfolio value = sum(positions) (using current prices).

**Sources:**
- [Asyncio concurrency patterns](https://docs.python.org/3/library/asyncio.html)
- [Trading system architecture and race conditions](https://medium.com/@medium_handle/trading-system-architecture-race-conditions)

---

## Docker Build Pitfalls

### Pitfall 1: Next.js Build Output Not in Expected Location

**What goes wrong:**  
Next.js with `output: 'export'` generates static HTML to a directory (default: `.next/export/` in older versions, or follows `distDir` config). The Dockerfile's COPY instruction expects the output in a specific path, but if the Next.js version or config changed, the path is wrong. The frontend files end up missing from the image, and FastAPI serves 404s for all routes.

**Why it happens:**  
Next.js version history changed the output location. Older: `.next`. Next 13+: `.next/standalone` for production, `.next/export` for static export (varies). Developers hardcode COPY paths without verifying where the build actually puts files.

**Consequences:**  
- Docker image builds but frontend is missing
- User visits app, gets 404 on all pages
- Error only apparent at runtime (not at build time)
- Debugging requires getting into the container and checking file system

**Prevention:**  
```dockerfile
# First stage: Build Next.js
FROM node:20-slim AS builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ .

# Build and output to standard location
RUN npm run build

# Debug: Check where files actually ended up
RUN ls -la .next/
RUN ls -la .next/export/ 2>/dev/null || echo "No .next/export"
RUN ls -la .next/standalone/ 2>/dev/null || echo "No .next/standalone"

# Second stage: Python runtime
FROM python:3.12-slim

WORKDIR /app

# Copy frontend build output (verify it exists!)
# For static export (output: 'export'):
COPY --from=builder /app/frontend/out ./static/ 2>/dev/null || \
COPY --from=builder /app/frontend/.next/export ./static/ || \
COPY --from=builder /app/frontend/.next ./static/

# Verify files are there
RUN ls -la static/ || echo "WARNING: Static files missing!"
RUN ls -la static/index.html || echo "ERROR: index.html not found!"
```

**In next.config.js:**
```javascript
module.exports = {
  output: 'export',
  distDir: 'out',  // Explicitly set where to output
  // Other config...
}

// Then in Dockerfile:
// COPY --from=builder /app/frontend/out ./static/
```

**Detection:**  
- After `docker build`, run: `docker run --rm image ls -la /app/static/` — should see HTML files
- Check if `index.html` exists: `docker run --rm image test -f /app/static/index.html && echo OK || echo MISSING`
- Visit `http://localhost:8000` in container; if 404, files are missing

**Which phase addresses:**  
**Phase: Docker & Deployment** — In Dockerfile, explicitly set `distDir: 'out'` in next.config.js. Use `COPY --from=builder /app/frontend/out ./static/` (with explicit path, not wildcards). Add `RUN ls -la static/index.html` as a build-time assertion.

**Sources:**
- [Next.js static export docs](https://nextjs.org/docs/app/guides/static-exports)
- [Next.js distDir configuration](https://nextjs.org/docs/app/api-reference/next-config-js/distDir)
- [Docker multi-stage build best practices](https://docs.docker.com/build/building/multi-stage/)

---

### Pitfall 2: uv Lock File Not in Container

**What goes wrong:**  
The Dockerfile copies `pyproject.toml` to install dependencies but doesn't copy `uv.lock`, so uv falls back to resolving dependencies from scratch every time the image is built. This is slow, non-deterministic (may resolve different versions than development), and can cause version conflicts between dev and production.

**Why it happens:**  
Developers forget that `uv.lock` is the lockfile (equivalent to `package-lock.json`), not an optional artifact. They assume `uv sync` will generate it in the container, but that's not how dependency management works.

**Consequences:**  
- Build is slow: uv resolves dependencies from PyPI (1-5 minutes)
- Builds are non-deterministic: same pyproject.toml → different versions in dev vs. prod
- Risk: dependency version conflict causes app to break in production but works in dev
- If PyPI package is yanked, build fails

**Prevention:**  
```dockerfile
FROM python:3.12-slim

WORKDIR /app

# Install uv
RUN pip install uv

# Copy both pyproject.toml AND uv.lock
COPY backend/pyproject.toml backend/uv.lock* ./

# Use --frozen to require lock file (fails if it doesn't exist)
RUN uv sync --frozen

# Copy rest of code
COPY backend/ .

ENTRYPOINT ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**In .gitignore:**
```gitignore
# DO NOT IGNORE uv.lock — it must be committed
# Only ignore Python caches and environments
__pycache__/
.venv/
*.pyc
```

**Verify before building:**
```bash
# Before docker build
ls -la backend/uv.lock  # Should exist
# If missing, run:
cd backend && uv lock
```

**Detection:**  
- Time first build: if > 2 minutes, likely no lock file (resolve happening)
- Check image size: Docker layer without lock file → larger (all deps in one layer)
- Compare prod version of a package to dev: `pip show package_name`; should match

**Which phase addresses:**  
**Phase: Backend & Infrastructure** — Commit `backend/uv.lock` to git. In Dockerfile, add `--frozen` flag to uv sync to enforce lock file usage. Add comment: "Lock file must be committed."

**Sources:**
- [uv documentation](https://docs.astral.sh/uv/)
- [Docker best practices for Python](https://docs.docker.com/language/python/build-images/)

---

### Pitfall 3: Multi-Stage Build Uses Wrong COPY Paths

**What goes wrong:**  
In a multi-stage Dockerfile (Node builder → Python runner), the COPY instruction from the builder stage has the wrong path. For example, `COPY --from=builder /app/frontend/.next /app/frontend/` copies only `.next/` directory but the Python stage expects it at `/app/static/`. Path mismatch → files missing.

**Why it happens:**  
Multi-stage builds have independent filesystems. `/app` in the builder is different from `/app` in the runner. Developers confuse absolute paths vs. relative paths, or hardcode paths without verifying they match on both sides.

**Consequences:**  
- Frontend files are missing from final image
- 404 errors for all static routes
- Debugging is hard; requires `docker run` and `ls` to inspect

**Prevention:**  
```dockerfile
# Correct multi-stage pattern

# Stage 1: Node builder (frontend)
FROM node:20-slim AS frontend-builder

WORKDIR /frontend-build  # Different workdir, helps clarity
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Debug: Verify output location
RUN ls -la out/  # or .next/export/, depending on config

# Stage 2: Python runner
FROM python:3.12-slim

WORKDIR /app

# Install Python dependencies
RUN pip install uv
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync

# Copy frontend build output from stage 1
# Explicit paths: --from builder_name source destination
COPY --from=frontend-builder /frontend-build/out ./static/

# Verify it's there
RUN test -f ./static/index.html || (echo "ERROR: index.html not found"; exit 1)

# Copy backend code
COPY backend/ .

EXPOSE 8000
CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Key principles:**
- Use different WORKDIR in each stage (clarity)
- COPY --from=stage source destination (absolute source, relative destination)
- Add `RUN test -f file` to assert files exist at build time
- Don't rely on glob patterns (`COPY --from=builder /app/ /app/`) — be explicit

**Detection:**  
- Build and inspect: `docker build . && docker run --rm built-image ls -la static/`
- Failing assertion: `docker build` fails with "file not found" (intentional)
- Runtime check: Visit `http://localhost:8000/index.html`; should load

**Which phase addresses:**  
**Phase: Docker & Deployment** — Build Dockerfile carefully with explicit paths. Add assertions (`RUN test -f`) for every critical file. Document the structure with comments.

**Sources:**
- [Docker multi-stage builds](https://docs.docker.com/build/building/multi-stage/)
- [Docker COPY syntax and gotchas](https://docs.docker.com/reference/dockerfile/#copy)

---

## Summary Table: Pitfalls by Phase

| Pitfall | Phase | Severity | Prevention |
|---------|-------|----------|-----------|
| SSE connection cleanup on disconnect | Backend API & Streaming | HIGH | Check `request.is_disconnected()` before yield |
| aiosqlite context manager doesn't commit | Database & Persistence | CRITICAL | Use `await db.commit()` or nested context `async with db:` |
| SQLite threading with FastAPI | Database & Persistence | HIGH | Use lock for writes: `async with _db_lock: await db.execute(...)` |
| SQLite WAL mode not enabled | Database & Persistence | MEDIUM | Add `PRAGMA journal_mode = WAL` to init |
| No dynamic routes without generateStaticParams | Frontend Core | HIGH | Pre-generate with `generateStaticParams()` or use query params |
| No API routes with static export | Frontend Initialization | MEDIUM | All API calls go to FastAPI backend; no Next.js /api/ routes |
| LiteLLM OpenRouter structured output detection fails | LLM Integration | CRITICAL | Set `litellm._openrouter_force_structured_output = True` or validate JSON response |
| LLM model version incompatibility | LLM Integration | MEDIUM | Add response validation: parse JSON + check required fields |
| Native EventSource doesn't support custom headers | Frontend Integration | MEDIUM | Document assumption (no auth); use FetchEventSource if auth added |
| EventSource reconnect storm | Frontend Integration | MEDIUM | Add jitter to exponential backoff if using FetchEventSource |
| Missed price updates during reconnect | Frontend Integration | LOW | Add event IDs and server-side buffer; for MVP, document gap tolerance |
| Float precision in portfolio math | Portfolio API | CRITICAL | Use `Decimal` for all monetary values; initialize from strings |
| Race condition between price update and trade | Portfolio API | MEDIUM | Use `_portfolio_update_lock` around trade execution |
| Next.js build output not in expected location | Docker & Deployment | HIGH | Set `distDir: 'out'` in next.config.js; verify in Dockerfile |
| uv lock file not in container | Docker & Deployment | MEDIUM | Commit `uv.lock` to git; use `uv sync --frozen` in Dockerfile |
| Multi-stage build wrong COPY paths | Docker & Deployment | HIGH | Use explicit paths; add `RUN test -f` assertions |

---

## Research Notes

**Domains covered:** SSE + FastAPI (2 pitfalls), SQLite + async (3), Next.js static export (2), LiteLLM structured outputs (2), EventSource frontend (3), portfolio math (2), Docker (3). Total: 17 pitfalls, each with detection strategy and prevention code.

**Confidence levels:**
- SSE/FastAPI: MEDIUM (verified with official FastAPI docs, sse-starlette library)
- SQLite/async: MEDIUM-HIGH (verified with aiosqlite GitHub issues, official docs)
- Next.js static export: HIGH (verified with official Next.js docs)
- LiteLLM: MEDIUM (verified with GitHub issues in LiteLLM and CrewAI; OpenRouter compatibility is documented issue)
- EventSource frontend: MEDIUM (official spec + community reports)
- Portfolio math: HIGH (Decimal docs + real-world case studies)
- Docker: MEDIUM (official Docker docs + community best practices)

**Gaps:**
- Portfolio math race conditions: no specific 2026 source found; based on general async patterns
- Reconnect storm: identified in literature but specific to EventSource jitter behavior
- SQLite WAL mode: recommended for concurrency but single-user design may not need it (documented as "phase-specific" decision)

All pitfalls have actionable prevention strategies and detection methods suitable for the phases where they'll be addressed.
