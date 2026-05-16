import pytest

from sales_agents import analyze_signals, is_simple_greeting
from sales_context import (
    DEFAULT_HOOK_OPENING,
    ClientProfile,
    SectorExposure,
    build_client_profile,
    build_context_packet,
    format_packet_for_instructions,
    select_scrip,
)


def test_is_simple_greeting() -> None:
    assert is_simple_greeting("Hello")
    assert is_simple_greeting("Hi there")
    assert is_simple_greeting("Namaste ji")
    assert is_simple_greeting("Good morning, sir")
    assert not is_simple_greeting("Hello, who is this")
    assert not is_simple_greeting("What do you want")
    assert not is_simple_greeting("")


def test_analyze_signals_compliance_priority() -> None:
    assert analyze_signals("I want to speak to a lawyer about this") == ["COMPLIANCE_TRIGGER"]
    assert analyze_signals("This sounds like a scam") == ["COMPLIANCE_TRIGGER"]


def test_analyze_signals_buy_and_ready() -> None:
    assert "BUY_INTENT_HIGH" in analyze_signals("Please place the order with my dealer")
    assert "READY_TO_CLOSE" in analyze_signals("Can you wrap up and WhatsApp me the link")


def test_build_context_packet_merges_user_name() -> None:
    pkt = build_context_packet({"user_name": "Riya", "risk_profile": "conservative"})
    assert pkt.profile.display_name == "Riya"
    assert pkt.profile.outbound_target_name == "Rajesh"
    rec = pkt.recommendation
    assert rec.symbol == "Tata Motors"
    assert pkt.profile.risk_profile == "conservative"


def test_default_context_hook_and_outbound() -> None:
    pkt = build_context_packet({})
    assert pkt.profile.display_name == ""
    assert pkt.profile.outbound_target_name == "Rajesh"
    assert pkt.hook_opening == DEFAULT_HOOK_OPENING
    assert "Rajeshbhai" in pkt.hook_opening
    assert "Tata Motors" in pkt.hook_opening


def test_format_packet_includes_hook_and_tata() -> None:
    pkt = build_context_packet({})
    text = format_packet_for_instructions(pkt)
    assert "may i speak to" in text.lower()
    assert "rajesh" in text.lower()
    assert "tata motors" in text.lower()


def test_hook_opening_override() -> None:
    pkt = build_context_packet({"hook_opening": "Custom opener only."})
    assert pkt.hook_opening == "Custom opener only."


def test_outbound_target_override() -> None:
    pkt = build_context_packet({"outbound_target_name": "Amit"})
    assert pkt.profile.outbound_target_name == "Amit"
    assert "amit" in format_packet_for_instructions(pkt).lower()


def test_select_scrip_tata_motors_large_cap() -> None:
    p = build_client_profile({"risk_profile": "aggressive", "fno_enabled": True})
    r = select_scrip(p)
    assert r.cap_tier == "large"
    assert r.symbol == "Tata Motors"


def test_select_scrip_ticket_sized() -> None:
    p = ClientProfile(
        client_id="x",
        display_name="Test",
        outbound_target_name="Rajesh",
        risk_profile="moderate",
        sophistication="intermediate",
        cash_inr=500_000.0,
        fno_enabled=False,
        segment="cash",
        watchlist=[],
        last_login_note="",
        past_tips=[],
        intraday_wins=5,
        intraday_total=10,
        sector_exposure=[SectorExposure("IT", 30.0)],
        notable_win="",
    )
    r = select_scrip(p)
    assert r.symbol == "Tata Motors"
    assert r.ticket_shares >= 10


def test_build_client_profile_invalid_enums_fallback() -> None:
    p = build_client_profile({"risk_profile": "unknown", "segment": "weird"})
    assert p.risk_profile == "moderate"
    assert p.segment == "cash"
