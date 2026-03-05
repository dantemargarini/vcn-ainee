-- VCN Ainee - Database schema for Supabase
-- Run in Supabase: SQL Editor -> New query -> paste this entire file -> Run

-- 1. TABLES

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  ghl_contact_id text unique not null,
  location_id text not null,
  pipeline_id text not null,
  first_name text,
  last_name text,
  phone text not null,
  email text,
  current_stage text not null,
  last_message_at timestamptz,
  last_message_from text,
  last_reply_at timestamptz,
  dnd boolean default false,
  ghl_owner_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.stage_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  ghl_contact_id text not null,
  stage_name text not null,
  moved_at timestamptz default now(),
  moved_by text,
  note text
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  ghl_contact_id text not null,
  ghl_message_id text,
  body text not null,
  direction text not null,
  from_type text not null,
  from_ghl_user_id text,
  created_at timestamptz default now(),
  raw jsonb
);

create table if not exists public.rep_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  ghl_contact_id text not null,
  ghl_note_id text,
  content text not null,
  author_ghl_user_id text,
  author_name text,
  created_at timestamptz default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  log_type text not null,
  payload jsonb,
  created_at timestamptz default now()
);

create table if not exists public.reengagement_log (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  ghl_contact_id text not null,
  message_type text not null,
  sent_at timestamptz default now(),
  replied boolean default false
);

-- 2. INDEXES

create index if not exists idx_leads_current_stage on public.leads(current_stage);
create index if not exists idx_leads_last_reply_at on public.leads(last_reply_at);
create index if not exists idx_leads_ghl_contact_id on public.leads(ghl_contact_id);
create index if not exists idx_conversations_lead_id on public.conversations(lead_id);
create index if not exists idx_conversations_ghl_contact_id on public.conversations(ghl_contact_id);
create index if not exists idx_conversations_created_at on public.conversations(created_at);
create index if not exists idx_stage_history_lead_id on public.stage_history(lead_id);
create index if not exists idx_rep_notes_lead_id on public.rep_notes(lead_id);
create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at);
create index if not exists idx_reengagement_log_sent_at on public.reengagement_log(sent_at);

-- 3. ROW LEVEL SECURITY (drop old policies first so you can re-run this script)

alter table public.leads enable row level security;
alter table public.stage_history enable row level security;
alter table public.conversations enable row level security;
alter table public.rep_notes enable row level security;
alter table public.audit_logs enable row level security;
alter table public.reengagement_log enable row level security;

drop policy if exists "Allow all for anon on leads" on public.leads;
drop policy if exists "Allow all for anon on stage_history" on public.stage_history;
drop policy if exists "Allow all for anon on conversations" on public.conversations;
drop policy if exists "Allow all for anon on rep_notes" on public.rep_notes;
drop policy if exists "Allow all for anon on audit_logs" on public.audit_logs;
drop policy if exists "Allow all for anon on reengagement_log" on public.reengagement_log;

create policy "Allow all for anon on leads" on public.leads for all using (true) with check (true);
create policy "Allow all for anon on stage_history" on public.stage_history for all using (true) with check (true);
create policy "Allow all for anon on conversations" on public.conversations for all using (true) with check (true);
create policy "Allow all for anon on rep_notes" on public.rep_notes for all using (true) with check (true);
create policy "Allow all for anon on audit_logs" on public.audit_logs for all using (true) with check (true);
create policy "Allow all for anon on reengagement_log" on public.reengagement_log for all using (true) with check (true);
