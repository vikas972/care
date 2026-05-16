-- Run this in Supabase SQL Editor (Dashboard → SQL → New query).
-- Creates voice agent configs per user, RLS, and a private storage bucket for attachments.
--
-- If the app errors with "Could not find the table 'public.voice_agents' in the schema cache":
--   1) Confirm Table Editor shows `voice_agents` under schema `public` (script must succeed).
--   2) Run the NOTIFY line at the bottom (or re-run this whole file — IF NOT EXISTS is safe).

create extension if not exists "pgcrypto";

-- ---------- Tables ----------
create table if not exists public.voice_agents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  livekit_agent_name text not null default 'my-agent',
  instructions text not null default '',
  opening_script text,
  job_metadata jsonb not null default '{}'::jsonb,
  attachment_storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists voice_agents_user_id_idx on public.voice_agents (user_id);

-- ---------- updated_at ----------
create or replace function public.touch_voice_agents_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists voice_agents_set_updated_at on public.voice_agents;
create trigger voice_agents_set_updated_at
before update on public.voice_agents
for each row execute procedure public.touch_voice_agents_updated_at();

-- ---------- RLS ----------
alter table public.voice_agents enable row level security;

drop policy if exists "voice_agents_select_own" on public.voice_agents;
create policy "voice_agents_select_own"
on public.voice_agents for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "voice_agents_insert_own" on public.voice_agents;
create policy "voice_agents_insert_own"
on public.voice_agents for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "voice_agents_update_own" on public.voice_agents;
create policy "voice_agents_update_own"
on public.voice_agents for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "voice_agents_delete_own" on public.voice_agents;
create policy "voice_agents_delete_own"
on public.voice_agents for delete
to authenticated
using (auth.uid() = user_id);

-- ---------- Storage bucket (private) ----------
insert into storage.buckets (id, name, public)
values ('voice-agent-assets', 'voice-agent-assets', false)
on conflict (id) do nothing;

-- Objects stored as: <user_uuid>/<agent_uuid>/<filename>
drop policy if exists "voice_assets_select_own" on storage.objects;
create policy "voice_assets_select_own"
on storage.objects for select
to authenticated
using (
  bucket_id = 'voice-agent-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "voice_assets_insert_own" on storage.objects;
create policy "voice_assets_insert_own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'voice-agent-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "voice_assets_update_own" on storage.objects;
create policy "voice_assets_update_own"
on storage.objects for update
to authenticated
using (
  bucket_id = 'voice-agent-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'voice-agent-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "voice_assets_delete_own" on storage.objects;
create policy "voice_assets_delete_own"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'voice-agent-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Refresh PostgREST schema cache so the REST API sees `voice_agents` immediately.
notify pgrst, 'reload schema';
