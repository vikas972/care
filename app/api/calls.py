from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.deps import get_current_user
from app.models.calendar_event import CalendarEvent
from app.models.call_log import CallLog, CallLogStatus, CallType
from app.models.medicine_reminder import MedicineReminder
from app.models.user import User
from app.schemas.calls import CallLogOut, CallLogOutWithPayload
from app.services.crypto import decrypt_str
from app.services.exotel import initiate_connect_call
from app.services.outbound_call import initiate_provider_call

router = APIRouter(prefix="/calls", tags=["calls"])


@router.get("/logs", response_model=list[CallLogOut])
def list_call_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(CallLog)
        .filter(CallLog.user_id == user.id)
        .order_by(CallLog.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return rows


@router.get("/logs-with-payload", response_model=list[CallLogOutWithPayload])
def list_call_logs_with_payload(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    provider: str | None = Query(None, description="Filter by provider (exotel|twilio)"),
    status: str | None = Query(None, description="Filter by call status"),
    type: str | None = Query(None, description="Filter by type (event|medicine)"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(CallLog).filter(CallLog.user_id == user.id)
    if provider:
        q = q.filter(CallLog.provider == provider)
    if status:
        q = q.filter(CallLog.status == status)
    if type:
        # CallType is an Enum in DB; comparing to string works in SQLAlchemy.
        q = q.filter(CallLog.type == type)
    rows = q.order_by(CallLog.id.desc()).offset(skip).limit(limit).all()
    out: list[CallLogOutWithPayload] = []
    for r in rows:
        label = None
        when = None
        if r.type == CallType.event:
            ev = db.get(CalendarEvent, r.reference_id)
            if ev:
                label = ev.title or "Calendar event"
                when = ev.start_time.isoformat()
        elif r.type == CallType.medicine:
            med = db.get(MedicineReminder, r.reference_id)
            if med:
                label = med.medicine_name
                when = med.next_fire_at.isoformat()
        out.append(
            CallLogOutWithPayload(
                id=r.id,
                type=getattr(r.type, "value", r.type),
                reference_id=r.reference_id,
                provider=r.provider,
                provider_call_sid=r.provider_call_sid,
                status=r.status,
                retries=r.retries,
                dtmf_digit=r.dtmf_digit,
                raw_payload=r.raw_payload,
                reference_label=label,
                reference_when=when,
            )
        )
    return out


def _twilio_configured(s) -> bool:
    return bool(s.twilio_account_sid and s.twilio_auth_token and s.twilio_from_number)


@router.post("/test-ring")
def test_ring(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Place one immediate test call to the phone on your profile using your selected provider.
    """
    if not user.phone_number_encrypted:
        raise HTTPException(
            400,
            "No phone on profile. Save your number in the dashboard first.",
        )
    s = get_settings()
    prov = (getattr(user, "call_provider", None) or "exotel").strip().lower()
    phone = decrypt_str(user.phone_number_encrypted)

    if prov == "twilio":
        if s.twilio_dry_run:
            raise HTTPException(
                400,
                "TWILIO_DRY_RUN is enabled — disable it to place a real Twilio test call.",
            )
        if not _twilio_configured(s):
            raise HTTPException(400, "Twilio is not configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER).")

        custom = {
            "call_log_id": 0,
            "kind": "test",
            "message": "SmartCall test call. You can hang up.",
        }
        log = CallLog(
            user_id=user.id,
            type=CallType.event,
            reference_id=0,
            provider="twilio",
            status=CallLogStatus.queued.value,
            raw_payload={"outbound": custom},
        )
        db.add(log)
        db.flush()
        custom["call_log_id"] = log.id
        sid, err, used = initiate_provider_call(
            provider="twilio",
            customer_number=phone,
            custom_field=custom,
        )
        if err:
            db.delete(log)
            db.commit()
            raise HTTPException(502, f"Twilio did not accept the call: {err[:800]}")
        log.provider = used
        log.provider_call_sid = sid
        log.status = CallLogStatus.in_progress.value
        db.commit()
        return {
            "ok": True,
            "provider": used,
            "provider_call_sid": sid,
            "call_log_id": log.id,
            "detail": "Twilio must reach your API for TwiML (set APP_BASE_URL or TWILIO_WEBHOOK_PUBLIC_URL to a public URL such as ngrok).",
        }

    if s.exotel_dry_run:
        raise HTTPException(
            400,
            "EXOTEL_DRY_RUN is enabled — disable it in .env to place a real test call.",
        )
    custom = {
        "call_log_id": 0,
        "kind": "test",
        "message": "SmartCall test call. You can hang up.",
    }
    sid, err = initiate_connect_call(customer_number=phone, custom_field=custom)
    if err:
        raise HTTPException(502, f"Exotel did not accept the call: {err[:800]}")
    return {
        "ok": True,
        "provider": "exotel",
        "provider_call_sid": sid,
        "detail": "If the phone does not ring, check EXOTEL_CALLER_ID, EXOTEL_FLOW_URL, and number format.",
    }
