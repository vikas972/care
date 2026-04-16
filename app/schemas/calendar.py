from datetime import datetime

from pydantic import BaseModel, field_validator


class CalendarEventOut(BaseModel):
    id: int
    provider_event_id: str
    title: str | None
    start_time: datetime
    reminder_time: datetime
    status: str

    model_config = {"from_attributes": True}

    @field_validator("status", mode="before")
    @classmethod
    def _status_str(cls, v):
        return getattr(v, "value", v)


class SyncResponse(BaseModel):
    """upserted = events stored with a future reminder call; skipped = reminder time already passed."""

    upserted: int
    events_from_google: int = 0
    skipped_past_reminder: int = 0


class CalendarConnectionResponse(BaseModel):
    ok: bool
    message: str
