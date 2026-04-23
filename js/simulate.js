/**
 * Simulation-Based Inference page.
 *  - Bootstrap: percentile-method CI for the mean of a single sample.
 *  - Permutation: two-sample difference-in-means p-value.
 *
 * Runs resampling in an inline Blob-URL Web Worker so the UI stays responsive
 * during 10k+ iterations. Renders an SVG histogram of the null / bootstrap
 * distribution with the observed statistic marked.
 *
 * References:
 *   - Efron (1979). Bootstrap methods: another look at the jackknife. Ann. Stat. 7(1), 1–26.
 *   - Efron & Tibshirani (1993). An Introduction to the Bootstrap. Chapman & Hall.
 *   - Good (2005). Permutation, Parametric, and Bootstrap Tests of Hypotheses. Springer.
 */
(function () {
    'use strict';

    const { showNotification, escapeHtml } = window.ZtChi;

    const workerSource = `
        self.onmessage = function (e) {
            const msg = e.data || {};
            try {
                if (msg.mode === 'bootstrap') {
                    runBootstrap(msg);
                } else if (msg.mode === 'permutation') {
                    runPermutation(msg);
                } else {
                    self.postMessage({ type: 'error', error: 'Unknown mode: ' + msg.mode });
                }
            } catch (err) {
                self.postMessage({ type: 'error', error: err && err.message ? err.message : String(err) });
            }
        };

        function mean(arr) {
            let s = 0;
            for (let i = 0; i < arr.length; i++) s += arr[i];
            return s / arr.length;
        }

        function runBootstrap(msg) {
            const data = msg.data;
            const iterations = msg.iterations | 0;
            const n = data.length;
            const stats = new Float64Array(iterations);
            const progressStep = Math.max(1, Math.floor(iterations / 20));

            for (let i = 0; i < iterations; i++) {
                let s = 0;
                for (let j = 0; j < n; j++) {
                    s += data[(Math.random() * n) | 0];
                }
                stats[i] = s / n;
                if (i % progressStep === 0) {
                    self.postMessage({ type: 'progress', fraction: i / iterations });
                }
            }

            const ciLevel = msg.ciLevel;
            const sorted = Float64Array.from(stats);
            sorted.sort();
            const lowIdx = Math.floor(((1 - ciLevel) / 2) * iterations);
            const highIdx = Math.min(iterations - 1, Math.floor(((1 + ciLevel) / 2) * iterations));
            const observed = mean(data);

            self.postMessage({
                type: 'done',
                mode: 'bootstrap',
                stats: Array.from(stats),
                observed,
                ciLow: sorted[lowIdx],
                ciHigh: sorted[highIdx],
            });
        }

        function runPermutation(msg) {
            const dataA = msg.dataA;
            const dataB = msg.dataB;
            const iterations = msg.iterations | 0;
            const nA = dataA.length;
            const combined = new Float64Array(nA + dataB.length);
            for (let i = 0; i < nA; i++) combined[i] = dataA[i];
            for (let i = 0; i < dataB.length; i++) combined[nA + i] = dataB[i];

            const observedDiff = mean(dataA) - mean(dataB);
            const stats = new Float64Array(iterations);
            const progressStep = Math.max(1, Math.floor(iterations / 20));

            for (let i = 0; i < iterations; i++) {
                for (let k = combined.length - 1; k > 0; k--) {
                    const j = (Math.random() * (k + 1)) | 0;
                    const t = combined[k]; combined[k] = combined[j]; combined[j] = t;
                }
                let sA = 0, sB = 0;
                for (let k = 0; k < nA; k++) sA += combined[k];
                for (let k = nA; k < combined.length; k++) sB += combined[k];
                stats[i] = sA / nA - sB / (combined.length - nA);
                if (i % progressStep === 0) {
                    self.postMessage({ type: 'progress', fraction: i / iterations });
                }
            }

            let geExtreme = 0;
            const absObs = Math.abs(observedDiff);
            for (let i = 0; i < iterations; i++) {
                if (Math.abs(stats[i]) >= absObs) geExtreme++;
            }
            const pTwoTailed = geExtreme / iterations;

            self.postMessage({
                type: 'done',
                mode: 'permutation',
                stats: Array.from(stats),
                observed: observedDiff,
                pTwoTailed,
            });
        }
    `;

    let workerInstance = null;
    function getWorker() {
        if (workerInstance) return workerInstance;
        const blob = new Blob([workerSource], { type: 'text/javascript' });
        workerInstance = new Worker(URL.createObjectURL(blob));
        return workerInstance;
    }

    function parseData(raw) {
        const tokens = raw.split(/[\s,]+/).map((t) => t.trim()).filter(Boolean);
        const nums = [];
        let skipped = 0;
        for (const tok of tokens) {
            const n = Number(tok);
            if (Number.isFinite(n)) nums.push(n);
            else skipped++;
        }
        return { nums, skipped };
    }

    function summaryStats(xs) {
        const n = xs.length;
        if (n === 0) return { n: 0 };
        const mean = xs.reduce((a, b) => a + b, 0) / n;
        const ss = xs.reduce((a, b) => a + (b - mean) * (b - mean), 0);
        const sd = n > 1 ? Math.sqrt(ss / (n - 1)) : 0;
        const sorted = xs.slice().sort((a, b) => a - b);
        return {
            n, mean, sd,
            se: n > 1 ? sd / Math.sqrt(n) : 0,
            min: sorted[0], max: sorted[n - 1],
            median: n % 2 === 1 ? sorted[(n - 1) / 2] : 0.5 * (sorted[n / 2 - 1] + sorted[n / 2]),
        };
    }

    function histogram(stats, nBins = 32) {
        if (stats.length === 0) return { bins: [], min: 0, max: 0, binWidth: 0 };
        let min = Infinity, max = -Infinity;
        for (const s of stats) {
            if (s < min) min = s;
            if (s > max) max = s;
        }
        if (min === max) { min -= 0.5; max += 0.5; }
        const binWidth = (max - min) / nBins;
        const bins = new Array(nBins).fill(0);
        for (const s of stats) {
            let idx = Math.floor((s - min) / binWidth);
            if (idx === nBins) idx = nBins - 1;
            if (idx < 0) idx = 0;
            bins[idx]++;
        }
        return { bins, min, max, binWidth };
    }

    function svgHistogram({ stats, observed, ciLow, ciHigh, titleLeft, titleRight }) {
        const width = 640, height = 260, m = { top: 30, right: 20, bottom: 40, left: 50 };
        const iw = width - m.left - m.right;
        const ih = height - m.top - m.bottom;
        const { bins, min, max } = histogram(stats, 32);
        const maxCount = Math.max(...bins, 1);
        const xScale = (v) => m.left + ((v - min) / (max - min)) * iw;
        const barWidth = iw / bins.length;

        const bars = bins.map((count, i) => {
            const x = m.left + i * barWidth;
            const h = (count / maxCount) * ih;
            const y = m.top + ih - h;
            return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${(barWidth - 0.5).toFixed(2)}" height="${h.toFixed(2)}" fill="#90caf9" stroke="#1976d2" stroke-width="0.5"/>`;
        }).join('');

        const ticks = [];
        for (let i = 0; i <= 5; i++) {
            const v = min + (i / 5) * (max - min);
            const xp = xScale(v);
            ticks.push(`
                <line x1="${xp}" y1="${m.top + ih}" x2="${xp}" y2="${m.top + ih + 5}" stroke="#666" stroke-width="1"/>
                <text x="${xp}" y="${m.top + ih + 18}" text-anchor="middle" font-size="11" fill="#444">${v.toFixed(2)}</text>
            `);
        }

        const observedLine = Number.isFinite(observed) ? `
            <line x1="${xScale(observed)}" y1="${m.top}" x2="${xScale(observed)}" y2="${m.top + ih}" stroke="#d32f2f" stroke-width="2" stroke-dasharray="4,3"/>
            <text x="${xScale(observed)}" y="${m.top - 8}" text-anchor="middle" font-size="11" fill="#d32f2f" font-weight="bold">observed = ${observed.toFixed(3)}</text>
        ` : '';

        const ciBand = (Number.isFinite(ciLow) && Number.isFinite(ciHigh)) ? `
            <rect x="${xScale(ciLow)}" y="${m.top + ih + 22}" width="${xScale(ciHigh) - xScale(ciLow)}" height="6" fill="#1976d2" opacity="0.7"/>
            <text x="${xScale(ciLow)}" y="${m.top + ih + 36}" font-size="11" fill="#1565c0" text-anchor="start">${ciLow.toFixed(3)}</text>
            <text x="${xScale(ciHigh)}" y="${m.top + ih + 36}" font-size="11" fill="#1565c0" text-anchor="end">${ciHigh.toFixed(3)}</text>
        ` : '';

        return `
            <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" class="sim-histogram" role="img" aria-label="${titleLeft ? escapeHtml(titleLeft) : 'simulation histogram'}">
                <text x="${m.left}" y="${m.top - 10}" font-size="12" fill="#1976d2" font-weight="600">${titleLeft ? escapeHtml(titleLeft) : ''}</text>
                <text x="${width - m.right}" y="${m.top - 10}" text-anchor="end" font-size="11" fill="#666">${titleRight ? escapeHtml(titleRight) : ''}</text>
                <line x1="${m.left}" y1="${m.top + ih}" x2="${m.left + iw}" y2="${m.top + ih}" stroke="#333" stroke-width="1"/>
                <line x1="${m.left}" y1="${m.top}" x2="${m.left}" y2="${m.top + ih}" stroke="#333" stroke-width="1"/>
                ${bars}
                ${ticks.join('')}
                ${observedLine}
                ${ciBand}
            </svg>
        `;
    }

    function runBootstrap() {
        const raw = document.getElementById('sim-data-a').value;
        const { nums, skipped } = parseData(raw);
        if (nums.length < 2) throw new Error('Bootstrap needs at least 2 numeric observations.');
        if (skipped > 0) showNotification(`Skipped ${skipped} non-numeric token(s).`, 'warning');

        const iterations = parseInt(document.getElementById('sim-iterations').value, 10);
        const ciLevel = parseFloat(document.getElementById('sim-ci').value);
        if (!Number.isFinite(ciLevel) || ciLevel <= 0 || ciLevel >= 1) throw new Error('CI level must be strictly between 0 and 1.');

        setProgress(true, 0);
        const worker = getWorker();
        const t0 = performance.now();
        worker.onmessage = (e) => {
            if (e.data.type === 'progress') {
                setProgress(true, e.data.fraction);
            } else if (e.data.type === 'done') {
                setProgress(false, 1);
                renderBootstrapResult(nums, e.data, performance.now() - t0, ciLevel);
            } else if (e.data.type === 'error') {
                setProgress(false, 0);
                showNotification('Simulation error: ' + e.data.error, 'error', { duration: 7000 });
            }
        };
        worker.postMessage({ mode: 'bootstrap', data: nums, iterations, ciLevel });
    }

    function runPermutation() {
        const { nums: a, skipped: sA } = parseData(document.getElementById('sim-data-a').value);
        const { nums: b, skipped: sB } = parseData(document.getElementById('sim-data-b').value);
        if (a.length < 2 || b.length < 2) throw new Error('Permutation needs at least 2 numeric observations in each group.');
        if (sA + sB > 0) showNotification(`Skipped ${sA + sB} non-numeric token(s).`, 'warning');
        const iterations = parseInt(document.getElementById('sim-iterations').value, 10);
        setProgress(true, 0);
        const worker = getWorker();
        const t0 = performance.now();
        worker.onmessage = (e) => {
            if (e.data.type === 'progress') setProgress(true, e.data.fraction);
            else if (e.data.type === 'done') {
                setProgress(false, 1);
                renderPermutationResult(a, b, e.data, performance.now() - t0);
            } else if (e.data.type === 'error') {
                setProgress(false, 0);
                showNotification('Simulation error: ' + e.data.error, 'error', { duration: 7000 });
            }
        };
        worker.postMessage({ mode: 'permutation', dataA: a, dataB: b, iterations });
    }

    function setProgress(showing, frac) {
        const el = document.getElementById('sim-progress');
        el.style.display = showing ? 'flex' : 'none';
        if (showing) el.textContent = `Running simulation… ${(frac * 100).toFixed(0)}%`;
    }

    function fmt(v, d = 3) { return Number.isFinite(v) ? v.toFixed(d) : '—'; }

    function tCiForMean(xs, ciLevel) {
        const n = xs.length;
        if (n < 2) return null;
        const s = summaryStats(xs);
        const alpha = 1 - ciLevel;
        const tCrit = jStat.studentt.inv(1 - alpha / 2, n - 1);
        const se = s.sd / Math.sqrt(n);
        return { low: s.mean - tCrit * se, high: s.mean + tCrit * se, se, tCrit };
    }

    function renderBootstrapResult(data, result, runtimeMs, ciLevel) {
        const s = summaryStats(data);
        const tCi = tCiForMean(data, ciLevel);
        const bootWidth = result.ciHigh - result.ciLow;
        const tCiWidth = tCi ? tCi.high - tCi.low : NaN;
        // Thresholds below are heuristic for pedagogical feedback, not
        // derived from a specific published criterion. 15% width tolerance
        // catches gross mismatch; 10% skew catches a shifted percentile CI
        // even when widths happen to match.
        const widthRelDiff = tCi ? Math.abs(bootWidth - tCiWidth) / tCiWidth : NaN;
        const widthsAgree = Number.isFinite(widthRelDiff) && widthRelDiff < 0.15;
        // Asymmetry of the bootstrap CI around the sample mean. The t-CI is
        // symmetric by construction; a percentile CI from skewed data is not.
        const leftHalf = s.mean - result.ciLow;
        const rightHalf = result.ciHigh - s.mean;
        const totalHalf = rightHalf + leftHalf;
        const skew = totalHalf > 0 ? (rightHalf - leftHalf) / totalHalf : 0;
        const symmetric = Math.abs(skew) < 0.10;

        let agreementHtml;
        if (widthsAgree && symmetric) {
            agreementHtml = `<p>&check; Bootstrap CI and t-based CI agree in both width (within 15%) and center (bootstrap is roughly symmetric around the mean, |skew| = ${Math.abs(skew).toFixed(2)}). Your data are behaving the way the t-interval assumes &mdash; either CI is fine to report.</p>`;
        } else if (widthsAgree && !symmetric) {
            agreementHtml = `<p>&#9888; Widths are similar but the bootstrap CI is noticeably asymmetric around the sample mean (skew = ${skew.toFixed(2)}; longer on the ${skew > 0 ? 'upper' : 'lower'} side). This usually means the data are skewed. The t-CI is symmetric by construction and may be systematically off-center; the bootstrap CI is more trustworthy here.</p>`;
        } else {
            agreementHtml = `<p>&#9888; Bootstrap CI and t-based CI widths differ by ${(widthRelDiff * 100).toFixed(0)}%. This usually means the data are skewed or have outliers. The bootstrap CI is robust to both; the t-based CI may be misleading.</p>`;
        }

        const html = `
            <div class="sim-result">
                <div class="sim-summary">
                    <h3>Bootstrap result</h3>
                    <div class="stats-grid">
                        <div class="stat-item"><span class="stat-label">n</span><span class="stat-value">${s.n}</span></div>
                        <div class="stat-item"><span class="stat-label">observed mean</span><span class="stat-value">${fmt(s.mean)}</span></div>
                        <div class="stat-item"><span class="stat-label">sample SD</span><span class="stat-value">${fmt(s.sd)}</span></div>
                        <div class="stat-item"><span class="stat-label">${(ciLevel * 100).toFixed(0)}% bootstrap CI (percentile method)</span><span class="stat-value">[${fmt(result.ciLow)}, ${fmt(result.ciHigh)}]</span></div>
                        <div class="stat-item"><span class="stat-label">${(ciLevel * 100).toFixed(0)}% t-based CI</span><span class="stat-value">${tCi ? `[${fmt(tCi.low)}, ${fmt(tCi.high)}]` : '—'}</span></div>
                        <div class="stat-item"><span class="stat-label">resamples</span><span class="stat-value">${result.stats.length.toLocaleString()}</span></div>
                    </div>
                    <p class="sim-runtime">${runtimeMs.toFixed(0)} ms in worker. Each run differs by ~Monte Carlo noise (this is expected, not a bug).</p>
                    <p class="sim-note"><small>This is the <em>percentile method</em> bootstrap CI. More accurate variants (BCa, studentized) exist; for approximately-symmetric distributions the percentile method agrees with them closely.</small></p>
                    <div class="compare-divergence">
                        <h3>Agreement with the formula-based CI</h3>
                        ${agreementHtml}
                    </div>
                </div>
                <div class="sim-plot">
                    ${svgHistogram({
                        stats: result.stats,
                        observed: result.observed,
                        ciLow: result.ciLow,
                        ciHigh: result.ciHigh,
                        titleLeft: 'Bootstrap distribution of the mean',
                        titleRight: `${result.stats.length.toLocaleString()} resamples`,
                    })}
                </div>
            </div>
        `;
        document.getElementById('sim-results').innerHTML = html;
    }

    function renderPermutationResult(dataA, dataB, result, runtimeMs) {
        const sA = summaryStats(dataA);
        const sB = summaryStats(dataB);
        const seWelch = Math.sqrt((sA.sd * sA.sd) / sA.n + (sB.sd * sB.sd) / sB.n);
        const tStat = (sA.mean - sB.mean) / seWelch;
        const dfWelch = Math.pow((sA.sd * sA.sd) / sA.n + (sB.sd * sB.sd) / sB.n, 2) /
            (Math.pow((sA.sd * sA.sd) / sA.n, 2) / (sA.n - 1) + Math.pow((sB.sd * sB.sd) / sB.n, 2) / (sB.n - 1));
        const pFormula = 2 * (1 - jStat.studentt.cdf(Math.abs(tStat), dfWelch));

        const permP = result.pTwoTailed;
        const diff = Math.abs(permP - pFormula);
        // Heuristic threshold: 30% relative difference for p > 0.01, absolute
        // difference otherwise. Not derived from a published criterion; it's a
        // rough "is the divergence worth talking about in class?" gate.
        const relDiff = pFormula > 0.01 ? diff / pFormula : diff;
        const agrees = relDiff < 0.30;

        const html = `
            <div class="sim-result">
                <div class="sim-summary">
                    <h3>Permutation result</h3>
                    <div class="stats-grid">
                        <div class="stat-item"><span class="stat-label">Group A (n, mean)</span><span class="stat-value">${sA.n}, ${fmt(sA.mean)}</span></div>
                        <div class="stat-item"><span class="stat-label">Group B (n, mean)</span><span class="stat-value">${sB.n}, ${fmt(sB.mean)}</span></div>
                        <div class="stat-item"><span class="stat-label">observed difference</span><span class="stat-value">${fmt(result.observed)}</span></div>
                        <div class="stat-item"><span class="stat-label">permutation p (two-tailed)</span><span class="stat-value">${fmt(permP, 4)}</span></div>
                        <div class="stat-item"><span class="stat-label">Welch's t p (formula)</span><span class="stat-value">${fmt(pFormula, 4)}</span></div>
                        <div class="stat-item"><span class="stat-label">resamples</span><span class="stat-value">${result.stats.length.toLocaleString()}</span></div>
                    </div>
                    <p class="sim-runtime">${runtimeMs.toFixed(0)} ms in worker.</p>
                    <div class="compare-divergence">
                        <h3>Agreement between permutation and t-test</h3>
                        ${agrees
                            ? `<p>&check; Permutation p and Welch's t p agree within 30%. Either can be reported.</p>`
                            : `<p>&#9888; Permutation p = ${fmt(permP, 4)} vs Welch's t p = ${fmt(pFormula, 4)}. The tests disagree &mdash; check whether your data are strongly skewed or have outliers; the permutation p-value is robust to both.</p>`}
                    </div>
                </div>
                <div class="sim-plot">
                    ${svgHistogram({
                        stats: result.stats,
                        observed: result.observed,
                        titleLeft: 'Null distribution of mean difference under H₀',
                        titleRight: `${result.stats.length.toLocaleString()} shuffles`,
                    })}
                </div>
            </div>
        `;
        document.getElementById('sim-results').innerHTML = html;
    }

    function updateModeUi() {
        const mode = document.querySelector('input[name="sim-mode"]:checked').value;
        document.getElementById('sim-input-b-group').style.display = mode === 'permutation' ? '' : 'none';
        document.getElementById('sim-ci').parentElement.style.display = mode === 'bootstrap' ? '' : 'none';
    }

    function loadExampleA() {
        document.getElementById('sim-data-a').value =
            '96.4, 108.2, 101.5, 89.3, 112.7, 99.8, 105.1, 93.6, 102.4, 110.9, 97.2, 108.8, 95.1, 103.7, 91.5, 106.3, 100.4, 113.5, 88.2, 104.8, 99.1, 107.0, 94.7, 111.3, 102.9, 98.5, 105.6, 90.8, 109.4, 96.8';
        showNotification('Loaded example A: roughly N(100, 7), n=30', 'info');
    }

    function loadExampleB() {
        document.getElementById('sim-data-b').value =
            '112.3, 104.8, 119.5, 98.7, 115.2, 109.6, 121.0, 103.4, 117.8, 106.1, 124.5, 100.9, 114.2, 108.7, 126.3, 111.5, 122.8, 105.2, 119.0, 113.6, 116.4, 110.1, 123.5, 107.9, 118.7, 102.3, 120.8, 109.5, 115.7, 104.3';
        showNotification('Loaded example B: roughly N(113, 7), n=30', 'info');
    }

    function hydrateFromDataset() {
        try {
            const raw = sessionStorage.getItem('ZtChi.datasetHandoff');
            if (!raw) return;
            const p = JSON.parse(raw);
            if (!p || p.calculator !== 'simulate') return;
            sessionStorage.removeItem('ZtChi.datasetHandoff');
            if (p.mode) {
                const r = document.querySelector(`input[name="sim-mode"][value="${p.mode}"]`);
                if (r) { r.checked = true; updateModeUi(); }
            }
            if (p.dataA) document.getElementById('sim-data-a').value = p.dataA;
            if (p.dataB) document.getElementById('sim-data-b').value = p.dataB;
            if (p.iterations != null) document.getElementById('sim-iterations').value = p.iterations;
            if (p.ciLevel != null) document.getElementById('sim-ci').value = p.ciLevel;
            if (p.datasetName) {
                showNotification(`Loaded dataset: ${p.datasetName}`, 'info', { duration: 4000 });
                if (window.ZtChi.datasetBanner) window.ZtChi.datasetBanner.render(p);
            }
        } catch (_) { /* quiet */ }
    }

    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('input[name="sim-mode"]').forEach((el) => el.addEventListener('change', updateModeUi));
        updateModeUi();
        document.getElementById('sim-example-a').addEventListener('click', loadExampleA);
        document.getElementById('sim-example-b').addEventListener('click', loadExampleB);
        document.getElementById('sim-run-btn').addEventListener('click', () => {
            try {
                const mode = document.querySelector('input[name="sim-mode"]:checked').value;
                if (mode === 'bootstrap') runBootstrap();
                else runPermutation();
            } catch (err) {
                showNotification(err.message, 'error', { duration: 5000 });
            }
        });
        hydrateFromDataset();
    });
})();
