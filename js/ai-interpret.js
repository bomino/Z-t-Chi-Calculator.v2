/**
 * AI Interpreter.
 *
 * Auto-mounts a small opt-in button on each calculator page. When clicked,
 * the button POSTs a *sanitized* context (only numeric values and short
 * identifiers) to the Worker's /ai endpoint, which in turn calls Claude
 * with a constrained system prompt (see backend/worker.js).
 *
 * Only numeric values are sent — never raw student data or free text.
 *
 * Usage from a calculator module:
 *   ZtChi.ai.mount(document.getElementById('probabilityResults'), {
 *       test: 'z',
 *       statistic: 1.96,
 *       pValue: 0.025,
 *       twoTailed: 0.05,
 *       alpha: 0.05,
 *       method: 'one-sample Z',
 *   });
 *
 * If the backend is not reachable the mount is a no-op.
 */
(function () {
    'use strict';

    const ZtChi = window.ZtChi || (window.ZtChi = {});

    async function isEnabled() {
        if (!ZtChi.backend) return false;
        try {
            const { enabled } = await ZtChi.backend.ready;
            return enabled;
        } catch (_) {
            return false;
        }
    }

    function mount(container, ctx) {
        if (!container || !ctx) return;
        // Remove any prior mount in the container so a recompute doesn't stack buttons.
        const existing = container.querySelector('.ai-interpret-block');
        if (existing) existing.remove();

        const block = document.createElement('div');
        block.className = 'ai-interpret-block';
        block.innerHTML = `
            <button type="button" class="ai-interpret-button" aria-expanded="false">
                <span aria-hidden="true">✨</span> Explain in plain English (AI)
            </button>
            <div class="ai-interpret-body" hidden></div>
        `;

        const button = block.querySelector('.ai-interpret-button');
        const body = block.querySelector('.ai-interpret-body');

        isEnabled().then((ok) => {
            if (!ok) {
                block.classList.add('ai-interpret-disabled');
                button.disabled = true;
                button.title = 'AI interpreter is optional; no backend is configured in this deployment.';
            }
        });

        button.addEventListener('click', async () => {
            if (button.disabled) return;
            const open = body.hidden === false;
            if (open) {
                body.hidden = true;
                button.setAttribute('aria-expanded', 'false');
                return;
            }
            body.hidden = false;
            button.setAttribute('aria-expanded', 'true');
            body.innerHTML = '<p class="ai-interpret-loading">Asking the model&hellip;</p>';
            try {
                const { text, note } = await ZtChi.backend.post('/ai', ctx);
                body.innerHTML = renderResponse(text, note);
            } catch (err) {
                body.innerHTML = renderError(err);
            }
        });

        container.appendChild(block);
    }

    function renderResponse(text, note) {
        const esc = ZtChi.escapeHtml || ((s) => s);
        const paragraphs = String(text || '')
            .split(/\n{2,}/)
            .map((p) => `<p>${esc(p.trim())}</p>`)
            .join('');
        return `
            <div class="ai-interpret-result" role="region" aria-label="AI interpretation">
                <div class="ai-interpret-badge">AI-generated — verify against the Show-Work panel.</div>
                ${paragraphs}
                ${note ? `<p class="ai-interpret-note">${esc(note)}</p>` : ''}
            </div>
        `;
    }

    function renderError(err) {
        const esc = ZtChi.escapeHtml || ((s) => s);
        const msg = err && err.status === 429
            ? 'Rate limit reached — the AI endpoint is usage-capped to keep this free. Try again in a few minutes.'
            : `Couldn't reach the AI endpoint: ${esc(String(err && err.message || err))}`;
        return `<p class="ai-interpret-error">${msg}</p>`;
    }

    ZtChi.ai = { mount };
})();
