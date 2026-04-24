/**
 * Instructor builder page glue — wires the DOM controls on instructor.html
 * to the ZtChi.instructor API. Separate file so instructor.js stays
 * reusable headless.
 */
(function () {
    'use strict';

    const ZtChi = window.ZtChi || (window.ZtChi = {});

    const EXAMPLE = {
        title: 'Problem 3 — One-sample t',
        prompt: 'A researcher wants to know whether the mean fasting glucose in a small clinic sample (n = 19) differs from the reference value of 90 mg/dL. The test gives t = 2.31 with df = 18. What is the two-tailed p-value? Report to three decimals.',
        calc: 't',
        inputs: 't-stat = 2.31\ndf = 18\nalpha = 0.05',
        answerField: 'pValue',
        answerValue: 0.033,
        answerTolerance: 0.002,
        feedbackCorrect: 'Correct — the two-tailed p is about 0.033. Now decide whether that is small enough to reject at alpha = 0.05.',
        feedbackIncorrect: 'Check whether you are computing the one-tailed or two-tailed tail area. For df = 18 and |t| = 2.31, the two-tailed value is near 0.033.',
    };

    // Common field IDs per calculator, shown as hints in the builder UI.
    const FIELD_HINTS = {
        z: 'z-to-p, p-to-z, alpha',
        t: 't-stat, df, t-mu0, t-data-one, alpha',
        chi: 'rows, cols, alpha (counts live in dynamically-named inputs)',
        corrections: 'pvalInput, alphaSelect',
        epi: 'tp, fp, fn, tn',
    };

    function wireAnswerFieldSelect(calcSel, fieldSel) {
        function refresh() {
            const calc = calcSel.value;
            const fields = ZtChi.instructor.answerFieldsFor(calc);
            fieldSel.innerHTML = fields.map(
                (f) => `<option value="${f.key}">${f.label}</option>`
            ).join('');
            const hint = document.getElementById('fieldHint');
            if (hint) hint.textContent = `Field IDs for this calculator: ${FIELD_HINTS[calc] || '(see calculator page source)'}`;
        }
        calcSel.addEventListener('change', refresh);
        refresh();
    }

    function parseInputs(raw) {
        const out = {};
        String(raw || '').split(/\r?\n/).forEach((line) => {
            const t = line.trim();
            if (!t) return;
            const eq = t.indexOf('=');
            if (eq < 0) return;
            const key = t.slice(0, eq).trim();
            const value = t.slice(eq + 1).trim();
            if (!key) return;
            out[key] = /^-?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(value) ? Number(value) : value;
        });
        return out;
    }

    function collectSpec() {
        return {
            title: document.getElementById('problemTitle').value.trim(),
            prompt: document.getElementById('problemPrompt').value.trim(),
            calc: document.getElementById('problemCalc').value,
            inputs: parseInputs(document.getElementById('problemInputs').value),
            answer: {
                field: document.getElementById('answerField').value,
                value: Number(document.getElementById('answerValue').value),
                tolerance: Number(document.getElementById('answerTolerance').value) || 0,
            },
            feedback: {
                correct: document.getElementById('feedbackCorrect').value.trim(),
                incorrect: document.getElementById('feedbackIncorrect').value.trim(),
            },
        };
    }

    async function generate() {
        const spec = collectSpec();
        if (!spec.title || !spec.prompt || !Number.isFinite(spec.answer.value)) {
            ZtChi.showNotification('Title, prompt, and expected value are required.', 'warning');
            return;
        }
        const token = ZtChi.instructor.encodeSpec(spec);
        // Sign the wrapped spec (with `v` and `issuedAt` added by encodeSpec) so the
        // student's client, which decodes the token back into that same wrapped shape,
        // reproduces byte-identical JSON when it re-signs for verification.
        const fullSpec = ZtChi.instructor.decodeSpec(token);
        const signed = await ZtChi.instructor.sign(fullSpec);

        const status = document.getElementById('signStatus');
        const out = document.getElementById('outputLink');
        let link;
        if (signed && signed.sig) {
            link = ZtChi.instructor.buildLink(token, signed.sig);
            status.textContent = `Signed with HS256 (${signed.sig.slice(0, 10)}…). Students' clients will verify against the backend.`;
            status.className = 'viz-caption status-signed';
        } else {
            link = ZtChi.instructor.buildLink(token, null);
            status.textContent = 'Backend unreachable — link is unsigned. Fine for practice; not recommended for graded assignments.';
            status.className = 'viz-caption status-unsigned';
        }
        out.value = link;
    }

    function copyLink() {
        const out = document.getElementById('outputLink');
        if (!out.value) {
            ZtChi.showNotification('Generate a link first.', 'info');
            return;
        }
        out.select();
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(out.value).then(
                    () => ZtChi.showNotification('Link copied.', 'success'),
                    () => document.execCommand('copy')
                );
            } else {
                document.execCommand('copy');
                ZtChi.showNotification('Link copied.', 'success');
            }
        } catch (_) { /* no-op */ }
    }

    function openAsStudent() {
        const out = document.getElementById('outputLink');
        if (!out.value) {
            ZtChi.showNotification('Generate a link first.', 'info');
            return;
        }
        window.open(out.value, '_blank');
    }

    function loadExample() {
        document.getElementById('problemTitle').value = EXAMPLE.title;
        document.getElementById('problemPrompt').value = EXAMPLE.prompt;
        const calcSel = document.getElementById('problemCalc');
        calcSel.value = EXAMPLE.calc;
        calcSel.dispatchEvent(new Event('change'));
        document.getElementById('problemInputs').value = EXAMPLE.inputs;
        document.getElementById('answerField').value = EXAMPLE.answerField;
        document.getElementById('answerValue').value = EXAMPLE.answerValue;
        document.getElementById('answerTolerance').value = EXAMPLE.answerTolerance;
        document.getElementById('feedbackCorrect').value = EXAMPLE.feedbackCorrect;
        document.getElementById('feedbackIncorrect').value = EXAMPLE.feedbackIncorrect;
    }

    async function renderBackendStatus() {
        const span = document.querySelector('#backend-status span');
        if (!span || !ZtChi.backend) return;
        try {
            const { enabled, reason } = await ZtChi.backend.ready;
            if (enabled) {
                span.textContent = `online (${ZtChi.backend.url})`;
                span.className = 'status-ok';
            } else if (reason === 'no-url') {
                span.textContent = 'not configured — links will be unsigned';
                span.className = 'status-warn';
            } else {
                span.textContent = `unreachable (${reason}) — links will be unsigned`;
                span.className = 'status-warn';
            }
        } catch (_) {
            span.textContent = 'unreachable — links will be unsigned';
            span.className = 'status-warn';
        }
    }

    function init() {
        if (!ZtChi.instructor) return;
        const calcSel = document.getElementById('problemCalc');
        const fieldSel = document.getElementById('answerField');
        if (calcSel && fieldSel) wireAnswerFieldSelect(calcSel, fieldSel);

        const btnGen = document.getElementById('btnGenerate');
        const btnCopy = document.getElementById('btnCopy');
        const btnOpen = document.getElementById('btnOpen');
        const btnEx = document.getElementById('btnExample');

        if (btnGen) btnGen.addEventListener('click', generate);
        if (btnCopy) btnCopy.addEventListener('click', copyLink);
        if (btnOpen) btnOpen.addEventListener('click', openAsStudent);
        if (btnEx) btnEx.addEventListener('click', loadExample);

        renderBackendStatus();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
