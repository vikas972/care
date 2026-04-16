import logging
from datetime import UTC, datetime, timedelta

from app.database import SessionLocal
from app.models.calendar_event import CalendarEvent, ReminderStatus
from app.models.call_log import CallLog, CallLogStatus, CallType
from app.models.medicine_reminder import MedicineReminder
from app.models.user import User
from app.services.calendar_sync import fetch_and_upsert_events
from app.services.crypto import decrypt_str
from app.services.outbound_call import initiate_provider_call
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


def _now_utc() -> datetime:
    return datetime.now(UTC)


@celery_app.task(name="place_calendar_reminder")
def place_calendar_reminder(event_id: int) -> None:
    db = SessionLocal()
    try:
        event = db.get(CalendarEvent, event_id)
        if not event or event.status != ReminderStatus.pending:
            return
        if event.reminder_time > _now_utc():
            return
        active = (
            db.query(CallLog)
            .filter(
                CallLog.reference_id == event_id,
                CallLog.type == CallType.event,
                CallLog.status.in_(["queued", "ringing", "in_progress"]),
            )
            .first()
        )
        if active:
            return

        user = db.get(User, event.user_id)
        if not user or not user.phone_number_encrypted:
            event.status = ReminderStatus.failed
            db.add(
                CallLog(
                    user_id=event.user_id,
                    type=CallType.event,
                    reference_id=event_id,
                    status=CallLogStatus.failed.value,
                    raw_payload={"reason": "no_phone"},
                )
            )
            db.commit()
            return

        phone = decrypt_str(user.phone_number_encrypted)
        log = CallLog(
            user_id=user.id,
            type=CallType.event,
            reference_id=event_id,
            status=CallLogStatus.queued.value,
        )
        db.add(log)
        db.flush()

        custom = {"call_log_id": log.id, "kind": "event", "message": _calendar_message(event)}
        log.raw_payload = {"outbound": custom}
        db.flush()
        prov = (getattr(user, "call_provider", None) or "exotel").strip().lower()
        log.provider = prov
        sid, err, used = initiate_provider_call(
            provider=prov,
            customer_number=phone,
            custom_field=custom,
        )
        if err:
            from app.config import get_settings

            log.provider = used
            log.status = CallLogStatus.failed.value
            log.raw_payload = {**(log.raw_payload or {}), "error": err}
            db.commit()
            celery_app.send_task(
                "retry_call",
                args=[log.id],
                countdown=get_settings().call_retry_delay_seconds,
            )
            return

        log.provider = used
        log.provider_call_sid = sid
        log.status = CallLogStatus.in_progress.value
        db.commit()
    except Exception:
        logger.exception("place_calendar_reminder failed event_id=%s", event_id)
        db.rollback()
    finally:
        db.close()


def _calendar_message(event: CalendarEvent) -> str:
    return f"You have a meeting in 15 minutes: {event.title or 'Calendar event'}."


@celery_app.task(name="place_medicine_reminder")
def place_medicine_reminder(medicine_id: int) -> None:
    db = SessionLocal()
    try:
        med = db.get(MedicineReminder, medicine_id)
        if not med or med.status != "pending":
            return
        if med.next_fire_at > _now_utc():
            return
        active = (
            db.query(CallLog)
            .filter(
                CallLog.reference_id == medicine_id,
                CallLog.type == CallType.medicine,
                CallLog.status.in_(["queued", "ringing", "in_progress"]),
            )
            .first()
        )
        if active:
            return

        phone = decrypt_str(med.target_phone_encrypted)
        log = CallLog(
            user_id=med.user_id,
            type=CallType.medicine,
            reference_id=medicine_id,
            status=CallLogStatus.queued.value,
        )
        db.add(log)
        db.flush()

        custom = {
            "call_log_id": log.id,
            "kind": "medicine",
            "message": (med.message or f"Time to take your {med.medicine_name}."),
        }
        log.raw_payload = {"outbound": custom}
        db.flush()
        owner = db.get(User, med.user_id)
        prov = (getattr(owner, "call_provider", None) or "exotel").strip().lower() if owner else "exotel"
        log.provider = prov
        sid, err, used = initiate_provider_call(
            provider=prov,
            customer_number=phone,
            custom_field=custom,
        )
        if err:
            from app.config import get_settings

            log.provider = used
            log.status = CallLogStatus.failed.value
            log.raw_payload = {**(log.raw_payload or {}), "error": err}
            db.commit()
            celery_app.send_task(
                "retry_call",
                args=[log.id],
                countdown=get_settings().call_retry_delay_seconds,
            )
            return

        log.provider = used
        log.provider_call_sid = sid
        log.status = CallLogStatus.in_progress.value
        db.commit()
    except Exception:
        logger.exception("place_medicine_reminder failed medicine_id=%s", medicine_id)
        db.rollback()
    finally:
        db.close()


@celery_app.task(name="retry_call")
def retry_call(call_log_id: int) -> None:
    from app.config import get_settings

    s = get_settings()
    effective_max_retries = min(int(s.call_retry_max), 1)
    db = SessionLocal()
    try:
        log = db.get(CallLog, call_log_id)
        if not log:
            return
        # A retry task may already be queued when the user acknowledges.
        if (log.dtmf_digit or "") == "1" or (log.status or "").lower() == CallLogStatus.acknowledged.value:
            return
        if log.retries >= effective_max_retries:
            return
        log.retries += 1
        if log.type == CallType.event:
            ref = db.get(CalendarEvent, log.reference_id)
            phone_user = db.get(User, log.user_id)
            if not ref or not phone_user or not phone_user.phone_number_encrypted:
                return
            phone = decrypt_str(phone_user.phone_number_encrypted)
            msg = _calendar_message(ref) if ref else "Reminder"
        else:
            med = db.get(MedicineReminder, log.reference_id)
            if not med:
                return
            phone = decrypt_str(med.target_phone_encrypted)
            msg = med.message or f"Time to take your {med.medicine_name}."

        kind = log.type.value if isinstance(log.type, CallType) else str(log.type)
        custom = {"call_log_id": log.id, "kind": kind, "message": msg}
        log.raw_payload = {**(log.raw_payload or {}), "outbound": custom}
        u = db.get(User, log.user_id)
        prov = (getattr(u, "call_provider", None) or log.provider or "exotel").strip().lower() if u else (log.provider or "exotel").strip().lower()
        log.provider = prov
        sid, err, used = initiate_provider_call(
            provider=prov,
            customer_number=phone,
            custom_field=custom,
        )
        if err:
            log.provider = used
            log.raw_payload = {**(log.raw_payload or {}), "retry_error": err}
            db.commit()
            if log.retries < effective_max_retries:
                celery_app.send_task(
                    "retry_call",
                    args=[log.id],
                    countdown=s.call_retry_delay_seconds,
                )
            return
        log.provider = used
        log.provider_call_sid = sid
        log.status = CallLogStatus.in_progress.value
        db.commit()
    except Exception:
        logger.exception("retry_call failed log_id=%s", call_log_id)
        db.rollback()
    finally:
        db.close()


@celery_app.task(name="sweep_due_reminders")
def sweep_due_reminders() -> None:
    db = SessionLocal()
    try:
        now = _now_utc()
        window_start = now - timedelta(minutes=30)
        events = (
            db.query(CalendarEvent)
            .filter(
                CalendarEvent.status == ReminderStatus.pending,
                CalendarEvent.reminder_time <= now,
                CalendarEvent.reminder_time >= window_start,
            )
            .all()
        )
        for e in events:
            place_calendar_reminder.delay(e.id)

        meds = (
            db.query(MedicineReminder)
            .filter(
                MedicineReminder.status == "pending",
                MedicineReminder.next_fire_at <= now,
                MedicineReminder.next_fire_at >= window_start,
            )
            .all()
        )
        for m in meds:
            place_medicine_reminder.delay(m.id)
    finally:
        db.close()


@celery_app.task(name="sync_all_calendars")
def sync_all_calendars() -> None:
    db = SessionLocal()
    try:
        users = db.query(User).filter(User.google_refresh_token_encrypted.isnot(None)).all()
        for u in users:
            try:
                fetch_and_upsert_events(db, u)
            except Exception:
                logger.exception("sync failed user_id=%s", u.id)
    finally:
        db.close()
