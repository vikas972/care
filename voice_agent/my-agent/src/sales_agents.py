"""
Multi-agent outbound sales call: stage agents + deterministic sentiment/compliance scan.

Handoffs: @function_tool methods return the next Agent (LiveKit Agents SDK pattern).
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field
from typing import Literal

from livekit.agents import Agent, ModelSettings, RunContext, function_tool
from livekit.agents import llm

from sales_context import (
    DEFAULT_HOOK_OPENING,
    ContextPacket,
    format_packet_for_instructions,
)

logger = logging.getLogger("agent")

# Shared voice: female Indian professional; scripted English hook first, then Hinglish ok.
VOICE_PERSONA = (
    "Voice persona: a professional Indian woman on the phone. "
    "If the user greets you first (hello, hi, namaste), always answer that greeting in one short "
    "warm breath like a human would — greet them back and thank them for picking up or taking the call — "
    "then continue the call; never ignore their hello and jump straight into a script. "
    "The first substantive turn follows the packet's scripted English opening (Tata Motors context); "
    "only add a short May I speak to line if the packet says you are unsure of the contact. "
    "After that, warm Hinglish is fine if it stays natural. "
    "When you use Hindi for yourself, feminine forms only — e.g. 'main bol sakti hoon', "
    "'bata sakti hoon', 'sun sakti hoon', 'madad kar sakti hoon' — "
    "never 'sakta' / 'sakte' for yourself. Short polite bits like ji, theek hai are fine. "
    "Do not ask an open-ended 'what is your name' when the packet gives an outbound target name — "
    "confirm that name in English, then continue once they agree."
)


def _with_persona(instructions: str) -> str:
    return f"{VOICE_PERSONA}\n\n{instructions}"


COMPLIANCE_RE = re.compile(
    r"\b(fraud|scam|sebi|regulator|rbi|lawyer|police|complaint|cheat|ponzi)\b",
    re.IGNORECASE,
)
BUY_INTENT_RE = re.compile(
    r"\b(buy|bought|place the order|place it|dealer|execute|i'm in|i am in|"
    r"book it|let's do it|do it|yes place|go ahead and buy)\b",
    re.IGNORECASE,
)
FRUSTRATION_RE = re.compile(
    r"\b(stop calling|not interested|waste of time|fed up|annoying|harass|"
    r"this is nonsense|enough already)\b",
    re.IGNORECASE,
)
READY_CLOSE_RE = re.compile(
    r"\b(wrap up|have to go|make it quick|what do i need to do|"
    r"how do i buy|send the link|whatsapp me)\b",
    re.IGNORECASE,
)
# User spoke first with hi/hello only — respond human, then continue the hook (not a second cold open).
_GREETING_DISALLOW = re.compile(
    r"\b(who|what|why|where|wrong|scam|fraud|stop|busy|number|call(ing)?|"
    r"sell|buy|price|stock|how much)\b",
    re.IGNORECASE,
)
_GREETING_ONLY = re.compile(
    r"^(?:"
    r"(?:hi|hello|hey|hiya|allo)\b(?:\s*[,.]?\s*(?:hi|hello|there|ji))?"
    r"|good\s+(?:morning|afternoon|evening)\b(?:\s*,?\s*(?:sir|madam|ji))?"
    r"|namaste(?:\s+ji)?|namaskar(?:\s+ji)?"
    r"|(?:haan|haan\s+ji|ji|ji\s+ji|hmm|uh\s+huh)\b"
    r"|hello\s+ji|hi\s+there|hey\s+there"
    r")[\s,.!?…\-–—]*$",
    re.IGNORECASE,
)


def is_simple_greeting(text: str) -> bool:
    """True when the user turn is only a short polite hello / namaste (no real question yet)."""
    raw = (text or "").strip()
    if not raw or len(raw) > 72:
        return False
    if _GREETING_DISALLOW.search(raw):
        return False
    collapsed = re.sub(r"\s+", " ", raw).strip()
    return bool(_GREETING_ONLY.match(collapsed))


def latest_user_text_from_history(chat_ctx: llm.ChatContext) -> str:
    for m in reversed(chat_ctx.messages()):
        if m.role != "user":
            continue
        tc = m.text_content
        if tc and (t := tc.strip()):
            return t
    return ""


def _message_text(message: llm.ChatMessage) -> str:
    parts: list[str] = []
    for block in message.content:
        if isinstance(block, str):
            parts.append(block)
    return " ".join(parts).strip()


def analyze_signals(text: str) -> list[str]:
    """Rule-based monitor: compliance overrides other labels."""
    if not text:
        return []
    t = text.lower()
    out: list[str] = []
    if COMPLIANCE_RE.search(t):
        return ["COMPLIANCE_TRIGGER"]
    if BUY_INTENT_RE.search(t):
        out.append("BUY_INTENT_HIGH")
    if FRUSTRATION_RE.search(t):
        out.append("FRUSTRATION_RISING")
    if READY_CLOSE_RE.search(t):
        out.append("READY_TO_CLOSE")
    return out


@dataclass
class CallState:
    """Shared session state (AgentSession.userdata)."""

    packet: ContextPacket
    stage: str = "hook"
    objection_round: int = 0
    active_signals: list[str] = field(default_factory=list)
    last_user_text: str = ""
    cta_nudge_used: bool = False
    last_disposition: str = ""
    pitch_delivered: bool = False
    hook_opener_played: bool = False
    skip_opening: bool = False


def _playbook_snippet(state: CallState, category: str) -> str:
    p = state.packet.profile
    win_line = (
        f"{p.intraday_wins} of your last {p.intraday_total} intraday ideas were profitable (demo stats)."
        if p.intraday_total
        else "Your recent track record is mixed — we focus on process, not one outcome."
    )
    snippets: dict[str, str] = {
        "price": (
            "The move you saw was the market waking up — the setup still has room versus our "
            "technical target, and risk/reward is defined with the stop we gave."
        ),
        "loss_aversion": (
            f"I hear you — that stings. {win_line} "
            f"Recall {p.notable_win or 'a past setup that worked for you'} — structurally this idea is different: "
            "tighter risk, clear invalidation at the stop."
        ),
        "timing": (
            "Volatility is when large moves happen; here the stop caps downside in rupee terms "
            "so the asymmetry is deliberate, not open-ended."
        ),
        "trust": (
            "Fair question — bilkul valid. Main full WhatsApp note bhej sakti hoon with entry, levels, stop — "
            "aap apne dealer ke saath review kar lena before deciding."
        ),
        "busy": (
            "Theek hai ji — intraday window hai. Main levels WhatsApp kar sakti hoon; agar aap chaho to dealer "
            "us note se act kar sakta hai."
        ),
        "capital": (
            "We can size down — even a smaller ticket keeps you in the move; your desk can align "
            "shares to the margin you have free."
        ),
        "competitor": (
            "Stick to your process with your adviser — we're only sharing our desk's view and levels; "
            "you choose what fits your book."
        ),
        "generic": (
            "I get the concern. Let's anchor on the levels and the stop — that's what keeps this disciplined."
        ),
    }
    return snippets.get(category, snippets["generic"])


class SalesCallAgent(Agent):
    """Base: shared monitor on each user turn."""

    def __init__(self, state: CallState, *, instructions: str, **kwargs: object) -> None:
        self._state = state
        super().__init__(instructions=instructions, **kwargs)

    async def on_user_turn_completed(
        self,
        turn_ctx: llm.ChatContext,
        new_message: llm.ChatMessage,
    ) -> None:
        text = _message_text(new_message)
        self._state.last_user_text = text
        signals = analyze_signals(text)
        self._state.active_signals = signals
        if signals:
            turn_ctx.add_message(
                role="system",
                content=(
                    "Internal routing (do not read aloud): "
                    f"signals={','.join(signals)}. "
                    "If COMPLIANCE_TRIGGER is present, immediately call handoff_to_escalation "
                    "and give no stock advice."
                ),
            )
        await super().on_user_turn_completed(turn_ctx, new_message)


class EscalationAgent(SalesCallAgent):
    def __init__(self, state: CallState) -> None:
        super().__init__(
            state,
            instructions=_with_persona(
                "You are a compliance escalation voice on a phone call. "
                "The user raised a regulatory, legal, or serious trust concern. "
                "Speak calmly in short sentences: acknowledge, say a human specialist will follow up, "
                "do not debate, do not sell, do not give stock views. "
                "Offer one sentence on how soon a human will reach out. No markdown."
            ),
        )

    @function_tool
    async def complete_escalation(self, ctx: RunContext[CallState]) -> str:
        logger.info(
            "sales_escalation",
            extra={"client_id": ctx.userdata.packet.profile.client_id, "stage": "escalation"},
        )
        ctx.session.shutdown(drain=True)
        return "Escalation logged; ending call."


class HookAgent(SalesCallAgent):
    def __init__(self, state: CallState) -> None:
        super().__init__(
            state,
            instructions=_with_persona(
                "You are the opening specialist on an outbound call about today's Tata Motors desk note. "
                "Keep plain speech, short sentences, no markdown — sound like a real person on the phone, not a recording. "
                "If the user's latest message is only a short greeting (hello, hi, namaste, good morning): "
                "answer it in one brief warm phrase first, then continue — do not steamroll past their hello. "
                "If you already played the full hook opener (Rajeshbhai / Tata Motors / sixty seconds) and they only greet "
                "after that, do not read that whole block again; acknowledge and ask if now is a good moment for the "
                "sixty-second summary, then move toward handoff_to_pitch when they agree. "
                "Otherwise your first substantive spoken turn should deliver the packet's primary opening script "
                "(Rajeshbhai / Tata Motors / sixty seconds) in natural English — do not swap the stock name. "
                "If wrong person, apologize and stop. If they are busy, offer callback plus WhatsApp summary. "
                "When they are willing to hear the idea, call handoff_to_pitch. "
                "If internal signals include COMPLIANCE_TRIGGER, call handoff_to_escalation only."
            ),
        )

    async def on_enter(self) -> None:
        if self._state.skip_opening:
            return
        script = (self._state.packet.hook_opening or DEFAULT_HOOK_OPENING).strip()
        pkt = format_packet_for_instructions(self._state.packet)
        last_user = latest_user_text_from_history(self.session.history())
        if last_user and is_simple_greeting(last_user):
            opener = (
                "The user already said something — it was only a short greeting. "
                "You are replying first: sound human. Mirror their tone in one small phrase "
                '(for example "Hello — good morning, thanks for picking up" or "Hi — namaste, thanks for taking the call"), '
                "then without a stiff pause flow straight into why you called. "
                "Weave the SCRIPT below into the same continuous reply — one colleague talking, not two separate recordings. "
                "Do not ignore their greeting and do not read the script like a teleprompter block; "
                "keep every factual detail (Rajeshbhai if appropriate, Tata Motors, app activity two days ago, research note today, "
                "before market opens, sixty seconds) accurate. "
                "No entry, target, or stop-loss yet. End naturally so they can answer.\n\n"
                f'They said: "{last_user}"\n\n'
                f"SCRIPT (merge into one reply):\n{script}\n\n"
                f"Context (for you only — do not dump verbatim):\n{pkt}"
            )
            allow_interrupt = True
        else:
            opener = (
                "The callee just answered (or the line is open and they have not said anything yet). "
                "Speak your first 15-25 seconds in natural spoken English only. "
                "If they greet you first or overlap with a quick hello, do not steamroll them — "
                "weave a brief human acknowledgment into the same breath before the reason-you-called. "
                "Deliver the SCRIPT below as one warm, colleague-like flow — not robotic, not bullet points. "
                "If they have not spoken yet, still sound like a person calling someone they slightly know, not a machine. "
                "Keep Tata Motors and the app-activity hook exactly as written; tiny natural fillers ok. "
                "Do not quote entry, target, or stop-loss yet. After the script, pause for them to respond.\n\n"
                f"SCRIPT:\n{script}\n\n"
                f"Context (for you only — do not read verbatim into the opener):\n{pkt}"
            )
            allow_interrupt = True
        h = self.session.generate_reply(
            instructions=opener,
            allow_interruptions=allow_interrupt,
        )
        await h.wait_for_playout()
        self._state.hook_opener_played = True

    async def on_user_turn_completed(
        self,
        turn_ctx: llm.ChatContext,
        new_message: llm.ChatMessage,
    ) -> None:
        await super().on_user_turn_completed(turn_ctx, new_message)
        text = _message_text(new_message)
        if self._state.hook_opener_played and is_simple_greeting(text):
            turn_ctx.add_message(
                role="system",
                content=(
                    "Internal routing (do not read aloud): the user's last message was only a greeting. "
                    "Reply like a human on the phone: one short warm acknowledgment, then move the conversation forward "
                    "toward the Tata Motors desk note — do not re-read the full Rajeshbhai opener verbatim from the top."
                ),
            )

    @function_tool
    async def handoff_to_pitch(self, ctx: RunContext[CallState]) -> Agent:
        ctx.userdata.stage = "pitch"
        return PitchAgent(ctx.userdata)

    @function_tool
    async def handoff_to_escalation(self, ctx: RunContext[CallState]) -> Agent:
        ctx.userdata.stage = "escalation"
        return EscalationAgent(ctx.userdata)


PITCH_PERSONA = (
    "The hook already did the English 'May I speak to…' check. Do not repeat that line unless the user says "
    "they are the wrong person. Feminine Hindi for yourself if you use Hindi (sakti, never sakta for yourself)."
)


class PitchAgent(SalesCallAgent):
    def __init__(self, state: CallState) -> None:
        super().__init__(
            state,
            instructions=_with_persona(
                f"{PITCH_PERSONA}\n\n"
                "You are the recommendation specialist. Plain speech, no markdown. "
                "If they open with only hi/hello, acknowledge in a few words like a person would, then give the pitch — "
                "same breath, not 'Hello.' [pause] then robotic pitch. "
                "If you have not yet delivered the numbers and SEBI disclaimer in this call, do it now in one crisp turn. "
                "Listen: if they object or push back, call handoff_to_objection. "
                "If they show strong buy intent or readiness to close (or internal READY_TO_CLOSE / BUY_INTENT_HIGH), "
                "call handoff_to_cta. "
                "Never promise returns; no personalized investment advice language beyond the desk idea. "
                "If COMPLIANCE_TRIGGER appears in internal signals, call handoff_to_escalation only. "
                "Optional: call simulate_rag_snippet or simulate_live_quote if they ask for proof — keep it brief."
            ),
        )

    def llm_node(
        self,
        chat_ctx: llm.ChatContext,
        tools: list[llm.Tool],
        model_settings: ModelSettings,
    ):
        if not self._state.pitch_delivered:
            self._state.pitch_delivered = True
            model_settings = ModelSettings(tool_choice="none")
            r = self._state.packet.recommendation
            d = self._state.packet.sebi_disclaimer_spoken
            pkt = format_packet_for_instructions(self._state.packet)
            bullets = " ".join(f"({i + 1}) {b}" for i, b in enumerate(r.rationale_bullets[:3]))
            chat_ctx = chat_ctx.copy()
            user_last = latest_user_text_from_history(chat_ctx)
            if is_simple_greeting(user_last):
                human_lead = (
                    f'Their latest message was only a greeting ("{user_last}"). '
                    "Sound human: open with one short warm line that answers that greeting, "
                    "then continue into the pitch in the same spoken flow — one colleague talking, not two recordings. "
                )
            else:
                human_lead = (
                    "Sound like a colleague on the phone — natural pacing, not a teleprompter or bullet list. "
                )
            chat_ctx.add_message(
                role="system",
                content=human_lead
                + (
                    "You must deliver the full pitch + disclaimer in this same reply (one continuous turn). "
                    "Do not open with May I speak to or name-checking — the hook already did that. "
                    "Do not call tools in this turn. Keep feminine Hindi for yourself if you use Hindi. "
                    "After identity is confirmed, you may use the outbound target name from the packet when natural.\n\n"
                    f"Pitch blueprint:\n"
                    f"- One sentence: {r.symbol} entry ~₹{r.entry_inr:g}, target ~+{r.target_pct}%, stop ~₹{r.stop_loss_inr:g}, ticket ~{r.ticket_shares} shares.\n"
                    f"- Two to three short justifications: {bullets}\n"
                    f"- Speak this disclaimer clearly: {d}\n\n"
                    f"Context packet:\n{pkt}"
                ),
            )
        return super().llm_node(chat_ctx, tools, model_settings)

    @function_tool
    async def simulate_rag_snippet(self, ctx: RunContext[CallState], topic: str) -> str:
        logger.info("simulate_rag", extra={"topic": topic})
        sym = ctx.userdata.packet.recommendation.symbol
        return (
            f"[Demo RAG] Note on {sym} re '{topic}': desk view cites liquidity + event skew; "
            "verify with official research PDF."
        )

    @function_tool
    async def simulate_live_quote(self, ctx: RunContext[CallState]) -> str:
        r = ctx.userdata.packet.recommendation
        logger.info("simulate_quote", extra={"symbol": r.symbol})
        return f"[Demo quote] {r.symbol} last ~{r.entry_inr:g} (delayed feed placeholder)."

    @function_tool
    async def handoff_to_objection(self, ctx: RunContext[CallState]) -> Agent:
        ctx.userdata.stage = "objection"
        return ObjectionAgent(ctx.userdata)

    @function_tool
    async def handoff_to_cta(self, ctx: RunContext[CallState]) -> Agent:
        ctx.userdata.stage = "cta"
        return CTAAgent(ctx.userdata)

    @function_tool
    async def handoff_to_escalation(self, ctx: RunContext[CallState]) -> Agent:
        ctx.userdata.stage = "escalation"
        return EscalationAgent(ctx.userdata)


class ObjectionAgent(SalesCallAgent):
    def __init__(self, state: CallState) -> None:
        super().__init__(
            state,
            instructions=_with_persona(
                "You handle objections on a phone call. Plain speech, no markdown. "
                "Classify the user's concern into one of: price, loss_aversion, timing, trust, "
                "busy, capital, competitor, generic. "
                "Respond with one empathetic sentence then one concise rebuttal using the playbook style "
                "from your tools (call get_playbook_line with the category). "
                "If they are satisfied and want the idea again, call handoff_to_pitch. "
                "If they are ready to decide, call handoff_to_cta. "
                "After two completed round-trips from objection back to pitch, you must not return to pitch; "
                "use handoff_to_cta instead (the tool enforces this). "
                "If COMPLIANCE_TRIGGER in signals, handoff_to_escalation only."
            ),
        )

    @function_tool
    async def get_playbook_line(self, ctx: RunContext[CallState], category: str) -> str:
        return _playbook_snippet(ctx.userdata, category)

    @function_tool
    async def handoff_to_pitch(self, ctx: RunContext[CallState]) -> Agent:
        if ctx.userdata.objection_round >= 2:
            return CTAAgent(ctx.userdata)
        ctx.userdata.objection_round += 1
        ctx.userdata.stage = "pitch"
        return PitchAgent(ctx.userdata)

    @function_tool
    async def handoff_to_cta(self, ctx: RunContext[CallState]) -> Agent:
        ctx.userdata.stage = "cta"
        return CTAAgent(ctx.userdata)

    @function_tool
    async def handoff_to_escalation(self, ctx: RunContext[CallState]) -> Agent:
        ctx.userdata.stage = "escalation"
        return EscalationAgent(ctx.userdata)


class CTAAgent(SalesCallAgent):
    def __init__(self, state: CallState) -> None:
        super().__init__(
            state,
            instructions=_with_persona(
                "You are closing the call. Plain speech. "
                "Ask directly if you should ask their dealer to place the trade now. "
                "If they hesitate once, you may use one urgency nudge only if cta_nudge_used is false "
                "(intraday window) — then set nudge mentally via simulate tools logging. "
                "Capture explicit intent: YES, CALLBACK, or DECLINED and call the logging tools. "
                "Remind them WhatsApp summary will carry entry, target, stop. "
                "Never promise profit. If COMPLIANCE_TRIGGER, handoff_to_escalation."
            ),
        )

    @function_tool
    async def simulate_whatsapp_summary(
        self,
        ctx: RunContext[CallState],
        disposition: Literal["YES", "CALLBACK", "DECLINED"],
    ) -> str:
        r = ctx.userdata.packet.recommendation
        p = ctx.userdata.packet.profile
        body = {
            "channel": "whatsapp_demo",
            "to": p.display_name.strip() or p.outbound_target_name.strip() or "UNKNOWN_CALLER",
            "disposition": disposition,
            "symbol": r.symbol,
            "entry": r.entry_inr,
            "target_pct": r.target_pct,
            "stop": r.stop_loss_inr,
            "shares": r.ticket_shares,
        }
        logger.info("whatsapp_dispatch_demo %s", json.dumps(body))
        return "WhatsApp summary queued (demo log only)."

    @function_tool
    async def simulate_crm_disposition(
        self,
        ctx: RunContext[CallState],
        disposition: Literal["CONVERTED", "CALLBACK", "DECLINED"],
        objection_tag: str = "",
    ) -> str:
        ctx.userdata.last_disposition = disposition
        rec = {
            "crm_demo": True,
            "client_id": ctx.userdata.packet.profile.client_id,
            "disposition": disposition,
            "objection_tag": objection_tag or None,
            "stage": ctx.userdata.stage,
        }
        logger.info("crm_disposition_demo %s", json.dumps(rec))
        return "CRM disposition recorded (demo log only)."

    @function_tool
    async def end_call(self, ctx: RunContext[CallState]) -> str:
        ctx.session.shutdown(drain=True)
        return "Goodbye."

    @function_tool
    async def handoff_to_escalation(self, ctx: RunContext[CallState]) -> Agent:
        ctx.userdata.stage = "escalation"
        return EscalationAgent(ctx.userdata)
