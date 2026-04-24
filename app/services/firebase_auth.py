from functools import lru_cache

import firebase_admin
from firebase_admin import auth, credentials

from app.config import get_settings


@lru_cache
def _firebase_app() -> firebase_admin.App:
    s = get_settings()
    if not s.firebase_service_account_file.strip():
        raise RuntimeError("FIREBASE_SERVICE_ACCOUNT_FILE is not set")
    cred = credentials.Certificate(s.firebase_service_account_file.strip())
    return firebase_admin.initialize_app(cred)


def verify_firebase_id_token(id_token: str) -> dict:
    _firebase_app()
    return auth.verify_id_token(id_token, check_revoked=False)

