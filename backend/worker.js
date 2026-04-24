/**
 * Z-t-Chi Calculator backend (Cloudflare Worker).
 *
 * Endpoints:
 *   GET  /health         — liveness probe (CORS-enabled)
 *   POST /sign           — HMAC-sign an instructor problem payload
 *   POST /ai             — proxy a sanitized interpretation request to Anthropic
 *
 * The main app (GitHub Pages static site) treats this Worker as an optional
 * enhancement. If the Worker is unreachable the frontend degrades gracefully.
 *
 * Secrets (set via `wrangler secret put`):
 *   SIGN_SECRET         — HMAC-SHA256 secret used for /sign
 *   ANTHROPIC_API_KEY   — Anthropic API key for /ai
 *
 * Vars (set in wrangler.toml):
 *   ALLOWED_ORIGINS       — comma-separated CORS allowlist
 *   RATE_LIMIT_PER_HOUR   — integer, per-IP calls to /ai per rolling hour
 *   AI_MODEL              — Anthropic model ID
 */

const AI_SYSTEM_PROMPT = [
  'You are a biostatistics tutor explaining the result of a statistical test to a student.',
  'The user will send you structured numeric values (test name, observed statistic, p-value, degrees of freedom, confidence interval, effect size). No free text will be included.',
  '',
  'Write a concise (90-140 word) plain-English interpretation. Structure:',
  '1. Restate what was tested in one sentence.',
  '2. State the decision at alpha = 0.05 and whether the null is retained or rejected.',
  '3. Note the effect size and what it practically means — BUT ONLY if an effect-size field was provided (cramersV, phi, oddsRatio, relativeRisk, effectSize, sensitivity, specificity, or an explicit CI width). If no effect-size field was provided, say so explicitly: "No effect size was reported in this context." Do not infer effect magnitude from the test statistic.',
  '4. One caveat about what the result does NOT say (e.g., p-value is not the probability the null is true; non-significance is not proof of no effect).',
  '',
  'CRITICAL: Never interpret the magnitude of a test statistic (z, t, chi-square) as the magnitude of an effect. The test statistic scales with sample size and precision; a large z can come from a tiny effect in a very large sample, and a small z can come from a large effect in a small sample. A statement like "z = 4.5 indicates a practically meaningful difference" is wrong. Describe a statistic as "unusual under the null" or "far from zero" — never as "large" or "substantial" in effect-size terms.',
  '',
  'End with the exact formula you are interpreting, written in plain-text form. Do not invent values that were not provided.',
  'Never include the student\'s raw data back to them; you have not seen it. Do not give advice about actions outside the scope of the calculation.',
].join('\n');

const IP_CACHE = new Map();

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const allowed = corsAllowed(origin, env);

    if (request.method === 'OPTIONS') {
      return corsPreflight(origin, allowed);
    }

    if (url.pathname === '/health') {
      return withCors(
        json({ ok: true, ts: Date.now() }),
        origin,
        allowed,
      );
    }

    if (!allowed) {
      return withCors(json({ error: 'origin not allowed' }, 403), origin, false);
    }

    try {
      if (url.pathname === '/sign' && request.method === 'POST') {
        return withCors(await handleSign(request, env), origin, allowed);
      }
      if (url.pathname === '/ai' && request.method === 'POST') {
        return withCors(await handleAi(request, env), origin, allowed);
      }
      if (url.pathname === '/verify' && request.method === 'POST') {
        return withCors(await handleVerify(request, env), origin, allowed);
      }
    } catch (err) {
      return withCors(
        json({ error: 'internal', message: String(err && err.message || err) }, 500),
        origin,
        allowed,
      );
    }

    return withCors(json({ error: 'not found' }, 404), origin, allowed);
  },
};

async function handleSign(request, env) {
  if (!env.SIGN_SECRET) return json({ error: 'signing not configured' }, 503);

  // Optional instructor-token gate. If INSTRUCTOR_TOKENS secret is set, the
  // request must carry `Authorization: Bearer <token>` where the token matches
  // one entry in the (comma-or-newline-separated) list. If the secret is NOT
  // set, anyone who passes the CORS allowlist can sign — useful for single-
  // instructor deployments that trust their origin.
  if (env.INSTRUCTOR_TOKENS) {
    const auth = request.headers.get('Authorization') || '';
    const match = /^Bearer\s+(.+)$/i.exec(auth);
    const presented = match ? match[1].trim() : '';
    const allowed = env.INSTRUCTOR_TOKENS
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!presented || !allowed.includes(presented)) {
      return json({ error: 'instructor token required' }, 401);
    }
  }

  const body = await request.json();
  if (!body || typeof body.payload !== 'object') {
    return json({ error: 'payload required' }, 400);
  }
  const payloadStr = JSON.stringify(body.payload);
  const sig = await hmacSha256(env.SIGN_SECRET, payloadStr);
  return json({
    payload: b64urlEncode(payloadStr),
    sig: b64urlBytes(sig),
    alg: 'HS256',
  });
}

/**
 * Verify an HMAC signature for a previously-signed problem payload.
 *
 * Called by students' browsers when they open a signed instructor link —
 * problem-overlay.js decodes the URL's payload, sends it here with the
 * URL's `sig`, and shows a VERIFIED / signature-mismatch badge.
 *
 * Deliberately NOT gated by INSTRUCTOR_TOKENS. Students don't have the
 * instructor token and shouldn't need it to verify. Security is unaffected:
 *   - The HMAC secret stays on the Worker.
 *   - /verify only returns a boolean; no signature material leaks.
 *   - Same CORS allowlist and rate limiting apply as the rest of the API.
 */
async function handleVerify(request, env) {
  if (!env.SIGN_SECRET) return json({ error: 'signing not configured' }, 503);
  const body = await request.json();
  if (!body || typeof body.payload !== 'object' || typeof body.sig !== 'string') {
    return json({ error: 'payload and sig required' }, 400);
  }
  const payloadStr = JSON.stringify(body.payload);
  const computed = await hmacSha256(env.SIGN_SECRET, payloadStr);
  const expected = b64urlBytes(computed);
  return json({
    valid: timingSafeEqual(expected, body.sig),
    alg: 'HS256',
  });
}

/**
 * Constant-time string comparison. HMAC verification should not leak
 * timing information about where the first mismatch occurred.
 */
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function handleAi(request, env) {
  if (!env.ANTHROPIC_API_KEY) return json({ error: 'AI not configured' }, 503);
  const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
  const limit = Number(env.RATE_LIMIT_PER_HOUR || '60');
  if (!checkRate(clientIp, limit)) {
    return json({ error: 'rate limit exceeded' }, 429);
  }

  const ctx = await request.json();
  const sanitized = sanitizeContext(ctx);
  if (!sanitized) return json({ error: 'invalid context' }, 400);

  const userMessage = formatContextForModel(sanitized);

  const apiResp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: env.AI_MODEL || 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: AI_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!apiResp.ok) {
    const text = await apiResp.text();
    return json({ error: 'upstream', status: apiResp.status, detail: text.slice(0, 500) }, 502);
  }
  const data = await apiResp.json();
  const text = (data.content && data.content[0] && data.content[0].text) || '';
  return json({
    text,
    model: data.model,
    usage: data.usage,
    note: 'AI-generated interpretation. Verify against the Show-Work panel.',
  });
}

const ALLOWED_KEYS = new Set([
  'test', 'statistic', 'df', 'pValue', 'twoTailed',
  'mean', 'sd', 'n', 'n1', 'n2',
  'chiSquare', 'cramersV', 'phi',
  'relativeRisk', 'oddsRatio', 'sensitivity', 'specificity',
  'confLow', 'confHigh', 'alpha', 'effectSize',
  'method', 'tails', 'groupLabels',
]);

function sanitizeContext(ctx) {
  if (!ctx || typeof ctx !== 'object') return null;
  const out = {};
  for (const [k, v] of Object.entries(ctx)) {
    if (!ALLOWED_KEYS.has(k)) continue;
    if (typeof v === 'number' && Number.isFinite(v)) {
      out[k] = v;
    } else if (typeof v === 'string' && v.length <= 64 && /^[A-Za-z0-9 _.,\-()^]+$/.test(v)) {
      out[k] = v;
    } else if (Array.isArray(v) && v.length <= 4 && v.every((x) => typeof x === 'string' && x.length <= 32)) {
      out[k] = v.slice();
    }
  }
  if (!out.test) return null;
  return out;
}

function formatContextForModel(ctx) {
  const lines = [
    'Test context (all values are numeric or short identifiers, no free text from the user):',
  ];
  for (const [k, v] of Object.entries(ctx)) {
    lines.push(`  ${k}: ${JSON.stringify(v)}`);
  }
  return lines.join('\n');
}

function checkRate(ip, limit) {
  const now = Date.now();
  const windowStart = now - 3600000;
  const bucket = IP_CACHE.get(ip) || [];
  const pruned = bucket.filter((t) => t > windowStart);
  if (pruned.length >= limit) {
    IP_CACHE.set(ip, pruned);
    return false;
  }
  pruned.push(now);
  IP_CACHE.set(ip, pruned);
  return true;
}

function corsAllowed(origin, env) {
  if (!origin) return false;
  const list = String(env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list.includes(origin);
}

function corsPreflight(origin, allowed) {
  const headers = new Headers();
  if (allowed) headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'content-type, authorization');
  headers.set('Access-Control-Max-Age', '86400');
  return new Response(null, { status: 204, headers });
}

function withCors(response, origin, allowed) {
  const headers = new Headers(response.headers);
  if (allowed) headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Vary', 'Origin');
  return new Response(response.body, { status: response.status, headers });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

async function hmacSha256(secret, payload) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return crypto.subtle.sign('HMAC', key, encoder.encode(payload));
}

function b64urlEncode(str) {
  const bytes = new TextEncoder().encode(str);
  return b64urlBytes(bytes);
}

function b64urlBytes(bytes) {
  const bin = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
