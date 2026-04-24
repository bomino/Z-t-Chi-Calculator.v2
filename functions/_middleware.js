/**
 * Pages Function middleware. Runs before every request on both CF Pages
 * projects (ztchi-calculator at ztchi.hgaladima.com and ztchi-teach at
 * teach.hgaladima.com).
 *
 * Two jobs:
 *   1. Block repo-internal paths that shouldn't be web-served (the
 *      backend/ directory, docs/, git metadata, etc.). CF Pages uploads
 *      everything in the repo as assets in the "Workers + static assets"
 *      deploy model; middleware 404s them at request time.
 *   2. Enforce the host-based split between student and instructor
 *      subdomains. On teach.hgaladima.com we rewrite / to /instructor.html
 *      and 404 the student calculator pages; on ztchi.hgaladima.com we
 *      404 the instructor builder and its JS glue.
 *
 * Host-based rules live here (not in _redirects) because _redirects
 * doesn't support absolute-URL source patterns or 404 status codes.
 */
export async function onRequest(context) {
    const { request, next } = context;
    const url = new URL(request.url);
    const pathname = url.pathname;
    const host = url.hostname;

    // 1. Block repo-internal paths on any host.
    // Any request under these prefixes gets a 404 regardless of hostname.
    if (/^\/(backend|docs|\.github|\.git|\.vscode|\.wrangler)\//.test(pathname)) {
        return render404(url);
    }

    // 2. Host-based split.
    if (host === 'teach.hgaladima.com') {
        // Root of the instructor subdomain serves the builder directly.
        if (pathname === '/' || pathname === '/index.html') {
            return next('/instructor.html');
        }
        // Student calculators are not served under the instructor domain.
        if (STUDENT_ONLY_PATHS.has(pathname)) {
            return render404(url);
        }
    } else if (host === 'ztchi.hgaladima.com') {
        // Instructor builder and its glue are not served under the student domain.
        if (pathname === '/instructor.html' || pathname === '/js/instructor-builder.js') {
            return render404(url);
        }
    }

    // Everything else falls through to the normal pipeline:
    // /api/* goes to functions/api/[[path]].js; other paths are served
    // as static assets.
    return next();
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

async function render404(url) {
    try {
        const res = await fetch(new URL('/404.html', url));
        const body = await res.text();
        return new Response(body, {
            status: 404,
            headers: { 'content-type': 'text/html; charset=utf-8' },
        });
    } catch (_) {
        return new Response('Not found', { status: 404 });
    }
}
