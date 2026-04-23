/**
 * Three-Level Interpretation helper.
 *
 * Renders a Data / Statistical / Plain-English accordion beneath a calculator's
 * primary result area. Encourages students to distinguish what they observed
 * (Level 1), what the statistical machinery says about it (Level 2), and
 * what that means in ordinary language (Level 3).
 *
 * Shape: ZtChi.threeLevel.render(testType, ctx) -> HTML string
 *   testType: 't' | 'chi'
 *   ctx: the same context passed to renderPostResult (computed by the calculator)
 *
 * Pedagogical framing: ASA (2016), Cumming (2014) — results should be
 * presented as effect + uncertainty, with explicit translation from the
 * statistical output into ordinary language.
 */
(function () {
    'use strict';

    const ZtChi = window.ZtChi || (window.ZtChi = {});

    function fmt(v, d = 3) { return Number.isFinite(v) ? v.toFixed(d) : '—'; }
    function pFmt(p) {
        if (!Number.isFinite(p)) return '—';
        if (p < 0.0001) return '< .0001';
        return p.toFixed(4).replace(/^0\./, '.');
    }
    function sigLang(p, alpha) {
        if (!Number.isFinite(p) || !Number.isFinite(alpha)) return '';
        return p < alpha ? 'statistically significant at the chosen level' : 'not statistically significant at the chosen level';
    }

    /**
     * t-test: supports all four modes (stat / one-sample / paired / welch).
     */
    function renderT(ctx) {
        const alpha = ctx.alpha;
        const conf = ctx.conf || (1 - alpha);
        const confPct = Math.round(conf * 100);
        const mode = ctx.mode || 'stat';
        const sig = sigLang(ctx.twoTailP, alpha);

        let dataHtml = '';
        let statsHtml = '';
        let plainHtml = '';

        if (mode === 'stat') {
            dataHtml = `<p>A <em>t</em> statistic of <strong>${fmt(ctx.t)}</strong> was provided directly (no raw data at this stage). The degrees of freedom reported are <strong>${ctx.df}</strong>.</p>`;
            statsHtml = `<p>Under the t-distribution with ${ctx.df} df, the two-tailed p-value is <strong>${pFmt(ctx.twoTailP)}</strong>. The critical value at α = ${fmt(alpha, 3)} (two-tailed) is ±${fmt(Math.abs(ctx.twoTailCritical))}.</p>`;
            plainHtml = `<p>A t-value of ${fmt(ctx.t)} with ${ctx.df} df is ${sig}. ${ctx.twoTailP < alpha ? `If the null hypothesis were true, data at least as extreme as this would appear only about ${(ctx.twoTailP * 100).toFixed(1)}% of the time, so the evidence points against H₀.` : `Data this extreme could easily arise by chance under the null; the evidence does not rule H₀ out.`}</p>`;
        } else if (mode === 'one-sample') {
            dataHtml = `<p>Sample of <strong>n = ${ctx.n}</strong> observations with sample mean <strong>x̄ = ${fmt(ctx.mean)}</strong>, sample SD <strong>s = ${fmt(ctx.sd)}</strong>, and SE = <strong>${fmt(ctx.se)}</strong>. Hypothesised mean <strong>μ₀ = ${fmt(ctx.mu0)}</strong>.</p>`;
            statsHtml = `<p>One-sample <em>t</em>(${ctx.df}) = <strong>${fmt(ctx.t)}</strong>, <em>p</em> = <strong>${pFmt(ctx.twoTailP)}</strong>, two-tailed. ${confPct}% CI for the mean: <strong>[${fmt(ctx.ciLow)}, ${fmt(ctx.ciHigh)}]</strong>. The CI ${(ctx.ciLow > ctx.mu0 || ctx.ciHigh < ctx.mu0) ? 'excludes' : 'includes'} the hypothesised μ₀.</p>`;
            plainHtml = `<p>The sample mean of ${fmt(ctx.mean)} is ${sig} ${ctx.twoTailP < alpha ? `different from the hypothesised value of ${fmt(ctx.mu0)}. ` : `from the hypothesised value of ${fmt(ctx.mu0)}. `}The ${confPct}% CI tells you the plausible range for the <em>true</em> population mean given these data: any value in [${fmt(ctx.ciLow)}, ${fmt(ctx.ciHigh)}] is consistent with what you observed.</p>`;
        } else if (mode === 'paired') {
            dataHtml = `<p>A matched set of <strong>n = ${ctx.n}</strong> pairs. The within-pair differences have mean <strong>${fmt(ctx.meanDiff)}</strong> and SD <strong>${fmt(ctx.sd)}</strong>.</p>`;
            statsHtml = `<p>Paired <em>t</em>(${ctx.df}) = <strong>${fmt(ctx.t)}</strong>, <em>p</em> = <strong>${pFmt(ctx.twoTailP)}</strong>, two-tailed. ${confPct}% CI for the mean difference: <strong>[${fmt(ctx.ciLow)}, ${fmt(ctx.ciHigh)}]</strong>. The CI ${(ctx.ciLow > 0 || ctx.ciHigh < 0) ? 'excludes' : 'includes'} zero.</p>`;
            plainHtml = `<p>Within-pair changes average ${fmt(ctx.meanDiff)}, and this shift is ${sig}. ${(ctx.ciLow > 0 || ctx.ciHigh < 0) ? `The ${confPct}% CI on the average change excludes zero, so the paired intervention is associated with a systematic shift.` : `The ${confPct}% CI on the average change spans zero, meaning the data are consistent with "no real change."`}</p>`;
        } else if (mode === 'welch') {
            dataHtml = `<p>Group A: <strong>n = ${ctx.nA}</strong>, mean = ${fmt(ctx.meanA)}, SD = ${fmt(ctx.sdA)}. Group B: <strong>n = ${ctx.nB}</strong>, mean = ${fmt(ctx.meanB)}, SD = ${fmt(ctx.sdB)}. Observed difference (A − B) = <strong>${fmt(ctx.diff)}</strong>.</p>`;
            statsHtml = `<p>Welch's <em>t</em>(${fmt(ctx.df, 2)}) = <strong>${fmt(ctx.t)}</strong>, <em>p</em> = <strong>${pFmt(ctx.twoTailP)}</strong>, two-tailed. ${confPct}% CI for the mean difference: <strong>[${fmt(ctx.ciLow)}, ${fmt(ctx.ciHigh)}]</strong>. The CI ${(ctx.ciLow > 0 || ctx.ciHigh < 0) ? 'excludes' : 'includes'} zero.</p>`;
            plainHtml = `<p>The two groups differ on average by ${fmt(ctx.diff)}, and this difference is ${sig}. ${(ctx.ciLow > 0 || ctx.ciHigh < 0) ? `The ${confPct}% CI on the difference excludes zero, so the data support a real group difference in the direction ${ctx.diff > 0 ? 'A &gt; B' : 'B &gt; A'}.` : `The ${confPct}% CI on the difference spans zero, so the data are consistent with no real group difference.`}</p>`;
        }

        return wrap('t-test', dataHtml, statsHtml, plainHtml);
    }

    /**
     * chi-square test of independence.
     * ctx includes: rows, cols, chiSquare, df, criticalValue, pValue, alpha,
     * grandTotal (= n), cramersV, cramersLabel.
     */
    function renderChi(ctx) {
        const alpha = ctx.alpha;
        const n = ctx.n || ctx.grandTotal;
        const sig = sigLang(ctx.pValue, alpha);

        const dataHtml =
            `<p>A <strong>${ctx.rows} × ${ctx.cols}</strong> contingency table with <strong>N = ${n}</strong> observations. ` +
            `Minimum expected cell = ${fmt(Math.min(...(ctx.expected || [[]]).flat()), 2)}.</p>`;

        const statsHtml =
            `<p>Pearson's <em>χ</em>²(${ctx.df}, <em>N</em> = ${n}) = <strong>${fmt(ctx.chiSquare)}</strong>, <em>p</em> = <strong>${pFmt(ctx.pValue)}</strong>, ` +
            `compared against the critical value ${fmt(ctx.criticalValue)} at α = ${fmt(alpha, 3)}. ` +
            `Cramer's <em>V</em> = ${fmt(ctx.cramersV)} ${ctx.cramersLabel ? `(${ctx.cramersLabel})` : ''}.</p>`;

        const assumptionWarn = (Number.isFinite(ctx.expected?.[0]?.[0]) &&
            Math.min(...ctx.expected.flat()) < 5)
            ? ' <strong>Caveat:</strong> at least one expected cell is below 5 — the χ² approximation may be unreliable; Fisher\'s exact test would be more trustworthy.'
            : '';

        let plainHtml;
        if (ctx.pValue < alpha) {
            plainHtml = `<p>The two categorical variables in this table show ${sig}; the observed counts depart from what we would expect under independence by more than chance alone. The strength of that association is <strong>${ctx.cramersLabel || fmt(ctx.cramersV)}</strong>: significance tells us something is going on, Cramer's V tells us how large the effect is.${assumptionWarn}</p>`;
        } else {
            plainHtml = `<p>The observed counts are consistent with no real association between the two variables — differences from the "independence" prediction fall within what chance alone would produce (${sig}). ${(ctx.cramersV || 0) > 0.1 ? `The Cramer's V value of ${fmt(ctx.cramersV)} does suggest a small effect, but the sample size is not large enough to distinguish it from zero.` : ''}${assumptionWarn}</p>`;
        }

        return wrap('chi-square', dataHtml, statsHtml, plainHtml);
    }

    function wrap(testName, dataHtml, statsHtml, plainHtml) {
        return `
            <section class="three-level no-print" aria-label="Three-level interpretation">
                <h3>Three-level interpretation</h3>
                <p class="three-level-intro">Same ${testName} result, explained three ways. Skim the one that matches how you'd describe it to a colleague.</p>
                <details class="three-level-section" open>
                    <summary><strong>Level 1 &mdash; Your data</strong> <small>(what you actually measured)</small></summary>
                    <div class="three-level-body">${dataHtml}</div>
                </details>
                <details class="three-level-section" open>
                    <summary><strong>Level 2 &mdash; Statistical result</strong> <small>(what the test output says)</small></summary>
                    <div class="three-level-body">${statsHtml}</div>
                </details>
                <details class="three-level-section" open>
                    <summary><strong>Level 3 &mdash; Plain English</strong> <small>(what it means to a colleague)</small></summary>
                    <div class="three-level-body">${plainHtml}</div>
                </details>
            </section>
        `;
    }

    ZtChi.threeLevel = {
        render(testType, ctx) {
            try {
                if (testType === 't') return renderT(ctx);
                if (testType === 'chi') return renderChi(ctx);
            } catch (_) { /* silent; don't let a formatting bug break the whole result */ }
            return '';
        },
    };
})();
