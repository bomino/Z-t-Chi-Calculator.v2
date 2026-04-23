/**
 * Predict-Then-Reveal pedagogy.
 * Before revealing a result, prompts the student to commit to a prediction.
 *
 * Research basis: the "pretesting effect" — unsuccessful retrieval attempts
 * before studying enhance subsequent learning. Primary references:
 *   - Kornell, N., Hays, M. J., & Bjork, R. A. (2009). Unsuccessful retrieval
 *     attempts enhance subsequent learning. J. Exp. Psychol. LMC, 35(4), 989–998.
 *   - Richland, L. E., Kornell, N., & Kao, L. S. (2009). The pretesting effect:
 *     Do unsuccessful retrieval attempts enhance learning? J. Exp. Psychol.
 *     Applied, 15(3), 243–257.
 *   - Roediger, H. L., & Karpicke, J. D. (2006). Test-enhanced learning: Taking
 *     memory tests improves long-term retention. Psychol. Sci., 17(3), 249–255.
 *
 * Off by default. Users enable via the Learning Mode checkbox.
 * Preference persists in localStorage.
 *
 * Integration:
 *   document.getElementById('calc-btn').addEventListener('click', () => {
 *     ZtChi.predict.prompt('z', runCalculation);  // runs callback after prediction (or immediately if off)
 *   });
 *   // ...later, after the calculation knows its verdict:
 *   ZtChi.predict.reveal('z', rejectedH0 ? 'reject' : 'fail-to-reject');
 */
(function () {
    'use strict';

    const ZtChi = window.ZtChi || (window.ZtChi = {});
    const LS_KEY = 'ZtChi.learningMode';
    const pending = Object.create(null);

    function isEnabled() {
        try { return localStorage.getItem(LS_KEY) === '1'; } catch (_) { return false; }
    }

    function setEnabled(v) {
        try { localStorage.setItem(LS_KEY, v ? '1' : '0'); } catch (_) { /* noop */ }
        renderToggles();
    }

    function testLabel(testType) {
        return ({ z: 'Z-test', t: 't-test', chi: 'chi-square test' })[testType] || testType;
    }

    function buildDialog(testType) {
        const dialog = document.createElement('dialog');
        dialog.className = 'predict-dialog';
        dialog.setAttribute('aria-label', `Prediction for ${testLabel(testType)}`);
        dialog.innerHTML = `
            <form method="dialog" class="predict-form">
                <h3>Before you see the result</h3>
                <p>Commit to a prediction. You'll see the actual result after you choose.</p>
                <p class="predict-question">Do you expect this ${testLabel(testType)} to <strong>reject</strong> or <strong>fail to reject</strong> H<sub>0</sub>?</p>
                <div class="predict-choices">
                    <button type="button" class="primary-button" data-predict="reject">Reject H&#8320;</button>
                    <button type="button" class="secondary-button" data-predict="fail-to-reject">Fail to reject H&#8320;</button>
                    <button type="button" class="action-button" data-predict="unsure">Not sure &mdash; reveal anyway</button>
                </div>
                <p class="predict-footnote">Why we ask: committing to a prediction before seeing feedback improves learning (the <em>pretesting effect</em>; Kornell, Hays &amp; Bjork, 2009; Richland, Kornell &amp; Kao, 2009).</p>
            </form>
        `;
        document.body.appendChild(dialog);
        return dialog;
    }

    function showPrompt(testType) {
        return new Promise((resolve) => {
            const dialog = buildDialog(testType);
            const handler = (e) => {
                const btn = e.target.closest('[data-predict]');
                if (!btn) return;
                const choice = btn.getAttribute('data-predict');
                dialog.removeEventListener('click', handler);
                if (typeof dialog.close === 'function') dialog.close();
                if (dialog.parentNode) dialog.parentNode.removeChild(dialog);
                resolve(choice);
            };
            dialog.addEventListener('click', handler);
            if (typeof dialog.showModal === 'function') {
                dialog.showModal();
            } else {
                // Fallback for older browsers — render inline
                dialog.setAttribute('open', '');
            }
        });
    }

    function prompt(testType, runFn) {
        if (!isEnabled()) { runFn(); return; }
        showPrompt(testType).then((choice) => {
            if (choice !== 'unsure') pending[testType] = choice;
            runFn();
        });
    }

    function buildRevealHtml(testType, predicted, actual) {
        if (!predicted || predicted === 'unsure') return '';
        const matched = predicted === actual;
        const label = { 'reject': 'Reject H₀', 'fail-to-reject': 'Fail to reject H₀' };
        const cls = matched ? 'predict-reveal matched' : 'predict-reveal mismatched';
        const headline = matched
            ? 'Your prediction matched the result.'
            : 'Your prediction differed from the result.';
        const detail = matched
            ? 'Nice — use this chance to articulate <em>why</em> the evidence pointed this way.'
            : 'Worth pausing here: what in the data pointed the other direction than you expected?';
        return `
            <div class="${cls} no-print" role="status">
                <p><strong>${headline}</strong></p>
                <p>You predicted: <strong>${label[predicted] || predicted}</strong>. The test said: <strong>${label[actual] || actual}</strong>.</p>
                <p class="predict-prompt">${detail}</p>
            </div>
        `;
    }

    function reveal(testType, actual, targetSelector) {
        const predicted = pending[testType];
        delete pending[testType];
        if (!predicted) return;
        const html = buildRevealHtml(testType, predicted, actual);
        if (!html) return;
        const host = targetSelector
            ? document.querySelector(targetSelector)
            : document.getElementById('results') || document.querySelector('main');
        if (!host) return;
        const wrap = document.createElement('div');
        wrap.innerHTML = html;
        host.insertBefore(wrap.firstElementChild, host.firstChild);
    }

    /**
     * Render a persistent Learning Mode toggle into a container.
     */
    function renderToggle(container) {
        if (!container) return;
        container.classList.add('learning-mode-toggle');
        const checked = isEnabled() ? 'checked' : '';
        container.innerHTML = `
            <label class="learning-mode-switch">
                <input type="checkbox" data-learning-toggle ${checked}>
                <span>Learning Mode (predict before you see the result)</span>
            </label>
        `;
        const input = container.querySelector('[data-learning-toggle]');
        if (input) input.addEventListener('change', (e) => setEnabled(e.target.checked));
    }

    function renderToggles() {
        document.querySelectorAll('[data-ztchi-learning-toggle]').forEach(renderToggle);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', renderToggles);
    } else {
        renderToggles();
    }

    ZtChi.predict = {
        isEnabled,
        setEnabled,
        prompt,
        reveal,
        renderToggle,
    };
})();
