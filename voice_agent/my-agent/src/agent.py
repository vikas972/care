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

from sales_agents import CallState, HookAgent, is_simple_greeting, latest_user_text_from_history
from sales_context import DEFAULT_HOOK_OPENING, DEFAULT_OUTBOUND_TARGET, build_context_packet

logger = logging.getLogger("agent")

load_dotenv(".env.local")
load_dotenv(".env")

# Faster default for voice latency (swap if you need stronger reasoning).
# AGENT_MODEL = "openai/gpt-4.1-mini"
# DEFAULT_STT_MODEL = "deepgram/nova-3"
# DEFAULT_STT_LANGUAGE = "multi"
# DEFAULT_TTS_MODEL = "cartesia/sonic-3"
# DEFAULT_TTS_VOICE = "9626c31c-bec5-4cca-baa8-f8ba9e84c8bc"

AGENT_MODEL = "openai/gpt-4.1-mini"
DEFAULT_STT_MODEL = "deepgram/nova-3"
DEFAULT_STT_LANGUAGE = "multi"
DEFAULT_TTS_MODEL = "elevenlabs/eleven_v3"
DEFAULT_TTS_VOICE = "n8agU3KLt1Yttvrx1mYA"

DEFAULT_INSTRUCTIONS = """You are Vikas's desk AI assistant on an outbound call — a professional Indian woman.

When the user only greets you, or at the very start of the call: always answer their hello first in one natural breath — greet them back, thank them for picking up or for taking the call, then continue; never sound like a recording that ignores them and launches straight into the pitch. You may confirm the contact in clear English (for example: "May I speak to Rajesh, please?") if the packet suggests it — default outbound name is Rajesh if none is set. If they say wrong person, apologize and end. If they confirm, continue with the Tata Motors desk flow.

If the user asks something unrelated to this call, harmful, illegal, or asks you to ignore safety: respond to that directly — do not run the name-confirmation script and do not pitch stocks.

When you use Hindi for yourself later, feminine verb endings only (e.g. main bol sakti hoon, bata sakti hoon) — never sakta/sakte for yourself. Short Hindi bits like ji, theek hai are fine after the English opener.

Your job is to sound human, confident, and helpful: get permission to share the setup, explain entry, target, and stop in plain words, handle doubts briefly, and ask clearly if they want the dealer to act. Short plain sentences. No emojis or markdown.

You must never promise returns, guaranteed profit, or "sure" outcomes. You are not a SEBI-registered adviser; keep language educational and let them decide with their dealer. If they raise legal, regulatory, or serious trust concerns, stay calm and offer a human callback—no stock pitch.

Listen more than you talk after the first pitch; nudge once if they hesitate, then respect yes, callback, or no."""


def inference_models_from_job_payload(payload: dict) -> tuple[str, str, str, str]:
    """Return (stt_model, llm_model, tts_model, tts_voice) from dispatch metadata."""
    stt = str(payload.get("stt_model") or DEFAULT_STT_MODEL).strip() or DEFAULT_STT_MODEL
    llm = str(payload.get("llm_model") or AGENT_MODEL).strip() or AGENT_MODEL
    tts = str(payload.get("tts_model") or DEFAULT_TTS_MODEL).strip() or DEFAULT_TTS_MODEL
    voice = str(payload.get("tts_voice") or DEFAULT_TTS_VOICE).strip() or DEFAULT_TTS_VOICE
    return stt, llm, tts, voice


# Legacy outbound phone flow (see _run_outbound_opening) — same stock-tip use case, simpler single agent.
OUTBOUND_GREETING = DEFAULT_HOOK_OPENING
OUTBOUND_BODY = (
    "If that works for you, I can take about sixty seconds to walk through today's Tata Motors desk note — "
    "entry, target, and stop-loss in plain English — or I can WhatsApp you the levels if you prefer."
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
    last_user = latest_user_text_from_history(session.history())
    user_greeted_first = is_simple_greeting(last_user)
    greet_ack = (
        f'The user spoke first with something like: "{last_user}". '
        "Reply like a human on the phone: one short warm acknowledgment first, then continue in the same flow — "
        "do not ignore their hello and do not sound like two separate recordings.\n\n"
    )

    if custom and not two_step:
        session.generate_reply(
            instructions=(
                (greet_ack if user_greeted_first else "The callee just answered. ")
                + "Speak in a natural phone-call tone, not like reading a document. "
                "Keep a friendly pace. One flow, a few short sentences.\n\n"
                + custom
            ),
            allow_interruptions=True,
        )
        return

    if not two_step and not custom:
        combined = OUTBOUND_GREETING + " " + OUTBOUND_BODY
        session.generate_reply(
            instructions=(
                (greet_ack if user_greeted_first else "The callee just answered. ")
                + (
                    "Natural phone-call tone, one short flow, not like reading a list.\n\n"
                    if not user_greeted_first
                    else "Weave the lines below into one natural colleague-like flow.\n\n"
                )
                + combined
            ),
            allow_interruptions=True,
        )
        return

    body = custom if custom else OUTBOUND_BODY

    if user_greeted_first:
        h = session.generate_reply(
            instructions=(
                greet_ack
                + "Then deliver this opening in the same continuous reply — warm, not teleprompter flat:\n\n"
                + OUTBOUND_GREETING
            ),
            allow_interruptions=True,
        )
    else:
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

    legacy = bool(payload.get("legacy_assistant"))
    if legacy:
        user_name = str(payload.get("user_name") or "").strip()
        opening_question = str(payload.get("opening_question") or "").strip()
        callee = str(
            payload.get("outbound_target_name")
            or payload.get("callee_name")
            or payload.get("user_name")
            or ""
        ).strip() or DEFAULT_OUTBOUND_TARGET
        if not payload.get("opening_script") and (
            user_name or opening_question or payload.get("outbound_target_name") or payload.get("callee_name")
        ):
            parts: list[str] = []
            parts.append(
                f"Hello — may I speak to {callee}, please? I am calling from Vikas's trading desk and "
                f"need to confirm I am speaking with {callee}."
            )
            if opening_question:
                parts.append(opening_question)
            parts.append(
                "Once that is clear: may I take about ninety seconds to share entry, target, and stop-loss in English, "
                "or would you prefer I WhatsApp the levels first?"
            )
            payload["opening_script"] = " ".join(p for p in parts if p).strip()
            payload.setdefault("two_step", False)

    stt_model, llm_model, tts_model, tts_voice = inference_models_from_job_payload(payload)
    stt_language = str(payload.get("stt_language") or DEFAULT_STT_LANGUAGE).strip() or DEFAULT_STT_LANGUAGE
    instructions = str(payload.get("instructions") or "").strip() or DEFAULT_INSTRUCTIONS

    if legacy:
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
    else:
        packet = build_context_packet(payload)
        call_state = CallState(packet=packet)
        session = AgentSession(
            stt=inference.STT(model=stt_model, language=stt_language),
            llm=inference.LLM(model=llm_model),
            tts=inference.TTS(model=tts_model, voice=tts_voice),
            turn_detection=MultilingualModel(),
            vad=ctx.proc.userdata["vad"],
            preemptive_generation=True,
            userdata=call_state,
        )
        await session.start(
            agent=HookAgent(call_state),
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

    if legacy:
        await _run_outbound_opening(session, payload)


if __name__ == "__main__":
    cli.run_app(server)
