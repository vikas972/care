from pydantic import BaseModel


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserPublic(BaseModel):
    id: int
    email: str
    name: str | None
    has_phone: bool
    call_provider: str = "exotel"

    model_config = {"from_attributes": True}
