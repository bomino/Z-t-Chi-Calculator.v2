/**
 * Show-Work ("Glass Box") mode.
 * Renders a LaTeX + plain-English walkthrough of each test's computation.
 * MathJax is loaded separately via the HTML <script> tag with SRI.
 *
 * Usage:
 *   container.innerHTML = ZtChi.showWork.render('z', { z, probability, ... });
 *   ZtChi.showWork.typeset(container);
 */
(function () {
    'use strict';

    const ZtChi = window.ZtChi || (window.ZtChi = {});

    function fmt(n, d = 4) {
        if (!Number.isFinite(n)) return String(n);
        return n.toFixed(d);
    }

    function stepZ(ctx) {
        const z = fmt(ctx.z);
        const p = fmt(ctx.probability, 6);
        const right = fmt(1 - ctx.probability, 6);
        const two = fmt(ctx.twoTail, 6);
        return `
            <h4>Step 1 — Inputs</h4>
            <p>You entered the standardized value \\(z = ${z}\\).</p>

            <h4>Step 2 — Left-tail probability</h4>
            <p>The standard normal CDF gives the area to the left of \\(z\\):</p>
            <p class="show-work-math">\\[\\Phi(z) = \\int_{-\\infty}^{z} \\frac{1}{\\sqrt{2\\pi}} e^{-t^{2}/2} \\, dt\\]</p>
            <p>Evaluating at \\(z = ${z}\\):</p>
            <p class="show-work-math">\\[\\Phi(${z}) = ${p}\\]</p>

            <h4>Step 3 — Right-tail probability</h4>
            <p>The right tail is the complement of the left tail:</p>
            <p class="show-work-math">\\[P(Z &gt; ${z}) = 1 - \\Phi(${z}) = ${right}\\]</p>

            <h4>Step 4 — Two-tailed probability</h4>
            <p>For a symmetric distribution, the two-tailed probability uses the smaller tail doubled:</p>
            <p class="show-work-math">\\[P(|Z| &gt; |${z}|) = 2 \\cdot \\min(\\Phi(z), 1 - \\Phi(z)) = ${two}\\]</p>

            <p class="show-work-note"><em>Why this form?</em> Doubling <code>min(left, right)</code> is numerically equivalent to \\(2(1 - \\Phi(|z|))\\) but avoids a sign-flip bug when \\(z\\) is negative.</p>
        `;
    }

    function stepT(ctx) {
        const t = fmt(ctx.t);
        const df = ctx.df;
        const alpha = fmt(ctx.alpha);
        const leftP = fmt(ctx.leftTailP, 6);
        const rightP = fmt(ctx.rightTailP, 6);
        const twoP = fmt(ctx.twoTailP, 6);
        const tcritTwo = fmt(Math.abs(ctx.twoTailCritical));
        return `
            <h4>Step 1 — Inputs</h4>
            <p>Test statistic \\(t = ${t}\\), degrees of freedom \\(df = ${df}\\), significance level \\(\\alpha = ${alpha}\\).</p>

            <h4>Step 2 — Left-tail and right-tail p-values</h4>
            <p>Using the Student's \\(t\\)-distribution CDF with \\(df = ${df}\\):</p>
            <p class="show-work-math">\\[P(T \\le ${t}) = ${leftP}\\]</p>
            <p class="show-work-math">\\[P(T &gt; ${t}) = 1 - P(T \\le ${t}) = ${rightP}\\]</p>

            <h4>Step 3 — Two-tailed p-value</h4>
            <p class="show-work-math">\\[p_{\\text{two}} = 2 \\cdot \\min(P(T \\le t), P(T &gt; t)) = ${twoP}\\]</p>

            <h4>Step 4 — Critical value for the two-tailed test</h4>
            <p>The critical \\(t\\)-value at \\(\\alpha = ${alpha}\\) (two-tailed) is found from the inverse CDF:</p>
            <p class="show-work-math">\\[t_{\\text{crit}} = \\pm t^{-1}\\!\\left(1 - \\tfrac{\\alpha}{2},\\ df\\right) = \\pm ${tcritTwo}\\]</p>

            <p class="show-work-note"><em>Intuition:</em> as \\(df\\) grows, the t-distribution approaches the standard normal. For \\(df = ${df}\\) the tails are heavier than the normal, so the critical values sit farther from zero.</p>
        `;
    }

    function stepChi(ctx) {
        const rows = ctx.rows;
        const cols = ctx.cols;
        const n = ctx.grandTotal;
        const df = ctx.df;
        const chi = fmt(ctx.chiSquare);
        const crit = fmt(ctx.criticalValue);
        const p = fmt(ctx.pValue);
        const alpha = fmt(ctx.alpha);

        // Build the expected-frequency formula and an enumerated table of contributions (top 3)
        let contribList = '';
        if (Array.isArray(ctx.contributions)) {
            const flat = [];
            for (let i = 0; i < ctx.contributions.length; i++) {
                for (let j = 0; j < ctx.contributions[i].length; j++) {
                    flat.push({ i, j, O: ctx.observed[i][j], E: ctx.expected[i][j], c: ctx.contributions[i][j] });
                }
            }
            flat.sort((a, b) => b.c - a.c);
            const top = flat.slice(0, Math.min(3, flat.length));
            contribList = top.map(({ i, j, O, E, c }) =>
                `<li>Cell (${i + 1}, ${j + 1}): \\(\\frac{(${O} - ${fmt(E, 2)})^{2}}{${fmt(E, 2)}} = ${fmt(c, 3)}\\)</li>`
            ).join('');
        }

        return `
            <h4>Step 1 — Inputs</h4>
            <p>An \\(${rows} \\times ${cols}\\) contingency table with grand total \\(N = ${n}\\), significance level \\(\\alpha = ${alpha}\\).</p>

            <h4>Step 2 — Expected frequencies</h4>
            <p>Under the null hypothesis of independence, the expected count in each cell is:</p>
            <p class="show-work-math">\\[E_{ij} = \\frac{R_i \\cdot C_j}{N}\\]</p>
            <p>where \\(R_i\\) is the total of row \\(i\\) and \\(C_j\\) is the total of column \\(j\\).</p>

            <h4>Step 3 — Per-cell contributions</h4>
            <p>Each cell contributes \\(\\frac{(O_{ij} - E_{ij})^{2}}{E_{ij}}\\) to the test statistic.</p>
            ${contribList ? `<p>Top contributors:</p><ul class="show-work-list">${contribList}</ul>` : ''}

            <h4>Step 4 — Chi-square statistic</h4>
            <p class="show-work-math">\\[\\chi^{2} = \\sum_{i,j} \\frac{(O_{ij} - E_{ij})^{2}}{E_{ij}} = ${chi}\\]</p>

            <h4>Step 5 — Degrees of freedom</h4>
            <p class="show-work-math">\\[df = (r - 1)(c - 1) = (${rows} - 1)(${cols} - 1) = ${df}\\]</p>

            <h4>Step 6 — p-value and critical value</h4>
            <p>The upper-tail p-value under the \\(\\chi^{2}\\) distribution with \\(df = ${df}\\):</p>
            <p class="show-work-math">\\[p = 1 - F_{\\chi^{2}, ${df}}(${chi}) = ${p}\\]</p>
            <p>The critical value at \\(\\alpha = ${alpha}\\):</p>
            <p class="show-work-math">\\[\\chi^{2}_{\\text{crit}} = F^{-1}_{\\chi^{2}, ${df}}(1 - \\alpha) = ${crit}\\]</p>

            <h4>Step 7 — Effect size (Cramer's V)</h4>
            <p>Statistical significance tells you an association exists; Cramer's V tells you <em>how strong</em> it is:</p>
            <p class="show-work-math">\\[V = \\sqrt{\\frac{\\chi^{2}}{N \\cdot \\min(r-1,\\ c-1)}}\\]</p>
            ${Number.isFinite(ctx.cramersV) ? `<p class="show-work-math">\\[V = \\sqrt{\\frac{${chi}}{${n} \\cdot ${Math.max(1, Math.min(rows - 1, cols - 1))}}} = ${fmt(ctx.cramersV, 4)}${ctx.cramersLabel ? ` \\text{ (${ctx.cramersLabel})}` : ''}\\]</p>` : ''}

            <p class="show-work-note"><em>Assumption check:</em> every expected cell should be at least 5 (Cochran, 1954). If any expected count is below 5, prefer Fisher's exact test. For paired/matched binary data, use McNemar's test (McNemar, 1947) instead — the standard chi-square requires independent observations.</p>
        `;
    }

    const STEPS = { z: stepZ, t: stepT, chi: stepChi };

    function render(testType, ctx) {
        const build = STEPS[testType];
        if (!build) return '';
        return `
            <details class="show-work" data-show-work="${testType}">
                <summary class="show-work-toggle">Show calculation steps (glass-box)</summary>
                <div class="show-work-body">
                    ${build(ctx)}
                </div>
            </details>
        `;
    }

    /**
     * Trigger MathJax typesetting on a container after its HTML is inserted.
     */
    function typeset(container) {
        if (!container) return Promise.resolve();
        if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
            return window.MathJax.typesetPromise([container]).catch((err) => {
                console.warn('[ZtChi.showWork] MathJax typeset failed:', err);
            });
        }
        // MathJax not loaded (offline or blocked). The raw LaTeX is readable; leave as-is.
        return Promise.resolve();
    }

    ZtChi.showWork = {
        render,
        typeset,
    };
})();
