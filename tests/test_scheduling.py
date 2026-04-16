from datetime import UTC, datetime, time

import pytest

from app.models.medicine_reminder import MedicineFrequency
from app.services.scheduling import (
    compute_next_medicine_fire,
    reminder_time_before_event,
    should_retry_call,
)


def test_reminder_time_before_event():
    start = datetime(2026, 4, 12, 14, 0, tzinfo=UTC)
    assert reminder_time_before_event(start, 15) == datetime(2026, 4, 12, 13, 45, tzinfo=UTC)


def test_compute_next_medicine_daily():
    after = datetime(2026, 4, 12, 10, 0, tzinfo=UTC)
    st = time(9, 0)
    nxt = compute_next_medicine_fire(
        schedule_time=st,
        frequency=MedicineFrequency.daily,
        day_of_week=None,
        after=after,
    )
    # schedule_time is interpreted in IST; 09:00 IST == 03:30 UTC
    assert nxt == datetime(2026, 4, 13, 3, 30, tzinfo=UTC)


def test_compute_next_medicine_daily_same_day():
    after = datetime(2026, 4, 12, 8, 0, tzinfo=UTC)
    st = time(9, 0)
    nxt = compute_next_medicine_fire(
        schedule_time=st,
        frequency=MedicineFrequency.daily,
        day_of_week=None,
        after=after,
    )
    # after=08:00 UTC == 13:30 IST; next 09:00 IST is next day
    assert nxt == datetime(2026, 4, 13, 3, 30, tzinfo=UTC)


def test_compute_next_medicine_weekly():
    # Monday 2026-04-13 is weekday 0
    after = datetime(2026, 4, 12, 10, 0, tzinfo=UTC)  # Sunday
    st = time(9, 0)
    nxt = compute_next_medicine_fire(
        schedule_time=st,
        frequency=MedicineFrequency.weekly,
        day_of_week=0,
        after=after,
    )
    assert nxt.weekday() == 0
    assert nxt > after


@pytest.mark.parametrize(
    "status,dtmf,retries,expected",
    [
        ("no-answer", None, 0, True),
        ("busy", None, 1, True),
        ("completed", None, 0, True),
        ("completed", "1", 0, False),
        ("completed", None, 3, False),
        ("acknowledged", "1", 0, False),
    ],
)
def test_should_retry_call(status, dtmf, retries, expected):
    assert should_retry_call(status, dtmf, max_retries=3, current_retries=retries) is expected
