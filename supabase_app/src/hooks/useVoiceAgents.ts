import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { VoiceAgentRow } from "../types";

export function useVoiceAgents() {
  const [rows, setRows] = useState<VoiceAgentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setErr(null);
    setLoading(true);
    const { data, error } = await supabase
      .from("voice_agents")
      .select("*")
      .order("updated_at", { ascending: false });
    setLoading(false);
    if (error) {
      setErr(error.message);
      setRows([]);
      return;
    }
    setRows((data ?? []) as VoiceAgentRow[]);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { rows, loading, err, reload };
}
