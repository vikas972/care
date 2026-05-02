from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.auth import TokenResponse
from app.services.crypto import encrypt_str
from app.services.firebase_auth import verify_firebase_id_token
from app.services.jwt_utils import create_access_token


router = APIRouter(prefix="/auth/phone", tags=["auth"])


class FirebaseExchangeIn(BaseModel):
    id_token: str = Field(..., min_length=16)


@router.post("/exchange", response_model=TokenResponse)
def exchange_firebase_phone_token(body: FirebaseExchangeIn, db: Session = Depends(get_db)):
    try:
        decoded = verify_firebase_id_token(body.id_token)
    except Exception as e:
        raise HTTPException(401, f"Invalid Firebase token: {e}") from e

    uid = str(decoded.get("uid") or "")
    phone = str(decoded.get("phone_number") or "")
    if not uid or not phone:
        raise HTTPException(400, "Firebase token missing uid/phone_number (phone auth required).")

    user = db.query(User).filter(User.firebase_uid == uid).one_or_none()
    if user:
        user.firebase_uid = uid
        user.phone_number_encrypted = encrypt_str(phone)
    else:
        user = User(
            email=None,
            name=None,
            google_sub=None,
            firebase_uid=uid,
            phone_number_encrypted=encrypt_str(phone),
            google_refresh_token_encrypted=None,
        )
        db.add(user)
    db.commit()
    db.refresh(user)

    return TokenResponse(access_token=create_access_token(user.id))

