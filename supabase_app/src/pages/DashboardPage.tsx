import type { ReactNode } from "react";
import { VoiceHeroVisual } from "../components/VoiceOrb";
import AnimatedBackground from "../components/AnimatedBackground";
import { GlowButton } from "../components/GlowButton";
import { Reveal, StaggerGroup } from "../components/Reveal";
import TiltCard from "../components/TiltCard";
import { useAuth } from "../contexts/AuthContext";
import { useVoiceAgents } from "../hooks/useVoiceAgents";

function greetingName(email: string | undefined): string {
  if (!email) return "there";
  const local = email.split("@")[0] ?? "there";
  return local.slice(0, 1).toUpperCase() + local.slice(1);
}

function ActionCard({
  to,
  title,
  desc,
  icon,
  accent,
}: {
  to: string;
  title: string;
  desc: string;
  icon: ReactNode;
  accent?: "teal" | "violet" | "cyan" | "amber";
}) {
  const accents = {
    teal: "group-hover:border-teal-500/40 group-hover:shadow-teal-500/15",
    violet: "group-hover:border-violet-500/35 group-hover:shadow-violet-500/15",
    cyan: "group-hover:border-cyan-500/35 group-hover:shadow-cyan-500/15",
    amber: "group-hover:border-amber-500/35 group-hover:shadow-amber-500/15",
  };
  const iconBg = {
    teal: "bg-teal-500/15 text-teal-300 ring-teal-500/25 group-hover:bg-teal-500/25 group-hover:scale-110",
    violet: "bg-violet-500/15 text-violet-300 ring-violet-500/25 group-hover:bg-violet-500/25 group-hover:scale-110",
    cyan: "bg-cyan-500/15 text-cyan-300 ring-cyan-500/25 group-hover:bg-cyan-500/25 group-hover:scale-110",
    amber: "bg-amber-500/15 text-amber-300 ring-amber-500/25 group-hover:bg-amber-500/25 group-hover:scale-110",
  };
  const a = accent ?? "teal";

  return (
    <TiltCard
      to={to}
      className={`overflow-hidden rounded-2xl border border-white/[0.08] bg-[#12121a]/80 p-6 shadow-xl shadow-black/25 backdrop-blur-sm group ${accents[a]}`}
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br from-teal-500/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div
        className={`relative mb-4 flex h-11 w-11 items-center justify-center rounded-xl ring-1 transition-transform duration-300 ${iconBg[a]}`}
      >
        {icon}
      </div>
      <h2 className="relative font-semibold text-white transition group-hover:text-teal-100">{title}</h2>
      <p className="relative mt-2 text-sm leading-relaxed text-slate-500 transition group-hover:text-slate-400">{desc}</p>
      <span className="relative mt-4 inline-flex translate-x-0 items-center gap-1 text-xs font-medium text-teal-400 opacity-70 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100">
        Open
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
        </svg>
      </span>
    </TiltCard>
  );
}

const steps = [
  { n: "01", title: "Design your agent", desc: "Set prompts, voice, and LiveKit worker metadata." },
  { n: "02", title: "Test in the browser", desc: "Run a live voice session before you ship." },
  { n: "03", title: "Connect phone lines", desc: "Wire inbound and outbound SIP when you're ready." },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const { rows: agents } = useVoiceAgents();
  const name = greetingName(user?.email ?? undefined);
  const hasAgents = agents.length > 0;

  return (
    <div className="relative mx-auto flex w-full max-w-5xl flex-col pb-8">
      <AnimatedBackground className="z-0" />

      <Reveal>
        <section className="relative z-10 overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-b from-[#14141c]/95 via-[#101018]/95 to-[#0c0c12]/95 px-6 py-10 backdrop-blur-sm sm:px-10 sm:py-14">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(45,212,191,0.14),transparent)]" />
          <div className="pointer-events-none absolute -right-20 top-0 h-64 w-64 animate-blob-drift rounded-full bg-violet-600/10 blur-3xl" aria-hidden />
          <div
            className="pointer-events-none absolute -left-16 bottom-0 h-48 w-48 animate-blob-drift rounded-full bg-cyan-500/10 blur-3xl"
            style={{ animationDelay: "3s" }}
            aria-hidden
          />

          <div className="relative flex flex-col items-center gap-10 lg:flex-row lg:items-center lg:justify-between lg:gap-12">
            <div className="flex-1 text-center lg:text-left">
              <p className="inline-flex items-center gap-2 rounded-full border border-teal-500/25 bg-teal-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-teal-300">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-400" />
                </span>
                Voice AI platform
              </p>

              <h1 className="mt-5 animate-fade-up font-display text-4xl leading-tight text-white sm:text-5xl">
                {hasAgents ? (
                  <>
                    Welcome back, <span className="italic text-teal-200/95">{name}</span>
                  </>
                ) : (
                  <>
                    Build your first{" "}
                    <span className="bg-gradient-to-r from-teal-200 via-cyan-200 to-violet-200 bg-[length:200%_auto] bg-clip-text text-transparent animate-shimmer">
                      voice agent
                    </span>
                  </>
                )}
              </h1>

              <p className="mt-4 max-w-lg text-base leading-relaxed text-slate-400 sm:text-[15px]">
                {hasAgents
                  ? "Pick up where you left off — refine assistants, run demos, or connect phone lines."
                  : "Design conversational AI that speaks naturally, test in your browser, and deploy to real phone lines — powered by LiveKit and Supabase."}
              </p>

              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
                <GlowButton to="/studio/agents/new" className="w-full sm:w-auto">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  {hasAgents ? "New voice agent" : "Start building"}
                </GlowButton>
                <GlowButton
                  to={hasAgents ? "/studio/demo" : "/studio/agents"}
                  variant="secondary"
                  className="w-full sm:w-auto"
                >
                  {hasAgents ? "Try a test call" : "Browse assistants"}
                </GlowButton>
              </div>

              {hasAgents ? (
                <p className="mt-4 text-xs text-slate-600">
                  {agents.length} assistant{agents.length === 1 ? "" : "s"} in your workspace
                </p>
              ) : null}
            </div>

            <VoiceHeroVisual className="relative z-10 shrink-0 animate-float lg:mr-4" />
          </div>
        </section>
      </Reveal>

      {!hasAgents ? (
        <Reveal className="relative z-10 mt-10" delay={100}>
          <h2 className="text-center text-xs font-semibold uppercase tracking-widest text-slate-600">How it works</h2>
          <ol className="stagger-group mt-6 grid list-none gap-4 p-0 sm:grid-cols-3">
            {steps.map((s) => (
              <Reveal key={s.n} as="li" className="step-card rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-5">
                <span className="step-number inline-block font-mono text-xs font-bold text-teal-500/80 transition-transform duration-300">
                  {s.n}
                </span>
                <h3 className="mt-2 font-medium text-white">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{s.desc}</p>
              </Reveal>
            ))}
          </ol>
        </Reveal>
      ) : null}

      <Reveal className="relative z-10 mt-10" delay={200}>
        <section>
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Quick actions</h2>
              <p className="mt-1 text-sm text-slate-500">Everything you need to ship voice experiences</p>
            </div>
          </div>

          <StaggerGroup className="grid gap-4 sm:grid-cols-2">
            <Reveal>
              <ActionCard
                to="/studio/agents/new"
                title="Build assistant"
                desc="Configure prompts, inference settings, and LiveKit dispatch for your worker."
                accent="teal"
                icon={
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.061-.024 2.117-.14 3.743" />
                  </svg>
                }
              />
            </Reveal>
            <Reveal delay={80}>
              <ActionCard
                to="/studio/demo"
                title="Voice demo"
                desc="Talk to your agent in the browser with a live WebRTC session."
                accent="cyan"
                icon={
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3v-3m6 6v-3a3 3 0 0 0-3-3v0a3 3 0 0 0-3 3v3" />
                  </svg>
                }
              />
            </Reveal>
            <Reveal delay={160}>
              <ActionCard
                to="/studio/outbound"
                title="Outbound calls"
                desc="Dial PSTN numbers through LiveKit SIP with your saved agent."
                accent="violet"
                icon={
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                  </svg>
                }
              />
            </Reveal>
            <Reveal delay={240}>
              <ActionCard
                to="/studio/inbound"
                title="Inbound SIP"
                desc="Route incoming calls to your agents with dispatch rules."
                accent="amber"
                icon={
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                }
              />
            </Reveal>
          </StaggerGroup>
        </section>
      </Reveal>
    </div>
  );
}
