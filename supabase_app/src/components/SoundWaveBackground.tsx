import { useEffect, useRef } from "react";
import { useSmoothedPointerRef } from "../hooks/usePointerPosition";

const BAR_GAP = 5;
const MIN_BAR_W = 3;

function drawFlowLine(
  ctx: CanvasRenderingContext2D,
  w: number,
  baseY: number,
  time: number,
  phase: number,
  amplitude: number,
  wavelength: number,
  mouseX: number,
  color: string,
  lineWidth: number,
) {
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = "round";

  const steps = Math.ceil(w / 4);
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * w;
    const dist = (x - mouseX) / w;
    const mousePull = Math.exp(-dist * dist * 18) * amplitude * 0.55;
    const y =
      baseY +
      Math.sin((x / wavelength) * Math.PI * 2 + time * 1.2 + phase) * amplitude +
      Math.sin((x / (wavelength * 0.6)) * Math.PI * 2 - time * 0.8) * (amplitude * 0.35) +
      mousePull * Math.sin(time * 2.5 + x * 0.02);

    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

/** Canvas audio visualizer — bars + flowing lines react to cursor position. */
export default function SoundWaveBackground({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { tick } = useSmoothedPointerRef();
  const timeRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const draw = () => {
      if (!reduced) timeRef.current += 0.016;
      const time = timeRef.current;
      const p = tick(0.11);

      ctx.clearRect(0, 0, width, height);

      const mouseX = p.px - canvas.getBoundingClientRect().left;
      const mouseY = p.py - canvas.getBoundingClientRect().top;
      const energy = p.active ? 1 : 0.35;

      // Cursor glow
      if (p.active) {
        const g = ctx.createRadialGradient(mouseX, mouseY, 0, mouseX, mouseY, 180);
        g.addColorStop(0, `rgba(45, 212, 191, ${0.14 * energy})`);
        g.addColorStop(0.45, `rgba(34, 211, 238, ${0.06 * energy})`);
        g.addColorStop(1, "rgba(45, 212, 191, 0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, width, height);
      }

      // Flowing wave lines (mid + upper)
      const amp = height * 0.06 * energy;
      drawFlowLine(ctx, width, height * 0.55, time, 0, amp * 1.2, 280, mouseX, "rgba(45, 212, 191, 0.22)", 2);
      drawFlowLine(ctx, width, height * 0.62, time, 1.8, amp, 220, mouseX, "rgba(34, 211, 238, 0.16)", 1.5);
      drawFlowLine(ctx, width, height * 0.48, time, 3.2, amp * 0.7, 340, mouseX, "rgba(167, 139, 250, 0.12)", 1);

      // Spectrum bars
      const barCount = Math.max(24, Math.floor(width / BAR_GAP));
      const barW = Math.max(MIN_BAR_W, width / barCount - 2);
      const maxBarH = height * 0.72;
      const spread = width * 0.14;

      for (let i = 0; i < barCount; i++) {
        const x = (i + 0.5) * (width / barCount);
        const dist = Math.abs(x - mouseX);
        const proximity = Math.exp(-(dist * dist) / (spread * spread));

        const idle =
          0.12 +
          0.08 * Math.sin(time * 2.8 + i * 0.35) +
          0.05 * Math.sin(time * 4.1 + i * 0.12);
        const boost = proximity * (0.55 + 0.25 * Math.sin(time * 6 + i * 0.2));
        const barH = maxBarH * Math.min(1, (idle + boost) * energy);

        const grad = ctx.createLinearGradient(x, height, x, height - barH);
        grad.addColorStop(0, `rgba(45, 212, 191, ${0.55 + proximity * 0.35})`);
        grad.addColorStop(0.5, `rgba(34, 211, 238, ${0.35 + proximity * 0.25})`);
        grad.addColorStop(1, `rgba(167, 139, 250, ${0.05 + proximity * 0.15})`);

        const rx = 2;
        const bx = x - barW / 2;
        const by = height - barH;

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(bx, by, barW, barH, [rx, rx, 0, 0]);
        ctx.fill();

        // Highlight cap near cursor
        if (proximity > 0.25) {
          ctx.fillStyle = `rgba(255, 255, 255, ${0.12 * proximity})`;
          ctx.fillRect(bx, by, barW, Math.min(4, barH));
        }
      }

      // Ripple rings from cursor
      if (p.active && !reduced) {
        for (let r = 0; r < 3; r++) {
          const phase = ((time * 0.9 + r * 0.33) % 1);
          const radius = 40 + phase * 140;
          ctx.beginPath();
          ctx.arc(mouseX, mouseY, radius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(45, 212, 191, ${(1 - phase) * 0.12})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [tick]);

  return (
    <div
      className={`sound-wave-root pointer-events-none absolute inset-x-0 bottom-0 top-[28%] ${className}`}
      aria-hidden
    >
      <canvas ref={canvasRef} className="h-full w-full" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#050506] via-transparent to-transparent opacity-80" />
    </div>
  );
}
