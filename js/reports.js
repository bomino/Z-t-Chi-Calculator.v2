/**
 * APA and AMA report generators for Z, t, and chi-square tests.
 * Exposes ZtChi.reports.apa.* / ZtChi.reports.ama.* and helpers to attach Copy-Report buttons.
 *
 * Usage:
 *   const text = ZtChi.reports.apa.chi({ chiSquare, df, pValue, n });
 *   ZtChi.reports.copy(text);
 */
(function () {
    'use strict';

    const ZtChi = window.ZtChi || (window.ZtChi = {});

    function fmt2(n) { return Number(n).toFixed(2); }

    // APA p-value: no leading zero, 3 decimal places, "< .001" for very small
    function pApa(p) {
        if (!Number.isFinite(p)) return String(p);
        if (p < 0.001) return '< .001';
        return p.toFixed(3).replace(/^0\./, '.');
    }

    // AMA uses "P" (uppercase) and preserves leading zero in some conventions; we use
    // AMA Manual of Style 11e: "P < .001" style, no leading zero, italic P.
    function pAma(p) {
        if (!Number.isFinite(p)) return String(p);
        if (p < 0.001) return 'P < .001';
        return `P = ${p.toFixed(3).replace(/^0\./, '.')}`;
    }

    function narrate(p, alpha) {
        if (!Number.isFinite(p) || !Number.isFinite(alpha)) return '';
        return p < alpha
            ? 'The result reached statistical significance at the chosen level.'
            : 'The result did not reach statistical significance at the chosen level.';
    }

    function dofWord(df) { return df === 1 ? 'degree of freedom' : 'degrees of freedom'; }

    const apa = {
        /**
         * The Z calculator is a probability/tail-area lookup, not a hypothesis test.
         * This reports the computed probabilities without claiming a hypothesis test.
         * ctx: { z, probability, twoTail }
         */
        z(ctx) {
            const z = fmt2(ctx.z);
            const leftP = pApa(ctx.probability);
            const rightP = pApa(1 - ctx.probability);
            const twoP = pApa(ctx.twoTail);
            return `For z = ${z} on the standard normal distribution: left-tail P(Z ≤ ${z}) = ${leftP}, right-tail P(Z > ${z}) = ${rightP}, and two-tailed tail area P(|Z| > |${z}|) = ${twoP}. These are tabled probabilities; interpret in the context of whatever hypothesis (if any) motivated the lookup.`;
        },
        /**
         * ctx: { t, df, twoTailP, alpha }
         */
        t(ctx) {
            const t = fmt2(ctx.t);
            const p = pApa(ctx.twoTailP);
            const summary = `A one-sample t test was performed, t(${ctx.df}) = ${t}, p = ${p}, two-tailed.`;
            return summary + ' ' + narrate(ctx.twoTailP, ctx.alpha);
        },
        /**
         * ctx: { chiSquare, df, n, pValue, alpha, cramersV?, cramersLabel? }
         */
        chi(ctx) {
            const chi = fmt2(ctx.chiSquare);
            const p = pApa(ctx.pValue);
            let summary = `A chi-square test of independence was performed, χ²(${ctx.df}, N = ${ctx.n}) = ${chi}, p = ${p}`;
            if (Number.isFinite(ctx.cramersV)) {
                const v = ctx.cramersV.toFixed(2).replace(/^0\./, '.');
                const band = ctx.cramersLabel ? ` (${ctx.cramersLabel})` : '';
                summary += `, Cramer's V = ${v}${band}`;
            }
            summary += '.';
            return summary + ' ' + narrate(ctx.pValue, ctx.alpha);
        },
    };

    const ama = {
        z(ctx) {
            const z = fmt2(ctx.z);
            const leftP = pAma(ctx.probability);
            const rightP = pAma(1 - ctx.probability);
            const twoP = pAma(ctx.twoTail);
            return `Standard normal probabilities for z = ${z}: left-tail ${leftP}; right-tail ${rightP}; two-tailed tail area ${twoP}. (This is a probability lookup, not a hypothesis test result.)`;
        },
        t(ctx) {
            const t = fmt2(ctx.t);
            const p = pAma(ctx.twoTailP);
            const dfText = ctx.df != null ? ` with ${ctx.df} ${dofWord(ctx.df)}` : '';
            return `A one-sample t test was performed. The test statistic was t${dfText} = ${t}; ${p} (two-tailed).`;
        },
        chi(ctx) {
            const chi = fmt2(ctx.chiSquare);
            const p = pAma(ctx.pValue);
            let out = `A χ² test of independence was performed on N = ${ctx.n} observations with ${ctx.df} ${dofWord(ctx.df)}. The test statistic was χ² = ${chi}; ${p}.`;
            if (Number.isFinite(ctx.cramersV)) {
                const v = ctx.cramersV.toFixed(2).replace(/^0\./, '.');
                out += ` The association strength was Cramer V = ${v}${ctx.cramersLabel ? ` (${ctx.cramersLabel})` : ''}.`;
            }
            return out;
        },
    };

    function copy(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text).then(() => {
                if (ZtChi.showNotification) ZtChi.showNotification('Report copied to clipboard.', 'success');
                return true;
            }).catch(() => fallbackCopy(text));
        }
        return Promise.resolve(fallbackCopy(text));
    }

    function fallbackCopy(text) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.top = '-1000px';
        document.body.appendChild(ta);
        ta.select();
        let ok = false;
        try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
        document.body.removeChild(ta);
        if (ZtChi.showNotification) {
            ZtChi.showNotification(ok ? 'Report copied to clipboard.' : 'Could not copy — select and copy manually.', ok ? 'success' : 'warning');
        }
        return ok;
    }

    /**
     * Render a pair of Copy-Report buttons (APA + AMA) plus an optional inline preview.
     * @param {Function} getCtxFn - returns the context object at click time (so it reflects the latest result)
     * @param {string} testType - 'z' | 't' | 'chi'
     * @returns {string} HTML
     */
    function buildReportButtons(testType) {
        const slotId = `report-slot-${testType}-${Math.random().toString(36).slice(2, 8)}`;
        return `
            <div class="report-buttons no-print" data-report-slot="${slotId}">
                <button type="button" class="action-button" data-report-format="apa" data-report-test="${testType}">
                    <span class="button-icon">\u{1F4CB}</span> Copy APA
                </button>
                <button type="button" class="action-button" data-report-format="ama" data-report-test="${testType}">
                    <span class="button-icon">\u{1F4CB}</span> Copy AMA
                </button>
                <details class="report-preview">
                    <summary>Preview report text</summary>
                    <pre class="report-preview-text" data-report-preview="${testType}">(run a calculation first)</pre>
                </details>
            </div>
        `;
    }

    /**
     * Register the latest context for a test type. Buttons read this when clicked.
     */
    const _latest = {};
    function setLatestContext(testType, ctx) {
        _latest[testType] = ctx;
        document.querySelectorAll(`[data-report-preview="${testType}"]`).forEach((el) => {
            const apaText = apa[testType] ? apa[testType](ctx) : '';
            const amaText = ama[testType] ? ama[testType](ctx) : '';
            el.textContent = `APA:\n${apaText}\n\nAMA:\n${amaText}`;
        });
    }

    function getLatestContext(testType) {
        return _latest[testType] || null;
    }

    /**
     * Attach a single delegated click handler (idempotent) for all report buttons on the page.
     */
    let _delegated = false;
    function ensureDelegatedClickHandler() {
        if (_delegated) return;
        _delegated = true;
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-report-format]');
            if (!btn) return;
            const format = btn.getAttribute('data-report-format');
            const testType = btn.getAttribute('data-report-test');
            const ctx = getLatestContext(testType);
            if (!ctx) {
                if (ZtChi.showNotification) ZtChi.showNotification('Run a calculation first, then copy the report.', 'warning');
                return;
            }
            const gen = (format === 'apa' ? apa : ama)[testType];
            if (!gen) return;
            copy(gen(ctx));
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ensureDelegatedClickHandler);
    } else {
        ensureDelegatedClickHandler();
    }

    ZtChi.reports = {
        apa,
        ama,
        copy,
        buildReportButtons,
        setLatestContext,
        getLatestContext,
    };
})();
