# Z-t-Chi Calculator — Optional Backend

The main app at the repo root runs as a pure static site on GitHub Pages
and never requires this backend. Two *optional enhancements* call into
Cloudflare Workers defined here:

1. **`/sign`** — HMAC-signs an instructor-authored problem spec so the
   student's client can verify it hasn't been tampered with.
2. **`/ai`** — proxies requests to the Anthropic Claude API for the
   opt-in AI Interpretation feature. The API key lives only in the
   Worker's secret environment; it never reaches the client.

Both endpoints live in a single Worker (`worker.js`) behind a path
router so you only need one deployment.

**For full step-by-step deployment instructions see [`DEPLOY.md`](./DEPLOY.md)** — that file covers
prerequisites, CLI install, secret generation, origin allowlist,
deployment, browser verification, monitoring, rotation, custom
domains, cost estimates, and troubleshooting. The section below is a
quick reference only.

## Deploy (quick reference)

You need a Cloudflare account (free tier is fine) and `wrangler` CLI.

```bash
cd backend
npm install -g wrangler   # if not already installed
wrangler login

# set the HMAC secret used for signing instructor problems
wrangler secret put SIGN_SECRET
# paste any strong random string (e.g., `openssl rand -base64 48`)

# set the Anthropic API key for AI interpretation
wrangler secret put ANTHROPIC_API_KEY
# paste your sk-ant-... key

# deploy
wrangler deploy
```

The CLI prints the deployed URL, e.g.
`https://ztchi-backend.<your-subdomain>.workers.dev`.

## Point the frontend at it

Edit `js/backend.js` in the repo root and set the `BACKEND_URL`
constant to the Worker URL (or leave it empty and set
`window.ZTCHI_BACKEND_URL` via a small inline script in the HTML if
you prefer per-deployment configuration).

When the frontend boots it probes `${BACKEND_URL}/health`. If the
probe succeeds:

- the Instructor Mode page offers a **Sign** button that produces a
  tamper-evident link;
- the calculator pages show an **Explain (AI)** button next to each
  result.

If the probe fails (no backend configured, Worker unreachable, quota
exhausted), both features degrade silently:

- Instructor Mode still produces an unsigned permalink (with an
  "unsigned — integrity not verified" badge).
- The AI button is hidden.

The rest of the app is untouched.

## Costs

- Cloudflare Workers free tier: 100k requests/day.
- Anthropic API: billed per token. A typical interpretation is
  ~500 input + ~300 output tokens at Claude Haiku ≈ $0.0005/call.
  For a class of 50 students each clicking 3× per week,
  ~150 calls/week ≈ $0.30/month.

## Security notes

- Do not commit `SIGN_SECRET` or `ANTHROPIC_API_KEY` to git. They
  live only as Worker secrets.
- `SIGN_SECRET` rotation: generate a new secret, re-run
  `wrangler secret put SIGN_SECRET`, and note that problems signed
  with the old secret will now show "signature mismatch" to students.
- The AI endpoint rate-limits per IP to protect against abuse.
  See `RATE_LIMIT_PER_HOUR` in `worker.js`.
- Prompt injection: the AI endpoint sends only structured numeric
  test context to Claude — no free-text from the student — so the
  attack surface is minimal.
