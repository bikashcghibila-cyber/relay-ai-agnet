#!/usr/bin/env python3
"""Small, dependency-free Relay API and local development server."""

from __future__ import annotations

import json
import os
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parent
DB_PATH = Path(os.environ.get("RELAY_DB_PATH", ROOT / "data" / "relay.sqlite3"))
HOST = os.environ.get("RELAY_HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", "8765"))
BUSINESS_ID = "harbor-plumbing"
STATUSES = {"Booked", "Needs follow-up", "Urgent", "New", "Resolved"}


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(value: datetime | None = None) -> str:
    return (value or now_utc()).isoformat(timespec="seconds")


def connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB_PATH, timeout=10)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")
    return db


@contextmanager
def database():
    db = connect()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def initialize() -> None:
    with database() as db:
        db.executescript("""
            CREATE TABLE IF NOT EXISTS businesses (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                trade TEXT NOT NULL DEFAULT 'Plumbing',
                timezone TEXT NOT NULL DEFAULT 'America/New_York',
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                business_id TEXT NOT NULL REFERENCES businesses(id),
                customer_name TEXT NOT NULL,
                phone TEXT NOT NULL DEFAULT '',
                address TEXT NOT NULL DEFAULT '',
                issue TEXT NOT NULL,
                category TEXT NOT NULL DEFAULT 'Service request',
                status TEXT NOT NULL DEFAULT 'New',
                source TEXT NOT NULL DEFAULT 'phone',
                estimated_value_cents INTEGER NOT NULL DEFAULT 0,
                duration_seconds INTEGER NOT NULL DEFAULT 0,
                response_seconds INTEGER NOT NULL DEFAULT 12,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
                sender TEXT NOT NULL CHECK(sender IN ('ai', 'customer', 'system')),
                body TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS bookings (
                id TEXT PRIMARY KEY,
                business_id TEXT NOT NULL REFERENCES businesses(id),
                conversation_id TEXT NOT NULL UNIQUE REFERENCES conversations(id),
                starts_at TEXT NOT NULL,
                ends_at TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'Confirmed',
                created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS conversations_business_created
                ON conversations(business_id, created_at DESC);
            CREATE INDEX IF NOT EXISTS messages_conversation_created
                ON messages(conversation_id, created_at);
        """)
        db.execute("INSERT OR IGNORE INTO businesses(id, name, trade, timezone, created_at) VALUES (?, ?, ?, ?, ?)",
                   (BUSINESS_ID, "Harbor Plumbing", "Plumbing", "America/New_York", iso()))
        if db.execute("SELECT COUNT(*) FROM conversations WHERE business_id = ?", (BUSINESS_ID,)).fetchone()[0] == 0:
            seed_conversations(db)


def seed_conversations(db: sqlite3.Connection) -> None:
    samples = [
        ("Maya Chen", "Kitchen sink leak", "Plumbing repair", "Booked", 42500, 10, "There’s water under my kitchen sink.", "Water is dripping from the drain connection.", "I found an opening today between 1 and 3 PM. I’ve sent your request to the team."),
        ("Daniel Brooks", "Water heater inspection", "Water heater", "Needs follow-up", 0, 8, "Can someone take a look at our water heater?", "It’s making a popping noise, but there’s no active leak.", "I’ve shared the details with our team. They’ll call you back shortly."),
        ("Alicia Torres", "Emergency pipe burst", "Emergency", "Urgent", 0, 7, "A pipe burst in the basement, help!", "Water is spreading near the laundry room.", "I’m alerting the on-call team now. If there is immediate danger, please move to a safe area."),
        ("Marcus Reed", "Bathroom faucet replacement", "Installation", "Booked", 68000, 13, "Looking to replace two bathroom faucets.", "I already have the new faucets.", "We have an opening tomorrow morning. I’ve sent the details to the team."),
    ]
    now = now_utc()
    for index, sample in enumerate(samples):
        name, issue, category, status, value, response, customer_1, customer_2, ai_reply = sample
        cid = str(uuid.uuid4())
        created = iso(now - timedelta(minutes=18 + index * 19))
        db.execute("""INSERT INTO conversations
            (id, business_id, customer_name, phone, address, issue, category, status, source,
             estimated_value_cents, duration_seconds, response_seconds, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'demo', ?, ?, ?, ?)""",
            (cid, BUSINESS_ID, name, "", "", issue, category, status, value, 90 + index * 28, response, created))
        messages = [("ai", "Thanks for calling Harbor Plumbing. How can I help today?"),
                    ("customer", customer_1), ("ai", "I can help with that. Is there any active leaking or immediate danger?"),
                    ("customer", customer_2), ("ai", ai_reply)]
        for msg_index, (sender, body) in enumerate(messages):
            db.execute("INSERT INTO messages(id, conversation_id, sender, body, created_at) VALUES (?, ?, ?, ?, ?)",
                       (str(uuid.uuid4()), cid, sender, body, iso(now - timedelta(minutes=15 + index * 19, seconds=(len(messages) - msg_index) * 20))))
        if status == "Booked":
            start = now + timedelta(hours=4 if index == 0 else 20)
            db.execute("INSERT INTO bookings(id, business_id, conversation_id, starts_at, ends_at, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                       (str(uuid.uuid4()), BUSINESS_ID, cid, iso(start), iso(start + timedelta(hours=2)), created))


def conversation_dict(row: sqlite3.Row) -> dict:
    item = dict(row)
    item["estimated_value"] = item.pop("estimated_value_cents") / 100
    return item


def dashboard_data(db: sqlite3.Connection) -> dict:
    rows = db.execute("SELECT * FROM conversations WHERE business_id = ? ORDER BY created_at DESC", (BUSINESS_ID,)).fetchall()
    current_week = now_utc().date() - timedelta(days=now_utc().weekday())
    daily = { (current_week + timedelta(days=i)).isoformat(): {"calls": 0, "booked": 0} for i in range(7) }
    for row in rows:
        created = datetime.fromisoformat(row["created_at"])
        key = created.date().isoformat()
        if key in daily:
            daily[key]["calls"] += 1
            if row["status"] == "Booked":
                daily[key]["booked"] += 1
    booked = [row for row in rows if row["status"] == "Booked"]
    avg_response = round(sum(row["response_seconds"] for row in rows) / len(rows)) if rows else 0
    return {
        "business": {"id": BUSINESS_ID, "name": "Harbor Plumbing", "trade": "Plumbing", "timezone": "America/New_York"},
        "metrics": {
            "calls_handled": len(rows),
            "jobs_booked": len(booked),
            "revenue_recovered": sum(row["estimated_value_cents"] for row in booked) / 100,
            "average_response_seconds": avg_response,
            "booking_rate_percent": round(100 * len(booked) / len(rows)) if rows else 0,
        },
        "activity": [{"date": key, **value} for key, value in daily.items()],
        "recent_conversations": [conversation_dict(row) for row in rows[:8]],
    }


class RelayHandler(BaseHTTPRequestHandler):
    server_version = "RelayLocal/1.0"

    def log_message(self, fmt: str, *args) -> None:
        print(f"{self.log_date_time_string()} {self.address_string()} {fmt % args}")

    def send_json(self, status: int, payload: dict | list) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        if length > 1_000_000:
            raise ValueError("Request body is too large")
        if not length:
            return {}
        value = json.loads(self.rfile.read(length))
        if not isinstance(value, dict):
            raise ValueError("JSON body must be an object")
        return value

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        try:
            with database() as db:
                if path == "/api/health":
                    self.send_json(200, {"ok": True, "service": "relay-api", "database": "sqlite"})
                elif path == "/api/dashboard":
                    self.send_json(200, dashboard_data(db))
                elif path == "/api/conversations":
                    rows = db.execute("SELECT * FROM conversations WHERE business_id = ? ORDER BY created_at DESC", (BUSINESS_ID,)).fetchall()
                    self.send_json(200, [conversation_dict(row) for row in rows])
                elif path.startswith("/api/conversations/"):
                    cid = path.rsplit("/", 1)[-1]
                    row = db.execute("SELECT * FROM conversations WHERE id = ? AND business_id = ?", (cid, BUSINESS_ID)).fetchone()
                    if not row:
                        self.send_json(404, {"error": "Conversation not found"})
                        return
                    messages = db.execute("SELECT sender, body, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at", (cid,)).fetchall()
                    booking = db.execute("SELECT starts_at, ends_at, status FROM bookings WHERE conversation_id = ?", (cid,)).fetchone()
                    item = conversation_dict(row)
                    item["messages"] = [dict(message) for message in messages]
                    item["booking"] = dict(booking) if booking else None
                    self.send_json(200, item)
                elif path == "/api/bookings":
                    rows = db.execute("""SELECT b.*, c.customer_name, c.issue FROM bookings b
                        JOIN conversations c ON c.id = b.conversation_id
                        WHERE b.business_id = ? ORDER BY b.starts_at""", (BUSINESS_ID,)).fetchall()
                    self.send_json(200, [dict(row) for row in rows])
                else:
                    self.serve_static(path)
        except (sqlite3.Error, OSError) as exc:
            self.send_json(500, {"error": "Database request failed", "detail": str(exc)})

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        try:
            body = self.read_json()
            if path == "/api/demo/calls":
                self.create_demo_call()
            elif path.startswith("/api/conversations/") and path.endswith("/status"):
                self.update_status(path.split("/")[-2], body)
            elif path == "/api/bookings":
                self.create_booking(body)
            else:
                self.send_json(404, {"error": "Route not found"})
        except (ValueError, json.JSONDecodeError) as exc:
            self.send_json(400, {"error": str(exc)})
        except sqlite3.Error as exc:
            self.send_json(500, {"error": "Database request failed", "detail": str(exc)})

    def create_demo_call(self) -> None:
        cid = str(uuid.uuid4())
        created = iso()
        messages = [
            ("ai", "Thanks for calling Harbor Plumbing. How can I help today?"),
            ("customer", "A pipe burst in the basement and water is spreading."),
            ("ai", "I’m sorry—that sounds urgent. I’m alerting the on-call team now. Please move away from any electrical equipment near the water."),
        ]
        with database() as db:
            db.execute("""INSERT INTO conversations
                (id, business_id, customer_name, issue, category, status, source, duration_seconds, response_seconds, created_at)
                VALUES (?, ?, ?, ?, ?, ?, 'demo', ?, ?, ?)""",
                (cid, BUSINESS_ID, "Demo caller", "Emergency pipe burst", "Emergency", "Urgent", 74, 8, created))
            for sender, body in messages:
                db.execute("INSERT INTO messages(id, conversation_id, sender, body, created_at) VALUES (?, ?, ?, ?, ?)",
                           (str(uuid.uuid4()), cid, sender, body, created))
            row = db.execute("SELECT * FROM conversations WHERE id = ?", (cid,)).fetchone()
        self.send_json(201, {**conversation_dict(row), "messages": [{"sender": s, "body": b, "created_at": created} for s, b in messages]})

    def update_status(self, cid: str, body: dict) -> None:
        status = body.get("status")
        if status not in STATUSES:
            self.send_json(400, {"error": f"status must be one of: {', '.join(sorted(STATUSES))}"})
            return
        with database() as db:
            cursor = db.execute("UPDATE conversations SET status = ? WHERE id = ? AND business_id = ?", (status, cid, BUSINESS_ID))
            if not cursor.rowcount:
                self.send_json(404, {"error": "Conversation not found"})
                return
            row = db.execute("SELECT * FROM conversations WHERE id = ?", (cid,)).fetchone()
        self.send_json(200, conversation_dict(row))

    def create_booking(self, body: dict) -> None:
        cid = str(body.get("conversation_id", ""))
        start_text = body.get("starts_at")
        if not cid or not start_text:
            self.send_json(400, {"error": "conversation_id and starts_at are required"})
            return
        try:
            start = datetime.fromisoformat(start_text.replace("Z", "+00:00"))
        except (TypeError, ValueError):
            self.send_json(400, {"error": "starts_at must be an ISO 8601 date/time"})
            return
        if start.tzinfo is None:
            self.send_json(400, {"error": "starts_at must include a timezone"})
            return
        end = start + timedelta(hours=2)
        with database() as db:
            conv = db.execute("SELECT id FROM conversations WHERE id = ? AND business_id = ?", (cid, BUSINESS_ID)).fetchone()
            if not conv:
                self.send_json(404, {"error": "Conversation not found"})
                return
            try:
                booking_id = str(uuid.uuid4())
                db.execute("INSERT INTO bookings(id, business_id, conversation_id, starts_at, ends_at, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                           (booking_id, BUSINESS_ID, cid, iso(start), iso(end), iso()))
                db.execute("UPDATE conversations SET status = 'Booked' WHERE id = ?", (cid,))
            except sqlite3.IntegrityError:
                self.send_json(409, {"error": "This conversation already has a booking"})
                return
        self.send_json(201, {"id": booking_id, "conversation_id": cid, "starts_at": iso(start), "ends_at": iso(end), "status": "Confirmed"})

    def serve_static(self, path: str) -> None:
        relative = "index.html" if path in ("", "/") else path.lstrip("/")
        target = (ROOT / relative).resolve()
        if ROOT not in target.parents or not target.is_file():
            self.send_json(404, {"error": "Not found"})
            return
        content_type = {".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "application/javascript; charset=utf-8"}.get(target.suffix, "application/octet-stream")
        payload = target.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(payload)


def main() -> None:
    initialize()
    server = ThreadingHTTPServer((HOST, PORT), RelayHandler)
    print(f"Relay MVP running at http://{HOST}:{PORT}")
    print(f"SQLite database: {DB_PATH}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping Relay MVP")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
