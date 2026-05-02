import json
import logging

from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    JobContext,
    JobProcess,
    cli,
    inference,
    room_io,
)
from livekit.plugins import ai_coustics, silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel

logger = logging.getLogger("agent")

load_dotenv(".env.local")
load_dotenv(".env")

# Faster default for voice latency (swap if you need stronger reasoning).
AGENT_MODEL = "openai/gpt-4.1-mini"

# Default outbound phone flow: short hello first, then substance (see _run_outbound_opening).
OUTBOUND_GREETING = (
    "Hi Gaurav, I am Vikas's AI assistant. Hope this is a good time."
)
OUTBOUND_BODY = (
    "Quick question, are you free today for a meeting? "
    "Would you rather meet in person or online?"
    "What time today works best for you?"
)


class Assistant(Agent):
    def __init__(self) -> None:
        super().__init__(
            instructions="""You are Vikas's AI assistant on a phone call. Short plain sentences. No emojis or markdown.

            After the opening, listen and reply briefly and naturally""",
        )


server = AgentServer()


def prewarm(proc: JobProcess):
    proc.userdata["vad"] = silero.VAD.load()


server.setup_fnc = prewarm


async def _run_outbound_opening(session: AgentSession, payload: dict) -> None:
    if payload.get("skip_opening"):
        return

    custom = str(payload.get("opening_script") or "").strip()
    two_step = payload.get("two_step", True)

    if custom and not two_step:
        session.generate_reply(
            instructions=(
                "The callee just answered. Speak in a natural phone-call tone, not like reading a document. "
                "Keep a friendly pace. One flow, a few short sentences.\n\n"
                + custom
            ),
            allow_interruptions=True,
        )
        return

    if not two_step and not custom:
        session.generate_reply(
            instructions=(
                "The callee just answered. Natural phone-call tone, one short flow, not like reading a list.\n\n"
                + OUTBOUND_GREETING
                + " "
                + OUTBOUND_BODY
            ),
            allow_interruptions=True,
        )
        return

    body = custom if custom else OUTBOUND_BODY

    h = session.generate_reply(
        instructions=(
            "The callee just answered. Say ONLY this as the very first thing, warm and brief, nothing else: "
            + OUTBOUND_GREETING
        ),
        allow_interruptions=False,
    )
    await h.wait_for_playout()
    session.generate_reply(
        instructions=(
            "Continue like a normal phone call. Do not repeat the greeting. "
            "Sound conversational, not like reading bullet points. Two or three short sentences max.\n\n"
            + body
        ),
        allow_interruptions=True,
    )


@server.rtc_session(agent_name="my-agent")
async def my_agent(ctx: JobContext):
    ctx.log_context_fields = {
        "room": ctx.room.name,
    }

    session = AgentSession(
        stt=inference.STT(model="deepgram/nova-3", language="multi"),
        llm=inference.LLM(model=AGENT_MODEL),
        tts=inference.TTS(
            model="cartesia/sonic-3", voice="9626c31c-bec5-4cca-baa8-f8ba9e84c8bc"
        ),
        turn_detection=MultilingualModel(),
        vad=ctx.proc.userdata["vad"],
        preemptive_generation=True,
    )

    await session.start(
        agent=Assistant(),
        room=ctx.room,
        room_options=room_io.RoomOptions(
            audio_input=room_io.AudioInputOptions(
                noise_cancellation=ai_coustics.audio_enhancement(
                    model=ai_coustics.EnhancerModel.QUAIL_VF_L
                ),
            ),
        ),
    )

    await ctx.connect()

    md = (ctx.job.metadata or "").strip()
    payload: dict = {}
    if md:
        try:
            payload = json.loads(md)
        except json.JSONDecodeError:
            payload = {"opening_script": md}

    user_name = str(payload.get("user_name") or "").strip()
    opening_question = str(payload.get("opening_question") or "").strip()
    if not payload.get("opening_script") and (user_name or opening_question):
        parts: list[str] = []
        if user_name:
            parts.append(f"Hi {user_name}.")
        if opening_question:
            parts.append(opening_question)
        parts.append("What time today works best for you?")
        payload["opening_script"] = " ".join(p for p in parts if p).strip()
        payload.setdefault("two_step", False)

    await _run_outbound_opening(session, payload)


if __name__ == "__main__":
    cli.run_app(server)
