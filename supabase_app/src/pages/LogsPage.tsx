export default function LogsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-white">Logs</h1>
        <p className="mt-2 text-sm text-slate-500">
          Call and session logs will appear here once wired to LiveKit webhooks or a logging pipeline.
        </p>
      </div>
      <div className="rounded-2xl border border-dashed border-white/10 bg-[#121215]/50 px-8 py-16 text-center text-sm text-slate-600">
        No events recorded yet.
      </div>
    </div>
  );
}
