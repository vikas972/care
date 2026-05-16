export default function LogsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-studio-heading">Logs</h1>
        <p className="mt-2 text-sm text-studio-muted">
          Call and session logs will appear here once wired to LiveKit webhooks or a logging pipeline.
        </p>
      </div>
      <div className="rounded-2xl border border-dashed border-studio-border bg-studio-surface/50 px-8 py-16 text-center text-sm text-studio-faint">
        No events recorded yet.
      </div>
    </div>
  );
}
