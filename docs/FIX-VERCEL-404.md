# Fix Vercel 404 for vcn-ainee

The domain **vcn-ainee.vercel.app** is correct. The 404 means the deployment either failed to build or was built from an old/empty commit. Follow these steps.

---

## Step 1: Check why the current deploy shows 404

1. In Vercel, open project **vcn-ainee**.
2. Go to **Deployments** (left sidebar).
3. Click the **latest** deployment (top of the list).
4. On that deployment page, find the **Build** step and click it to open the logs.

**What to look for:**

- **If the build FAILED**  
  You’ll see a red X or "Failed". Read the error in the log. Common causes:
  - **"Missing OPENAI_API_KEY"** or **"Module not found: openai"** → Add env vars (Step 2) and redeploy.
  - Other errors → Fix what the log says, then redeploy.

- **If the build SUCCEEDED**  
  The live deploy might be from an old commit (e.g. "Initial commit" with no real app). Push your latest code and redeploy (Step 3).

---

## Step 2: Set environment variables (required for build and webhook)

1. In Vercel: **vcn-ainee** → **Settings** → **Environment Variables**.
2. Add these for **Production** (and Preview if you want):

| Name | Value |
|------|--------|
| `GHL_API_KEY` | Your GHL API key |
| `GHL_LOCATION_ID` | e.g. `4gBJQ44TqhhOKpEcsrsp` |
| `GHL_PIPELINE_ID` | e.g. `d4EiaI9N258GlOTJNIhg` |
| `OPENAI_API_KEY` | Your OpenAI API key |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |

3. Save each one.
4. **Redeploy** so the new env vars are used: **Deployments** → click **…** on the latest deployment → **Redeploy** (no need to change code).

---

## Step 3: Deploy the latest code from your computer

If the build was from an old commit, push your full app and let Vercel build again.

1. On your machine, in the project folder:
   ```bash
   cd /Users/dantemargarini/vcn-ainee
   git status
   git add -A
   git commit -m "Full app for Vercel deploy"
   git push origin main
   ```
2. In Vercel, go to **Deployments**. A new deployment should start automatically.
3. Wait until it finishes. Check the **Build** log; it must **succeed**.
4. Open **https://vcn-ainee.vercel.app** — you should see the VCN Ainee page (Veteran Career Networks, sync button, green button), not 404.

---

## Step 4: You don’t need to change the domain

- **Add Custom Domain** in the checklist is optional (for your own domain like `ainee.com`).
- For the webhook, **vcn-ainee.vercel.app** is enough. Keep using:
  **https://vcn-ainee.vercel.app/api/webhooks/ghl/inbound**

---

## Quick checklist

- [ ] **Deployments** → latest deployment → **Build** log: build must **succeed**.
- [ ] **Settings** → **Environment Variables**: all 6 vars set for Production.
- [ ] Latest code pushed to **main** and new deployment finished.
- [ ] **https://vcn-ainee.vercel.app** shows the app, not 404.
