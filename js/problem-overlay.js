/**
 * Student-facing overlay rendered on any calculator page when the URL
 * carries a `?problem=<token>` query param. Reads the spec via
 * ZtChi.instructor.readFromUrl(), shows the prompt in a sticky card,
 * optionally prefills calculator inputs, and renders a "Submit answer"
 * widget that checks the student's value against the instructor-signed
 * expected value.
 */
(function () {
    'use strict';

    const ZtChi = window.ZtChi || (window.ZtChi = {});

    function init() {
        if (!ZtChi.instructor) return;
        const loaded = ZtChi.instructor.readFromUrl();
        if (!loaded) return;

        renderOverlay(loaded);
        prefillInputs(loaded.spec);
        verifyBadgeAsync(loaded);
    }

    function renderOverlay({ spec, token, sig }) {
        if (document.getElementById('problem-overlay')) return;
        const esc = ZtChi.escapeHtml || ((s) => s);

        const fields = ZtChi.instructor.answerFieldsFor(spec.calc);
        const field = fields.find((f) => f.key === spec.answer.field) || fields[0];

        const overlay = document.createElement('div');
        overlay.id = 'problem-overlay';
        overlay.className = 'problem-overlay';
        overlay.innerHTML = `
            <div class="problem-overlay-head">
                <span class="problem-overlay-title">${esc(spec.title || 'Assigned problem')}</span>
                <span class="problem-overlay-badge" id="problem-badge" title="Signature status">checking signature&hellip;</span>
                <button type="button" class="problem-overlay-close" aria-label="Hide problem" id="problem-overlay-close">&times;</button>
            </div>
            <p class="problem-overlay-prompt">${esc(spec.prompt || '')}</p>
            <div class="problem-overlay-answer">
                <label for="problem-answer-input">Your answer for <strong>${esc(field ? field.label : spec.answer.field)}</strong>:</label>
                <input type="number" step="any" id="problem-answer-input" inputmode="decimal" placeholder="e.g. 0.042">
                <button type="button" class="primary-button" id="problem-answer-check">Check</button>
                <span class="problem-overlay-result" id="problem-answer-result" role="status" aria-live="polite"></span>
            </div>
        `;
        document.body.appendChild(overlay);

        document.getElementById('problem-overlay-close').addEventListener('click', () => {
            overlay.classList.add('problem-overlay-hidden');
        });

        document.getElementById('problem-answer-check').addEventListener('click', () => {
            const input = document.getElementById('problem-answer-input');
            const result = document.getElementById('problem-answer-result');
            const val = Number(input.value);
            if (!Number.isFinite(val)) {
                result.className = 'problem-overlay-result incorrect';
                result.textContent = 'Enter a numeric answer.';
                return;
            }
            const ok = ZtChi.instructor.checkAnswer(spec, val);
            if (ok) {
                result.className = 'problem-overlay-result correct';
                result.textContent = (spec.feedback && spec.feedback.correct) || 'Correct!';
            } else {
                result.className = 'problem-overlay-result incorrect';
                const hint = (spec.feedback && spec.feedback.incorrect) || 'Not quite — try again.';
                result.textContent = hint;
            }
        });
    }

    function prefillInputs(spec) {
        const inputs = spec.inputs || {};
        Object.entries(inputs).forEach(([key, value]) => {
            const el = document.getElementById(key);
            if (!el) return;
            if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.tagName === 'SELECT') {
                el.value = value;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    }

    async function verifyBadgeAsync({ spec, sig }) {
        const badge = document.getElementById('problem-badge');
        if (!badge) return;

        if (!sig) {
            badge.textContent = 'unsigned';
            badge.className = 'problem-overlay-badge badge-unsigned';
            badge.title = 'This problem was not signed — integrity cannot be verified. Ask your instructor to re-issue if that is unexpected.';
            return;
        }

        if (!ZtChi.backend || !ZtChi.backend.url) {
            badge.textContent = 'signed (offline)';
            badge.className = 'problem-overlay-badge badge-offline';
            badge.title = 'This problem was signed but the verification server is not configured in this deployment.';
            return;
        }

        try {
            const { enabled } = await ZtChi.backend.ready;
            if (!enabled) {
                badge.textContent = 'signed (offline)';
                badge.className = 'problem-overlay-badge badge-offline';
                badge.title = 'Backend unreachable — integrity cannot be verified right now.';
                return;
            }
            const re = await ZtChi.backend.post('/sign', { payload: spec });
            if (re && re.sig && re.sig === sig) {
                badge.textContent = 'verified';
                badge.className = 'problem-overlay-badge badge-verified';
                badge.title = 'Signature verified against backend.';
            } else {
                badge.textContent = 'signature mismatch';
                badge.className = 'problem-overlay-badge badge-mismatch';
                badge.title = 'The signature does not match the payload. The link may have been modified after issuance.';
            }
        } catch (err) {
            badge.textContent = 'verify failed';
            badge.className = 'problem-overlay-badge badge-offline';
            badge.title = String(err && err.message || err);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
