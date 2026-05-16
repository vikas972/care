import type { ReactNode } from "react";
import { useRef, useState } from "react";
import { Link } from "react-router-dom";

type TiltCardProps = {
  to: string;
  children: ReactNode;
  className?: string;
};

export default function TiltCard({ to, children, className = "" }: TiltCardProps) {
  const ref = useRef<HTMLAnchorElement>(null);
  const [transform, setTransform] = useState("");
  const [glow, setGlow] = useState({ x: 50, y: 50, opacity: 0 });

  function onMove(e: React.MouseEvent<HTMLAnchorElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const rotateX = (0.5 - y) * 10;
    const rotateY = (x - 0.5) * 10;
    setTransform(`perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`);
    setGlow({ x: x * 100, y: y * 100, opacity: 1 });
  }

  function onLeave() {
    setTransform("");
    setGlow((g) => ({ ...g, opacity: 0 }));
  }

  return (
    <Link
      ref={ref}
      to={to}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={`tilt-card group relative block ${className}`}
      style={{ transform, transition: transform ? "transform 0.1s ease-out" : "transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)" }}
    >
      <span
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          opacity: glow.opacity,
          background: `radial-gradient(circle at ${glow.x}% ${glow.y}%, rgba(45,212,191,0.15) 0%, transparent 55%)`,
        }}
      />
      {children}
    </Link>
  );
}
