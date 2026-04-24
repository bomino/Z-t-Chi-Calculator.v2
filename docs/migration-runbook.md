# Migration guide — GH Pages → Cloudflare Pages at `hgaladima.com`

Complete step-by-step walkthrough for moving the Z-t-Chi Calculator off
GitHub Pages and onto Cloudflare Pages under two subdomains of
`hgaladima.com`:

- **`ztchi.hgaladima.com`** — student calculator suite (public)
- **`teach.hgaladima.com`** — instructor builder (public page, token-gated API)

Covers DNS setup, both CF Pages projects, custom domain binding, TLS
provisioning, verification, monitoring migration, and rollback. Assumes
you have never managed DNS before. Code-side groundwork is already
committed (`functions/api/[[path]].js`, `_redirects`, `js/backend.js`,
etc.); what's left is dashboard clicks, two `wrangler deploy` calls,
and verification.

**Total time**: ~90 minutes when everything goes right. Budget 2 hours
if this is your first CF Pages deploy.

---

## Starting state

What you have right after registration:

| Asset | Where it lives |
|---|---|
| `hgaladima.com` domain | At your registrar (Namecheap, Google Domains, Porkbun, etc.) |
| Cloudflare account | Already exists — owns the `ztchi-backend` Worker |
| `ztchi-backend` Worker | Live at `https://ztchi-backend.malawali.workers.dev/` |
| GitHub Pages site | Live at `https://bomino.github.io/Z-t-Chi-Calculator.v2/` |
| Code in main branch | Already includes all frontend/backend changes for the migration |

Target state:

```
┌──────────────────────────┐    ┌──────────────────────────┐
│  ztchi.hgaladima.com     │    │  teach.hgaladima.com      │
│  (student calculator)    │    │  (instructor builder)     │
│  CF Pages: ztchi-calc    │    │  CF Pages: ztchi-teach    │
└────────────┬─────────────┘    └────────────┬──────────────┘
             │                                │
             │ /api/*  via Pages Function     │
             │ + service binding              │
             ▼                                ▼
       ┌────────────────────────────────────────┐
       │  ztchi-backend  (existing Worker)       │
       │  /health, /sign, /ai                    │
       │  secrets: SIGN_SECRET, ANTHROPIC_API_KEY,│
       │           INSTRUCTOR_TOKENS              │
       └────────────────────────────────────────┘
```

Both subdomains reach the same Worker via service binding — no CORS,
no duplicate secrets.

---

## Part 1 — DNS foundation

### Step 1.1 — Confirm the zone is active in Cloudflare

When you registered `hgaladima.com`, the registrar set default
nameservers. To use Cloudflare for DNS, those nameservers need to point
at Cloudflare's. Verify this:

**In your terminal:**
```bash
nslookup -type=NS hgaladima.com
```

Expected output includes two lines similar to:
```
hgaladima.com  nameserver = lewis.ns.cloudflare.com
hgaladima.com  nameserver = rachel.ns.cloudflare.com
```

The exact names vary by CF account (yours might be `alice.ns.cloudflare.com`,
`bob.ns.cloudflare.com`, etc.) — what matters is that both end in
`.ns.cloudflare.com`.

**In the Cloudflare dashboard:**
1. Log in to https://dash.cloudflare.com.
2. Click `hgaladima.com` in the zone list on the Overview page.
3. Under "Quick Actions" or the main view, the zone status should show
   **Active**.

If the zone is not active yet:
- Check your registrar's control panel. Find "Nameservers" or "DNS
  management."
- Change from the registrar's default to the two Cloudflare nameservers
  shown in the CF dashboard (Overview tab).
- Save. Propagation can take up to 24 hours (usually minutes).
- Retry the `nslookup` above until it shows Cloudflare nameservers.

### Step 1.2 — Understand what DNS records you'll create

You do NOT need to manually create any DNS records for this migration.
When you bind a custom domain to a CF Pages project in steps 3.4 and
5.4, Cloudflare automatically creates a CNAME record pointing the
subdomain at the Pages project:

```
ztchi.hgaladima.com  CNAME  ztchi-calculator.pages.dev    (auto-created)
teach.hgaladima.com  CNAME  ztchi-teach.pages.dev          (auto-created)
```

The bare `hgaladima.com` root stays empty (no A record). If later you
want to redirect `hgaladima.com` to `ztchi.hgaladima.com`, that's a
separate setup step (out of scope for this guide).

### Step 1.3 — Check for CAA records that could block TLS

CAA records tell certificate authorities whether they're allowed to
issue certs for your domain. An empty CAA set (default) lets any CA
issue. If CAA records exist and don't include Cloudflare's CAs, TLS
provisioning in step 3.5 will fail.

**Check via web tool** (PowerShell's DNS client doesn't support CAA natively):

Visit https://dnschecker.org/caa-lookup.php, enter `hgaladima.com`, and
run the check. Expected: empty result, or entries including
`letsencrypt.org`, `pki.goog`, or `sectigo.com`.

If any exclusive CAA record blocks Cloudflare's CAs, edit it in the CF
DNS panel before proceeding.

---

## Part 2 — Pre-flight checklist

Every box before migration day. Nothing in this part affects production;
it's verification only.

- [ ] `nslookup -type=NS hgaladima.com` returns Cloudflare nameservers
      (Step 1.1 above). **Don't proceed if not.**
- [ ] CF dashboard → `hgaladima.com` → status = **Active** (Step 1.1).
- [ ] CAA records empty or include CF CAs (Step 1.3).
- [ ] `wrangler whoami` (run inside the `backend/` directory) returns the
      Cloudflare account that owns the `hgaladima.com` zone. If it
      returns a different account, log in with the right one:
      `wrangler logout && wrangler login`.
- [ ] `wrangler secret list` returns exactly three entries:
      `SIGN_SECRET`, `ANTHROPIC_API_KEY`, `INSTRUCTOR_TOKENS`.
- [ ] **Plaintext values of all three secrets are backed up in your
      password manager.** Non-negotiable. If the CF account is ever lost,
      `SIGN_SECRET` being the sole copy means every historic
      instructor-issued link becomes unverifiable forever.
- [ ] `curl https://ztchi-backend.malawali.workers.dev/health` returns
      `{"ok":true,...}`.
- [ ] `curl -I https://bomino.github.io/Z-t-Chi-Calculator.v2/` returns
      200 (fallback is alive).
- [ ] Anthropic dashboard → Settings → Limits → monthly budget cap is set
      to a safe ceiling ($10–$25 is plenty for a 50-student semester).
- [ ] Git working tree clean (`git status` shows nothing pending).
- [ ] You have a ~90 minute block with no class or homework deadline
      within 24 hours. **Saturday morning 8–10 AM Eastern is the
      recommended window.**
- [ ] T-7 student announcement sent (new URL, old links still work).
- [ ] T-7 private instructor/TA message sent with the `teach.hgaladima.com`
      URL and the instructor token.

---

## Part 3 — Deploy the expanded Worker allowlist

The committed `backend/wrangler.toml` already lists both new subdomains
plus `bomino.github.io` (fallback) in `ALLOWED_ORIGINS`. Just publish it.

### Step 3.1 — Deploy

From the project root:

```bash
cd backend
wrangler deploy
```

Expected output includes:
```
Published ztchi-backend (X.XX sec)
  https://ztchi-backend.malawali.workers.dev
```

### Step 3.2 — Verify the Worker is healthy

```bash
curl https://ztchi-backend.malawali.workers.dev/health
```

Expected: `{"ok":true,"ts":...}`.

### Step 3.3 — Verify the allowlist changed

```bash
curl -X POST https://ztchi-backend.malawali.workers.dev/sign \
  -H "content-type: application/json" \
  -H "Origin: https://ztchi.hgaladima.com" \
  -H "Authorization: Bearer <your-instructor-token>" \
  -d '{"payload":{"v":1,"title":"preflight","answer":{"value":0.05}}}'
```

Expected: JSON with `payload`, `sig`, `alg:"HS256"`. This confirms the
new subdomain origin is allowed.

Also verify the legacy origin is still allowed:

```bash
curl -X POST https://ztchi-backend.malawali.workers.dev/sign \
  -H "content-type: application/json" \
  -H "Origin: https://bomino.github.io" \
  -H "Authorization: Bearer <your-instructor-token>" \
  -d '{"payload":{"v":1,"title":"preflight","answer":{"value":0.05}}}'
```

Expected: same signed payload. This confirms the rollback fallback.

**If either curl returns `origin not allowed` or a 403**: stop. The
allowlist didn't update correctly. Check that `backend/wrangler.toml`
line 8 (the `ALLOWED_ORIGINS` value) actually contains both domains,
then re-run `wrangler deploy`.

---

## Part 4 — Create the student CF Pages project

### Step 4.1 — Create the project

Cloudflare dashboard → **Workers & Pages** (left sidebar) →
**Create** → **Pages** → **Connect to Git**.

- Authorize GitHub if first time (pick your account).
- Select the repo **`bomino/Z-t-Chi-Calculator.v2`**.
- Project name: **`ztchi-calculator`**.
- Production branch: **`main`**.
- Build command: **(leave empty)** — it's a static site.
- Build output directory: **`/`** (the root of the repo).

Click **Save and Deploy**. First deploy takes 20–30 seconds.

### Step 4.2 — Add the service binding

CF Pages project → **Settings** → **Functions** → **Service bindings**
section → **Add binding**.

- Variable name: **`BACKEND`** (case-sensitive, exactly this)
- Service: **`ztchi-backend`**
- Environment: **Production**

Save. This makes the Worker reachable from `functions/api/[[path]].js`
as `env.BACKEND`. Without it, every `/api/*` request returns
`{"error":"backend service binding missing"}`.

### Step 4.3 — Canary test on the pages.dev URL

Open incognito and load `https://ztchi-calculator.pages.dev/`.

- [ ] Landing page renders, three nav dropdowns (Calculate / Study /
      Reference) visible.
- [ ] **No Teach link** in the nav (the decoupling is active).
- [ ] DevTools → Network → no 404s, no CORS errors.
- [ ] Visit `https://ztchi-calculator.pages.dev/api/health` in a new
      tab. Returns `{"ok":true,...}`. This confirms the service
      binding from step 4.2 is working.
- [ ] Visit `https://ztchi-calculator.pages.dev/t_calculator.html` —
      calculator loads, can do a computation.

**Gate:** if the landing page doesn't render or `/api/health` returns
anything other than 200 with JSON, stop. Do not bind the custom domain
until the pages.dev URL is fully healthy.

### Step 4.4 — Bind the custom domain `ztchi.hgaladima.com`

CF Pages project → **Custom domains** tab → **Set up a custom domain**.

Enter **`ztchi.hgaladima.com`**. Cloudflare:
1. Creates a DNS CNAME record automatically:
   `ztchi.hgaladima.com  CNAME  ztchi-calculator.pages.dev`
   You can verify in the CF dashboard → `hgaladima.com` → DNS tab.
2. Begins TLS certificate provisioning.

The custom domain row initially shows status **Verifying** or
**Initializing**. Wait for it to change to **Active** — usually 2–5
minutes, sometimes up to 15.

### Step 4.5 — TLS verification gate

Once the dashboard shows **Active**, verify from the terminal:

```bash
curl -Iv https://ztchi.hgaladima.com/ 2>&1 | grep -Ei 'subject|issuer|SSL certificate verify'
```

Required output:
- `subject: CN=ztchi.hgaladima.com` (or `*.hgaladima.com`)
- `issuer:` shows a known CA (Let's Encrypt, Google Trust Services,
  Sectigo, etc.)
- `SSL certificate verify ok`

**Abort criteria**: if any of the above is missing or wrong after 30
minutes of waiting, open a CF support ticket and don't proceed. You
can remove the custom domain binding (Custom domains → row → 3-dot
menu → Remove) to revert without affecting the pages.dev URL.

### Step 4.6 — Smoke test the student site

```bash
curl -I https://ztchi.hgaladima.com/                         # 200
curl -I https://ztchi.hgaladima.com/z_calculator.html        # 200
curl -I https://ztchi.hgaladima.com/instructor.html          # 404 (blocked by _redirects)
curl    https://ztchi.hgaladima.com/api/health               # {"ok":true,...}
```

Browser check in incognito:
- [ ] `https://ztchi.hgaladima.com/` renders correctly.
- [ ] Run any calculator (e.g., t_calculator) → click **Explain (AI)**
      → interpretation appears. This confirms `/api/ai` works end-to-end.

---

## Part 5 — Create the instructor CF Pages project

Same pattern as Part 4, but for a second project pointing at the same
repo. The shared `_redirects` file uses host-based rules so the same
source serves different content on each subdomain.

### Step 5.1 — Create the project

CF dashboard → **Workers & Pages** → **Create** → **Pages** →
**Connect to Git**.

- Repo: **`bomino/Z-t-Chi-Calculator.v2`** (same repo as project #1).
- Project name: **`ztchi-teach`**.
- Production branch: **`main`**.
- Build command: **(empty)**.
- Build output directory: **`/`**.

Save and Deploy. Deploys to `https://ztchi-teach.pages.dev/`.

### Step 5.2 — Add the service binding

Project → Settings → Functions → Service bindings → Add binding.

- Variable name: **`BACKEND`**
- Service: **`ztchi-backend`**
- Environment: **Production**

Save. This is the same binding you added to the student project — each
Pages project needs its own binding; they don't share.

### Step 5.3 — Canary test on the pages.dev URL

Open `https://ztchi-teach.pages.dev/` in incognito.

- [ ] Redirects or renders as the instructor builder (`/` → `/instructor.html`
      per `_redirects`).
- [ ] Minimal nav: "← Student site" + "◆ Instructor mode" badge only.
- [ ] Token gate overlay visible.
- [ ] `https://ztchi-teach.pages.dev/api/health` returns `{"ok":true,...}`.

### Step 5.4 — Bind the custom domain `teach.hgaladima.com`

Project → Custom domains → Set up a custom domain. Enter
**`teach.hgaladima.com`**.

Cloudflare auto-creates:
`teach.hgaladima.com  CNAME  ztchi-teach.pages.dev`

Wait for the row to show **Active** (TLS issued).

### Step 5.5 — TLS verification gate

```bash
curl -Iv https://teach.hgaladima.com/ 2>&1 | grep -Ei 'subject|issuer|SSL certificate verify'
```

Same requirements as step 4.5 — subject matches, known issuer, verify OK.
Same 30-minute abort criteria.

### Step 5.6 — Smoke test the instructor site

```bash
curl -I https://teach.hgaladima.com/                         # 200 (rewritten to /instructor.html)
curl -I https://teach.hgaladima.com/z_calculator.html        # 404 (blocked)
curl    https://teach.hgaladima.com/api/health               # {"ok":true,...}
```

Browser check in incognito:
- [ ] `https://teach.hgaladima.com/` loads directly as the instructor
      builder.
- [ ] Paste your instructor token → **Save token** → builder unlocks
      (green status line).
- [ ] **Load example** → **Generate link** → status reads "Signed with
      HS256..." and the output URL points at **ztchi.hgaladima.com**
      (not teach), with `?problem=...&sig=...`.

---

## Part 6 — Cross-domain end-to-end verification

This is the critical test: instructor generates a signed link on
`teach`, student opens it on `ztchi`, verification round-trips
through the student-site Pages Function.

### Step 6.1 — Generate a signed link

On `https://teach.hgaladima.com/` (logged in with your instructor token):

1. Click **Load example**.
2. Click **Generate link**.
3. Copy the generated URL. It should start with `https://ztchi.hgaladima.com/t_calculator.html?problem=...&sig=...`.

### Step 6.2 — Open the link as a student

Paste the URL into a fresh incognito window (different profile than
the one where you're signed in as instructor).

- [ ] Problem overlay appears at the top of the t-calculator page.
- [ ] Badge reads **VERIFIED** in green (not "UNSIGNED", not "verify failed").
- [ ] Calculator inputs are prefilled per the example.
- [ ] Enter the expected answer (0.033 for the default example) → submit
      → correct feedback.

If the badge says **verify failed**, the Pages Function on
`ztchi.hgaladima.com` can't reach the Worker. Check the service
binding on the `ztchi-calculator` project (step 4.2) — the variable
name must be exactly `BACKEND`.

### Step 6.3 — Verify a pre-migration signed link still works

This is the rollback-fallback test. If you have access to a signed link
that was generated BEFORE migration (same Worker, same `SIGN_SECRET`),
open it on both:

- `bomino.github.io/Z-t-Chi-Calculator.v2/...?problem=...&sig=...` — VERIFIED badge
- `ztchi.hgaladima.com/t_calculator.html?...same query...` — VERIFIED badge

Both should verify. This confirms `SIGN_SECRET` is unchanged and the
legacy GH Pages frontend is still a valid fallback.

### Step 6.4 — Regression tests

```
https://ztchi.hgaladima.com/tests.html
```

Expected: **84/84 tests passed ✓**.

### Step 6.5 — Negative tests

Confirm things that should be blocked are blocked:

```bash
# Instructor builder not reachable on the student domain
curl -I https://ztchi.hgaladima.com/instructor.html               # 404

# Student calculators not reachable on the instructor domain
curl -I https://teach.hgaladima.com/z_calculator.html             # 404
curl -I https://teach.hgaladima.com/corrections.html              # 404

# Internal files not web-served on either domain
curl -I https://ztchi.hgaladima.com/backend/wrangler.toml         # 404
curl -I https://teach.hgaladima.com/backend/wrangler.toml         # 404
curl -I https://ztchi.hgaladima.com/docs/migration-runbook.md     # 404
```

All five must 404.

---

## Part 7 — Migrate the scheduled monitor

The existing monitor cron (`a44e1d6f`) still probes
`ztchi-backend.malawali.workers.dev` with `Origin: https://bomino.github.io`.
Update it so it probes the new subdomain.

**In a fresh Claude Code session** (or via your cron-management tool):

1. Delete the old cron: `CronDelete a44e1d6f`.
2. Create a new cron that probes:
   - `https://ztchi.hgaladima.com/api/health`
   - `https://ztchi.hgaladima.com/api/sign` (with a test payload)
   - `https://ztchi.hgaladima.com/api/ai` (with a test context)
3. Update the Origin header in the probe from
   `https://bomino.github.io` to `https://ztchi.hgaladima.com`.
4. Trigger a manual probe to confirm green on all three endpoints
   before closing the session.

Optional but recommended: add a secondary low-frequency (daily) monitor
probing `https://ztchi-backend.malawali.workers.dev/health` so you
catch silent failure of the legacy fallback.

---

## Part 8 — Post-migration communication

### T-0 announcement (Dr. G → MPHO 605)

Template:
> The statistical calculator has moved to **https://ztchi.hgaladima.com/**.
> Problem links shared earlier in the semester continue to work —
> don't throw them away. If you had installed the calculator as an
> app, please reinstall from the new URL.

### T-0 private (Dr. G → TAs)

Template:
> Instructor builder is at **https://teach.hgaladima.com/**. Use the
> token I sent separately. Do NOT share this URL with students.
> Previously issued signed links still work — you don't need to
> regenerate them.

### T+7 self-audit

- Search the LMS for any references to `bomino.github.io` → update to
  the new URL.
- Search the syllabus, handouts, and any email templates → update.
- CF Pages dashboard → both projects → Analytics tab — confirm traffic
  is hitting the new domains, not just pages.dev.

---

## Part 9 — 24-hour soak

No action; observe.

- Monitor cron's next scheduled run (~next morning) completes green
  across all three endpoints.
- CF Workers dashboard → `ztchi-backend` → Metrics — no spike in 4xx/5xx.
- CF Pages dashboard → both projects → Analytics — traffic hitting
  the new domains.
- Anthropic usage dashboard — spend within normal range (<$1/day for
  a 50-student class).
- `curl -I https://bomino.github.io/Z-t-Chi-Calculator.v2/` still
  returns 200 — the GH Pages fallback is intact.

If all green at T+24h, migration is done.

---

## Part 10 — Rollback (reference; do not execute unless needed)

Rollback preconditions that keep all paths reversible:
- `workers_dev = true` stays on the Worker (default — not disabled).
- `bomino.github.io` stays in the Worker's `ALLOWED_ORIGINS`.
- GH Pages deploy stays live (don't delete `.github/workflows/deploy.yml`).

### Student site broken (Pages deploy failure, post-deploy regression)

1. CF Pages → `ztchi-calculator` → **Deployments** → select last
   known-good commit → **Rollback to this deployment**.
2. If that fails, CF Pages → Custom domains → remove
   `ztchi.hgaladima.com`. Users fall back to `bomino.github.io/Z-t-Chi-Calculator.v2/`.
3. LMS announcement immediately: "Site update rolled back; use the
   legacy URL for the next hour."

### Instructor site broken

1. CF Pages → `ztchi-teach` → remove custom domain binding.
2. Instructors bookmark `ztchi-teach.pages.dev` (CF-provided URL) or
   `bomino.github.io/Z-t-Chi-Calculator.v2/instructor.html` temporarily.
3. Private message to Dr. G + TAs only. Students don't know
   `teach.hgaladima.com` exists, so no student-facing announcement.

### Worker broken

1. `cd backend && git revert <last-commit> && wrangler deploy`.
2. Alternative: `wrangler versions list` → `wrangler versions deploy
   <prior-version-id> --percentage 100`.
3. Verify: `curl https://ztchi-backend.malawali.workers.dev/health`
   returns 200.

### Emergency comms rule

Don't leave users guessing for more than 5 minutes. Post the rollback
status (which URL to use, when to retry) to whichever channel
students normally get site updates.

---

## Part 11 — What's out of scope

Not part of this migration; plan separately if needed:

- **Email/MX records for `hgaladima.com`** — if Dr. G wants
  `anything@hgaladima.com` to route somewhere, configure MX records in
  CF DNS. Not part of the calculator migration.
- **CF Web Analytics** — preserves the privacy-first posture. Opt in
  later if useful.
- **Redirecting bare `hgaladima.com` → `ztchi.hgaladima.com`** — a
  separate CF Bulk Redirects rule; can add later.
- **Pure Pages Functions migration** (deleting `backend/`) — clean
  follow-up for a future sprint; current service-binding architecture
  preserves the Worker to minimize blast radius.
- **GH Pages sunset** — earliest end of first semester on the new
  domain. Keep indefinitely as redundancy OR deploy a meta-refresh
  tombstone on `bomino.github.io`.

---

## References

- Backend secrets, budgets, Worker internals: [`backend/DEPLOY.md`](../backend/DEPLOY.md).
- Architectural rationale and audit history: [`docs/audits/`](./audits/).
- Subdomain architecture summary: [`README.md`](../README.md) →
  "Subdomain layout" section.
- The committed `_redirects` file (host-based split rules):
  [`_redirects`](../_redirects).
- The Pages Function proxy: [`functions/api/[[path]].js`](../functions/api/%5B%5Bpath%5D%5D.js).
