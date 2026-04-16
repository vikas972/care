from celery import Celery
from celery.schedules import schedule as celery_schedule

from app.config import get_settings

_settings = get_settings()

celery_app = Celery(
    "smartcall",
    broker=_settings.celery_broker_url,
    backend=_settings.celery_result_backend,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)

celery_app.conf.beat_schedule = {
    "sweep-due-reminders": {
        "task": "sweep_due_reminders",
        "schedule": celery_schedule(float(_settings.sweep_interval_seconds)),
    },
    "sync-calendars-hourly": {
        "task": "sync_all_calendars",
        "schedule": celery_schedule(3600.0),
    },
}

import app.tasks.tasks  # noqa: E402, F401 — register task modules
