/**
 * Multiple-comparisons corrections (Bonferroni, Holm, Benjamini-Hochberg) +
 * Type I inflation visualization.
 *
 * Math:
 *   Bonferroni: p_adj(i) = min(1, p(i) * k)
 *   Holm      : sort p ascending; for rank i (1..k),
 *               p_adj(i) = max over j <= i of (k - j + 1) * p(j), capped at 1
 *   BH (FDR)  : sort p ascending; for rank i (1..k),
 *               p_adj(i) = min over j >= i of p(j) * k / j, capped at 1
 *
 * FWER under independence: 1 - (1 - alpha)^k.
 */
(function () {
    'use strict';

    const ZtChi = window.ZtChi || (window.ZtChi = {});

    const EXAMPLE_TEXT = [
        'Systolic BP, 0.003',
        'Diastolic BP, 0.013',
        'Heart rate, 0.018',
        'HDL cholesterol, 0.041',
        'LDL cholesterol, 0.120',
    ].join('\n');

    function parseInput(raw) {
        const entries = [];
        const errors = [];
        const lines = String(raw || '').split(/\r?\n/);
        lines.forEach((line, idx) => {
            const trimmed = line.trim();
            if (!trimmed) return;
            let label;
            let pStr;
            const commaIdx = trimmed.lastIndexOf(',');
            if (commaIdx >= 0) {
                label = trimmed.slice(0, commaIdx).trim();
                pStr = trimmed.slice(commaIdx + 1).trim();
            } else {
                label = '';
                pStr = trimmed;
            }
            const p = Number(pStr);
            if (!Number.isFinite(p) || p < 0 || p > 1) {
                errors.push(`Line ${idx + 1}: "${pStr}" is not a valid p-value in [0, 1].`);
                return;
            }
            entries.push({
                id: entries.length,
                label: label || `Test ${entries.length + 1}`,
                p,
            });
        });
        return { entries, errors };
    }

    function bonferroni(pValues) {
        const k = pValues.length;
        return pValues.map((p) => Math.min(1, p * k));
    }

    function holm(pValues) {
        const k = pValues.length;
        const sorted = pValues
            .map((p, i) => ({ p, i }))
            .sort((a, b) => a.p - b.p);
        const adj = new Array(k);
        let running = 0;
        sorted.forEach((entry, rank) => {
            const raw = (k - rank) * entry.p;
            running = Math.max(running, raw);
            adj[entry.i] = Math.min(1, running);
        });
        return adj;
    }

    function benjaminiHochberg(pValues) {
        const k = pValues.length;
        const sorted = pValues
            .map((p, i) => ({ p, i }))
            .sort((a, b) => a.p - b.p);
        const adj = new Array(k);
        // Right-to-left cumulative min of p * k / rank.
        let running = 1;
        for (let rank = k; rank >= 1; rank--) {
            const entry = sorted[rank - 1];
            const raw = (entry.p * k) / rank;
            running = Math.min(running, raw);
            adj[entry.i] = Math.min(1, running);
        }
        return adj;
    }

    function formatP(p) {
        if (!Number.isFinite(p)) return '-';
        if (p < 0.001) return p.toExponential(2);
        if (p < 0.01) return p.toFixed(4);
        return p.toFixed(3);
    }

    function computeAndRender() {
        const input = document.getElementById('pvalInput');
        const alphaSel = document.getElementById('alphaSelect');
        if (!input || !alphaSel) return;

        const alpha = Number(alphaSel.value);
        const { entries, errors } = parseInput(input.value);

        if (errors.length > 0) {
            ZtChi.showNotification(errors.join(' '), 'warning', { duration: 6000 });
        }
        if (entries.length === 0) {
            document.getElementById('resultsSection').style.display = 'none';
            document.getElementById('vizSection').style.display = 'none';
            if (errors.length === 0) {
                ZtChi.showNotification('Enter at least one p-value.', 'info');
            }
            return;
        }

        const rawP = entries.map((e) => e.p);
        const bonfAdj = bonferroni(rawP);
        const holmAdj = holm(rawP);
        const bhAdj = benjaminiHochberg(rawP);

        const enriched = entries.map((e, i) => ({
            ...e,
            bonf: bonfAdj[i],
            holm: holmAdj[i],
            bh: bhAdj[i],
        })).sort((a, b) => a.p - b.p);

        renderTable(enriched, alpha);
        renderSummary(enriched, alpha);
        renderChart(entries.length, alpha);
        try {
            ZtChi.state.recordResult({
                type: 'corrections',
                k: entries.length,
                alpha,
            });
        } catch (_) { /* no-op */ }
    }

    function cellClass(adjP, alpha) {
        return adjP <= alpha ? 'cell-reject' : 'cell-retain';
    }

    function renderTable(enriched, alpha) {
        const body = document.getElementById('resultsBody');
        if (!body) return;
        const esc = ZtChi.escapeHtml || ((s) => s);
        body.innerHTML = enriched.map((row, idx) => {
            const methods = [];
            if (row.p <= alpha) methods.push('raw');
            if (row.bonf <= alpha) methods.push('Bonferroni');
            if (row.holm <= alpha) methods.push('Holm');
            if (row.bh <= alpha) methods.push('BH');
            const rejectLabel = methods.length > 0 ? methods.join(', ') : '&mdash;';
            return `
                <tr>
                    <td>${idx + 1}</td>
                    <td>${esc(row.label)}</td>
                    <td class="${cellClass(row.p, alpha)}">${formatP(row.p)}</td>
                    <td class="${cellClass(row.bonf, alpha)}">${formatP(row.bonf)}</td>
                    <td class="${cellClass(row.holm, alpha)}">${formatP(row.holm)}</td>
                    <td class="${cellClass(row.bh, alpha)}">${formatP(row.bh)}</td>
                    <td class="cell-methods">${rejectLabel}</td>
                </tr>
            `;
        }).join('');
        document.getElementById('resultsSection').style.display = 'block';
    }

    function renderSummary(enriched, alpha) {
        const summary = document.getElementById('resultsSummary');
        if (!summary) return;
        const k = enriched.length;
        const counts = {
            raw: enriched.filter((r) => r.p <= alpha).length,
            bonf: enriched.filter((r) => r.bonf <= alpha).length,
            holm: enriched.filter((r) => r.holm <= alpha).length,
            bh: enriched.filter((r) => r.bh <= alpha).length,
        };
        const fwer = 1 - Math.pow(1 - alpha, k);
        summary.innerHTML = `
            <strong>${k}</strong> tests at &alpha; = ${alpha}. Uncorrected FWER under independence
            &asymp; <strong>${(fwer * 100).toFixed(1)}%</strong>.
            Discoveries: <strong>${counts.raw}</strong> uncorrected,
            <strong>${counts.bonf}</strong> Bonferroni,
            <strong>${counts.holm}</strong> Holm,
            <strong>${counts.bh}</strong> BH.
        `;
    }

    function renderChart(userK, userAlpha) {
        const svg = document.getElementById('inflationChart');
        if (!svg) return;
        const vizSection = document.getElementById('vizSection');
        if (vizSection) vizSection.style.display = 'block';

        const vizAlpha = Number(document.getElementById('vizAlpha').value);
        const alphaOut = document.getElementById('vizAlphaLabel');
        if (alphaOut) alphaOut.textContent = vizAlpha.toFixed(3);

        const W = 640, H = 380;
        const pad = { top: 24, right: 24, bottom: 52, left: 64 };
        const innerW = W - pad.left - pad.right;
        const innerH = H - pad.top - pad.bottom;
        const kMax = Math.max(20, (userK || 0) + 2);

        const xScale = (k) => pad.left + (k / kMax) * innerW;
        const yScale = (p) => pad.top + (1 - p) * innerH;

        // Uncorrected curve (independence): 1 - (1 - alpha)^k
        const unc = [];
        for (let k = 1; k <= kMax; k++) {
            const fwer = 1 - Math.pow(1 - vizAlpha, k);
            unc.push([k, fwer]);
        }

        // Bonferroni: FWER stays ~alpha regardless of k (upper bound).
        // Using the independence-form upper bound 1 - (1 - alpha/k)^k for visual contrast;
        // Bonferroni's guarantee is FWER <= alpha so we also draw a flat line at alpha.
        const bonf = [];
        for (let k = 1; k <= kMax; k++) {
            const perTest = vizAlpha / k;
            const fwer = 1 - Math.pow(1 - perTest, k);
            bonf.push([k, fwer]);
        }

        const gridLines = [];
        for (let t = 0; t <= 1; t += 0.2) {
            gridLines.push(`<line class="chart-grid" x1="${pad.left}" x2="${W - pad.right}" y1="${yScale(t)}" y2="${yScale(t)}"/>`);
            gridLines.push(`<text class="chart-label-y" x="${pad.left - 8}" y="${yScale(t) + 4}" text-anchor="end">${t.toFixed(1)}</text>`);
        }
        const xTickStep = kMax <= 20 ? 2 : Math.ceil(kMax / 10);
        const xTicks = [];
        for (let k = 0; k <= kMax; k += xTickStep) {
            xTicks.push(`<line class="chart-grid" x1="${xScale(k)}" x2="${xScale(k)}" y1="${pad.top}" y2="${H - pad.bottom}"/>`);
            xTicks.push(`<text class="chart-label-x" x="${xScale(k)}" y="${H - pad.bottom + 16}" text-anchor="middle">${k}</text>`);
        }

        const path = (pts) => 'M ' + pts.map(([k, p]) => `${xScale(k).toFixed(1)},${yScale(p).toFixed(1)}`).join(' L ');

        const alphaY = yScale(vizAlpha);
        const userPt = userK ? `
            <circle class="chart-user-marker" cx="${xScale(userK)}" cy="${yScale(1 - Math.pow(1 - vizAlpha, userK))}" r="6"/>
            <line class="chart-user-line" x1="${xScale(userK)}" x2="${xScale(userK)}" y1="${pad.top}" y2="${H - pad.bottom}"/>
            <text class="chart-user-label" x="${xScale(userK) + 8}" y="${pad.top + 14}">k = ${userK}</text>
        ` : '';

        svg.innerHTML = `
            <rect class="chart-bg" x="${pad.left}" y="${pad.top}" width="${innerW}" height="${innerH}"/>
            ${gridLines.join('')}
            ${xTicks.join('')}
            <line class="chart-alpha-line" x1="${pad.left}" x2="${W - pad.right}" y1="${alphaY}" y2="${alphaY}"/>
            <text class="chart-alpha-label" x="${W - pad.right - 4}" y="${alphaY - 4}" text-anchor="end">&alpha; = ${vizAlpha.toFixed(3)}</text>
            <path class="chart-curve chart-curve-uncorrected" d="${path(unc)}"/>
            <path class="chart-curve chart-curve-bonf" d="${path(bonf)}"/>
            ${userPt}
            <text class="chart-axis-title" x="${pad.left + innerW / 2}" y="${H - 12}" text-anchor="middle">Number of tests (k)</text>
            <text class="chart-axis-title" x="${12}" y="${pad.top + innerH / 2}" text-anchor="middle" transform="rotate(-90 12 ${pad.top + innerH / 2})">Family-wise error rate</text>
        `;

        const caption = document.getElementById('vizCaption');
        if (caption && userK) {
            const uncAtK = 1 - Math.pow(1 - vizAlpha, userK);
            caption.innerHTML = `
                At <strong>k = ${userK}</strong> and &alpha; = ${vizAlpha.toFixed(3)},
                uncorrected FWER &asymp; <strong>${(uncAtK * 100).toFixed(1)}%</strong> &mdash;
                meaning roughly that chance alone of at least one false positive. Bonferroni pulls this back toward &alpha;.
            `;
        } else if (caption) {
            caption.textContent = 'Enter p-values above to place your study on this curve.';
        }
    }

    function loadRecent() {
        if (!ZtChi.state || !ZtChi.state.readRecent) return;
        const recent = ZtChi.state.readRecent()
            .filter((r) => r && typeof r.pValue === 'number' && r.pValue >= 0 && r.pValue <= 1);
        if (recent.length === 0) {
            ZtChi.showNotification('No recent test results with p-values found this session. Run a test on another page first, or paste p-values directly.', 'info', { duration: 5000 });
            return;
        }
        const lines = recent.map((r) => {
            const label = r.label || r.type || 'Test';
            return `${label}, ${r.pValue}`;
        });
        document.getElementById('pvalInput').value = lines.join('\n');
        ZtChi.showNotification(`Loaded ${recent.length} recent result${recent.length === 1 ? '' : 's'}.`, 'success');
    }

    function loadExample() {
        document.getElementById('pvalInput').value = EXAMPLE_TEXT;
    }

    function clearAll() {
        document.getElementById('pvalInput').value = '';
        document.getElementById('resultsSection').style.display = 'none';
        document.getElementById('vizSection').style.display = 'none';
    }

    function wire() {
        const btnCompute = document.getElementById('btnCompute');
        const btnLoadRecent = document.getElementById('btnLoadRecent');
        const btnLoadExample = document.getElementById('btnLoadExample');
        const btnClear = document.getElementById('btnClear');
        const vizAlpha = document.getElementById('vizAlpha');
        const alphaSelect = document.getElementById('alphaSelect');

        if (btnCompute) btnCompute.addEventListener('click', computeAndRender);
        if (btnLoadRecent) btnLoadRecent.addEventListener('click', loadRecent);
        if (btnLoadExample) btnLoadExample.addEventListener('click', loadExample);
        if (btnClear) btnClear.addEventListener('click', clearAll);

        if (vizAlpha) {
            vizAlpha.addEventListener('input', () => {
                const input = document.getElementById('pvalInput');
                const { entries } = parseInput(input ? input.value : '');
                const k = entries.length;
                const userAlpha = Number(alphaSelect ? alphaSelect.value : '0.05');
                renderChart(k, userAlpha);
            });
        }

        // Sync the viz alpha with the chosen study alpha on open, then let user slide independently.
        if (alphaSelect && vizAlpha) {
            alphaSelect.addEventListener('change', () => {
                vizAlpha.value = alphaSelect.value;
                vizAlpha.dispatchEvent(new Event('input'));
                computeAndRender();
            });
        }

        // If a permalink carries state, apply it.
        try {
            const state = ZtChi.state.readFromUrl();
            if (state && state.t === 'corr' && state.input) {
                document.getElementById('pvalInput').value = state.input;
                if (state.alpha) alphaSelect.value = state.alpha;
                computeAndRender();
            }
        } catch (_) { /* no-op */ }
    }

    ZtChi.corrections = {
        bonferroni,
        holm,
        benjaminiHochberg,
        parseInput,
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', wire);
    } else {
        wire();
    }
})();
