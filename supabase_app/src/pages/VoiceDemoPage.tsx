import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ConnectionState,
  LocalAudioTrack,
  Room,
  RoomEvent,
  Track,
  createLocalAudioTrack,
} from "livekit-client";
import { useAuth } from "../contexts/AuthContext";
import { useVoiceAgents } from "../hooks/useVoiceAgents";
import { apiUrl, parseFastApiDetail } from "../lib/api";

type LogLine = { t: number; msg: string };

export default function VoiceDemoPage() {
  const { session } = useAuth();
  const { rows, loading, err: loadErr, reload } = useVoiceAgents();
  const [searchParams, setSearchParams] = useSearchParams();

  const agentId = searchParams.get("agent") ?? "";

  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [roomName, setRoomName] = useState("");
  const [status, setStatus] = useState<ConnectionState>(ConnectionState.Disconnected);
  const [err, setErr] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [micOn, setMicOn] = useState(false);
  const [starting, setStarting] = useState(false);

  const roomRef = useRef<Room | null>(null);
  const micTrackRef = useRef<LocalAudioTrack | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  const canConnect = useMemo(() => !!url && !!token, [url, token]);

  const selectedAgent = useMemo(() => rows.find((r) => r.id === agentId), [rows, agentId]);

  useEffect(() => {
    if (!loading && rows.length && !agentId) {
      const first = rows[0]?.id;
      if (first) setSearchParams({ agent: first }, { replace: true });
    }
  }, [loading, rows, agentId, setSearchParams]);

  function addLog(msg: string) {
    setLogs((x) => [...x.slice(-199), { t: Date.now(), msg }]);
  }

  async function startDemoSession() {
    setErr(null);
    if (!agentId) {
      setErr("Choose an agent above.");
      return;
    }
    const access = session?.access_token;
    if (!access) {
      setErr("Not signed in.");
      return;
    }

    setStarting(true);
    try {
      const res = await fetch(apiUrl("/voice/livekit/demo-session"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${access}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ agent_id: agentId }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        detail?: unknown;
        url?: string;
        room?: string;
        token?: string;
      };
      if (!res.ok) throw new Error(parseFastApiDetail(body));
      if (!body.token || !body.url || !body.room) throw new Error("Bad response from demo-session");
      setUrl(body.url);
      setToken(body.token);
      setRoomName(body.room);
      addLog(`session ready — room ${body.room}`);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to start demo");
      addLog(`error: ${e instanceof Error ? e.message : "start failed"}`);
    } finally {
      setStarting(false);
    }
  }

  async function connect() {
    setErr(null);
    if (!canConnect) return;
    try {
      const room = new Room();
      roomRef.current = room;
      room
        .on(RoomEvent.ConnectionStateChanged, (s) => setStatus(s))
        .on(RoomEvent.ParticipantConnected, (p) => addLog(`participant joined: ${p.identity}`))
        .on(RoomEvent.ParticipantDisconnected, (p) => addLog(`participant left: ${p.identity}`))
        .on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
          if (track.kind !== Track.Kind.Audio) return;
          addLog(`audio subscribed from ${participant.identity}`);
          const el = remoteAudioRef.current;
          if (!el) return;
          track.attach(el);
          el.play().catch(() => {});
        })
        .on(RoomEvent.TrackUnsubscribed, (track) => {
          try {
            track.detach();
          } catch {
            // ignore
          }
        });
      addLog("connecting…");
      await room.connect(url, token, { autoSubscribe: true });
      addLog("connected");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to connect");
      addLog(`error: ${e instanceof Error ? e.message : "connect failed"}`);
    }
  }

  async function disconnect() {
    setErr(null);
    setMicOn(false);
    try {
      if (micTrackRef.current) {
        micTrackRef.current.stop();
        micTrackRef.current = null;
      }
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
      addLog("disconnected");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to disconnect");
    }
  }

  async function enableMic() {
    setErr(null);
    const room = roomRef.current;
    if (!room) return;
    try {
      const track = await createLocalAudioTrack({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      });
      micTrackRef.current = track;
      await room.localParticipant.publishTrack(track, { source: Track.Source.Microphone });
      setMicOn(true);
      addLog("microphone published");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to enable mic");
    }
  }

  async function disableMic() {
    setErr(null);
    const room = roomRef.current;
    const track = micTrackRef.current;
    if (!room || !track) {
      setMicOn(false);
      return;
    }
    try {
      room.localParticipant.unpublishTrack(track);
      track.stop();
      micTrackRef.current = null;
      setMicOn(false);
      addLog("microphone stopped");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to disable mic");
    }
  }

  useEffect(() => {
    return () => {
      void disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connected = status === ConnectionState.Connected;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl text-white">Voice demo</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Browser WebRTC session: FastAPI starts a LiveKit room and dispatches your worker with merged metadata (
          <code className="text-slate-500">skip_opening</code> for chat-style demo).
        </p>
      </div>

      {loadErr ? (
        <div className="rounded-xl border border-red-500/30 bg-red-950/35 px-4 py-3 text-sm text-red-200">
          {loadErr}{" "}
          <button type="button" className="ml-2 underline" onClick={() => void reload()}>
            Retry
          </button>
        </div>
      ) : null}

      <section className="studio-card rounded-2xl border border-white/[0.08] bg-gradient-to-b from-ink-900/90 to-ink-950/80 p-6 shadow-xl shadow-black/20">
        <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">Agent</label>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={agentId}
            disabled={loading || rows.length === 0}
            onChange={(e) => setSearchParams(e.target.value ? { agent: e.target.value } : {})}
            className="min-w-[240px] rounded-xl border border-white/10 bg-ink-950 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          >
            {rows.length === 0 ? (
              <option value="">No agents — create one first</option>
            ) : (
              rows.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.livekit_agent_name})
                </option>
              ))
            )}
          </select>
          <Link
            to="/studio/agents/new"
            className="rounded-xl border border-white/15 px-4 py-3 text-sm text-slate-200 hover:bg-white/5"
          >
            New agent
          </Link>
          {selectedAgent ? (
            <Link
              to={`/studio/agents/${selectedAgent.id}`}
              className="rounded-xl border border-emerald-500/30 px-4 py-3 text-sm text-emerald-200 hover:bg-emerald-950/30"
            >
              Edit config
            </Link>
          ) : null}
        </div>
      </section>

      {err ? (
        <div className="rounded-xl border border-red-500/30 bg-red-950/35 px-4 py-3 text-sm text-red-200">{err}</div>
      ) : null}

      <section className="studio-card rounded-2xl border border-white/[0.08] bg-ink-900/50 p-6 sm:p-8">
        <div className="mb-6 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={starting || connected || !session || !agentId}
            onClick={() => void startDemoSession()}
            className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-emerald-900/30 hover:from-emerald-500 hover:to-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {starting ? "Starting…" : "Start session"}
          </button>
          {!connected ? (
            <button
              type="button"
              onClick={() => void connect()}
              disabled={!canConnect || starting}
              className="rounded-xl border border-white/15 px-5 py-2.5 text-sm text-slate-200 hover:bg-white/5 disabled:opacity-40"
            >
              Connect
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void disconnect()}
              className="rounded-xl border border-white/20 px-5 py-2.5 text-sm text-slate-200 hover:bg-white/5"
            >
              Disconnect
            </button>
          )}
          <button
            type="button"
            onClick={() => (micOn ? void disableMic() : void enableMic())}
            disabled={!connected}
            className="rounded-xl bg-white/10 px-5 py-2.5 text-sm text-white hover:bg-white/15 disabled:opacity-40"
          >
            {micOn ? "Mute mic" : "Unmute mic"}
          </button>
        </div>

        {roomName ? (
          <p className="mb-4 font-mono text-xs text-slate-500">
            Room <span className="text-slate-300">{roomName}</span>
          </p>
        ) : null}

        <p className="mb-4 text-sm text-slate-500">
          Status: <span className={connected ? "text-emerald-400" : "text-slate-300"}>{status}</span>
        </p>

        <div className="rounded-xl border border-white/[0.06] bg-ink-950/50 p-4">
          <div className="mb-2 text-sm font-medium text-slate-300">Agent audio</div>
          <audio ref={remoteAudioRef} controls className="w-full rounded-lg" />
        </div>
      </section>

      <section className="studio-card rounded-2xl border border-white/[0.08] bg-ink-900/40 p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg text-white">Logs</h2>
          <button type="button" onClick={() => setLogs([])} className="text-xs text-slate-500 hover:text-slate-300">
            Clear
          </button>
        </div>
        <div className="max-h-52 overflow-auto rounded-lg border border-white/[0.05] bg-ink-950/60 p-3 font-mono text-xs text-slate-400">
          {logs.length === 0 ? (
            <span className="text-slate-600">No logs yet.</span>
          ) : (
            logs.map((l) => (
              <div key={l.t} className="whitespace-pre-wrap break-words">
                [{new Date(l.t).toLocaleTimeString()}] {l.msg}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
