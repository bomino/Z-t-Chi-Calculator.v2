/**
 * Pages Function middleware. Runs before every request on both CF Pages
 * projects (ztchi-calculator at ztchi.hgaladima.com and ztchi-teach at
 * teach.hgaladima.com).
 *
 * Three jobs:
 *   1. Block repo-internal paths that shouldn't be web-served (the
 *      backend/ directory, docs/, git metadata, etc.).
 *   2. Enforce the host-based split between student and instructor
 *      subdomains. On teach.hgaladima.com we rewrite / to /instructor.html
 *      and 404 the student calculator pages; on ztchi.hgaladima.com we
 *      404 the instructor builder and its JS glue.
 *   3. Inject `X-Robots-Tag: noindex, nofollow, noarchive` on every
 *      teach-host response — the strongest signal to Google that this
 *      subdomain should never be indexed. Complements the host-aware
 *      robots.txt and the meta robots on instructor.html.
 *
 * Wrapped in try/catch so a bug in the middleware never brings the whole
 * site down — on error we pass through to static asset serving.
 */
export async function onRequest(context) {
    try {
        return await handle(context);
    } catch (err) {
        console.error('middleware error', err);
        return context.next();
    }
}

async function handle(context) {
    const { next } = context;
    const url = new URL(context.request.url);
    const pathname = url.pathname;
    const host = url.hostname;

    const asHtml = pathname.endsWith('.html') || pathname === '/'
        ? pathname
        : pathname + '.html';

    // 1. Block repo-internal paths on any host.
    if (/^\/(backend|docs|\.github|\.git|\.vscode|\.wrangler)\//.test(pathname)) {
        return withTeachNoindex(host, notFound());
    }

    // 2. Host-based split. Only fires on the production custom domains;
    //    on *.pages.dev (preview/default) we pass everything through.
    if (host === 'teach.hgaladima.com') {
        if (pathname === '/' || pathname === '/index.html') {
            const rewritten = new URL('/instructor.html', url);
            const response = await next(new Request(rewritten, context.request));
            return withTeachNoindex(host, response);
        }
        if (STUDENT_ONLY_PATHS.has(asHtml)) {
            return withTeachNoindex(host, notFound());
        }
    } else if (host === 'ztchi.hgaladima.com') {
        if (asHtml === '/instructor.html' || pathname === '/js/instructor-builder.js') {
            return notFound();
        }
    }

    const response = await next();
    return withTeachNoindex(host, response);
}

const STUDENT_ONLY_PATHS = new Set([
    '/z_calculator.html',
    '/t_calculator.html',
    '/chi_square.html',
    '/compare.html',
    '/corrections.html',
    '/epidemiology.html',
    '/simulate.html',
    '/assumption.html',
    '/datasets.html',
    '/guide.html',
    '/notation.html',
    '/error-traps.html',
    '/tests.html',
]);

/**
 * On the teach subdomain, stamp every outgoing response with a
 * noindex directive. Safe no-op on other hosts. Preserves the original
 * response status, body, and any other headers.
 */
function withTeachNoindex(host, response) {
    if (host !== 'teach.hgaladima.com') return response;
    const headers = new Headers(response.headers);
    headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
    });
}

// Minimal self-contained 404 — avoids fetching /404.html back through the
// edge, which was the hanging path that produced 522 in the first deploy.
function notFound() {
    const body = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Not found</title>
<meta name="robots" content="noindex">
<style>body{font-family:system-ui,sans-serif;max-width:560px;margin:60px auto;padding:0 20px;text-align:center;color:#333}h1{font-size:3em;margin:0;color:#1976d2}p{color:#666}a{color:#1976d2}</style>
</head>
<body>
<h1>404</h1>
<p>This page is not on this site.</p>
<p><a href="/">Return home</a></p>
</body>
</html>`;
    return new Response(body, {
        status: 404,
        headers: { 'content-type': 'text/html; charset=utf-8' },
    });
}
