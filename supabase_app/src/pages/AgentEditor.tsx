import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CollapsibleSection, FormField, FormSection } from "../components/FormSection";
import { Reveal } from "../components/Reveal";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import type { VoiceAgentRow } from "../types";

const BUCKET = "voice-agent-assets";

const MODEL_META_KEYS = ["stt_model", "llm_model", "tts_model", "tts_voice", "stt_language"] as const;

const PROMPT_TEMPLATES = [
  {
    id: "support",
    label: "Customer support",
    icon: "🎧",
    text: `You are a friendly customer support agent for our company.

Goals:
- Resolve questions clearly and quickly
- Stay calm and empathetic
- Escalate to a human when you cannot help

Rules:
- Keep replies short (1–3 sentences) unless the caller asks for detail
- Never invent policies or pricing — say you will check if unsure`,
  },
  {
    id: "sales",
    label: "Sales outreach",
    icon: "📞",
    text: `You are a professional sales development representative making outbound calls.

Goals:
- Qualify interest and book a follow-up meeting
- Sound natural, not scripted

Rules:
- Ask one question at a time
- If they are not interested, thank them and end politely
- Never pressure or argue`,
  },
  {
    id: "booking",
    label: "Appointment booking",
    icon: "📅",
    text: `You are a scheduling assistant helping callers book appointments.

Goals:
- Collect name, preferred date/time, and reason for visit
- Confirm details before ending the call

Rules:
- Repeat back the appointment summary
- Offer alternatives if the requested slot is unavailable`,
  },
] as const;

const MODEL_PRESETS = {
  default: { stt: "", lang: "multi", llm: "", tts: "", voice: "" },
  fast: {
    stt: "deepgram/nova-3",
    lang: "multi",
    llm: "openai/gpt-4.1-mini",
    tts: "cartesia/sonic-3",
    voice: "",
  },
} as const;

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

function slugifyLivekitName(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "my-agent"
  );
}

function safeFileSegment(name: string) {
  return name.replace(/[^\w.\-()+]/g, "_").slice(0, 180) || "file";
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AgentEditor() {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isNew = agentId === "new";

  const [name, setName] = useState("");
  const [livekitAgentName, setLivekitAgentName] = useState("my-agent");
  const [lkNameTouched, setLkNameTouched] = useState(false);
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

  const title = useMemo(() => (isNew ? "Create voice agent" : "Edit voice agent"), [isNew]);

  const progress = useMemo(() => {
    let n = 0;
    if (name.trim()) n++;
    if (livekitAgentName.trim()) n++;
    if (instructions.trim().length >= 20) n++;
    return Math.round((n / 3) * 100);
  }, [name, livekitAgentName, instructions]);

  const canSave = name.trim().length > 0 && instructions.trim().length >= 10;

  useEffect(() => {
    if (isNew && !lkNameTouched && name.trim()) {
      setLivekitAgentName(slugifyLivekitName(name));
    }
  }, [name, isNew, lkNameTouched]);

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
    setLkNameTouched(true);
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

  function applyTemplate(text: string) {
    setInstructions(text);
  }

  function applyModelPreset(preset: keyof typeof MODEL_PRESETS) {
    const p = MODEL_PRESETS[preset];
    setSttModel(p.stt);
    setSttLanguage(p.lang);
    setLlmModel(p.llm);
    setTtsModel(p.tts);
    setTtsVoice(p.voice);
  }

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
    if (!user || !canSave) return;
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
      <div className="mx-auto max-w-3xl space-y-4 py-8">
        <div className="h-9 w-56 animate-pulse rounded-lg bg-white/[0.06]" />
        <div className="h-64 animate-pulse rounded-2xl bg-white/[0.04]" />
        <div className="h-48 animate-pulse rounded-2xl bg-white/[0.04]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl pb-32">
      <Reveal>
        <header className="mb-8">
          <Link
            to="/studio/agents"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-teal-400"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            Back to agents
          </Link>
          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl text-white">{title}</h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-500">
                {isNew
                  ? "Give your agent a name and personality — you can test it in the browser right after saving."
                  : "Updates apply the next time this agent handles a call."}
              </p>
            </div>
            {isNew ? (
              <div className="w-full min-w-[200px] max-w-xs rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 sm:w-auto">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Setup progress</span>
                  <span className="font-medium text-teal-400">{progress}%</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <ul className="mt-3 space-y-1 text-[11px] text-slate-600">
                  <li className={name.trim() ? "text-teal-500/90" : ""}>{name.trim() ? "✓" : "○"} Agent name</li>
                  <li className={livekitAgentName.trim() ? "text-teal-500/90" : ""}>
                    {livekitAgentName.trim() ? "✓" : "○"} Worker name
                  </li>
                  <li className={instructions.trim().length >= 20 ? "text-teal-500/90" : ""}>
                    {instructions.trim().length >= 20 ? "✓" : "○"} Instructions (20+ chars)
                  </li>
                </ul>
              </div>
            ) : null}
          </div>
        </header>
      </Reveal>

      {err ? (
        <div className="mb-6 flex gap-3 rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          <span className="shrink-0 text-red-400" aria-hidden>
            !
          </span>
          {err}
        </div>
      ) : null}

      <form onSubmit={(e) => void onSubmit(e)} className="space-y-5">
        <Reveal delay={50}>
          <FormSection step={1} title="Identity" description="How you'll recognize this agent in the studio and on LiveKit.">
            <FormField label="Display name" htmlFor="agent-name" hint="Shown in your agent list — e.g. Support line or Sales bot.">
              <input
                id="agent-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="form-input text-base"
                placeholder="Customer support"
                autoFocus={isNew}
              />
            </FormField>
            <FormField
              label="LiveKit worker name"
              htmlFor="lk-name"
              hint='Technical ID for dispatch — must match agent_name in your worker (e.g. "customer-support").'
            >
              <div className="flex gap-2">
                <input
                  id="lk-name"
                  value={livekitAgentName}
                  onChange={(e) => {
                    setLkNameTouched(true);
                    setLivekitAgentName(e.target.value);
                  }}
                  className="form-input flex-1 font-mono text-sm"
                  placeholder="customer-support"
                />
                {isNew && lkNameTouched ? (
                  <button
                    type="button"
                    className="form-btn-secondary shrink-0 text-xs"
                    onClick={() => {
                      setLkNameTouched(false);
                      setLivekitAgentName(slugifyLivekitName(name));
                    }}
                  >
                    Auto
                  </button>
                ) : null}
              </div>
            </FormField>
          </FormSection>
        </Reveal>

        <Reveal delay={100}>
          <FormSection step={2} title="Personality" description="Defines how your agent thinks and speaks on calls.">
            {isNew ? (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-600">Start from a template</p>
                <div className="flex flex-wrap gap-2">
                  {PROMPT_TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => applyTemplate(t.text)}
                      className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-300 transition hover:border-teal-500/30 hover:bg-teal-500/[0.06] hover:text-white"
                    >
                      <span aria-hidden>{t.icon}</span>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <FormField
              label="System instructions"
              htmlFor="instructions"
              hint="The core prompt: role, tone, goals, and boundaries."
            >
              <textarea
                id="instructions"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={8}
                className="form-textarea leading-relaxed"
                placeholder="You are a helpful support agent for Acme Corp. Be concise, friendly, and never make up pricing…"
              />
              <p className="text-right text-[11px] text-slate-600">
                {instructions.length} characters
                {instructions.length < 20 && instructions.length > 0 ? " · add a bit more detail" : ""}
              </p>
            </FormField>

            <FormField
              label="Opening line"
              htmlFor="opening"
              optional
              hint="First sentence on outbound calls. Leave blank for the worker default."
            >
              <textarea
                id="opening"
                value={openingScript}
                onChange={(e) => setOpeningScript(e.target.value)}
                rows={2}
                className="form-textarea"
                placeholder="Hi, this is Alex from Acme — do you have a quick moment?"
              />
            </FormField>
          </FormSection>
        </Reveal>

        <Reveal delay={150}>
          <CollapsibleSection
            title="Voice & AI models"
            description="Override speech, language, and TTS defaults"
            badge="Optional"
          >
            <div className="flex flex-wrap gap-2">
              <button type="button" className="form-chip" onClick={() => applyModelPreset("default")}>
                Worker defaults
              </button>
              <button type="button" className="form-chip" onClick={() => applyModelPreset("fast")}>
                Recommended stack
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Leave blank to use worker defaults (Deepgram Nova, GPT-4.1 mini, Cartesia Sonic).
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Speech-to-text" htmlFor="stt">
                <input
                  id="stt"
                  value={sttModel}
                  onChange={(e) => setSttModel(e.target.value)}
                  className="form-input font-mono text-xs"
                  placeholder="deepgram/nova-3"
                />
              </FormField>
              <FormField label="Language" htmlFor="stt-lang">
                <input
                  id="stt-lang"
                  value={sttLanguage}
                  onChange={(e) => setSttLanguage(e.target.value)}
                  className="form-input font-mono text-xs"
                  placeholder="multi"
                />
              </FormField>
              <FormField label="LLM model" htmlFor="llm">
                <input
                  id="llm"
                  value={llmModel}
                  onChange={(e) => setLlmModel(e.target.value)}
                  className="form-input font-mono text-xs"
                  placeholder="openai/gpt-4.1-mini"
                />
              </FormField>
              <FormField label="TTS model" htmlFor="tts">
                <input
                  id="tts"
                  value={ttsModel}
                  onChange={(e) => setTtsModel(e.target.value)}
                  className="form-input font-mono text-xs"
                  placeholder="cartesia/sonic-3"
                />
              </FormField>
              <FormField label="TTS voice ID" htmlFor="tts-voice" optional>
                <input
                  id="tts-voice"
                  value={ttsVoice}
                  onChange={(e) => setTtsVoice(e.target.value)}
                  className="form-input font-mono text-xs sm:col-span-2"
                  placeholder="Cartesia voice id"
                />
              </FormField>
            </div>
          </CollapsibleSection>
        </Reveal>

        <Reveal delay={200}>
          <CollapsibleSection title="Custom metadata" description="Extra JSON merged into LiveKit job metadata" badge="Advanced">
            <FormField label="JSON object" hint='e.g. {"user_name": "Alex", "two_step": true} — model fields above are saved separately.'>
              <textarea
                value={metadataJson}
                onChange={(e) => setMetadataJson(e.target.value)}
                rows={5}
                className="form-textarea font-mono text-xs"
                spellCheck={false}
              />
            </FormField>
          </CollapsibleSection>
        </Reveal>

        <Reveal delay={250}>
          <CollapsibleSection title="Knowledge file" description="Optional document for agent context" badge="Optional">
            {attachmentPath ? (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500/15 text-teal-400">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75m8.25 12H9.75m4.5 0h7.5m-7.5 0h-3.375m0 0-.375-9.75A2.25 2.25 0 0 0 14.25 2.25h-2.652a2.25 2.25 0 0 0-1.591.659L6.75 6.75"
                    />
                  </svg>
                </div>
                <span className="min-w-0 flex-1 break-all font-mono text-xs text-slate-400">{attachmentPath}</span>
                <button
                  type="button"
                  className="form-btn-secondary text-xs"
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
                  Download
                </button>
                {!isNew && agentId ? (
                  <button
                    type="button"
                    className="form-btn-secondary text-xs text-red-300"
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
                    Remove
                  </button>
                ) : null}
              </div>
            ) : null}

            <label
              className={`form-dropzone ${file ? "form-dropzone-active" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add("form-dropzone-drag");
              }}
              onDragLeave={(e) => e.currentTarget.classList.remove("form-dropzone-drag")}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove("form-dropzone-drag");
                const f = e.dataTransfer.files?.[0];
                if (f) setFile(f);
              }}
            >
              <input
                type="file"
                className="sr-only"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {file ? (
                <>
                  <span className="font-medium text-teal-300">{file.name}</span>
                  <span className="text-xs text-slate-500">{formatBytes(file.size)} · click to change</span>
                </>
              ) : (
                <>
                  <svg className="mx-auto h-8 w-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  <span className="mt-2 block text-sm text-slate-400">Drop a file or click to browse</span>
                  <span className="mt-1 block text-xs text-slate-600">Uploaded when you save</span>
                </>
              )}
            </label>
          </CollapsibleSection>
        </Reveal>

        {!isNew && agentId ? (
          <div className="flex flex-wrap gap-3 rounded-xl border border-teal-500/20 bg-teal-500/[0.06] px-4 py-3 text-sm">
            <span className="text-slate-400">Ready to try it?</span>
            <Link to={`/studio/demo?agent=${encodeURIComponent(agentId)}`} className="font-medium text-teal-400 hover:text-teal-300">
              Run voice demo →
            </Link>
            <Link
              to={`/studio/outbound?agent=${encodeURIComponent(agentId)}`}
              className="font-medium text-slate-400 hover:text-slate-300"
            >
              Outbound call →
            </Link>
          </div>
        ) : null}

        <div className="form-actions-bar">
          <button type="submit" disabled={saving || !canSave || (!isNew && !!loadingRow)} className="form-btn-primary">
            {saving ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#041210]/30 border-t-[#041210]" />
                Saving…
              </span>
            ) : isNew ? (
              "Create agent"
            ) : (
              "Save changes"
            )}
          </button>
          <Link to="/studio/agents" className="form-btn-secondary">
            Cancel
          </Link>
          {isNew && !canSave ? (
            <span className="hidden text-xs text-slate-600 sm:inline">Add a name and instructions to continue</span>
          ) : null}
        </div>
      </form>
    </div>
  );
}
