from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from voice_bff.config import get_settings
from voice_bff.services.supabase_jwt import decode_supabase_access_token_sub

security = HTTPBearer(auto_error=False)


def get_supabase_user_sub(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
) -> str:
    if creds is None or creds.scheme.lower() != "bearer":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    try:
        return decode_supabase_access_token_sub(creds.credentials, get_settings())
    except ValueError as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, str(e)) from e
