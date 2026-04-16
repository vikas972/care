from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.calendar_event import CalendarEvent, ReminderStatus
from app.models.user import User
from app.schemas.calendar import CalendarConnectionResponse, CalendarEventOut, SyncResponse
from app.services.calendar_sync import check_calendar_api_access, fetch_and_upsert_events

router = APIRouter(prefix="/calendar", tags=["calendar"])


@router.get("/connection", response_model=CalendarConnectionResponse)
def calendar_connection(
    user: User = Depends(get_current_user),
):
    """Verify Google Calendar API is enabled and the saved token can access it."""
    ok, message = check_calendar_api_access(user)
    return CalendarConnectionResponse(ok=ok, message=message)


@router.post("/sync", response_model=SyncResponse)
def sync_calendar(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not user.google_refresh_token_encrypted:
        raise HTTPException(
            400,
            "Google Calendar not linked. Sign in with Google (demo uses calendar.readonly scope).",
        )
    try:
        result = fetch_and_upsert_events(db, user)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    except Exception as e:
        raise HTTPException(502, f"Calendar sync failed: {e}") from e
    return SyncResponse(
        upserted=result.upserted,
        events_from_google=result.events_from_google,
        skipped_past_reminder=result.skipped_past_reminder,
    )


@router.get("/events", response_model=list[CalendarEventOut])
def list_events(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(CalendarEvent)
        .filter(
            CalendarEvent.user_id == user.id,
            CalendarEvent.status == ReminderStatus.pending,
        )
        .order_by(CalendarEvent.start_time)
        .all()
    )
    return rows
