const { showNotification } = window.ZtChi;

document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('calculate-z-to-p').addEventListener('click', calculateZtoP);
    document.getElementById('calculate-p-to-z').addEventListener('click', calculatePtoZ);

    document.getElementById('z-to-p').addEventListener('input', validateZInput);
    document.getElementById('p-to-z').addEventListener('input', validatePInput);
});

function validateZInput(event) {
    const input = event.target;
    const value = parseFloat(input.value);
    if (!isNaN(value) && (value < -6 || value > 6)) {
        input.setCustomValidity('Z-scores typically range from -6 to 6');
    } else {
        input.setCustomValidity('');
    }
}

function validatePInput(event) {
    const input = event.target;
    const value = parseFloat(input.value);
    if (!isNaN(value) && (value < 0 || value > 1)) {
        input.setCustomValidity('Probability must be between 0 and 1');
    } else {
        input.setCustomValidity('');
    }
}

function calculatePtoZ() {
    try {
        const probability = parseFloat(document.getElementById('p-to-z').value);

        if (isNaN(probability)) {
            throw new Error('Please enter a valid probability');
        }
        if (probability <= 0 || probability >= 1) {
            throw new Error('Probability must be strictly between 0 and 1 (exclusive)');
        }

        const zScore = jStat.normal.inv(probability, 0, 1);

        document.getElementById('p-to-z-result').textContent = zScore.toFixed(8);

        let interpretation = `For probability = ${probability.toFixed(4)}:<br>`;
        interpretation += `&bull; This represents the ${(probability * 100).toFixed(2)}th percentile<br>`;
        interpretation += `&bull; ${(probability * 100).toFixed(2)}% of the data falls below Z = ${zScore.toFixed(4)}<br>`;
        interpretation += `&bull; ${((1 - probability) * 100).toFixed(2)}% of the data falls above Z = ${zScore.toFixed(4)}`;

        document.getElementById('p-to-z-interpretation').innerHTML = interpretation;

    } catch (error) {
        showNotification(error.message, 'error', { duration: 5000 });
    }
}

function clearResults() {
    document.getElementById('z-to-p').value = '';
    document.getElementById('z-to-p-result').textContent = '-';
    document.getElementById('z-to-p-interpretation').innerHTML = '';

    document.getElementById('p-to-z').value = '';
    document.getElementById('p-to-z-result').textContent = '-';
    document.getElementById('p-to-z-interpretation').innerHTML = '';
}

function calculateZtoP() {
    try {
        const zScore = parseFloat(document.getElementById('z-to-p').value);

        if (isNaN(zScore)) {
            throw new Error('Please enter a valid Z-score');
        }
        if (zScore < -8 || zScore > 8) {
            throw new Error('Z-score out of range. Enter a value between -8 and 8.');
        }

        const probability = jStat.normal.cdf(zScore, 0, 1);
        const rightTail = 1 - probability;
        const twoTail = 2 * Math.min(probability, rightTail);

        document.getElementById('z-to-p-result').textContent = probability.toFixed(8);

        const interpretation = `
            <div class="interpretation-details">
                <div class="interpretation-section">
                    <h4>Statistical Summary for Z = ${zScore.toFixed(4)}</h4>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <span class="stat-label">Left-tail Probability:</span>
                            <span class="stat-value">P(Z &le; ${zScore.toFixed(4)}) = ${probability.toFixed(8)}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Right-tail Probability:</span>
                            <span class="stat-value">P(Z &gt; ${zScore.toFixed(4)}) = ${rightTail.toFixed(8)}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Two-tailed Probability:</span>
                            <span class="stat-value">P(|Z| &gt; ${Math.abs(zScore).toFixed(4)}) = ${twoTail.toFixed(8)}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Percentile:</span>
                            <span class="stat-value">${(probability * 100).toFixed(4)}th</span>
                        </div>
                    </div>
                </div>

                <div class="interpretation-section">
                    <h4>Practical Interpretation</h4>
                    <ul>
                        <li>${(probability * 100).toFixed(2)}% of the data falls below Z = ${zScore.toFixed(4)}</li>
                        <li>${(rightTail * 100).toFixed(2)}% of the data falls above Z = ${zScore.toFixed(4)}</li>
                        <li>This Z-score represents the ${(probability * 100).toFixed(2)}th percentile</li>
                        <li>${(twoTail * 100).toFixed(2)}% of the data falls beyond ${Math.abs(zScore).toFixed(4)} standard deviations from the mean in either direction</li>
                    </ul>
                </div>

                <div class="interpretation-section">
                    <h4>Common Applications</h4>
                    <div class="applications-grid">
                        <div class="application-item">
                            <h5>Confidence Intervals</h5>
                            <p>If using this Z-score for a confidence interval:</p>
                            <ul>
                                <li>Confidence Level: ${((1 - twoTail) * 100).toFixed(2)}%</li>
                                <li>Margin of Error: &plusmn;${Math.abs(zScore).toFixed(4)}&sigma;</li>
                            </ul>
                        </div>
                        <div class="application-item">
                            <h5>Hypothesis Testing</h5>
                            <p>If using as a critical value:</p>
                            <ul>
                                <li>Significance Level (&alpha;): ${twoTail.toFixed(4)} (two-tailed)</li>
                                <li>Type I Error Rate: ${(twoTail * 100).toFixed(2)}%</li>
                            </ul>
                        </div>
                    </div>
                </div>

                <div class="interpretation-section">
                    <h4>Standard Normal Distribution Properties</h4>
                    <ul>
                        <li>Mean (&mu;) = 0</li>
                        <li>Standard Deviation (&sigma;) = 1</li>
                        <li>This Z-score represents ${Math.abs(zScore).toFixed(4)} standard deviations from the mean</li>
                        <li>Direction: ${zScore > 0 ? 'Above' : zScore < 0 ? 'Below' : 'At'} the mean</li>
                    </ul>
                </div>
            </div>
        `;

        document.getElementById('z-to-p-interpretation').innerHTML = interpretation;
        document.getElementById('visualizations').innerHTML = generateVisualizations(zScore, probability);

        renderPostResult('z', { z: zScore, probability, rightTail, twoTail, alpha: 0.05 });

    } catch (error) {
        showNotification(error.message, 'error', { duration: 5000 });
    }
}

function renderPostResult(testType, ctx) {
    const { reports, showWork, checks } = window.ZtChi || {};

    const parts = [];
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

    const host = document.getElementById('visualizations');
    if (host && host.parentNode) {
        host.parentNode.insertBefore(container, host.nextSibling);
    }

    // setLatestContext AFTER insertion so it can update the freshly-inserted preview pane
    if (reports && reports.setLatestContext) reports.setLatestContext(testType, ctx);
    if (showWork && showWork.typeset) showWork.typeset(container);

    const { ai } = window.ZtChi || {};
    if (ai && ai.mount) {
        ai.mount(container, {
            test: testType,
            statistic: ctx.z,
            pValue: ctx.probability,
            twoTailed: ctx.twoTail,
            alpha: ctx.alpha || 0.05,
            method: 'one-sample Z',
        });
    }
}

function createNormalCurveVisualization(zScore, type) {
    const width = 400;
    const height = 200;
    const margin = 40;
    const curveWidth = width - 2 * margin;
    const curveHeight = height - 2 * margin;

    const displayZ = Math.max(-4, Math.min(4, zScore));

    function normalDensity(x) {
        return Math.exp(-(x * x) / 2) / Math.sqrt(2 * Math.PI);
    }

    function generateCurvePoints() {
        const points = [];
        for (let x = -4; x <= 4; x += 0.1) {
            const xPos = margin + ((x + 4) * curveWidth) / 8;
            const yPos = height - margin - (normalDensity(x) * curveHeight);
            points.push(`${xPos},${yPos}`);
        }
        return points.join(' ');
    }

    function generateShadedArea(zVal, shadeType) {
        let pathPoints = [];
        const baseY = height - margin;

        if (shadeType === 'left') {
            for (let x = -4; x <= zVal; x += 0.1) {
                const xPos = margin + ((x + 4) * curveWidth) / 8;
                const yPos = height - margin - (normalDensity(x) * curveHeight);
                pathPoints.push(`${xPos},${yPos}`);
            }
            const endX = margin + ((zVal + 4) * curveWidth) / 8;
            pathPoints.push(`${endX},${baseY}`);
            pathPoints.push(`${margin},${baseY}`);
        } else if (shadeType === 'right') {
            const startX = margin + ((zVal + 4) * curveWidth) / 8;
            pathPoints.push(`${startX},${baseY}`);
            for (let x = zVal; x <= 4; x += 0.1) {
                const xPos = margin + ((x + 4) * curveWidth) / 8;
                const yPos = height - margin - (normalDensity(x) * curveHeight);
                pathPoints.push(`${xPos},${yPos}`);
            }
            pathPoints.push(`${width - margin},${baseY}`);
        } else if (shadeType === 'both') {
            const absZ = Math.abs(zVal);
            for (let x = -4; x <= -absZ; x += 0.1) {
                const xPos = margin + ((x + 4) * curveWidth) / 8;
                const yPos = height - margin - (normalDensity(x) * curveHeight);
                pathPoints.push(`${xPos},${yPos}`);
            }
            pathPoints.push(`${margin + ((-absZ + 4) * curveWidth) / 8},${baseY}`);
            pathPoints.push(`${margin},${baseY}`);
            // Start a new SVG subpath for the right tail
            pathPoints.push('M');
            const startX = margin + ((absZ + 4) * curveWidth) / 8;
            pathPoints.push(`${startX},${baseY}`);
            for (let x = absZ; x <= 4; x += 0.1) {
                const xPos = margin + ((x + 4) * curveWidth) / 8;
                const yPos = height - margin - (normalDensity(x) * curveHeight);
                pathPoints.push(`${xPos},${yPos}`);
            }
            pathPoints.push(`${width - margin},${baseY}`);
        }

        return pathPoints.join(' ');
    }

    function generateXAxisTicks() {
        let ticks = '';
        for (let x = -3; x <= 3; x++) {
            if (x !== 0) {
                const xPos = margin + ((x + 4) * curveWidth) / 8;
                ticks += `
                    <line x1="${xPos}" y1="${height - margin - 5}" x2="${xPos}" y2="${height - margin + 5}"
                          stroke="black" stroke-width="1"/>
                    <text x="${xPos}" y="${height - margin + 20}"
                          text-anchor="middle" font-size="12">${x}</text>
                `;
            }
        }
        return ticks;
    }

    return `
        <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" class="normal-curve" role="img" aria-label="Standard normal distribution with z = ${zScore.toFixed(2)} marked">
            <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(0,0,0,0.1)" stroke-width="0.5"/>
                </pattern>
            </defs>
            <rect width="${width}" height="${height}" fill="url(#grid)" />

            <line x1="${margin}" y1="${height - margin}" x2="${width - margin}" y2="${height - margin}"
                  stroke="black" stroke-width="1.5"/>
            <line x1="${margin}" y1="${margin}" x2="${margin}" y2="${height - margin}"
                  stroke="black" stroke-width="1.5"/>

            ${generateXAxisTicks()}

            <text x="${margin}" y="${height - margin + 20}"
                  text-anchor="middle" font-size="12">0</text>

            <text x="${width / 2}" y="${height - 5}"
                  text-anchor="middle" font-size="14" font-weight="bold">Standard Normal Distribution</text>

            <polyline points="${generateCurvePoints()}"
                      fill="none" stroke="black" stroke-width="1.5"/>

            <path d="M ${generateShadedArea(displayZ, type)}"
                  fill="#2196F3" fill-opacity="0.3" stroke="none"/>

            <line x1="${margin + ((displayZ + 4) * curveWidth) / 8}"
                  y1="${height - margin - 5}"
                  x2="${margin + ((displayZ + 4) * curveWidth) / 8}"
                  y2="${height - margin + 5}"
                  stroke="#1976d2" stroke-width="2"/>
            <text x="${margin + ((displayZ + 4) * curveWidth) / 8}"
                  y="${height - margin + 20}"
                  text-anchor="middle"
                  fill="#1976d2"
                  font-weight="bold"
                  font-size="12">
                ${zScore.toFixed(2)}
            </text>

            <text x="${margin - 25}" y="${height / 2}"
                  text-anchor="middle"
                  transform="rotate(-90, ${margin - 25}, ${height / 2})"
                  font-size="12">Density</text>
        </svg>
    `;
}

function generateVisualizations(zScore, probability) {
    return `
        <div class="visualizations-container">
            <div class="probability-group">
                <div class="visualization-box">
                    <h4>Left-tail Probability: P(Z &lt; ${zScore.toFixed(2)})</h4>
                    ${createNormalCurveVisualization(zScore, 'left')}
                    <p>Area = ${probability.toFixed(4)}</p>
                </div>
            </div>

            <div class="probability-group">
                <div class="visualization-box">
                    <h4>Right-tail Probability: P(Z &gt; ${zScore.toFixed(2)})</h4>
                    ${createNormalCurveVisualization(zScore, 'right')}
                    <p>Area = ${(1 - probability).toFixed(4)}</p>
                </div>
            </div>

            <div class="probability-group">
                <div class="visualization-box">
                    <h4>Two-tailed Probability: P(|Z| &gt; ${Math.abs(zScore).toFixed(2)})</h4>
                    ${createNormalCurveVisualization(zScore, 'both')}
                    <p>Area = ${(2 * (1 - jStat.normal.cdf(Math.abs(zScore), 0, 1))).toFixed(4)}</p>
                </div>
            </div>
        </div>
    `;
}
