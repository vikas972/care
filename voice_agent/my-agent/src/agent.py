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
DEFAULT_STT_MODEL = "deepgram/nova-3"
DEFAULT_STT_LANGUAGE = "multi"
DEFAULT_TTS_MODEL = "cartesia/sonic-3"
DEFAULT_TTS_VOICE = "9626c31c-bec5-4cca-baa8-f8ba9e84c8bc"

DEFAULT_INSTRUCTIONS = """You are Vikas's AI assistant on a phone call. Short plain sentences. No emojis or markdown.

After the opening, listen and reply briefly and naturally"""


def inference_models_from_job_payload(payload: dict) -> tuple[str, str, str, str]:
    """Return (stt_model, llm_model, tts_model, tts_voice) from dispatch metadata."""
    stt = str(payload.get("stt_model") or DEFAULT_STT_MODEL).strip() or DEFAULT_STT_MODEL
    llm = str(payload.get("llm_model") or AGENT_MODEL).strip() or AGENT_MODEL
    tts = str(payload.get("tts_model") or DEFAULT_TTS_MODEL).strip() or DEFAULT_TTS_MODEL
    voice = str(payload.get("tts_voice") or DEFAULT_TTS_VOICE).strip() or DEFAULT_TTS_VOICE
    return stt, llm, tts, voice


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
    def __init__(self, instructions: str | None = None) -> None:
        super().__init__(instructions=instructions or DEFAULT_INSTRUCTIONS)


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

    stt_model, llm_model, tts_model, tts_voice = inference_models_from_job_payload(payload)
    stt_language = str(payload.get("stt_language") or DEFAULT_STT_LANGUAGE).strip() or DEFAULT_STT_LANGUAGE
    instructions = str(payload.get("instructions") or "").strip() or DEFAULT_INSTRUCTIONS

    session = AgentSession(
        stt=inference.STT(model=stt_model, language=stt_language),
        llm=inference.LLM(model=llm_model),
        tts=inference.TTS(model=tts_model, voice=tts_voice),
        turn_detection=MultilingualModel(),
        vad=ctx.proc.userdata["vad"],
        preemptive_generation=True,
    )

    await session.start(
        agent=Assistant(instructions=instructions),
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

    await _run_outbound_opening(session, payload)


if __name__ == "__main__":
    cli.run_app(server)
