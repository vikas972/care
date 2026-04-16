from typing import Literal

from pydantic import BaseModel, Field

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.auth import UserPublic
from app.services.crypto import encrypt_str

router = APIRouter(prefix="/users", tags=["users"])

ALLOWED_CALL_PROVIDERS = frozenset({"exotel", "twilio"})


class PhoneUpdate(BaseModel):
    phone_e164: str = Field(..., min_length=8, description="Your number for calendar reminder calls")


class CallProviderUpdate(BaseModel):
    call_provider: Literal["exotel", "twilio"]


def _user_public(user: User) -> UserPublic:
    return UserPublic(
        id=user.id,
        email=user.email,
        name=user.name,
        has_phone=bool(user.phone_number_encrypted),
        call_provider=getattr(user, "call_provider", None) or "exotel",
    )


@router.get("/me", response_model=UserPublic)
def read_me(user: User = Depends(get_current_user)):
    return _user_public(user)


@router.patch("/me/phone", response_model=UserPublic)
def update_phone(
    body: PhoneUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user.phone_number_encrypted = encrypt_str(body.phone_e164)
    db.commit()
    db.refresh(user)
    return _user_public(user)


@router.patch("/me/call-provider", response_model=UserPublic)
def update_call_provider(
    body: CallProviderUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if body.call_provider not in ALLOWED_CALL_PROVIDERS:
        raise HTTPException(400, "Invalid call_provider")
    s = get_settings()
    if body.call_provider == "twilio":
        if not (s.twilio_account_sid and s.twilio_auth_token and s.twilio_from_number):
            raise HTTPException(
                400,
                "Twilio is not configured on the server. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER.",
            )
    user.call_provider = body.call_provider
    db.commit()
    db.refresh(user)
    return _user_public(user)
