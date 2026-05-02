from datetime import UTC, datetime

from app.models.calendar_event import CalendarEvent, ReminderStatus
from app.models.medicine_reminder import MedicineReminder
from app.tasks.celery_app import celery_app


def revoke_task(task_id: str | None) -> None:
    if not task_id:
        return
    try:
        celery_app.control.revoke(task_id, terminate=False)
    except Exception:
        pass


def schedule_calendar_reminder(event: CalendarEvent) -> None:
    revoke_task(event.celery_task_id)
    if event.status != ReminderStatus.pending:
        event.celery_task_id = None
        return
    now = datetime.now(UTC)
    try:
        if event.reminder_time <= now:
            res = celery_app.send_task("place_calendar_reminder", args=[event.id])
        else:
            res = celery_app.send_task(
                "place_calendar_reminder",
                args=[event.id],
                eta=event.reminder_time,
            )
        event.celery_task_id = res.id
    except Exception:
        # Local dev often runs the API without Redis/Celery; keep the API request working.
        event.celery_task_id = None


def schedule_medicine_reminder(m: MedicineReminder) -> None:
    revoke_task(m.celery_task_id)
    if m.status != "pending":
        m.celery_task_id = None
        return
    now = datetime.now(UTC)
    try:
        if m.next_fire_at <= now:
            res = celery_app.send_task("place_medicine_reminder", args=[m.id])
        else:
            res = celery_app.send_task(
                "place_medicine_reminder",
                args=[m.id],
                eta=m.next_fire_at,
            )
        m.celery_task_id = res.id
    except Exception:
        # Local dev often runs the API without Redis/Celery; keep the API request working.
        m.celery_task_id = None


def schedule_pending_calendar_for_user(db, user_id: int) -> None:
    events = (
        db.query(CalendarEvent)
        .filter(
            CalendarEvent.user_id == user_id,
            CalendarEvent.status == ReminderStatus.pending,
        )
        .all()
    )
    for e in events:
        schedule_calendar_reminder(e)
    db.commit()
