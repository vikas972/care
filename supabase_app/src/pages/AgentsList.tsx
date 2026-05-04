import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
          <h1 className="font-display text-3xl text-white">Agents</h1>
          <p className="mt-2 max-w-xl text-sm text-slate-400">
            Prompts, LiveKit dispatch name, inference overrides, and attachments live here.
          </p>
        </div>
        <Link
          to="/studio/agents/new"
          className="shrink-0 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-emerald-900/25 hover:from-emerald-500 hover:to-teal-500"
        >
          New agent
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
        <div className="studio-card rounded-2xl border border-white/[0.08] bg-ink-900/40 px-8 py-14 text-center">
          <p className="text-slate-400">{rows.length === 0 ? "No agents yet." : "No matches for your search."}</p>
          {rows.length === 0 ? (
            <Link
              to="/studio/agents/new"
              className="mt-4 inline-block rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-500"
            >
              Create your first agent
            </Link>
          ) : null}
        </div>
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
