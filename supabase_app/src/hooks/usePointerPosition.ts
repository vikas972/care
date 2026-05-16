import { useEffect, useRef, useState } from "react";

export type PointerPosition = {
  /** Normalized -1 … 1 from viewport center */
  x: number;
  y: number;
  /** Normalized 0 … 1 */
  nx: number;
  ny: number;
  /** Pixel position */
  px: number;
  py: number;
  active: boolean;
};

const IDLE: PointerPosition = { x: 0, y: 0, nx: 0.5, ny: 0.5, px: 0, py: 0, active: false };

export function usePointerPosition(): PointerPosition {
  const [pos, setPos] = useState<PointerPosition>(IDLE);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setPos({
        x: (e.clientX / w) * 2 - 1,
        y: (e.clientY / h) * 2 - 1,
        nx: e.clientX / w,
        ny: e.clientY / h,
        px: e.clientX,
        py: e.clientY,
        active: true,
      });
    };
    const onLeave = () => setPos((p) => ({ ...p, active: false }));

    window.addEventListener("mousemove", onMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return pos;
}

/** Smoothed pointer for canvas animations (lerps each frame via ref). */
export function useSmoothedPointerRef() {
  const target = useRef(IDLE);
  const smooth = useRef({ ...IDLE });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      target.current = {
        x: (e.clientX / w) * 2 - 1,
        y: (e.clientY / h) * 2 - 1,
        nx: e.clientX / w,
        ny: e.clientY / h,
        px: e.clientX,
        py: e.clientY,
        active: true,
      };
    };
    const onLeave = () => {
      target.current = { ...target.current, active: false };
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  function tick(follow = 0.09) {
    const t = target.current;
    const s = smooth.current;
    const rate = t.active ? follow : follow * 0.35;
    s.px = lerp(s.px, t.px, rate);
    s.py = lerp(s.py, t.py, rate);
    s.nx = lerp(s.nx, t.nx, rate);
    s.ny = lerp(s.ny, t.ny, rate);
    s.x = lerp(s.x, t.x, rate);
    s.y = lerp(s.y, t.y, rate);
    s.active = t.active;
    return s;
  }

  return { tick, smooth };
}
