# Get your Vercel link (do this once)

Your app is ready. These 3 steps get it online and give you the link.

---

## Step 1: Push the code to GitHub (about 2 minutes)

**1.1** Open **Terminal** on your Mac (Spotlight: type `Terminal`, press Enter).

**1.2** Copy and paste this **whole block** into Terminal, then press Enter:

```
cd /Users/dantemargarini/vcn-ainee
git init
git add .
git commit -m "VCN Ainee app"
git branch -M main
```

**1.3** Go to **github.com** in your browser. Log in. Click the **+** (top right) → **New repository**.

**1.4** Name it: **vcn-ainee**. Leave everything else as is. Click **Create repository**.

**1.5** GitHub will show you a page with commands. Ignore most of it. In Terminal, paste this (use your real GitHub username if it's not dantemargarini):

```
git remote add origin https://github.com/dantemargarini/vcn-ainee.git
git push -u origin main
```

Press Enter. If it asks for username/password, use your GitHub login (or a Personal Access Token if you use 2FA).

---

## Step 2: Deploy on Vercel (about 3 minutes)

**2.1** Go to **vercel.com** in your browser. Log in. Click **Add New…** → **Project**.

**2.2** You should see **vcn-ainee** in the list. Click **Import** next to it.

**2.3** Before clicking Deploy, click **Environment Variables**. Add these one by one (name and value):

| Name | Value |
|------|--------|
| GHL_API_KEY | (your GHL key that starts with pit-) |
| GHL_LOCATION_ID | 4gBJQ44TqhhOKpEcsrsp |
| GHL_PIPELINE_ID | d4EiaI9N258GlOTJNIhg |
| OPENAI_API_KEY | (your OpenAI key) |
| NEXT_PUBLIC_SUPABASE_URL | https://gcvrbryqsdlmhysodmmn.supabase.co |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | (your Supabase anon key) |

**2.4** Click **Deploy**. Wait until it says "Congratulations" or "Your project is ready".

**2.5** On that page you'll see a link like **vcn-ainee.vercel.app**. That is **your Vercel link**. Copy it.

---

## Step 3: Use your link

**To send test texts to your phones:** open in the browser:

```
https://YOUR-LINK-HERE.vercel.app/api/ghl/send-test-convo
```

(Replace YOUR-LINK-HERE with what you copied, e.g. `vcn-ainee`.)

**So Ainee replies when someone texts back:** In GoHighLevel → Settings → Webhooks → add a webhook for inbound messages. URL:

```
https://YOUR-LINK-HERE.vercel.app/api/webhooks/ghl/inbound
```

---

That's it. After Step 2 you have your link. After Step 3 both "text me" and "Ainee replies" work.
