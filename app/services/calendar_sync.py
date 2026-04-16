import json
import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from google.auth.transport.requests import Request
from googleapiclient.errors import HttpError
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.calendar_event import CalendarEvent, ReminderStatus
from app.models.user import User
from app.services.crypto import decrypt_str
from app.services.google_oauth import build_calendar_service, credentials_from_refresh
from app.services.scheduling import reminder_time_before_event

logger = logging.getLogger(__name__)


@dataclass
class CalendarSyncResult:
    """Result of a sync run for API responses and debugging."""

    upserted: int
    events_from_google: int
    skipped_past_reminder: int


def _friendly_http_error(e: HttpError) -> str:
    status = getattr(e.resp, "status", "?")
    try:
        data = json.loads(e.content.decode() if e.content else "{}")
        msg = (data.get("error") or {}).get("message") or str(e)
    except (json.JSONDecodeError, TypeError, AttributeError):
        msg = str(e)

    if status == 403:
        return (
            f"Google returned 403: {msg}. "
            "Enable 'Google Calendar API' in Google Cloud Console → APIs & Services → Library. "
            "If it is enabled, revoke this app at https://myaccount.google.com/permissions "
            "and sign in again so Calendar scope is granted."
        )
    if status == 401:
        return (
            f"Google returned 401: {msg}. "
            "Revoke app access at https://myaccount.google.com/permissions and sign in again."
        )
    return f"Google Calendar API error ({status}): {msg}"


def _ensure_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def fetch_and_upsert_events(db: Session, user: User, days_ahead: int = 14) -> CalendarSyncResult:
    if not user.google_refresh_token_encrypted:
        raise ValueError("user has no Google refresh token")
    refresh = decrypt_str(user.google_refresh_token_encrypted)
    creds = credentials_from_refresh(refresh)
    try:
        creds.refresh(Request())
    except Exception as e:
        logger.exception("refresh failed")
        raise ValueError(
            "Could not refresh Google token. Revoke this app at "
            "https://myaccount.google.com/permissions and sign in again."
        ) from e

    service = build_calendar_service(creds)

    now = datetime.now(UTC)
    time_min = now.isoformat()
    time_max = (now + timedelta(days=days_ahead)).isoformat()

    try:
        events_result = (
            service.events()
            .list(
                calendarId="primary",
                timeMin=time_min,
                timeMax=time_max,
                singleEvents=True,
                orderBy="startTime",
            )
            .execute()
        )
    except HttpError as e:
        raise ValueError(_friendly_http_error(e)) from e

    items = events_result.get("items", [])
    settings = get_settings()
    minutes_before = settings.calendar_reminder_minutes_before
    skipped_past = 0
    count = 0

    for item in items:
        eid = item.get("id")
        if not eid:
            continue
        start = item.get("start", {})
        if "dateTime" in start:
            raw = start["dateTime"]
            start_time = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        elif "date" in start:
            d = datetime.fromisoformat(start["date"]).date()
            start_time = datetime(d.year, d.month, d.day, tzinfo=UTC)
        else:
            continue

        start_time = _ensure_utc(start_time)
        rem_time = reminder_time_before_event(start_time, minutes_before)
        if rem_time < now:
            skipped_past += 1
            continue

        title = item.get("summary")
        existing = (
            db.query(CalendarEvent)
            .filter(
                CalendarEvent.user_id == user.id,
                CalendarEvent.provider_event_id == eid,
            )
            .one_or_none()
        )
        if existing:
            existing.start_time = start_time
            existing.reminder_time = rem_time
            existing.title = title
            if existing.status in (ReminderStatus.completed, ReminderStatus.skipped):
                pass
            else:
                existing.status = ReminderStatus.pending
        else:
            db.add(
                CalendarEvent(
                    user_id=user.id,
                    provider_event_id=eid,
                    title=title,
                    start_time=start_time,
                    reminder_time=rem_time,
                    status=ReminderStatus.pending,
                )
            )
        count += 1

    db.commit()

    from app.services.reminder_jobs import schedule_pending_calendar_for_user

    schedule_pending_calendar_for_user(db, user.id)
    return CalendarSyncResult(
        upserted=count,
        events_from_google=len(items),
        skipped_past_reminder=skipped_past,
    )


def check_calendar_api_access(user: User) -> tuple[bool, str]:
    """Lightweight check: can we call Calendar API with stored refresh token?"""
    if not user.google_refresh_token_encrypted:
        return False, "No Google token stored. Complete Sign in with Google."
    refresh = decrypt_str(user.google_refresh_token_encrypted)
    creds = credentials_from_refresh(refresh)
    try:
        creds.refresh(Request())
    except Exception as e:
        return False, f"Token refresh failed: {e}. Revoke app in Google Account permissions and sign in again."
    service = build_calendar_service(creds)
    try:
        service.calendarList().list(maxResults=1).execute()
    except HttpError as e:
        return False, _friendly_http_error(e)
    except Exception as e:
        return False, str(e)
    return True, "Calendar API OK"
