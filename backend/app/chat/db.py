"""Async database operations for chat messages."""

import json
import uuid
from datetime import datetime, timezone

import aiosqlite


async def load_history(conn: aiosqlite.Connection, limit: int = 20) -> list[dict]:
    """Return the last `limit` messages, oldest first."""
    cursor = await conn.execute(
        """SELECT role, content FROM chat_messages
           WHERE user_id = 'default'
           ORDER BY created_at DESC
           LIMIT ?""",
        (limit,),
    )
    rows = await cursor.fetchall()
    return [{"role": r[0], "content": r[1]} for r in reversed(rows)]


async def save_message(
    conn: aiosqlite.Connection,
    role: str,
    content: str,
    actions: dict | None = None,
) -> None:
    """Persist a user or assistant chat message."""
    now = datetime.now(timezone.utc).isoformat()
    await conn.execute(
        "INSERT INTO chat_messages (id, user_id, role, content, actions, created_at)"
        " VALUES (?, 'default', ?, ?, ?, ?)",
        (str(uuid.uuid4()), role, content, json.dumps(actions) if actions else None, now),
    )
    await conn.commit()
