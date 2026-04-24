from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.config import get_settings
from app.deps import get_current_user
from app.models.user import User

try:
    from livekit import api as livekit_api
except Exception:  # pragma: no cover
    livekit_api = None


router = APIRouter(prefix="/livekit", tags=["livekit"])


class LiveKitTokenIn(BaseModel):
    room: str = Field(..., min_length=1, max_length=128)
    identity: str | None = Field(None, min_length=1, max_length=128)
    name: str | None = Field(None, min_length=1, max_length=128)


class LiveKitTokenOut(BaseModel):
    url: str
    room: str
    token: str


@router.post("/token", response_model=LiveKitTokenOut)
def create_room_token(
    body: LiveKitTokenIn,
    user: User = Depends(get_current_user),
) -> LiveKitTokenOut:
    s = get_settings()
    if not s.livekit_url or not s.livekit_api_key or not s.livekit_api_secret:
        raise HTTPException(
            500,
            "LiveKit is not configured. Set LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET on the API.",
        )
    if livekit_api is None:
        raise HTTPException(
            500,
            "Missing livekit-api dependency. Install it in the API environment.",
        )

    identity = body.identity or f"user-{user.id}"
    name = body.name or (user.name or user.email or identity)

    token = (
        livekit_api.AccessToken(s.livekit_api_key, s.livekit_api_secret)
        .with_identity(identity)
        .with_name(name)
        .with_ttl(timedelta(hours=6))
        .with_grants(
            livekit_api.VideoGrants(
                room_join=True,
                room=body.room,
                can_publish=True,
                can_subscribe=True,
                can_publish_data=True,
            )
        )
        .to_jwt()
    )

    return LiveKitTokenOut(url=s.livekit_url, room=body.room, token=token)

