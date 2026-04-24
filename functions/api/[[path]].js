/**
 * Pages Function: proxy /api/* to the ztchi-backend Worker via a service
 * binding. Configured in each CF Pages project's Settings → Functions →
 * Service bindings → BACKEND → ztchi-backend.
 *
 * The browser calls /api/health, /api/sign, /api/ai on the same origin
 * as the frontend (ztchi.hgaladima.com or teach.hgaladima.com). This
 * file receives those requests, strips the '/api' prefix, and hands the
 * request to the Worker intra-datacenter via the service binding — no
 * cross-origin hop, no CORS preflight from the browser's perspective.
 *
 * Everything else about the Worker (auth, rate limiting, Claude proxy,
 * HMAC signing) stays in backend/worker.js untouched.
 */
export async function onRequest(context) {
    const { request, env } = context;

    if (!env.BACKEND) {
        return new Response(
            JSON.stringify({
                error: 'backend service binding missing',
                hint: 'Add the BACKEND service binding in the CF Pages project Settings → Functions.',
            }),
            { status: 503, headers: { 'content-type': 'application/json; charset=utf-8' } }
        );
    }

    const url = new URL(request.url);
    // Strip the '/api' prefix only when it is a full path segment.
    //   '/api/health'  → '/health'
    //   '/api'         → '/'
    //   '/apihealth'   → '/apihealth' (unchanged; Worker will 404 it)
    const newPath = url.pathname.replace(/^\/api(?=\/|$)/, '') || '/';
    const proxiedUrl = new URL(newPath + url.search, url.origin);
    const proxiedRequest = new Request(proxiedUrl, request);

    return env.BACKEND.fetch(proxiedRequest);
}
