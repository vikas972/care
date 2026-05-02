from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build

from app.config import get_settings


SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/calendar.readonly",
]


def build_oauth_flow(state: str | None = None) -> Flow:
    s = get_settings()
    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": s.google_client_id,
                "client_secret": s.google_client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [s.google_redirect_uri],
            }
        },
        scopes=SCOPES,
        state=state,
        # PKCE verifier lives on the Flow that built the auth URL; we use a new
        # Flow on callback, so without persisting the verifier Google returns
        # invalid_grant / missing code verifier. Confidential web clients may
        # use client_secret without PKCE.
        autogenerate_code_verifier=False,
    )
    flow.redirect_uri = s.google_redirect_uri
    return flow


def authorization_url(*, state: str | None = None) -> tuple[str, str]:
    flow = build_oauth_flow(state=state)
    url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )
    return url, state


def exchange_code(code: str, state: str | None = None) -> Flow:
    flow = build_oauth_flow(state=state)
    flow.fetch_token(code=code)
    return flow


def credentials_from_refresh(refresh_token: str) -> Credentials:
    s = get_settings()
    return Credentials(
        token=None,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=s.google_client_id,
        client_secret=s.google_client_secret,
        scopes=SCOPES,
    )


def build_calendar_service(creds: Credentials):
    return build("calendar", "v3", credentials=creds, cache_discovery=False)


def userinfo_from_flow(flow: Flow) -> tuple[str, str | None, str]:
    creds = flow.credentials
    if not isinstance(creds, Credentials):
        raise TypeError("expected Credentials")
    import google.auth.transport.requests

    creds.refresh(google.auth.transport.requests.Request())
    import httpx

    r = httpx.get(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        headers={"Authorization": f"Bearer {creds.token}"},
        timeout=30.0,
    )
    r.raise_for_status()
    data = r.json()
    return data["email"], data.get("name"), data["sub"]
