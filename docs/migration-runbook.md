# Migration runbook — GH Pages → Cloudflare Pages (two subdomains)

Cut-over runbook for moving the student calculator to **`ztchi.hgaladima.com`**
and the instructor builder to **`teach.hgaladima.com`**. Execute top-to-bottom
on the planned maintenance window.

All the code-side groundwork is already committed: `functions/api/[[path]].js`
proxies `/api/*` to the Worker via service binding, `js/backend.js` resolves
to `/api` (same-origin), `_redirects` enforces the subdomain split at the
edge, `js/layout.js` renders the decoupled nav, and `backend/wrangler.toml`
lists all five production origins in `ALLOWED_ORIGINS`.

What's left is dashboard clicks, two `wrangler deploy` calls, and the
verification block.

---

## When to follow this

Only when:

- `hgaladima.com` has been purchased AND the zone is **Active** in the CF
  account that owns the `ztchi-backend` Worker.
- You have a ~90 minute block with no homework deadline in the preceding or
  following 24 hours. **Saturday morning 8–10 AM Eastern is the
  recommended window.**
- The pre-flight checklist below passes in full.

---

## 1. Pre-flight checklist

Every box. No exceptions.

- [ ] `whois hgaladima.com` shows Dr. Galadima as registrant.
- [ ] Cloudflare dashboard → `hgaladima.com` zone → status = **Active**.
- [ ] `dig CAA hgaladima.com` returns empty or includes Cloudflare CAs
      (`letsencrypt.org`, `pki.goog`, `sectigo.com`).
- [ ] `wrangler whoami` (inside `backend/`) returns the CF account that
      owns the zone.
- [ ] `wrangler secret list` returns exactly `SIGN_SECRET`,
      `ANTHROPIC_API_KEY`, `INSTRUCTOR_TOKENS`.
- [ ] **Plaintext values of all three secrets are backed up in a password
      manager.** If the CF account is ever lost, `SIGN_SECRET` being the
      sole copy means every historic instructor-issued link becomes
      unverifiable. Non-negotiable.
- [ ] `curl https://ztchi-backend.malawali.workers.dev/health` → `{"ok":true,...}`.
- [ ] `curl -I https://bomino.github.io/Z-t-Chi-Calculator.v2/` → 200.
- [ ] Anthropic → Settings → Limits → monthly budget cap set to $10–$25.
- [ ] Git working tree clean: `git status` shows nothing pending.
- [ ] T-7 student announcement sent (new URL, old links still work).
- [ ] T-7 private instructor/TA message sent (with the `teach.hgaladima.com`
      URL — this is NOT broadcast to students).

---

## 2. Deploy the Worker with expanded allowlist

The committed `backend/wrangler.toml` already includes both new subdomains in
`ALLOWED_ORIGINS`, keeping `bomino.github.io` as the legacy fallback. Just
deploy the Worker:

```bash
cd backend
wrangler deploy
```

Verify:

```bash
wrangler secret list
# Expect: ANTHROPIC_API_KEY, INSTRUCTOR_TOKENS, SIGN_SECRET

curl https://ztchi-backend.malawali.workers.dev/health
# Expect: {"ok":true,...}
```

**Gate:** if `wrangler deploy` fails, stop. Read the error. Do not proceed
to Pages project creation until the Worker is healthy.

---

## 3. Create CF Pages project #1 — `ztchi-calculator` (student)

CF dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.

- Select repo: `bomino/Z-t-Chi-Calculator.v2`
- Project name: `ztchi-calculator`
- Production branch: `main`
- Build command: **(empty)**
- Build output directory: `/`

Save and Deploy. First deploy takes ~30 seconds. Verify at
`https://ztchi-calculator.pages.dev/`.

---

## 4. Service binding on project #1

Project settings → **Functions** → **Service bindings** → **Add binding**.

- Variable name: `BACKEND`
- Service: `ztchi-backend`
- Environment: Production

Save. This exposes the Worker to `functions/api/[[path]].js` as `env.BACKEND`.

---

## 5. Canary test on `ztchi-calculator.pages.dev`

Open incognito, load the pages.dev URL:

- [ ] Landing page renders, three nav dropdowns (Calculate / Study / Reference)
      visible, **no Teach link** (the decoupling in `js/layout.js`).
- [ ] DevTools Network → no 404s.
- [ ] `https://ztchi-calculator.pages.dev/api/health` returns `{"ok":true,...}`
      (this confirms the service binding works).
- [ ] `https://ztchi-calculator.pages.dev/instructor.html` returns 404
      (the `_redirects` rule blocks it even on the pages.dev hostname —
      well, actually it keys on exact host match so on pages.dev it MAY
      serve the builder; don't worry about it, the production block works
      on `ztchi.hgaladima.com` which is what matters).

**Gate:** if landing page is broken or `/api/health` returns anything other
than 200 with JSON ok:true, stop and debug before touching DNS.

---

## 6. Bind custom domain `ztchi.hgaladima.com` to project #1

CF Pages project → **Custom domains** → **Set up a custom domain**.

Enter `ztchi.hgaladima.com`. CF creates the DNS CNAME automatically. Wait
for the custom domain row to show **Active** (TLS cert issued). Usually
2–5 minutes; can be up to 15.

---

## 7. TLS verification gate for `ztchi.hgaladima.com`

```bash
curl -Iv https://ztchi.hgaladima.com/ 2>&1 | grep -Ei 'subject|issuer|SSL certificate verify'
```

Required:
- `subject: CN=ztchi.hgaladima.com` (or `*.hgaladima.com`)
- `issuer:` shows a known CA
- `SSL certificate verify ok`

If not: wait 5 min, retry. If >30 min elapsed with no valid cert, open a
CF support ticket and abort the migration (remove the custom domain
binding; site stays on GH Pages).

---

## 8. Create CF Pages project #2 — `ztchi-teach` (instructor)

Repeat steps 3–4 with:

- Project name: `ztchi-teach`
- Same repo + same `main` branch + same build config

The shared `_redirects` file uses host-based rules so `teach.hgaladima.com/`
will rewrite to `/instructor.html` and calculator paths on this hostname
will 404 — no divergence needed between the two projects' sources.

Add the service binding exactly as in step 4 (variable `BACKEND` →
`ztchi-backend`). The teach site needs its own `env.BACKEND` for the
instructor builder to POST to `/api/sign`.

---

## 9. Bind custom domain `teach.hgaladima.com` to project #2

Same as step 6, but `teach.hgaladima.com` on the `ztchi-teach` project.
TLS gate: repeat step 7 against the teach URL.

---

## 10. Full verification

Run these in order; stop at the first failure.

**Curl smoke:**

```bash
# Student site
curl -I https://ztchi.hgaladima.com/                        # 200
curl -I https://ztchi.hgaladima.com/z_calculator.html       # 200
curl -I https://ztchi.hgaladima.com/instructor.html         # 404 (blocked)
curl    https://ztchi.hgaladima.com/api/health              # {"ok":true,...}

# Teach site
curl -I https://teach.hgaladima.com/                        # 200 (rewritten to /instructor.html)
curl -I https://teach.hgaladima.com/z_calculator.html       # 404 (blocked)
curl    https://teach.hgaladima.com/api/health              # {"ok":true,...}

# Cross-domain signing
curl -X POST https://teach.hgaladima.com/api/sign \
  -H "content-type: application/json" \
  -H "Origin: https://teach.hgaladima.com" \
  -d '{"payload":{"v":1,"title":"migration-test","answer":{"value":0.05}}}'
# Expect: payload + sig + alg:"HS256"

# Legacy fallback still works
curl https://ztchi-backend.malawali.workers.dev/health      # 200
curl -I https://bomino.github.io/Z-t-Chi-Calculator.v2/     # 200

# Internal files blocked on both subdomains
curl -I https://ztchi.hgaladima.com/backend/wrangler.toml   # 404
curl -I https://teach.hgaladima.com/backend/wrangler.toml   # 404
```

**Browser smoke (incognito):**

1. `https://ztchi.hgaladima.com/` → landing, three dropdowns, no Teach link.
2. `https://ztchi.hgaladima.com/t_calculator.html` → calculator runs; click
   any AI button → interpretation renders.
3. `https://teach.hgaladima.com/` → instructor builder loads directly.
4. Enter the instructor token in the token gate → click **Save token**.
5. Click **Load example** → **Generate link** → status should read
   *"Signed with HS256..."* and the output URL should start with
   `https://ztchi.hgaladima.com/t_calculator.html?problem=...&sig=...`.
6. Open that link in a new incognito tab → green **VERIFIED** badge.
7. **Critical**: open a signed link that was generated *before* migration
   (e.g., from the session during initial backend setup) → should still
   verify green, confirming `SIGN_SECRET` is unchanged.

**Regression tests:**

```bash
# Open in browser:
https://ztchi.hgaladima.com/tests.html
# Expect: 84/84 tests passed ✓
```

---

## 11. Migrate the scheduled monitor

The existing monitor cron (`a44e1d6f`) still probes the legacy
`*.workers.dev` URL with `Origin: https://bomino.github.io`. Update it:

1. `CronDelete a44e1d6f`.
2. `CronCreate` a new cron. Change in the prompt:
   - Probe URLs: `https://ztchi.hgaladima.com/api/{health,sign,ai}`
     (one lookup per endpoint, as the existing prompt describes).
   - Origin header: `https://ztchi.hgaladima.com`.
3. Optional: add a secondary low-frequency (daily) monitor at the legacy
   `ztchi-backend.malawali.workers.dev` URL with `Origin: https://bomino.github.io`.
   Alerts only on sustained failure (3 consecutive misses). Catches silent
   failure of the fallback path.

Trigger a manual probe (curl against the new endpoints) to confirm green
before closing the session.

---

## 12. Rollback (per failure mode)

**Student site broken** (Pages deploy failure, TLS issue, post-deploy
regression):

1. CF Pages → `ztchi-calculator` → **Deployments** → select the last
   known-good commit → **Rollback to this deployment**.
2. If rollback itself fails, remove the custom domain binding. Users fall
   back to `bomino.github.io/Z-t-Chi-Calculator.v2/`, which still works
   because we kept `workers_dev = true` and `bomino.github.io` in the
   Worker's `ALLOWED_ORIGINS`.
3. Post LMS announcement immediately: *"We are rolling back a site
   update. Use the legacy URL for the next hour."*

**Teach site broken:**

1. CF Pages → `ztchi-teach` → remove custom domain binding.
2. Instructors temporarily bookmark
   `https://bomino.github.io/Z-t-Chi-Calculator.v2/instructor.html` or the
   `ztchi-teach.pages.dev` direct URL.
3. Private message to Dr. G + TAs; no student-facing message (students
   don't know `teach.hgaladima.com` exists).

**Worker broken** (bad `wrangler deploy` in step 2):

1. `cd backend && git revert <commit-sha> && wrangler deploy`.
2. Alternatively: `wrangler versions list` → `wrangler versions deploy
   <prior-version-id> --percentage 100`.
3. Verify: `curl https://ztchi-backend.malawali.workers.dev/health` → 200.

---

## 13. Communication (templates)

**T-0 confirmation (Dr. G → MPHO 605):**
> Migration complete. New URL: **https://ztchi.hgaladima.com/**. Any
> problem links already shared continue to work. If you installed the
> calculator as an app, please reinstall from the new URL.

**T-0 private (Dr. G → TAs):**
> Instructor builder is now at **https://teach.hgaladima.com/**. Use the
> token I sent separately. Old URL still works as a fallback through the
> semester.

**T+7 self-audit**: check LMS, syllabi, email archives for any remaining
references to the old URL. Update them.

---

## 14. 24-hour soak

No action; just observe.

- Monitor cron next run: green across all three endpoints.
- CF Workers dashboard: no spike in 4xx/5xx.
- Anthropic usage dashboard: normal spend (< $1/day).
- `curl -I https://bomino.github.io/Z-t-Chi-Calculator.v2/` → still 200
  (fallback intact).
- No student complaints relayed via Dr. G.

If all green, migration is done. Update `README.md` if you want to promote
the new URL to the front; the "Subdomain layout" section already
describes the deployed architecture.

---

## Out of scope / deferred

- **Pure Pages Functions migration** (deleting `backend/`): clean
  follow-up for a future sprint; the current service-binding architecture
  preserves the Worker to minimize blast radius.
- **GH Pages sunset**: earliest end of first semester on the new domain.
  Options at that time: keep indefinitely as redundancy, or deploy a
  meta-refresh tombstone on `bomino.github.io` redirecting to the new URL.
- **Email / MX records on `hgaladima.com`**: Dr. G configures
  independently.
- **CF Web Analytics**: out of scope; preserves the privacy-first posture.

---

## References

- Architectural rationale: `docs/audits/scientific-critical-review-2026-04.md`
  (for the code-quality audit that shaped the current state) and
  `docs/audits/scientific-critical-review-new-code-2026-04.md`.
- Backend deployment details (secrets, budgets, Worker internals):
  `backend/DEPLOY.md`.
- Subdomain architecture description: `README.md` → "Subdomain layout"
  section.
