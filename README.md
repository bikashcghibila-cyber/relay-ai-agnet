# Relay

Relay is a call and lead workflow prototype for home-service businesses. This repository now includes a local web app and a small persistent HTTP API backed by SQLite.

## Run locally

Requires Python 3.10 or later. No third-party Python packages are needed.

```bash
python3 server.py
```

Open [http://127.0.0.1:8765](http://127.0.0.1:8765). Stop the server with `Ctrl+C`. The app creates `data/relay.sqlite3` and seeds four sample conversations the first time it starts. The `data/` directory is ignored by Git.

To use another database path or port:

```bash
RELAY_DB_PATH=/path/to/relay.sqlite3 PORT=9000 python3 server.py
```

## What works in this MVP

- Persistent SQLite records for a demo business, conversations, messages, and bookings.
- Dashboard totals, estimated booked-job value, response time, and a weekly activity chart read from the database.
- A simulated receptionist call that writes a new urgent lead and its transcript to the database.
- Conversation detail view with saved status changes.
- JSON API served from the same origin as the UI.

## API

- `GET /api/health` — service and database status.
- `GET /api/dashboard` — business, metrics, weekly calls, and recent conversations.
- `GET /api/conversations` — conversations for the demo business.
- `GET /api/conversations/{id}` — conversation plus messages and optional booking.
- `POST /api/demo/calls` — create a sample urgent call and transcript.
- `POST /api/conversations/{id}/status` — update status (`Booked`, `Needs follow-up`, `Urgent`, `New`, or `Resolved`).
- `GET /api/bookings` — list confirmed demo bookings.
- `POST /api/bookings` — create a two-hour booking with `conversation_id` and timezone-aware ISO-8601 `starts_at`.

Example:

```bash
curl http://127.0.0.1:8765/api/dashboard
curl -X POST http://127.0.0.1:8765/api/demo/calls
```

## Scope and next integrations

This is a local single-business MVP. It does **not** answer real phone calls, run a real AI voice model, send SMS, connect to a calendar, authenticate users, or charge subscriptions. The demo call is synthetic. Before deploying for real businesses, add sign-in and tenant-level authorization, production database and migrations, HTTPS, backups, rate limits, privacy/consent and retention controls, plus provider integrations (telephony, voice AI, SMS, and calendars). Never expose this local server directly to the public internet.

The initial target customer is an independent plumbing or HVAC company with 3–30 technicians. Validate the idea with paid pilots before locking in the pricing hypothesis.
