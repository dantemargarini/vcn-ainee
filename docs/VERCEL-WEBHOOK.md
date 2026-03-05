# Vercel + GHL Inbound Webhook Checklist

## 1. Deploy latest code to Vercel

Push to `main` so Vercel rebuilds:

```bash
cd vcn-ainee
git add -A
git status
git commit -m "Webhook + test number 24/7 + opener + proven sequence"
git push origin main
```

Wait for the deployment to finish in the Vercel dashboard.

---

## 2. Environment variables on Vercel

In Vercel: **Project → Settings → Environment Variables**. Add these (for **Production** and optionally Preview):

| Name | Required | Notes |
|------|----------|--------|
| `GHL_API_KEY` | Yes | GHL API key |
| `GHL_LOCATION_ID` | Yes | e.g. `4gBJQ44TqhhOKpEcsrsp` |
| `GHL_PIPELINE_ID` | Yes | e.g. `d4EiaI9N258GlOTJNIhg` |
| `OPENAI_API_KEY` | Yes | For Ainee's replies |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |

Redeploy after adding or changing env vars (Deployments → … → Redeploy).

---

## 3. Fix Vercel 404 first

The site must load before GHL can call your webhook. If you see 404:

1. **Push latest code:** `git add -A && git commit -m "Deploy" && git push origin main`
2. **Vercel → Project vcn-ainee → Deployments.** Open the **latest** deployment.
3. Check the **Build** step. If it **failed**, open the logs and fix the error (often missing env var or missing dependency). Then **Redeploy**.
4. **Env vars:** Project → Settings → Environment Variables. All 6 vars must be set (see section 2). **Redeploy** after adding any.
5. When the build is green and you open `https://vcn-ainee.vercel.app` you should see the VCN Ainee page, not 404.

---

## 4. Webhook URL when GHL only has “Private Integration” (PIT key)

GHL doesn’t always show “Webhooks” in the main menu. With **Private Integration** and a **PIT key**:

- The **PIT key** is for API access (your app talking to GHL).
- The **webhook URL** is where GHL sends events *to you* (e.g. new inbound message). It’s set in the **same app** where you got the PIT key.

**Where to set it:**

1. Go to **GoHighLevel Developer / Marketplace** (e.g. marketplace.gohighlevel.com or the place where you created the Private Integration).
2. Open **your app** (the one that has the PIT key).
3. In the app’s **Settings** or **Configuration**, look for:
   - **Webhook URL**, or  
   - **Subscription URL**, or  
   - **Event URL**, or  
   - **Webhooks** tab → add subscription for **InboundMessage** and set the URL there.
4. Set that URL to:  
   **`https://vcn-ainee.vercel.app/api/webhooks/ghl/inbound`**  
   (use your real Vercel domain if different).
5. Ensure the app is **installed / connected** to the **location** you use (same as `GHL_LOCATION_ID`). The location admin may need to “Add app” or “Connect” that integration.

If you don’t see a Webhook URL field, the plan may use **Workflows** instead: create a workflow with trigger “Contact sends message” (or “Inbound SMS”) and action “Webhook” / “HTTP POST” to that same URL.

---

## 5. What’s in place (as of this checklist)

- Inbound webhook: STOP → DND; 8:30 AM–8:00 PM EST for real leads; **test numbers 6197918675 & 6198693700 reply 24/7**.
- “Ainee is ready” from both test numbers → go-live message.
- Opener: “Hey {name}, this is Ainee…” + GI Bill question (your wording).
- Ainee system prompt: proven sequence after GI Bill (cert question → 95% + career assistance → salary/stability/remote → book call).
- Error components: `error.tsx`, `not-found.tsx`, `global-error.tsx` for stable localhost.
