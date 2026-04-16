from unittest.mock import MagicMock, patch

from app.database import SessionLocal
from app.models.call_log import CallLog, CallType
from app.models.user import User
from app.services.call_updates import apply_exotel_status_update


@patch("app.services.call_updates.celery_app.send_task")
def test_apply_exotel_ack_medicine(mock_send: MagicMock):
    db = SessionLocal()
    try:
        u = User(email="a@b.c", google_sub="sub1")
        db.add(u)
        db.commit()
        db.refresh(u)
        log = CallLog(
            user_id=u.id,
            type=CallType.medicine,
            reference_id=1,
            provider="exotel",
            status="in_progress",
        )
        db.add(log)
        db.commit()
        db.refresh(log)

        apply_exotel_status_update(
            call_sid=None,
            status="completed",
            form={"Digits": "1", "CustomField": f'{{"call_log_id":{log.id}}}'},
        )

        db.expire_all()
        log2 = db.get(CallLog, log.id)
        assert log2 is not None
        assert log2.dtmf_digit == "1"
        assert log2.status == "acknowledged"
    finally:
        db.close()
