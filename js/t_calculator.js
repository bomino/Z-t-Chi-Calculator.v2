const { showNotification, oneSampleT, pairedT, welchT } = window.ZtChi;

document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('input[name="t-mode"]').forEach((el) =>
        el.addEventListener('change', updateModePanels));
    updateModePanels();

    document.getElementById('calculate-button').addEventListener('click', () => {
        if (window.ZtChi && window.ZtChi.predict) {
            window.ZtChi.predict.prompt('t', calculateT);
        } else {
            calculateT();
        }
    });
    document.getElementById('reset-button').addEventListener('click', resetForm);

    // Check sessionStorage for a dataset handoff (from datasets.html)
    hydrateFromDataset();

    calculateT();
});

function updateModePanels() {
    const mode = currentMode();
    ['stat', 'one-sample', 'paired', 'welch'].forEach((m) => {
        const el = document.getElementById('t-mode-' + m);
        if (el) el.style.display = (m === mode) ? '' : 'none';
    });
}

function currentMode() {
    const checked = document.querySelector('input[name="t-mode"]:checked');
    return checked ? checked.value : 'stat';
}

function parseData(raw) {
    if (!raw) return [];
    return raw.split(/[\s,]+/).map((t) => t.trim()).filter(Boolean)
        .map(Number).filter(Number.isFinite);
}

function calculateT() {
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) loadingIndicator.style.display = 'flex';

    try {
        const alpha = parseFloat(document.getElementById('alpha').value);
        if (isNaN(alpha) || alpha <= 0 || alpha >= 1) {
            throw new Error('Please enter a valid significance level strictly between 0 and 1.');
        }
        const conf = 1 - alpha;
        const mode = currentMode();

        let ctx;
        if (mode === 'stat') {
            const df = Number(document.getElementById('df').value);
            const tStat = parseFloat(document.getElementById('t-stat').value);
            if (!Number.isFinite(df) || !Number.isInteger(df) || df < 1) {
                throw new Error('Degrees of freedom must be a positive whole number.');
            }
            if (isNaN(tStat)) throw new Error('Please enter a valid t statistic.');
            const leftTailP = jStat.studentt.cdf(tStat, df);
            const rightTailP = 1 - leftTailP;
            const twoTailP = 2 * Math.min(leftTailP, rightTailP);
            ctx = {
                mode, t: tStat, df, alpha,
                leftTailP, rightTailP, twoTailP,
                leftCritical: jStat.studentt.inv(alpha, df),
                rightCritical: jStat.studentt.inv(1 - alpha, df),
                twoTailCritical: jStat.studentt.inv(1 - alpha / 2, df),
            };
        } else if (mode === 'one-sample') {
            const xs = parseData(document.getElementById('t-data-one').value);
            const mu0 = parseFloat(document.getElementById('t-mu0').value);
            if (!Number.isFinite(mu0)) throw new Error('μ₀ must be a number.');
            const r = oneSampleT(xs, mu0, conf);
            ctx = { mode, alpha, ...r };
        } else if (mode === 'paired') {
            const xs = parseData(document.getElementById('t-data-paired-a').value);
            const ys = parseData(document.getElementById('t-data-paired-b').value);
            const r = pairedT(xs, ys, conf);
            ctx = { mode, alpha, ...r };
        } else if (mode === 'welch') {
            const xs = parseData(document.getElementById('t-data-welch-a').value);
            const ys = parseData(document.getElementById('t-data-welch-b').value);
            const r = welchT(xs, ys, conf);
            ctx = { mode, alpha, ...r };
        }

        renderOutputs(ctx);
        renderPostResult('t', ctx);

        if (window.ZtChi && window.ZtChi.predict && window.ZtChi.predict.reveal) {
            window.ZtChi.predict.reveal('t', ctx.twoTailP < alpha ? 'reject' : 'fail-to-reject', '#results');
        }
    } catch (error) {
        showNotification(error.message, 'error', { duration: 5000 });
    } finally {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
}

function fmt(v, d = 4) { return Number.isFinite(v) ? v.toFixed(d) : '-'; }

function renderOutputs(ctx) {
    const alpha = ctx.alpha;
    document.getElementById('p-left').textContent = fmt(ctx.leftTailP, 8);
    document.getElementById('p-right').textContent = fmt(ctx.rightTailP, 8);
    document.getElementById('p-two').textContent = fmt(ctx.twoTailP, 8);

    // For raw-data modes, critical values come from the computed df via jStat.
    const df = ctx.df;
    const leftCrit = ctx.leftCritical != null ? ctx.leftCritical : jStat.studentt.inv(alpha, df);
    const rightCrit = ctx.rightCritical != null ? ctx.rightCritical : jStat.studentt.inv(1 - alpha, df);
    const twoCrit = ctx.twoTailCritical != null ? ctx.twoTailCritical : (ctx.tCrit != null ? ctx.tCrit : jStat.studentt.inv(1 - alpha / 2, df));
    document.getElementById('t-crit-left').textContent = fmt(leftCrit, 8);
    document.getElementById('t-crit-right').textContent = fmt(rightCrit, 8);
    document.getElementById('t-crit-two').textContent = `±${Math.abs(twoCrit).toFixed(8)}`;

    document.getElementById('summary-alpha').textContent = alpha.toFixed(4);
    document.getElementById('summary-df').textContent = Number.isInteger(df) ? df : fmt(df, 2);
    const tForDisplay = ctx.t != null ? ctx.t : NaN;
    document.getElementById('summary-t-stat').textContent = fmt(tForDisplay);

    const verdict = (p) => p < alpha ? 'Reject the null hypothesis' : 'Fail to reject the null hypothesis';
    let conclusion =
        'Based on the analysis:<br>' +
        `&bull; Two-tailed test: ${verdict(ctx.twoTailP)}<br>` +
        `&bull; Left-tailed test: ${verdict(ctx.leftTailP)}<br>` +
        `&bull; Right-tailed test: ${verdict(ctx.rightTailP)}`;

    // CI-first enrichment: for raw-data modes, surface the CI before the p-values message.
    if (ctx.mode === 'one-sample') {
        conclusion =
            `<p class="ci-banner"><strong>${Math.round(ctx.conf * 100)}% CI for the mean:</strong> [${fmt(ctx.ciLow)}, ${fmt(ctx.ciHigh)}] &mdash; ` +
            `${(ctx.ciLow > ctx.mu0 || ctx.ciHigh < ctx.mu0) ? `excludes μ<sub>0</sub> = ${ctx.mu0} &#8594; reject H<sub>0</sub>` : `includes μ<sub>0</sub> = ${ctx.mu0} &#8594; fail to reject H<sub>0</sub>`}.</p>` +
            `<p>Sample: n = ${ctx.n}, x̄ = ${fmt(ctx.mean)}, s = ${fmt(ctx.sd)}, SE = ${fmt(ctx.se)}.</p>` +
            conclusion;
    } else if (ctx.mode === 'paired') {
        conclusion =
            `<p class="ci-banner"><strong>${Math.round(ctx.conf * 100)}% CI for mean difference:</strong> [${fmt(ctx.ciLow)}, ${fmt(ctx.ciHigh)}] &mdash; ` +
            `${(ctx.ciLow > 0 || ctx.ciHigh < 0) ? 'excludes 0 &#8594; reject H<sub>0</sub>' : 'includes 0 &#8594; fail to reject H<sub>0</sub>'}.</p>` +
            `<p>Pairs: n = ${ctx.n}, mean difference = ${fmt(ctx.meanDiff)}, SD of differences = ${fmt(ctx.sd)}, SE = ${fmt(ctx.se)}.</p>` +
            conclusion;
    } else if (ctx.mode === 'welch') {
        conclusion =
            `<p class="ci-banner"><strong>${Math.round(ctx.conf * 100)}% CI for difference in means (A − B):</strong> [${fmt(ctx.ciLow)}, ${fmt(ctx.ciHigh)}] &mdash; ` +
            `${(ctx.ciLow > 0 || ctx.ciHigh < 0) ? 'excludes 0 &#8594; reject H<sub>0</sub>' : 'includes 0 &#8594; fail to reject H<sub>0</sub>'}.</p>` +
            `<p>Group A: n = ${ctx.nA}, mean = ${fmt(ctx.meanA)}, SD = ${fmt(ctx.sdA)}. Group B: n = ${ctx.nB}, mean = ${fmt(ctx.meanB)}, SD = ${fmt(ctx.sdB)}. Welch df = ${fmt(ctx.df, 2)}.</p>` +
            conclusion;
    }

    document.getElementById('test-conclusion').innerHTML = conclusion;
}

function renderPostResult(testType, ctx) {
    const { reports, showWork, checks, threeLevel } = window.ZtChi || {};

    const parts = [];
    if (threeLevel && threeLevel.render) parts.push(threeLevel.render(testType, ctx));
    if (reports && reports.buildReportButtons) parts.push(reports.buildReportButtons(testType));
    if (showWork && showWork.render) parts.push(showWork.render(testType, ctx));
    if (checks && checks.renderFor) parts.push(checks.renderFor(testType));
    if (parts.length === 0) return;

    const existing = document.getElementById('post-result');
    if (existing) existing.remove();

    const container = document.createElement('div');
    container.id = 'post-result';
    container.className = 'post-result';
    container.innerHTML = parts.join('\n');

    const host = document.getElementById('results');
    if (host && host.parentNode) {
        host.parentNode.insertBefore(container, host.nextSibling);
    }

    if (reports && reports.setLatestContext) reports.setLatestContext(testType, ctx);
    if (showWork && showWork.typeset) showWork.typeset(container);
}

function hydrateFromDataset() {
    try {
        const raw = sessionStorage.getItem('ZtChi.datasetHandoff');
        if (!raw) return;
        const payload = JSON.parse(raw);
        if (!payload || payload.calculator !== 't') return;
        sessionStorage.removeItem('ZtChi.datasetHandoff');
        // Accepted fields: mode, alpha, mu0, dataA, dataB, t, df
        if (payload.alpha != null) document.getElementById('alpha').value = String(payload.alpha);
        if (payload.mode) {
            const r = document.querySelector(`input[name="t-mode"][value="${payload.mode}"]`);
            if (r) { r.checked = true; updateModePanels(); }
        }
        if (payload.mu0 != null) document.getElementById('t-mu0').value = String(payload.mu0);
        if (payload.dataA) document.getElementById(`t-data-${payload.mode === 'welch' ? 'welch' : payload.mode === 'paired' ? 'paired' : 'one'}${payload.mode === 'paired' || payload.mode === 'welch' ? '-a' : ''}`).value = payload.dataA;
        if (payload.dataB) {
            if (payload.mode === 'paired') document.getElementById('t-data-paired-b').value = payload.dataB;
            if (payload.mode === 'welch') document.getElementById('t-data-welch-b').value = payload.dataB;
        }
        if (payload.t != null) document.getElementById('t-stat').value = String(payload.t);
        if (payload.df != null) document.getElementById('df').value = String(payload.df);
        if (payload.datasetName) {
            showNotification(`Loaded dataset: ${payload.datasetName}`, 'info', { duration: 4000 });
            if (window.ZtChi.datasetBanner) window.ZtChi.datasetBanner.render(payload);
        }
    } catch (_) { /* quiet */ }
}

function resetForm() {
    if (!confirm('Are you sure you want to reset all values?')) return;

    document.getElementById('alpha').value = '0.05';
    document.getElementById('df').value = '2';
    document.getElementById('t-stat').value = '1.92';
    const r = document.querySelector('input[name="t-mode"][value="stat"]');
    if (r) { r.checked = true; updateModePanels(); }

    ['p-left', 't-crit-left', 'p-right', 't-crit-right', 'p-two', 't-crit-two'].forEach((id) => {
        document.getElementById(id).textContent = '-';
    });
    document.getElementById('summary-alpha').textContent = '-';
    document.getElementById('summary-df').textContent = '-';
    document.getElementById('summary-t-stat').textContent = '-';
    document.getElementById('test-conclusion').textContent = 'Enter values and click Calculate to see results.';
}
