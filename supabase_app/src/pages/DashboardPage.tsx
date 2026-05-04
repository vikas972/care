import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

function greetingName(email: string | undefined): string {
  if (!email) return "there";
  const local = email.split("@")[0] ?? "there";
  return local.slice(0, 1).toUpperCase() + local.slice(1);
}

function IconWrap({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-teal-500/15 text-teal-400 ring-1 ring-teal-500/25">
      {children}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const name = greetingName(user?.email ?? undefined);

  const cards = [
    {
      to: "/studio/agents/new",
      title: "Build",
      desc: "Walk through creating an assistant with prompts and LiveKit metadata.",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.061-.024 2.117-.14 3.743" />
        </svg>
      ),
    },
    {
      to: "/studio/demo",
      title: "Test call",
      desc: "Start a browser voice session with your deployed worker.",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393a9.065 9.065 0 0 1-1.712.617m0 0a9 9 0 0 1-3.728 0m3.728 0 .838-.393a10.03 10.03 0 0 0 3.079-2.436m0 0a9.052 9.052 0 0 0 2.079-5.598m-6 9.598v5.714m0 0v-.697c0-.597-.237-1.17-.659-1.591M12 21v-.697m0 0 1.395-.393a10.029 10.029 0 0 0 3.079-2.436m0 0 .617-1.712m-.617 1.712-.838.393a9 9 0 0 1-7.728 0m9.728 0-.838-.393a10.03 10.03 0 0 1-3.079-2.436m3.079 2.436 1.395-.393M9 21v-.697m0 0-.838-.393a10.029 10.029 0 0 1-3.079-2.436m3.079 2.436-.617 1.712" />
        </svg>
      ),
    },
    {
      to: "/studio/outbound",
      title: "Outbound",
      desc: "Dial PSTN numbers via LiveKit SIP using your saved agent.",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
        </svg>
      ),
    },
    {
      to: "/studio/inbound",
      title: "Inbound",
      desc: "Configure SIP inbound trunks and dispatch rules in LiveKit.",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
      ),
    },
  ];

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="relative mb-10 flex h-20 w-20 items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-teal-500/20 blur-xl" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-teal-400/30 to-cyan-600/20 ring-2 ring-teal-400/40">
            <svg className="h-8 w-8 text-teal-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.25}>
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        <h1 className="text-center font-display text-3xl text-white sm:text-4xl">
          Hey {name}, how can we help?
        </h1>
        <p className="mt-3 max-w-lg text-center text-sm text-slate-500">
          Build assistants, run browser demos, and manage outbound/inbound calling — wired to Supabase and LiveKit.
        </p>

        <div className="mt-12 grid w-full max-w-3xl gap-4 sm:grid-cols-2">
          {cards.map((c) => (
            <Link
              key={c.to}
              to={c.to}
              className="group rounded-2xl border border-white/[0.07] bg-[#121215]/90 p-6 shadow-xl shadow-black/30 transition hover:border-teal-500/35 hover:bg-[#16161a]"
            >
              <IconWrap>{c.icon}</IconWrap>
              <h2 className="font-semibold text-white">{c.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-500 group-hover:text-slate-400">{c.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
