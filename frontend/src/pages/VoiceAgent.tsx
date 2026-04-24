import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ConnectionState,
  LocalAudioTrack,
  Room,
  RoomEvent,
  Track,
  createLocalAudioTrack,
} from "livekit-client";
import { api } from "../api";

type LogLine = { t: number; msg: string };

function now() {
  return Date.now();
}

export default function VoiceAgent() {
  const [url, setUrl] = useState(import.meta.env.VITE_LIVEKIT_URL || "");
  const [token, setToken] = useState("");
  const [roomName, setRoomName] = useState("demo");
  const [status, setStatus] = useState<ConnectionState>(ConnectionState.Disconnected);
  const [err, setErr] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [micOn, setMicOn] = useState(false);
  const [minting, setMinting] = useState(false);

  const roomRef = useRef<Room | null>(null);
  const micTrackRef = useRef<LocalAudioTrack | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  const canConnect = useMemo(() => !!url && !!token, [url, token]);

  function addLog(msg: string) {
    setLogs((x) => [...x.slice(-199), { t: now(), msg }]);
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

      addLog("connecting...");
      await room.connect(url, token, {
        autoSubscribe: true,
      });

      addLog("connected");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to connect");
      addLog(`error: ${e instanceof Error ? e.message : "Failed to connect"}`);
    }
  }

  async function mintToken() {
    setErr(null);
    setMinting(true);
    try {
      const r = await api<{ url: string; room: string; token: string }>("/livekit/token", {
        method: "POST",
        body: JSON.stringify({ room: roomName }),
      });
      if (!r?.token) throw new Error("Token endpoint returned no token");
      setUrl(r.url || url);
      setToken(r.token);
      addLog(`token minted for room: ${r.room || roomName}`);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to mint token");
    } finally {
      setMinting(false);
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
      await room.localParticipant.publishTrack(track, {
        source: Track.Source.Microphone,
      });
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

  const connected = status === "connected";

  return (
    <div className="min-h-screen pb-16">
      <header className="border-b border-white/5 bg-ink-950/90 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <div className="font-display text-xl text-white">Voice Agent</div>
            <p className="text-xs text-slate-500 mt-0.5">Connect mic → talk → hear agent reply</p>
          </div>
          <Link to="/dashboard" className="text-sm text-emerald-400 hover:text-emerald-300">
            ← Back to dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {err ? (
          <div className="rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {err}
          </div>
        ) : null}

        <section className="rounded-2xl border border-white/10 bg-ink-900/50 p-6">
          <div className="grid gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">LiveKit WebSocket URL</label>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="wss://livekit.genaiforge.in"
                className="w-full rounded-xl bg-ink-950 border border-white/10 px-4 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                disabled={connected}
              />
              <p className="text-xs text-slate-500 mt-1">
                Tip: set <code className="text-slate-400">VITE_LIVEKIT_URL</code> for a default.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-3 items-end">
              <div className="md:col-span-2">
                <label className="block text-sm text-slate-400 mb-1">Room name</label>
                <input
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="demo"
                  className="w-full rounded-xl bg-ink-950 border border-white/10 px-4 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  disabled={connected || minting}
                />
              </div>
              <button
                type="button"
                onClick={() => void mintToken()}
                disabled={connected || minting || !roomName.trim()}
                className="rounded-xl border border-slate-500 text-slate-200 font-medium px-4 py-2.5 text-sm hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {minting ? "Minting…" : "Get token from API"}
              </button>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Room token</label>
              <textarea
                value={token}
                onChange={(e) => setToken(e.target.value.trim())}
                placeholder="Paste a LiveKit access token (JWT) here"
                className="w-full min-h-[110px] rounded-xl bg-ink-950 border border-white/10 px-4 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                disabled={connected}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="text-sm text-slate-400">
                Status:{" "}
                <span className={connected ? "text-emerald-400" : "text-slate-300"}>{status}</span>
              </div>
              <div className="flex-1" />
              {!connected ? (
                <button
                  type="button"
                  onClick={() => void connect()}
                  disabled={!canConnect}
                  className="rounded-xl bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-500 text-white font-medium px-4 py-2 text-sm"
                >
                  Connect
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void disconnect()}
                  className="rounded-xl border border-slate-500 text-slate-200 font-medium px-4 py-2 text-sm hover:bg-white/5"
                >
                  Disconnect
                </button>
              )}

              <button
                type="button"
                onClick={() => (micOn ? void disableMic() : void enableMic())}
                disabled={!connected}
                className="rounded-xl bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/15 text-white font-medium px-4 py-2 text-sm"
              >
                {micOn ? "Stop mic" : "Start mic"}
              </button>
            </div>

            <div className="rounded-xl border border-white/10 bg-ink-950/40 p-4">
              <div className="text-sm text-slate-300 mb-2">Agent audio</div>
              <audio ref={remoteAudioRef} controls className="w-full" />
              <p className="text-xs text-slate-500 mt-2">
                When the agent publishes audio, it will play here automatically.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-ink-900/50 p-6">
          <div className="flex items-center justify-between gap-4 mb-3">
            <h2 className="font-display text-xl text-white">Logs</h2>
            <button
              type="button"
              onClick={() => setLogs([])}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              Clear
            </button>
          </div>
          <div className="rounded-xl border border-white/5 bg-ink-950/30 p-3 font-mono text-xs text-slate-300 max-h-[280px] overflow-auto">
            {logs.length === 0 ? (
              <div className="text-slate-500">No logs yet.</div>
            ) : (
              logs.map((l) => (
                <div key={l.t} className="whitespace-pre-wrap break-words">
                  [{new Date(l.t).toLocaleTimeString()}] {l.msg}
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

