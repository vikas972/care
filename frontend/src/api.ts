const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

const TOKEN_KEY = "smartcall_access_token";

export function getApiBase(): string {
  return API.replace(/\/$/, "");
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function loginUrl(): string {
  return `${getApiBase()}/auth/google/login`;
}

export async function api<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<T | null> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (init?.body && typeof init.body === "string" && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const r = await fetch(`${getApiBase()}${path}`, { ...init, headers });
  const text = await r.text();

  if (r.status === 204) return null;
  if (!r.ok) {
    throw new Error(text || `${r.status} ${r.statusText}`);
  }
  return text ? (JSON.parse(text) as T) : null;
}
