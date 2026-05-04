"""LiveKit session + SIP: verify Supabase JWT, load voice_agents from Supabase REST."""

from __future__ import annotations

import json
import logging
import re
import uuid
from datetime import timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from voice_bff.config import get_settings
from voice_bff.deps_supabase import get_supabase_user_sub
from voice_bff.services.supabase_voice_agents import fetch_voice_agent_row

logger = logging.getLogger(__name__)

try:
    from livekit import api as livekit_api
except Exception:  # pragma: no cover
    livekit_api = None

router = APIRouter(prefix="/voice/livekit", tags=["voice-livekit"])

_E164_RE = re.compile(r"^\+[1-9]\d{6,14}$")


def _livekit_rest_url(ws_or_http_url: str) -> str:
    u = ws_or_http_url.strip()
    if u.startswith("wss://"):
        return "https://" + u[len("wss://") :]
    if u.startswith("ws://"):
        return "http://" + u[len("ws://") :]
    return u


def _ensure_livekit_sdk() -> None:
    if livekit_api is None:
        raise HTTPException(
            500,
            "Missing livekit-api dependency. Install livekit-api in the API environment.",
        )


def _ensure_livekit_config() -> None:
    s = get_settings()
    if not s.livekit_url or not s.livekit_api_key or not s.livekit_api_secret:
        raise HTTPException(
            500,
            "LiveKit is not configured. Set LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET.",
        )


def _merge_dispatch_metadata(row: dict[str, Any], *, demo: bool) -> dict[str, Any]:
    job_meta = row.get("job_metadata")
    base: dict[str, Any]
    if isinstance(job_meta, dict):
        base = dict(job_meta)
    elif isinstance(job_meta, str) and job_meta.strip():
        try:
            parsed = json.loads(job_meta)
            base = dict(parsed) if isinstance(parsed, dict) else {}
        except json.JSONDecodeError:
            base = {}
    else:
        base = {}

    instr = row.get("instructions")
    if isinstance(instr, str) and instr.strip():
        base["instructions"] = instr.strip()

    opening = row.get("opening_script")
    if isinstance(opening, str) and opening.strip():
        base["opening_script"] = opening.strip()

    if demo:
        base["skip_opening"] = True

    return base


class DemoSessionIn(BaseModel):
    agent_id: str = Field(..., min_length=1, description="voice_agents.id UUID")


class DemoSessionOut(BaseModel):
    url: str
    room: str
    token: str


class OutboundIn(BaseModel):
    agent_id: str = Field(..., min_length=1)
    to_e164: str = Field(..., min_length=8, description="Destination E.164, e.g. +15551234567")
    room_name: str | None = Field(None, max_length=128)


class OutboundOut(BaseModel):
    room: str
    dispatch_id: str | None = None
    sip_participant_identity: str


@router.post("/demo-session", response_model=DemoSessionOut)
async def create_demo_session(
    body: DemoSessionIn,
    user_sub: str = Depends(get_supabase_user_sub),
) -> DemoSessionOut:
    _ensure_livekit_sdk()
    _ensure_livekit_config()
    s = get_settings()

    row = await fetch_voice_agent_row(settings=s, agent_id=body.agent_id, user_sub=user_sub)
    if not row:
        raise HTTPException(404, "Agent not found")

    agent_name = str(row.get("livekit_agent_name") or "").strip() or "my-agent"
    metadata_obj = _merge_dispatch_metadata(row, demo=True)
    metadata_raw = json.dumps(metadata_obj, separators=(",", ":"))

    room = f"demo-{uuid.uuid4().hex[:16]}"
    rest_url = _livekit_rest_url(s.livekit_url)

    try:
        async with livekit_api.LiveKitAPI(
            url=rest_url,
            api_key=s.livekit_api_key,
            api_secret=s.livekit_api_secret,
        ) as lkapi:
            dispatch = await lkapi.agent_dispatch.create_dispatch(
                livekit_api.CreateAgentDispatchRequest(
                    agent_name=agent_name,
                    room=room,
                    metadata=metadata_raw,
                )
            )
            logger.info(
                "demo dispatch agent=%s room=%s dispatch_id=%s user=%s",
                agent_name,
                room,
                getattr(dispatch, "id", None),
                user_sub,
            )

            identity = f"sb-{user_sub[:8]}-{uuid.uuid4().hex[:6]}"
            token = (
                livekit_api.AccessToken(s.livekit_api_key, s.livekit_api_secret)
                .with_identity(identity)
                .with_name("demo-user")
                .with_ttl(timedelta(hours=6))
                .with_grants(
                    livekit_api.VideoGrants(
                        room_join=True,
                        room=room,
                        can_publish=True,
                        can_subscribe=True,
                        can_publish_data=True,
                    )
                )
                .to_jwt()
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("LiveKit demo-session failed")
        raise HTTPException(502, f"LiveKit error: {e}") from e

    return DemoSessionOut(url=s.livekit_url, room=room, token=token)


@router.post("/outbound", response_model=OutboundOut)
async def start_outbound_call(
    body: OutboundIn,
    user_sub: str = Depends(get_supabase_user_sub),
) -> OutboundOut:
    _ensure_livekit_sdk()
    _ensure_livekit_config()
    s = get_settings()

    to = body.to_e164.strip()
    if not _E164_RE.match(to):
        raise HTTPException(400, "to_e164 must be E.164 (e.g. +15551234567)")

    trunk = (s.livekit_sip_outbound_trunk or "").strip()
    if not trunk:
        raise HTTPException(
            500,
            "SIP outbound trunk not configured. Set LIVEKIT_SIP_OUTBOUND_TRUNK.",
        )

    row = await fetch_voice_agent_row(settings=s, agent_id=body.agent_id, user_sub=user_sub)
    if not row:
        raise HTTPException(404, "Agent not found")

    agent_name = str(row.get("livekit_agent_name") or "").strip() or "my-agent"
    metadata_obj = _merge_dispatch_metadata(row, demo=False)
    metadata_raw = json.dumps(metadata_obj, separators=(",", ":"))

    room = (body.room_name or "").strip() or f"outbound-{uuid.uuid4().hex[:10]}"
    sip_number = (s.livekit_sip_number or "").strip() or None
    callee_identity = f"sip-callee-{uuid.uuid4().hex[:8]}"
    dispatch_id: str | None = None
    rest_url = _livekit_rest_url(s.livekit_url)

    try:
        async with livekit_api.LiveKitAPI(
            url=rest_url,
            api_key=s.livekit_api_key,
            api_secret=s.livekit_api_secret,
        ) as lkapi:
            dispatch = await lkapi.agent_dispatch.create_dispatch(
                livekit_api.CreateAgentDispatchRequest(
                    agent_name=agent_name,
                    room=room,
                    metadata=metadata_raw,
                )
            )
            dispatch_id = getattr(dispatch, "id", None)

            await lkapi.sip.create_sip_participant(
                livekit_api.CreateSIPParticipantRequest(
                    sip_trunk_id=trunk,
                    sip_call_to=to,
                    room_name=room,
                    participant_identity=callee_identity,
                    wait_until_answered=True,
                    sip_number=sip_number,
                )
            )

            logger.info(
                "outbound agent=%s room=%s to=%s dispatch_id=%s user=%s",
                agent_name,
                room,
                to,
                dispatch_id,
                user_sub,
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("LiveKit outbound failed")
        raise HTTPException(502, f"LiveKit error: {e}") from e

    return OutboundOut(
        room=room,
        dispatch_id=str(dispatch_id) if dispatch_id else None,
        sip_participant_identity=callee_identity,
    )
