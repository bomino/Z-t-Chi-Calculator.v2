const { escapeHtml, parsePositiveInt, csvEscape, showNotification } = window.ZtChi;

function getDimension(id, fieldName) {
    const raw = document.getElementById(id).value;
    const n = parsePositiveInt(raw, fieldName);
    if (n < 2) {
        throw new Error(`${fieldName} must be at least 2.`);
    }
    return n;
}

function collectObserved(rows, cols) {
    const observed = Array(rows).fill(null).map(() => Array(cols).fill(0));
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            const cell = document.getElementById(`cell-${i}-${j}`);
            if (!cell) {
                throw new Error('Table cells not found. Click "Generate Table" first.');
            }
            observed[i][j] = parsePositiveInt(cell.value || '0', `Cell (row ${i + 1}, col ${j + 1})`);
        }
    }
    return observed;
}

function calculateExpectedFrequencies(rows, cols, observed) {
    const rowTotals = Array(rows).fill(0);
    const colTotals = Array(cols).fill(0);
    let total = 0;

    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            rowTotals[i] += observed[i][j];
            colTotals[j] += observed[i][j];
            total += observed[i][j];
        }
    }

    if (total === 0) {
        throw new Error('Grand total is zero. Enter at least one non-zero observed count.');
    }

    const expected = Array(rows).fill(null).map(() => Array(cols).fill(0));
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            expected[i][j] = (rowTotals[i] * colTotals[j]) / total;
        }
    }
    return { expected, rowTotals, colTotals, grandTotal: total };
}

function calculateChiSquare(observed, expected, rows, cols) {
    let chiSquare = 0;
    const contributions = Array(rows).fill(null).map(() => Array(cols).fill(0));
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            const e = expected[i][j];
            if (e <= 0) {
                throw new Error(`Expected frequency at row ${i + 1}, column ${j + 1} is ${e}. The chi-square test requires all row and column totals to be greater than zero.`);
            }
            const diff = observed[i][j] - e;
            contributions[i][j] = (diff * diff) / e;
            chiSquare += contributions[i][j];
        }
    }
    return { chiSquare, contributions };
}

function getLowExpectedWarning(expected, rows, cols) {
    const lowCells = [];
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            if (expected[i][j] < 5) {
                lowCells.push({ i, j, value: expected[i][j] });
            }
        }
    }
    if (lowCells.length === 0) return '';
    const pct = ((lowCells.length / (rows * cols)) * 100).toFixed(1);
    return `
        <div class="warning-message" role="alert">
            <strong>Warning:</strong> ${lowCells.length} expected frequency cell(s) (${pct}%) are below 5. The chi-square approximation may be unreliable. Consider Fisher's exact test for small expected counts.
        </div>
    `;
}

function getLabel(id, fallback) {
    const el = document.getElementById(id);
    return escapeHtml(el && el.value ? el.value : fallback);
}

function generateTable() {
    try {
        const rows = getDimension('num-rows', 'Number of rows');
        const cols = getDimension('num-cols', 'Number of columns');
        let tableHtml = '<tr><th></th>';
        for (let j = 0; j < cols; j++) {
            tableHtml += `<th><input type="text" id="category-${j}" value="Column ${j + 1}"></th>`;
        }
        tableHtml += '</tr>';
        for (let i = 0; i < rows; i++) {
            tableHtml += `<tr><td><input type="text" id="group-${i}" value="Row ${i + 1}"></td>`;
            for (let j = 0; j < cols; j++) {
                tableHtml += `<td><input type="number" id="cell-${i}-${j}" data-row="${i}" data-col="${j}" value="0" min="0" step="1"></td>`;
            }
            tableHtml += '</tr>';
        }
        document.getElementById('input-table').innerHTML = tableHtml;
    } catch (error) {
        showNotification(error.message, 'error', { duration: 5000 });
    }
}

function toggleContingencyInfo() {
    const infoPanel = document.getElementById('contingency-info');
    const button = document.querySelector('.show-info-button');

    if (infoPanel.style.display === 'none' || !infoPanel.style.display) {
        showContingencyInfo();
        infoPanel.style.display = 'block';
        button.textContent = 'Hide Contingency Table Info';
    } else {
        infoPanel.style.display = 'none';
        button.textContent = 'Show Contingency Table Info';
    }
}

function showContingencyInfo() {
    try {
        const rows = getDimension('num-rows', 'Number of rows');
        const cols = getDimension('num-cols', 'Number of columns');
        const observed = collectObserved(rows, cols);

        const { expected, rowTotals, colTotals, grandTotal } = calculateExpectedFrequencies(rows, cols, observed);
        const degreesOfFreedom = (rows - 1) * (cols - 1);

        let html = `
            <div class="info-section">
                <p class="highlight">Contingency Table Information:</p>
                <p>Dimensions: ${rows} &times; ${cols}</p>
                <p>Degrees of Freedom: ${degreesOfFreedom}</p>
            </div>

            <div class="expected-frequencies">
                <h3>Expected Frequencies</h3>
                <div class="table-wrapper">
                    <table class="expected-table">
                        <thead>
                            <tr><th></th>`;

        for (let j = 0; j < cols; j++) {
            html += `<th>${getLabel(`category-${j}`, `Column ${j + 1}`)}</th>`;
        }
        html += '</tr></thead><tbody>';

        for (let i = 0; i < rows; i++) {
            html += `<tr><td><strong>${getLabel(`group-${i}`, `Row ${i + 1}`)}</strong></td>`;
            for (let j = 0; j < cols; j++) {
                html += `<td>${expected[i][j].toFixed(4)}</td>`;
            }
            html += '</tr>';
        }
        html += '</tbody></table></div></div>';

        html += `
            <div class="totals-section">
                <h3>Observed Totals</h3>
                <p>Grand Total: ${grandTotal}</p>
                <div class="totals-grid">
                    <div class="row-totals">
                        <h4>Row Totals:</h4>
                        <ul>`;
        for (let i = 0; i < rows; i++) {
            html += `<li>${getLabel(`group-${i}`, `Row ${i + 1}`)}: ${rowTotals[i]}</li>`;
        }
        html += `
                        </ul>
                    </div>
                    <div class="column-totals">
                        <h4>Column Totals:</h4>
                        <ul>`;
        for (let j = 0; j < cols; j++) {
            html += `<li>${getLabel(`category-${j}`, `Column ${j + 1}`)}: ${colTotals[j]}</li>`;
        }
        html += `
                        </ul>
                    </div>
                </div>
            </div>`;

        html += getLowExpectedWarning(expected, rows, cols);

        document.getElementById('contingency-info').innerHTML = html;
    } catch (error) {
        showNotification(error.message, 'error', { duration: 5000 });
    }
}

function performChiSquareTest() {
    if (window.ZtChi && window.ZtChi.predict && window.ZtChi.predict.isEnabled()) {
        window.ZtChi.predict.prompt('chi', doChiSquareCompute);
    } else {
        doChiSquareCompute();
    }
}

function doChiSquareCompute() {
    try {
        const rows = getDimension('num-rows', 'Number of rows');
        const cols = getDimension('num-cols', 'Number of columns');
        const observed = collectObserved(rows, cols);

        const { expected, grandTotal } = calculateExpectedFrequencies(rows, cols, observed);
        const { chiSquare, contributions } = calculateChiSquare(observed, expected, rows, cols);

        const rawAlpha = document.getElementById('significance-level').value;
        const significanceLevel = parseFloat(rawAlpha);
        if (isNaN(significanceLevel) || significanceLevel <= 0 || significanceLevel >= 1) {
            throw new Error('Please enter a valid significance level strictly between 0 and 1 (e.g., 0.05 for 5%).');
        }

        const degreesOfFreedom = (rows - 1) * (cols - 1);
        const criticalValue = getCriticalValue(degreesOfFreedom, significanceLevel);
        const pValue = getPValue(chiSquare, degreesOfFreedom);
        const conclusion = chiSquare > criticalValue
            ? 'Reject the null hypothesis.'
            : 'Fail to reject the null hypothesis.';

        const es = (window.ZtChi && window.ZtChi.effectSize) ? window.ZtChi.effectSize : null;
        const dfStar = Math.max(1, Math.min(rows - 1, cols - 1));
        const cramersV = es ? es.cramersV(chiSquare, grandTotal, rows, cols) : NaN;
        const cramersLabel = es ? es.interpretCramersV(cramersV, dfStar) : '';
        const is2x2 = rows === 2 && cols === 2;
        const phi = is2x2 && es ? es.phi(chiSquare, grandTotal) : null;

        let resultHtml = `
            <div class="results-flex-container">
                <div class="results-table-container">
                    <h3>Results Table</h3>
                    <table class="compact-results-table">
                        <thead>
                            <tr><th>Row</th>`;

        for (let j = 0; j < cols; j++) {
            resultHtml += `<th>${getLabel(`category-${j}`, `Col ${j + 1}`)}</th>`;
        }
        resultHtml += '</tr></thead><tbody>';

        for (let i = 0; i < rows; i++) {
            resultHtml += `<tr><td><strong>${getLabel(`group-${i}`, `R${i + 1}`)}</strong></td>`;
            for (let j = 0; j < cols; j++) {
                resultHtml += `
                    <td class="cell-data">
                        <div class="observed">${observed[i][j]}</div>
                        <div class="expected">(${expected[i][j].toFixed(2)})</div>
                    </td>`;
            }
            resultHtml += '</tr>';
        }
        resultHtml += `</tbody></table></div>`;

        resultHtml += `
            <div class="summary-stats-container">
                <h3>Statistical Summary</h3>
                <div class="stats-grid">
                    <div class="stat-item">
                        <span class="stat-label">&chi;&sup2; Statistic:</span>
                        <span class="stat-value">${chiSquare.toFixed(4)}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Degrees of Freedom:</span>
                        <span class="stat-value">${degreesOfFreedom}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Significance Level:</span>
                        <span class="stat-value">${significanceLevel}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Critical Value:</span>
                        <span class="stat-value">${criticalValue.toFixed(4)}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">P-Value:</span>
                        <span class="stat-value">${pValue.toFixed(4)}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Effect size (Cramer's V):</span>
                        <span class="stat-value">${Number.isFinite(cramersV) ? cramersV.toFixed(4) : '—'}${cramersLabel ? ` <small>(${cramersLabel})</small>` : ''}</span>
                    </div>
                    ${phi != null ? `
                    <div class="stat-item">
                        <span class="stat-label">&phi; (2&times;2 only):</span>
                        <span class="stat-value">${phi.toFixed(4)}</span>
                    </div>` : ''}
                </div>
                <div class="conclusion-box">
                    <strong>Conclusion:</strong> ${conclusion}
                </div>
                <p class="effect-size-note no-print"><small>Significance tells you whether an association <em>exists</em>; Cramer's V tells you how strong it is. Cohen's (1988) bands for df* = ${dfStar}: ${dfStar === 1 ? 'small .10, medium .30, large .50' : dfStar === 2 ? 'small .07, medium .21, large .35' : dfStar === 3 ? 'small .06, medium .17, large .29' : 'small .05, medium .15, large .25'}.</small></p>
                ${getLowExpectedWarning(expected, rows, cols)}
            </div>
        </div>`;

        document.getElementById('results').innerHTML = resultHtml;

        renderPostResult('chi', {
            rows,
            cols,
            observed,
            expected,
            contributions,
            chiSquare,
            df: degreesOfFreedom,
            criticalValue,
            pValue,
            alpha: significanceLevel,
            grandTotal,
            n: grandTotal,
            cramersV,
            cramersLabel,
            phi,
            dfStar,
        });

        if (window.ZtChi && window.ZtChi.predict && window.ZtChi.predict.reveal) {
            window.ZtChi.predict.reveal('chi', chiSquare > criticalValue ? 'reject' : 'fail-to-reject', '#results');
        }
    } catch (error) {
        showNotification(error.message, 'error', { duration: 5000 });
    }
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

    const { ai } = window.ZtChi || {};
    if (ai && ai.mount) {
        ai.mount(container, {
            test: testType,
            chiSquare: ctx.chiSquare,
            df: ctx.degreesOfFreedom,
            pValue: ctx.pValue,
            cramersV: ctx.cramersV,
            alpha: ctx.alpha || 0.05,
            method: 'chi-square test of independence',
        });
    }
}

function getCriticalValue(degreesOfFreedom, alpha) {
    return jStat.chisquare.inv(1 - alpha, degreesOfFreedom);
}

function getPValue(chiSquare, degreesOfFreedom) {
    return 1 - jStat.chisquare.cdf(chiSquare, degreesOfFreedom);
}

function exportToCSV() {
    try {
        const rows = getDimension('num-rows', 'Number of rows');
        const cols = getDimension('num-cols', 'Number of columns');
        const headers = ['Group'];
        for (let j = 0; j < cols; j++) {
            headers.push(document.getElementById(`category-${j}`).value);
        }
        const lines = [headers.map(csvEscape).join(',')];
        for (let i = 0; i < rows; i++) {
            const row = [document.getElementById(`group-${i}`).value];
            for (let j = 0; j < cols; j++) {
                row.push(document.getElementById(`cell-${i}-${j}`).value);
            }
            lines.push(row.map(csvEscape).join(','));
        }
        const csvContent = lines.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', 'chi_square_data.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showNotification('Exported to chi_square_data.csv');
    } catch (error) {
        showNotification(error.message, 'error', { duration: 5000 });
    }
}

function saveState() {
    try {
        const rows = getDimension('num-rows', 'Number of rows');
        const cols = getDimension('num-cols', 'Number of columns');
        const state = { rows, cols, data: [], categories: [], groups: [] };

        for (let j = 0; j < cols; j++) {
            state.categories.push(document.getElementById(`category-${j}`).value);
        }
        for (let i = 0; i < rows; i++) {
            state.groups.push(document.getElementById(`group-${i}`).value);
            const rowData = [];
            for (let j = 0; j < cols; j++) {
                rowData.push(document.getElementById(`cell-${i}-${j}`).value);
            }
            state.data.push(rowData);
        }

        localStorage.setItem('chiSquareState', JSON.stringify(state));
        showNotification('Data saved successfully!');
    } catch (error) {
        showNotification(error.message, 'error', { duration: 5000 });
    }
}

function loadState() {
    const savedState = localStorage.getItem('chiSquareState');
    if (!savedState) {
        showNotification('No saved data found!', 'warning');
        return;
    }
    try {
        const state = JSON.parse(savedState);
        document.getElementById('num-rows').value = state.rows;
        document.getElementById('num-cols').value = state.cols;
        generateTable();

        state.categories.forEach((label, j) => {
            const el = document.getElementById(`category-${j}`);
            if (el) el.value = label;
        });
        state.data.forEach((row, i) => {
            const groupEl = document.getElementById(`group-${i}`);
            if (groupEl) groupEl.value = state.groups[i];
            row.forEach((cell, j) => {
                const cellEl = document.getElementById(`cell-${i}-${j}`);
                if (cellEl) cellEl.value = cell;
            });
        });
        showNotification('Data loaded successfully!');
    } catch (error) {
        showNotification('Saved data was corrupted and could not be loaded.', 'warning');
    }
}

function setupKeyboardNavigation() {
    const table = document.getElementById('input-table');
    if (!table) return;

    table.addEventListener('keydown', (e) => {
        if (e.target.tagName !== 'INPUT') return;
        const row = parseInt(e.target.getAttribute('data-row'), 10);
        const col = parseInt(e.target.getAttribute('data-col'), 10);
        if (Number.isNaN(row) || Number.isNaN(col)) return;

        switch (e.key) {
            case 'ArrowRight':
                focusCell(row, col + 1);
                break;
            case 'ArrowLeft':
                focusCell(row, col - 1);
                break;
            case 'ArrowUp':
                focusCell(row - 1, col);
                break;
            case 'ArrowDown':
                focusCell(row + 1, col);
                break;
            case 'Enter':
                focusCell(row + 1, col);
                e.preventDefault();
                break;
        }
    });
}

function focusCell(row, col) {
    const nextCell = document.querySelector(`input[data-row="${row}"][data-col="${col}"]`);
    if (nextCell) {
        nextCell.focus();
    }
}

function resetForm() {
    if (!confirm('Are you sure you want to reset all data? This action cannot be undone.')) {
        return;
    }
    document.getElementById('num-rows').value = '2';
    document.getElementById('num-cols').value = '2';
    document.getElementById('significance-level').value = '0.05';
    document.getElementById('input-table').innerHTML = '';
    document.getElementById('results').innerHTML = '';
    const info = document.getElementById('contingency-info');
    info.innerHTML = '';
    info.style.display = 'none';
    const showButton = document.querySelector('.show-info-button');
    if (showButton) showButton.textContent = 'Show Contingency Table Info';
}

document.addEventListener('DOMContentLoaded', () => {
    setupKeyboardNavigation();

    const bindings = [
        ['export-btn', exportToCSV],
        ['save-btn', saveState],
        ['load-btn', loadState],
        ['reset-btn', resetForm],
    ];
    for (const [id, handler] of bindings) {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', handler);
    }
});
