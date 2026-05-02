from typing import TYPE_CHECKING

from sqlalchemy import Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.calendar_event import CalendarEvent
    from app.models.call_log import CallLog
    from app.models.medicine_reminder import MedicineReminder


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str | None] = mapped_column(String(320), unique=True, nullable=True, index=True)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    google_sub: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True, index=True)
    firebase_uid: Mapped[str | None] = mapped_column(
        String(255), unique=True, nullable=True, index=True
    )
    phone_number_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    google_refresh_token_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Outbound voice: "exotel" | "twilio"
    call_provider: Mapped[str] = mapped_column(String(32), default="exotel", nullable=False)

    calendar_events: Mapped[list["CalendarEvent"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    medicine_reminders: Mapped[list["MedicineReminder"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    call_logs: Mapped[list["CallLog"]] = relationship(back_populates="user", cascade="all, delete-orphan")
