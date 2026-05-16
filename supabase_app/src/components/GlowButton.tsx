import type { ReactNode } from "react";
import { Link } from "react-router-dom";

type GlowButtonProps = {
  to: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
};

export function GlowButton({ to, children, variant = "primary", className = "" }: GlowButtonProps) {
  const base =
    variant === "primary"
      ? "glow-btn glow-btn-primary"
      : "glow-btn glow-btn-secondary";

  return (
    <Link to={to} className={`${base} ${className}`}>
      <span className="glow-btn-shine" aria-hidden />
      <span className="relative z-10 flex items-center justify-center gap-2">{children}</span>
    </Link>
  );
}
