"""Decode Supabase Auth access tokens (HS256 or JWKS asymmetric)."""

from __future__ import annotations

import jwt
from jwt import PyJWKClient
from jwt.exceptions import PyJWTError

from voice_bff.config import Settings

_ALLOWED_ASYM = frozenset({"RS256", "RS384", "ES256", "ES384", "EdDSA"})


def decode_supabase_access_token_sub(token: str, settings: Settings) -> str:
    try:
        header = jwt.get_unverified_header(token)
    except PyJWTError as e:
        raise ValueError(f"Invalid JWT format: {e}") from e

    alg = header.get("alg") or "HS256"
    expected_iss = (settings.supabase_jwt_issuer or "").strip()

    decode_opts_aud_strict = {"verify_aud": True}
    decode_opts_aud_off = {"verify_aud": False}

    payload: dict

    if alg == "HS256":
        secret = (settings.supabase_jwt_secret or "").strip()
        if not secret:
            raise ValueError("SUPABASE_JWT_SECRET is not configured (required for HS256 tokens)")
        issuer_kw: dict = {}
        if expected_iss:
            issuer_kw["issuer"] = expected_iss
        try:
            payload = jwt.decode(
                token,
                secret,
                algorithms=["HS256"],
                audience="authenticated",
                options=decode_opts_aud_strict,
                **issuer_kw,
            )
        except PyJWTError:
            payload = jwt.decode(
                token,
                secret,
                algorithms=["HS256"],
                options=decode_opts_aud_off,
                **issuer_kw,
            )
    elif alg in _ALLOWED_ASYM:
        base = (settings.supabase_url or "").strip().rstrip("/")
        if not base:
            raise ValueError(
                "SUPABASE_URL is not configured (required to verify ES256/RS256 Supabase JWTs via JWKS)"
            )
        jwks_url = f"{base}/auth/v1/.well-known/jwks.json"
        try:
            jwks_client = PyJWKClient(jwks_url)
            signing_key = jwks_client.get_signing_key_from_jwt(token)
        except PyJWTError as e:
            raise ValueError(f"JWKS verification setup failed: {e}") from e

        issuer_kw = {}
        if expected_iss:
            issuer_kw["issuer"] = expected_iss

        try:
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=[alg],
                audience="authenticated",
                options=decode_opts_aud_strict,
                **issuer_kw,
            )
        except PyJWTError:
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=[alg],
                options=decode_opts_aud_off,
                **issuer_kw,
            )
    else:
        raise ValueError(
            f"Unsupported JWT algorithm {alg!r}. Configure Supabase signing or update allowed algorithms."
        )

    sub = payload.get("sub")
    if not sub:
        raise ValueError("token missing sub")

    iss = payload.get("iss")
    if expected_iss and iss and iss.rstrip("/") != expected_iss.rstrip("/"):
        raise ValueError("token issuer mismatch")

    return str(sub)
