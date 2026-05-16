"""
Simulated CRM + scrip selection for outbound sales voice demos.

Integration points (not implemented here): org vector DB, episodic SQL, data lake,
Live RAG, market data APIs, WhatsApp, CRM write-back.
"""

from __future__ import annotations

import copy
from dataclasses import dataclass
from typing import Any, Literal

RiskProfile = Literal["conservative", "moderate", "aggressive"]
Sophistication = Literal["basic", "intermediate", "advanced"]

# Default callee for optional English confirmation after the scripted hook (metadata overrides).
DEFAULT_OUTBOUND_TARGET = "Rajesh"

# First spoken line when the callee answers (override with job metadata hook_opening or opening_line).
DEFAULT_HOOK_OPENING = (
    "Rajeshbhai, I noticed you were looking at Tata Motors on the app just two days ago — "
    "and our research team has put out a very specific note on it today. "
    "I thought you'd want to hear this before the market opens. "
    "It'll only take 60 seconds."
)


@dataclass
class PastTip:
    symbol: str
    outcome: Literal["win", "loss", "open"]
    note: str


@dataclass
class SectorExposure:
    sector: str
    pct_portfolio: float


@dataclass
class ClientProfile:
    client_id: str
    display_name: str  # CRM-style name on file, if any; may be empty
    outbound_target_name: str  # Person we dial; English "May I speak to {name}?"
    risk_profile: RiskProfile
    sophistication: Sophistication
    cash_inr: float
    fno_enabled: bool
    segment: Literal["cash", "fno", "both"]
    watchlist: list[str]
    last_login_note: str
    past_tips: list[PastTip]
    intraday_wins: int
    intraday_total: int
    sector_exposure: list[SectorExposure]
    notable_win: str  # e.g. "HDFC Bank call last month"


@dataclass
class Recommendation:
    symbol: str
    entry_inr: float
    target_pct: float
    stop_loss_inr: float
    ticket_shares: int
    ticket_inr: float
    rationale_bullets: list[str]
    cap_tier: Literal["large", "mid", "small"]
    demo_note: str = (
        "Illustrative demo only — not live research. "
        "Replace with real analyst output before production."
    )


@dataclass
class ContextPacket:
    profile: ClientProfile
    recommendation: Recommendation
    hook_opening: str = ""
    sebi_disclaimer_spoken: str = (
        "SEBI disclaimer: I am not a SEBI registered investment adviser. "
        "This is not personalized investment advice and not a recommendation "
        "to buy or sell. Investments are subject to market risks; please read "
        "all related documents carefully and consult a qualified adviser before acting."
    )


DEFAULT_DUMMY_CONTEXT: dict[str, Any] = {
    "client_id": "CRM-DEMO-001",
    "display_name": "",
    "outbound_target_name": DEFAULT_OUTBOUND_TARGET,
    "risk_profile": "moderate",
    "sophistication": "intermediate",
    "cash_inr": 450_000.0,
    "fno_enabled": True,
    "segment": "both",
    "watchlist": ["Tata Motors", "Reliance Industries", "HDFC Bank"],
    "last_login_note": "Viewed Tata Motors on the app two days ago.",
    "past_tips": [
        PastTip("Tata Motors", "win", "Short-term momentum — booked partial near plan."),
        PastTip("HDFC Bank", "win", "Intraday swing — booked near target."),
        PastTip("ITC", "loss", "Stop triggered same session."),
    ],
    "intraday_wins": 8,
    "intraday_total": 11,
    "sector_exposure": [
        SectorExposure("Auto", 14.0),
        SectorExposure("Financials", 22.0),
        SectorExposure("IT", 18.0),
    ],
    "notable_win": "Desk research published a fresh intraday note on Tata Motors today (demo).",
}


def _coerce_past_tips(raw: Any) -> list[PastTip]:
    if not isinstance(raw, list):
        return []
    out: list[PastTip] = []
    for item in raw:
        if isinstance(item, PastTip):
            out.append(item)
        elif isinstance(item, dict):
            out.append(
                PastTip(
                    str(item.get("symbol", "")),
                    item.get("outcome", "open"),  # type: ignore[arg-type]
                    str(item.get("note", "")),
                )
            )
    return out


def _coerce_sector(raw: Any) -> list[SectorExposure]:
    if not isinstance(raw, list):
        return []
    out: list[SectorExposure] = []
    for item in raw:
        if isinstance(item, SectorExposure):
            out.append(item)
        elif isinstance(item, dict):
            out.append(
                SectorExposure(
                    str(item.get("sector", "Unknown")),
                    float(item.get("pct_portfolio", 0.0)),
                )
            )
    return out


def build_client_profile(payload: dict[str, Any]) -> ClientProfile:
    base = copy.deepcopy(DEFAULT_DUMMY_CONTEXT)
    merged_payload = {k: v for k, v in payload.items() if v is not None}
    merged: dict[str, Any] = {**base, **merged_payload}
    if "display_name" not in merged_payload and "user_name" in merged_payload:
        merged["display_name"] = merged_payload["user_name"]
    risk = merged.get("risk_profile", "moderate")
    if risk not in ("conservative", "moderate", "aggressive"):
        risk = "moderate"
    soph = merged.get("sophistication", "intermediate")
    if soph not in ("basic", "intermediate", "advanced"):
        soph = "intermediate"
    seg = merged.get("segment", "cash")
    if seg not in ("cash", "fno", "both"):
        seg = "cash"
    otn = str(merged.get("outbound_target_name") or merged.get("callee_name") or "").strip()
    if not otn:
        otn = DEFAULT_OUTBOUND_TARGET
    return ClientProfile(
        client_id=str(merged.get("client_id", "CRM-DEMO-001")),
        display_name=str(merged.get("display_name", merged.get("user_name", ""))).strip(),
        outbound_target_name=otn,
        risk_profile=risk,  # type: ignore[arg-type]
        sophistication=soph,  # type: ignore[arg-type]
        cash_inr=float(merged.get("cash_inr", 250_000.0)),
        fno_enabled=bool(merged.get("fno_enabled", False)),
        segment=seg,  # type: ignore[arg-type]
        watchlist=list(merged.get("watchlist", [])),
        last_login_note=str(merged.get("last_login_note", "")),
        past_tips=_coerce_past_tips(merged.get("past_tips")),
        intraday_wins=int(merged.get("intraday_wins", 0)),
        intraday_total=int(merged.get("intraday_total", 1)),
        sector_exposure=_coerce_sector(merged.get("sector_exposure")),
        notable_win=str(merged.get("notable_win", "")),
    )


def select_scrip(profile: ClientProfile) -> Recommendation:
    """
    Demo selector: aligned with Tata Motors desk note for this outbound script.
    Ticket size: use up to 8% of cash, rounded to lot-like sizes (demo lots of 10).
    """
    risk = profile.risk_profile
    symbol, cap = "Tata Motors", "large"
    entry, target_pct, stop = 1000.0, 7.0, 965.0
    sector_note = (
        "Auto / CV cycle angle for the intraday note — illustrative only; confirm with your desk's Tata Motors write-up."
    )

    deploy_inr = min(profile.cash_inr * 0.08, 120_000.0)
    ticket_shares = max(10, int(deploy_inr // entry // 10) * 10)
    ticket_inr = round(ticket_shares * entry, 2)

    bullets = [
        "Technical (demo): tight intraday structure on Tata Motors with defined risk — illustrative only.",
        "Fundamental (demo): ties to today's desk note on Tata Motors — verify the full research PDF.",
        sector_note,
    ]

    if profile.fno_enabled and risk != "conservative":
        bullets.append(
            "Optional (demo): if you use FNO, your desk can discuss defined-risk structures — "
            "not advice here."
        )

    return Recommendation(
        symbol=symbol,
        entry_inr=entry,
        target_pct=target_pct,
        stop_loss_inr=stop,
        ticket_shares=ticket_shares,
        ticket_inr=ticket_inr,
        rationale_bullets=bullets,
        cap_tier=cap,  # type: ignore[arg-type]
    )


def build_context_packet(payload: dict[str, Any]) -> ContextPacket:
    profile = build_client_profile(payload)
    rec = select_scrip(profile)
    disclaimer = str(payload.get("sebi_disclaimer_spoken") or "").strip()
    hook = str(payload.get("hook_opening") or payload.get("opening_line") or "").strip()
    packet = ContextPacket(
        profile=profile,
        recommendation=rec,
        hook_opening=hook or DEFAULT_HOOK_OPENING,
    )
    if disclaimer:
        packet.sebi_disclaimer_spoken = disclaimer
    return packet


def format_packet_for_instructions(packet: ContextPacket) -> str:
    p = packet.profile
    r = packet.recommendation
    win_rate = (
        f"{p.intraday_wins}/{p.intraday_total} profitable"
        if p.intraday_total
        else "n/a"
    )
    callee = p.outbound_target_name.strip() or DEFAULT_OUTBOUND_TARGET
    hook = packet.hook_opening.strip() or DEFAULT_HOOK_OPENING
    open_en = (
        "First spoken turn: deliver the primary opening script in natural spoken English — "
        "warm and conversational, not like reading bullet points. "
        "Do not change the stock (Tata Motors) or the core facts in that script. "
        "If after that you are unsure you have the right contact, you may briefly add "
        f"'May I speak to {callee}, please?' — otherwise continue the flow."
    )
    if p.display_name.strip():
        who = (
            f"CRM display name on file (optional): {p.display_name}. "
            f"Outbound target for optional confirmation: {callee}. "
            f"Risk: {p.risk_profile}; sophistication: {p.sophistication}."
        )
    else:
        who = (
            f"No separate CRM display name on file. Outbound target for optional confirmation: {callee}. "
            f"Risk band: {p.risk_profile}; sophistication: {p.sophistication}."
        )
    lines = [
        open_en,
        f"Primary opening script (say this first): {hook}",
        who,
        f"Cash ~₹{p.cash_inr:,.0f}; segment: {p.segment}; FNO: {p.fno_enabled}.",
        f"Watchlist: {', '.join(p.watchlist) or 'n/a'}. Last app activity: {p.last_login_note or 'n/a'}.",
        f"Notable context: {p.notable_win or 'n/a'}. Intraday track (demo): {win_rate}.",
        f"Selected idea (demo): {r.symbol} @ ~₹{r.entry_inr:g}, target ~+{r.target_pct}%, "
        f"stop ~₹{r.stop_loss_inr:g}, suggest ticket ~{r.ticket_shares} shares (~₹{r.ticket_inr:,.0f}).",
        f"Rationale bullets: {'; '.join(r.rationale_bullets)}",
    ]
    return "\n".join(lines)
