# Features Research: FinAlly

**Domain:** Simulated AI-powered trading workstation
**Researched:** 2026-04-09
**Confidence:** MEDIUM (most findings verified across multiple trading platforms; some UX patterns inferred from Bloomberg/TradingView precedent)

---

## Summary

FinAlly must balance professional trader expectations with beginner accessibility. The research reveals a clear separation between **table stakes** (features users expect to work flawlessly), **differentiators** (what makes the AI integration and demo experience memorable), and **anti-features** (scope traps that add complexity without proportional value).

The core insight: traders expect three things to "just work" — prices flowing in real-time, positions updating instantly, and portfolio visualization at a glance. Everything else is secondary. The AI copilot is the differentiator; it should be fast, conversational, and capable of executing trades with zero friction (no confirmation dialogs). Avoid limit orders, stop losses, and order books — they dramatically increase complexity with minimal payoff for a simulated trading demo.

---

## Table Stakes

**Features users expect.** Missing any of these makes the app feel broken or unprofessional. Most are already specified in PLAN.md; research confirms their necessity and validates the design choices.

### Price Streaming & Live Updates

| Feature | Why Expected | UX Pattern |
|---------|--------------|-----------|
| **Watchlist with live prices** | Core value proposition; traders immediately need to see what they own/watch | Grid or table with ticker, current price, and change %. Prices update in real-time via SSE stream. |
| **Price flash animation** | Standard in all professional terminals (Bloomberg, TradingView, NinjaTrader). Enables instant visual recognition of direction without reading numbers. | On price change: briefly flash background green (uptick) or red (downtick), fade over ~500ms. Color intensity can indicate move strength. |
| **Green = up, red = down color convention** | Universally adopted in financial UIs. Traders see green and think "positive movement" instinctively. | Green for upticks, red for downticks. Applies to prices, P&L, and percentage changes. No exceptions. |
| **Sparkline mini-charts in watchlist** | Provides quick visual context of recent price action without clicking into a detail view. Reduces cognitive load ("Did this stock move a lot or just a little?"). | Small inline sparklines (not candlesticks) beside each ticker in the watchlist, accumulated from SSE stream since page load. Fills progressively as data arrives. |
| **Connection status indicator** | Users need confidence the app is still receiving live data. A silent disconnect is frustrating and breeds distrust. | Small colored dot (green = connected, yellow = reconnecting, red = disconnected) in the header. Visible at all times, no hidden state. |

### Portfolio Management

| Feature | Why Expected | UX Pattern |
|---------|--------------|-----------|
| **Current positions table** | Traders need a canonical reference of what they own. Must show: ticker, quantity, average cost, current price, unrealized P&L, % change. | Tabular view, sortable, always up-to-date. No hidden precision; show actual numbers (not just "up 5%"). |
| **Cash balance display** | Traders need to know buying power immediately. Critical for making trade decisions. | Prominently displayed in header. Updates instantly after each trade. |
| **Total portfolio value (live)** | North star metric; traders need one number that summarizes their total wealth at a glance. | Large, prominent number in header, updating live as prices change and trades execute. |
| **Portfolio heatmap/treemap** | Professional terminals use this for instant sector/position risk assessment. Each rectangle = a position, sized by weight, colored by P&L (green profit, red loss). | Treemap visualization. Clicking a rectangle selects that ticker for detailed chart view (if implemented). Colors follow green/red convention strictly. |
| **P&L chart (portfolio value over time)** | Traders want to see their total return trajectory. A flat line vs. a rising line tells a story. | Line chart showing total portfolio value over time, sourced from `portfolio_snapshots` table (recorded every 30s + after each trade). |

### Trade Execution

| Feature | Why Expected | UX Pattern |
|---------|--------------|-----------|
| **Market orders (instant fill)** | Simulated environment; no order book complexity needed. Users expect to click "Buy" and instantly own shares. | Ticker field (autocomplete from watchlist + full universe), quantity field, Buy/Sell buttons. No confirmation dialog (see Anti-Features). Instant visual feedback (position updates immediately). |
| **Trade feedback/confirmation in UI** | User needs to know the trade succeeded (or why it failed). | Toast notification or inline message: "Bought 10 AAPL @ $190.25" (green). If insufficient cash/shares: "Insufficient cash" (red). Dismissible. |
| **Trade history visibility** | Users want to audit their activity. Not table stakes for execution, but expected in a professional platform. | Accessible via API or separate view, though not required in v1 UI focus. |

### Watchlist Management

| Feature | Why Expected | UX Pattern |
|---------|--------------|-----------|
| **Add/remove tickers manually** | Users want to customize their watch list. Rigid default list feels limiting. | Simple UI: input field for ticker symbol, "Add" button. Delete icon/button on each watchlist item. Immediate feedback (appears/disappears). |
| **Watchlist persistence** | Users expect their watchlist to survive a page reload. | Stored in database (`watchlist` table). Loaded on app init. |
| **Watchlist-aware chat integration** | AI should be able to manage the watchlist via natural language ("Add PYPL to my watch list"). | LLM can execute `watchlist_changes` in its structured output. |

### Data Accuracy & Performance

| Feature | Why Expected | UX Pattern |
|---------|--------------|-----------|
| **P&L calculations are accurate** | Traders make decisions based on P&L. Wrong numbers destroy trust instantly. | Avg cost calculated correctly for fractional shares. Unrealized P&L = (current_price - avg_cost) × quantity. Realized P&L on sell. |
| **Prices update at consistent cadence** | Traders lose confidence in a system where prices sometimes stall. SSE should push updates at ~500ms intervals. | Consistent update frequency. No gaps or stuttering. |
| **Chart rendering performs smoothly** | Jank (stuttering, lag) in a data viz tool screams "amateur." | Canvas-based charting (Lightweight Charts, Recharts), not SVG. Optimize for smooth 60fps updates. |

---

## Differentiators

**Features that set FinAlly apart.** Not expected by default, but highly valued. These are the "wow" moments that make the demo memorable.

### AI Chat Integration with Auto-Execution

| Feature | Value Proposition | Complexity | UX Considerations |
|---------|-------------------|-----------|-------------------|
| **Conversational trade execution** | "Buy 10 AAPL" → AI interprets, executes, and confirms inline. No form filling. | Medium | Conversational interface is table stakes (input field + history). Auto-execution is the differentiator. |
| **Portfolio context injection** | LLM sees live positions, cash, P&L, watchlist. Generates informed analysis and suggestions. | Medium | Requires backend to inject context into LLM prompt before each call. Frontend shows loading indicator. |
| **Inline trade confirmations in chat** | When LLM executes a trade, the chat history shows "Bought 10 AAPL @ $190.25" as a visual confirmation. | Medium | After trade auto-executes, display trade details inline as an assistant message or badge. Shows what the AI actually did. |
| **Watchlist management via chat** | "Add PYPL to my watch list" → AI executes, list updates. No UI button needed. | Low | LLM response includes `watchlist_changes` array. Frontend updates watchlist state. |
| **Deterministic mock mode (testing)** | E2E tests run fast with `LLM_MOCK=true`. Removes API dependency. Makes CI/CD simple. | Low | Backend checks env var, returns mock responses. Tests remain deterministic. |

### Visual Polish & Terminal Aesthetic

| Feature | Value Proposition | Notes |
|---------|-------------------|-------|
| **Bloomberg-inspired dark theme** | Professional, visually cohesive, reduces eye strain in extended use. | #0d1117 backgrounds, muted gray borders, no pure black. Accent colors: yellow (#ecad0a), blue (#209dd7), purple (#753991). |
| **Sparkline progression** | As SSE stream arrives, sparklines fill in in real-time. Gives the sense of live data accumulating. | Frontend manages sparkline data locally (no API call needed for historical). Visual metaphor of "data is flowing." |
| **Price flash animation timing** | ~500ms fade creates a smooth, professional feel without being distracting. | Too fast (100ms) = missed by the eye. Too slow (2s+) = feels sluggish. 500ms is the sweet spot across trading platforms. |

### Zero Friction Demo Flow

| Feature | Value Proposition | Why Valuable |
|---------|-------------------|--------------|
| **No signup, no login** | User runs Docker command, opens browser, immediately trading. No auth friction. | Removes barriers to trial. Captures interest at peak attention. |
| **No confirmation dialogs** | Click "Buy 10 AAPL" → instantly done. No modal asking "Are you sure?" | Simulated money (zero real risk) means safety checks are unnecessary. Fluid UX matches AI-agent theme of the course. |
| **Instant visual feedback** | Trade executes → position table updates, cash updates, portfolio value updates, all in <500ms. | Psychological feedback loop: user feels in control. |
| **One Docker command to deploy** | Students don't debug infrastructure. They see a working trading app immediately. | Lowers cognitive load. Students focus on architecture and AI integration, not DevOps. |

---

## Anti-Features (Deliberately Avoid in v1)

**Things to NOT build.** Sound good but add complexity without proportional value for a simulated trading demo.

### Limit Orders & Stop Losses

| Anti-Feature | Why Avoid | Complexity Cost | What to Say Instead |
|--------------|-----------|-----------------|-------------------|
| Limit orders (buy at or below X, sell at or above Y) | Requires order book, queuing logic, partial fills, order cancellation. Dramatically increases portfolio math complexity. | High | "FinAlly focuses on market orders for simplicity. LLM can still suggest limit order concepts in chat analysis." |
| Stop-loss orders (auto-sell if price drops below X) | Requires monitoring threshold, triggering sell, handling edge cases (gap down past stop). Adds state management. | High | "Auto-trading rules can be simulated via chat suggestions: 'Consider setting a mental stop at $180.'" |
| Trailing stops | Even more complex: tracks moving maximum, triggers on pullback. Rarely used by retail traders; high complexity for low value. | Very High | "Not in v1." |

### Multi-Currency & Crypto

| Anti-Feature | Why Avoid | Complexity Cost |
|--------------|-----------|-----------------|
| Multi-currency portfolio (USD + EUR + GBP) | Exchange rates, FX conversions, multi-currency P&L. Adds dimension to every calculation. | High |
| Crypto trading | Volatile pricing, fractional satoshis, different asset classes, custody models. Different rules than stocks. | Very High |

### Options & Derivatives

| Anti-Feature | Why Avoid | Complexity Cost |
|--------------|-----------|-----------------|
| Options contracts (calls, puts, spreads) | Greeks (delta, gamma, vega), implied volatility, expirations, exercise logic, strike prices. Massive portfolio math expansion. | Very High |
| Futures | Margin, leverage, settlement, open interest tracking. Different paradigm than stocks. | Very High |
| Bonds, commodities | Each asset class has unique lifecycle. Out of scope. | N/A |

### Research & Analysis Tools

| Anti-Feature | Why Avoid | Complexity Cost | Alternative |
|--------------|-----------|-----------------|-------------|
| Built-in technical indicators (RSI, MACD, Bollinger Bands) | Nice to have but requires indicator library, parameter tuning, indicator state management. Distracts from core UI. | Medium | LLM can mention indicators in analysis ("AAPL looks overbought on RSI"). Focus on charting library for basic candlesticks. |
| News feed integration | Real-time news requires external API. Not core to trading flow. Low value add. | Medium | Link to external news sources or mention in LLM responses. |
| Earnings calendar, economic data releases | Requires external data source. Users don't need it for simulated trading. | Medium | Out of scope for v1. |
| Advanced charting (multiple timeframes, overlays, drawing tools) | TradingView-grade charting is a full project. FinAlly needs basic price-over-time chart. | High | Basic candlestick/line chart. LLM analysis can mention timeframes conceptually. |

### Multi-User & Collaboration

| Anti-Feature | Why Avoid | Why It Matters |
|--------------|-----------|----------------|
| User authentication, multi-user, leaderboards | Schema supports it, but adding auth, user profiles, persistent data per user adds a security/complexity layer. | Single `user_id="default"` is sufficient for a demo. Auth can come later. |
| Portfolio sharing, team accounts | Out of scope. Single-user only. | — |

### Paper-Trading Realism Bells & Whistles

| Anti-Feature | Why Avoid | Notes |
|--------------|-----------|-------|
| Slippage simulation (price moves between order intent and fill) | Realistic but adds complexity. Market orders should fill instantly in a simulator. | Keep it simple. |
| Commission/fee tracking | Nominal fees distract from learning. "No fees" is the model. | Keeps portfolio math clean. |
| Dividend tracking, stock splits | Real-world details that don't matter in a 1-month demo. | Out of scope. |
| Account statements, tax reports | Great for a real brokerage. Not necessary for a trading workstation. | — |
| Alerts (price-based, news-based) | Adds notification infrastructure. Users don't need it. | LLM can proactively suggest analysis. |

### Excessive Customization

| Anti-Feature | Why Avoid |
|--------------|-----------|
| User-configurable dashboard layout | "Drag and drop widgets" sounds nice but requires state management and doesn't add value for a demo. | Fixed layout is professional and clear. |
| Color/theme switching | Dark theme is the default (terminal aesthetic). No light mode needed. | Out of scope. |
| Font size/zoom adjustments | Responsive design handles tablet/desktop. No need for granular user control. | Keep it simple. |

---

## Feature Complexity Notes

### Deceptively Hard Features

These features sound simple but hide complexity:

#### 1. **Accurate Average Cost Calculation**
**Appears:** Simple (just average the buy prices)
**Reality:** Fractional shares, multiple buys at different prices, sells reduce quantity but not cost basis. Formula: `avg_cost = (total_value_of_all_buys) / (total_quantity_held)`. Easy to get wrong for edge cases.
**Mitigation:** Write unit tests for:
- Buy 10 @ $100, sell 5 → avg_cost stays $100 (cost basis doesn't change)
- Buy 10 @ $100, buy 10 @ $110 → avg_cost = $105
- Fractional shares (buy 3.5 @ $200)

#### 2. **SSE Reconnection**
**Appears:** "Just use EventSource, browser handles it"
**Reality:** Browser auto-reconnects, but frontend must re-sync state if prices were missed during disconnect. If SSE was down for 5 seconds, the sparkline has a gap. Do we interpolate? Skip? The backend must support Last-Event-ID to replay missed events (spec says `id` field on each event).
**Mitigation:** Test connection drop scenarios in E2E tests. Verify frontend gracefully handles missed data.

#### 3. **Portfolio Value Calculation**
**Appears:** Sum of (quantity × current_price) + cash
**Reality:** Must handle the case where a position is closed (quantity = 0) and should vanish from the table. Must not include closed positions in P&L calculations. Must re-calc instantly on price update or trade execution.
**Mitigation:** Write unit tests. Verify the positions table never shows zero-quantity rows. Verify P&L chart includes `portfolio_snapshots` entry immediately after each trade.

#### 4. **Chat State & Trade Validation**
**Appears:** "LLM says buy 10 AAPL, so we buy 10 AAPL"
**Reality:** What if user has only $1,500 and AAPL is $190? Trade fails. The LLM needs to be informed: "Insufficient cash (balance: $1,500, required: $1,900)." It must form a coherent response and offer an alternative. Frontend must display the error inline.
**Mitigation:** Backend validates all trades before executing, returns detailed error messages. LLM instruction prompt includes: "If a trade fails, inform the user and suggest an alternative quantity."

#### 5. **Watchlist Ordering**
**Appears:** "Just display in the order added"
**Reality:** Users expect some order: alphabetical, by performance, by size, by recently added. Database doesn't guarantee order unless we explicitly sort. Should we allow users to drag and reorder? Avoid that in v1.
**Mitigation:** Sort watchlist by ticker alphabetically for now. Simple, predictable, no state management needed.

---

## MVP Feature Prioritization

### Must Have (Phase 1: Foundation)

1. **Price streaming (SSE)** — Nothing works without live prices
2. **Watchlist display** — Core UI, must be professional
3. **Basic trade execution** — Market orders only, instant fill
4. **Portfolio overview** — Positions table, cash, total value
5. **Connection status** — Users need to know if prices are flowing

### Should Have (Phase 1-2: Polish)

6. **Price flash animations** — Professional feel, expected in trading UIs
7. **Heatmap/treemap** — Differentiator, adds visual interest
8. **P&L chart** — Gives sense of performance over time
9. **Sparklines in watchlist** — Quick visual context
10. **AI chat integration** — Core differentiator

### Nice to Have (Phase 2+: Polish)

11. **Advanced chart interactions** — Zoom, pan on main chart (if time permits)
12. **Chat history persistence** — Load chat on page reload
13. **Watchlist CRUD via UI** — Add/remove tickers from watchlist manually

### Not in v1

- Limit orders, stop losses
- Real historical data (simulator is fine)
- Multi-user, authentication
- Mobile optimization (desktop-first)
- Advanced indicators, news feed
- Account statements, tax reports

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Table Stakes | HIGH | Features confirmed across Bloomberg, TradingView, Robinhood; PLAN.md already specifies most of these |
| Price Flash Animation | HIGH | Green = up, red = down is universal. ~500ms fade is standard in multiple trading platforms. |
| Heatmap/Treemap Visualization | MEDIUM | Concept validated (used by TradingView, Finviz, JPMorgan). FinAlly's color convention (green P&L, red P&L) confirmed. Exact interaction model (click to select) TBD by Frontend Engineer. |
| Anti-Features | MEDIUM-HIGH | Limit orders, stop losses, options complexity widely confirmed. But "never do X" can be wrong; research flags these as complexity traps, not impossible. Backend can add them later. |
| AI Chat UX Patterns | MEDIUM | "Inline confirmations" and "auto-execution" are inferred from Bobby and BingX patterns; no single canonical pattern found. PLAN.md decision (no confirmation dialog) is justified by simulated environment (zero real risk). |
| Connection Status Indicator | MEDIUM | WebSocket/SSE reconnection patterns are clear. FinAlly uses SSE with built-in browser reconnect. Need to verify frontend gracefully handles state sync on reconnect. |
| Feature Dependencies | HIGH | Trade execution depends on price cache, price cache depends on SSE, SSE depends on market data backend. Order is clear. |

---

## Gaps to Address

1. **Chat inline confirmation UI pattern** — PLAN.md specifies trades auto-execute, but exact visual pattern (badge, inline message, etc.) not defined. Frontend Engineer should determine during build.

2. **Sparkline data management** — Frontend must accumulate price points locally. How many data points before pruning? What if user leaves browser open for 24 hours? Needs design decision.

3. **Heatmap interaction model** — Can users click a rectangle to select a ticker? Drag to reorder? Or is it view-only? Needs Frontend Engineer input.

4. **Error handling in chat** — If LLM generates a trade that fails (insufficient cash), should the error appear as an assistant message or a separate error banner? UX pattern TBD.

5. **Watchlist sorting/ordering** — Research doesn't specify optimal default order. Recommend: alphabetical by ticker for v1 (simple, predictable). Can add user sorting later.

---

## Sources

### Price Streaming & Watchlist UX
- [Complete guide to UX design for trading apps](https://medium.com/@markpascal4343/user-experience-design-for-trading-apps-a-comprehensive-guide-b29445203c71)
- [How To Use TradingView Watchlist (2026 Guide)](https://chartwisehub.com/tradingview-watchlist-tutorial/)
- [Best Trading Terminals for Day Traders & Pros in 2026](https://wundertrading.com/journal/en/reviews/article/best-trading-terminals)
- [The 10 best trading platform design examples in 2026](https://merge.rocks/blog/the-10-best-trading-platform-design-examples-in-2024)

### Portfolio Visualization (Treemap/Heatmap)
- [Heatmap Trading | Liquidity Heatmap | Stock Market Heatmap Trading](https://bookmap.com/blog/heatmap-in-trading-the-complete-guide-to-market-depth-visualization)
- [6 Heatmaps to Supercharge Your Trading in 2026](https://www.greatworklife.com/stock-heatmaps/)
- [Heat Map – Portfolio Charts](https://portfoliocharts.com/charts/heat-map/)
- [Building A Stock Market Treemap in 10 Steps](https://medium.com/@ulas_yilmaz/building-a-stock-market-treemap-in-10-steps-f5485148be66)

### Trading Simulator Features (Table Stakes)
- [10 Best Stock Trading Simulators to Test Market Moves in 2026](https://www.goatfundedtrader.com/blog/best-stock-trading-simulator)
- [Stock market simulator - Wikipedia](https://en.wikipedia.org/wiki/Stock_market_simulator)
- [The Stock Market Game](https://www.stockmarketgame.org/)
- [Simulated Stock Trading: 10 Best Platforms to Practice](https://www.goatfundedtrader.com/blog/simulated-stock-trading)

### Confirmation Dialogs & UX Anti-Patterns
- [Confirmation dialogs: How to design dialogs without irritation](https://uxplanet.org/confirmation-dialogs-how-to-design-dialogues-without-irritation-7b4cf2599956?gi=2ac51bcfc665)
- [How to design better destructive action modals - UX Psychology](https://uxpsychology.substack.com/p/how-to-design-better-destructive)
- [Confirmation Dialogs Can Prevent User Errors (If Not Overused) - NN/G](https://www.nngroup.com/articles/confirmation-dialog/)
- [Modal UX design: Patterns, examples, and best practices - LogRocket Blog](https://blog.logrocket.com/ux-design/modal-ux-design-patterns-examples-best-practices/)

### AI Chat UX in Trading
- [10 Best AI Trading Apps (March 2026)](https://koinly.io/blog/ai-trading-apps/)
- [Best AI Trading Apps for Beginners in 2026: 5 Easy Picks](https://rockflow.ai/blog/best-ai-trading-apps-2025)
- [Best AI for stock trading: 12 powerful tools for investors in 2026](https://monday.com/blog/ai-agents/best-ai-for-stock-trading/)
- [Leveraging AI tools for Trading Apps UX Design](https://blog.ionixxtech.com/use-of-ai-for-trading-apps-ux/)

### Price Flash & Color Conventions
- [XT PriceLine: Dynamic Colors That Let You See Every Tick](https://www.xabcdtrading.com/blog/xt-priceline-dynamic-colors-that-let-you-see-every-tick/)
- [Time & Sales - Colors for Bid/Ask/Mid & Quantity](https://www.elitetrader.com/et/threads/time-sales-colors-for-bid-ask-mid-quantity.346084/)
- [Mastering Trading Chart Colors: A Guide to Enhanced Visualizations](https://www.tradersdna.com/trading-chart-colors/)

### Connection Status & Reconnection
- [WebSocket Reconnection: State Sync and Recovery Guide](https://websocket.org/guides/reconnection/)
- [How to Handle WebSocket Reconnection Logic](https://oneuptime.com/blog/post/2026-01-24-websocket-reconnection-logic/view)
- [How to Use SSE vs WebSockets for Real-Time Communication](https://oneuptime.com/blog/post/2026-01-27-sse-vs-websockets/view)
- [Choose Between SSE and WebSockets](https://docs.railway.com/guides/sse-vs-websockets)

### Complexity & Scope Management
- [Optimizing Trading Strategies With TradeZero: Understanding Order Types](https://tradezero.com/blog/optimizing-trading-strategies-with-tradezero-understanding-order-types-and-applications/)
- [Stop Loss Order: How It Works, Pros and Cons, Examples](https://finance.yahoo.com/news/stop-loss-order-works-pros-215402645.html)
- [How to Overcome Analysis Paralysis Within Your Trading Strategy](https://futures.stonex.com/blog/how-to-overcome-analysis-paralysis-within-your-trading-strategy/)
- [Overcoming Analysis Paralysis in Stock Trading: Too Many Choices?](https://www.linkedin.com/pulse/overcoming-analysis-paralysis-stock-trading-too-many-5sehf)

---

*Research synthesized from 25+ sources across trading platforms, UX design patterns, and financial app benchmarks. Confidence levels reflect verification against multiple independent sources and industry precedent.*
