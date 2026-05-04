from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_base_url: str = "http://localhost:8000"
    # Comma-separated origins for browser/Swagger + demo UI (Vite default :5173)
    cors_origins: str = (
        "http://localhost:8000,http://127.0.0.1:8000,"
        "http://localhost:5173,http://127.0.0.1:5173,"
        "http://localhost:5174,http://127.0.0.1:5174"
    )
    # If set, /auth/google/callback redirects here with ?access_token=... (for SPA demo)
    frontend_oauth_redirect_url: str = ""
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7

    encryption_key: str = ""

    database_url: str = "postgresql+psycopg2://smartcall:smartcall@localhost:5432/smartcall"

    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "redis://localhost:6379/0"
    celery_result_backend: str = "redis://localhost:6379/0"

    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = ""

    exotel_api_key: str = ""
    exotel_api_token: str = ""
    exotel_account_sid: str = ""
    exotel_subdomain: str = ""
    exotel_caller_id: str = ""
    exotel_flow_url: str = ""
    exotel_webhook_secret: str = ""
    exotel_dry_run: bool = False

    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_from_number: str = ""
    twilio_dry_run: bool = False
    # Public base URL Twilio uses to hit webhooks (e.g. https://your-ngrok.app). Defaults to APP_BASE_URL.
    twilio_webhook_public_url: str = ""
    twilio_validate_webhook_signatures: bool = True

    # LiveKit (for browser voice UI tokens)
    livekit_url: str = ""
    livekit_api_key: str = ""
    livekit_api_secret: str = ""
    # Firebase (phone OTP login)
    # Path to a Firebase service account JSON file. Required for verifying Firebase ID tokens.
    firebase_service_account_file: str = ""

    calendar_reminder_minutes_before: int = 15
    # Number of retry attempts after the initial call. 1 => at most 2 total calls.
    call_retry_max: int = 1
    call_retry_delay_seconds: int = 120
    sweep_interval_seconds: int = 30


@lru_cache
def get_settings() -> Settings:
    return Settings()
