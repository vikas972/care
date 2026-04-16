import logging
import re
from contextlib import asynccontextmanager
from urllib.parse import urlparse

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, calendar, calls, health, medicine, users, webhooks_exotel, webhooks_twilio
from app.config import get_settings

logger = logging.getLogger(__name__)

# Google sends users to this exact URI after consent; bare http://localhost → port 80 (nothing listening).
_BARE_LOCALHOST_REDIRECT = re.compile(
    r"^https?://(localhost|127\.0\.0\.1)/?$", re.IGNORECASE
)


def _google_redirect_misconfig_message(uri: str) -> str | None:
    u = (uri or "").strip()
    if not u:
        return (
            "GOOGLE_REDIRECT_URI is empty. Set it to http://localhost:8000/auth/google/callback "
            "and add that exact URI under the Web application OAuth client in Google Cloud Console."
        )
    if _BARE_LOCALHOST_REDIRECT.match(u):
        return (
            f"GOOGLE_REDIRECT_URI={u!r} targets port 80 (bare localhost). "
            "Use http://localhost:8000/auth/google/callback, run the API on :8000, and use a "
            "Web application OAuth client (not the Desktop client used by calander.py). "
            "GET /auth/google/oauth-env shows the value this process actually loaded."
        )
    if "/auth/google/callback" not in u:
        return (
            f"GOOGLE_REDIRECT_URI={u!r} should contain /auth/google/callback so it hits this API."
        )
    p = urlparse(u)
    if (p.hostname or "").lower() in ("localhost", "127.0.0.1") and p.scheme == "http":
        if p.port in (None, 80) and u.rstrip("/").endswith("/auth/google/callback"):
            return (
                f"GOOGLE_REDIRECT_URI={u!r} uses default HTTP port 80. "
                "Use http://localhost:8000/auth/google/callback while the API listens on port 8000."
            )
    return None


@asynccontextmanager
async def lifespan(app: FastAPI):
    s = get_settings()
    msg = _google_redirect_misconfig_message(s.google_redirect_uri)
    if msg:
        logger.error("%s", msg)
    for name, url in (
        ("GOOGLE_REDIRECT_URI", s.google_redirect_uri),
        ("APP_BASE_URL", s.app_base_url),
        ("FRONTEND_OAUTH_REDIRECT_URL", s.frontend_oauth_redirect_url),
    ):
        if url and "localhost" in url.lower() and url.lower().startswith("https://"):
            logger.warning(
                "%s=%r uses https on localhost but the API serves plain HTTP (no TLS). "
                "Browsers show ERR_SSL_PROTOCOL_ERROR; use http:// instead.",
                name,
                url,
            )
    yield


_settings = get_settings()
_origins = [o.strip() for o in _settings.cors_origins.split(",") if o.strip()]

app = FastAPI(
    title="SmartCall Reminder",
    version="0.1.0",
    lifespan=lifespan,
    servers=[
        {"url": "http://localhost:8000", "description": "Local (use http:// — not https:// on localhost)"},
    ],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins or ["http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(calendar.router)
app.include_router(medicine.router)
app.include_router(calls.router)
app.include_router(webhooks_exotel.router)
app.include_router(webhooks_twilio.router)
