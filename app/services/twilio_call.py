import re
from typing import Any, TypedDict
from urllib.parse import urlencode

import httpx
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException

from app.config import get_settings


def twilio_public_base_url() -> str:
    """HTTPS origin Twilio uses to request TwiML and webhooks (ngrok); falls back to APP_BASE_URL."""
    s = get_settings()
    return (s.twilio_webhook_public_url or s.app_base_url).rstrip("/")


class TwilioProbeResult(TypedDict, total=False):
    dry_run: bool
    skipped_probe: str
    has_account_sid: bool
    has_auth_token: bool
    has_from_number: bool
    config_complete: bool
    reachable: bool
    http_status: int | None
    credentials_ok: bool | None
    error: str | None


def normalize_e164_twilio(e164_or_local: str) -> str:
    """Digits only with leading + (Twilio To/From)."""
    s = e164_or_local.strip()
    digits = re.sub(r"\D", "", s)
    if not digits:
        return "+"
    return f"+{digits}"


def probe_twilio_credentials() -> TwilioProbeResult:
    s = get_settings()
    out: TwilioProbeResult = {
        "dry_run": s.twilio_dry_run,
        "has_account_sid": bool(s.twilio_account_sid),
        "has_auth_token": bool(s.twilio_auth_token),
        "has_from_number": bool(s.twilio_from_number),
    }
    ok = bool(s.twilio_account_sid and s.twilio_auth_token)
    out["config_complete"] = ok and bool(s.twilio_from_number)

    if s.twilio_dry_run:
        out["skipped_probe"] = "dry_run"
        out["credentials_ok"] = None
        return out
    if not ok:
        out["skipped_probe"] = "missing_credentials"
        out["credentials_ok"] = None
        return out

    url = f"https://api.twilio.com/2010-04-01/Accounts/{s.twilio_account_sid}.json"
    try:
        with httpx.Client(timeout=20.0) as client:
            r = client.get(
                url,
                auth=(s.twilio_account_sid, s.twilio_auth_token),
            )
    except httpx.RequestError as e:
        out["reachable"] = False
        out["http_status"] = None
        out["credentials_ok"] = False
        out["error"] = str(e)[:500]
        return out

    out["reachable"] = True
    out["http_status"] = r.status_code
    out["credentials_ok"] = r.status_code == 200
    if r.status_code != 200:
        out["error"] = (r.text or "")[:400].replace("\n", " ")
    return out


def twilio_voice_url(*, call_log_id: int) -> str:
    base = twilio_public_base_url()
    q = urlencode({"call_log_id": str(call_log_id)})
    return f"{base}/webhooks/twilio/voice?{q}"


def twilio_gather_action_url(*, call_log_id: int) -> str:
    base = twilio_public_base_url()
    q = urlencode({"call_log_id": str(call_log_id)})
    return f"{base}/webhooks/twilio/gather?{q}"


def twilio_status_callback_url() -> str:
    return f"{twilio_public_base_url()}/webhooks/twilio/status"


def initiate_twilio_call(
    *,
    customer_number: str,
    custom_field: dict[str, Any],
) -> tuple[str | None, str | None]:
    s = get_settings()
    if s.twilio_dry_run or not (s.twilio_account_sid and s.twilio_auth_token and s.twilio_from_number):
        return f"twilio-dry-{custom_field.get('call_log_id', 0)}", None

    log_id = custom_field.get("call_log_id")
    if not log_id:
        return None, "missing call_log_id in custom_field"

    voice_url = twilio_voice_url(call_log_id=int(log_id))
    to_num = normalize_e164_twilio(customer_number)
    from_num = normalize_e164_twilio(s.twilio_from_number)
    status_cb = twilio_status_callback_url()

    try:
        client = Client(s.twilio_account_sid, s.twilio_auth_token)
        call = client.calls.create(
            to=to_num,
            from_=from_num,
            url=voice_url,
            method="GET",
            status_callback=status_cb,
            status_callback_method="POST",
            status_callback_event=["initiated", "ringing", "answered", "completed"],
        )
    except TwilioRestException as e:
        # Keep this short; it'll be stored in CallLog.raw_payload for UI debugging.
        msg = f"{getattr(e, 'status', '')} {getattr(e, 'code', '')} {getattr(e, 'msg', '')}".strip()
        if not msg:
            msg = str(e)
        return None, msg[:2000]
    except Exception as e:
        return None, str(e)[:2000]

    return (call.sid if call else None), None
