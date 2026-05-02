from datetime import UTC, datetime, timedelta

from jose import JWTError, jwt

from app.config import get_settings


def create_access_token(user_id: int) -> str:
    s = get_settings()
    expire = datetime.now(UTC) + timedelta(minutes=s.jwt_expire_minutes)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, s.jwt_secret, algorithm=s.jwt_algorithm)


def create_google_link_state(user_id: int) -> str:
    """Short-lived signed state used to link Google OAuth to an existing user."""
    s = get_settings()
    expire = datetime.now(UTC) + timedelta(minutes=10)
    payload = {"sub": str(user_id), "exp": expire, "purpose": "google_link"}
    return jwt.encode(payload, s.jwt_secret, algorithm=s.jwt_algorithm)


def decode_google_link_state(state: str) -> int | None:
    s = get_settings()
    try:
        payload = jwt.decode(state, s.jwt_secret, algorithms=[s.jwt_algorithm])
        if payload.get("purpose") != "google_link":
            return None
        return int(payload["sub"])
    except Exception:
        return None


def decode_user_id(token: str) -> int:
    s = get_settings()
    try:
        payload = jwt.decode(token, s.jwt_secret, algorithms=[s.jwt_algorithm])
        return int(payload["sub"])
    except (JWTError, KeyError, ValueError) as e:
        raise ValueError("invalid token") from e
