/**
 * Epidemiology 2x2 measures page.
 * All math lives in ZtChi.epidemiology (common.js). This file is the UI.
 */
(function () {
    'use strict';

    const { escapeHtml, parsePositiveInt, showNotification, epidemiology } = window.ZtChi;

    function fmt(n, d = 3) { return Number.isFinite(n) ? n.toFixed(d) : '—'; }
    function pct(n, d = 1) { return Number.isFinite(n) ? (n * 100).toFixed(d) + '%' : '—'; }
    function ciFmt(low, high, d = 3, asPct = false) {
        if (!Number.isFinite(low) || !Number.isFinite(high)) return '—';
        const f = asPct ? pct : (x) => fmt(x, d);
        return `[${f(low)}, ${f(high)}]`;
    }

    function readInputs() {
        const a = parsePositiveInt(document.getElementById('epi-a').value, 'Row 1 / Col 1');
        const b = parsePositiveInt(document.getElementById('epi-b').value, 'Row 1 / Col 2');
        const c = parsePositiveInt(document.getElementById('epi-c').value, 'Row 2 / Col 1');
        const d = parsePositiveInt(document.getElementById('epi-d').value, 'Row 2 / Col 2');
        const conf = parseFloat(document.getElementById('epi-conf').value);
        if (!Number.isFinite(conf) || conf <= 0 || conf >= 1) {
            throw new Error('Confidence level must be strictly between 0 and 1.');
        }
        return { a, b, c, d, conf };
    }

    function updateTotals() {
        try {
            const a = parseInt(document.getElementById('epi-a').value, 10) || 0;
            const b = parseInt(document.getElementById('epi-b').value, 10) || 0;
            const c = parseInt(document.getElementById('epi-c').value, 10) || 0;
            const d = parseInt(document.getElementById('epi-d').value, 10) || 0;
            document.getElementById('epi-r1-total').textContent = a + b;
            document.getElementById('epi-r2-total').textContent = c + d;
            document.getElementById('epi-c1-total').textContent = a + c;
            document.getElementById('epi-c2-total').textContent = b + d;
            document.getElementById('epi-grand-total').innerHTML = '<strong>' + (a + b + c + d) + '</strong>';
        } catch (_) { /* quiet */ }
    }

    function applyLabelsForMode() {
        const mode = document.querySelector('input[name="epi-mode"]:checked').value;
        if (mode === 'diagnostic') {
            document.getElementById('epi-col-0-hdr').textContent = 'Disease +';
            document.getElementById('epi-col-1-hdr').innerHTML = 'Disease &minus;';
            document.getElementById('epi-row-0-lbl').innerHTML = '<strong>Test +</strong>';
            document.getElementById('epi-row-1-lbl').innerHTML = '<strong>Test &minus;</strong>';
        } else {
            document.getElementById('epi-col-0-hdr').textContent = 'Outcome +';
            document.getElementById('epi-col-1-hdr').innerHTML = 'Outcome &minus;';
            document.getElementById('epi-row-0-lbl').innerHTML = '<strong>Exposed</strong>';
            document.getElementById('epi-row-1-lbl').innerHTML = '<strong>Unexposed</strong>';
        }
    }

    function renderDiagnostic(r) {
        const confPct = (r.conf * 100).toFixed(0);
        return `
            <div class="epi-grid">
                <div class="epi-card">
                    <h4>Sensitivity</h4>
                    <p>Probability a diseased person tests positive.</p>
                    <p class="epi-value">${pct(r.sens.p)} <small>(${confPct}% CI ${ciFmt(r.sens.low, r.sens.high, 3, true)})</small></p>
                    <p class="epi-note">a / (a + c) = ${r.a} / ${r.a + r.c}</p>
                </div>
                <div class="epi-card">
                    <h4>Specificity</h4>
                    <p>Probability a non-diseased person tests negative.</p>
                    <p class="epi-value">${pct(r.spec.p)} <small>(${confPct}% CI ${ciFmt(r.spec.low, r.spec.high, 3, true)})</small></p>
                    <p class="epi-note">d / (b + d) = ${r.d} / ${r.b + r.d}</p>
                </div>
                <div class="epi-card">
                    <h4>Positive Predictive Value (PPV)</h4>
                    <p>Probability a test-positive person actually has the disease.</p>
                    <p class="epi-value">${pct(r.ppv.p)} <small>(${confPct}% CI ${ciFmt(r.ppv.low, r.ppv.high, 3, true)})</small></p>
                    <p class="epi-note">a / (a + b) = ${r.a} / ${r.a + r.b}. <em>Depends on prevalence.</em></p>
                </div>
                <div class="epi-card">
                    <h4>Negative Predictive Value (NPV)</h4>
                    <p>Probability a test-negative person is truly disease-free.</p>
                    <p class="epi-value">${pct(r.npv.p)} <small>(${confPct}% CI ${ciFmt(r.npv.low, r.npv.high, 3, true)})</small></p>
                    <p class="epi-note">d / (c + d) = ${r.d} / ${r.c + r.d}. <em>Depends on prevalence.</em></p>
                </div>
                <div class="epi-card">
                    <h4>Prevalence</h4>
                    <p>Proportion of the sample with the disease.</p>
                    <p class="epi-value">${pct(r.prev.p)} <small>(${confPct}% CI ${ciFmt(r.prev.low, r.prev.high, 3, true)})</small></p>
                    <p class="epi-note">(a + c) / N = ${r.a + r.c} / ${r.n}</p>
                </div>
                <div class="epi-card">
                    <h4>Likelihood ratios</h4>
                    <p>Prevalence-independent test performance.</p>
                    <p class="epi-value">LR+ = ${fmt(r.lrPos)}</p>
                    <p class="epi-value">LR− = ${fmt(r.lrNeg)}</p>
                    <p class="epi-note">Rules of thumb (Jaeschke, Guyatt &amp; Sackett, 1994, <em>JAMA</em>): LR+ &gt; 10 = strong, 5-10 = moderate, 2-5 = weak. LR− &lt; 0.1 = strong, 0.1-0.2 = moderate, 0.2-0.5 = weak.</p>
                </div>
            </div>
        `;
    }

    function renderCohort(r) {
        const confPct = (r.conf * 100).toFixed(0);
        const nntLabel = Number.isFinite(r.nnt) ? fmt(r.nnt, 2) : '∞';
        // NNT/NNH labeling depends on which row carries more events, NOT on
        // which row the user put first. Be explicit so swapping row order
        // doesn't invert the pedagogical message.
        const risk1 = r.a / (r.a + r.b);
        const risk2 = r.c / (r.c + r.d);
        const nntNote = Math.abs(r.riskDiff) < 1e-12
            ? 'Risks are equal in the two groups &mdash; NNT is undefined.'
            : r.riskDiff < 0
                ? `Row 1 (top) has the lower risk (${pct(risk1)} vs ${pct(risk2)}). Interpreted as a <strong>number needed to treat</strong> (NNT): ~${nntLabel} people moved from the Row 2 condition to the Row 1 condition to prevent one event.`
                : `Row 1 (top) has the higher risk (${pct(risk1)} vs ${pct(risk2)}). Interpreted as a <strong>number needed to harm</strong> (NNH): ~${nntLabel} people moved from the Row 2 condition to the Row 1 condition to cause one extra event.`;
        return `
            <div class="epi-grid">
                <div class="epi-card">
                    <h4>Risk in exposed</h4>
                    <p class="epi-value">${pct(r.a / (r.a + r.b))}</p>
                    <p class="epi-note">a / (a + b) = ${r.a} / ${r.a + r.b}</p>
                </div>
                <div class="epi-card">
                    <h4>Risk in unexposed</h4>
                    <p class="epi-value">${pct(r.c / (r.c + r.d))}</p>
                    <p class="epi-note">c / (c + d) = ${r.c} / ${r.c + r.d}</p>
                </div>
                <div class="epi-card">
                    <h4>Risk ratio (RR)</h4>
                    <p>Ratio of risks: exposed ÷ unexposed.</p>
                    <p class="epi-value">${fmt(r.rr)} <small>(${confPct}% CI ${ciFmt(r.rrLow, r.rrHigh)})</small></p>
                    <p class="epi-note">Log-Wald CI. RR > 1 = exposure increases risk.</p>
                </div>
                <div class="epi-card">
                    <h4>Odds ratio (OR)</h4>
                    <p>Ratio of odds: exposed ÷ unexposed.</p>
                    <p class="epi-value">${fmt(r.or)} <small>(${confPct}% CI ${ciFmt(r.orLow, r.orHigh)})</small></p>
                    <p class="epi-note">(a·d)/(b·c). OR and RR diverge as risk gets large.</p>
                </div>
                <div class="epi-card">
                    <h4>Absolute risk difference</h4>
                    <p class="epi-value">${fmt(r.riskDiff, 4)}</p>
                    <p class="epi-note">risk(exposed) − risk(unexposed)</p>
                </div>
                <div class="epi-card">
                    <h4>Number needed to ${r.riskDiff < 0 ? 'treat (NNT)' : r.riskDiff > 0 ? 'harm (NNH)' : 'treat / harm'}</h4>
                    <p class="epi-value">${nntLabel}</p>
                    <p class="epi-note">${nntNote}</p>
                </div>
            </div>
        `;
    }

    function render() {
        try {
            const inputs = readInputs();
            const r = epidemiology(inputs.a, inputs.b, inputs.c, inputs.d, inputs.conf);
            const mode = document.querySelector('input[name="epi-mode"]:checked').value;
            const html = mode === 'diagnostic' ? renderDiagnostic(r) : renderCohort(r);
            document.getElementById('epi-results').innerHTML = html;
        } catch (err) {
            showNotification(err.message, 'error', { duration: 5000 });
        }
    }

    function loadScreeningExample() {
        // Classic: rare disease (prevalence 0.5%), test with sens 99%, spec 98%
        // Results in PPV around 20% — the "base rate fallacy" teaching case.
        // Need a=sens×prev×N, b=(1-spec)×(1-prev)×N, c=(1-sens)×prev×N, d=spec×(1-prev)×N
        // With prev=0.005, N=10000: diseased=50, healthy=9950
        // a=.99*50=~50 (49 true), c=1; b=.02*9950=~199, d=9751
        document.querySelector('input[name="epi-mode"][value="diagnostic"]').checked = true;
        applyLabelsForMode();
        document.getElementById('epi-a').value = '49';
        document.getElementById('epi-b').value = '199';
        document.getElementById('epi-c').value = '1';
        document.getElementById('epi-d').value = '9751';
        updateTotals();
        showNotification('Loaded screening example: rare disease (0.5% prevalence), sens 99%, spec 98%. Watch the PPV.', 'info');
        render();
    }

    function loadCohortExample() {
        // Framingham-inspired: smoking and CHD. Exposed 1000 smokers, unexposed
        // 1000 nonsmokers. Over follow-up: 84 CHD cases in smokers, 87 in
        // nonsmokers. (Illustrative; not the actual Framingham numbers.)
        // Let's use cleaner teaching values instead: aspirin trial style.
        // Risk in treated = 104/11034 ≈ 0.0094; risk in placebo = 189/11037 ≈ 0.0171
        // Physicians' Health Study (Steering Committee, 1989) simplified.
        document.querySelector('input[name="epi-mode"][value="cohort"]').checked = true;
        applyLabelsForMode();
        document.getElementById('epi-a').value = '104';
        document.getElementById('epi-b').value = '10930';
        document.getElementById('epi-c').value = '189';
        document.getElementById('epi-d').value = '10848';
        updateTotals();
        showNotification('Loaded cohort example: Physicians\' Health Study (aspirin vs placebo, MI outcome). Watch RR, OR, NNT.', 'info');
        render();
    }

    function hydrateFromDataset() {
        try {
            const raw = sessionStorage.getItem('ZtChi.datasetHandoff');
            if (!raw) return;
            const p = JSON.parse(raw);
            if (!p || p.calculator !== 'epi') return;
            sessionStorage.removeItem('ZtChi.datasetHandoff');
            if (p.mode) {
                const r = document.querySelector(`input[name="epi-mode"][value="${p.mode}"]`);
                if (r) { r.checked = true; applyLabelsForMode(); }
            }
            if (p.a != null) document.getElementById('epi-a').value = p.a;
            if (p.b != null) document.getElementById('epi-b').value = p.b;
            if (p.c != null) document.getElementById('epi-c').value = p.c;
            if (p.d != null) document.getElementById('epi-d').value = p.d;
            if (p.conf != null) document.getElementById('epi-conf').value = p.conf;
            updateTotals();
            if (p.datasetName) showNotification(`Loaded dataset: ${p.datasetName}`, 'info', { duration: 4000 });
        } catch (_) { /* quiet */ }
    }

    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('input[name="epi-mode"]').forEach((el) =>
            el.addEventListener('change', () => { applyLabelsForMode(); render(); }));
        ['epi-a', 'epi-b', 'epi-c', 'epi-d'].forEach((id) => {
            document.getElementById(id).addEventListener('input', updateTotals);
        });
        document.getElementById('epi-calculate-btn').addEventListener('click', render);
        document.getElementById('epi-example-screen-btn').addEventListener('click', loadScreeningExample);
        document.getElementById('epi-example-cohort-btn').addEventListener('click', loadCohortExample);
        hydrateFromDataset();
        updateTotals();
        render();
    });
})();
