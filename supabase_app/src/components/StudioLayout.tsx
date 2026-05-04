import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useVoiceAgents } from "../hooks/useVoiceAgents";

function cn(...parts: (string | boolean | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

function NavHeading({ children }: { children: ReactNode }) {
  return (
    <div className="px-3 pb-2 pt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-600 first:pt-1">
      {children}
    </div>
  );
}

function SidebarLink({
  to,
  end,
  icon,
  label,
}: {
  to: string;
  end?: boolean;
  icon: ReactNode;
  label: string;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition",
          isActive
            ? "bg-white/[0.08] text-teal-300 shadow-[inset_0_0_0_1px_rgba(45,212,191,0.2)]"
            : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200",
        )
      }
    >
      <span className="opacity-80">{icon}</span>
      {label}
    </NavLink>
  );
}

function supabaseDashboardApiUrl(): string | null {
  const raw = import.meta.env.VITE_SUPABASE_URL || "";
  try {
    const host = new URL(raw).hostname;
    const ref = host.split(".")[0];
    if (host.endsWith(".supabase.co") && ref) {
      return `https://supabase.com/dashboard/project/${ref}/settings/api`;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export default function StudioLayout({ children }: { children?: ReactNode }) {
  const { signOut, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const searchRef = useRef<HTMLInputElement>(null);
  const [threadsOpen, setThreadsOpen] = useState(true);
  const [mobileNav, setMobileNav] = useState(false);
  const [composer, setComposer] = useState("");
  const { rows: agents } = useVoiceAgents();

  const showComposer = location.pathname === "/studio";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const orgLabel = user?.email ?? user?.phone ?? "Workspace";

  function openApiKeys() {
    const url = supabaseDashboardApiUrl();
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  function submitComposer() {
    const q = composer.trim();
    setComposer("");
    if (q) navigate(`/studio/agents?q=${encodeURIComponent(q)}`);
    else navigate("/studio/agents");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#050506] text-slate-200">
      {mobileNav ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/70 md:hidden"
          aria-label="Close menu"
          onClick={() => setMobileNav(false)}
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col border-r border-white/[0.06] bg-[#0c0c0e] md:static md:z-0",
          mobileNav ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          "transition-transform duration-200 md:transition-none",
        )}
      >
        <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
          <button
            type="button"
            className="rounded-lg p-2 text-slate-400 hover:bg-white/5 md:hidden"
            onClick={() => setMobileNav(false)}
            aria-label="Close sidebar"
          >
            ✕
          </button>
          <Link to="/studio" className="flex flex-1 items-center gap-2 min-w-0" onClick={() => setMobileNav(false)}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-500/15 font-display text-sm font-semibold text-teal-300 ring-1 ring-teal-500/25">
              VS
            </div>
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold text-white">Voice Studio</div>
              <div className="truncate text-[11px] text-slate-600">{orgLabel}&apos;s org</div>
            </div>
          </Link>
        </div>

        <div className="border-b border-white/[0.06] px-3 py-3">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-600">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
            </span>
            <input
              ref={searchRef}
              type="search"
              placeholder="Search…"
              className="w-full rounded-lg border border-white/[0.06] bg-[#141417] py-2 pl-9 pr-14 text-[13px] text-slate-200 placeholder:text-slate-600 focus:border-teal-500/40 focus:outline-none focus:ring-1 focus:ring-teal-500/30"
            />
            <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-slate-500 sm:inline">
              ⌘K
            </kbd>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pb-6 pt-2">
          <NavHeading>Build</NavHeading>
          <div className="space-y-0.5">
            <SidebarLink
              to="/studio/agents"
              icon={
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.182 15.182a4.5 4.5 0 0 1-6.364 0M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
                </svg>
              }
              label="Assistants"
            />
            <SidebarLink
              to="/studio/demo"
              end
              icon={
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3v-3m6 6v-3a3 3 0 0 0-3-3v0a3 3 0 0 0-3 3v3" />
                </svg>
              }
              label="Voice demo"
            />
            <SidebarLink
              to="/studio/outbound"
              end
              icon={
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                </svg>
              }
              label="Outbound"
            />
            <SidebarLink
              to="/studio/inbound"
              end
              icon={
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
              }
              label="Inbound"
            />
          </div>

          <NavHeading>Observe</NavHeading>
          <div className="space-y-0.5">
            <SidebarLink
              to="/studio/logs"
              end
              icon={
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75m8.25 12h-.008v.008H9.75a9 9 0 0 1-9-9v-.008Zm0 0v-.008a9 9 0 0 1 9-9h.008" />
                </svg>
              }
              label="Logs"
            />
            <SidebarLink
              to="/studio/metrics"
              end
              icon={
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v7.125c0 .621-.504 1.125-1.125 1.125h-2.25A1.125 1.125 0 0 1 3 20.25v-7.125Zm6 0c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v4.125c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125v-4.125Zm6-4.875c0-.621.504-1.125 1.125-1.125h2.25C19.496 6 20 6.504 20 7.125v13.125c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V7.125Z" />
                </svg>
              }
              label="Metrics"
            />
          </div>

          <NavHeading>Manage</NavHeading>
          <div className="space-y-0.5">
            <SidebarLink
              to="/studio/setup"
              end
              icon={
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.084 2.093c.317.607.143 1.35-.427 1.668l-.894.533c-.378.226-.617.598-.617 1.008v1.098c0 .412.239.784.617 1.008l.894.533c.57.318.744 1.061.427 1.668l-1.084 2.093a1.125 1.125 0 0 1-1.37.49l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.075-.124l-1.217.456a1.125 1.125 0 0 1-1.37-.49l-1.084-2.092a1.125 1.125 0 0 1 .427-1.668l.894-.533c.378-.225.617-.598.617-1.008v-1.098c0-.412-.239-.784-.617-1.008l-.894-.533a1.125 1.125 0 0 1-.427-1.668l1.084-2.093a1.125 1.125 0 0 1 1.37-.491l1.217.456c.355.133.75.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.281Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
              }
              label="Setup"
            />
            <button
              type="button"
              onClick={openApiKeys}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] text-slate-400 transition hover:bg-white/[0.04] hover:text-slate-200"
            >
              <svg className="h-4 w-4 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
              </svg>
              API keys
            </button>
          </div>
        </nav>

        <div className="border-t border-white/[0.06] p-3">
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-slate-500 hover:bg-white/[0.04] hover:text-slate-300"
          >
            Sign out
          </button>
        </div>
      </aside>

      <aside
        className={cn(
          "hidden shrink-0 flex-col border-r border-white/[0.06] bg-[#09090b] transition-[width] duration-200 lg:flex",
          threadsOpen ? "w-[220px]" : "w-0 overflow-hidden border-r-0",
        )}
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-3">
          <span className="text-[13px] font-medium text-slate-300">Agents</span>
          <button
            type="button"
            className="rounded p-1 text-slate-600 hover:bg-white/5 hover:text-slate-400"
            onClick={() => setThreadsOpen(false)}
            aria-label="Collapse panel"
          >
            «
          </button>
        </div>
        <Link
          to="/studio/agents/new"
          className="mx-3 mt-3 rounded-lg border border-teal-500/25 bg-teal-500/10 py-2 text-center text-[12px] font-medium text-teal-200 hover:bg-teal-500/20"
        >
          + New assistant
        </Link>
        <div className="mt-3 flex-1 overflow-y-auto px-2 pb-4">
          {agents.slice(0, 12).map((a) => (
            <Link
              key={a.id}
              to={`/studio/agents/${a.id}`}
              className="mb-1 block truncate rounded-lg px-2 py-2 text-[12px] text-slate-500 hover:bg-white/[0.04] hover:text-slate-300"
              title={a.name}
            >
              {a.name}
            </Link>
          ))}
        </div>
      </aside>

      {!threadsOpen ? (
        <button
          type="button"
          className="hidden h-full w-6 shrink-0 items-center justify-center border-r border-white/[0.06] bg-[#09090b] text-slate-600 hover:bg-white/[0.03] hover:text-slate-400 lg:flex"
          onClick={() => setThreadsOpen(true)}
          aria-label="Expand agents panel"
        >
          »
        </button>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-white/[0.06] bg-[#0b0b0d]/95 px-4 py-3 md:hidden">
          <button
            type="button"
            className="rounded-lg border border-white/10 p-2 text-slate-400"
            onClick={() => setMobileNav(true)}
            aria-label="Open menu"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <span className="font-display text-lg text-white">Voice Studio</span>
        </header>

        <div className="relative flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto bg-[#0b0b0d] px-4 py-6 md:px-8">{children ?? <Outlet />}</div>

          {showComposer ? (
            <div className="shrink-0 border-t border-white/[0.06] bg-[#09090b] px-4 py-4 md:px-8">
              <div className="mx-auto flex max-w-3xl items-end gap-3 rounded-2xl border border-white/[0.08] bg-[#121215] px-4 py-3 shadow-inner shadow-black/40">
                <textarea
                  rows={2}
                  value={composer}
                  onChange={(e) => setComposer(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submitComposer();
                    }
                  }}
                  placeholder="Describe what you want to build…"
                  className="max-h-32 min-h-[44px] flex-1 resize-none bg-transparent text-[14px] text-slate-200 placeholder:text-slate-600 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => submitComposer()}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white hover:bg-teal-500"
                  aria-label="Send"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.5 19.5l15-15m0 0H9m10.5 0v10.5" />
                  </svg>
                </button>
              </div>
              <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-slate-600">
                Enter to jump to assistants · Shift + Enter new line
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
