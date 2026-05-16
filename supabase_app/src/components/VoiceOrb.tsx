import { useRef, useState } from "react";

type VoiceOrbProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
  interactive?: boolean;
};

const sizes = {
  sm: { wrap: "h-16 w-16", icon: "h-6 w-6" },
  md: { wrap: "h-24 w-24", icon: "h-9 w-9" },
  lg: { wrap: "h-32 w-32", icon: "h-12 w-12" },
};

export default function VoiceOrb({ size = "md", className = "", interactive = true }: VoiceOrbProps) {
  const s = sizes[size];
  const ref = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const active = hovered || pressed;

  function onMove(e: React.MouseEvent) {
    if (!interactive || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const x = ((e.clientX - cx) / (rect.width / 2)) * 8;
    const y = ((e.clientY - cy) / (rect.height / 2)) * -8;
    setTilt({ x, y });
  }

  function onLeave() {
    setHovered(false);
    setPressed(false);
    setTilt({ x: 0, y: 0 });
  }

  return (
    <div
      ref={ref}
      className={`relative flex items-center justify-center ${interactive ? "cursor-pointer select-none" : ""} ${className}`}
      onMouseEnter={() => interactive && setHovered(true)}
      onMouseLeave={onLeave}
      onMouseMove={onMove}
      onMouseDown={() => interactive && setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        transform: interactive
          ? `perspective(600px) rotateX(${tilt.y}deg) rotateY(${tilt.x}deg) scale(${active ? 1.06 : 1})`
          : undefined,
        transition: "transform 0.2s ease-out",
      }}
      role={interactive ? "img" : undefined}
      aria-label={interactive ? "Interactive voice orb" : undefined}
    >
      <div
        className={`absolute ${s.wrap} rounded-full bg-teal-400/25 blur-2xl transition-all duration-300 ${active ? "scale-125 opacity-100" : "scale-100 opacity-70"}`}
        aria-hidden
      />
      <div
        className={`absolute ${s.wrap} animate-pulse-ring rounded-full border border-teal-400/30 ${active ? "animate-pulse-ring-fast" : ""}`}
      />
      <div
        className={`absolute ${s.wrap} animate-pulse-ring rounded-full border border-cyan-400/20 ${active ? "animate-pulse-ring-fast" : ""}`}
        style={{ animationDelay: "0.5s" }}
      />
      <div
        className={`absolute ${s.wrap} animate-spin-slow rounded-full border border-dashed border-violet-400/20 ${active ? "opacity-100" : "opacity-40"}`}
      />
      <div
        className={`relative ${s.wrap} flex items-center justify-center rounded-full bg-gradient-to-br from-teal-400/30 via-cyan-500/20 to-violet-600/25 shadow-[0_0_80px_-10px_rgba(45,212,191,0.55)] ring-1 ring-teal-400/40 transition-shadow duration-300 ${active ? "shadow-[0_0_100px_-8px_rgba(45,212,191,0.7)]" : ""}`}
      >
        <svg
          className={`${s.icon} text-teal-100 transition-transform duration-300 ${active ? "scale-110" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.25}
        >
          <path
            d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v3M8 21h8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

function Waveform({ active, className = "" }: { active?: boolean; className?: string }) {
  const bars = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  return (
    <div className={`flex items-end justify-center gap-1 ${className}`}>
      {bars.map((i) => (
        <span
          key={i}
          className={`w-1 origin-bottom rounded-full bg-gradient-to-t from-teal-500/60 to-cyan-300/90 ${active ? "animate-wave-bar-fast" : "animate-wave-bar"}`}
          style={{
            height: `${10 + (i % 4) * 5}px`,
            animationDelay: `${i * (active ? 0.06 : 0.12)}s`,
          }}
        />
      ))}
    </div>
  );
}

export function VoiceHeroVisual({ className = "", hint = true }: { className?: string; hint?: boolean }) {
  const [active, setActive] = useState(false);

  return (
    <div
      className={`relative flex flex-col items-center ${className}`}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
    >
      <VoiceOrb size="lg" interactive />
      <Waveform active={active} className="mt-6 h-10" />
      {hint ? (
        <p
          className={`mt-4 text-[11px] text-slate-600 transition-opacity duration-500 ${active ? "opacity-0" : "opacity-100"}`}
        >
          Hover to preview voice activity
        </p>
      ) : null}
    </div>
  );
}
