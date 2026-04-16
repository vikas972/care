import json
import logging
from typing import Any

from app.database import SessionLocal
from app.models.calendar_event import CalendarEvent, ReminderStatus
from app.models.call_log import CallLog, CallLogStatus, CallType
from app.models.medicine_reminder import MedicineReminder
from app.services.scheduling import compute_next_medicine_fire, should_retry_call
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


def apply_call_log_update(
    *,
    call_sid: str | None,
    status: str | None,
    form: dict[str, Any],
) -> None:
    from app.config import get_settings

    s = get_settings()
    effective_max_retries = min(int(s.call_retry_max), 1)
    raw = status or form.get("CallStatus") or form.get("Status")
    st = (raw or "").lower().replace("_", "-")

    db = SessionLocal()
    try:
        log: CallLog | None = None
        if call_sid:
            log = db.query(CallLog).filter(CallLog.provider_call_sid == call_sid).one_or_none()

        custom = form.get("CustomField") or form.get("custom_field")
        if not log and custom:
            try:
                data = json.loads(custom) if isinstance(custom, str) else custom
                lid = data.get("call_log_id")
                if lid:
                    log = db.get(CallLog, int(lid))
            except (json.JSONDecodeError, TypeError, ValueError):
                pass

        if not log:
            lid_raw = form.get("twilio_call_log_id")
            if lid_raw:
                try:
                    log = db.get(CallLog, int(lid_raw))
                except (TypeError, ValueError):
                    pass

        if not log:
            return

        log.raw_payload = {**(log.raw_payload or {}), "last_status": raw, "form": dict(form)}

        if st == "completed":
            log.status = CallLogStatus.completed.value
        elif st == "no-answer":
            log.status = CallLogStatus.no_answer.value
        elif st == "busy":
            log.status = CallLogStatus.busy.value
        elif st in ("failed", "canceled", "cancelled"):
            log.status = CallLogStatus.failed.value
        elif st == "in-progress":
            log.status = CallLogStatus.in_progress.value
        elif st == "ringing":
            log.status = CallLogStatus.ringing.value
        elif st == "answered":
            log.status = CallLogStatus.in_progress.value
        elif st in ("initiated", "queued"):
            log.status = CallLogStatus.queued.value

        dtmf = form.get("Digits") or form.get("digits")
        if dtmf:
            log.dtmf_digit = str(dtmf)

        if log.dtmf_digit == "1":
            log.status = CallLogStatus.acknowledged.value
            if log.type == CallType.event:
                ev = db.get(CalendarEvent, log.reference_id)
                if ev:
                    ev.status = ReminderStatus.completed
            elif log.type == CallType.medicine:
                med = db.get(MedicineReminder, log.reference_id)
                if med:
                    from datetime import UTC, datetime

                    med.next_fire_at = compute_next_medicine_fire(
                        schedule_time=med.schedule_time,
                        frequency=med.frequency,
                        day_of_week=med.day_of_week,
                        after=datetime.now(UTC),
                    )
                    from app.services.reminder_jobs import schedule_medicine_reminder

                    schedule_medicine_reminder(med)

        db.commit()

        if should_retry_call(st, log.dtmf_digit, effective_max_retries, log.retries):
            celery_app.send_task(
                "retry_call",
                args=[log.id],
                countdown=s.call_retry_delay_seconds,
            )
    except Exception:
        logger.exception("call log webhook handler failed")
        db.rollback()
    finally:
        db.close()


def apply_exotel_status_update(*, call_sid: str | None, status: str | None, form: dict[str, Any]) -> None:
    apply_call_log_update(call_sid=call_sid, status=status, form=form)
