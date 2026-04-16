"""Set env before any app imports; create SQLite schema for in-memory DB."""

import os

from cryptography.fernet import Fernet

os.environ.setdefault("ENCRYPTION_KEY", Fernet.generate_key().decode())
os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("JWT_SECRET", "test-jwt-secret-for-pytest-only")
os.environ.setdefault("GOOGLE_CLIENT_ID", "test-client-id")
os.environ.setdefault("GOOGLE_CLIENT_SECRET", "test-client-secret")
os.environ.setdefault("GOOGLE_REDIRECT_URI", "http://127.0.0.1:8000/auth/google/callback")
os.environ.setdefault("CELERY_BROKER_URL", "memory://")
os.environ.setdefault("CELERY_RESULT_BACKEND", "cache+memory://")
os.environ.setdefault("EXOTEL_WEBHOOK_SECRET", "test-wh-secret")

from app.database import Base, engine  # noqa: E402
from app.models import CalendarEvent, CallLog, MedicineReminder, User  # noqa: F401, E402

Base.metadata.create_all(bind=engine)
