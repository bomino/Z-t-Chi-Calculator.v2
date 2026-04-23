const { showNotification } = window.ZtChi;

document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('calculate-button').addEventListener('click', () => {
        if (window.ZtChi && window.ZtChi.predict) {
            window.ZtChi.predict.prompt('t', calculateT);
        } else {
            calculateT();
        }
    });
    document.getElementById('reset-button').addEventListener('click', resetForm);
    calculateT();
});

function calculateT() {
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) loadingIndicator.style.display = 'flex';

    try {
        const alpha = parseFloat(document.getElementById('alpha').value);
        const df = Number(document.getElementById('df').value);
        const tStat = parseFloat(document.getElementById('t-stat').value);

        if (isNaN(alpha) || alpha <= 0 || alpha >= 1) {
            throw new Error('Please enter a valid significance level strictly between 0 and 1.');
        }
        if (!Number.isFinite(df) || !Number.isInteger(df) || df < 1) {
            throw new Error('Degrees of freedom must be a positive whole number.');
        }
        if (isNaN(tStat)) {
            throw new Error('Please enter a valid t statistic.');
        }

        const leftTailP = jStat.studentt.cdf(tStat, df);
        const rightTailP = 1 - leftTailP;
        const twoTailP = 2 * Math.min(leftTailP, rightTailP);

        const leftCritical = jStat.studentt.inv(alpha, df);
        const rightCritical = jStat.studentt.inv(1 - alpha, df);
        const twoTailCritical = jStat.studentt.inv(1 - alpha / 2, df);

        document.getElementById('p-left').textContent = leftTailP.toFixed(8);
        document.getElementById('t-crit-left').textContent = leftCritical.toFixed(8);
        document.getElementById('p-right').textContent = rightTailP.toFixed(8);
        document.getElementById('t-crit-right').textContent = rightCritical.toFixed(8);
        document.getElementById('p-two').textContent = twoTailP.toFixed(8);
        document.getElementById('t-crit-two').textContent = `±${Math.abs(twoTailCritical).toFixed(8)}`;

        document.getElementById('summary-alpha').textContent = alpha.toFixed(4);
        document.getElementById('summary-df').textContent = df;
        document.getElementById('summary-t-stat').textContent = tStat.toFixed(4);

        const verdict = (p) => p < alpha ? 'Reject the null hypothesis' : 'Fail to reject the null hypothesis';
        const conclusion =
            'Based on the analysis:<br>' +
            `&bull; Two-tailed test: ${verdict(twoTailP)}<br>` +
            `&bull; Left-tailed test: ${verdict(leftTailP)}<br>` +
            `&bull; Right-tailed test: ${verdict(rightTailP)}`;

        document.getElementById('test-conclusion').innerHTML = conclusion;

        renderPostResult('t', {
            t: tStat,
            df,
            alpha,
            leftTailP,
            rightTailP,
            twoTailP,
            leftCritical,
            rightCritical,
            twoTailCritical,
        });

        if (window.ZtChi && window.ZtChi.predict && window.ZtChi.predict.reveal) {
            window.ZtChi.predict.reveal('t', twoTailP < alpha ? 'reject' : 'fail-to-reject', '#results');
        }
    } catch (error) {
        showNotification(error.message, 'error', { duration: 5000 });
    } finally {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
}

function renderPostResult(testType, ctx) {
    const { reports, showWork, checks } = window.ZtChi || {};
    if (reports && reports.setLatestContext) reports.setLatestContext(testType, ctx);

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

    const host = document.getElementById('results');
    if (host && host.parentNode) {
        host.parentNode.insertBefore(container, host.nextSibling);
    }

    if (showWork && showWork.typeset) showWork.typeset(container);
}

function resetForm() {
    if (!confirm('Are you sure you want to reset all values?')) return;

    document.getElementById('alpha').value = '0.05';
    document.getElementById('df').value = '2';
    document.getElementById('t-stat').value = '1.92';

    ['p-left', 't-crit-left', 'p-right', 't-crit-right', 'p-two', 't-crit-two'].forEach((id) => {
        document.getElementById(id).textContent = '-';
    });
    document.getElementById('summary-alpha').textContent = '-';
    document.getElementById('summary-df').textContent = '-';
    document.getElementById('summary-t-stat').textContent = '-';
    document.getElementById('test-conclusion').textContent = 'Enter values and click Calculate to see results.';
}
