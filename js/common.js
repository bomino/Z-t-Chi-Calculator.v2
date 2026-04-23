/**
 * Shared utilities used by every calculator. Loaded BEFORE any calculator-specific script.
 * Exports via the global `ZtChi` namespace to avoid polluting window.
 */
(function () {
    'use strict';

    const ZtChi = window.ZtChi || (window.ZtChi = {});

    ZtChi.escapeHtml = function escapeHtml(value) {
        const str = value == null ? '' : String(value);
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    };

    ZtChi.parsePositiveInt = function parsePositiveInt(raw, fieldName) {
        const trimmed = String(raw).trim();
        if (trimmed === '') {
            throw new Error(`${fieldName} cannot be empty.`);
        }
        const num = Number(trimmed);
        if (!Number.isFinite(num) || !Number.isInteger(num) || num < 0) {
            throw new Error(`${fieldName} must be a non-negative whole number (got "${raw}").`);
        }
        return num;
    };

    ZtChi.parsePositiveNumber = function parsePositiveNumber(raw, fieldName, { allowZero = false } = {}) {
        const trimmed = String(raw).trim();
        if (trimmed === '') {
            throw new Error(`${fieldName} cannot be empty.`);
        }
        const num = Number(trimmed);
        if (!Number.isFinite(num) || (allowZero ? num < 0 : num <= 0)) {
            throw new Error(`${fieldName} must be a positive number (got "${raw}").`);
        }
        return num;
    };

    ZtChi.csvEscape = function csvEscape(value) {
        const str = value == null ? '' : String(value);
        if (/[",\n\r]/.test(str)) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };

    /**
     * Toast notification. Replaces alert(). Always safe to call; auto-dismisses.
     * Level: 'success' | 'info' | 'warning' | 'error'
     */
    ZtChi.showNotification = function showNotification(message, level = 'success', { duration = 3000 } = {}) {
        const note = document.createElement('div');
        note.className = `notification ${level}`;
        note.setAttribute('role', level === 'error' || level === 'warning' ? 'alert' : 'status');
        note.textContent = message;
        document.body.appendChild(note);

        setTimeout(() => {
            note.style.opacity = '0';
            setTimeout(() => {
                if (note.parentNode) note.parentNode.removeChild(note);
            }, 300);
        }, duration);
    };

    /**
     * Wrap a handler so thrown Errors show as notifications instead of alert().
     * Lets calculator code keep using `throw new Error(...)` for validation.
     */
    ZtChi.guarded = function guarded(fn, { level = 'error' } = {}) {
        return function guardedHandler(...args) {
            try {
                return fn.apply(this, args);
            } catch (err) {
                ZtChi.showNotification(err && err.message ? err.message : String(err), level, { duration: 5000 });
            }
        };
    };

    ZtChi.formatNumber = function formatNumber(n, decimals = 4) {
        if (!Number.isFinite(n)) return String(n);
        return n.toFixed(decimals);
    };

    /**
     * Log-gamma from jStat, with a small-integer lookup for stability at n = 0, 1.
     */
    function logGamma(x) {
        if (x === 1 || x === 2) return 0;
        if (typeof jStat !== 'undefined' && typeof jStat.gammaln === 'function') {
            return jStat.gammaln(x);
        }
        // Stirling fallback — not expected to run when jStat is present
        return (x - 0.5) * Math.log(x) - x + 0.5 * Math.log(2 * Math.PI);
    }

    /**
     * log C(n, k) = log n! - log k! - log (n-k)!
     */
    function logBinomial(n, k) {
        if (k < 0 || k > n) return -Infinity;
        return logGamma(n + 1) - logGamma(k + 1) - logGamma(n - k + 1);
    }

    /**
     * Hypergeometric probability of a 2x2 table [[a, b], [c, d]] conditional on
     * its row and column marginals. Used by Fisher's exact test.
     */
    function hypergeometricProb(a, b, c, d) {
        const n = a + b + c + d;
        const logP = logBinomial(a + b, a) + logBinomial(c + d, c) - logBinomial(n, a + c);
        return Math.exp(logP);
    }

    /**
     * Fisher's exact test, two-tailed, for a 2x2 table.
     * Enumerates every table with the same marginals; sums probabilities that
     * are <= the probability of the observed table (the "method of small
     * p-values" — Fisher's original formulation; matches R's fisher.test default).
     *
     * Returns { pTwoTailed, oddsRatio, logOddsRatio, se }.
     */
    ZtChi.fishersExact = function fishersExact(a, b, c, d) {
        if (![a, b, c, d].every((v) => Number.isFinite(v) && v >= 0 && Number.isInteger(v))) {
            throw new Error("Fisher's exact test requires four non-negative integer cell counts.");
        }
        const r1 = a + b;   // row 1 total
        const r2 = c + d;   // row 2 total
        const c1 = a + c;   // col 1 total
        const n = r1 + r2;
        if (n === 0) return { pTwoTailed: NaN, oddsRatio: NaN };

        const pObs = hypergeometricProb(a, b, c, d);
        const tol = pObs * (1 + 1e-7);

        const aMin = Math.max(0, c1 - r2);
        const aMax = Math.min(r1, c1);

        let pTwo = 0;
        for (let ai = aMin; ai <= aMax; ai++) {
            const bi = r1 - ai;
            const ci = c1 - ai;
            const di = r2 - ci;
            const p = hypergeometricProb(ai, bi, ci, di);
            if (p <= tol) pTwo += p;
        }

        // Sample odds ratio with Haldane-Anscombe correction for zero cells
        const adj = (a === 0 || b === 0 || c === 0 || d === 0) ? 0.5 : 0;
        const or = ((a + adj) * (d + adj)) / ((b + adj) * (c + adj));
        const logOr = Math.log(or);
        const se = Math.sqrt(1 / (a + adj) + 1 / (b + adj) + 1 / (c + adj) + 1 / (d + adj));

        return {
            pTwoTailed: Math.min(1, pTwo),
            oddsRatio: or,
            logOddsRatio: logOr,
            se,
        };
    };

    /**
     * Z-test for the difference of two independent proportions, using the
     * pooled standard error (standard textbook version).
     *
     * Returns { z, pTwoTailed, p1, p2, diff, pooled, se, ciLow, ciHigh }
     * where the CI is for the difference using unpooled SE (Wald 95%).
     */
    ZtChi.zTestTwoProportions = function zTestTwoProportions(a, b, c, d) {
        const n1 = a + b;
        const n2 = c + d;
        if (n1 === 0 || n2 === 0) {
            return { z: NaN, pTwoTailed: NaN };
        }
        const p1 = a / n1;
        const p2 = c / n2;
        const pooled = (a + c) / (n1 + n2);
        const sePooled = Math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2));
        const z = sePooled === 0 ? 0 : (p1 - p2) / sePooled;
        const pTwo = 2 * (1 - (typeof jStat !== 'undefined' ? jStat.normal.cdf(Math.abs(z), 0, 1) : 0.5));
        const seUnpooled = Math.sqrt((p1 * (1 - p1)) / n1 + (p2 * (1 - p2)) / n2);
        const diff = p1 - p2;
        const crit = 1.959963984540054;
        return {
            z,
            pTwoTailed: pTwo,
            p1,
            p2,
            diff,
            pooled,
            se: sePooled,
            ciLow: diff - crit * seUnpooled,
            ciHigh: diff + crit * seUnpooled,
        };
    };

    /**
     * Summary statistics for a numeric array.
     */
    ZtChi.summaryStats = function summaryStats(xs) {
        const n = xs.length;
        if (n === 0) return { n: 0 };
        const mean = xs.reduce((a, b) => a + b, 0) / n;
        const ss = xs.reduce((a, b) => a + (b - mean) * (b - mean), 0);
        const sd = n > 1 ? Math.sqrt(ss / (n - 1)) : 0;
        const sorted = xs.slice().sort((a, b) => a - b);
        return {
            n, mean, sd,
            se: n > 1 ? sd / Math.sqrt(n) : 0,
            min: sorted[0], max: sorted[n - 1],
            median: n % 2 === 1 ? sorted[(n - 1) / 2] : 0.5 * (sorted[n / 2 - 1] + sorted[n / 2]),
        };
    };

    /**
     * One-sample t-test: H0: μ = μ0.
     * Returns t statistic, df = n − 1, SE, two-tailed p, and a CI for μ.
     */
    ZtChi.oneSampleT = function oneSampleT(xs, mu0, conf = 0.95) {
        if (!Array.isArray(xs) || xs.length < 2) {
            throw new Error('One-sample t-test needs at least 2 observations.');
        }
        const s = ZtChi.summaryStats(xs);
        const se = s.sd / Math.sqrt(s.n);
        const df = s.n - 1;
        const t = se === 0 ? 0 : (s.mean - mu0) / se;
        const left = jStat.studentt.cdf(t, df);
        const twoTail = 2 * Math.min(left, 1 - left);
        const alpha = 1 - conf;
        const tCrit = jStat.studentt.inv(1 - alpha / 2, df);
        return {
            mean: s.mean, sd: s.sd, n: s.n, se, t, df, mu0,
            leftTailP: left, rightTailP: 1 - left, twoTailP: twoTail,
            tCrit,
            ciLow: s.mean - tCrit * se,
            ciHigh: s.mean + tCrit * se,
            conf,
        };
    };

    /**
     * Paired t-test: H0: mean of (x − y) = 0.
     * Requires paired observations of equal length.
     */
    ZtChi.pairedT = function pairedT(xs, ys, conf = 0.95) {
        if (!Array.isArray(xs) || !Array.isArray(ys)) {
            throw new Error('Paired t-test needs two arrays.');
        }
        if (xs.length !== ys.length) {
            throw new Error(`Paired t-test requires equal-length samples (got ${xs.length} and ${ys.length}).`);
        }
        if (xs.length < 2) {
            throw new Error('Paired t-test needs at least 2 pairs.');
        }
        const diffs = xs.map((x, i) => x - ys[i]);
        const result = ZtChi.oneSampleT(diffs, 0, conf);
        return { ...result, diffs, meanDiff: result.mean };
    };

    /**
     * Welch's two-sample t-test: H0: μ1 = μ2, without assuming equal variances.
     * Uses the Welch-Satterthwaite approximation for df.
     */
    ZtChi.welchT = function welchT(xs, ys, conf = 0.95) {
        if (!Array.isArray(xs) || !Array.isArray(ys)) {
            throw new Error("Welch's t-test needs two arrays.");
        }
        if (xs.length < 2 || ys.length < 2) {
            throw new Error("Welch's t-test needs at least 2 observations in each group.");
        }
        const a = ZtChi.summaryStats(xs);
        const b = ZtChi.summaryStats(ys);
        const varA = a.sd * a.sd / a.n;
        const varB = b.sd * b.sd / b.n;
        const se = Math.sqrt(varA + varB);
        const t = se === 0 ? 0 : (a.mean - b.mean) / se;
        const df = Math.pow(varA + varB, 2) /
            (Math.pow(varA, 2) / (a.n - 1) + Math.pow(varB, 2) / (b.n - 1));
        const left = jStat.studentt.cdf(t, df);
        const twoTail = 2 * Math.min(left, 1 - left);
        const alpha = 1 - conf;
        const tCrit = jStat.studentt.inv(1 - alpha / 2, df);
        const diff = a.mean - b.mean;
        return {
            meanA: a.mean, meanB: b.mean, sdA: a.sd, sdB: b.sd,
            nA: a.n, nB: b.n, diff, se, t, df,
            leftTailP: left, rightTailP: 1 - left, twoTailP: twoTail,
            tCrit,
            ciLow: diff - tCrit * se,
            ciHigh: diff + tCrit * se,
            conf,
        };
    };

    /**
     * Wilson score confidence interval for a single proportion.
     * More accurate than Wald, especially for small n or extreme proportions.
     * Reference: Wilson (1927); Agresti & Coull (1998).
     */
    ZtChi.wilsonCi = function wilsonCi(k, n, conf = 0.95) {
        if (!Number.isFinite(k) || !Number.isFinite(n) || n <= 0 || k < 0 || k > n) {
            return { p: NaN, low: NaN, high: NaN };
        }
        const z = typeof jStat !== 'undefined' ? jStat.normal.inv((1 + conf) / 2, 0, 1) : 1.959963984540054;
        const p = k / n;
        const z2 = z * z;
        const denom = 1 + z2 / n;
        const center = (p + z2 / (2 * n)) / denom;
        const half = (z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n)) / denom;
        return { p, low: Math.max(0, center - half), high: Math.min(1, center + half) };
    };

    /**
     * Epidemiology helpers for a 2x2 table. Convention for a diagnostic-test
     * or cohort table:
     *
     *                      Disease +      Disease −
     *   Test + / Exposed :    a              b
     *   Test − / Unexposed:   c              d
     *
     * sens = a/(a+c), spec = d/(b+d), PPV = a/(a+b), NPV = d/(c+d),
     * prevalence = (a+c)/N, LR+ = sens/(1-spec), LR- = (1-sens)/spec,
     * risk ratio (exposed/unexposed) = [a/(a+b)] / [c/(c+d)],
     * odds ratio = (a*d)/(b*c), NNT = 1/|risk_exposed - risk_unexposed|.
     *
     * CIs: proportions use Wilson; RR and OR use log-transform Wald.
     */
    ZtChi.epidemiology = function epidemiology(a, b, c, d, conf = 0.95) {
        if (![a, b, c, d].every((v) => Number.isFinite(v) && v >= 0 && Number.isInteger(v))) {
            throw new Error('Epidemiology calculator requires four non-negative integer cell counts.');
        }
        const n = a + b + c + d;
        if (n === 0) throw new Error('Total must be > 0.');

        const sens = ZtChi.wilsonCi(a, a + c, conf);
        const spec = ZtChi.wilsonCi(d, b + d, conf);
        const ppv  = ZtChi.wilsonCi(a, a + b, conf);
        const npv  = ZtChi.wilsonCi(d, c + d, conf);
        const prev = ZtChi.wilsonCi(a + c, n, conf);

        // Likelihood ratios
        const lrPos = (sens.p) / (1 - spec.p);
        const lrNeg = (1 - sens.p) / (spec.p);

        // Risk ratio, log-Wald CI. Uses Haldane continuity if any cell is 0.
        const adj = (a === 0 || b === 0 || c === 0 || d === 0) ? 0.5 : 0;
        const aAdj = a + adj, bAdj = b + adj, cAdj = c + adj, dAdj = d + adj;
        const risk1 = aAdj / (aAdj + bAdj);    // row 1 risk (exposed)
        const risk2 = cAdj / (cAdj + dAdj);    // row 2 risk (unexposed)
        const rr = risk1 / risk2;
        const seLogRr = Math.sqrt(1 / aAdj - 1 / (aAdj + bAdj) + 1 / cAdj - 1 / (cAdj + dAdj));
        const zCrit = typeof jStat !== 'undefined' ? jStat.normal.inv((1 + conf) / 2, 0, 1) : 1.959963984540054;
        const logRr = Math.log(rr);
        const rrLow = Math.exp(logRr - zCrit * seLogRr);
        const rrHigh = Math.exp(logRr + zCrit * seLogRr);

        // Odds ratio, log-Wald CI (Haldane-corrected when needed).
        const or = (aAdj * dAdj) / (bAdj * cAdj);
        const seLogOr = Math.sqrt(1 / aAdj + 1 / bAdj + 1 / cAdj + 1 / dAdj);
        const logOr = Math.log(or);
        const orLow = Math.exp(logOr - zCrit * seLogOr);
        const orHigh = Math.exp(logOr + zCrit * seLogOr);

        // Absolute risk difference and NNT
        const riskDiff = risk1 - risk2;
        const nnt = riskDiff === 0 ? Infinity : 1 / Math.abs(riskDiff);

        return {
            n, a, b, c, d,
            sens, spec, ppv, npv, prev,
            lrPos, lrNeg,
            rr, rrLow, rrHigh,
            or, orLow, orHigh,
            riskDiff, nnt,
            conf,
        };
    };

    /**
     * Effect-size helpers.
     * Cramer's V: sqrt(χ² / (N * min(r-1, c-1)))  — ranges 0 to 1.
     * phi:        sqrt(χ² / N)                    — equivalent to V for 2x2 tables.
     *
     * Cohen (1988) conventions (depend on df* = min(r-1, c-1)):
     *   df* = 1 : small 0.10, medium 0.30, large 0.50
     *   df* = 2 : small 0.07, medium 0.21, large 0.35
     *   df* = 3 : small 0.06, medium 0.17, large 0.29
     *   df* ≥ 4 : small 0.05, medium 0.15, large 0.25
     */
    ZtChi.effectSize = {
        cramersV(chiSquare, n, rows, cols) {
            if (!Number.isFinite(chiSquare) || !Number.isFinite(n) || n <= 0) return NaN;
            const dfStar = Math.max(1, Math.min(rows - 1, cols - 1));
            return Math.sqrt(chiSquare / (n * dfStar));
        },
        phi(chiSquare, n) {
            if (!Number.isFinite(chiSquare) || !Number.isFinite(n) || n <= 0) return NaN;
            return Math.sqrt(chiSquare / n);
        },
        interpretCramersV(v, dfStar) {
            if (!Number.isFinite(v)) return 'undefined';
            const thresholds = (
                dfStar <= 1 ? { s: 0.10, m: 0.30, l: 0.50 } :
                dfStar === 2 ? { s: 0.07, m: 0.21, l: 0.35 } :
                dfStar === 3 ? { s: 0.06, m: 0.17, l: 0.29 } :
                               { s: 0.05, m: 0.15, l: 0.25 }
            );
            if (v < thresholds.s) return 'negligible';
            if (v < thresholds.m) return 'small';
            if (v < thresholds.l) return 'medium';
            return 'large';
        },
    };
})();
