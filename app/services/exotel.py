import base64
import json
import re
from typing import Any, TypedDict
from urllib.parse import quote

import httpx

from app.config import get_settings


class ExotelProbeResult(TypedDict, total=False):
    dry_run: bool
    skipped_probe: str
    has_api_key: bool
    has_api_token: bool
    has_account_sid: bool
    has_subdomain: bool
    has_caller_id: bool
    has_flow_url: bool
    config_complete_for_api: bool
    config_complete_for_calls: bool
    reachable: bool
    http_status: int | None
    credentials_ok: bool | None
    error: str | None


def probe_exotel_credentials() -> ExotelProbeResult:
    """
    GET Exotel account metadata — validates API key/token/SID/host without placing a call.
    """
    s = get_settings()
    out: ExotelProbeResult = {
        "dry_run": s.exotel_dry_run,
        "has_api_key": bool(s.exotel_api_key),
        "has_api_token": bool(s.exotel_api_token),
        "has_account_sid": bool(s.exotel_account_sid),
        "has_subdomain": bool(s.exotel_subdomain),
        "has_caller_id": bool(s.exotel_caller_id),
        "has_flow_url": bool(s.exotel_flow_url),
    }
    api_ok = bool(
        s.exotel_api_key and s.exotel_api_token and s.exotel_account_sid and s.exotel_subdomain
    )
    out["config_complete_for_api"] = api_ok
    out["config_complete_for_calls"] = api_ok and bool(s.exotel_caller_id) and bool(s.exotel_flow_url)

    if s.exotel_dry_run:
        out["skipped_probe"] = "dry_run"
        out["credentials_ok"] = None
        return out
    if not api_ok:
        out["skipped_probe"] = "missing_api_credentials"
        out["credentials_ok"] = None
        return out

    base = f"https://{s.exotel_subdomain}/v1/Accounts/{s.exotel_account_sid}"
    try:
        with httpx.Client(timeout=20.0) as client:
            r = client.get(base, auth=(s.exotel_api_key, s.exotel_api_token))
            if r.status_code == 404:
                r = client.get(f"{base}.json", auth=(s.exotel_api_key, s.exotel_api_token))
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
        snippet = (r.text or "").replace("\n", " ")[:400]
        out["error"] = snippet or f"HTTP {r.status_code}"
    return out


def format_exotel_from_number(e164_or_local: str) -> str:
    """Exotel India mobile: prefix 10 digits with 0."""
    digits = re.sub(r"\D", "", e164_or_local)
    if digits.startswith("91") and len(digits) == 12:
        digits = "0" + digits[2:]
    elif len(digits) == 10 and not digits.startswith("0"):
        digits = "0" + digits
    return digits


def initiate_connect_call(
    *,
    customer_number: str,
    custom_field: dict[str, Any],
) -> tuple[str | None, str | None]:
    """
    POST Exotel Calls/connect. Returns (call_sid, error_message).
    """
    s = get_settings()
    if s.exotel_dry_run or not (s.exotel_api_key and s.exotel_api_token and s.exotel_account_sid):
        payload_b64 = base64.urlsafe_b64encode(json.dumps(custom_field).encode()).decode()
        return f"dry-run-{payload_b64[:24]}", None

    url = (
        f"https://{s.exotel_api_key}:{s.exotel_api_token}"
        f"@{s.exotel_subdomain}/v1/Accounts/{s.exotel_account_sid}/Calls/connect"
    )
    from_num = format_exotel_from_number(customer_number)
    status_cb = f"{s.app_base_url.rstrip('/')}/webhooks/exotel/status"
    secret = s.exotel_webhook_secret
    if secret:
        status_cb = f"{status_cb}?secret={quote(secret)}"

    data = {
        "From": from_num,
        "CallerId": s.exotel_caller_id,
        "CallType": "trans",
        "Url": s.exotel_flow_url,
        "StatusCallback": status_cb,
        "CustomField": json.dumps(custom_field, separators=(",", ":")),
    }

    with httpx.Client(timeout=60.0) as client:
        r = client.post(url, data=data)
        text = r.text
        if r.status_code != 200:
            return None, text[:2000]

    sid = _parse_call_sid_from_xml(text)
    return sid, None


def _parse_call_sid_from_xml(body: str) -> str | None:
    m = re.search(r"<Sid>([^<]+)</Sid>", body)
    if m:
        return m.group(1).strip()
    return None
