import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { getToken } from "./api";
import Dashboard from "./pages/Dashboard";
import Landing from "./pages/Landing";
import OAuthCallback from "./pages/OAuthCallback";
import PhoneLogin from "./pages/PhoneLogin";
import VoiceAgent from "./pages/VoiceAgent";

function Protected({ children }: { children: ReactNode }) {
  if (!getToken()) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/oauth/callback" element={<OAuthCallback />} />
      <Route path="/login" element={<PhoneLogin />} />
      <Route
        path="/dashboard"
        element={
          <Protected>
            <Dashboard />
          </Protected>
        }
      />
      <Route
        path="/voice"
        element={
          <Protected>
            <VoiceAgent />
          </Protected>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
