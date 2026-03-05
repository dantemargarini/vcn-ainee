# Vercel NOT_FOUND (404) – Fix, Cause, and How to Avoid It

## 1. Suggested fix

**Do these in order:**

### A. Ensure the build succeeds on Vercel

1. **Vercel** → **vcn-ainee** → **Deployments** → open the **latest** deployment.
2. Open the **Build** step and read the log.
   - If the build **failed**: note the error (often `Module not found: 'openai'` or missing env). Fix it (see B and C), then **Redeploy**.
   - If the build **succeeded**: the deployed commit may be old or empty; push your full app (see D) and let a new deployment run.

### B. Ensure dependencies are installed in the build

Your app uses the `openai` package (`src/lib/ainee/chat.ts`). It must be present when Vercel runs `npm install` and `next build`.

- **Check:** In the repo root, `package.json` must list `"openai": "^4.73.0"` (or similar) under `dependencies`. It does.
- **Check:** The commit that Vercel is building must include this `package.json` (and ideally `package-lock.json`). If you only ever pushed an old “Initial commit” without the full app, the build may be using an old manifest or failing.
- **Fix:** Push the full codebase to `main` so Vercel builds from a commit that has the real app and correct `package.json`.

### C. Set environment variables (so runtime and build don’t break)

In **Vercel** → **Settings** → **Environment Variables**, set for **Production** (and Preview if you use it):

- `GHL_API_KEY`
- `GHL_LOCATION_ID`
- `GHL_PIPELINE_ID`
- `OPENAI_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Then **Redeploy** (Deployments → … → Redeploy). Missing vars can cause runtime errors; they usually don’t cause NOT_FOUND by themselves, but fixing them keeps the app healthy.

### D. Deploy the full app from your machine

```bash
cd /Users/dantemargarini/vcn-ainee
git add -A
git status
git commit -m "Full app: Next.js pages and API routes"
git push origin main
```

Wait for the new deployment to finish. The **Build** log must show **success**. Then open **https://vcn-ainee.vercel.app** — you should see the VCN Ainee page, not NOT_FOUND.

---

## 2. Root cause

### What the code is doing vs what it needs to do

- **What it’s doing:** You have a valid Next.js App Router app: `src/app/layout.tsx`, `src/app/page.tsx`, and API routes under `src/app/api/`. For the root URL `/`, Next.js should serve the page component from `src/app/page.tsx`.
- **What it needs to do:** For that to happen on Vercel, the deployment must (1) **build successfully** (so Vercel has a valid Next.js output), and (2) **contain that app** (the built commit must include the `app` directory and dependencies). If either fails, Vercel has no proper resource for `/` and returns NOT_FOUND.

### What conditions trigger this specific error

- **Build failure:** e.g. `Module not found: 'openai'` (or another missing dependency). The build exits with an error; Vercel may still mark the deployment “Ready” but there is no valid app to serve, so requests get NOT_FOUND or a generic error page.
- **Deployment from an old/empty commit:** The only (or latest) deployed commit might be “Initial commit” with no `src/app/page.tsx` or a different `package.json`. The build might “succeed” but produce no route for `/`, so `/` returns NOT_FOUND.
- **Wrong or typo’d URL:** Less likely here; you’re using the root of the deployment (`vcn-ainee.vercel.app`). NOT_FOUND in the Vercel docs also covers “resource moved, deleted, or typo in URL” — in your case the “resource” is the built app for `/`, which isn’t there when the build fails or the app isn’t in the built commit.

### What misconception or oversight led to this

- **Misconception:** “If the deployment is Ready, the site must work.” On Vercel, “Ready” can mean the deployment process finished; it doesn’t guarantee the build produced a valid app. A failed build or an empty/minimal commit can still leave you with NOT_FOUND.
- **Oversight:** Not confirming that (1) the **Build** step actually **succeeded** in the deployment logs, and (2) the **deployed commit** is the one that contains the full app and correct `package.json`. Fixing both (build success + correct commit) resolves the NOT_FOUND.

---

## 3. Underlying concept

### Why this error exists and what it protects

- **NOT_FOUND (404)** means: “The server understood the request, but there is no resource at this URL.” On Vercel, the “resource” can be a page, an API route, or even the whole app when the deployment has no valid output.
- **What it’s protecting:** It avoids serving the wrong or broken content. If the build failed or the app doesn’t define a route for `/`, returning 404 is correct instead of serving a broken page or a generic error that looks like real content.

### Correct mental model

- **Deployment pipeline:**  
  `git push` → Vercel runs `install` → `build` → if build succeeds, the **output** is what gets served. The URL you use (`vcn-ainee.vercel.app`) points at that **output**. If the build fails or the output has no route for `/`, requesting `/` returns NOT_FOUND.
- **Route = resource:** In Next.js App Router, each file under `src/app/` (e.g. `page.tsx`, `layout.tsx`) and under `src/app/api/` (e.g. `route.ts`) defines a route. Those files must be present in the repo **and** included in the build. If the build doesn’t run or doesn’t include them (wrong commit, build error), those routes don’t exist in the deployment → NOT_FOUND.

### How this fits into the framework

- **Next.js:** Build time turns your `app/` tree into a set of routes and server/edge handlers. A failed build or missing files means that set is incomplete or empty.
- **Vercel:** It runs the Next.js build and then serves only what that build produced. No successful build with your app in it → no route for `/` → NOT_FOUND for the root URL.

---

## 4. Warning signs and similar mistakes

### What to look for so this doesn’t happen again

- **Before assuming the site is “broken”:** Always check **Deployments** → latest deployment → **Build** log. If it’s red/failed, fix that first (dependencies, env, Node version).
- **After changing dependencies:** Run `npm install` and `npm run build` locally. If `next build` fails locally, it will fail on Vercel too.
- **After “Initial commit” or first push:** Confirm the commit that Vercel is building actually contains `src/app/page.tsx`, `src/app/layout.tsx`, and the `package.json` that lists all dependencies (e.g. `openai`). If the first push was minimal, push again with the full app.

### Similar mistakes in related scenarios

- **404 on a specific path (e.g. `/dashboard`):** You might have added `src/app/dashboard/page.tsx` only locally and not pushed, or the build might be excluding it (e.g. wrong `app` directory). Same idea: the route only exists if the file is in the built commit and the build succeeded.
- **404 on API route (e.g. `/api/webhooks/ghl/inbound`):** Same principle: the route exists only if `src/app/api/webhooks/ghl/inbound/route.ts` is in the repo and the build succeeded. Build failure or wrong branch/commit can cause NOT_FOUND for API routes too.
- **“Works locally, 404 on Vercel”:** Usually means local has a successful build and the full repo, while Vercel is building a different commit or a failing build. Compare: which commit is deployed? Does the build log show success?

### Code smells / patterns that suggest this issue

- Relying on “deployment Ready” without checking the **Build** log.
- Only one old commit on `main` (e.g. “Initial commit”) and never pushing the full app.
- Adding a dependency in code (`import openai from 'openai'`) but not adding it to `package.json`, or not committing `package.json` / `package-lock.json` — leads to “Module not found” and failed build → NOT_FOUND.

---

## 5. Alternatives and trade-offs

### Different ways to get a working deployment

1. **Fix build and push full app (recommended)**  
   - Set env vars, fix any “Module not found” by ensuring `package.json` and lockfile are correct and committed, push the full app, let Vercel build from that.  
   - **Trade-off:** One source of truth (Git); every push can trigger a deploy. You need to keep the repo and build in a good state.

2. **Redeploy without code change**  
   - If the build was failing only due to missing env vars, add the vars and use **Redeploy** so the same commit is built again with env available.  
   - **Trade-off:** Only helps when the code and commit are already correct; doesn’t fix an old/empty commit.

3. **Build and run locally, then deploy**  
   - Run `npm run build` and `npm run start` locally to simulate production. If that works, the same commit will usually work on Vercel once the build succeeds there.  
   - **Trade-off:** Catches build/runtime issues before push; doesn’t change how Vercel behaves, only verifies the app first.

4. **Use Vercel’s “Ignore Build Step” or override build command**  
   - Generally not recommended for Next.js. The real issue is “build must succeed and include the app,” not the command itself.  
   - **Trade-off:** Hiding a broken build can leave you with NOT_FOUND or broken routes; better to fix the build.

### Summary

- **Best path:** Ensure `package.json` (and lockfile) are correct, set env vars on Vercel, push the full app to `main`, and confirm the **Build** step **succeeds**. Then NOT_FOUND for the root URL should go away.
- **Mental model:** NOT_FOUND means “no resource at this URL.” On Vercel, the resource for `/` is created only when the Next.js build succeeds and the built commit contains your app. Fix the build and the deployed commit, and the error is resolved.
