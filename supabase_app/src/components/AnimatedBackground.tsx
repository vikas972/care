import { usePointerPosition } from "../hooks/usePointerPosition";
import SoundWaveBackground from "./SoundWaveBackground";

type Blob = { color: string; size: string; top: string; left: string; parallax: number; delay: string };

const blobs: Blob[] = [
  { color: "rgba(45,212,191,0.12)", size: "420px", top: "-8%", left: "12%", parallax: 28, delay: "0s" },
  { color: "rgba(99,102,241,0.1)", size: "360px", top: "55%", left: "78%", parallax: 18, delay: "1.2s" },
  { color: "rgba(34,211,238,0.08)", size: "280px", top: "72%", left: "8%", parallax: 22, delay: "2s" },
  { color: "rgba(167,139,250,0.07)", size: "220px", top: "18%", left: "68%", parallax: 14, delay: "0.8s" },
];

export default function AnimatedBackground({ className = "" }: { className?: string }) {
  const { x, y, active } = usePointerPosition();

  return (
    <div className={`pointer-events-none fixed inset-0 overflow-hidden ${className}`} aria-hidden>
      <SoundWaveBackground />
      <div className="absolute inset-0 bg-grid-fade opacity-25" />

      {blobs.map((b, i) => (
        <div
          key={i}
          className="absolute rounded-full blur-3xl animate-blob-drift will-change-transform"
          style={{
            width: b.size,
            height: b.size,
            top: b.top,
            left: b.left,
            background: `radial-gradient(circle, ${b.color} 0%, transparent 70%)`,
            animationDelay: b.delay,
            transform: active ? `translate(${x * b.parallax}px, ${y * b.parallax}px)` : undefined,
            transition: "transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        />
      ))}
    </div>
  );
}
