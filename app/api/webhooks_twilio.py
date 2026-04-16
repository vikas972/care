import logging
from typing import Any
from urllib.parse import urlencode

from fastapi import APIRouter, HTTPException, Query, Request, Response
from app.config import get_settings
from app.database import SessionLocal
from app.models.call_log import CallLog
from app.services.call_updates import apply_call_log_update
from app.services.twilio_call import twilio_public_base_url
from twilio.request_validator import RequestValidator
from twilio.twiml.voice_response import Gather, VoiceResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks/twilio", tags=["webhooks"])


def _validation_url(request: Request) -> str:
    s = get_settings()
    pub = (s.twilio_webhook_public_url or s.app_base_url).rstrip("/")
    path = request.url.path
    q = request.url.query
    if q:
        return f"{pub}{path}?{q}"
    return f"{pub}{path}"


def _validate_twilio(request: Request, params: dict[str, Any]) -> None:
    s = get_settings()
    if not s.twilio_validate_webhook_signatures:
        return
    token = (s.twilio_auth_token or "").strip()
    if not token:
        raise HTTPException(503, "Twilio auth token not configured")
    sig = request.headers.get("X-Twilio-Signature") or ""
    url = _validation_url(request)
    if not RequestValidator(token).validate(url, params, sig):
        logger.warning("Twilio signature validation failed for %s", request.url.path)
        raise HTTPException(403, "Invalid Twilio signature")


def _voice_message(db, call_log_id: int) -> str:
    log = db.get(CallLog, call_log_id)
    if not log:
        return "Hello. This is your reminder."
    payload = log.raw_payload or {}
    out = payload.get("outbound") or {}
    return str(out.get("message") or "Reminder call.")


@router.api_route("/voice", methods=["GET", "POST"])
async def twilio_voice(
    request: Request,
    call_log_id: int = Query(...),
):
    if request.method == "POST":
        form = dict(await request.form())
        _validate_twilio(request, form)
    else:
        _validate_twilio(request, {})

    db = SessionLocal()
    try:
        message = _voice_message(db, call_log_id)
    finally:
        db.close()

    base = twilio_public_base_url()
    gather_q = urlencode({"call_log_id": str(call_log_id)})
    action = f"{base}/webhooks/twilio/gather?{gather_q}"

    vr = VoiceResponse()
    vr.say(message)
    g = Gather(
        num_digits=1,
        action=action,
        method="POST",
        timeout=8,
    )
    g.say("Press 1 to acknowledge.")
    vr.append(g)
    vr.say("We did not receive your input. Goodbye.")
    return Response(content=str(vr), media_type="application/xml")


@router.post("/gather")
async def twilio_gather(
    request: Request,
    call_log_id: int = Query(...),
):
    form = dict(await request.form())
    _validate_twilio(request, form)
    call_sid = form.get("CallSid")
    apply_call_log_update(
        call_sid=str(call_sid) if call_sid else None,
        status=str(form.get("CallStatus") or "completed"),
        form={**form, "twilio_call_log_id": str(call_log_id)},
    )
    vr = VoiceResponse()
    vr.say("Thank you. Goodbye.")
    vr.hangup()
    return Response(content=str(vr), media_type="application/xml")


@router.post("/status")
async def twilio_status(request: Request):
    form = dict(await request.form())
    _validate_twilio(request, form)
    call_sid = form.get("CallSid")
    status = form.get("CallStatus")
    apply_call_log_update(
        call_sid=str(call_sid) if call_sid else None,
        status=str(status) if status else None,
        form=form,
    )
    return {"ok": True}
