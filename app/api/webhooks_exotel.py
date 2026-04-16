from fastapi import APIRouter, HTTPException, Query, Request

from app.config import get_settings
from app.services.call_updates import apply_exotel_status_update

router = APIRouter(prefix="/webhooks/exotel", tags=["webhooks"])


def _check_secret(secret: str | None) -> None:
    s = get_settings()
    if not s.exotel_webhook_secret:
        return
    if secret != s.exotel_webhook_secret:
        raise HTTPException(403, "Invalid secret")


@router.post("/status")
async def exotel_status(
    request: Request,
    secret: str | None = Query(None),
):
    _check_secret(secret)
    form = dict(await request.form())
    call_sid = form.get("CallSid") or form.get("call_sid")
    status = form.get("Status") or form.get("CallStatus") or form.get("status")
    apply_exotel_status_update(call_sid=str(call_sid) if call_sid else None, status=str(status) if status else None, form=form)
    return {"ok": True}


@router.post("/gather")
async def exotel_gather(
    request: Request,
    secret: str | None = Query(None),
):
    """DTMF gather callback (configure your ExoML flow to POST here)."""
    _check_secret(secret)
    form = dict(await request.form())
    call_sid = form.get("CallSid") or form.get("call_sid")
    status = form.get("CallStatus") or form.get("Status")
    apply_exotel_status_update(call_sid=str(call_sid) if call_sid else None, status=str(status) if status else None, form=form)
    return {"ok": True}
