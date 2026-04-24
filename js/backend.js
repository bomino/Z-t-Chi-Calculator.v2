/**
 * Backend feature-detection.
 *
 * The main app works as pure static site. Two optional enhancements
 * (Instructor Mode signing + AI interpreter) call into a Cloudflare
 * Worker defined under backend/. This module probes the Worker once on
 * load and exposes flags downstream code can read.
 *
 * Configuration (in order of priority):
 *   1. window.ZTCHI_BACKEND_URL set via inline script in HTML
 *   2. localStorage 'ZtChi.backendUrl' (useful for per-browser overrides)
 *   3. BACKEND_URL constant below (hardcoded for the production deploy)
 *
 * Usage:
 *   ZtChi.backend.ready.then(({ enabled }) => {
 *     if (enabled) showFancyButton();
 *   });
 *   ZtChi.backend.post('/ai', ctx).then(...).catch(...);
 */
(function () {
    'use strict';

    const ZtChi = window.ZtChi || (window.ZtChi = {});

    const BACKEND_URL = 'https://ztchi-backend.malawali.workers.dev';

    function resolveUrl() {
        if (typeof window.ZTCHI_BACKEND_URL === 'string' && window.ZTCHI_BACKEND_URL) {
            return window.ZTCHI_BACKEND_URL.replace(/\/+$/, '');
        }
        try {
            const stored = localStorage.getItem('ZtChi.backendUrl');
            if (stored) return stored.replace(/\/+$/, '');
        } catch (_) { /* no-op */ }
        return BACKEND_URL.replace(/\/+$/, '');
    }

    const url = resolveUrl();

    async function probe() {
        if (!url) return { enabled: false, reason: 'no-url' };
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            const res = await fetch(`${url}/health`, { signal: controller.signal, mode: 'cors' });
            clearTimeout(timeoutId);
            if (!res.ok) return { enabled: false, reason: `status-${res.status}` };
            const body = await res.json();
            return { enabled: !!body.ok, reason: 'ok', url };
        } catch (err) {
            return { enabled: false, reason: 'unreachable', error: String(err && err.message || err) };
        }
    }

    async function post(path, body, options = {}) {
        if (!url) throw new Error('backend not configured');
        const headers = { 'content-type': 'application/json' };
        if (options.bearerToken) {
            headers['authorization'] = `Bearer ${options.bearerToken}`;
        }
        const res = await fetch(`${url}${path}`, {
            method: 'POST',
            mode: 'cors',
            headers,
            body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const err = new Error(data.error || `backend error ${res.status}`);
            err.status = res.status;
            err.data = data;
            throw err;
        }
        return data;
    }

    const ready = probe();

    ZtChi.backend = {
        url,
        ready,
        post,
        configure(newUrl) {
            try {
                if (newUrl) localStorage.setItem('ZtChi.backendUrl', newUrl);
                else localStorage.removeItem('ZtChi.backendUrl');
            } catch (_) { /* no-op */ }
        },
    };
})();
