export default function MetricsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-white">Metrics</h1>
        <p className="mt-2 text-sm text-slate-500">
          Aggregate usage and latency charts can plug in here (LiveKit Analytics, Supabase metrics, or custom dashboards).
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {["Sessions", "Minutes", "Errors"].map((label) => (
          <div
            key={label}
            className="rounded-2xl border border-white/[0.06] bg-[#121215]/80 px-5 py-8 text-center text-slate-600"
          >
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
            <div className="mt-3 font-display text-2xl text-slate-700">—</div>
          </div>
        ))}
      </div>
    </div>
  );
}
