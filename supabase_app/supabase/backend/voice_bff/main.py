import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from voice_bff.api.voice_livekit import router as voice_livekit_router
from voice_bff.config import get_settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("voice_bff")

_settings = get_settings()
_origins = [o.strip() for o in _settings.cors_origins.split(",") if o.strip()]

app = FastAPI(title="Voice Studio BFF", version="0.1.0", description="Supabase JWT + LiveKit demo/outbound only.")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins or ["http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(voice_livekit_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
