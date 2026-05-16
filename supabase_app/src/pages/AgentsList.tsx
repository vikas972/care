import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Reveal } from "../components/Reveal";
import { supabase } from "../lib/supabase";
import type { VoiceAgentRow } from "../types";

export default function AgentsList() {
  const [searchParams] = useSearchParams();
  const q = (searchParams.get("q") || "").trim().toLowerCase();

  const [rows, setRows] = useState<VoiceAgentRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const filtered = useMemo(() => {
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.livekit_agent_name.toLowerCase().includes(q) ||
        r.instructions.toLowerCase().includes(q),
    );
  }, [rows, q]);

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    const { data, error } = await supabase
      .from("voice_agents")
      .select("*")
      .order("updated_at", { ascending: false });
    setLoading(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setRows((data ?? []) as VoiceAgentRow[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(id: string) {
    if (!confirm("Delete this agent configuration?")) return;
    setErr(null);
    const row = rows.find((r) => r.id === id);
    if (row?.attachment_storage_path) {
      await supabase.storage.from("voice-agent-assets").remove([row.attachment_storage_path]);
    }
    const { error } = await supabase.from("voice_agents").delete().eq("id", id);
    if (error) {
      setErr(error.message);
      return;
    }
    void load();
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-white">Voice agents</h1>
          <p className="mt-2 max-w-xl text-sm text-slate-400">
            Your assistants — prompts, voice settings, and LiveKit configuration in one place.
          </p>
        </div>
        <Link to="/studio/agents/new" className="btn-primary shrink-0">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New voice agent
        </Link>
      </div>

      {err ? (
        <div className="rounded-xl border border-red-500/30 bg-red-950/35 px-4 py-3 text-sm text-red-200">{err}</div>
      ) : null}

      {loading ? (
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-ink-900/60 ring-1 ring-white/[0.05]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Reveal className="studio-card relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-[#14141c] to-[#0e0e12] px-8 py-16 text-center">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(45,212,191,0.1),transparent)]" />
          <div className="relative">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-500/15 ring-1 ring-teal-500/25">
              <svg className="h-8 w-8 text-teal-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.25}>
                <path
                  d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path d="M19 10v1a7 7 0 0 1-14 0v-1" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="font-display text-2xl text-white">
              {rows.length === 0 ? "Your first voice agent awaits" : "No matches found"}
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-500">
              {rows.length === 0
                ? "Define prompts, pick a voice, and connect to LiveKit — you'll be talking to your agent in minutes."
                : "Try a different search term or create a new assistant."}
            </p>
            {rows.length === 0 ? (
              <Link to="/studio/agents/new" className="btn-primary mt-8">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Build your first voice agent
              </Link>
            ) : null}
          </div>
        </Reveal>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {filtered.map((r) => (
            <li
              key={r.id}
              className="studio-card group flex flex-col rounded-2xl border border-white/[0.08] bg-gradient-to-b from-ink-900/90 to-ink-950/70 p-5 shadow-lg shadow-black/15 transition hover:border-emerald-500/25"
            >
              <div className="min-w-0 flex-1">
                <Link
                  to={`/studio/agents/${r.id}`}
                  className="font-display text-xl text-white transition group-hover:text-emerald-200"
                >
                  {r.name}
                </Link>
                <div className="mt-1 font-mono text-[11px] text-slate-500">{r.livekit_agent_name}</div>
                <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-slate-400">{r.instructions}</p>
                <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-slate-600">
                  <span>{new Date(r.updated_at).toLocaleString()}</span>
                  {r.attachment_storage_path ? (
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-400/90">Attachment</span>
                  ) : null}
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2 border-t border-white/[0.06] pt-4">
                <Link
                  to={`/studio/demo?agent=${encodeURIComponent(r.id)}`}
                  className="rounded-lg bg-emerald-500/15 px-3 py-2 text-xs font-medium text-emerald-200 ring-1 ring-emerald-500/30 hover:bg-emerald-500/25"
                >
                  Demo
                </Link>
                <Link
                  to={`/studio/outbound?agent=${encodeURIComponent(r.id)}`}
                  className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5"
                >
                  Outbound
                </Link>
                <Link
                  to={`/studio/agents/${r.id}`}
                  className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5"
                >
                  Edit
                </Link>
                <button
                  type="button"
                  onClick={() => void remove(r.id)}
                  className="rounded-lg border border-red-500/25 px-3 py-2 text-xs text-red-300 hover:bg-red-950/40"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
