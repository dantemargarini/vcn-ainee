# Train Ainee & Reset Conversations

## 0. "Ainee is ready" – only go live when both testers approve

The two test numbers (6197918675 and 6198693700) can train Ainee by having conversations and adding corrections. When **both** have texted **"ainee is ready"** (exact phrase not required; the message can contain it):

- The app records both approvals and replies: **"Both testers have approved. Ainee is ready for go-live."**
- An audit log entry is written so you know she’s approved.
- You can then deploy her and start her for real leads.

**Check status anytime:** GET your app URL + `/api/ainee/ready-status` → returns `ready: true/false` and who has approved so far.

## 1. Run the new database bits (one time)

If your Supabase was created before we added corrections and reset, run this in **Supabase → SQL Editor → New query**:

```sql
-- Corrections table
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

-- Reset column on leads
alter table public.leads add column if not exists conversation_reset_at timestamptz;
```

---

## 2. Add a correction ("when lead says X, Ainee should say Y")

**POST** your app URL + `/api/ainee/corrections`  
Body (JSON):

```json
{
  "trigger_text": "is this a scam",
  "preferred_response": "Totally get it. NGT was founded by two Air Force vets and is accredited through IAU. Here is the VA facility code if you want to verify: 21116705. What would help you feel comfortable?"
}
```

Use short phrases for `trigger_text` (what the lead said or something like it). Use the exact reply you want for `preferred_response`. Ainee will see all active corrections as "learned rules" on every reply.

**GET** same URL to list all active corrections.

---

## 3. Reset a contact's conversation

**POST** your app URL + `/api/ainee/reset-contact`  
Body (JSON):

```json
{
  "ghl_contact_id": "THE_GHL_CONTACT_ID",
  "move_to_new_lead": true
}
```

- Sets `conversation_reset_at` so from now on Ainee only uses messages **after** this time (fresh context).
- If `move_to_new_lead` is true (default), moves their opportunity to **New Lead** in GHL.

Get `ghl_contact_id` from GHL (contact profile URL or API). Works best for contacts that are already in your Supabase `leads` table (e.g. after a sync).
