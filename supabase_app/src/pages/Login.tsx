import type { FormEvent } from "react";
import { useState } from "react";
import AnimatedBackground from "../components/AnimatedBackground";
import { Reveal } from "../components/Reveal";
import { VoiceHeroVisual } from "../components/VoiceOrb";
import { supabase } from "../lib/supabase";

type EmailMode = "signin" | "signup";

const features = [
  "Design agents with custom prompts and voice settings",
  "Test conversations in your browser instantly",
  "Connect inbound and outbound phone lines via SIP",
];

export default function Login() {
  const [mode, setMode] = useState<EmailMode | "phone">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneOtp, setPhoneOtp] = useState("");
  const [phoneStep, setPhoneStep] = useState<"send" | "verify">("send");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submitEmail(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMsg("Check your email to confirm your account if required by your Supabase project.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  async function sendPhoneOtp(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      const p = phone.trim();
      if (!p.startsWith("+")) {
        throw new Error("Use international format with + (E.164), e.g. +15555550123.");
      }
      const { error } = await supabase.auth.signInWithOtp({
        phone: p,
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
      setMsg("Check your phone for the SMS code.");
      setPhoneStep("verify");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to send SMS");
    } finally {
      setBusy(false);
    }
  }

  async function verifyPhoneOtp(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      const p = phone.trim();
      const { error } = await supabase.auth.verifyOtp({
        phone: p,
        token: phoneOtp.trim(),
        type: "sms",
      });
      if (error) throw error;
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Invalid code");
    } finally {
      setBusy(false);
    }
  }

  function resetPhoneFlow() {
    setPhoneStep("send");
    setPhoneOtp("");
    setErr(null);
    setMsg(null);
  }

  return (
    <div className="relative flex min-h-screen">
      <AnimatedBackground />
      <aside className="relative z-10 hidden w-[44%] max-w-xl flex-col justify-between overflow-hidden border-r border-white/[0.06] bg-gradient-to-b from-[#0e1018]/95 to-[#08080c]/95 px-10 py-12 backdrop-blur-sm lg:flex xl:max-w-2xl xl:px-14">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_20%_0%,rgba(45,212,191,0.14),transparent)]" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 animate-blob-drift rounded-full bg-violet-600/10 blur-3xl" />

        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500/30 to-cyan-600/20 font-display text-sm font-semibold text-teal-200 ring-1 ring-teal-400/30">
              VS
            </div>
            <span className="font-display text-xl text-white">Voice Studio</span>
          </div>

          <h1 className="mt-14 font-display text-4xl leading-[1.15] text-white xl:text-[2.75rem]">
            Ship voice agents
            <br />
            <span className="bg-gradient-to-r from-teal-200 to-cyan-200 bg-clip-text text-transparent italic">
              that sound human
            </span>
          </h1>
          <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-slate-400">
            The fastest path from idea to live phone calls — configure, test in-browser, and deploy on LiveKit.
          </p>

          <ul className="mt-10 space-y-3">
            {features.map((f, i) => (
              <li
                key={f}
                className="group flex items-start gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-400 transition-all duration-300 hover:translate-x-1 hover:bg-white/[0.04] hover:text-slate-300"
                style={{ transitionDelay: `${i * 60}ms` }}
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-500/15 text-teal-400 ring-1 ring-teal-500/25 transition group-hover:scale-110 group-hover:bg-teal-500/25">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                </span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        <VoiceHeroVisual className="relative mx-auto opacity-90" />
      </aside>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="mb-8 flex items-center gap-2 lg:hidden">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500/15 font-display text-sm text-teal-300 ring-1 ring-teal-500/25">
            VS
          </div>
          <span className="font-display text-xl text-white">Voice Studio</span>
        </div>

        <Reveal className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#12121a]/90 p-8 shadow-2xl shadow-black/40 backdrop-blur-sm transition-shadow duration-300 hover:shadow-teal-900/20 hover:shadow-2xl">
          <h2 className="font-display text-2xl text-white">
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Sign in to start building voice agents on the platform.
          </p>

          <div className="mb-6 mt-6 flex gap-1 rounded-xl border border-white/[0.08] bg-[#0a0a0e] p-1">
            {(
              [
                ["signin", "Sign in"],
                ["signup", "Sign up"],
                ["phone", "Phone"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all duration-300 ${
                  mode === id
                    ? "scale-[1.02] bg-gradient-to-r from-teal-600/90 to-cyan-600/80 text-white shadow-sm shadow-teal-900/30"
                    : "text-slate-400 hover:scale-[1.01] hover:text-slate-200"
                }`}
                onClick={() => {
                  setMode(id);
                  if (id === "phone") resetPhoneFlow();
                  setErr(null);
                  setMsg(null);
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {err ? (
            <div className="mb-4 rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-200">{err}</div>
          ) : null}
          {msg ? (
            <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200">
              {msg}
            </div>
          ) : null}

          {mode === "phone" ? (
            phoneStep === "send" ? (
              <form onSubmit={(e) => void sendPhoneOtp(e)} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm text-slate-400">Mobile (E.164)</label>
                  <input
                    type="tel"
                    autoComplete="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="input-glow w-full rounded-xl border border-white/10 bg-[#0a0a0e] px-4 py-2.5 text-white placeholder:text-slate-600"
                    placeholder="+15555550123"
                  />
                  <p className="mt-2 text-xs text-slate-600">Requires Phone provider + SMS in your Supabase project.</p>
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="btn-submit w-full rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 py-2.5 text-sm font-semibold text-white hover:from-teal-500 hover:to-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? "Please wait…" : "Send SMS code"}
                </button>
              </form>
            ) : (
              <form onSubmit={(e) => void verifyPhoneOtp(e)} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm text-slate-400">Code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                    value={phoneOtp}
                    onChange={(e) => setPhoneOtp(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#0a0a0e] px-4 py-2.5 font-mono tracking-widest text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                    placeholder="123456"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="btn-submit w-full rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 py-2.5 text-sm font-semibold text-white hover:from-teal-500 hover:to-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? "Please wait…" : "Verify and sign in"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => resetPhoneFlow()}
                  className="w-full rounded-xl border border-white/15 py-2.5 text-sm text-slate-200 hover:bg-white/5"
                >
                  Use a different number
                </button>
              </form>
            )
          ) : (
            <form onSubmit={(e) => void submitEmail(e)} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-slate-400">Email</label>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#0a0a0e] px-4 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                  placeholder="you@company.com"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-400">Password</label>
                <input
                  type="password"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#0a0a0e] px-4 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 py-2.5 text-sm font-semibold text-white hover:from-teal-500 hover:to-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? "Please wait…" : mode === "signup" ? "Create account & start building" : "Sign in to studio"}
              </button>
            </form>
          )}
        </Reveal>

        <p className="mt-8 max-w-sm text-center text-xs text-slate-600">
          By continuing you agree to use this workspace for voice agent development.
        </p>
      </main>
    </div>
  );
}
