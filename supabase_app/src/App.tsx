import { Navigate, Outlet, Route, Routes, useParams } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import StudioLayout from "./components/StudioLayout";
import AgentEditor from "./pages/AgentEditor";
import AgentsList from "./pages/AgentsList";
import DashboardPage from "./pages/DashboardPage";
import InboundPage from "./pages/InboundPage";
import Login from "./pages/Login";
import LogsPage from "./pages/LogsPage";
import MetricsPage from "./pages/MetricsPage";
import OutboundPage from "./pages/OutboundPage";
import SetupPage from "./pages/SetupPage";
import VoiceDemoPage from "./pages/VoiceDemoPage";

function ProtectedLayout() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050506] text-sm text-slate-400">
        Loading session…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function LegacyDemoRedirect() {
  const { agentId } = useParams();
  return <Navigate to={`/studio/demo?agent=${encodeURIComponent(agentId ?? "")}`} replace />;
}

function LegacyAgentEditRedirect() {
  const { agentId } = useParams();
  return <Navigate to={`/studio/agents/${agentId ?? ""}`} replace />;
}

export default function App() {
  const { user, loading } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={
          loading ? (
            <div className="flex min-h-screen items-center justify-center bg-[#050506] text-sm text-slate-400">
              Loading session…
            </div>
          ) : user ? (
            <Navigate to="/studio" replace />
          ) : (
            <Login />
          )
        }
      />

      <Route element={<ProtectedLayout />}>
        <Route path="/studio" element={<StudioLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="agents" element={<AgentsList />} />
          <Route path="agents/new" element={<AgentEditor />} />
          <Route path="agents/:agentId" element={<AgentEditor />} />
          <Route path="demo" element={<VoiceDemoPage />} />
          <Route path="outbound" element={<OutboundPage />} />
          <Route path="inbound" element={<InboundPage />} />
          <Route path="setup" element={<SetupPage />} />
          <Route path="logs" element={<LogsPage />} />
          <Route path="metrics" element={<MetricsPage />} />
        </Route>

        <Route path="/agents/new" element={<Navigate to="/studio/agents/new" replace />} />
        <Route path="/agents/:agentId/demo" element={<LegacyDemoRedirect />} />
        <Route path="/agents/:agentId" element={<LegacyAgentEditRedirect />} />
        <Route path="/agents" element={<Navigate to="/studio/agents" replace />} />
      </Route>

      <Route path="/" element={<Navigate to="/studio" replace />} />
      <Route path="*" element={<Navigate to="/studio" replace />} />
    </Routes>
  );
}
