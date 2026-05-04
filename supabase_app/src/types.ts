export type VoiceAgentRow = {
  id: string;
  user_id: string;
  name: string;
  livekit_agent_name: string;
  instructions: string;
  opening_script: string | null;
  job_metadata: Record<string, unknown>;
  attachment_storage_path: string | null;
  created_at: string;
  updated_at: string;
};
