import { apiBase, apiUsesRelativePaths } from "../lib/api";

export default function SetupPage() {
  const api = apiBase();
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl text-studio-heading">Setup</h1>
        <p className="mt-2 max-w-2xl text-sm text-studio-secondary">
          Use the standalone Voice BFF in{" "}
          <code className="rounded bg-black/40 px-1 text-xs text-studio-secondary">platform/api</code> (not the main SmartCall API).
          Secrets stay on the server — never commit <code className="text-studio-muted">service_role</code>.
        </p>
      </div>

      <div className="space-y-4">
        <CheckRow ok={!!supabaseUrl} title="Supabase URL (browser)" detail={supabaseUrl || "Missing VITE_SUPABASE_URL"} />
        <CheckRow
          ok={!!api || apiUsesRelativePaths()}
          title="FastAPI base URL"
          detail={
            api ||
            (apiUsesRelativePaths()
              ? "Same-origin /voice → FastAPI (Vite proxy to port 8001 in dev; nginx in production)"
              : "Missing VITE_API_BASE_URL")
          }
        />
        <CheckRow
          ok={!!import.meta.env.VITE_SUPABASE_ANON_KEY}
          title="Supabase anon key"
          detail={import.meta.env.VITE_SUPABASE_ANON_KEY ? "Present" : "Missing VITE_SUPABASE_ANON_KEY"}
        />
      </div>

      <section className="rounded-2xl border border-studio-border bg-studio-surface/60 p-6">
        <h2 className="font-display text-lg text-studio-heading">Voice BFF (<code className="text-studio-muted">platform/api/.env</code>)</h2>
        <ul className="mt-4 space-y-2 text-sm text-studio-secondary">
          <li>
            Run:{" "}
            <code className="rounded bg-black/40 px-1 text-xs">
              cd platform/api && uvicorn voice_bff.main:app --reload --host 0.0.0.0 --port 8001
            </code>
          </li>
          <li>
            <code className="text-studio-muted">SUPABASE_URL</code>, <code className="text-studio-muted">SUPABASE_SERVICE_ROLE_KEY</code>, JWT verification settings
          </li>
          <li>
            <code className="text-studio-muted">LIVEKIT_URL</code>, <code className="text-studio-muted">LIVEKIT_API_KEY</code>,{" "}
            <code className="text-studio-muted">LIVEKIT_API_SECRET</code>
          </li>
          <li>
            Outbound: <code className="text-studio-muted">LIVEKIT_SIP_OUTBOUND_TRUNK</code>, optional{" "}
            <code className="text-studio-muted">LIVEKIT_SIP_NUMBER</code>
          </li>
          <li>
            CORS includes this app origin (e.g. <code className="text-studio-muted">http://localhost:5174</code>)
          </li>
        </ul>
      </section>

      <section className="rounded-2xl border border-studio-border bg-studio-surface/60 p-6">
        <h2 className="font-display text-lg text-studio-heading">Database</h2>
        <p className="mt-2 text-sm text-studio-secondary">
          Run <code className="rounded bg-black/30 px-1 text-xs">platform/database/schema.sql</code> in the Supabase SQL editor for{" "}
          <code className="text-studio-muted">voice_agents</code> and storage policies.
        </p>
      </section>
    </div>
  );
}

function CheckRow({ ok, title, detail }: { ok: boolean; title: string; detail: string }) {
  return (
    <div className="flex flex-wrap items-start gap-4 rounded-xl border border-studio-border-subtle bg-studio-surface/70 px-4 py-3">
      <span
        className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          ok ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/35" : "bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/30"
        }`}
      >
        {ok ? "✓" : "!"}
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-studio-text">{title}</div>
        <div className="mt-1 break-all font-mono text-xs text-studio-muted">{detail}</div>
      </div>
    </div>
  );
}
