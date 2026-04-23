/**
 * Compare Tests page — runs χ² (with and without Yates' correction),
 * Fisher's exact test, and the Z-test for two proportions on the same
 * 2×2 table. Pedagogical focus: when tests agree vs. diverge.
 *
 * References:
 *   - Pearson (1900) — the chi-square test
 *   - Yates (1934) — continuity correction for 2×2 tables
 *   - Fisher (1922), Fisher (1934) — exact test
 *   - Cochran (1954) — expected-count threshold; recommendation to use
 *     Fisher's for small samples
 */
(function () {
    'use strict';

    const { escapeHtml, parsePositiveInt, showNotification } = window.ZtChi;

    function readInputs() {
        const a = parsePositiveInt(document.getElementById('cmp-0-0').value, 'Row 1 / Col 1');
        const b = parsePositiveInt(document.getElementById('cmp-0-1').value, 'Row 1 / Col 2');
        const c = parsePositiveInt(document.getElementById('cmp-1-0').value, 'Row 2 / Col 1');
        const d = parsePositiveInt(document.getElementById('cmp-1-1').value, 'Row 2 / Col 2');
        const alpha = parseFloat(document.getElementById('cmp-alpha').value);
        if (!Number.isFinite(alpha) || alpha <= 0 || alpha >= 1) {
            throw new Error('Significance level must be strictly between 0 and 1.');
        }
        if ((a + b + c + d) === 0) {
            throw new Error('At least one cell must contain a non-zero count.');
        }
        return { a, b, c, d, alpha };
    }

    /**
     * Chi-square for 2×2 table with and without Yates' continuity correction.
     * Returns both values so the teaching panel can show when they matter.
     */
    function chi2TwoByTwo(a, b, c, d) {
        const n = a + b + c + d;
        const r1 = a + b, r2 = c + d;
        const c1 = a + c, c2 = b + d;

        // Expected frequencies
        const eA = (r1 * c1) / n;
        const eB = (r1 * c2) / n;
        const eC = (r2 * c1) / n;
        const eD = (r2 * c2) / n;
        const expected = [[eA, eB], [eC, eD]];
        const minExpected = Math.min(eA, eB, eC, eD);

        // Uncorrected χ²
        const chi2Raw =
            ((a - eA) ** 2) / eA +
            ((b - eB) ** 2) / eB +
            ((c - eC) ** 2) / eC +
            ((d - eD) ** 2) / eD;

        // Yates-corrected χ² (subtract 0.5 from |O − E| before squaring)
        const yatesTerm = (o, e) => {
            const diff = Math.max(0, Math.abs(o - e) - 0.5);
            return (diff * diff) / e;
        };
        const chi2Yates = yatesTerm(a, eA) + yatesTerm(b, eB) + yatesTerm(c, eC) + yatesTerm(d, eD);

        const pRaw = 1 - jStat.chisquare.cdf(chi2Raw, 1);
        const pYates = 1 - jStat.chisquare.cdf(chi2Yates, 1);

        return { chi2Raw, pRaw, chi2Yates, pYates, expected, minExpected };
    }

    function verdictClass(p, alpha) {
        return p < alpha ? 'verdict reject' : 'verdict fail';
    }

    function verdictText(p, alpha) {
        return p < alpha ? 'Reject H₀' : 'Fail to reject H₀';
    }

    function fmt(n, d = 4) {
        if (!Number.isFinite(n)) return '—';
        return n.toFixed(d);
    }

    function pFmt(p) {
        if (!Number.isFinite(p)) return '—';
        if (p < 0.0001) return '< .0001';
        return p.toFixed(4).replace(/^0\./, '.');
    }

    function renderResults(inputs) {
        const { a, b, c, d, alpha } = inputs;
        const n = a + b + c + d;
        const chi = chi2TwoByTwo(a, b, c, d);
        const fisher = window.ZtChi.fishersExact(a, b, c, d);
        const z = window.ZtChi.zTestTwoProportions(a, b, c, d);
        const v = window.ZtChi.effectSize.cramersV(chi.chi2Raw, n, 2, 2);
        const vLabel = window.ZtChi.effectSize.interpretCramersV(v, 1);

        const labels = {
            row0: escapeHtml(document.getElementById('row-label-0').value || 'Row 1'),
            row1: escapeHtml(document.getElementById('row-label-1').value || 'Row 2'),
            col0: escapeHtml(document.getElementById('col-label-0').value || 'Col 1'),
            col1: escapeHtml(document.getElementById('col-label-1').value || 'Col 2'),
        };

        // Comparison note — do the tests agree or diverge?
        const ps = [chi.pRaw, chi.pYates, fisher.pTwoTailed, z.pTwoTailed].filter(Number.isFinite);
        const maxP = Math.max(...ps);
        const minP = Math.min(...ps);
        const spread = maxP - minP;
        const divergenceNote = buildDivergenceNote({
            spread,
            minExpected: chi.minExpected,
            n,
            pRaw: chi.pRaw,
            pYates: chi.pYates,
            pFisher: fisher.pTwoTailed,
            alpha,
        });

        const html = `
            <div class="compare-grid">
                <div class="compare-summary">
                    <h3>Your Table</h3>
                    <table class="compact-results-table">
                        <thead>
                            <tr><th></th><th>${labels.col0}</th><th>${labels.col1}</th><th>Total</th></tr>
                        </thead>
                        <tbody>
                            <tr><td><strong>${labels.row0}</strong></td><td>${a}</td><td>${b}</td><td>${a + b}</td></tr>
                            <tr><td><strong>${labels.row1}</strong></td><td>${c}</td><td>${d}</td><td>${c + d}</td></tr>
                            <tr><td><strong>Total</strong></td><td>${a + c}</td><td>${b + d}</td><td><strong>${n}</strong></td></tr>
                        </tbody>
                    </table>
                    <p class="compare-meta">Minimum expected cell: <strong>${fmt(chi.minExpected, 2)}</strong> &middot; Effect size (Cramer's V): <strong>${fmt(v, 3)}</strong> <small>(${vLabel})</small></p>
                </div>

                <div class="compare-tests">
                    <div class="compare-card">
                        <h4>&chi;<sup>2</sup> (Pearson)</h4>
                        <p>&chi;<sup>2</sup>(1, N = ${n}) = <strong>${fmt(chi.chi2Raw, 3)}</strong>, p = <strong>${pFmt(chi.pRaw)}</strong></p>
                        <p class="${verdictClass(chi.pRaw, alpha)}">${verdictText(chi.pRaw, alpha)}</p>
                        <p class="compare-note">Large-sample approximation. Reliable when every expected cell is at least 5.</p>
                    </div>

                    <div class="compare-card">
                        <h4>&chi;<sup>2</sup> with Yates' correction</h4>
                        <p>&chi;<sup>2</sup><sub>Y</sub> = <strong>${fmt(chi.chi2Yates, 3)}</strong>, p = <strong>${pFmt(chi.pYates)}</strong></p>
                        <p class="${verdictClass(chi.pYates, alpha)}">${verdictText(chi.pYates, alpha)}</p>
                        <p class="compare-note">Continuity correction for discrete data (Yates, 1934). Conservative &mdash; moves p-value up, especially for small tables.</p>
                    </div>

                    <div class="compare-card">
                        <h4>Fisher's exact test</h4>
                        <p>p = <strong>${pFmt(fisher.pTwoTailed)}</strong> (two-tailed, method of small p-values)</p>
                        <p>Odds ratio = <strong>${fmt(fisher.oddsRatio, 3)}</strong></p>
                        <p class="${verdictClass(fisher.pTwoTailed, alpha)}">${verdictText(fisher.pTwoTailed, alpha)}</p>
                        <p class="compare-note">Exact probabilities from the hypergeometric distribution. The reference test for small or sparse tables.</p>
                    </div>

                    <div class="compare-card">
                        <h4>Z-test for two proportions</h4>
                        <p>p&#770;<sub>1</sub> = ${fmt(z.p1, 3)}, p&#770;<sub>2</sub> = ${fmt(z.p2, 3)}, difference = ${fmt(z.diff, 3)}</p>
                        <p>z = <strong>${fmt(z.z, 3)}</strong>, p = <strong>${pFmt(z.pTwoTailed)}</strong></p>
                        <p>95% CI for difference: [${fmt(z.ciLow, 3)}, ${fmt(z.ciHigh, 3)}]</p>
                        <p class="${verdictClass(z.pTwoTailed, alpha)}">${verdictText(z.pTwoTailed, alpha)}</p>
                        <p class="compare-note">Equivalent to &chi;<sup>2</sup>: z<sup>2</sup> = ${fmt(z.z * z.z, 3)} (should match &chi;<sup>2</sup> above exactly).</p>
                    </div>
                </div>

                <div class="compare-divergence">
                    ${divergenceNote}
                </div>
            </div>
        `;

        document.getElementById('cmp-results').innerHTML = html;
    }

    function buildDivergenceNote({ spread, minExpected, n, pRaw, pYates, pFisher, alpha }) {
        const parts = [];
        parts.push('<h3>Agreement &amp; divergence</h3>');

        if (minExpected >= 5 && n >= 40) {
            parts.push(`<p>&check; <strong>All expected counts &ge; 5 and N = ${n}</strong>. The large-sample approximations behind &chi;<sup>2</sup> and the Z-test are on solid ground. Any of the three tests is fine to report.</p>`);
        } else if (minExpected < 1) {
            parts.push(`<p>&#9888; <strong>Minimum expected cell is ${minExpected.toFixed(2)} (below 1)</strong>. The &chi;<sup>2</sup> approximation is unreliable here; report <strong>Fisher's exact test</strong>.</p>`);
        } else if (minExpected < 5) {
            parts.push(`<p>&#9888; <strong>Minimum expected cell is ${minExpected.toFixed(2)} (below 5)</strong>. Cochran's (1954) rule flags &chi;<sup>2</sup> as unreliable here; prefer <strong>Fisher's exact</strong> or the Yates-corrected &chi;<sup>2</sup>.</p>`);
        }

        const crossesAlpha = (p) => Number.isFinite(p) && ((p < alpha) !== (pRaw < alpha));
        if (crossesAlpha(pYates) || crossesAlpha(pFisher)) {
            parts.push(`<p>&#9888; <strong>Tests disagree about significance at &alpha; = ${alpha}</strong>. Uncorrected &chi;<sup>2</sup> p = ${pFmt(pRaw)}; Yates' p = ${pFmt(pYates)}; Fisher's p = ${pFmt(pFisher)}. When methods straddle the threshold for small samples, Fisher's is the conservative choice.</p>`);
        } else if (spread < 0.02) {
            parts.push(`<p>The tests agree closely (p-value spread &lt; .02). This is expected when N is moderate-to-large and expected counts are healthy.</p>`);
        } else if (spread < 0.1) {
            parts.push(`<p>The tests are in broad agreement but with a visible p-value spread of ${spread.toFixed(3)}. The small differences illustrate how each test handles discreteness and continuity corrections.</p>`);
        } else {
            parts.push(`<p>The tests produce a p-value spread of <strong>${spread.toFixed(3)}</strong>. For small or sparse tables this is normal; the exact test (Fisher's) is the reference.</p>`);
        }

        parts.push(`<p class="compare-note"><em>Identity check:</em> for a 2&times;2 table, z<sup>2</sup> from the two-proportion test equals the uncorrected &chi;<sup>2</sup> statistic exactly. This is why the Z-test and &chi;<sup>2</sup> always give the same p-value here.</p>`);
        return parts.join('\n');
    }

    function loadSmallExample() {
        // A sparse 2×2 that makes Fisher's exact and χ² diverge. Classic Fisher tea-tasting spirit:
        // small sample, expected counts < 5, borderline significance.
        document.getElementById('row-label-0').value = 'Treated';
        document.getElementById('row-label-1').value = 'Control';
        document.getElementById('col-label-0').value = 'Responded';
        document.getElementById('col-label-1').value = 'No response';
        document.getElementById('cmp-0-0').value = '8';
        document.getElementById('cmp-0-1').value = '2';
        document.getElementById('cmp-1-0').value = '1';
        document.getElementById('cmp-1-1').value = '5';
        showNotification('Loaded small-N example (8,2 / 1,5). Click "Run All Three Tests" to see the divergence.', 'info');
    }

    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('cmp-calculate-btn').addEventListener('click', () => {
            try {
                const inputs = readInputs();
                renderResults(inputs);
            } catch (err) {
                showNotification(err.message, 'error', { duration: 5000 });
            }
        });
        document.getElementById('cmp-load-example-btn').addEventListener('click', loadSmallExample);

        // Initial render with the default table so the page isn't empty on load
        try {
            const inputs = readInputs();
            renderResults(inputs);
        } catch (_) { /* quiet on initial load */ }
    });
})();
