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
        const crit = typeof jStat !== 'undefined' ? jStat.normal.inv(0.975, 0, 1) : 1.959963984540054;
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
     * Dataset context banner. Renders an inline, dismissible card at the top
     * of the current page's <main> element when a calculator hydrates from
     * a dataset handoff. The payload must include at least `datasetName`;
     * `citation`, `context`, and `whatToLearn` are optional.
     */
    ZtChi.datasetBanner = {
        render(payload) {
            if (!payload || !payload.datasetName) return null;
            const existing = document.getElementById('dataset-context-banner');
            if (existing) existing.remove();

            const banner = document.createElement('aside');
            banner.id = 'dataset-context-banner';
            banner.className = 'dataset-context-banner no-print';
            banner.setAttribute('role', 'complementary');
            banner.setAttribute('aria-label', 'Loaded dataset context');

            const esc = ZtChi.escapeHtml || ((s) => s);
            const parts = [`<button type="button" class="banner-dismiss" aria-label="Dismiss context card">&times;</button>`];
            parts.push(`<div class="banner-kicker">Loaded dataset</div>`);
            parts.push(`<h3 class="banner-title">${esc(payload.datasetName)}</h3>`);
            if (payload.citation) parts.push(`<p class="banner-citation"><em>${esc(payload.citation)}</em></p>`);
            if (payload.context) parts.push(`<p class="banner-context">${esc(payload.context)}</p>`);
            if (payload.whatToLearn) parts.push(`<p class="banner-learn"><strong>What to look for:</strong> ${esc(payload.whatToLearn)}</p>`);
            banner.innerHTML = parts.join('');

            const main = document.querySelector('main[role="main"]') || document.querySelector('main');
            if (main) {
                main.insertBefore(banner, main.firstChild);
            } else {
                document.body.insertBefore(banner, document.body.firstChild);
            }
            banner.querySelector('.banner-dismiss').addEventListener('click', () => banner.remove());
            return banner;
        },
    };

    /**
     * Sample skewness (bias-corrected, a.k.a. "G1" in some references).
     *   g1 = (1/n) Σ ((x - x̄)/s)³
     *   G1 = sqrt(n(n-1))/(n-2) * g1
     * Returns NaN for n < 3 or zero variance.
     */
    ZtChi.skewness = function skewness(xs) {
        const n = xs.length;
        if (n < 3) return NaN;
        const mean = xs.reduce((a, b) => a + b, 0) / n;
        let m2 = 0, m3 = 0;
        for (let i = 0; i < n; i++) {
            const d = xs[i] - mean;
            m2 += d * d;
            m3 += d * d * d;
        }
        m2 /= n; m3 /= n;
        if (m2 === 0) return NaN;
        const g1 = m3 / Math.pow(m2, 1.5);
        return Math.sqrt(n * (n - 1)) / (n - 2) * g1;
    };

    /**
     * Sample kurtosis (excess kurtosis; 0 for a normal distribution).
     * Uses the unbiased "G2" estimator.
     */
    ZtChi.kurtosis = function kurtosis(xs) {
        const n = xs.length;
        if (n < 4) return NaN;
        const mean = xs.reduce((a, b) => a + b, 0) / n;
        let m2 = 0, m4 = 0;
        for (let i = 0; i < n; i++) {
            const d = xs[i] - mean;
            const d2 = d * d;
            m2 += d2;
            m4 += d2 * d2;
        }
        m2 /= n; m4 /= n;
        if (m2 === 0) return NaN;
        const g2 = m4 / (m2 * m2) - 3;
        const scale = (n - 1) / ((n - 2) * (n - 3));
        return scale * ((n + 1) * g2 + 6);
    };

    /**
     * Jarque-Bera test of normality.
     * JB = (n/6) * (S² + (K - 3)²/4) ~ χ²(2) asymptotically.
     * Note: uses the raw (biased) moment estimators so the classical JB
     * distribution applies. For small n (< 30) the chi-square approximation
     * is loose; Shapiro-Wilk is stricter but requires specialist code.
     */
    ZtChi.jarqueBera = function jarqueBera(xs) {
        const n = xs.length;
        if (n < 4) return { jb: NaN, p: NaN, n };
        const mean = xs.reduce((a, b) => a + b, 0) / n;
        let m2 = 0, m3 = 0, m4 = 0;
        for (let i = 0; i < n; i++) {
            const d = xs[i] - mean;
            const d2 = d * d;
            m2 += d2;
            m3 += d2 * d;
            m4 += d2 * d2;
        }
        m2 /= n; m3 /= n; m4 /= n;
        const S = m2 === 0 ? 0 : m3 / Math.pow(m2, 1.5);
        const K = m2 === 0 ? 3 : m4 / (m2 * m2);
        const jb = (n / 6) * (S * S + Math.pow(K - 3, 2) / 4);
        const p = Number.isFinite(jb) ? 1 - jStat.chisquare.cdf(jb, 2) : NaN;
        return { jb, p, skewness: S, excessKurtosis: K - 3, n };
    };

    /**
     * Theoretical vs observed points for a normal Q-Q plot.
     * Uses Blom's (1958) plotting-position formula: p_i = (i - 3/8) / (n + 1/4).
     * Returns sorted pairs { theo, obs, idx }.
     */
    ZtChi.qqPoints = function qqPoints(xs) {
        const sorted = xs.slice().sort((a, b) => a - b);
        const n = sorted.length;
        const out = new Array(n);
        for (let i = 0; i < n; i++) {
            const p = (i + 1 - 0.375) / (n + 0.25);
            out[i] = { theo: jStat.normal.inv(p, 0, 1), obs: sorted[i], idx: i + 1 };
        }
        return out;
    };

    /**
     * Standard boxplot-style outlier detection:
     *   outlier if obs < Q1 - 1.5*IQR or obs > Q3 + 1.5*IQR
     * Returns { lower, upper, outliers: [{value, index}] } using 0-based idx in the ORIGINAL (unsorted) xs.
     */
    ZtChi.iqrOutliers = function iqrOutliers(xs) {
        const n = xs.length;
        if (n < 4) return { q1: NaN, q3: NaN, iqr: NaN, lower: NaN, upper: NaN, outliers: [] };
        const sorted = xs.slice().sort((a, b) => a - b);
        const pct = (p) => {
            const pos = p * (n - 1);
            const lo = Math.floor(pos), hi = Math.ceil(pos);
            if (lo === hi) return sorted[lo];
            return sorted[lo] + (pos - lo) * (sorted[hi] - sorted[lo]);
        };
        const q1 = pct(0.25);
        const q3 = pct(0.75);
        const iqr = q3 - q1;
        const lower = q1 - 1.5 * iqr;
        const upper = q3 + 1.5 * iqr;
        const outliers = [];
        for (let i = 0; i < n; i++) {
            if (xs[i] < lower || xs[i] > upper) outliers.push({ value: xs[i], index: i });
        }
        return { q1, q3, iqr, lower, upper, outliers };
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
     * Shapiro-Wilk test for normality. Uses Royston's (1992) polynomial
     * approximation for the coefficients (a_i) and the p-value transform,
     * which gives good accuracy for 4 <= n <= 2000 — within that range the
     * test is widely considered the most powerful general-purpose normality
     * test and is the "gold standard" small-n referenced in the Assumption
     * Coach copy.
     *
     * Pipeline:
     *   1. Sort observations.
     *   2. Compute a_i coefficients from Royston's AS R94 (1992) approximation
     *      to the inverse-normal order statistics, adjusted for finite n.
     *   3. W = (Σ a_i * x_(i))² / Σ (x_i − x̄)².
     *   4. Transform W to a normal deviate via Royston's (1992) polynomial
     *      (different polynomials for n ≤ 11 vs n ≥ 12) and convert to p.
     *
     * References:
     *   - Shapiro & Wilk (1965). An analysis of variance test for normality
     *     (complete samples). Biometrika, 52(3/4), 591–611.
     *   - Royston, P. (1982). An extension of Shapiro and Wilk's W test for
     *     normality to large samples. Appl. Stat., 31(2), 115–124.
     *   - Royston, P. (1992). Approximating the Shapiro-Wilk W-test for
     *     non-normality. Stat. Comput., 2(3), 117–119.
     *
     * Returns { w, p, n, method, note } where `note` flags out-of-range
     * conditions (n < 4 → NaN, n > 2000 → warning that the polynomial
     * approximation degrades).
     */
    ZtChi.shapiroWilk = function shapiroWilk(xs) {
        const n = xs.length;
        if (n < 4) return { w: NaN, p: NaN, n, method: 'Shapiro-Wilk', note: 'needs at least 4 observations.' };
        if (n > 2000) {
            // Polynomial starts losing accuracy beyond here; still compute but flag.
        }

        const sorted = xs.slice().sort((a, b) => a - b);
        const mean = sorted.reduce((a, b) => a + b, 0) / n;
        const ss = sorted.reduce((a, b) => a + (b - mean) * (b - mean), 0);
        if (ss === 0) return { w: 1, p: 1, n, method: 'Shapiro-Wilk', note: 'all observations identical.' };

        // Royston (1992) coefficients — m_i = Φ^{-1}((i − 3/8) / (n + 1/4))
        const m = new Array(n);
        for (let i = 0; i < n; i++) m[i] = jStat.normal.inv((i + 1 - 3 / 8) / (n + 1 / 4), 0, 1);

        const mSum2 = m.reduce((a, b) => a + b * b, 0);
        const sqrtMSum2 = Math.sqrt(mSum2);
        const u = 1 / Math.sqrt(n);

        // a_{n} and a_{n-1} from Royston 1992 AS R94 polynomial fits to the
        // inverse of the covariance matrix of normal order statistics.
        const aN = -2.706056 * Math.pow(u, 5) + 4.434685 * Math.pow(u, 4)
                   - 2.071190 * Math.pow(u, 3) - 0.147981 * Math.pow(u, 2)
                   + 0.221157 * u + m[n - 1] / sqrtMSum2;
        const aNm1 = -3.582633 * Math.pow(u, 5) + 5.682633 * Math.pow(u, 4)
                     - 1.752460 * Math.pow(u, 3) - 0.293762 * Math.pow(u, 2)
                     + 0.042981 * u + m[n - 2] / sqrtMSum2;

        const a = new Array(n);
        let epsilon;
        if (n === 3) {
            a[0] = -Math.sqrt(1 / 2);
            a[2] = Math.sqrt(1 / 2);
            a[1] = 0;
        } else if (n <= 5) {
            epsilon = (mSum2 - 2 * m[n - 1] * m[n - 1]) / (1 - 2 * aN * aN);
            for (let i = 1; i < n - 1; i++) a[i] = m[i] / Math.sqrt(epsilon);
            a[0] = -aN;
            a[n - 1] = aN;
        } else {
            epsilon = (mSum2 - 2 * m[n - 1] * m[n - 1] - 2 * m[n - 2] * m[n - 2])
                     / (1 - 2 * aN * aN - 2 * aNm1 * aNm1);
            for (let i = 2; i < n - 2; i++) a[i] = m[i] / Math.sqrt(epsilon);
            a[0] = -aN;
            a[1] = -aNm1;
            a[n - 2] = aNm1;
            a[n - 1] = aN;
        }

        let numerator = 0;
        for (let i = 0; i < n; i++) numerator += a[i] * sorted[i];
        const w = (numerator * numerator) / ss;

        // Royston 1992 p-value transform. Different polynomials for n ∈ [4, 11]
        // vs n ∈ [12, 2000].
        let p;
        if (n <= 11) {
            const gamma = -2.273 + 0.459 * n;
            const mu = 0.5440 - 0.39978 * n + 0.025054 * n * n - 0.0006714 * n * n * n;
            const sigma = Math.exp(1.3822 - 0.77857 * n + 0.062767 * n * n - 0.0020322 * n * n * n);
            const wLog = -Math.log(gamma - Math.log(1 - w));
            const z = (wLog - mu) / sigma;
            p = 1 - jStat.normal.cdf(z, 0, 1);
        } else {
            const logN = Math.log(n);
            const mu = -1.5861 - 0.31082 * logN - 0.083751 * logN * logN + 0.0038915 * logN * logN * logN;
            const sigma = Math.exp(-0.4803 - 0.082676 * logN + 0.0030302 * logN * logN);
            const wLog = Math.log(1 - w);
            const z = (wLog - mu) / sigma;
            p = 1 - jStat.normal.cdf(z, 0, 1);
        }

        return {
            w, p, n,
            method: 'Shapiro-Wilk (Royston 1992 approximation)',
            note: n > 2000 ? 'n > 2000: Royston\'s polynomial approximation begins to degrade.' : null,
        };
    };

    /**
     * Rank a numeric array with midrank convention for ties.
     * Returns an array of ranks in the original order. Also returns the
     * tie-correction sum Σ(t³ − t) summed over all tie groups of size t,
     * used by Wilcoxon and Mann-Whitney variance corrections.
     */
    function rankWithTies(xs) {
        const n = xs.length;
        const indexed = xs.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
        const ranks = new Array(n);
        let tieCorrection = 0;
        let i = 0;
        while (i < n) {
            let j = i + 1;
            while (j < n && indexed[j].v === indexed[i].v) j++;
            const groupSize = j - i;
            const avgRank = (i + j + 1) / 2; // average of ranks i+1..j (1-indexed)
            for (let k = i; k < j; k++) ranks[indexed[k].i] = avgRank;
            if (groupSize > 1) tieCorrection += groupSize * groupSize * groupSize - groupSize;
            i = j;
        }
        return { ranks, tieCorrection };
    }

    /**
     * Wilcoxon signed-rank test (one-sample / paired).
     * Tests H0: median of the (paired) differences equals mu0. Equivalent
     * to the one-sample median test for a single vector vs mu0.
     *
     * Approach: compute d_i = x_i − mu0 (or paired differences), drop zeros
     * per Pratt's / Wilcoxon's convention (we drop them), rank |d_i| with
     * midranks, sum the ranks of positive d_i to get W+. The null-distribution
     * mean and variance with tie correction:
     *   E[W+]   = n(n+1)/4
     *   Var[W+] = n(n+1)(2n+1)/24 − ΣT/48     where ΣT = Σ(t³ − t) over tie groups
     *
     * For n ≥ 10 we use a z approximation with continuity correction; for
     * smaller n we also fall back on the same approximation but flag that
     * the exact distribution would be more accurate (not implemented here).
     *
     * Returns { wPlus, wMinus, n, z, pTwoTailed, mu0, zerosDropped, method }.
     * Reference: Wilcoxon (1945); Hollander, Wolfe & Chicken (2014, ch. 3).
     */
    ZtChi.wilcoxonSignedRank = function wilcoxonSignedRank(xs, mu0 = 0) {
        if (!Array.isArray(xs) || xs.length < 2) {
            throw new Error('Wilcoxon signed-rank needs at least 2 observations.');
        }
        const diffs = xs.map((x) => x - mu0);
        const nonZero = diffs.filter((d) => d !== 0);
        const zerosDropped = diffs.length - nonZero.length;
        const n = nonZero.length;
        if (n < 2) throw new Error('After dropping zero differences, fewer than 2 observations remain.');

        const absDiffs = nonZero.map(Math.abs);
        const { ranks, tieCorrection } = rankWithTies(absDiffs);
        let wPlus = 0;
        for (let i = 0; i < n; i++) if (nonZero[i] > 0) wPlus += ranks[i];
        const wMinus = (n * (n + 1)) / 2 - wPlus;

        const mean = (n * (n + 1)) / 4;
        const varW = (n * (n + 1) * (2 * n + 1)) / 24 - tieCorrection / 48;
        const sd = Math.sqrt(varW);
        const cc = wPlus > mean ? -0.5 : wPlus < mean ? 0.5 : 0;
        const z = sd === 0 ? 0 : (wPlus - mean + cc) / sd;
        const pTwoTailed = 2 * (1 - jStat.normal.cdf(Math.abs(z), 0, 1));

        return {
            wPlus, wMinus, n, z, pTwoTailed, mu0, zerosDropped,
            method: 'Wilcoxon signed-rank (normal approximation with continuity correction)',
            note: n < 10 ? 'n < 10: exact distribution would be more accurate than the normal approximation.' : null,
        };
    };

    /**
     * Wilcoxon rank-sum test (Mann-Whitney U, two independent samples).
     * Tests H0: the two samples come from the same distribution (equivalently,
     * P(X < Y) = 0.5 for independent X from xs and Y from ys).
     *
     * Approach: combine samples, rank with midranks, sum the ranks in group
     * xs. The null-distribution mean and variance with tie correction:
     *   E[Wx] = n1(n1+n2+1)/2
     *   Var   = n1*n2*(N+1)/12 * (1 − ΣT / (N³ − N))     N = n1+n2
     *
     * For small samples the exact distribution would be more accurate; we use
     * the normal approximation with continuity correction for consistency.
     *
     * Returns { wx, u1, u2, n1, n2, z, pTwoTailed, method }.
     * Reference: Mann & Whitney (1947); Hollander, Wolfe & Chicken (2014, ch. 4).
     */
    ZtChi.wilcoxonRankSum = function wilcoxonRankSum(xs, ys) {
        if (!Array.isArray(xs) || !Array.isArray(ys)) {
            throw new Error('Wilcoxon rank-sum needs two arrays.');
        }
        if (xs.length < 1 || ys.length < 1) {
            throw new Error('Both groups must have at least one observation.');
        }
        const n1 = xs.length;
        const n2 = ys.length;
        const N = n1 + n2;
        const combined = xs.concat(ys);
        const { ranks, tieCorrection } = rankWithTies(combined);
        let wx = 0;
        for (let i = 0; i < n1; i++) wx += ranks[i];
        const u1 = wx - (n1 * (n1 + 1)) / 2;
        const u2 = n1 * n2 - u1;

        const mean = (n1 * (N + 1)) / 2;
        const variance = ((n1 * n2) / 12) * ((N + 1) - tieCorrection / (N * (N - 1)));
        const sd = Math.sqrt(variance);
        const cc = wx > mean ? -0.5 : wx < mean ? 0.5 : 0;
        const z = sd === 0 ? 0 : (wx - mean + cc) / sd;
        const pTwoTailed = 2 * (1 - jStat.normal.cdf(Math.abs(z), 0, 1));

        return {
            wx, u1, u2, n1, n2, z, pTwoTailed,
            method: 'Wilcoxon rank-sum / Mann-Whitney U (normal approximation with continuity correction)',
            note: Math.min(n1, n2) < 10 ? 'smaller group < 10: exact distribution would be more accurate.' : null,
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
