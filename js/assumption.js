/**
 * Assumption Coach: Q-Q plot, skewness / kurtosis, Jarque-Bera test,
 * IQR outlier detection, and a test-recommendation traffic light.
 *
 * References:
 *   - Jarque & Bera (1987). A test for normality of observations and
 *     regression residuals. Int. Stat. Review, 55(2), 163–172.
 *   - Blom (1958). Statistical Estimates and Transformed Beta Variables.
 *   - Tukey (1977). Exploratory Data Analysis. Reading, MA: Addison-Wesley.
 *   - Shapiro & Wilk (1965). An analysis of variance test for normality.
 *     Biometrika, 52(3/4), 591–611 (cited here; not implemented).
 */
(function () {
    'use strict';

    const {
        escapeHtml, showNotification,
        summaryStats, skewness, kurtosis, jarqueBera, qqPoints, iqrOutliers,
        wilcoxonSignedRank, shapiroWilk,
    } = window.ZtChi;

    function parseData(raw) {
        const toks = raw.split(/[\s,]+/).map((t) => t.trim()).filter(Boolean);
        const nums = []; let skipped = 0;
        for (const t of toks) {
            const v = Number(t);
            if (Number.isFinite(v)) nums.push(v);
            else skipped++;
        }
        return { nums, skipped };
    }

    function fmt(v, d = 3) { return Number.isFinite(v) ? v.toFixed(d) : '—'; }
    function pFmt(p) {
        if (!Number.isFinite(p)) return '—';
        if (p < 0.0001) return '< .0001';
        return p.toFixed(4).replace(/^0\./, '.');
    }

    function qqSvg(points) {
        const width = 560, height = 320, m = { top: 30, right: 20, bottom: 45, left: 55 };
        const iw = width - m.left - m.right;
        const ih = height - m.top - m.bottom;

        if (points.length < 2) return '<p>Need at least 2 points for a Q-Q plot.</p>';

        const xs = points.map((p) => p.theo);
        const ys = points.map((p) => p.obs);
        let xMin = Math.min(...xs), xMax = Math.max(...xs);
        let yMin = Math.min(...ys), yMax = Math.max(...ys);
        if (xMin === xMax) { xMin -= 0.5; xMax += 0.5; }
        if (yMin === yMax) { yMin -= 0.5; yMax += 0.5; }
        const xPad = (xMax - xMin) * 0.05;
        const yPad = (yMax - yMin) * 0.05;
        xMin -= xPad; xMax += xPad;
        yMin -= yPad; yMax += yPad;
        const sx = (v) => m.left + ((v - xMin) / (xMax - xMin)) * iw;
        const sy = (v) => m.top + ih - ((v - yMin) / (yMax - yMin)) * ih;

        // Reference line: best-fit y = intercept + slope * x based on (mean, SD)
        // For standard normal theoretical, the "ideal" line is y = mean + sd * x
        const n = points.length;
        const meanY = ys.reduce((a, b) => a + b, 0) / n;
        const ss = ys.reduce((a, b) => a + (b - meanY) * (b - meanY), 0);
        const sdY = Math.sqrt(ss / (n - 1));
        const refX1 = xMin, refX2 = xMax;
        const refY1 = meanY + sdY * refX1;
        const refY2 = meanY + sdY * refX2;

        const dots = points.map((p) =>
            `<circle cx="${sx(p.theo).toFixed(2)}" cy="${sy(p.obs).toFixed(2)}" r="3" fill="#1976d2" fill-opacity="0.75" stroke="#0d47a1" stroke-width="0.5"/>`
        ).join('');

        // Tick marks
        const xTicks = []; const yTicks = [];
        for (let i = 0; i <= 5; i++) {
            const xv = xMin + (i / 5) * (xMax - xMin);
            const yv = yMin + (i / 5) * (yMax - yMin);
            xTicks.push(`
                <line x1="${sx(xv)}" y1="${m.top + ih}" x2="${sx(xv)}" y2="${m.top + ih + 4}" stroke="#666"/>
                <text x="${sx(xv)}" y="${m.top + ih + 17}" text-anchor="middle" font-size="10" fill="#444">${xv.toFixed(2)}</text>`);
            yTicks.push(`
                <line x1="${m.left - 4}" y1="${sy(yv)}" x2="${m.left}" y2="${sy(yv)}" stroke="#666"/>
                <text x="${m.left - 7}" y="${(sy(yv) + 4).toFixed(2)}" text-anchor="end" font-size="10" fill="#444">${yv.toFixed(2)}</text>`);
        }

        return `
            <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" class="qq-plot" role="img" aria-label="Q-Q plot of observed vs theoretical normal quantiles">
                <text x="${m.left}" y="${m.top - 10}" font-size="12" fill="#1976d2" font-weight="600">Normal Q-Q plot</text>
                <text x="${width - m.right}" y="${m.top - 10}" text-anchor="end" font-size="11" fill="#666">n = ${n}</text>
                <line x1="${sx(refX1)}" y1="${sy(refY1)}" x2="${sx(refX2)}" y2="${sy(refY2)}" stroke="#d32f2f" stroke-width="1.5" stroke-dasharray="5,3"/>
                <line x1="${m.left}" y1="${m.top + ih}" x2="${m.left + iw}" y2="${m.top + ih}" stroke="#333" stroke-width="1"/>
                <line x1="${m.left}" y1="${m.top}" x2="${m.left}" y2="${m.top + ih}" stroke="#333" stroke-width="1"/>
                ${xTicks.join('')}
                ${yTicks.join('')}
                <text x="${m.left + iw / 2}" y="${height - 8}" text-anchor="middle" font-size="12" fill="#333">Theoretical normal quantiles</text>
                <text transform="rotate(-90, 14, ${m.top + ih / 2})" x="14" y="${m.top + ih / 2}" text-anchor="middle" font-size="12" fill="#333">Observed (sorted)</text>
                ${dots}
            </svg>
        `;
    }

    function buildRecommendation(xs, s, jb, outliers) {
        const n = xs.length;
        const absSkew = Math.abs(s.skew);
        const absExcKurt = Math.abs(s.excKurt);
        const outlierPct = outliers.outliers.length / n;

        // Three-tier: green (parametric OK), yellow (caution), red (prefer nonparametric / bootstrap)
        const conditions = [];
        let tier = 'green';

        if (n < 10) {
            conditions.push(`Very small sample (n = ${n}). Normality is hard to assess; the Q-Q plot is noisy. Any conclusion is provisional.`);
            tier = 'yellow';
        }
        if (absSkew > 1.0) {
            conditions.push(`Large skewness (|S| = ${absSkew.toFixed(2)}) suggests non-normal distribution.`);
            tier = 'red';
        } else if (absSkew > 0.5) {
            conditions.push(`Moderate skewness (|S| = ${absSkew.toFixed(2)}). For n ≥ 30 the CLT may rescue the t-test; for smaller n be cautious.`);
            if (tier === 'green') tier = 'yellow';
        }
        if (absExcKurt > 2.0) {
            conditions.push(`Heavy tails (excess kurtosis = ${s.excKurt.toFixed(2)}); t-test p-values may be off.`);
            tier = 'red';
        }
        if (outlierPct > 0.1) {
            conditions.push(`${outliers.outliers.length} outlier(s) flagged (${(outlierPct * 100).toFixed(0)}% of data). Parametric means and SDs are pulled around by these; either investigate or prefer a robust method.`);
            if (tier === 'green') tier = 'yellow';
        } else if (outliers.outliers.length > 0) {
            conditions.push(`${outliers.outliers.length} outlier(s) flagged. Worth inspecting individually.`);
        }
        // CLT may partially rescue the t-test at moderate n, but only when BOTH
        // skewness and excess kurtosis are modest. Heavy-tailed (high kurtosis)
        // distributions can still produce inflated Type I error rates well above
        // alpha at n = 30–100 (Wilcox 2012; Micceri 1989), so a red verdict
        // driven by kurtosis must not be demoted on the basis of skew alone.
        if (n >= 30 && jb.p < 0.01 && absSkew < 1.2 && absExcKurt < 2.0) {
            conditions.push(`JB rejects normality (p = ${pFmt(jb.p)}) but skew and kurtosis are moderate at n = ${n}; CLT may help the t-test for the mean, though p-values and CIs can still be biased under heavy tails. Cross-check with the bootstrap on the <a href="simulate.html">Simulate</a> page if in doubt.`);
            if (tier === 'red') tier = 'yellow';
        }
        if (conditions.length === 0) {
            conditions.push('No major issues flagged. Parametric tests (t-test, Z-test) are appropriate.');
        }

        const verdict = tier === 'green'
            ? {
                label: 'Parametric tests OK',
                colorClass: 'verdict reject', // reuse green palette
                advice: 'A t-test (or Welch\'s / paired as appropriate) is reasonable for these data. Report the mean and CI as usual.',
            }
            : tier === 'yellow'
                ? {
                    label: 'Use caution',
                    colorClass: 'verdict fail',
                    advice: 'The t-test may still be OK, but consider: (a) reporting both the t-CI and the bootstrap CI (<a href="simulate.html">Simulate</a> page) as a robustness check; (b) if n is small and the distribution is clearly non-normal, use the Wilcoxon signed-rank result below, or a permutation / bootstrap approach.',
                }
                : {
                    label: 'Prefer non-parametric / bootstrap',
                    colorClass: 'verdict fail',
                    advice: 'Parametric t-test results may be misleading. Use the Wilcoxon signed-rank result below, or the bootstrap CI + permutation p-value on the <a href="simulate.html">Simulate</a> page.',
                };

        return { tier, verdict, conditions };
    }

    function render(xs) {
        const ss = summaryStats(xs);
        const skew = skewness(xs);
        const excKurt = kurtosis(xs);
        const jb = jarqueBera(xs);
        const outliers = iqrOutliers(xs);
        const s = { ...ss, skew, excKurt };
        const rec = buildRecommendation(xs, s, jb, outliers);

        const qq = qqPoints(xs);

        const outlierList = outliers.outliers.length === 0
            ? '<p>None flagged.</p>'
            : `<ul>${outliers.outliers.map((o) => `<li>x = ${fmt(o.value)} (position ${o.index + 1})</li>`).join('')}</ul>`;

        // Wilcoxon signed-rank test. Uses the μ₀ the user entered in the
        // input field. If the field is blank we skip the panel entirely
        // rather than running against a default of zero — running against
        // zero on non-zero-centered data (blood pressures, test scores) is
        // mathematically correct but pedagogically useless and actively
        // misleading (the "is BP different from zero?" null is never the
        // one a student is asking about).
        let wilcoxonHtml = '';
        const mu0Input = document.getElementById('assm-mu0');
        const mu0Raw = mu0Input ? mu0Input.value.trim() : '';
        if (mu0Raw === '') {
            wilcoxonHtml = `
                <div class="assm-stats">
                    <h3>Wilcoxon signed-rank test (non-parametric alternative)</h3>
                    <p class="compare-note">Enter a reference value (<em>&mu;</em><sub>0</sub>) in the input above to run the Wilcoxon signed-rank test. The test asks "does the median differ from &mu;<sub>0</sub>?" &mdash; pick the hypothesized reference from your research question (e.g., 120 for systolic BP, 100 for IQ, 0 for already-centered paired differences). We deliberately skip this test when no reference is given, since &mu;<sub>0</sub> = 0 is almost never the right null for raw biomeasurements.</p>
                </div>`;
        } else {
            const mu0 = Number(mu0Raw);
            if (!Number.isFinite(mu0)) {
                wilcoxonHtml = `<div class="assm-stats"><h3>Wilcoxon signed-rank test</h3><p class="compare-note">Not computable: μ₀ must be a finite number.</p></div>`;
            } else {
                try {
                    const w = wilcoxonSignedRank(xs, mu0);
                    const dropped = w.zerosDropped > 0
                        ? ` (${w.zerosDropped} observation${w.zerosDropped === 1 ? '' : 's'} equal to μ₀ dropped)`
                        : '';
                    wilcoxonHtml = `
                        <div class="assm-stats">
                            <h3>Wilcoxon signed-rank test (non-parametric alternative)</h3>
                            <p>H<sub>0</sub>: median = ${fmt(mu0)}. <em>W</em><sub>+</sub> = ${fmt(w.wPlus, 2)}, <em>W</em><sub>&minus;</sub> = ${fmt(w.wMinus, 2)}, <em>n</em><sub>eff</sub> = ${w.n}${dropped}. Normal-approximation <em>z</em> = ${fmt(w.z, 3)}, two-tailed <em>p</em> = ${pFmt(w.pTwoTailed)}.</p>
                            ${w.note ? `<p class="compare-note"><small>&#9888; ${w.note}</small></p>` : ''}
                            <p class="compare-note"><small>Rank-based, makes no normality assumption. For paired data enter the differences (A &minus; B) and set μ₀ = 0.</small></p>
                        </div>`;
                } catch (err) {
                    wilcoxonHtml = `<div class="assm-stats"><h3>Wilcoxon signed-rank test</h3><p class="compare-note">Not computable: ${escapeHtml(err.message || String(err))}</p></div>`;
                }
            }
        }

        const html = `
            <div class="assm-result">
                <div class="assm-left">
                    <div class="assm-plot">${qqSvg(qq)}</div>
                    <div class="assm-stats">
                        <h3>Summary statistics</h3>
                        <div class="stats-grid">
                            <div class="stat-item"><span class="stat-label">n</span><span class="stat-value">${s.n}</span></div>
                            <div class="stat-item"><span class="stat-label">mean</span><span class="stat-value">${fmt(s.mean)}</span></div>
                            <div class="stat-item"><span class="stat-label">SD</span><span class="stat-value">${fmt(s.sd)}</span></div>
                            <div class="stat-item"><span class="stat-label">median</span><span class="stat-value">${fmt(s.median)}</span></div>
                            <div class="stat-item"><span class="stat-label">min / max</span><span class="stat-value">${fmt(s.min)} / ${fmt(s.max)}</span></div>
                            <div class="stat-item"><span class="stat-label">IQR [Q1, Q3]</span><span class="stat-value">[${fmt(outliers.q1)}, ${fmt(outliers.q3)}]</span></div>
                            <div class="stat-item"><span class="stat-label">skewness (bias-corrected)</span><span class="stat-value">${fmt(skew, 3)}</span></div>
                            <div class="stat-item"><span class="stat-label">excess kurtosis</span><span class="stat-value">${fmt(excKurt, 3)}</span></div>
                        </div>
                    </div>
                </div>
                <div class="assm-right">
                    <div class="assm-verdict ${rec.tier}">
                        <h3>${escapeHtml(rec.verdict.label)}</h3>
                        <p>${rec.verdict.advice}</p>
                    </div>
                    <div class="assm-stats">
                        <h3>Normality checks</h3>
                        <p><strong>Jarque-Bera:</strong> JB = ${fmt(jb.jb, 3)} on ~χ²(2), <em>p</em> = ${pFmt(jb.p)}. ${jb.p < 0.05 ? 'Rejects' : 'Does not reject'} H₀ that data come from a normal distribution.</p>
                        ${(() => {
                            try {
                                const sw = shapiroWilk(xs);
                                if (!Number.isFinite(sw.w)) return `<p><strong>Shapiro-Wilk:</strong> not computable — ${escapeHtml(sw.note || 'need n ≥ 4')}.</p>`;
                                return `<p><strong>Shapiro-Wilk:</strong> W = ${fmt(sw.w, 4)}, <em>p</em> = ${pFmt(sw.p)}. ${sw.p < 0.05 ? 'Rejects' : 'Does not reject'} H₀ of normality. ${sw.note ? `<small>${escapeHtml(sw.note)}</small>` : ''}</p>`;
                            } catch (err) {
                                return `<p><strong>Shapiro-Wilk:</strong> not computable — ${escapeHtml(err.message || String(err))}.</p>`;
                            }
                        })()}
                        <p class="compare-note"><small>JB is powerful for n ≳ 30 and uses skew + kurtosis directly. Shapiro-Wilk (via Royston 1992 approximation) is generally the more powerful test for n &lt; 50 and is the standard small-sample normality test in R, SPSS, and jamovi. When the two disagree, trust Shapiro-Wilk at small n and the Q-Q plot over both.</small></p>
                    </div>
                    <div class="assm-stats">
                        <h3>Outliers (Tukey 1.5 × IQR rule)</h3>
                        <p>Lower fence = ${fmt(outliers.lower)}, upper fence = ${fmt(outliers.upper)}.</p>
                        ${outlierList}
                    </div>
                    ${wilcoxonHtml}
                    <div class="assm-conditions">
                        <h3>What the diagnostics say</h3>
                        <ul>${rec.conditions.map((c) => `<li>${c}</li>`).join('')}</ul>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('assm-results').innerHTML = html;
    }

    function loadExampleNormal() {
        document.getElementById('assm-data').value =
            '101.2, 98.4, 103.7, 99.1, 100.5, 97.8, 102.6, 104.3, 96.9, 101.8, 99.5, 100.1, 98.9, 103.0, 97.4, 105.2, 99.7, 101.5, 100.3, 98.2, 102.9, 96.5, 104.1, 100.0, 101.9, 99.3, 98.0, 102.3, 100.7, 101.1';
        showNotification('Loaded ~N(100, 2.3), n=30.', 'info');
    }

    function loadExampleSkew() {
        // Right-skewed data — income-like
        document.getElementById('assm-data').value =
            '32, 28, 35, 41, 29, 38, 33, 45, 30, 37, 42, 34, 39, 31, 55, 36, 44, 40, 48, 52, 60, 43, 95, 47, 58, 46, 72, 50, 68, 120';
        showNotification('Loaded right-skewed data, n=30 (one big outlier).', 'info');
    }

    function run() {
        try {
            const { nums, skipped } = parseData(document.getElementById('assm-data').value);
            if (nums.length < 4) throw new Error('Need at least 4 observations for meaningful diagnostics.');
            if (skipped > 0) showNotification(`Skipped ${skipped} non-numeric token(s).`, 'warning');
            render(nums);
        } catch (err) {
            showNotification(err.message, 'error', { duration: 5000 });
        }
    }

    function hydrateFromDataset() {
        try {
            const raw = sessionStorage.getItem('ZtChi.datasetHandoff');
            if (!raw) return;
            const p = JSON.parse(raw);
            if (!p || p.calculator !== 'assumption') return;
            sessionStorage.removeItem('ZtChi.datasetHandoff');
            if (p.dataA) document.getElementById('assm-data').value = p.dataA;
            if (p.datasetName) {
                showNotification(`Loaded dataset: ${p.datasetName}`, 'info', { duration: 4000 });
                if (window.ZtChi.datasetBanner) window.ZtChi.datasetBanner.render(p);
            }
            run();
        } catch (_) { /* quiet */ }
    }

    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('assm-run-btn').addEventListener('click', run);
        document.getElementById('assm-example-norm-btn').addEventListener('click', () => { loadExampleNormal(); run(); });
        document.getElementById('assm-example-skew-btn').addEventListener('click', () => { loadExampleSkew(); run(); });
        hydrateFromDataset();
    });
})();
