type CallPhase = "idle" | "connecting" | "live";

type VoiceCallOrbProps = {
  phase: CallPhase;
  agentSpeaking: boolean;
  localLevel: number;
  disabled?: boolean;
  onToggle: () => void;
};

const BAR_COUNT = 12;

export default function VoiceCallOrb({
  phase,
  agentSpeaking,
  localLevel,
  disabled,
  onToggle,
}: VoiceCallOrbProps) {
  const live = phase === "live";
  const busy = phase === "connecting";
  const level = Math.min(1, Math.max(0, localLevel));
  const agentGlow = agentSpeaking && live;

  return (
    <div className="flex flex-col items-center">
      <div className="relative flex h-56 w-56 items-center justify-center sm:h-64 sm:w-64">
        <div
          className={`absolute inset-0 rounded-full border transition-all duration-500 ${
            live ? "animate-pulse-ring border-teal-400/40" : "border-white/[0.06]"
          }`}
        />
        <div
          className={`absolute inset-3 rounded-full border transition-all duration-500 ${
            live ? "animate-pulse-ring-fast border-cyan-400/30" : "border-transparent"
          }`}
          style={{ animationDelay: "0.4s" }}
        />
        {agentGlow ? (
          <div className="absolute inset-0 animate-pulse-ring rounded-full bg-violet-500/15 blur-md" />
        ) : null}

        <div className="absolute inset-6 flex items-center justify-center">
          <div className="flex h-full w-full items-end justify-center gap-1 px-2">
            {Array.from({ length: BAR_COUNT }, (_, i) => {
              const offset = Math.abs(i - BAR_COUNT / 2) / (BAR_COUNT / 2);
              const h = live
                ? 12 + level * 36 * (1 - offset * 0.35) + (agentGlow ? 8 * Math.sin(i * 0.8) : 0)
                : 8 + (busy ? 6 * Math.sin(i * 0.5) : 0);
              return (
                <span
                  key={i}
                  className={`w-1.5 origin-bottom rounded-full transition-all duration-75 ${
                    live
                      ? agentGlow
                        ? "bg-gradient-to-t from-violet-500/70 to-teal-300/90"
                        : "bg-gradient-to-t from-teal-600/60 to-cyan-300/80"
                      : "bg-white/10"
                  }`}
                  style={{
                    height: `${h}px`,
                    opacity: live ? 0.5 + level * 0.5 : busy ? 0.4 : 0.2,
                  }}
                />
              );
            })}
          </div>
        </div>

        <button
          type="button"
          disabled={disabled || busy}
          onClick={onToggle}
          className={`relative z-10 flex h-28 w-28 items-center justify-center rounded-full transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/60 sm:h-32 sm:w-32 ${
            live
              ? "bg-gradient-to-br from-red-500/90 to-rose-600/90 shadow-[0_0_50px_-8px_rgba(244,63,94,0.55)] hover:scale-[1.03]"
              : busy
                ? "cursor-wait bg-gradient-to-br from-teal-600/80 to-cyan-600/80 shadow-lg shadow-teal-900/40"
                : "bg-gradient-to-br from-teal-500 to-cyan-500 shadow-[0_0_60px_-10px_rgba(45,212,191,0.55)] hover:scale-[1.05] active:scale-[0.98]"
          } ${disabled && !busy ? "cursor-not-allowed opacity-50" : ""}`}
          aria-label={live ? "End call" : busy ? "Connecting" : "Start voice call"}
        >
          {busy ? (
            <span className="h-10 w-10 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : live ? (
            <svg className="h-10 w-10 text-white" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          ) : (
            <svg className="h-12 w-12 text-[#041210]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path
                d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v3M8 21h8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      </div>

      <p className="mt-6 text-center text-sm font-medium text-slate-300">
        {busy ? "Connecting to your agent…" : live ? "Tap to end call" : "Tap to talk to your agent"}
      </p>
      <p className="mt-1 text-center text-xs text-slate-600">
        {live
          ? agentSpeaking
            ? "Agent is speaking"
            : level > 0.08
              ? "Listening to you"
              : "Speak now — agent will respond"
          : "One tap starts the session, mic, and audio"}
      </p>
    </div>
  );
}
