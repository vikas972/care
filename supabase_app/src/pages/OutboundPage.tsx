import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useVoiceAgents } from "../hooks/useVoiceAgents";
import { apiBase, parseFastApiDetail } from "../lib/api";

export default function OutboundPage() {
  const { session } = useAuth();
  const { rows, loading, err: loadErr, reload } = useVoiceAgents();
  const [searchParams, setSearchParams] = useSearchParams();
  const agentId = searchParams.get("agent") ?? "";

  const [toE164, setToE164] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const selected = useMemo(() => rows.find((r) => r.id === agentId), [rows, agentId]);

  useEffect(() => {
    if (!loading && rows.length && !agentId) {
      const first = rows[0]?.id;
      if (first) setSearchParams({ agent: first }, { replace: true });
    }
  }, [loading, rows, agentId, setSearchParams]);

  async function dial() {
    setErr(null);
    setMsg(null);
    const base = apiBase();
    if (!base) {
      setErr("Set VITE_API_BASE_URL.");
      return;
    }
    const access = session?.access_token;
    if (!access) {
      setErr("Not signed in.");
      return;
    }
    if (!agentId) {
      setErr("Choose an agent.");
      return;
    }
    const to = toE164.trim();
    if (!to.startsWith("+")) {
      setErr("Use E.164 including country code (e.g. +15555550123).");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`${base}/voice/livekit/outbound`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${access}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ agent_id: agentId, to_e164: to }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        detail?: unknown;
        room?: string;
        sip_participant_identity?: string;
      };
      if (!res.ok) throw new Error(parseFastApiDetail(body));
      setMsg(
        `Dispatched — room ${body.room ?? "?"}, callee participant ${body.sip_participant_identity ?? ""}`,
      );
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Outbound failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl text-white">Outbound calls</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Calls LiveKit SIP outbound API via your FastAPI BFF. Requires{" "}
          <code className="rounded bg-white/5 px-1 text-slate-300">LIVEKIT_SIP_OUTBOUND_TRUNK</code> on the server.
        </p>
      </div>

      {loadErr ? (
        <div className="rounded-xl border border-red-500/30 bg-red-950/35 px-4 py-3 text-sm text-red-200">
          {loadErr}{" "}
          <button type="button" className="ml-2 underline" onClick={() => void reload()}>
            Retry
          </button>
        </div>
      ) : null}

      <section className="studio-card rounded-2xl border border-white/[0.08] bg-gradient-to-b from-ink-900/90 to-ink-950/80 p-6 sm:p-8">
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">Agent</label>
            <select
              value={agentId}
              disabled={loading || rows.length === 0}
              onChange={(e) => setSearchParams(e.target.value ? { agent: e.target.value } : {})}
              className="w-full rounded-xl border border-white/10 bg-ink-950 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            >
              {rows.length === 0 ? (
                <option value="">No agents</option>
              ) : (
                rows.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))
              )}
            </select>
            {selected ? (
              <p className="mt-2 text-xs text-slate-500">
                Worker name:{" "}
                <span className="font-mono text-slate-400">{selected.livekit_agent_name}</span> ·{" "}
                <Link to={`/studio/agents/${selected.id}`} className="text-emerald-400 hover:text-emerald-300">
                  Edit prompts
                </Link>
              </p>
            ) : null}
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
              Destination (E.164)
            </label>
            <input
              type="tel"
              value={toE164}
              onChange={(e) => setToE164(e.target.value)}
              placeholder="+15555550123"
              className="w-full rounded-xl border border-white/10 bg-ink-950 px-4 py-3 font-mono text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
          </div>
        </div>

        <button
          type="button"
          disabled={busy || !session || !agentId}
          onClick={() => void dial()}
          className="mt-8 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-3 text-sm font-medium text-white shadow-lg shadow-violet-900/25 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-40"
        >
          {busy ? "Dialing…" : "Place outbound call"}
        </button>

        {err ? (
          <div className="mt-6 rounded-xl border border-red-500/25 bg-red-950/30 px-4 py-3 text-sm text-red-200">{err}</div>
        ) : null}
        {msg ? (
          <div className="mt-6 rounded-xl border border-emerald-500/25 bg-emerald-950/25 px-4 py-3 font-mono text-xs text-emerald-100/90">
            {msg}
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-white/[0.06] bg-ink-900/30 p-6 text-sm text-slate-400">
        <h3 className="font-medium text-slate-200">Checklist</h3>
        <ul className="mt-3 list-inside list-disc space-y-2">
          <li>Outbound SIP trunk configured in LiveKit Cloud</li>
          <li>
            <code className="text-slate-500">LIVEKIT_SIP_OUTBOUND_TRUNK</code> set in FastAPI{" "}
            <code className="text-slate-500">.env</code>
          </li>
          <li>Optional caller ID: <code className="text-slate-500">LIVEKIT_SIP_NUMBER</code></li>
        </ul>
      </section>
    </div>
  );
}
