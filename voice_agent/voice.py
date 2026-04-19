import os
import sys
import tempfile
import threading

import numpy as np
import whisper
from dotenv import load_dotenv
from google import genai
import sounddevice as sd
import soundfile as sf
import pyttsx3

load_dotenv()


def _get_env(*names: str) -> str:
    for name in names:
        value = os.getenv(name)
        if value:
            return value
    raise RuntimeError(f"Missing required env var. Set one of: {', '.join(names)}")


# --- Load Whisper model ---
stt_model = whisper.load_model("base")

# --- Gemini setup ---
genai_client = genai.Client(api_key=_get_env("GEMINI_API_KEY", "GOOGLE_GEMINI_API_KEY", "GOOGLE_API_KEY"))
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "models/gemini-2.0-flash")
ASSISTANT_INSTRUCTION = os.getenv(
    "ASSISTANT_INSTRUCTION",
    "You are a voice assistant. Answer only what the user is asking. "
    "Be concise and direct. If the request is unclear, ask a single short clarifying question. "
    "Do not add extra suggestions or unrelated information.",
)

# --- Local TTS setup (offline, free) ---
tts_engine = pyttsx3.init()
TTS_ENABLED = os.getenv("TTS_ENABLED", "1").lower() not in {"0", "false", "no", "off"}
_tts_thread: threading.Thread | None = None


def transcribe(audio_input):
    result = stt_model.transcribe(audio_input)
    return result["text"]


def record_to_wav(seconds: float = 5.0, sample_rate: int = 16000) -> str:
    recording = sd.rec(int(seconds * sample_rate), samplerate=sample_rate, channels=1, dtype="float32")
    sd.wait()
    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    tmp.close()
    sf.write(tmp.name, recording, sample_rate)
    return tmp.name


def record_audio(seconds: float = 5.0, sample_rate: int = 16000) -> np.ndarray:
    recording = sd.rec(int(seconds * sample_rate), samplerate=sample_rate, channels=1, dtype="float32")
    sd.wait()
    return recording.reshape(-1)


def _build_prompt_with_history(user_text: str, history: list[dict] | None) -> str:
    history = history or []
    parts = [ASSISTANT_INSTRUCTION, "", "Conversation so far:"]
    for m in history:
        label = "User" if m.get("role") == "user" else "Assistant"
        parts.append(f"{label}: {m.get('content', '')}")
    parts.extend(["", f"User: {user_text}", "", "Assistant:"])
    return "\n".join(parts)


def get_response(user_text: str, history: list[dict] | None = None) -> str:
    prompt = _build_prompt_with_history(user_text, history)
    response = genai_client.models.generate_content(model=GEMINI_MODEL, contents=prompt)
    return getattr(response, "text", None) or str(response)


def speak(text: str) -> None:
    if not TTS_ENABLED:
        return

    def _run() -> None:
        try:
            tts_engine.say(text)
            tts_engine.runAndWait()
        except Exception:
            pass

    global _tts_thread
    t = threading.Thread(target=_run, daemon=True)
    _tts_thread = t
    t.start()


def stop_speaking() -> None:
    try:
        tts_engine.stop()
    except Exception:
        pass


def voice_agent(audio_file):
    user_text = transcribe(audio_file)
    print("User:", user_text)

    reply = get_response(user_text, history=None)
    print("AI:", reply)

    speak(reply)


if __name__ == "__main__":
    if len(sys.argv) >= 2 and sys.argv[1] == "--mic":
        seconds = float(os.getenv("MIC_SECONDS", "5"))
        print("Mic mode. Press Ctrl+C to exit.")
        while True:
            input(f"\nPress Enter to record {seconds}s...")
            audio = record_audio(seconds=seconds)
            user_text = transcribe(audio)
            print("User:", user_text)

            reply = get_response(user_text, history=None)
            print("AI:", reply)

            speak(reply)
    else:
        if len(sys.argv) != 2:
            raise SystemExit("Usage: python voice.py /path/to/audio.(wav|mp3|m4a)  OR  python voice.py --mic")
        voice_agent(sys.argv[1])
