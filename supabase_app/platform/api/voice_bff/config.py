from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_BACKEND_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_base_url: str = "http://localhost:8001"
    cors_origins: str = (
        "http://localhost:8001,http://127.0.0.1:8001,"
        "http://localhost:5174,http://127.0.0.1:5174,"
        "http://localhost:5173,http://127.0.0.1:5173"
    )

    livekit_url: str = ""
    livekit_api_key: str = ""
    livekit_api_secret: str = ""
    livekit_sip_outbound_trunk: str = ""
    livekit_sip_number: str = ""

    supabase_url: str = ""
    supabase_jwt_secret: str = ""
    supabase_jwt_issuer: str = ""
    supabase_service_role_key: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
