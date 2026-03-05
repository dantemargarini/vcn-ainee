# VCN Ainee — SMS Sales Agent

AI-powered SMS sales agent for **Veteran Career Networks** (NGT Academy / GI Bill cybersecurity program). Built with Next.js, Supabase, and (later) GHL, OpenAI, Slack, Resend.

---

## Step 1 — What’s in this repo

- **Next.js 15** (App Router, TypeScript, Tailwind) — frontend and API routes
- **Supabase** — database (leads, conversations, stage history, rep notes, audit logs)
- **`.env.local`** — your Supabase URL and anon key (never committed)
- **`/api/health`** — checks that Supabase is connected

---

## First-time setup (do this once)

### 1. Install dependencies

```bash
cd vcn-ainee
npm install
```

### 2. Create the database tables in Supabase

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. Go to **SQL Editor** → **New query**.
3. Open the file `supabase/schema.sql` in this repo, copy all of it, paste into the query box, and click **Run**.
4. You should see “Success. No rows returned.” That means the tables and policies were created.

### 3. Run the app locally

```bash
npm run dev
```

- Open [http://localhost:3000](http://localhost:3000) — you should see the VCN Ainee skeleton page.
- Open [http://localhost:3000/api/health](http://localhost:3000/api/health) — you should see `{"ok":true,"supabase":"connected"}`.

If health shows an error, check that you ran `schema.sql` in Supabase and that `.env.local` has the correct `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

---

## GitHub and Vercel (Step 1 deploy)

### GitHub

1. On [github.com](https://github.com), click **+** → **New repository**.
2. Name it e.g. `vcn-ainee`, leave it empty (no README, no .gitignore).
3. Copy the repo URL (e.g. `https://github.com/dantemargarini/vcn-ainee.git`).

In your project folder:

```bash
cd vcn-ainee
git init
git add .
git commit -m "Step 1: Next.js + Supabase skeleton"
git branch -M main
git remote add origin https://github.com/dantemargarini/vcn-ainee.git
git push -u origin main
```

### Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub.
2. **Add New** → **Project** → import the `vcn-ainee` repo.
3. Leave framework preset as Next.js. Under **Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon key
4. Click **Deploy**.

When it’s done, open your project’s **Settings** → **Domains** to see the live URL. Visit `https://your-project.vercel.app/api/health` — you should get `{"ok":true,"supabase":"connected"}`.

---

## Inbound SMS webhook (Ainee replies)

When a lead sends an SMS, GHL can POST to this app and Ainee will reply automatically.

- **Endpoint:** `POST /api/webhooks/ghl/inbound`
- **Note:** GHL cannot send to localhost. Use your Vercel URL or ngrok for local testing.
- **In GHL:** Settings → Integrations / Webhooks → Inbound Message → URL = your base + `/api/webhooks/ghl/inbound` (POST).
- **Behavior:** STOP → DND, no reply. Outside 8:30 AM–8 PM EST → log only. Else → Ainee replies, send via GHL, log Supabase, move to Sale in Progress.

---

## Next steps (Step 2)

After you confirm Step 1 works, we’ll add the GHL API connection and pull leads, conversations, notes, and stage history into Supabase.
