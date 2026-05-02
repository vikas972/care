import logging

from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    JobContext,
    JobProcess,
    cli,
    room_io,
)
from livekit.plugins import deepgram, google, silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel

logger = logging.getLogger("agent")

load_dotenv(".env.local")
load_dotenv(".env")

# Use gemini-2.0-flash for lower latency; if your project rejects it, use gemini-2.5-flash.
AGENT_MODEL = "gemini-2.0-flash"


class Assistant(Agent):
    def __init__(self) -> None:
        super().__init__(
            instructions="""You are Vikas's AI assistant. Replies must be short for voice.
            When you first greet someone, briefly say you are Vikas's AI assistant.

            Language: If the user speaks Hindi, answer mainly in Hindi with simple, natural spoken phrasing.
            If they speak English, answer in English. If they mix Hinglish, follow their lead. Ask once which they prefer if unclear.

            No emojis, bullets, asterisks, or markdown.""",
        )


server = AgentServer()


def prewarm(proc: JobProcess):
    proc.userdata["vad"] = silero.VAD.load()


server.setup_fnc = prewarm


@server.rtc_session(agent_name="care")
async def my_agent(ctx: JobContext):
    ctx.log_context_fields = {
        "room": ctx.room.name,
    }

    # Latency: multi STT for Hindi+English, flash LLM, no extra NC plugin on input path.
    session = AgentSession(
        stt=deepgram.STT(model="nova-3", language="multi"),
        llm=google.LLM(model=AGENT_MODEL),
        tts=google.beta.GeminiTTS(
            model="gemini-2.5-flash-preview-tts",
            voice_name="Kore",
        ),
        turn_detection=MultilingualModel(),
        turn_handling={
            "interruption": {
                "mode": "vad",
            }
        },
        vad=ctx.proc.userdata["vad"],
        preemptive_generation=True,
    )

    await session.start(
        agent=Assistant(),
        room=ctx.room,
        room_options=room_io.RoomOptions(
            audio_input=room_io.AudioInputOptions(
                noise_cancellation=None,
            ),
        ),
    )

    await ctx.connect()


if __name__ == "__main__":
    cli.run_app(server)
