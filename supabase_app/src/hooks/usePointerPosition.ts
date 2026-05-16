import { useEffect, useState } from "react";

export type PointerPosition = { x: number; y: number; active: boolean };

/** Normalized pointer in [-1, 1] relative to viewport center. */
export function usePointerPosition(): PointerPosition {
  const [pos, setPos] = useState<PointerPosition>({ x: 0, y: 0, active: false });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = (e.clientY / window.innerHeight) * 2 - 1;
      setPos({ x, y, active: true });
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
