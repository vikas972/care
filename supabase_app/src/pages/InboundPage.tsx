export default function InboundPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl text-white">Inbound calls</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          PSTN → LiveKit SIP → your worker. Product routing is configured in LiveKit Cloud today; per-DID → agent mapping
          can be added later.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="studio-card rounded-2xl border border-white/[0.08] bg-ink-900/60 p-6">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500/15 text-teal-300 ring-1 ring-teal-500/25">
            1
          </div>
          <h2 className="font-display text-lg text-white">SIP inbound trunk</h2>
          <p className="mt-2 text-sm text-slate-400">
            In LiveKit Cloud, create an <strong className="text-slate-300">inbound SIP trunk</strong> and attach your PSTN / DID provider per LiveKit SIP docs.
          </p>
        </section>

        <section className="studio-card rounded-2xl border border-white/[0.08] bg-ink-900/60 p-6">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500/15 text-teal-300 ring-1 ring-teal-500/25">
            2
          </div>
          <h2 className="font-display text-lg text-white">Dispatch rule</h2>
          <p className="mt-2 text-sm text-slate-400">
            Add a <strong className="text-slate-300">dispatch rule</strong> so inbound calls join a room and dispatch your agent worker by{" "}
            <code className="rounded bg-black/30 px-1 text-xs text-slate-300">livekit_agent_name</code> (same value as in your agent rows).
          </p>
        </section>

        <section className="studio-card rounded-2xl border border-white/[0.08] bg-ink-900/60 p-6 md:col-span-2">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500/15 text-teal-300 ring-1 ring-teal-500/25">
            3
          </div>
          <h2 className="font-display text-lg text-white">Worker deployment</h2>
          <p className="mt-2 text-sm text-slate-400">
            Keep your <code className="rounded bg-black/30 px-1 text-xs">my-agent</code> (or custom) worker running on LiveKit Cloud. Inbound callers use the same pipeline as outbound once media reaches the room.
          </p>
        </section>
      </div>

      <p className="text-xs text-slate-600">
        CLI reference: LiveKit CLI (<code className="text-slate-500">lk</code>) can manage SIP trunks — see AGENTS.md in{" "}
        <code className="text-slate-500">voice_agent/my-agent</code>.
      </p>
    </div>
  );
}
