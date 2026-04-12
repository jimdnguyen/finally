# Deferred Work

## Deferred from: code review of 1-1-backend-foundation-watchlist-api (2026-04-11)

- Race condition in `init_db()` seeding — two concurrent COUNT=0 checks could race; guarded by UNIQUE constraints + INSERT OR IGNORE; theoretical only in single-process app
- Missing `row_factory` in `init_db()` direct connection — init_db() never reads rows by column name; no functional impact
- No transaction isolation in watchlist handlers — single-user SQLite design; each handler opens its own connection
- Unhandled `SQLITE_BUSY` during init — single-user local SQLite; no realistic lock contention at startup
- Test monkeypatch DB_PATH fragility — DB_PATH patched in 3 modules; 86/86 tests passing; fragility concern if modules are added

## Deferred from: code review of 1-2-frontend-shell-design-system (2026-04-11)

- No `display: 'swap'` on font loaders — FOIT improvement, not breaking; fonts confirmed working
- No minimum viewport width enforced — desktop-first per spec; responsiveness out of scope for this story
- Turbopack active despite `--no-turbopack` init flag — non-functional deviation; build produces correct static output
