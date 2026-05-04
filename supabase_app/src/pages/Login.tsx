import type { FormEvent } from "react";
import { useState } from "react";
import { supabase } from "../lib/supabase";

type EmailMode = "signin" | "signup";

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
    <div className="min-h-screen flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-ink-900/50 p-8 shadow-xl">
        <h1 className="font-display text-3xl text-white mb-1">Voice Studio</h1>
        <p className="text-sm text-slate-500 mb-8">
          Sign in with Supabase to configure agents, run browser demos, and place outbound calls.
        </p>

        <div className="flex rounded-xl bg-ink-950/80 border border-white/10 p-1 mb-6 gap-1">
          <button
            type="button"
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
              mode === "signin" ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
            onClick={() => {
              setMode("signin");
              setErr(null);
              setMsg(null);
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
              mode === "signup" ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
            onClick={() => {
              setMode("signup");
              setErr(null);
              setMsg(null);
            }}
          >
            Create account
          </button>
          <button
            type="button"
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
              mode === "phone" ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
            onClick={() => {
              setMode("phone");
              resetPhoneFlow();
              setErr(null);
              setMsg(null);
            }}
          >
            Phone OTP
          </button>
        </div>

        {err ? (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {err}
          </div>
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
                <label className="block text-sm text-slate-400 mb-1">Mobile (E.164)</label>
                <input
                  type="tel"
                  autoComplete="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-xl bg-ink-950 border border-white/10 px-4 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  placeholder="+15555550123"
                />
                <p className="text-xs text-slate-500 mt-2">
                  Requires Phone provider + SMS settings in your Supabase project.
                </p>
              </div>
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 text-sm"
              >
                {busy ? "Please wait…" : "Send SMS code"}
              </button>
            </form>
          ) : (
            <form onSubmit={(e) => void verifyPhoneOtp(e)} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  value={phoneOtp}
                  onChange={(e) => setPhoneOtp(e.target.value)}
                  className="w-full rounded-xl bg-ink-950 border border-white/10 px-4 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 font-mono tracking-widest"
                  placeholder="123456"
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 text-sm"
              >
                {busy ? "Please wait…" : "Verify and sign in"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => resetPhoneFlow()}
                className="w-full rounded-xl border border-white/15 text-slate-200 py-2.5 text-sm hover:bg-white/5"
              >
                Use a different number
              </button>
            </form>
          )
        ) : (
          <form onSubmit={(e) => void submitEmail(e)} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Email</label>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl bg-ink-950 border border-white/10 px-4 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Password</label>
              <input
                type="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl bg-ink-950 border border-white/10 px-4 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 text-sm"
            >
              {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
