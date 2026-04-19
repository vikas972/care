import os
import sys
from pathlib import Path

import gradio as gr
import numpy as np

_root = Path(__file__).resolve().parents[1]
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

from voice import get_response, speak, stop_speaking, transcribe


def _resample_to_16k(data: np.ndarray, sample_rate: int) -> np.ndarray:
    if sample_rate == 16000:
        return data
    if sample_rate <= 0:
        raise RuntimeError(f"Invalid sample rate: {sample_rate}")
    src_len = data.shape[0]
    if src_len == 0:
        return data
    target_len = int(round(src_len * (16000 / sample_rate)))
    if target_len <= 1:
        return data[:0]
    x_old = np.linspace(0.0, 1.0, num=src_len, endpoint=False, dtype=np.float32)
    x_new = np.linspace(0.0, 1.0, num=target_len, endpoint=False, dtype=np.float32)
    return np.interp(x_new, x_old, data).astype(np.float32)


def _normalize_audio(audio: tuple[int, np.ndarray]) -> np.ndarray:
    sample_rate, data = audio
    if data.ndim > 1:
        data = data.mean(axis=1)
    data = data.astype(np.float32)
    peak = float(np.max(np.abs(data))) if data.size else 0.0
    if peak > 0:
        data = data / peak
    return _resample_to_16k(data, sample_rate)


def _audio_nonempty(mic_audio) -> bool:
    if mic_audio is None:
        return False
    _, data = mic_audio
    if data is None:
        return False
    arr = np.asarray(data)
    return arr.size > 0 and float(np.max(np.abs(arr))) > 1e-6


def _format_transcript(msgs: list) -> str:
    if not msgs:
        return ""
    lines = []
    for m in msgs:
        role = m.get("role", "")
        content = (m.get("content") or "").strip()
        if role == "user":
            lines.append(f"You: {content}")
        else:
            lines.append(f"Assistant: {content}")
    return "\n\n".join(lines)


def _run_turn(mic_audio, history: list):
    audio = _normalize_audio(mic_audio)
    user_text = transcribe(audio)
    prior = list(history or [])
    ai_text = get_response(user_text, history=prior)
    speak(ai_text)

    msgs = prior + [
        {"role": "user", "content": user_text},
        {"role": "assistant", "content": ai_text},
    ]
    transcript = _format_transcript(msgs)
    return msgs, transcript, gr.update(value=None), False


def _arm_recording():
    return gr.update(value=None), True


def main():
    with gr.Blocks(title="AI Assistant") as demo:
        gr.Markdown("## AI Assistant")
        chat = gr.Chatbot(label="Conversation", height=360)
        transcript = gr.Textbox(
            label="Transcription (you + assistant)",
            lines=14,
        )
        armed = gr.State(False)
        history = gr.State([])

        with gr.Row():
            start_btn = gr.Button("Start recording")
            stop_speech_btn = gr.Button("Stop speaking")

        mic = gr.Audio(sources=["microphone"], type="numpy", label="Click Start, then record — Stop ends the clip and the assistant replies")

        start_btn.click(_arm_recording, outputs=[mic, armed])
        stop_speech_btn.click(stop_speaking, inputs=None, outputs=None)

        def _on_mic_change(mic_audio, history_val, armed_val, transcript_val):
            if not armed_val:
                return history_val, transcript_val, history_val, gr.update(), armed_val
            if mic_audio is None or not _audio_nonempty(mic_audio):
                return history_val, transcript_val, history_val, gr.update(), armed_val

            new_msgs, text, mic_clear, new_armed = _run_turn(mic_audio, history_val)
            return new_msgs, text, new_msgs, mic_clear, new_armed

        mic.change(
            _on_mic_change,
            inputs=[mic, history, armed, transcript],
            outputs=[history, transcript, chat, mic, armed],
        )

    demo.launch(
        server_name=os.getenv("VOICE_UI_HOST", "127.0.0.1"),
        server_port=int(os.getenv("VOICE_UI_PORT", "7861")),
        inbrowser=False,
        share=False,
        quiet=False,
    )


if __name__ == "__main__":
    main()
