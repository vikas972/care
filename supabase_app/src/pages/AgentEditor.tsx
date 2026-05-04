import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import type { VoiceAgentRow } from "../types";

const BUCKET = "voice-agent-assets";

const MODEL_META_KEYS = ["stt_model", "llm_model", "tts_model", "tts_voice", "stt_language"] as const;

function stripModelKeys(meta: Record<string, unknown>): Record<string, unknown> {
  const o: Record<string, unknown> = { ...meta };
  for (const k of MODEL_META_KEYS) delete o[k];
  return o;
}

function mergeModelKeysIntoJobMetadata(
  meta: Record<string, unknown>,
  fields: Record<(typeof MODEL_META_KEYS)[number], string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...meta };
  for (const k of MODEL_META_KEYS) delete out[k];
  for (const k of MODEL_META_KEYS) {
    const t = fields[k].trim();
    if (t) out[k] = t;
  }
  return out;
}

function safeFileSegment(name: string) {
  return name.replace(/[^\w.\-()+]/g, "_").slice(0, 180) || "file";
}

export default function AgentEditor() {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isNew = agentId === "new";

  const [name, setName] = useState("");
  const [livekitAgentName, setLivekitAgentName] = useState("my-agent");
  const [instructions, setInstructions] = useState("");
  const [openingScript, setOpeningScript] = useState("");
  const [metadataJson, setMetadataJson] = useState("{}");
  const [sttModel, setSttModel] = useState("");
  const [sttLanguage, setSttLanguage] = useState("multi");
  const [llmModel, setLlmModel] = useState("");
  const [ttsModel, setTtsModel] = useState("");
  const [ttsVoice, setTtsVoice] = useState("");
  const [attachmentPath, setAttachmentPath] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loadingRow, setLoadingRow] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const title = useMemo(() => (isNew ? "New agent" : "Edit agent"), [isNew]);

  const loadRow = useCallback(async () => {
    if (!agentId || isNew || !user) return;
    setLoadingRow(true);
    setErr(null);
    const { data, error } = await supabase
      .from("voice_agents")
      .select("*")
      .eq("id", agentId)
      .maybeSingle();
    setLoadingRow(false);
    if (error) {
      setErr(error.message);
      return;
    }
    if (!data) {
      setErr("Agent not found.");
      return;
    }
    const row = data as VoiceAgentRow;
    const meta = (row.job_metadata ?? {}) as Record<string, unknown>;
    setName(row.name);
    setLivekitAgentName(row.livekit_agent_name);
    setInstructions(row.instructions);
    setOpeningScript(row.opening_script ?? "");
    setSttModel(String(meta.stt_model ?? ""));
    setSttLanguage(String(meta.stt_language ?? "multi"));
    setLlmModel(String(meta.llm_model ?? ""));
    setTtsModel(String(meta.tts_model ?? ""));
    setTtsVoice(String(meta.tts_voice ?? ""));
    setMetadataJson(JSON.stringify(stripModelKeys(meta), null, 2));
    setAttachmentPath(row.attachment_storage_path);
  }, [agentId, isNew, user]);

  useEffect(() => {
    void loadRow();
  }, [loadRow]);

  async function uploadAttachment(agentPk: string, f: File) {
    if (!user) throw new Error("Not signed in");
    const path = `${user.id}/${agentPk}/${safeFileSegment(f.name)}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, f, {
      upsert: true,
      contentType: f.type || undefined,
    });
    if (upErr) throw upErr;
    const { error: dbErr } = await supabase
      .from("voice_agents")
      .update({ attachment_storage_path: path })
      .eq("id", agentPk);
    if (dbErr) throw dbErr;
    setAttachmentPath(path);
    setFile(null);
  }

  async function signedDownloadUrl(path: string) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
    if (error) throw error;
    return data.signedUrl;
  }

  async function removeAttachment(agentPk: string, path: string) {
    const { error: rmErr } = await supabase.storage.from(BUCKET).remove([path]);
    if (rmErr) throw rmErr;
    const { error: dbErr } = await supabase
      .from("voice_agents")
      .update({ attachment_storage_path: null })
      .eq("id", agentPk);
    if (dbErr) throw dbErr;
    setAttachmentPath(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setErr(null);

    let job_metadata: Record<string, unknown>;
    try {
      const parsed = JSON.parse(metadataJson || "{}") as Record<string, unknown>;
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Job metadata must be a JSON object.");
      }
      job_metadata = mergeModelKeysIntoJobMetadata(parsed, {
        stt_model: sttModel,
        stt_language: sttLanguage,
        llm_model: llmModel,
        tts_model: ttsModel,
        tts_voice: ttsVoice,
      });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Invalid JSON for job metadata.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        user_id: user.id,
        name: name.trim() || "Untitled agent",
        livekit_agent_name: livekitAgentName.trim() || "my-agent",
        instructions,
        opening_script: openingScript.trim() ? openingScript.trim() : null,
        job_metadata,
      };

      if (isNew) {
        const { data, error } = await supabase.from("voice_agents").insert(payload).select().single();
        if (error) throw error;
        const row = data as VoiceAgentRow;
        if (file) await uploadAttachment(row.id, file);
        navigate(`/studio/agents/${row.id}`, { replace: true });
      } else if (agentId) {
        const { error } = await supabase.from("voice_agents").update(payload).eq("id", agentId);
        if (error) throw error;
        if (file) await uploadAttachment(agentId, file);
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (!isNew && loadingRow) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-ink-900/80" />
        <div className="text-sm text-slate-500">Loading agent…</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-white">{title}</h1>
          <p className="mt-2 max-w-xl text-sm text-slate-400">
            Maps to LiveKit job metadata and worker prompts. Use tabs for browser demo and outbound dialing.
          </p>
        </div>
        <Link to="/studio/agents" className="text-sm text-emerald-400 hover:text-emerald-300">
          ← All agents
        </Link>
      </div>

      {err ? (
        <div className="mb-6 rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          {err}
        </div>
      ) : null}

      <form onSubmit={(e) => void onSubmit(e)} className="max-w-3xl space-y-6">
        <section className="studio-card space-y-4 rounded-2xl border border-white/[0.08] bg-ink-900/60 p-6">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Display name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl bg-ink-950 border border-white/10 px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              placeholder="Outbound sales — Vikas"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">LiveKit agent name</label>
            <input
              value={livekitAgentName}
              onChange={(e) => setLivekitAgentName(e.target.value)}
              className="w-full rounded-xl bg-ink-950 border border-white/10 px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              placeholder="my-agent"
            />
            <p className="text-xs text-slate-500 mt-1">
              Must match the worker dispatch name (for example{" "}
              <code className="text-slate-400">rtc_session(agent_name=&quot;…&quot;)</code>).
            </p>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Instructions (system prompt)</label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={6}
              className="w-full rounded-xl bg-ink-950 border border-white/10 px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              placeholder="You are …"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Opening script / outbound payload text (optional)
            </label>
            <textarea
              value={openingScript}
              onChange={(e) => setOpeningScript(e.target.value)}
              rows={4}
              className="w-full rounded-xl bg-ink-950 border border-white/10 px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              placeholder="Passed as opening_script in job metadata when you dial out."
            />
          </div>

          <div className="space-y-3 rounded-xl border border-white/[0.06] bg-ink-950/40 p-4">
            <h3 className="text-sm font-medium text-slate-200">LiveKit Inference overrides</h3>
            <p className="text-xs text-slate-500">
              Stored in <code className="text-slate-400">job_metadata</code>. Leave blank to use worker defaults (
              <span className="font-mono text-slate-500">deepgram/nova-3</span>,{" "}
              <span className="font-mono text-slate-500">openai/gpt-4.1-mini</span>, Cartesia sonic).
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">stt_model</label>
                <input
                  value={sttModel}
                  onChange={(e) => setSttModel(e.target.value)}
                  className="w-full rounded-lg bg-ink-950 border border-white/10 px-3 py-2 text-white font-mono text-xs"
                  placeholder="deepgram/nova-3"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">stt_language</label>
                <input
                  value={sttLanguage}
                  onChange={(e) => setSttLanguage(e.target.value)}
                  className="w-full rounded-lg bg-ink-950 border border-white/10 px-3 py-2 text-white font-mono text-xs"
                  placeholder="multi"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">llm_model</label>
                <input
                  value={llmModel}
                  onChange={(e) => setLlmModel(e.target.value)}
                  className="w-full rounded-lg bg-ink-950 border border-white/10 px-3 py-2 text-white font-mono text-xs"
                  placeholder="openai/gpt-4.1-mini"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">tts_model</label>
                <input
                  value={ttsModel}
                  onChange={(e) => setTtsModel(e.target.value)}
                  className="w-full rounded-lg bg-ink-950 border border-white/10 px-3 py-2 text-white font-mono text-xs"
                  placeholder="cartesia/sonic-3"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-slate-500 mb-1">tts_voice</label>
                <input
                  value={ttsVoice}
                  onChange={(e) => setTtsVoice(e.target.value)}
                  className="w-full rounded-lg bg-ink-950 border border-white/10 px-3 py-2 text-white font-mono text-xs"
                  placeholder="Cartesia voice id"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Extra job metadata (JSON object)
            </label>
            <textarea
              value={metadataJson}
              onChange={(e) => setMetadataJson(e.target.value)}
              rows={8}
              className="w-full rounded-xl bg-ink-950 border border-white/10 px-4 py-2.5 text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              spellCheck={false}
            />
            <p className="text-xs text-slate-500 mt-1">
              Merged into LiveKit job metadata (for example{" "}
              <code className="text-slate-400">user_name</code>,{" "}
              <code className="text-slate-400">two_step</code>). Model keys above are saved separately from this JSON.
            </p>
          </div>
        </section>

        {!isNew && agentId ? (
          <section className="rounded-2xl border border-emerald-500/20 bg-emerald-950/15 px-6 py-4 text-sm text-slate-400">
            Run this agent from the{" "}
            <Link to={`/studio/demo?agent=${encodeURIComponent(agentId)}`} className="font-medium text-emerald-300 hover:text-emerald-200">
              Voice demo
            </Link>{" "}
            or{" "}
            <Link to={`/studio/outbound?agent=${encodeURIComponent(agentId)}`} className="font-medium text-emerald-300 hover:text-emerald-200">
              Outbound
            </Link>{" "}
            tabs.
          </section>
        ) : null}

        <section className="studio-card space-y-3 rounded-2xl border border-white/[0.08] bg-ink-900/60 p-6">
          <h2 className="font-display text-lg text-white">Storage attachment</h2>
          <p className="text-sm text-slate-400">
            Private bucket <span className="text-slate-300">{BUCKET}</span>. Files are saved under your
            user id then agent id.
          </p>
          {attachmentPath ? (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-slate-400 font-mono text-xs break-all">{attachmentPath}</span>
              <button
                type="button"
                className="rounded-lg border border-white/15 px-3 py-1.5 text-slate-200 hover:bg-white/5"
                onClick={() => {
                  void (async () => {
                    try {
                      const url = await signedDownloadUrl(attachmentPath);
                      window.open(url, "_blank", "noopener,noreferrer");
                    } catch (e: unknown) {
                      setErr(e instanceof Error ? e.message : "Download failed");
                    }
                  })();
                }}
              >
                Signed URL
              </button>
              {!isNew && agentId ? (
                <button
                  type="button"
                  className="rounded-lg border border-red-500/30 px-3 py-1.5 text-red-300 hover:bg-red-950/40"
                  onClick={() => {
                    void (async () => {
                      try {
                        await removeAttachment(agentId, attachmentPath);
                      } catch (e: unknown) {
                        setErr(e instanceof Error ? e.message : "Remove failed");
                      }
                    })();
                  }}
                >
                  Remove file
                </button>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-slate-500">No file attached yet.</p>
          )}
          <div>
            <label className="block text-sm text-slate-400 mb-1">Upload file</label>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-slate-400 file:mr-4 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-slate-200"
            />
            <p className="text-xs text-slate-500 mt-1">
              Saves when you click Save. For new agents, the row is created first, then the upload runs.
            </p>
          </div>
        </section>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving || (!isNew && !!loadingRow)}
            className="rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium px-5 py-2.5 text-sm"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <Link
            to="/studio/agents"
            className="inline-flex items-center rounded-xl border border-white/15 px-5 py-2.5 text-sm text-slate-200 hover:bg-white/5"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
