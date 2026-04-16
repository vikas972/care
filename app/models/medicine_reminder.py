from __future__ import annotations

import enum
from datetime import datetime, time
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class MedicineFrequency(str, enum.Enum):
    daily = "daily"
    weekly = "weekly"


class MedicineReminder(Base):
    __tablename__ = "medicine_reminders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    medicine_name: Mapped[str] = mapped_column(String(512), nullable=False)
    schedule_time: Mapped[time] = mapped_column(Time, nullable=False)
    frequency: Mapped[MedicineFrequency] = mapped_column(Enum(MedicineFrequency), nullable=False)
    day_of_week: Mapped[int | None] = mapped_column(Integer, nullable=True)
    target_phone_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    next_fire_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False, index=True)
    celery_task_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="medicine_reminders")
