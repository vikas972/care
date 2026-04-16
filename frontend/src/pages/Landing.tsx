import { Link } from "react-router-dom";
import { getToken, loginUrl } from "../api";

export default function Landing() {
  const loggedIn = !!getToken();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-white/5 bg-ink-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="font-display text-2xl text-white tracking-tight">SmartCall</span>
          {loggedIn ? (
            <Link
              to="/dashboard"
              className="text-sm font-medium text-emerald-400 hover:text-emerald-300"
            >
              Open dashboard →
            </Link>
          ) : null}
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto px-6 py-16 md:py-24">
        <p className="text-emerald-400/90 text-sm font-medium tracking-wide uppercase mb-4">
          Investor demo
        </p>
        <h1 className="font-display text-4xl md:text-6xl text-white leading-tight mb-6">
          Voice reminders that <em className="not-italic text-emerald-400">actually ring</em>
        </h1>
        <p className="text-lg text-slate-400 max-w-2xl mb-10 leading-relaxed">
          Sync Google Calendar for 15-minute pre-meeting calls. Schedule medicine reminders for family
          with acknowledgement (DTMF). Built for professionals and elder-care workflows.
        </p>

        <div className="flex flex-wrap gap-4 mb-16">
          {loggedIn ? (
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-emerald-500 text-ink-950 font-semibold hover:bg-emerald-400 transition-colors"
            >
              Go to dashboard
            </Link>
          ) : (
            <a
              href={loginUrl()}
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-white text-ink-950 font-semibold hover:bg-slate-200 transition-colors"
            >
              Sign in with Google
            </a>
          )}
          <a
            href={`${import.meta.env.VITE_API_URL || "http://localhost:8000"}/docs`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center px-6 py-3 rounded-xl border border-slate-600 text-slate-300 font-medium hover:border-slate-500 transition-colors"
          >
            API docs
          </a>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              title: "Calendar calls",
              body: "Events from Google Calendar trigger outbound voice at T−15 minutes with your script.",
            },
            {
              title: "Medicine schedules",
              body: "Daily or weekly times, encrypted phone numbers, Exotel voice + retry logic.",
            },
            {
              title: "Acknowledgement",
              body: "Press 1 to confirm; configurable retries if there is no answer or input.",
            },
          ].map((card) => (
            <div
              key={card.title}
              className="rounded-2xl border border-white/10 bg-ink-900/60 p-6 backdrop-blur-sm"
            >
              <h3 className="font-semibold text-white mb-2">{card.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{card.body}</p>
            </div>
          ))}
        </div>

        <p className="mt-14 text-sm text-slate-500 max-w-xl">
          Configure <code className="text-slate-400">FRONTEND_OAUTH_REDIRECT_URL</code> on the API to
          this app&apos;s <code className="text-slate-400">/oauth/callback</code> after the API
          handles Google at{" "}
          <code className="text-slate-400">http://localhost:8000/auth/google/callback</code>. If
          Google sends you to <code className="text-slate-400">http://localhost/?code=…</code>{" "}
          (port 80), you are using the wrong OAuth client type or redirect URI in Google Console—use
          a <strong className="text-slate-400 font-semibold">Web application</strong> client with
          that exact callback URL, not the Desktop client used by <code className="text-slate-400">calander.py</code>.
          Check <code className="text-slate-400">GET /auth/google/oauth-env</code> for the redirect
          URI this API is actually using.
        </p>
      </main>
    </div>
  );
}
