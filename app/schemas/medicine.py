from datetime import datetime, time

from pydantic import BaseModel, Field, field_validator

from app.models.medicine_reminder import MedicineFrequency


class MedicineCreate(BaseModel):
    medicine_name: str = Field(..., max_length=512)
    schedule_time: time
    frequency: MedicineFrequency
    day_of_week: int | None = Field(None, ge=0, le=6)
    target_phone_e164: str = Field(..., description="Phone number; stored encrypted")
    message: str | None = Field(
        None, max_length=500, description="Custom reminder message (spoken on the call)"
    )


class MedicineUpdate(BaseModel):
    medicine_name: str | None = Field(None, max_length=512)
    schedule_time: time | None = None
    frequency: MedicineFrequency | None = None
    day_of_week: int | None = Field(None, ge=0, le=6)
    target_phone_e164: str | None = None
    message: str | None = Field(None, max_length=500)


class MedicineOut(BaseModel):
    id: int
    medicine_name: str
    schedule_time: time
    frequency: str
    day_of_week: int | None
    next_fire_at: datetime
    status: str
    target_phone_masked: str | None = None
    message: str | None = None

    model_config = {"from_attributes": True}

    @field_validator("frequency", mode="before")
    @classmethod
    def _freq_str(cls, v):
        return getattr(v, "value", v)
