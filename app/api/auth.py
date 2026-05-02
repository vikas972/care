from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.auth import TokenResponse
from app.services.crypto import encrypt_str
from app.services.google_oauth import authorization_url, exchange_code, userinfo_from_flow
from app.services.jwt_utils import (
    create_access_token,
    create_google_link_state,
    decode_google_link_state,
)

router = APIRouter(prefix="/auth/google", tags=["auth"])


@router.get("/login")
def google_login():
    url, _state = authorization_url()
    return RedirectResponse(url, status_code=302)


@router.get("/url")
def google_auth_url():
    """Return authorization URL for SPA or API clients."""
    url, state = authorization_url()
    return {"authorization_url": url, "state": state}


@router.get("/link-url")
def google_link_url(user: User = Depends(get_current_user)):
    """Google OAuth URL that links calendar access to the *current* user."""
    state = create_google_link_state(user.id)
    url, _ = authorization_url(state=state)
    return {"authorization_url": url, "state": state}


@router.get("/oauth-env")
def google_oauth_env():
    """Non-secret OAuth settings as seen by this API process (debug local redirect issues)."""
    s = get_settings()
    return {
        "google_redirect_uri": s.google_redirect_uri,
        "frontend_oauth_redirect_url": s.frontend_oauth_redirect_url or None,
    }


def _redirect_frontend(path_base: str, **params: str) -> RedirectResponse:
    q = "&".join(f"{k}={quote(v, safe='')}" for k, v in params.items() if v is not None)
    sep = "&" if "?" in path_base else "?"
    return RedirectResponse(f"{path_base.rstrip('/')}{sep}{q}", status_code=302)


@router.get("/callback")
def google_callback(
    code: str = Query(...),
    state: str | None = Query(None),
    db: Session = Depends(get_db),
):
    settings = get_settings()
    fe = (settings.frontend_oauth_redirect_url or "").strip()

    try:
        flow = exchange_code(code, state=state)
    except Exception as e:
        if fe:
            return _redirect_frontend(fe, error=f"oauth_exchange:{e}")
        raise HTTPException(400, f"OAuth exchange failed: {e}") from e

    try:
        email, name, sub = userinfo_from_flow(flow)
    except Exception as e:
        if fe:
            return _redirect_frontend(fe, error=f"userinfo:{e}")
        raise HTTPException(400, f"User info failed: {e}") from e

    creds = flow.credentials
    if not creds.refresh_token:
        msg = "No refresh token; revoke app access in Google and retry with prompt=consent"
        if fe:
            return _redirect_frontend(fe, error=msg)
        raise HTTPException(400, msg)

    link_user_id = decode_google_link_state(state or "") if state else None
    if link_user_id is not None:
        # Link Google Calendar to an existing (OTP) user
        user = db.get(User, link_user_id)
        if not user:
            raise HTTPException(400, "Link state user not found")
        # Prevent linking same Google account to multiple users
        existing = db.query(User).filter(User.google_sub == sub).one_or_none()
        if existing and existing.id != user.id:
            raise HTTPException(409, "This Google account is already linked to another user.")
        user.email = email
        user.name = name
        user.google_sub = sub
        user.google_refresh_token_encrypted = encrypt_str(creds.refresh_token)
    else:
        # Normal Google sign-in (creates or updates a Google user)
        user = db.query(User).filter(User.google_sub == sub).one_or_none()
        if user:
            user.email = email
            user.name = name
            user.google_refresh_token_encrypted = encrypt_str(creds.refresh_token)
        else:
            user = User(
                email=email,
                name=name,
                google_sub=sub,
                google_refresh_token_encrypted=encrypt_str(creds.refresh_token),
            )
            db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id)
    if fe:
        return _redirect_frontend(fe, access_token=token)
    return TokenResponse(access_token=token)
