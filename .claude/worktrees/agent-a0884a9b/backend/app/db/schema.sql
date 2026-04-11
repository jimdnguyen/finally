-- SQLite schema for FinAlly database
-- All monetary values stored as TEXT for Decimal precision
-- Single-user (hardcoded user_id='default'), future-compatible with multi-user schema

CREATE TABLE IF NOT EXISTS users_profile (
    id TEXT PRIMARY KEY,
    cash_balance REAL NOT NULL DEFAULT 10000.0,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS watchlist (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    ticker TEXT NOT NULL,
    added_at TEXT NOT NULL,
    UNIQUE(user_id, ticker),
    FOREIGN KEY(user_id) REFERENCES users_profile(id)
);

CREATE TABLE IF NOT EXISTS positions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    ticker TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 0,
    avg_cost TEXT NOT NULL DEFAULT "0.00",
    updated_at TEXT NOT NULL,
    UNIQUE(user_id, ticker),
    FOREIGN KEY(user_id) REFERENCES users_profile(id)
);

CREATE TABLE IF NOT EXISTS trades (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    ticker TEXT NOT NULL,
    side TEXT NOT NULL CHECK(side IN ('buy', 'sell')),
    quantity REAL NOT NULL,
    price TEXT NOT NULL,
    executed_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users_profile(id)
);

CREATE TABLE IF NOT EXISTS portfolio_snapshots (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    total_value TEXT NOT NULL,
    recorded_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users_profile(id)
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    actions TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users_profile(id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_positions_user ON positions(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_user ON trades(user_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_user ON portfolio_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_user ON chat_messages(user_id);
