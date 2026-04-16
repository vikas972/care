import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, clearToken, getApiBase } from "../api";

type UserMe = {
  id: number;
  email: string;
  name: string | null;
  has_phone: boolean;
  call_provider: string;
};
type CalEvent = {
  id: number;
  title: string | null;
  start_time: string;
  reminder_time: string;
  status: string;
};
type Medicine = {
  id: number;
  medicine_name: string;
  schedule_time: string;
  frequency: string;
  day_of_week: number | null;
  next_fire_at: string;
  status: string;
  target_phone_masked?: string | null;
  message?: string | null;
};
type CallLog = {
  id: number;
  type: string;
  reference_id: number;
  status: string;
  retries: number;
  dtmf_digit: string | null;
  provider_call_sid: string | null;
  provider?: string;
  raw_payload?: { [k: string]: unknown } | null;
  reference_label?: string | null;
  reference_when?: string | null;
};

function padTime(t: string): string {
  if (t.length === 5 && t.includes(":")) return `${t}:00`;
  return t;
}

export default function Dashboard() {
  const [user, setUser] = useState<UserMe | null>(null);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [meds, setMeds] = useState<Medicine[]>([]);
  const [logs, setLogs] = useState<CallLog[]>([]);
  const [phone, setPhone] = useState("");
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [medName, setMedName] = useState("");
  const [medTime, setMedTime] = useState("09:00");
  const [medFreq, setMedFreq] = useState<"daily" | "weekly">("daily");
  const [medDow, setMedDow] = useState(1);
  const [medPhone, setMedPhone] = useState("");
  const [medMsg, setMedMsg] = useState("");
  const [editingMedId, setEditingMedId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editTime, setEditTime] = useState("09:00");
  const [editFreq, setEditFreq] = useState<"daily" | "weekly">("daily");
  const [editDow, setEditDow] = useState(1);
  const [editPhone, setEditPhone] = useState("");
  const [editMsg, setEditMsg] = useState("");
  const [callProvider, setCallProvider] = useState<"exotel" | "twilio">("exotel");
  const [providerMsg, setProviderMsg] = useState<string | null>(null);
  const [logProviderFilter, setLogProviderFilter] = useState<"mine" | "all" | "exotel" | "twilio">(
    "mine",
  );
  const [logStatusFilter, setLogStatusFilter] = useState<string>("all");
  const [logTypeFilter, setLogTypeFilter] = useState<"all" | "event" | "medicine">("all");

  const load = useCallback(async () => {
    setErr(null);
    try {
      const [u, e, m] = await Promise.all([
        api<UserMe>("/users/me"),
        api<CalEvent[]>("/calendar/events"),
        api<Medicine[]>("/medicine"),
      ]);
      setUser(u);
      const p = u?.call_provider === "twilio" ? "twilio" : "exotel";
      setCallProvider(p);
      if (logProviderFilter === "mine") {
        // keep in sync with selected provider unless user explicitly picked a filter
        // (mine means "current provider")
        // no state update needed here besides using p in fetch below
      }
      setEvents(e || []);
      setMeds(m || []);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  const loadLogs = useCallback(
    async (currentProvider: "exotel" | "twilio") => {
      setErr(null);
      const params = new URLSearchParams();
      params.set("limit", "20");
      const provider =
        logProviderFilter === "mine"
          ? currentProvider
          : logProviderFilter === "all"
            ? ""
            : logProviderFilter;
      if (provider) params.set("provider", provider);
      if (logStatusFilter !== "all") params.set("status", logStatusFilter);
      if (logTypeFilter !== "all") params.set("type", logTypeFilter);
      const l = await api<CallLog[]>(`/calls/logs-with-payload?${params.toString()}`);
      setLogs(l || []);
    },
    [logProviderFilter, logStatusFilter, logTypeFilter],
  );

  useEffect(() => {
    void (async () => {
      await load();
      // fetch logs after load so we know the current provider
      const u = await api<UserMe>("/users/me");
      const p = u?.call_provider === "twilio" ? "twilio" : "exotel";
      await loadLogs(p);
    })();
  }, [load, loadLogs]);

  useEffect(() => {
    if (!user) return;
    const p = user.call_provider === "twilio" ? "twilio" : "exotel";
    void loadLogs(p);
  }, [logProviderFilter, logStatusFilter, logTypeFilter, user, loadLogs]);

  async function saveCallProvider(next: "exotel" | "twilio") {
    setProviderMsg(null);
    setErr(null);
    try {
      await api("/users/me/call-provider", {
        method: "PATCH",
        body: JSON.stringify({ call_provider: next }),
      });
      setCallProvider(next);
      setProviderMsg(`Calling provider set to ${next}.`);
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to update provider");
    }
  }

  async function savePhone(ev: FormEvent) {
    ev.preventDefault();
    setErr(null);
    try {
      await api("/users/me/phone", {
        method: "PATCH",
        body: JSON.stringify({ phone_e164: phone }),
      });
      setPhone("");
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed");
    }
  }

  async function checkCalendarConnection() {
    setSyncMsg(null);
    setErr(null);
    try {
      const r = await api<{ ok: boolean; message: string }>("/calendar/connection");
      if (r?.ok) {
        setSyncMsg(`Calendar: ${r.message}`);
      } else {
        setErr(r?.message || "Calendar check failed");
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Calendar check failed");
    }
  }

  async function syncCal() {
    setSyncMsg(null);
    setErr(null);
    try {
      const r = await api<{
        upserted: number;
        events_from_google: number;
        skipped_past_reminder: number;
      }>("/calendar/sync", { method: "POST" });
      const u = r?.upserted ?? 0;
      const g = r?.events_from_google ?? 0;
      const sk = r?.skipped_past_reminder ?? 0;
      setSyncMsg(
        `Synced — ${u} upcoming reminder(s) saved. Google returned ${g} event(s) in the next 14 days; ${sk} skipped (reminder time already passed).`,
      );
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Sync failed");
    }
  }

  async function addMedicine(ev: FormEvent) {
    ev.preventDefault();
    setErr(null);
    try {
      await api("/medicine", {
        method: "POST",
        body: JSON.stringify({
          medicine_name: medName,
          schedule_time: padTime(medTime),
          frequency: medFreq,
          day_of_week: medFreq === "weekly" ? medDow : null,
          target_phone_e164: medPhone,
          message: medMsg || null,
        }),
      });
      setMedName("");
      setMedPhone("");
      setMedMsg("");
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed");
    }
  }

  async function delMedicine(id: number) {
    if (!confirm("Delete this reminder?")) return;
    setErr(null);
    try {
      await api(`/medicine/${id}`, { method: "DELETE" });
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed");
    }
  }

  function startEditMedicine(m: Medicine) {
    setEditingMedId(m.id);
    setEditName(m.medicine_name);
    setEditTime((m.schedule_time || "09:00").slice(0, 5));
    setEditFreq(m.frequency === "weekly" ? "weekly" : "daily");
    setEditDow(m.day_of_week ?? 1);
    setEditPhone("");
    setEditMsg(m.message || "");
  }

  async function saveMedicineEdit(ev: FormEvent) {
    ev.preventDefault();
    if (editingMedId == null) return;
    setErr(null);
    try {
      await api(`/medicine/${editingMedId}`, {
        method: "PATCH",
        body: JSON.stringify({
          medicine_name: editName,
          schedule_time: padTime(editTime),
          frequency: editFreq,
          day_of_week: editFreq === "weekly" ? editDow : null,
          target_phone_e164: editPhone ? editPhone : null,
          message: editMsg ? editMsg : null,
        }),
      });
      setEditingMedId(null);
      setEditPhone("");
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to update medicine reminder");
    }
  }

  function logout() {
    clearToken();
    window.location.href = "/";
  }

  return (
    <div className="min-h-screen pb-20">
      <header className="border-b border-white/5 bg-ink-950/90 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link to="/" className="font-display text-xl text-white">
              SmartCall
            </Link>
            <p className="text-xs text-slate-500 mt-0.5">Demo console</p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-400 truncate max-w-[200px]">{user?.email}</span>
            <button
              type="button"
              onClick={logout}
              className="text-slate-400 hover:text-white transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {err ? (
          <div className="rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {err}
          </div>
        ) : null}

        <section className="rounded-2xl border border-white/10 bg-ink-900/50 p-6 md:p-8">
          <h2 className="font-display text-2xl text-white mb-2">Your profile</h2>
          <p className="text-slate-400 text-sm mb-6">
            API base: <code className="text-emerald-400/90">{getApiBase()}</code>
          </p>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <p className="text-sm text-slate-500 mb-1">Name</p>
              <p className="text-white">{user?.name || "—"}</p>
              <p className="text-sm text-slate-500 mt-4 mb-1">Phone for calendar calls</p>
              <p className="text-white">{user?.has_phone ? "Saved (encrypted)" : "Not set"}</p>
              <p className="text-sm text-slate-500 mt-4 mb-1">Calling provider</p>
              <p className="text-white capitalize">{user?.call_provider || "exotel"}</p>
            </div>
            <form onSubmit={savePhone} className="space-y-3">
              <label className="block text-sm text-slate-400">Set / update your number (E.164)</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+919876543210"
                className="w-full rounded-xl bg-ink-950 border border-white/10 px-4 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
              <button
                type="submit"
                className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-4 py-2 text-sm"
              >
                Save phone
              </button>
            </form>
            <div className="md:col-span-2 mt-6 pt-6 border-t border-white/10">
              <p className="text-sm text-slate-400 mb-3">
                Choose Exotel or Twilio for outbound reminder calls (server must have that provider configured).
              </p>
              <div className="flex flex-wrap gap-3 items-center">
                <select
                  value={callProvider}
                  onChange={(e) => setCallProvider(e.target.value as "exotel" | "twilio")}
                  className="rounded-xl bg-ink-950 border border-white/10 px-4 py-2.5 text-white text-sm"
                >
                  <option value="exotel">Exotel</option>
                  <option value="twilio">Twilio</option>
                </select>
                <button
                  type="button"
                  onClick={() => void saveCallProvider(callProvider)}
                  className="rounded-xl border border-slate-500 text-slate-200 font-medium px-4 py-2 text-sm hover:bg-white/5"
                >
                  Save provider
                </button>
              </div>
              {providerMsg ? <p className="text-emerald-400 text-sm mt-2">{providerMsg}</p> : null}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-ink-900/50 p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div>
              <h2 className="font-display text-2xl text-white">Calendar reminders</h2>
              <p className="text-slate-400 text-sm mt-1">
                Calls fire ~15 minutes before each synced event (Celery + your chosen provider).
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void checkCalendarConnection()}
                className="rounded-xl border border-slate-500 text-slate-200 font-medium px-5 py-2.5 text-sm hover:bg-white/5"
              >
                Test Calendar API
              </button>
              <button
                type="button"
                onClick={() => void syncCal()}
                className="rounded-xl bg-white text-ink-950 font-semibold px-5 py-2.5 text-sm hover:bg-slate-200"
              >
                Sync Google Calendar
              </button>
            </div>
          </div>
          {syncMsg ? <p className="text-emerald-400 text-sm mb-4">{syncMsg}</p> : null}
          <div className="overflow-x-auto rounded-xl border border-white/5">
            <table className="w-full text-sm text-left">
              <thead className="bg-ink-950/80 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Starts</th>
                  <th className="px-4 py-3 font-medium">Reminder call</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {events.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                      No pending events — sync your calendar after signing in with Google.
                    </td>
                  </tr>
                ) : (
                  events.map((ev) => (
                    <tr key={ev.id} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3 text-white">{ev.title || "(no title)"}</td>
                      <td className="px-4 py-3 text-slate-400">
                        {new Date(ev.start_time).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {new Date(ev.reminder_time).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-emerald-500/15 text-emerald-400 px-2 py-0.5 text-xs">
                          {ev.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-ink-900/50 p-6 md:p-8">
          <h2 className="font-display text-2xl text-white mb-2">Medicine reminders</h2>
          <p className="text-slate-400 text-sm mb-6">
            Outbound call to the number you set; press 1 to acknowledge (Twilio) or per your Exotel flow.
          </p>
          <form
            onSubmit={(e) => void addMedicine(e)}
            className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 p-4 rounded-xl bg-ink-950/50 border border-white/5"
          >
            <input
              required
              placeholder="Medicine name"
              value={medName}
              onChange={(e) => setMedName(e.target.value)}
              className="rounded-lg bg-ink-900 border border-white/10 px-3 py-2 text-white text-sm"
            />
            <input
              type="time"
              value={medTime}
              onChange={(e) => setMedTime(e.target.value)}
              className="rounded-lg bg-ink-900 border border-white/10 px-3 py-2 text-white text-sm"
            />
            <select
              value={medFreq}
              onChange={(e) => setMedFreq(e.target.value as "daily" | "weekly")}
              className="rounded-lg bg-ink-900 border border-white/10 px-3 py-2 text-white text-sm"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
            {medFreq === "weekly" ? (
              <select
                value={medDow}
                onChange={(e) => setMedDow(Number(e.target.value))}
                className="rounded-lg bg-ink-900 border border-white/10 px-3 py-2 text-white text-sm"
              >
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-slate-600 text-sm self-center">—</span>
            )}
            <input
              required
              type="tel"
              placeholder="Target phone E.164"
              value={medPhone}
              onChange={(e) => setMedPhone(e.target.value)}
              className="rounded-lg bg-ink-900 border border-white/10 px-3 py-2 text-white text-sm md:col-span-2"
            />
            <input
              type="text"
              placeholder="Custom message (optional)"
              value={medMsg}
              onChange={(e) => setMedMsg(e.target.value)}
              className="rounded-lg bg-ink-900 border border-white/10 px-3 py-2 text-white text-sm lg:col-span-2"
            />
            <button
              type="submit"
              className="rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2 text-sm lg:col-span-2"
            >
              Add schedule
            </button>
          </form>
          <ul className="space-y-2">
            {meds.length === 0 ? (
              <li className="text-slate-500 text-sm">No medicine schedules yet.</li>
            ) : (
              meds.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/5 bg-ink-950/40 px-4 py-3"
                >
                  <div className="min-w-[260px]">
                    <span className="text-white font-medium">{m.medicine_name}</span>
                    <span className="text-slate-500 text-sm ml-2">
                      {m.schedule_time} · {m.frequency}
                      {m.frequency === "weekly" && m.day_of_week != null
                        ? ` · dow ${m.day_of_week}`
                        : ""}
                    </span>
                    <p className="text-xs text-slate-500 mt-1">
                      Next: {new Date(m.next_fire_at).toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-500">
                      Phone: {m.target_phone_masked || "—"}
                    </p>
                    {m.message ? (
                      <p className="text-xs text-slate-500">
                        Message: <span className="text-slate-400">{m.message}</span>
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => startEditMedicine(m)}
                      className="text-xs text-emerald-400 hover:text-emerald-300"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void delMedicine(m.id)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Delete
                    </button>
                  </div>

                  {editingMedId === m.id ? (
                    <form
                      onSubmit={(e) => void saveMedicineEdit(e)}
                      className="w-full mt-3 grid md:grid-cols-2 lg:grid-cols-4 gap-3 rounded-xl border border-white/10 bg-ink-950/50 p-4"
                    >
                      <input
                        required
                        placeholder="Medicine name"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="rounded-lg bg-ink-900 border border-white/10 px-3 py-2 text-white text-sm"
                      />
                      <input
                        type="time"
                        value={editTime}
                        onChange={(e) => setEditTime(e.target.value)}
                        className="rounded-lg bg-ink-900 border border-white/10 px-3 py-2 text-white text-sm"
                      />
                      <select
                        value={editFreq}
                        onChange={(e) => setEditFreq(e.target.value as "daily" | "weekly")}
                        className="rounded-lg bg-ink-900 border border-white/10 px-3 py-2 text-white text-sm"
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                      </select>
                      {editFreq === "weekly" ? (
                        <select
                          value={editDow}
                          onChange={(e) => setEditDow(Number(e.target.value))}
                          className="rounded-lg bg-ink-900 border border-white/10 px-3 py-2 text-white text-sm"
                        >
                          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => (
                            <option key={d} value={i}>
                              {d}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-slate-600 text-sm self-center">—</span>
                      )}
                      <input
                        type="tel"
                        placeholder="New target phone (optional)"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        className="rounded-lg bg-ink-900 border border-white/10 px-3 py-2 text-white text-sm md:col-span-2"
                      />
                      <input
                        type="text"
                        placeholder="Custom message (optional)"
                        value={editMsg}
                        onChange={(e) => setEditMsg(e.target.value)}
                        className="rounded-lg bg-ink-900 border border-white/10 px-3 py-2 text-white text-sm lg:col-span-2"
                      />
                      <div className="flex gap-3 lg:col-span-4">
                        <button
                          type="submit"
                          className="rounded-lg bg-white text-ink-950 font-semibold px-4 py-2 text-sm hover:bg-slate-200"
                        >
                          Save changes
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingMedId(null)}
                          className="rounded-lg border border-slate-500 text-slate-200 font-medium px-4 py-2 text-sm hover:bg-white/5"
                        >
                          Cancel
                        </button>
                      </div>
                      <p className="text-xs text-slate-500 lg:col-span-4">
                        Note: phone is stored encrypted, so we only show it masked; enter a new phone only if you want
                        to change it.
                      </p>
                    </form>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="rounded-2xl border border-white/10 bg-ink-900/50 p-6 md:p-8">
          <h2 className="font-display text-2xl text-white mb-4">Recent call logs</h2>
          <div className="flex flex-wrap gap-3 items-center mb-4">
            <select
              value={logProviderFilter}
              onChange={(e) =>
                setLogProviderFilter(e.target.value as "mine" | "all" | "exotel" | "twilio")
              }
              className="rounded-xl bg-ink-950 border border-white/10 px-4 py-2.5 text-white text-sm"
            >
              <option value="mine">My provider ({callProvider})</option>
              <option value="all">All providers</option>
              <option value="twilio">Twilio</option>
              <option value="exotel">Exotel</option>
            </select>
            <select
              value={logTypeFilter}
              onChange={(e) => setLogTypeFilter(e.target.value as "all" | "event" | "medicine")}
              className="rounded-xl bg-ink-950 border border-white/10 px-4 py-2.5 text-white text-sm"
            >
              <option value="all">All types</option>
              <option value="event">Event</option>
              <option value="medicine">Medicine</option>
            </select>
            <select
              value={logStatusFilter}
              onChange={(e) => setLogStatusFilter(e.target.value)}
              className="rounded-xl bg-ink-950 border border-white/10 px-4 py-2.5 text-white text-sm"
            >
              <option value="all">All statuses</option>
              <option value="queued">queued</option>
              <option value="ringing">ringing</option>
              <option value="in_progress">in_progress</option>
              <option value="completed">completed</option>
              <option value="acknowledged">acknowledged</option>
              <option value="no_answer">no_answer</option>
              <option value="busy">busy</option>
              <option value="failed">failed</option>
            </select>
          </div>
          <div className="overflow-x-auto rounded-xl border border-white/5">
            <table className="w-full text-sm text-left">
              <thead className="bg-ink-950/80 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">For</th>
                  <th className="px-4 py-3 font-medium">Provider</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">DTMF</th>
                  <th className="px-4 py-3 font-medium">Retries</th>
                  <th className="px-4 py-3 font-medium">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                      No calls yet — reminders appear here after the provider places calls.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id}>
                      <td className="px-4 py-3 text-slate-300">{log.type}</td>
                      <td className="px-4 py-3 text-slate-400">
                        <div className="text-slate-300">{log.reference_label || `#${log.reference_id}`}</div>
                        {log.reference_when ? (
                          <div className="text-xs text-slate-500">
                            {new Date(log.reference_when).toLocaleString()}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-400">{(log.provider as string) || "—"}</td>
                      <td className="px-4 py-3 text-slate-400">{log.status}</td>
                      <td className="px-4 py-3 text-slate-400">{log.dtmf_digit ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-400">{log.retries}</td>
                      <td className="px-4 py-3 text-slate-500">
                        {(() => {
                          const rp = log.raw_payload as any;
                          const e = rp?.error || rp?.retry_error;
                          return e ? String(e).slice(0, 140) : "—";
                        })()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
