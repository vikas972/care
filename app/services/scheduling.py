from datetime import UTC, datetime, time, timedelta
from zoneinfo import ZoneInfo

from app.models.medicine_reminder import MedicineFrequency

_IST = ZoneInfo("Asia/Kolkata")

def reminder_time_before_event(start: datetime, minutes_before: int) -> datetime:
    if start.tzinfo is None:
        start = start.replace(tzinfo=UTC)
    return start - timedelta(minutes=minutes_before)


def _combine_local_date(d: datetime, t: time, tz: ZoneInfo) -> datetime:
    if d.tzinfo is None:
        d = d.replace(tzinfo=UTC)
    local_date = d.astimezone(tz).date()
    return datetime(
        local_date.year,
        local_date.month,
        local_date.day,
        t.hour,
        t.minute,
        t.second,
        t.microsecond,
        tzinfo=tz,
    )


def compute_next_medicine_fire(
    *,
    schedule_time: time,
    frequency: MedicineFrequency,
    day_of_week: int | None,
    after: datetime,
) -> datetime:
    """Next fire time in UTC, interpreting schedule_time in IST. Weekly uses Monday=0 .. Sunday=6."""
    if after.tzinfo is None:
        after = after.replace(tzinfo=UTC)
    after_ist = after.astimezone(_IST)

    if frequency == MedicineFrequency.daily:
        candidate_ist = _combine_local_date(after_ist, schedule_time, _IST)
        if candidate_ist <= after_ist:
            candidate_ist = candidate_ist + timedelta(days=1)
        return candidate_ist.astimezone(UTC)

    dow = day_of_week if day_of_week is not None else 0
    candidate_ist = _combine_local_date(after_ist, schedule_time, _IST)
    for _ in range(14):
        if candidate_ist.weekday() == dow and candidate_ist > after_ist:
            return candidate_ist.astimezone(UTC)
        candidate_ist = candidate_ist + timedelta(days=1)
    return _combine_local_date(after_ist + timedelta(days=7), schedule_time, _IST).astimezone(UTC)


def should_retry_call(status: str, dtmf_digit: str | None, max_retries: int, current_retries: int) -> bool:
    if current_retries >= max_retries:
        return False
    if dtmf_digit == "1":
        return False
    s = (status or "").lower()
    if s == "acknowledged":
        return False
    terminal_fail = s in ("no-answer", "no_answer", "busy", "failed", "canceled", "cancelled")
    if terminal_fail:
        return True
    if s == "completed" and not dtmf_digit:
        return True
    return False
