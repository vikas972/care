from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.medicine_reminder import MedicineFrequency, MedicineReminder
from app.models.user import User
from app.schemas.medicine import MedicineCreate, MedicineOut, MedicineUpdate
from app.services.crypto import decrypt_str, encrypt_str
from app.services.reminder_jobs import revoke_task, schedule_medicine_reminder
from app.services.scheduling import compute_next_medicine_fire

router = APIRouter(prefix="/medicine", tags=["medicine"])

def _mask_phone(e164: str) -> str:
    digits = "".join(ch for ch in (e164 or "") if ch.isdigit())
    if len(digits) <= 4:
        return e164
    return f"+***{digits[-4:]}"


def _out(m: MedicineReminder) -> MedicineOut:
    phone = None
    try:
        phone = decrypt_str(m.target_phone_encrypted)
    except Exception:
        phone = None
    return MedicineOut(
        id=m.id,
        medicine_name=m.medicine_name,
        schedule_time=m.schedule_time,
        frequency=getattr(m.frequency, "value", m.frequency),
        day_of_week=m.day_of_week,
        next_fire_at=m.next_fire_at,
        status=m.status,
        target_phone_masked=_mask_phone(phone) if phone else None,
        message=m.message,
    )


@router.post("", response_model=MedicineOut)
def create_medicine(
    body: MedicineCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if body.frequency == MedicineFrequency.weekly and body.day_of_week is None:
        raise HTTPException(400, "day_of_week required for weekly frequency")
    now = datetime.now(UTC)
    next_at = compute_next_medicine_fire(
        schedule_time=body.schedule_time,
        frequency=body.frequency,
        day_of_week=body.day_of_week,
        after=now,
    )
    m = MedicineReminder(
        user_id=user.id,
        medicine_name=body.medicine_name,
        schedule_time=body.schedule_time,
        frequency=body.frequency,
        day_of_week=body.day_of_week,
        target_phone_encrypted=encrypt_str(body.target_phone_e164),
        message=(body.message.strip() if isinstance(body.message, str) and body.message.strip() else None),
        next_fire_at=next_at,
        status="pending",
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    schedule_medicine_reminder(m)
    db.commit()
    db.refresh(m)
    return _out(m)


@router.get("", response_model=list[MedicineOut])
def list_medicine(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(MedicineReminder)
        .filter(MedicineReminder.user_id == user.id)
        .order_by(MedicineReminder.next_fire_at)
        .all()
    )
    return [_out(r) for r in rows]


@router.get("/{medicine_id}", response_model=MedicineOut)
def get_medicine(
    medicine_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    m = db.get(MedicineReminder, medicine_id)
    if not m or m.user_id != user.id:
        raise HTTPException(404, "Not found")
    return _out(m)


@router.patch("/{medicine_id}", response_model=MedicineOut)
def update_medicine(
    medicine_id: int,
    body: MedicineUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    m = db.get(MedicineReminder, medicine_id)
    if not m or m.user_id != user.id:
        raise HTTPException(404, "Not found")
    if body.medicine_name is not None:
        m.medicine_name = body.medicine_name
    if body.schedule_time is not None:
        m.schedule_time = body.schedule_time
    if body.frequency is not None:
        m.frequency = body.frequency
    if body.day_of_week is not None:
        m.day_of_week = body.day_of_week
    if body.target_phone_e164 is not None:
        m.target_phone_encrypted = encrypt_str(body.target_phone_e164)
    if body.message is not None:
        m.message = body.message.strip() if body.message.strip() else None

    freq = m.frequency
    if freq == MedicineFrequency.weekly and m.day_of_week is None:
        raise HTTPException(400, "day_of_week required for weekly frequency")

    m.next_fire_at = compute_next_medicine_fire(
        schedule_time=m.schedule_time,
        frequency=m.frequency,
        day_of_week=m.day_of_week,
        after=datetime.now(UTC),
    )
    schedule_medicine_reminder(m)
    db.commit()
    db.refresh(m)
    return _out(m)


@router.delete("/{medicine_id}", status_code=204)
def delete_medicine(
    medicine_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    m = db.get(MedicineReminder, medicine_id)
    if not m or m.user_id != user.id:
        raise HTTPException(404, "Not found")
    revoke_task(m.celery_task_id)
    db.delete(m)
    db.commit()
    return Response(status_code=204)
