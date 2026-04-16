import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { setToken } from "../api";

export default function OAuthCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [msg, setMsg] = useState("Signing you in…");

  useEffect(() => {
    const token = params.get("access_token");
    const err = params.get("error");
    if (err) {
      setMsg(`Sign-in failed: ${decodeURIComponent(err)}`);
      return;
    }
    if (token) {
      setToken(token);
      navigate("/dashboard", { replace: true });
      return;
    }
    setMsg("Missing token. Is FRONTEND_OAUTH_REDIRECT_URL set on the API?");
  }, [params, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <p className="text-slate-300">{msg}</p>
        {params.get("error") ? (
          <a href="/" className="mt-6 inline-block text-emerald-400 hover:underline">
            Back home
          </a>
        ) : null}
      </div>
    </div>
  );
}
