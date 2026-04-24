/**
 * Host-aware robots.txt.
 *
 * On teach.hgaladima.com (instructor builder, admin-only) we serve a
 * Disallow:/ body so search engines know not to index anything there.
 * On ztchi.hgaladima.com (student calculator) we serve the normal
 * Allow + sitemap-pointer body.
 *
 * This sits alongside the X-Robots-Tag header injected by _middleware.js
 * and the <meta name="robots" content="noindex"> on instructor.html —
 * three layers of "do not index this subdomain" for defense-in-depth.
 *
 * Note: serving a Pages Function for robots.txt means there must NOT be
 * a static `robots.txt` file at the repo root. CF Pages serves static
 * files in preference to Functions for exact-path matches, which would
 * bypass this logic entirely.
 */
export async function onRequest(context) {
    const url = new URL(context.request.url);
    const host = url.hostname;

    let body;
    if (host === 'teach.hgaladima.com') {
        body = 'User-agent: *\nDisallow: /\n';
    } else {
        body = [
            'User-agent: *',
            'Allow: /',
            '',
            'Sitemap: https://ztchi.hgaladima.com/sitemap.xml',
            '',
        ].join('\n');
    }

    return new Response(body, {
        status: 200,
        headers: {
            'content-type': 'text/plain; charset=utf-8',
            'cache-control': 'public, max-age=3600',
        },
    });
}
