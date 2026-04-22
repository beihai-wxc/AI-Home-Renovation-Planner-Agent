import json
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional


DB_PATH = Path(".adk") / "planner.db"
_LOCK = threading.Lock()
PLACEHOLDER_TITLES = {"", "新对话"}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_connection() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with _LOCK:
        conn = get_connection()
        try:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS sessions (
                    session_id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    title TEXT,
                    pinned INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    image_filename TEXT,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY(session_id) REFERENCES sessions(session_id)
                );

                CREATE TABLE IF NOT EXISTS assets (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    filename TEXT NOT NULL,
                    asset_type TEXT NOT NULL,
                    version INTEGER,
                    metadata_json TEXT,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY(session_id) REFERENCES sessions(session_id)
                );

                CREATE TABLE IF NOT EXISTS render_jobs (
                    job_id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    status TEXT NOT NULL,
                    request_message TEXT,
                    result_filename TEXT,
                    error_message TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY(session_id) REFERENCES sessions(session_id)
                );

                CREATE TABLE IF NOT EXISTS message_assets (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    message_id INTEGER NOT NULL,
                    session_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    filename TEXT NOT NULL,
                    asset_type TEXT NOT NULL,
                    label TEXT,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY(message_id) REFERENCES messages(id)
                );

                CREATE INDEX IF NOT EXISTS idx_messages_session_created
                ON messages(session_id, created_at);

                CREATE INDEX IF NOT EXISTS idx_assets_session_type_created
                ON assets(session_id, asset_type, created_at);

                CREATE INDEX IF NOT EXISTS idx_render_jobs_session_created
                ON render_jobs(session_id, created_at);

                CREATE INDEX IF NOT EXISTS idx_message_assets_message
                ON message_assets(message_id, created_at);

                CREATE TABLE IF NOT EXISTS three_d_jobs (
                    job_id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    status TEXT NOT NULL,
                    source_image TEXT,
                    external_task_id TEXT,
                    result_filename TEXT,
                    error_message TEXT,
                    progress INTEGER DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY(session_id) REFERENCES sessions(session_id)
                );

                CREATE INDEX IF NOT EXISTS idx_three_d_jobs_session
                ON three_d_jobs(session_id, created_at);
                """
            )
            columns = conn.execute("PRAGMA table_info(sessions)").fetchall()
            column_names = {row["name"] for row in columns}
            if "pinned" not in column_names:
                conn.execute("ALTER TABLE sessions ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0")
            conn.commit()
        finally:
            conn.close()


def ensure_session(session_id: str, user_id: str, title: Optional[str] = None) -> None:
    now = utc_now()
    with _LOCK:
        conn = get_connection()
        try:
            existing = conn.execute(
                "SELECT session_id, title FROM sessions WHERE session_id = ?",
                (session_id,),
            ).fetchone()
            if existing:
                existing_title = (existing["title"] or "").strip()
                candidate_title = (title or "").strip()
                next_title = existing_title
                if not existing_title or existing_title in PLACEHOLDER_TITLES:
                    next_title = candidate_title or existing_title or "新对话"
                conn.execute(
                    """
                    UPDATE sessions
                    SET user_id = ?, title = ?, updated_at = ?
                    WHERE session_id = ?
                    """,
                    (user_id, next_title, now, session_id),
                )
            else:
                conn.execute(
                    """
                    INSERT INTO sessions (session_id, user_id, title, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (session_id, user_id, title, now, now),
                )
            conn.commit()
        finally:
            conn.close()


def touch_session(session_id: str) -> None:
    with _LOCK:
        conn = get_connection()
        try:
            conn.execute(
                "UPDATE sessions SET updated_at = ? WHERE session_id = ?",
                (utc_now(), session_id),
            )
            conn.commit()
        finally:
            conn.close()


def save_message(
    session_id: str,
    user_id: str,
    role: str,
    content: str,
    image_filename: Optional[str] = None,
) -> int:
    ensure_session(session_id=session_id, user_id=user_id, title=content[:80] or "新对话")
    with _LOCK:
        conn = get_connection()
        try:
            cursor = conn.execute(
                """
                INSERT INTO messages (session_id, user_id, role, content, image_filename, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (session_id, user_id, role, content, image_filename, utc_now()),
            )
            conn.execute(
                "UPDATE sessions SET updated_at = ? WHERE session_id = ?",
                (utc_now(), session_id),
            )
            conn.commit()
            return int(cursor.lastrowid)
        finally:
            conn.close()


def save_asset(
    session_id: str,
    user_id: str,
    filename: str,
    asset_type: str,
    version: Optional[int] = None,
    metadata: Optional[dict[str, Any]] = None,
) -> None:
    ensure_session(session_id=session_id, user_id=user_id)
    payload = json.dumps(metadata or {}, ensure_ascii=False)
    with _LOCK:
        conn = get_connection()
        try:
            conn.execute(
                """
                INSERT INTO assets (session_id, user_id, filename, asset_type, version, metadata_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (session_id, user_id, filename, asset_type, version, payload, utc_now()),
            )
            conn.execute(
                "UPDATE sessions SET updated_at = ? WHERE session_id = ?",
                (utc_now(), session_id),
            )
            conn.commit()
        finally:
            conn.close()


def save_message_assets(
    *,
    message_id: int,
    session_id: str,
    user_id: str,
    attachments: list[dict[str, Any]],
) -> None:
    if not attachments:
        return

    with _LOCK:
        conn = get_connection()
        try:
            rows: list[tuple[Any, ...]] = []
            for item in attachments:
                filename = (item.get("filename") or "").strip()
                if not filename:
                    continue
                asset_type = (item.get("asset_type") or "general").strip() or "general"
                label = (item.get("label") or "").strip() or None
                rows.append((message_id, session_id, user_id, filename, asset_type, label, utc_now()))

            if rows:
                conn.executemany(
                    """
                    INSERT INTO message_assets (message_id, session_id, user_id, filename, asset_type, label, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    rows,
                )
                conn.commit()
        finally:
            conn.close()


def list_sessions(user_id: str) -> list[dict[str, Any]]:
    with _LOCK:
        conn = get_connection()
        try:
            rows = conn.execute(
                """
                SELECT s.session_id, s.title, s.pinned, s.created_at, s.updated_at,
                       (
                           SELECT m.content
                           FROM messages m
                           WHERE m.session_id = s.session_id AND m.role = 'user'
                           ORDER BY m.created_at ASC, m.id ASC
                           LIMIT 1
                       ) AS first_user_message,
                       (
                           SELECT m.content
                           FROM messages m
                           WHERE m.session_id = s.session_id AND m.role = 'user'
                           ORDER BY m.created_at DESC, m.id DESC
                           LIMIT 1
                       ) AS latest_user_message,
                       (
                           SELECT m.content
                           FROM messages m
                           WHERE m.session_id = s.session_id
                           ORDER BY m.created_at DESC, m.id DESC
                           LIMIT 1
                       ) AS latest_message
                FROM sessions s
                WHERE s.user_id = ?
                ORDER BY s.pinned DESC, s.updated_at DESC
                """,
                (user_id,),
            ).fetchall()
            return [dict(row) for row in rows]
        finally:
            conn.close()


def set_session_pinned(session_id: str, user_id: str, pinned: bool) -> bool:
    with _LOCK:
        conn = get_connection()
        try:
            cursor = conn.execute(
                """
                UPDATE sessions
                SET pinned = ?, updated_at = ?
                WHERE session_id = ? AND user_id = ?
                """,
                (1 if pinned else 0, utc_now(), session_id, user_id),
            )
            conn.commit()
            return cursor.rowcount > 0
        finally:
            conn.close()


def delete_session(session_id: str, user_id: str) -> bool:
    with _LOCK:
        conn = get_connection()
        try:
            exists = conn.execute(
                "SELECT 1 FROM sessions WHERE session_id = ? AND user_id = ?",
                (session_id, user_id),
            ).fetchone()
            if exists:
                conn.execute(
                    "DELETE FROM messages WHERE session_id = ? AND user_id = ?",
                    (session_id, user_id),
                )
                conn.execute(
                    "DELETE FROM assets WHERE session_id = ? AND user_id = ?",
                    (session_id, user_id),
                )
                conn.execute(
                    "DELETE FROM render_jobs WHERE session_id = ? AND user_id = ?",
                    (session_id, user_id),
                )
                conn.execute(
                    "DELETE FROM sessions WHERE session_id = ? AND user_id = ?",
                    (session_id, user_id),
                )
            else:
                # Fallback for legacy/migrated rows with mismatched user_id.
                conn.execute("DELETE FROM messages WHERE session_id = ?", (session_id,))
                conn.execute("DELETE FROM assets WHERE session_id = ?", (session_id,))
                conn.execute("DELETE FROM render_jobs WHERE session_id = ?", (session_id,))
                conn.execute("DELETE FROM sessions WHERE session_id = ?", (session_id,))
            conn.commit()
            return True
        finally:
            conn.close()


def create_render_job(
    *,
    job_id: str,
    session_id: str,
    user_id: str,
    request_message: str,
    status: str = "pending",
) -> None:
    ensure_session(session_id=session_id, user_id=user_id)
    now = utc_now()
    with _LOCK:
        conn = get_connection()
        try:
            conn.execute(
                """
                INSERT INTO render_jobs (
                    job_id, session_id, user_id, status, request_message,
                    result_filename, error_message, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?)
                """,
                (job_id, session_id, user_id, status, request_message, now, now),
            )
            conn.commit()
        finally:
            conn.close()


def update_render_job(
    job_id: str,
    *,
    status: str,
    result_filename: Optional[str] = None,
    error_message: Optional[str] = None,
) -> None:
    with _LOCK:
        conn = get_connection()
        try:
            conn.execute(
                """
                UPDATE render_jobs
                SET status = ?, result_filename = ?, error_message = ?, updated_at = ?
                WHERE job_id = ?
                """,
                (status, result_filename, error_message, utc_now(), job_id),
            )
            conn.commit()
        finally:
            conn.close()


def get_render_job(job_id: str, user_id: str) -> Optional[dict[str, Any]]:
    with _LOCK:
        conn = get_connection()
        try:
            row = conn.execute(
                """
                SELECT job_id, session_id, user_id, status, request_message,
                       result_filename, error_message, created_at, updated_at
                FROM render_jobs
                WHERE job_id = ? AND user_id = ?
                """,
                (job_id, user_id),
            ).fetchone()
            return dict(row) if row else None
        finally:
            conn.close()


def get_messages(session_id: str, user_id: str) -> list[dict[str, Any]]:
    with _LOCK:
        conn = get_connection()
        try:
            rows = conn.execute(
                """
                SELECT id, role, content, image_filename, created_at
                FROM messages
                WHERE session_id = ? AND user_id = ?
                ORDER BY created_at ASC, id ASC
                """,
                (session_id, user_id),
            ).fetchall()
            messages = [dict(row) for row in rows]
            if not messages:
                return messages

            message_ids = [int(item["id"]) for item in messages]
            placeholders = ",".join(["?"] * len(message_ids))
            asset_rows = conn.execute(
                f"""
                SELECT message_id, filename, asset_type, label
                FROM message_assets
                WHERE session_id = ? AND user_id = ? AND message_id IN ({placeholders})
                ORDER BY id ASC
                """,
                (session_id, user_id, *message_ids),
            ).fetchall()

            assets_by_message: dict[int, list[dict[str, Any]]] = {}
            for row in asset_rows:
                message_id = int(row["message_id"])
                assets_by_message.setdefault(message_id, []).append(
                    {
                        "filename": row["filename"],
                        "asset_type": row["asset_type"],
                        "label": row["label"],
                    }
                )

            for message in messages:
                message["attachments"] = assets_by_message.get(int(message["id"]), [])

            return messages
        finally:
            conn.close()


def latest_asset(session_id: str, user_id: str, asset_type: str) -> Optional[dict[str, Any]]:
    with _LOCK:
        conn = get_connection()
        try:
            row = conn.execute(
                """
                SELECT filename, asset_type, version, metadata_json, created_at
                FROM assets
                WHERE session_id = ? AND user_id = ? AND asset_type = ?
                ORDER BY created_at DESC, id DESC
                LIMIT 1
                """,
                (session_id, user_id, asset_type),
            ).fetchone()
            if not row:
                return None
            result = dict(row)
            result["metadata"] = json.loads(result.pop("metadata_json") or "{}")
            return result
        finally:
            conn.close()


def session_state_snapshot(session_id: str, user_id: str) -> dict[str, Any]:
    current_room = latest_asset(session_id, user_id, "current_room")
    inspiration = latest_asset(session_id, user_id, "inspiration")
    generated = latest_asset(session_id, user_id, "generated_render")
    edited = latest_asset(session_id, user_id, "edited_render")
    latest_render = edited or generated

    reference_images: dict[str, dict[str, Any]] = {}
    for asset in (current_room, inspiration):
        if asset:
            reference_images[asset["filename"]] = {
                "type": asset["asset_type"],
                "version": asset.get("version"),
            }

    state: dict[str, Any] = {"reference_images": reference_images}
    if current_room:
        state["latest_current_room_image"] = current_room["filename"]
    if inspiration:
        state["latest_inspiration_image"] = inspiration["filename"]
        state["latest_reference_image"] = inspiration["filename"]
    if latest_render:
        state["last_generated_rendering"] = latest_render["filename"]
        metadata = latest_render.get("metadata") or {}
        if metadata.get("asset_name"):
            state["current_asset_name"] = metadata["asset_name"]
    return state


def create_3d_job(
    *,
    job_id: str,
    session_id: str,
    user_id: str,
    source_image: str,
    external_task_id: str = "",
    status: str = "pending",
) -> None:
    ensure_session(session_id=session_id, user_id=user_id)
    now = utc_now()
    with _LOCK:
        conn = get_connection()
        try:
            conn.execute(
                """
                INSERT INTO three_d_jobs (
                    job_id, session_id, user_id, status, source_image,
                    external_task_id, result_filename, error_message,
                    progress, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 0, ?, ?)
                """,
                (job_id, session_id, user_id, status, source_image,
                 external_task_id, now, now),
            )
            conn.commit()
        finally:
            conn.close()


def update_3d_job(
    job_id: str,
    *,
    status: str,
    progress: int = 0,
    result_filename: Optional[str] = None,
    external_task_id: Optional[str] = None,
    error_message: Optional[str] = None,
) -> None:
    with _LOCK:
        conn = get_connection()
        try:
            if external_task_id is not None:
                conn.execute(
                    """
                    UPDATE three_d_jobs
                    SET status = ?, progress = ?, result_filename = ?,
                        external_task_id = ?, error_message = ?, updated_at = ?
                    WHERE job_id = ?
                    """,
                    (status, progress, result_filename,
                     external_task_id, error_message, utc_now(), job_id),
                )
            else:
                conn.execute(
                    """
                    UPDATE three_d_jobs
                    SET status = ?, progress = ?, result_filename = ?,
                        error_message = ?, updated_at = ?
                    WHERE job_id = ?
                    """,
                    (status, progress, result_filename,
                     error_message, utc_now(), job_id),
                )
            conn.commit()
        finally:
            conn.close()


def get_3d_job(job_id: str, user_id: str) -> Optional[dict[str, Any]]:
    with _LOCK:
        conn = get_connection()
        try:
            row = conn.execute(
                """
                SELECT job_id, session_id, user_id, status, source_image,
                       external_task_id, result_filename, error_message,
                       progress, created_at, updated_at
                FROM three_d_jobs
                WHERE job_id = ? AND user_id = ?
                """,
                (job_id, user_id),
            ).fetchone()
            return dict(row) if row else None
        finally:
            conn.close()


def get_latest_3d_job_for_session(
    session_id: str, user_id: str
) -> Optional[dict[str, Any]]:
    with _LOCK:
        conn = get_connection()
        try:
            row = conn.execute(
                """
                SELECT job_id, session_id, user_id, status, source_image,
                       external_task_id, result_filename, error_message,
                       progress, created_at, updated_at
                FROM three_d_jobs
                WHERE session_id = ? AND user_id = ?
                ORDER BY created_at DESC, job_id DESC
                LIMIT 1
                """,
                (session_id, user_id),
            ).fetchone()
            return dict(row) if row else None
        finally:
            conn.close()
