function calculateExpectedFrequencies(rows, cols, observed) {
    let rowTotals = Array(rows).fill(0);
    let colTotals = Array(cols).fill(0);
    let total = 0;

    // Calculate row totals, column totals, and overall total
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            rowTotals[i] += observed[i][j];
            colTotals[j] += observed[i][j];
            total += observed[i][j];
        }
    }

    // Calculate expected frequencies
    let expected = Array(rows).fill(null).map(() => Array(cols).fill(0));
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            expected[i][j] = (rowTotals[i] * colTotals[j]) / total;
        }
    }
    return expected;
}

function calculateChiSquare(observed, expected, rows, cols) {
    let chiSquare = 0;
    let contributions = Array(rows).fill(null).map(() => Array(cols).fill(0));
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            const observedValue = observed[i][j];
            const expectedValue = expected[i][j];
            contributions[i][j] = Math.pow(observedValue - expectedValue, 2) / expectedValue;
            chiSquare += contributions[i][j];
        }
    }
    return { chiSquare, contributions };
}

function generateTable() {
    const rows = parseInt(document.getElementById('num-rows').value);
    const cols = parseInt(document.getElementById('num-cols').value);
    let tableHtml = '<tr><th></th>';
    for (let j = 0; j < cols; j++) {
        tableHtml += `<th><input type="text" id="category-${j}" value="Column ${j + 1}"></th>`;
    }
    tableHtml += '</tr>';
    for (let i = 0; i < rows; i++) {
        tableHtml += `<tr><td><input type="text" id="group-${i}" value="Row ${i + 1}"></td>`;
        for (let j = 0; j < cols; j++) {
            tableHtml += `<td><input type="number" id="cell-${i}-${j}" value="0" min="0"></td>`;
        }
        tableHtml += '</tr>';
    }
    document.getElementById('input-table').innerHTML = tableHtml;
}

// Function to toggle contingency info visibility
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

// Updated showContingencyInfo function
function showContingencyInfo() {
    const rows = parseInt(document.getElementById('num-rows').value);
    const cols = parseInt(document.getElementById('num-cols').value);
    let observed = Array(rows).fill(null).map(() => Array(cols).fill(0));

    // Collect observed values
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            const cellValue = document.getElementById(`cell-${i}-${j}`).value;
            if (isNaN(cellValue) || cellValue < 0) {
                alert("Please enter only positive numbers for observed values.");
                return;
            }
            observed[i][j] = parseInt(cellValue) || 0; // Use 0 if value is empty or NaN
        }
    }

    // Calculate expected frequencies
    const expected = calculateExpectedFrequencies(rows, cols, observed);

    // Calculate degrees of freedom
    const degreesOfFreedom = (rows - 1) * (cols - 1);

    // Display contingency table info and expected frequencies
    let contingencyInfoHtml = `
        <div class="info-section">
            <p class="highlight">Contingency Table Information:</p>
            <p>Dimensions: ${rows} × ${cols}</p>
            <p>Degrees of Freedom: ${degreesOfFreedom}</p>
        </div>
        
        <div class="expected-frequencies">
            <h3>Expected Frequencies</h3>
            <div class="table-wrapper">
                <table class="expected-table">
                    <thead>
                        <tr>
                            <th></th>`;

    // Add column headers
    for (let j = 0; j < cols; j++) {
        const categoryName = document.getElementById(`category-${j}`)?.value || `Column ${j + 1}`;
        contingencyInfoHtml += `<th>${categoryName}</th>`;
    }
    contingencyInfoHtml += '</tr></thead><tbody>';

    // Add row data
    for (let i = 0; i < rows; i++) {
        const groupName = document.getElementById(`group-${i}`)?.value || `Row ${i + 1}`;
        contingencyInfoHtml += `<tr><td><strong>${groupName}</strong></td>`;
        for (let j = 0; j < cols; j++) {
            contingencyInfoHtml += `<td>${expected[i][j].toFixed(4)}</td>`;
        }
        contingencyInfoHtml += '</tr>';
    }
    contingencyInfoHtml += '</tbody></table></div>';

    // Add row and column totals
    let rowTotals = Array(rows).fill(0);
    let colTotals = Array(cols).fill(0);
    let grandTotal = 0;

    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            const value = observed[i][j];
            rowTotals[i] += value;
            colTotals[j] += value;
            grandTotal += value;
        }
    }

    contingencyInfoHtml += `
        <div class="totals-section">
            <h3>Observed Totals</h3>
            <p>Grand Total: ${grandTotal}</p>
            <div class="totals-grid">
                <div class="row-totals">
                    <h4>Row Totals:</h4>
                    <ul>`;

    for (let i = 0; i < rows; i++) {
        const groupName = document.getElementById(`group-${i}`)?.value || `Row ${i + 1}`;
        contingencyInfoHtml += `<li>${groupName}: ${rowTotals[i]}</li>`;
    }

    contingencyInfoHtml += `
                    </ul>
                </div>
                <div class="column-totals">
                    <h4>Column Totals:</h4>
                    <ul>`;

    for (let j = 0; j < cols; j++) {
        const categoryName = document.getElementById(`category-${j}`)?.value || `Column ${j + 1}`;
        contingencyInfoHtml += `<li>${categoryName}: ${colTotals[j]}</li>`;
    }

    contingencyInfoHtml += `
                    </ul>
                </div>
            </div>
        </div>`;

    document.getElementById('contingency-info').innerHTML = contingencyInfoHtml;
}

//////////////////////////////////////////////////////////////////////////////////////////////

function performChiSquareTest() {
    const rows = parseInt(document.getElementById('num-rows').value);
    const cols = parseInt(document.getElementById('num-cols').value);
    let observed = Array(rows).fill(null).map(() => Array(cols).fill(0));

    // Collect observed values
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            const cellValue = document.getElementById(`cell-${i}-${j}`).value;
            if (isNaN(cellValue) || cellValue < 0) {
                alert("Please enter only positive numbers for observed values.");
                return;
            }
            observed[i][j] = parseInt(cellValue);
        }
    }

    // Calculate expected frequencies
    const expected = calculateExpectedFrequencies(rows, cols, observed);

    // Calculate chi-square statistic and contributions
    const { chiSquare, contributions } = calculateChiSquare(observed, expected, rows, cols);

    // Get and validate significance level
    const significanceLevel = parseFloat(document.getElementById('significance-level').value);
    if (isNaN(significanceLevel) || significanceLevel <= 0 || significanceLevel >= 1) {
        alert("Please enter a valid significance level between 0 and 1 (e.g., 0.05 for 5%)");
        return;
    }

    // Determine critical value and conclusion
    const degreesOfFreedom = (rows - 1) * (cols - 1);
    const criticalValue = getCriticalValue(degreesOfFreedom, significanceLevel);
    const conclusion = chiSquare > criticalValue
        ? "Reject the null hypothesis."
        : "Fail to reject the null hypothesis.";

    // Calculate P-value
    const pValue = getPValue(chiSquare, degreesOfFreedom);

    // Generate results with side-by-side layout
    let resultHtml = `
        <div class="results-flex-container">
            <div class="results-table-container">
                <h3>Results Table</h3>
                <table class="compact-results-table">
                    <thead>
                        <tr>
                            <th>Row</th>`;

    // Add column headers
    for (let j = 0; j < cols; j++) {
        const categoryName = document.getElementById(`category-${j}`).value || `Col ${j + 1}`;
        resultHtml += `<th>${categoryName}</th>`;
    }
    resultHtml += '</tr></thead><tbody>';

    // Add data rows with compact display
    for (let i = 0; i < rows; i++) {
        const groupName = document.getElementById(`group-${i}`).value || `R${i + 1}`;
        resultHtml += `<tr><td><strong>${groupName}</strong></td>`;
        for (let j = 0; j < cols; j++) {
            resultHtml += `
                <td class="cell-data">
                    <div class="observed">${observed[i][j]}</div>
                    <div class="expected">(${expected[i][j].toFixed(2)})</div>
                    <div class="contribution">[${contributions[i][j].toFixed(4)}]</div>
                </td>`;
        }
        resultHtml += '</tr>';
    }
    resultHtml += `</tbody></table></div>`;

    // Add summary statistics side by side
    resultHtml += `
        <div class="summary-stats-container">
            <h3>Statistical Summary</h3>
            <div class="stats-grid">
                <div class="stat-item">
                    <span class="stat-label">χ² Statistic:</span>
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
            </div>
            <div class="conclusion-box">
                <strong>Conclusion:</strong> ${conclusion}
            </div>
        </div>
    </div>`;

    document.getElementById('results').innerHTML = resultHtml;
}

////////////////////////////////////////////////////////////////////////////////////////////////////


// Update the showContingencyInfo function to also use 4 decimal points
function showContingencyInfo() {
    const rows = parseInt(document.getElementById('num-rows').value);
    const cols = parseInt(document.getElementById('num-cols').value);
    let observed = Array(rows).fill(null).map(() => Array(cols).fill(0));
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            const cellValue = document.getElementById(`cell-${i}-${j}`).value;
            if (isNaN(cellValue) || cellValue < 0) {
                alert("Please enter only positive numbers for observed values.");
                return;
            }
            observed[i][j] = parseInt(cellValue);
        }
    }

    // Calculate expected frequencies
    const expected = calculateExpectedFrequencies(rows, cols, observed);

    // Calculate degrees of freedom
    const degreesOfFreedom = (rows - 1) * (cols - 1);

    // Display contingency table info and expected frequencies
    let contingencyInfoHtml = `<p class="highlight">Contingency Table Dimensions: ${rows}x${cols}</p>`;
    contingencyInfoHtml += `<p class="highlight">Degrees of Freedom: ${degreesOfFreedom}</p>`;
    contingencyInfoHtml += '<h2 class="expected-frequencies-header">Expected Frequencies</h2>';
    contingencyInfoHtml += '<table id="expected-frequencies-table"><tr><th></th>';
    for (let j = 0; j < cols; j++) {
        contingencyInfoHtml += `<th>${document.getElementById(`category-${j}`).value}</th>`;
    }
    contingencyInfoHtml += '</tr>';
    for (let i = 0; i < rows; i++) {
        contingencyInfoHtml += `<tr><td>${document.getElementById(`group-${i}`).value}</td>`;
        for (let j = 0; j < cols; j++) {
            contingencyInfoHtml += `<td>${expected[i][j].toFixed(4)}</td>`;
        }
        contingencyInfoHtml += '</tr>';
    }
    contingencyInfoHtml += '</table>';

    document.getElementById('contingency-info').innerHTML = contingencyInfoHtml;
}

function getCriticalValue(degreesOfFreedom, alpha) {
    return jStat.chisquare.inv(1 - alpha, degreesOfFreedom);
}

function getPValue(chiSquare, degreesOfFreedom) {
    return 1 - jStat.chisquare.cdf(chiSquare, degreesOfFreedom);
}

// Add input validation function
function validateInput(value, fieldName) {
    if (value === '') {
        throw new Error(`${fieldName} cannot be empty`);
    }
    if (isNaN(value)) {
        throw new Error(`${fieldName} must be a number`);
    }
    if (value < 0) {
        throw new Error(`${fieldName} cannot be negative`);
    }
    return true;
}

// Add data export functionality
function exportToCSV() {
    const rows = parseInt(document.getElementById('num-rows').value);
    const cols = parseInt(document.getElementById('num-cols').value);
    let csvContent = "data:text/csv;charset=utf-8,";

    // Add headers
    let headers = ["Group"];
    for (let j = 0; j < cols; j++) {
        headers.push(document.getElementById(`category-${j}`).value);
    }
    csvContent += headers.join(",") + "\n";

    // Add data
    for (let i = 0; i < rows; i++) {
        let row = [document.getElementById(`group-${i}`).value];
        for (let j = 0; j < cols; j++) {
            row.push(document.getElementById(`cell-${i}-${j}`).value);
        }
        csvContent += row.join(",") + "\n";
    }

    // Create download link
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "chi_square_data.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Add save state functionality
function saveState() {
    const state = {
        rows: document.getElementById('num-rows').value,
        cols: document.getElementById('num-cols').value,
        data: [],
        categories: [],
        groups: []
    };

    for (let i = 0; i < state.rows; i++) {
        state.groups.push(document.getElementById(`group-${i}`).value);
        const rowData = [];
        for (let j = 0; j < state.cols; j++) {
            if (i === 0) {
                state.categories.push(document.getElementById(`category-${j}`).value);
            }
            rowData.push(document.getElementById(`cell-${i}-${j}`).value);
        }
        state.data.push(rowData);
    }

    localStorage.setItem('chiSquareState', JSON.stringify(state));
    showNotification('Data saved successfully!');
}

// Add load state functionality
function loadState() {
    const savedState = localStorage.getItem('chiSquareState');
    if (savedState) {
        const state = JSON.parse(savedState);
        document.getElementById('num-rows').value = state.rows;
        document.getElementById('num-cols').value = state.cols;
        generateTable();

        // Restore saved data
        state.data.forEach((row, i) => {
            document.getElementById(`group-${i}`).value = state.groups[i];
            row.forEach((cell, j) => {
                document.getElementById(`cell-${i}-${j}`).value = cell;
                if (i === 0) {
                    document.getElementById(`category-${j}`).value = state.categories[j];
                }
            });
        });
        showNotification('Data loaded successfully!');
    } else {
        showNotification('No saved data found!', 'warning');
    }
}

// Add notification system
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Add keyboard navigation
function setupKeyboardNavigation() {
    const table = document.getElementById('input-table');
    if (!table) return;

    table.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT') {
            const currentCell = e.target;
            const row = parseInt(currentCell.getAttribute('data-row'));
            const col = parseInt(currentCell.getAttribute('data-col'));

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
                    break;
                case 'Tab':
                    if (!e.shiftKey) {
                        focusCell(row, col + 1);
                    } else {
                        focusCell(row, col - 1);
                    }
                    e.preventDefault();
                    break;
            }
        }
    });
}

// Helper function for keyboard navigation
function focusCell(row, col) {
    const nextCell = document.querySelector(`input[data-row="${row}"][data-col="${col}"]`);
    if (nextCell) {
        nextCell.focus();
    }
}

// Add form reset confirmation
function resetForm() {
    if (confirm('Are you sure you want to reset all data? This action cannot be undone.')) {
        document.getElementById('num-rows').value = '';
        document.getElementById('num-cols').value = '';
        document.getElementById('input-table').innerHTML = '';
        document.getElementById('results').innerHTML = '';
        document.getElementById('contingency-info').innerHTML = '';
    }
}

// Initialize enhancements
document.addEventListener('DOMContentLoaded', () => {
    setupKeyboardNavigation();

    // Add event listeners for new buttons
    document.getElementById('export-btn').addEventListener('click', exportToCSV);
    document.getElementById('save-btn').addEventListener('click', saveState);
    document.getElementById('load-btn').addEventListener('click', loadState);
    document.getElementById('reset-btn').addEventListener('click', resetForm);
});

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
