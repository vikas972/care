from __future__ import annotations

import enum
from typing import TYPE_CHECKING, Any

from sqlalchemy import Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class CallType(str, enum.Enum):
    event = "event"
    medicine = "medicine"


class CallLogStatus(str, enum.Enum):
    queued = "queued"
    ringing = "ringing"
    in_progress = "in_progress"
    completed = "completed"
    acknowledged = "acknowledged"
    no_answer = "no_answer"
    busy = "busy"
    failed = "failed"


class CallLog(Base):
    __tablename__ = "call_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    type: Mapped[CallType] = mapped_column(Enum(CallType), nullable=False)
    reference_id: Mapped[int] = mapped_column(Integer, nullable=False)
    provider: Mapped[str] = mapped_column(String(64), default="exotel", nullable=False)
    provider_call_sid: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(64), default=CallLogStatus.queued.value, nullable=False)
    retries: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    dtmf_digit: Mapped[str | None] = mapped_column(String(8), nullable=True)
    raw_payload: Mapped[dict[str, Any] | None] = mapped_column(JSON().with_variant(JSONB, "postgresql"))

    user: Mapped["User"] = relationship("User", back_populates="call_logs")
