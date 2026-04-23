# Cloudflare Workers Deployment Walkthrough

This is the step-by-step guide for standing up the optional backend that
powers **Instructor Mode signing** and the **AI interpreter**. The main
app works without the backend; deploy this only when you want those two
features live.

Total time on first run: ~20 minutes. Re-deploys after that: ~30 seconds.

---

## What you get

After following this guide:

| Endpoint | Purpose |
|---|---|
| `https://<your-worker>.workers.dev/health` | Liveness probe the frontend calls on page load |
| `https://<your-worker>.workers.dev/sign` | HMAC-signs instructor problem tokens |
| `https://<your-worker>.workers.dev/ai` | Proxies to Claude for the AI interpreter |

The Worker lives on Cloudflare's edge in ~300 cities. Cold-start is
~5 ms, typical round-trip from a student's browser is 20–80 ms.

---

## Prerequisites

You need four things before you start:

### 1. Cloudflare account (free)

Sign up at https://dash.cloudflare.com/sign-up. The free tier includes
**100,000 Worker requests per day** — more than enough for a single
class.

You do *not* need a custom domain. The Worker gets a free
`*.workers.dev` URL. If you later want `api.yourschool.edu` in front of
it, add the domain to CF and bind a route — see "Custom domain"
below.

### 2. Anthropic API key

Get one at https://console.anthropic.com/settings/keys. Add at least
$5 of credit to your account — in practice a 50-student class spending
all semester costs ~$2 against Claude Haiku 4.5. The key starts with
`sk-ant-api03-...`.

**Security note**: this key will only ever live as a Cloudflare Worker
secret. It never goes into git, never reaches students' browsers.

### 3. Node.js

Check you have it:

```bash
node --version
```

If the version is below 18, upgrade via https://nodejs.org. Windows
installer works; on macOS/Linux use `nvm`.

### 4. A shell

Use **bash** (Git Bash on Windows works) for the commands below.
PowerShell also works but the command substitution syntax differs for
the secret-generation step.

---

## Step 1 — Install wrangler

Wrangler is Cloudflare's Workers CLI. Install it globally:

```bash
npm install -g wrangler
```

Verify:

```bash
wrangler --version
```

Expect `⛅️ wrangler 3.xx.x` or similar.

> **If you don't want a global install**, prefix every `wrangler`
> command below with `npx ` (e.g. `npx wrangler login`).

---

## Step 2 — Log in to Cloudflare

```bash
wrangler login
```

This opens your browser to authorize the CLI. Click **Allow**. When
you come back to the terminal it will print something like:

```
Successfully logged in.
```

You're now authenticated on this machine until you run
`wrangler logout`.

Verify by listing your accounts:

```bash
wrangler whoami
```

You should see your email and a numeric Account ID.

---

## Step 3 — Generate the HMAC signing secret

Pick a random, unguessable string. Any of the three methods below
produces a cryptographically strong one:

**bash / macOS / Linux / Git Bash**
```bash
openssl rand -base64 48
```

**PowerShell**
```powershell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }))
```

**Anywhere (online tool, with a grain of salt)**
https://www.random.org/strings/ — 48 alphanumeric chars.

You should end up with something like:

```
y4V8/LmP2dQ5kRn7tYuIoAsDfGhJkL9qWeRtYuIoPAsDfGhJkL9qWeRtYuIoPAsD
```

**Save this string** somewhere safe (1Password, Bitwarden, etc.). If
you lose it later, you can generate a new one and re-deploy, but every
previously-issued instructor link will show "signature mismatch" to
students until reissued.

---

## Step 4 — Configure `wrangler.toml`

Open `backend/wrangler.toml` and update two values:

### 4a. `ALLOWED_ORIGINS`

CORS allowlist. Set this to the exact origins your frontend is served
from. Include a trailing origin with no path, no trailing slash.

```toml
ALLOWED_ORIGINS = "https://bomino.github.io,http://localhost:8804,http://127.0.0.1:8804"
```

- `https://bomino.github.io` — the production GitHub Pages URL.
- `http://localhost:8804` and `http://127.0.0.1:8804` — for local dev.

If your GH Pages URL is different (e.g. a custom domain), replace the
first entry.

### 4b. `RATE_LIMIT_PER_HOUR`

Per-IP calls allowed to `/ai` per rolling hour. Defaults to `60` —
enough for a student to run ~6 calculations per 10 minutes. Tune
down if you want to be conservative on spend; up if a classroom
crashes into the limit during synchronous activity.

### 4c. `AI_MODEL`

Currently `claude-haiku-4-5-20251001`. Haiku is the cheapest Claude
model capable of this task and is more than adequate for 140-word
interpretations. If you want richer prose and don't mind 10× the
cost, change to `claude-sonnet-4-6`.

Save the file.

---

## Step 5 — Set Cloudflare Worker secrets

Secrets differ from vars: they're encrypted at rest in CF, not visible
in the dashboard or in git.

Move into the backend directory:

```bash
cd backend
```

### 5a. Signing secret

```bash
wrangler secret put SIGN_SECRET
```

The CLI prompts you to paste the value. Paste the string from Step 3
and hit Enter. It echoes:

```
✨ Success! Uploaded secret SIGN_SECRET
```

### 5b. Anthropic API key

```bash
wrangler secret put ANTHROPIC_API_KEY
```

Paste your `sk-ant-api03-...` key. Expect:

```
✨ Success! Uploaded secret ANTHROPIC_API_KEY
```

### 5c. Verify both are registered

```bash
wrangler secret list
```

Expect:

```
[
  { "name": "ANTHROPIC_API_KEY", "type": "secret_text" },
  { "name": "SIGN_SECRET", "type": "secret_text" }
]
```

You will never see their values again — that's by design. To change
one, run `wrangler secret put <name>` again.

---

## Step 6 — Deploy

Still in the `backend/` directory:

```bash
wrangler deploy
```

Expect output similar to:

```
⛅️ wrangler 3.x.x
───────────────────
Total Upload: 4.37 KiB / gzip: 1.58 KiB
Worker Startup Time: 3 ms
Uploaded ztchi-backend (1.23 sec)
Published ztchi-backend (0.36 sec)
  https://ztchi-backend.your-subdomain.workers.dev
Current Deployment ID: 2f6b....
```

**Copy the URL** — you'll paste it into the frontend in Step 8.

---

## Step 7 — Verify the deployment

### 7a. Health check

```bash
curl https://ztchi-backend.your-subdomain.workers.dev/health
```

Expect:

```json
{"ok":true,"ts":1700000000000}
```

If you get a 403 or 0-byte response, your origin wasn't in the
allowlist. Re-check Step 4a — the `Origin` header `curl` sends is
empty, so `/health` is specifically allowed without it. If `/health`
itself fails, the Worker didn't deploy — re-read the `wrangler deploy`
output for errors.

### 7b. Signing check (simulates the instructor page)

```bash
curl -X POST https://ztchi-backend.your-subdomain.workers.dev/sign \
  -H "content-type: application/json" \
  -H "Origin: http://localhost:8804" \
  -d '{"payload":{"v":1,"title":"test","answer":{"value":0.05}}}'
```

Expect:

```json
{"payload":"eyJ2IjoxLCJ0aXRsZSI6InRlc3QiLCJhbnN3ZXIiOnsidmFsdWUiOjAuMDV9fQ","sig":"AbCdEf...","alg":"HS256"}
```

If you get `403 origin not allowed`, your `Origin` header doesn't match
the allowlist. Fix `wrangler.toml` and re-deploy.

### 7c. AI check

```bash
curl -X POST https://ztchi-backend.your-subdomain.workers.dev/ai \
  -H "content-type: application/json" \
  -H "Origin: http://localhost:8804" \
  -d '{"test":"z","statistic":1.96,"pValue":0.025,"twoTailed":0.05,"alpha":0.05,"method":"one-sample Z"}'
```

Expect a JSON response with a `text` field containing a ~140-word
interpretation, and `model` / `usage` metadata. First call on a cold
Worker can take 1–3 seconds; subsequent calls in the same minute are
sub-second.

If you get `503 AI not configured`, the `ANTHROPIC_API_KEY` secret
isn't set — re-run Step 5b.

If you get `502 upstream`, Anthropic returned an error. Look at the
`detail` field for specifics: insufficient credit, rate-limited at
Anthropic, invalid model ID, etc.

---

## Step 8 — Point the frontend at the backend

Open `js/backend.js` in the repo root:

```js
const BACKEND_URL = '';
```

Change it to:

```js
const BACKEND_URL = 'https://ztchi-backend.your-subdomain.workers.dev';
```

Save, commit, push:

```bash
git add js/backend.js
git commit -m "Point frontend at production backend"
git push
```

GitHub Pages rebuilds within a minute. Do a hard refresh on the live
site (Ctrl+Shift+R / Cmd+Shift+R) to bypass the PWA service worker
cache.

> **Alternative**: leave `BACKEND_URL = ''` hardcoded and inject the
> URL per-deployment via an inline script in the HTML, e.g.
> `<script>window.ZTCHI_BACKEND_URL = 'https://...'</script>`. This
> is useful if the same codebase is deployed to multiple backends
> (staging vs. production). `backend.js` prefers
> `window.ZTCHI_BACKEND_URL` over the hardcoded constant.

---

## Step 9 — End-to-end verification in the browser

### 9a. Instructor status line

Open `instructor.html` on the live site. Near the top you should see:

> Backend status: **online (https://ztchi-backend.your-subdomain.workers.dev)**

If it says "not configured" your change didn't reach the browser —
hard-refresh and check the network tab for the `/health` request.

### 9b. Generate and verify a signed link

1. Click **Load example** in the instructor builder.
2. Click **Generate link**. The status line underneath the output
   box should read: *Signed with HS256 (XXXXX…). Students' clients
   will verify against the backend.*
3. Click **Copy link**, then open it in a new incognito window.
4. At the top of `t_calculator.html` the problem overlay appears with
   a green **VERIFIED** badge.

If you see **UNSIGNED** instead, the frontend didn't reach `/sign` —
open DevTools Network and look for a CORS error or a 4xx on `/sign`.

### 9c. AI button

1. Run any test on Z, t, or chi calculator (example: `t-stat = 2.31`,
   `df = 18`, click Calculate).
2. In the results area scroll to the ✨ **Explain in plain English
   (AI)** button.
3. Click it. You should see "Asking the model…" for ~1 s, then a
   purple-badged panel with an interpretation and the formula.

If the button is greyed out with tooltip *"no backend is configured"*,
the `/health` probe failed. Check the URL matches what you deployed
and the Origin is in the allowlist.

---

## Step 10 — Monitor

### Cloudflare Worker usage

Dashboard: https://dash.cloudflare.com → **Workers & Pages** →
**ztchi-backend** → **Metrics**. You'll see:

- Requests per minute
- Error rate
- CPU time per invocation (should be <20 ms)

### Anthropic spend

Dashboard: https://console.anthropic.com → **Usage**. Filter by
model. A typical AI-interpreter call to Haiku 4.5 uses ~500 input +
~300 output tokens = ~$0.0005. **Budget caps** live at
https://console.anthropic.com/settings/limits — recommend setting a
monthly limit (e.g. $10) to fail-safe against abuse.

---

## Rotating secrets

### Rotate `SIGN_SECRET`

Generate a new random string (Step 3). Run:

```bash
wrangler secret put SIGN_SECRET
# paste new string
wrangler deploy
```

Every previously-issued instructor link now shows "signature
mismatch" to students. Re-issue affected assignments — the problem
spec is still inside the link; you just need to regenerate a new
signed version on `instructor.html`.

### Rotate `ANTHROPIC_API_KEY`

Generate a new key in the Anthropic console, **then**:

```bash
wrangler secret put ANTHROPIC_API_KEY
# paste new key
wrangler deploy
```

Delete the old key in the Anthropic console immediately so a leaked
copy can't be used.

---

## Custom domain (optional)

If you want `api.yourschool.edu` instead of `*.workers.dev`:

1. Add the domain to your Cloudflare account (free).
2. In `wrangler.toml`, add:
   ```toml
   routes = [{ pattern = "api.yourschool.edu/*", custom_domain = true }]
   ```
3. Re-deploy: `wrangler deploy`.
4. Update `ALLOWED_ORIGINS` and the frontend `BACKEND_URL` to match.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `/health` returns HTML (not JSON) | Worker didn't publish — URL hits a 404 page | Re-read `wrangler deploy` output; verify `name` in `wrangler.toml` matches the URL |
| `403 origin not allowed` from `/sign` or `/ai` | Your Origin isn't in `ALLOWED_ORIGINS` | Add it to `wrangler.toml`, `wrangler deploy` again |
| CORS error in browser devtools | Same as above, or preflight OPTIONS isn't returning the header | Check the network tab for the OPTIONS request; its response should set `access-control-allow-origin` |
| `503 signing not configured` | `SIGN_SECRET` not set | `wrangler secret put SIGN_SECRET` |
| `503 AI not configured` | `ANTHROPIC_API_KEY` not set | `wrangler secret put ANTHROPIC_API_KEY` |
| `502 upstream` with Anthropic error `insufficient_quota` | Anthropic account has no credit | Top up at console.anthropic.com |
| `429 rate limit exceeded` | Student hit the per-IP cap | Increase `RATE_LIMIT_PER_HOUR`, re-deploy |
| Student sees "unsigned" badge | Instructor generated the link before the backend was reachable | Re-generate the link from `instructor.html` after backend comes online |
| `/ai` response text looks templated / identical across calls | Model might be too constrained; prompt is deliberately tight but if it feels repetitive, loosen `max_tokens` in `worker.js` | Edit `worker.js`, `wrangler deploy` |
| Worker shows zero invocations in the dashboard after student clicks | Frontend is hitting cached JS from before you set `BACKEND_URL` | Bump `CACHE_VERSION` in `sw.js`, or hard-reload |
| `wrangler deploy` fails with `not authenticated` | Token expired | `wrangler login` again |

### Viewing live logs

To watch the Worker in real-time while debugging:

```bash
wrangler tail
```

Leave this open; every request prints its URL, status, and any
`console.log` the Worker emits.

---

## Security checklist (before going live with a class)

- [ ] `SIGN_SECRET` is a strong random string, not a memorable phrase.
- [ ] `ANTHROPIC_API_KEY` has a **monthly spend cap** set in the
      Anthropic console.
- [ ] `ALLOWED_ORIGINS` is the minimal set — your production site and
      your local dev, nothing else.
- [ ] `RATE_LIMIT_PER_HOUR` is set to a reasonable value (default 60
      is fine for MPHO 605-size classes).
- [ ] `wrangler secret list` confirms both secrets are registered.
- [ ] A `curl` to `/health` returns JSON; to `/sign` and `/ai` with a
      valid Origin returns the expected shape.
- [ ] The frontend `BACKEND_URL` points at the right Worker URL.
- [ ] Hard-reload on the live site: instructor status shows "online",
      signed links show "VERIFIED", AI button is enabled.
- [ ] The `backend/` directory is committed but `SIGN_SECRET` and
      `ANTHROPIC_API_KEY` are **not** anywhere in the repo (they
      only exist as CF secrets).

---

## Cost estimate

For a class of 50 students, over one semester (16 weeks):

| Item | Assumption | Cost |
|---|---|---|
| Worker requests | 50 students × ~60 page-loads/week × 16 weeks + AI/sign calls | ~56k requests | Free tier covers 100k/day |
| Anthropic AI calls | 50 students × 3 AI clicks/week × 16 weeks = 2,400 calls | 2,400 × ~$0.0005 ≈ **$1.20 total** |
| Custom domain (optional) | 1 domain year | Free if already in your CF account, else $8–12/yr |

Realistically, the whole semester costs about the price of a coffee.

---

## Pulling the plug

If you later decide the backend isn't worth it, or you're between
semesters:

```bash
cd backend
wrangler delete        # removes the Worker
```

The frontend `js/backend.js` probe will start failing (`/health`
unreachable), AI buttons will silently disable, instructor links will
fall back to unsigned. No other part of the app is affected. To
restore, redeploy with `wrangler deploy` — the secrets are tied to
the account, not the Worker, so they persist.
