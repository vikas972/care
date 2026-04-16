from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.services.exotel import probe_exotel_credentials
from app.services.twilio_call import probe_twilio_credentials

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/health/exotel")
def health_exotel():
    """
    Check Exotel configuration and whether API credentials work (no call is placed).
    """
    s = get_settings()
    probe = probe_exotel_credentials()
    hints: list[str] = []
    if probe.get("dry_run"):
        hints.append("EXOTEL_DRY_RUN is true — real calls are not sent to Exotel.")
    if not probe.get("config_complete_for_calls"):
        hints.append(
            "For outbound calls you need API key/token/account SID, subdomain, EXOTEL_CALLER_ID, and EXOTEL_FLOW_URL."
        )
    base = (s.app_base_url or "").lower()
    if "localhost" in base or "127.0.0.1" in base:
        hints.append(
            "APP_BASE_URL points to localhost — Exotel cannot reach your StatusCallback webhooks from the internet. "
            "Use a public URL (ngrok, etc.) for production-style call status updates."
        )
    hints.append(
        "Scheduled calendar/medicine calls require Celery worker + beat running (see docker-compose)."
    )
    return {"probe": probe, "hints": hints}


@router.get("/health/twilio")
def health_twilio():
    """Check Twilio env vars and REST credential probe (no call placed)."""
    s = get_settings()
    probe = probe_twilio_credentials()
    hints: list[str] = []
    if probe.get("dry_run"):
        hints.append("TWILIO_DRY_RUN is true — outbound calls return a fake SID.")
    if not probe.get("config_complete"):
        hints.append("Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER (E.164).")
    base = (s.app_base_url or "").lower()
    if "localhost" in base or "127.0.0.1" in base:
        hints.append(
            "Twilio must fetch TwiML from a public URL. Set TWILIO_WEBHOOK_PUBLIC_URL to your HTTPS tunnel (ngrok) "
            "if APP_BASE_URL is localhost, and disable signature checks only for local dev if needed."
        )
    return {"probe": probe, "hints": hints}


@router.get("/ready")
def ready(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ready"}
