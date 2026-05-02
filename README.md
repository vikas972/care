# SmartCall Reminder

FastAPI backend, React demo UI, Celery reminders, and LiveKit voice agents.

## Repository layout

| Path | Purpose |
|------|---------|
| `app/` | Production FastAPI API (`uvicorn app.main:app`) |
| `alembic/` | Database migrations |
| `frontend/` | Vite + React dashboard (`npm run dev`) |
| `agents/livekit-worker/` | LiveKit agent Docker image used by Compose (`voice-agent` service) |
| `agents/livekit-agent-template/` | Separate LiveKit starter / experiments |
| `agents/playground/` | Optional local Whisper + Gemini experiments (`voice.py`, `ui.py`) |
| `scripts/` | One-off tooling (Postgres bootstrap, Vapi helpers, Calendar samples) |
| `scripts/vapi/` | `webhook_server.py`, `outbound_call.py` (not wired into main API) |
| `scripts/google_calendar/` | Google Calendar API scratch scripts |
| `docs/` | Setup guides (e.g. `calendar-setup.md`) |
| `tests/` | Pytest suite for the FastAPI app |

## Quick start

1. Copy `.env.example` → `.env` and fill values.
2. Database: `docker compose up -d postgres redis` (or local Postgres + `scripts/init_local_postgres.py`).
3. `alembic upgrade head`
4. API: `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
5. UI: `cd frontend && npm install && npm run dev`

Full stack with Compose: see `docker-compose.yml`.
