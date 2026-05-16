import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ConnectionState,
  LocalAudioTrack,
  RemoteParticipant,
  RemoteTrack,
  Room,
  RoomEvent,
  Track,
  createLocalAudioTrack,
} from "livekit-client";
import VoiceCallOrb from "../components/VoiceCallOrb";
import { useAuth } from "../contexts/AuthContext";
import { useVoiceAgents } from "../hooks/useVoiceAgents";
import { apiUrl, parseFastApiDetail } from "../lib/api";

type CallPhase = "idle" | "connecting" | "live";
type LogLine = { t: number; msg: string };

export default function VoiceDemoPage() {
  const { session } = useAuth();
  const { rows, loading, err: loadErr, reload } = useVoiceAgents();
  const [searchParams, setSearchParams] = useSearchParams();

  const agentId = searchParams.get("agent") ?? "";

  const [phase, setPhase] = useState<CallPhase>("idle");
  const [roomName, setRoomName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [localLevel, setLocalLevel] = useState(0);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [remoteCount, setRemoteCount] = useState(0);
  const [remoteAudioCount, setRemoteAudioCount] = useState(0);
  const [showLogs, setShowLogs] = useState(false);

  const roomRef = useRef<Room | null>(null);
  const micTrackRef = useRef<LocalAudioTrack | null>(null);
  const remoteAudioContainerRef = useRef<HTMLDivElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const levelRafRef = useRef(0);
  const attachedTracksRef = useRef<Set<string>>(new Set());

  const selectedAgent = useMemo(() => rows.find((r) => r.id === agentId), [rows, agentId]);

  useEffect(() => {
    if (!loading && rows.length && !agentId) {
      const first = rows[0]?.id;
      if (first) setSearchParams({ agent: first }, { replace: true });
    }
  }, [loading, rows, agentId, setSearchParams]);

  const addLog = useCallback((msg: string) => {
    setLogs((x) => [...x.slice(-99), { t: Date.now(), msg }]);
  }, []);

  function stopLevelMeter() {
    if (levelRafRef.current) cancelAnimationFrame(levelRafRef.current);
    levelRafRef.current = 0;
    setLocalLevel(0);
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
  }

  function startLevelMeter(track: LocalAudioTrack) {
    stopLevelMeter();
    const mediaTrack = track.mediaStreamTrack;
    if (!mediaTrack) return;

    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    const source = ctx.createMediaStreamSource(new MediaStream([mediaTrack]));
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;

    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      const avg = sum / data.length / 255;
      setLocalLevel((prev) => prev * 0.6 + avg * 0.4);
      levelRafRef.current = requestAnimationFrame(tick);
    };
    void ctx.resume().then(() => {
      levelRafRef.current = requestAnimationFrame(tick);
    });
  }

  function syncRemoteCounts(room: Room) {
    setRemoteCount(room.remoteParticipants.size);
    let audio = 0;
    room.remoteParticipants.forEach((p) => {
      p.audioTrackPublications.forEach((pub) => {
        if (pub.track) audio += 1;
      });
    });
    setRemoteAudioCount(audio);
  }

  function attachRemoteAudio(track: RemoteTrack, participant: RemoteParticipant) {
    if (track.kind !== Track.Kind.Audio) return;
    const key = `${participant.identity}-${track.mediaStreamID}`;
    if (attachedTracksRef.current.has(key)) return;

    const container = remoteAudioContainerRef.current ?? document.body;

    const el = track.attach() as HTMLAudioElement;
    el.autoplay = true;
    el.setAttribute("playsinline", "true");
    el.volume = 1;
    el.dataset.participant = participant.identity;
    el.style.position = "fixed";
    el.style.width = "0";
    el.style.height = "0";
    el.style.opacity = "0";
    el.style.pointerEvents = "none";
    container.appendChild(el);
    attachedTracksRef.current.add(key);
    setRemoteAudioCount((n) => n + 1);

    void el.play().catch(() => {
      addLog("browser blocked agent audio — tap the mic again to unlock");
    });
    addLog(`hearing ${participant.identity}`);
  }

  function attachExistingRemoteAudio(room: Room) {
    room.remoteParticipants.forEach((participant) => {
      participant.audioTrackPublications.forEach((pub) => {
        if (pub.track) attachRemoteAudio(pub.track, participant);
      });
    });
  }

  function setupRoomHandlers(room: Room) {
    room
      .on(RoomEvent.ConnectionStateChanged, (s) => {
        if (s === ConnectionState.Connected) setPhase("live");
        if (s === ConnectionState.Disconnected) {
          setPhase("idle");
          setRemoteCount(0);
          setRemoteAudioCount(0);
        }
      })
      .on(RoomEvent.ParticipantConnected, (p) => {
        addLog(`joined: ${p.identity}`);
        syncRemoteCounts(room);
        attachExistingRemoteAudio(room);
      })
      .on(RoomEvent.ParticipantDisconnected, () => syncRemoteCounts(room))
      .on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
        attachRemoteAudio(track, participant);
        syncRemoteCounts(room);
      })
      .on(RoomEvent.TrackUnsubscribed, (track, _pub, participant) => {
        attachedTracksRef.current.forEach((k) => {
          if (k.startsWith(`${participant.identity}-`)) attachedTracksRef.current.delete(k);
        });
        try {
          const els = track.detach();
          els.forEach((el) => el.remove());
        } catch {
          /* ignore */
        }
      })
      .on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        const localId = room.localParticipant.identity;
        setAgentSpeaking(speakers.some((s) => s.identity !== localId));
      });
  }

  async function endCall() {
    setErr(null);
    stopLevelMeter();
    setAgentSpeaking(false);
    setRemoteCount(0);
    setRemoteAudioCount(0);
    attachedTracksRef.current.clear();

    if (remoteAudioContainerRef.current) {
      remoteAudioContainerRef.current.innerHTML = "";
    }

    try {
      if (micTrackRef.current) {
        micTrackRef.current.stop();
        micTrackRef.current = null;
      }
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
    } catch {
      /* ignore */
    }

    setRoomName("");
    setPhase("idle");
    addLog("call ended");
  }

  async function startCall() {
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
    if (!navigator.mediaDevices?.getUserMedia) {
      setErr(
        window.isSecureContext
          ? "Microphone not available in this browser."
          : "Microphone requires HTTPS or localhost.",
      );
      return;
    }

    setPhase("connecting");
    addLog("starting session…");

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

      setRoomName(body.room);
      addLog(`room ${body.room}`);

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });
      roomRef.current = room;
      setupRoomHandlers(room);

      addLog("connecting…");
      await room.connect(body.url, body.token, { autoSubscribe: true });

      await room.startAudio();
      addLog("audio unlocked");

      attachExistingRemoteAudio(room);
      syncRemoteCounts(room);

      const waitMs = 20_000;
      const stepMs = 500;
      for (let waited = 0; waited < waitMs; waited += stepMs) {
        if (room.remoteParticipants.size > 0) break;
        await new Promise((r) => setTimeout(r, stepMs));
      }
      syncRemoteCounts(room);
      attachExistingRemoteAudio(room);
      if (room.remoteParticipants.size === 0) {
        addLog(
          "no agent joined — confirm LiveKit worker 'my-agent' is deployed (lk agent list) and matches agent LiveKit name",
        );
      }

      const mic = await createLocalAudioTrack({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      });
      micTrackRef.current = mic;
      await room.localParticipant.publishTrack(mic, { source: Track.Source.Microphone });
      startLevelMeter(mic);

      setPhase("live");
      addLog("live — speak now");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Call failed";
      const hint =
        msg === "Failed to fetch"
          ? "Cannot reach API. Run backend on :8001 and frontend with npm run dev (VITE_API_BASE_URL empty)."
          : msg;
      setErr(hint);
      addLog(`error: ${hint}`);
      await endCall();
    }
  }

  async function toggleCall() {
    if (phase === "live" || phase === "connecting") {
      await endCall();
    } else {
      await startCall();
    }
  }

  useEffect(() => {
    return () => {
      void endCall();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const orbDisabled = !session || !agentId || loading || rows.length === 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl text-white">Voice demo</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">
          Tap the microphone once to talk. Session, connection, and audio start automatically.
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

      <section className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-[#14141c]/90 to-[#101014]/90 p-5">
        <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-600">Agent</label>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={agentId}
            disabled={loading || rows.length === 0 || phase !== "idle"}
            onChange={(e) => setSearchParams(e.target.value ? { agent: e.target.value } : {})}
            className="min-w-[220px] rounded-xl border border-white/10 bg-[#0a0a0e] px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-teal-500/40 disabled:opacity-50"
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
          {selectedAgent ? (
            <Link
              to={`/studio/agents/${selectedAgent.id}`}
              className="text-sm text-teal-500 hover:text-teal-400"
            >
              Edit agent
            </Link>
          ) : (
            <Link to="/studio/agents/new" className="text-sm text-slate-500 hover:text-slate-300">
              Create agent
            </Link>
          )}
        </div>
      </section>

      {err ? (
        <div className="rounded-xl border border-red-500/30 bg-red-950/35 px-4 py-3 text-sm text-red-200">{err}</div>
      ) : null}

      <section className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-b from-[#12121a] to-[#0a0a0e] px-6 py-10 sm:py-14">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_80%,rgba(45,212,191,0.08),transparent)]" />

        <VoiceCallOrb
          phase={phase}
          agentSpeaking={agentSpeaking}
          localLevel={localLevel}
          disabled={orbDisabled}
          onToggle={() => void toggleCall()}
        />

        {phase === "live" ? (
          <div className="relative mt-4 space-y-1 text-center text-xs">
            {roomName ? (
              <p className="font-mono text-[11px] text-slate-600">Room {roomName}</p>
            ) : null}
            {remoteCount === 0 ? (
              <p className="text-amber-400/90">
                Waiting for agent worker… (check LiveKit name is <code className="text-amber-200">my-agent</code>{" "}
                and worker is deployed)
              </p>
            ) : remoteAudioCount === 0 ? (
              <p className="text-amber-400/90">Agent connected — waiting for audio track…</p>
            ) : (
              <p className="text-teal-500/80">
                Agent in room · {remoteAudioCount} audio track{remoteAudioCount === 1 ? "" : "s"}
              </p>
            )}
          </div>
        ) : null}

        {/* Remote audio elements (hidden, required for playback) */}
        <div ref={remoteAudioContainerRef} className="sr-only" aria-hidden />
      </section>

      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => setShowLogs((v) => !v)}
          className="text-xs text-slate-600 hover:text-slate-400"
        >
          {showLogs ? "Hide" : "Show"} connection log
        </button>
      </div>

      {showLogs ? (
        <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium text-slate-400">Log</h2>
            <button type="button" onClick={() => setLogs([])} className="text-xs text-slate-600 hover:text-slate-300">
              Clear
            </button>
          </div>
          <div className="max-h-40 overflow-auto font-mono text-xs text-slate-500">
            {logs.length === 0 ? (
              <span className="text-slate-600">No logs yet.</span>
            ) : (
              logs.map((l) => (
                <div key={l.t} className="whitespace-pre-wrap break-words py-0.5">
                  [{new Date(l.t).toLocaleTimeString()}] {l.msg}
                </div>
              ))
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
