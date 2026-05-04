"""Fetch voice_agents rows via Supabase REST (service role), scoped by user id."""

from __future__ import annotations

from typing import Any

import httpx

from voice_bff.config import Settings


async def fetch_voice_agent_row(
    *,
    settings: Settings,
    agent_id: str,
    user_sub: str,
) -> dict[str, Any] | None:
    base = (settings.supabase_url or "").strip().rstrip("/")
    key = (settings.supabase_service_role_key or "").strip()
    if not base or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured")

    url = f"{base}/rest/v1/voice_agents"
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Accept": "application/json",
    }
    params = {
        "id": f"eq.{agent_id}",
        "user_id": f"eq.{user_sub}",
        "select": "*",
        "limit": "1",
    }

    async with httpx.AsyncClient() as client:
        resp = await client.get(url, headers=headers, params=params, timeout=30.0)
        resp.raise_for_status()
        rows = resp.json()

    if not rows:
        return None
    row = rows[0]
    if not isinstance(row, dict):
        return None
    return row
