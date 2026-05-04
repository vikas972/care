/** FastAPI BFF origin (no trailing slash). */
export function apiBase(): string {
  return (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
}

/** Use /voice/... on the same host (Vite dev proxy or production nginx → backend). */
export function apiUsesRelativePaths(): boolean {
  const v = import.meta.env.VITE_API_BASE_URL;
  return v === undefined || v === "";
}

/** Absolute or same-origin path for BFF routes (e.g. /voice/livekit/...). */
export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const base = apiBase();
  return base ? `${base}${p}` : p;
}

export function parseFastApiDetail(body: { detail?: unknown }): string {
  const d = body.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d))
    return (
      d
        .map((x: unknown) => {
          if (typeof x === "string") return x;
          if (x && typeof x === "object" && "msg" in x && typeof (x as { msg: unknown }).msg === "string")
            return (x as { msg: string }).msg;
          return JSON.stringify(x);
        })
        .filter(Boolean)
        .join("; ") || "Request failed"
    );
  return "Request failed";
}
