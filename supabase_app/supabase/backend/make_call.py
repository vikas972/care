"""Dial out via LiveKit SIP and dispatch your explicit agent into the same room.

Dial-out settings only live here. What the agent says first lives in
src/agent.py (DEFAULT_OUTBOUND_OPENING_SCRIPT), unless you override with JSON metadata below.

Run:
  uv run python make-call.py

Optional override: set DISPATCH_METADATA_RAW to JSON, for example:
  {"opening_script": "Hi. Custom opener."}
  {"skip_opening": true}

Credentials: LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET and optionally
LIVEKIT_SIP_OUTBOUND_TRUNK in .env.local / .env next to this script.
"""

from __future__ import annotations

import asyncio
import os
import uuid
from pathlib import Path

from dotenv import load_dotenv
from livekit import api

_ROOT = Path(__file__).resolve().parent

# =============================================================================
# Dial-out only — edit the opener in src/agent.py unless you use RAW metadata.
# =============================================================================
CALL_TO = "+919136509352"  # E.164 destination number

ROOM_NAME = "vikas-call"  # empty → random room name outbound-<suffix>

SIP_OUTBOUND_TRUNK_ID = ""

SIP_CALLER_NUMBER = ""

PARTICIPANT_IDENTITY = ""

AGENT_NAME = "my-agent"

# Empty → agent uses DEFAULT_OUTBOUND_OPENING_SCRIPT from agent.py
DISPATCH_METADATA_RAW = ""

WAIT_UNTIL_ANSWERED = True
# =============================================================================


def _random_room() -> str:
    return f"outbound-{uuid.uuid4().hex[:10]}"


def _dispatch_metadata() -> str:
    raw = DISPATCH_METADATA_RAW.strip()
    return raw if raw else "{}"


async def main() -> None:
    load_dotenv(_ROOT / ".env.local")
    load_dotenv(_ROOT / ".env")

    room = ROOM_NAME.strip() or _random_room()
    trunk_id = (SIP_OUTBOUND_TRUNK_ID.strip() or os.getenv("LIVEKIT_SIP_OUTBOUND_TRUNK", "")).strip()
    if not trunk_id:
        raise SystemExit("Set SIP_OUTBOUND_TRUNK_ID above or LIVEKIT_SIP_OUTBOUND_TRUNK in .env.local")

    if not CALL_TO.strip():
        raise SystemExit("Set CALL_TO to the destination E.164 number")

    sip_number = (SIP_CALLER_NUMBER.strip() or os.getenv("LIVEKIT_SIP_NUMBER", "")).strip() or None
    callee_identity = PARTICIPANT_IDENTITY.strip() or f"sip-callee-{uuid.uuid4().hex[:8]}"
    metadata = _dispatch_metadata()

    async with api.LiveKitAPI() as lkapi:
        dispatch = await lkapi.agent_dispatch.create_dispatch(
            api.CreateAgentDispatchRequest(
                agent_name=AGENT_NAME,
                room=room,
                metadata=metadata,
            )
        )
        print(f"dispatched agent={AGENT_NAME} room={room} dispatch_id={dispatch.id}")

        print(
            "dial params "
            f"trunk_id={trunk_id} "
            f"to={CALL_TO.strip()} "
            f"sip_number={sip_number or '<unset>'} "
            f"room={room} "
            f"identity={callee_identity}"
        )

        sip_info = await lkapi.sip.create_sip_participant(
            api.CreateSIPParticipantRequest(
                sip_trunk_id=trunk_id,
                sip_call_to=CALL_TO.strip(),
                room_name=room,
                participant_identity=callee_identity,
                wait_until_answered=WAIT_UNTIL_ANSWERED,
                sip_number=sip_number,
            )
        )
        print(f"created sip participant identity={callee_identity}")
        print(sip_info)


if __name__ == "__main__":
    asyncio.run(main())
