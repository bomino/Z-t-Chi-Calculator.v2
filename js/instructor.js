/**
 * Instructor Mode.
 *
 * Instructor builds a problem spec in the builder UI. The spec encodes
 * the target calculator, prefilled inputs, prompt text, expected answer
 * and tolerance, and optional feedback. The encoded spec becomes a URL
 * query param (`?problem=<base64>`) the instructor shares.
 *
 * Integrity: if the backend is reachable, /sign returns an HMAC that
 * travels alongside the payload. Students' clients POST the pair to
 * /verify-ish logic inline in the student helper by re-signing locally
 * — but we don't have the secret client-side, so verification is:
 *   - If backend is up: POST {payload, sig} to /sign with same payload,
 *     expect the returned sig to match. If so, badge "verified".
 *   - If backend is down: show "unsigned" badge. The app still works.
 *
 * Spec shape:
 *   {
 *     v: 1,                       // schema version
 *     title: "Problem 3 — One-sample t",
 *     prompt: "Compute the two-tailed p-value...",
 *     calc: "t" | "z" | "chi" | "corrections" | "epi",
 *     inputs: { ... },            // calculator-specific prefill
 *     answer: {
 *       field: "pValue" | "statistic" | "chiSquare" | "oddsRatio" | ...,
 *       value: number,
 *       tolerance: number,        // absolute, e.g. 0.001
 *     },
 *     feedback: { correct: "...", incorrect: "..." },
 *     issuedAt: 1700000000000,
 *   }
 */
(function () {
    'use strict';

    const ZtChi = window.ZtChi || (window.ZtChi = {});
    const SCHEMA_VERSION = 1;

    function b64urlEncode(str) {
        return btoa(unescape(encodeURIComponent(str)))
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
    function b64urlDecode(str) {
        const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
        return decodeURIComponent(escape(atob(padded)));
    }

    function encodeSpec(spec) {
        const full = { v: SCHEMA_VERSION, issuedAt: Date.now(), ...spec };
        return b64urlEncode(JSON.stringify(full));
    }
    function decodeSpec(token) {
        if (!token) return null;
        try {
            const obj = JSON.parse(b64urlDecode(token));
            if (!obj || obj.v !== SCHEMA_VERSION) return null;
            return obj;
        } catch (_) {
            return null;
        }
    }

    /**
     * Origin of the student site as seen from the instructor builder.
     * When the builder is served from the teach subdomain (production)
     * this needs to cross-origin-point at the student subdomain; the
     * target student pages don't exist on teach and are 404'd by the
     * middleware even if they did. On localhost / same-origin dev the
     * builder and student calculators share one origin, so use that.
     */
    function studentSiteOrigin() {
        const host = window.location.hostname;
        if (host === 'teach.hgaladima.com') return 'https://ztchi.hgaladima.com';
        return window.location.origin;
    }

    function buildLink(token, sig) {
        const origin = studentSiteOrigin();
        const u = new URL('/', origin);
        const calc = decodeSpec(token).calc;
        const page = calcToPage(calc);
        u.pathname = '/' + page;
        u.searchParams.set('problem', token);
        if (sig) u.searchParams.set('sig', sig);
        return u.toString();
    }

    function calcToPage(calc) {
        return ({
            z: 'z_calculator.html',
            t: 't_calculator.html',
            chi: 'chi_square.html',
            corrections: 'corrections.html',
            epi: 'epidemiology.html',
        })[calc] || 'index.html';
    }

    function answerFieldsFor(calc) {
        return ({
            z: [
                { key: 'zScore', label: 'Z-score' },
                { key: 'pValue', label: 'One-tailed p-value' },
                { key: 'twoTailed', label: 'Two-tailed p-value' },
            ],
            t: [
                { key: 't', label: 't-statistic' },
                { key: 'df', label: 'Degrees of freedom' },
                { key: 'pValue', label: 'Two-tailed p-value' },
            ],
            chi: [
                { key: 'chiSquare', label: 'Chi-square statistic' },
                { key: 'df', label: 'Degrees of freedom' },
                { key: 'pValue', label: 'p-value' },
                { key: 'cramersV', label: "Cramer's V" },
            ],
            corrections: [
                { key: 'bonfSurvive', label: '# significant under Bonferroni' },
                { key: 'holmSurvive', label: '# significant under Holm' },
                { key: 'bhSurvive', label: '# significant under BH' },
            ],
            epi: [
                { key: 'relativeRisk', label: 'Relative risk' },
                { key: 'oddsRatio', label: 'Odds ratio' },
                { key: 'sensitivity', label: 'Sensitivity' },
                { key: 'specificity', label: 'Specificity' },
            ],
        })[calc] || [];
    }

    const TOKEN_KEY = 'ZtChi.instructorToken';

    function getToken() {
        try {
            return localStorage.getItem(TOKEN_KEY) || '';
        } catch (_) {
            return '';
        }
    }

    function setToken(token) {
        try {
            if (token) localStorage.setItem(TOKEN_KEY, token);
            else localStorage.removeItem(TOKEN_KEY);
        } catch (_) { /* no-op */ }
    }

    async function sign(spec) {
        if (!ZtChi.backend || !ZtChi.backend.url) return null;
        try {
            const { enabled } = await ZtChi.backend.ready;
            if (!enabled) return null;
            const token = getToken();
            const res = await ZtChi.backend.post('/sign', { payload: spec }, { bearerToken: token });
            return { payload: res.payload, sig: res.sig };
        } catch (err) {
            // Surface 401/403 so the UI can clear the token and re-prompt.
            if (err && (err.status === 401 || err.status === 403)) {
                const e = new Error(err.data && err.data.error || 'unauthorized');
                e.status = err.status;
                throw e;
            }
            return null;
        }
    }

    // Student-side: is the current URL carrying a problem token?
    function readFromUrl() {
        try {
            const params = new URLSearchParams(window.location.search);
            const token = params.get('problem');
            const sig = params.get('sig');
            if (!token) return null;
            const spec = decodeSpec(token);
            if (!spec) return null;
            return { spec, token, sig };
        } catch (_) {
            return null;
        }
    }

    function withinTolerance(actual, expected, tol) {
        if (!Number.isFinite(actual) || !Number.isFinite(expected)) return false;
        return Math.abs(actual - expected) <= Math.abs(tol || 0);
    }

    function checkAnswer(spec, studentValue) {
        const expected = Number(spec.answer && spec.answer.value);
        const tol = Number(spec.answer && spec.answer.tolerance) || 0;
        return withinTolerance(Number(studentValue), expected, tol);
    }

    ZtChi.instructor = {
        SCHEMA_VERSION,
        encodeSpec,
        decodeSpec,
        buildLink,
        calcToPage,
        answerFieldsFor,
        sign,
        readFromUrl,
        checkAnswer,
        getToken,
        setToken,
    };
})();
