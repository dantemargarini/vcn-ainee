-- Training & reset: corrections table + conversation_reset_at on leads
-- Run in Supabase SQL Editor if you already ran the main schema.

-- Preferred responses / corrections: "when lead says X, Ainee should say Y"
create table if not exists public.ainee_corrections (
  id uuid primary key default gen_random_uuid(),
  trigger_text text not null,
  preferred_response text not null,
  active boolean default true,
  created_at timestamptz default now()
);

create index if not exists idx_ainee_corrections_active on public.ainee_corrections(active);
alter table public.ainee_corrections enable row level security;
drop policy if exists "Allow all for anon on ainee_corrections" on public.ainee_corrections;
create policy "Allow all for anon on ainee_corrections" on public.ainee_corrections for all using (true) with check (true);

-- Reset: only use messages after this time when building Ainee context
alter table public.leads add column if not exists conversation_reset_at timestamptz;

-- Readiness: track when testers text "ainee is ready" (both must say it before go-live)
create table if not exists public.readiness_approvals (
  id uuid primary key default gen_random_uuid(),
  phone text unique not null,
  ghl_contact_id text,
  approved_at timestamptz default now()
);
alter table public.readiness_approvals enable row level security;
drop policy if exists "Allow all for anon on readiness_approvals" on public.readiness_approvals;
create policy "Allow all for anon on readiness_approvals" on public.readiness_approvals for all using (true) with check (true);
