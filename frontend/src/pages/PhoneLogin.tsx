import { FormEvent, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { api, setToken } from "../api";
import { auth } from "../firebase";

function describeFirebaseError(e: unknown): string {
  const anyE = e as any;
  const code = typeof anyE?.code === "string" ? anyE.code : null;
  const msg =
    typeof anyE?.message === "string"
      ? anyE.message
      : e instanceof Error
        ? e.message
        : "Unknown error";
  return code ? `${code}: ${msg}` : msg;
}

export default function PhoneLogin() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<"phone" | "code">("phone");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const verifierRef = useRef<RecaptchaVerifier | null>(null);
  const confirmationRef = useRef<any>(null);

  const canSend = useMemo(() => phone.trim().startsWith("+") && phone.trim().length >= 10, [phone]);
  const canVerify = useMemo(() => code.trim().length >= 4, [code]);

  async function sendOtp(ev: FormEvent) {
    ev.preventDefault();
    setErr(null);
    if (!canSend) return;

    setBusy(true);
    try {
      console.info("[otp] sending", { phone: phone.trim() });
      if (!verifierRef.current) {
        verifierRef.current = new RecaptchaVerifier(auth, "recaptcha-container", {
          size: "invisible",
        });
      }
      const confirmation = await signInWithPhoneNumber(auth, phone.trim(), verifierRef.current);
      confirmationRef.current = confirmation;
      console.info("[otp] sent");
      setPhase("code");
    } catch (e: unknown) {
      const d = describeFirebaseError(e);
      console.error("[otp] send failed", e);
      setErr(`OTP not sent: ${d}`);
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp(ev: FormEvent) {
    ev.preventDefault();
    setErr(null);
    if (!canVerify) return;

    setBusy(true);
    try {
      console.info("[otp] verifying");
      const confirmation = confirmationRef.current;
      if (!confirmation) throw new Error("No OTP request in progress. Please resend.");
      const cred = await confirmation.confirm(code.trim());
      const idToken = await cred.user.getIdToken();
      console.info("[otp] verified, exchanging token with API");

      const r = await api<{ access_token: string }>("/auth/phone/exchange", {
        method: "POST",
        body: JSON.stringify({ id_token: idToken }),
      });
      if (!r?.access_token) throw new Error("Login failed: no token returned");

      setToken(r.access_token);
      navigate("/dashboard", { replace: true });
    } catch (e: unknown) {
      const d = describeFirebaseError(e);
      console.error("[otp] verify failed", e);
      setErr(d);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-ink-900/60 p-6">
        <h1 className="font-display text-2xl text-white">Sign in with phone</h1>
        <p className="text-sm text-slate-400 mt-1">
          Enter your number (E.164) to receive an OTP.
        </p>

        {err ? (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {err}
          </div>
        ) : null}

        {phase === "phone" ? (
          <form onSubmit={(e) => void sendOtp(e)} className="mt-6 space-y-3">
            <label className="block text-sm text-slate-400">Phone number</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+919876543210"
              className="w-full rounded-xl bg-ink-950 border border-white/10 px-4 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              disabled={busy}
            />
            <button
              type="submit"
              disabled={!canSend || busy}
              className="w-full rounded-xl bg-white text-ink-950 font-semibold px-4 py-2.5 text-sm hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? "Sending…" : "Send OTP"}
            </button>
            <div id="recaptcha-container" />
          </form>
        ) : (
          <form onSubmit={(e) => void verifyOtp(e)} className="mt-6 space-y-3">
            <div className="text-sm text-slate-500">
              OTP sent to <span className="text-slate-300">{phone.trim()}</span>
            </div>
            <label className="block text-sm text-slate-400">OTP code</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              className="w-full rounded-xl bg-ink-950 border border-white/10 px-4 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              disabled={busy}
            />
            <button
              type="submit"
              disabled={!canVerify || busy}
              className="w-full rounded-xl bg-emerald-600 text-white font-semibold px-4 py-2.5 text-sm hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? "Verifying…" : "Verify & Continue"}
            </button>
            <button
              type="button"
              onClick={() => {
                setPhase("phone");
                setCode("");
                confirmationRef.current = null;
              }}
              className="w-full rounded-xl border border-slate-500 text-slate-200 font-medium px-4 py-2.5 text-sm hover:bg-white/5"
              disabled={busy}
            >
              Change phone
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

