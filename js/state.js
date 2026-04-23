/**
 * URL-hash state codec + sessionStorage ring buffer for recent test results.
 *
 * URL format: #s=<base64url(JSON)>
 * Session buffer key: ZtChi.recentResults
 *
 * Client code uses ZtChi.state.encode / decode to share permalinks, and
 * ZtChi.state.recordResult / readRecent for the Compare-Tests feature (Phase 2).
 */
(function () {
    'use strict';

    const ZtChi = window.ZtChi || (window.ZtChi = {});
    const RING_KEY = 'ZtChi.recentResults';
    const RING_MAX = 20;

    function b64urlEncode(str) {
        return btoa(unescape(encodeURIComponent(str)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    }

    function b64urlDecode(str) {
        const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
        return decodeURIComponent(escape(atob(padded)));
    }

    function encode(obj) {
        return b64urlEncode(JSON.stringify(obj));
    }

    function decode(hash) {
        if (!hash) return null;
        const clean = hash.replace(/^#/, '').replace(/^s=/, '');
        if (!clean) return null;
        try {
            return JSON.parse(b64urlDecode(clean));
        } catch (_) {
            return null;
        }
    }

    function readFromUrl() {
        return decode(window.location.hash);
    }

    function writeToUrl(obj, { replace = true } = {}) {
        const encoded = `#s=${encode(obj)}`;
        if (replace && window.history.replaceState) {
            window.history.replaceState(null, '', window.location.pathname + window.location.search + encoded);
        } else {
            window.location.hash = encoded;
        }
    }

    function permalink(obj) {
        const url = new URL(window.location.href);
        url.hash = `s=${encode(obj)}`;
        return url.toString();
    }

    function copyPermalink(obj) {
        const link = permalink(obj);
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(link).then(() => link);
        }
        return Promise.resolve(link);
    }

    function recordResult(entry) {
        try {
            const existing = readRecent();
            const next = [{ timestamp: Date.now(), ...entry }, ...existing].slice(0, RING_MAX);
            sessionStorage.setItem(RING_KEY, JSON.stringify(next));
        } catch (_) {
            // sessionStorage may be disabled; recent-results feature becomes a no-op
        }
    }

    function readRecent() {
        try {
            const raw = sessionStorage.getItem(RING_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (_) {
            return [];
        }
    }

    function clearRecent() {
        try { sessionStorage.removeItem(RING_KEY); } catch (_) { /* noop */ }
    }

    ZtChi.state = {
        encode,
        decode,
        readFromUrl,
        writeToUrl,
        permalink,
        copyPermalink,
        recordResult,
        readRecent,
        clearRecent,
    };
})();
