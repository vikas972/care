from typing import Any

from pydantic import BaseModel, field_validator


class CallLogOut(BaseModel):
    id: int
    type: str
    reference_id: int
    provider: str
    provider_call_sid: str | None
    status: str
    retries: int
    dtmf_digit: str | None

    model_config = {"from_attributes": True}

    @field_validator("type", mode="before")
    @classmethod
    def _type_str(cls, v):
        return getattr(v, "value", v)


class CallLogOutWithPayload(CallLogOut):
    raw_payload: dict[str, Any] | None = None
    reference_label: str | None = None
    reference_when: str | None = None
