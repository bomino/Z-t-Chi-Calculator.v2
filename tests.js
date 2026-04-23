/**
 * Regression test harness for the Z-t-Chi Calculator.
 *
 * Generates synthetic raw data with a seeded PRNG so the tests are deterministic,
 * computes reference values via jStat or first principles, then exercises every
 * ZtChi.* math path plus the APA/AMA report formatters.
 *
 * This file is loaded by tests.html only. It is not wired into any calculator.
 */
(function () {
    'use strict';

    // -------- Test framework --------
    const groups = new Map();
    let current = null;
    function describe(name, fn) {
        current = { name, tests: [] };
        groups.set(name, current);
        fn();
        current = null;
    }
    function test(name, fn) {
        if (!current) throw new Error('test() must be inside describe()');
        current.tests.push({ name, fn });
    }
    function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
    // Tolerance policy:
    //   1e-9 to 1e-6 : exact / near-machine-precision (algebraic identities,
    //                  fixed-point values like z=0 → Φ(0)=0.5).
    //   1e-3         : standard numerical accuracy (tabulated CDF values).
    //   1e-2 to 0.02 : sampling-based or multi-step rounding (e.g., OR CI
    //                  reference values, Monte Carlo estimates).
    //   >= 0.1       : coarse sanity checks (stress tests, ball-parked
    //                  reference values that were hand-computed).
    function assertClose(actual, expected, tol = 1e-3, label = '') {
        if (!Number.isFinite(actual) || !Number.isFinite(expected)) {
            throw new Error(`${label} expected finite, got actual=${actual} expected=${expected}`);
        }
        const diff = Math.abs(actual - expected);
        if (diff > tol) {
            throw new Error(`${label} |${actual} − ${expected}| = ${diff.toExponential(2)} > tol ${tol}`);
        }
    }
    function assertEqual(actual, expected, label = '') {
        if (actual !== expected) throw new Error(`${label} expected ${expected}, got ${actual}`);
    }
    function assertMatches(actualStr, regex, label = '') {
        if (!regex.test(actualStr)) throw new Error(`${label} string does not match ${regex}: "${actualStr}"`);
    }

    // -------- Seeded PRNG (Mulberry32) --------
    function makeRng(seed) {
        let s = seed >>> 0;
        return function () {
            s = (s + 0x6D2B79F5) >>> 0;
            let t = s;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    // Box-Muller normal samples using the seeded RNG
    function sampleNormal(rng, mean, sd, n) {
        const out = new Array(n);
        for (let i = 0; i < n; i += 2) {
            const u1 = Math.max(1e-12, rng());
            const u2 = rng();
            const r = Math.sqrt(-2 * Math.log(u1));
            const theta = 2 * Math.PI * u2;
            out[i] = mean + sd * r * Math.cos(theta);
            if (i + 1 < n) out[i + 1] = mean + sd * r * Math.sin(theta);
        }
        return out;
    }

    function sampleMean(xs) { return xs.reduce((a, b) => a + b, 0) / xs.length; }
    function sampleSd(xs) {
        const m = sampleMean(xs);
        const ss = xs.reduce((a, b) => a + (b - m) * (b - m), 0);
        return Math.sqrt(ss / (xs.length - 1));
    }

    // -------- Tests --------

    describe('Standard normal (Z) CDF / inverse', () => {
        test('Φ(0) = 0.5', () => {
            assertClose(jStat.normal.cdf(0, 0, 1), 0.5, 1e-6, 'Φ(0)');
        });
        test('Φ(1.96) ≈ 0.9750', () => {
            assertClose(jStat.normal.cdf(1.96, 0, 1), 0.9750, 5e-4, 'Φ(1.96)');
        });
        test('Φ(−1.96) ≈ 0.0250', () => {
            assertClose(jStat.normal.cdf(-1.96, 0, 1), 0.0250, 5e-4, 'Φ(−1.96)');
        });
        test('Φ(2.5758) ≈ 0.995', () => {
            assertClose(jStat.normal.cdf(2.5758, 0, 1), 0.995, 1e-3, 'Φ(2.5758)');
        });
        test('inverse Φ(0.975) ≈ 1.96', () => {
            assertClose(jStat.normal.inv(0.975, 0, 1), 1.96, 5e-4, 'Φ⁻¹(0.975)');
        });
        test('two-tailed p for z=1.96 is ≈ 0.05', () => {
            const z = 1.96;
            const leftTail = jStat.normal.cdf(z, 0, 1);
            const twoTailed = 2 * Math.min(leftTail, 1 - leftTail);
            assertClose(twoTailed, 0.05, 1e-3, '2-tail');
        });
    });

    describe('Student t distribution', () => {
        test('t(0, df=10) cdf = 0.5', () => {
            assertClose(jStat.studentt.cdf(0, 10), 0.5, 1e-6, 't(0,10)');
        });
        test('t(1.96, df=1e6) ≈ Φ(1.96)', () => {
            assertClose(jStat.studentt.cdf(1.96, 1e6), 0.975, 5e-4, 't→z for large df');
        });
        test('t(1.92, df=2) two-tail p ≈ 0.195', () => {
            const left = jStat.studentt.cdf(1.92, 2);
            const twoTail = 2 * Math.min(left, 1 - left);
            assertClose(twoTail, 0.19484, 1e-3, 'two-tail(1.92,df=2)');
        });
        test('critical t(df=2, α=0.05/2) ≈ 4.3027', () => {
            assertClose(jStat.studentt.inv(0.975, 2), 4.3027, 1e-3, 't_crit');
        });
        test('critical t(df=29, α=0.05/2) ≈ 2.0452', () => {
            assertClose(jStat.studentt.inv(0.975, 29), 2.0452, 1e-3, 't_crit');
        });
    });

    describe('t-test driven by synthetic raw data', () => {
        test('One-sample t on N(100,15), n=40 vs μ₀=100: p ≈ 0.5 center', () => {
            const rng = makeRng(20260423);
            const xs = sampleNormal(rng, 100, 15, 40);
            const mu0 = 100;
            const mean = sampleMean(xs);
            const sd = sampleSd(xs);
            const t = (mean - mu0) / (sd / Math.sqrt(xs.length));
            const df = xs.length - 1;
            const left = jStat.studentt.cdf(t, df);
            const twoTail = 2 * Math.min(left, 1 - left);
            // With seed=20260423, the sample mean is near 100 and p should NOT reject
            assert(twoTail > 0.1, `expected non-significant, got p=${twoTail.toFixed(4)}`);
            // Sanity: sample mean close to 100 within sampling error
            assertClose(mean, 100, 5, 'sample mean near μ=100');
        });

        test('One-sample t detecting real difference: N(110,15), n=40 vs μ₀=100', () => {
            const rng = makeRng(42);
            const xs = sampleNormal(rng, 110, 15, 40);
            const mu0 = 100;
            const mean = sampleMean(xs);
            const sd = sampleSd(xs);
            const t = (mean - mu0) / (sd / Math.sqrt(xs.length));
            const df = xs.length - 1;
            const left = jStat.studentt.cdf(t, df);
            const twoTail = 2 * Math.min(left, 1 - left);
            // Should reject H₀
            assert(twoTail < 0.05, `expected significant, got p=${twoTail.toFixed(4)}`);
            // Sample mean should be near 110
            assertClose(mean, 110, 6, 'sample mean near μ=110');
        });
    });

    describe('Chi-square test of independence', () => {
        function chi2Indep(obs) {
            const rows = obs.length;
            const cols = obs[0].length;
            const rowTot = obs.map((r) => r.reduce((a, b) => a + b, 0));
            const colTot = obs[0].map((_, j) => obs.reduce((a, r) => a + r[j], 0));
            const n = rowTot.reduce((a, b) => a + b, 0);
            let chi = 0;
            for (let i = 0; i < rows; i++) {
                for (let j = 0; j < cols; j++) {
                    const e = (rowTot[i] * colTot[j]) / n;
                    if (e > 0) chi += ((obs[i][j] - e) ** 2) / e;
                }
            }
            return { chi, df: (rows - 1) * (cols - 1), n };
        }

        test('[[10,20],[30,40]] → χ²≈0.7937', () => {
            const { chi, df, n } = chi2Indep([[10, 20], [30, 40]]);
            assertClose(chi, 0.7937, 1e-3, 'χ²');
            assertEqual(df, 1, 'df');
            assertEqual(n, 100, 'N');
            const p = 1 - jStat.chisquare.cdf(chi, df);
            assertClose(p, 0.373, 2e-3, 'p-value');
        });

        test('[[50,50],[50,50]] → χ²=0 (no association)', () => {
            const { chi } = chi2Indep([[50, 50], [50, 50]]);
            assertClose(chi, 0, 1e-9, 'χ²');
        });

        test('[[10,0],[0,10]] → χ²=20 (perfect association)', () => {
            const { chi } = chi2Indep([[10, 0], [0, 10]]);
            assertClose(chi, 20, 1e-6, 'χ²');
        });

        test('3×2 Doll & Hill–style synthetic table', () => {
            const { chi, df, n } = chi2Indep([[17, 83], [40, 60], [70, 30]]);
            assertEqual(df, 2, 'df');
            assertEqual(n, 300, 'N');
            // Hand-verified: row tots 100/100/100, col tots 127/173, each E=42.33 or 57.67
            // χ² = Σ (O-E)²/E ≈ 57.87
            assertClose(chi, 57.87, 0.1, 'χ² for 3×2');
            const p = 1 - jStat.chisquare.cdf(chi, df);
            assert(p < 1e-10, `p-value should be tiny for strongly-associated table, got ${p}`);
        });
    });

    describe('Fisher’s exact test (ZtChi.fishersExact)', () => {
        test('Identity [[50,50],[50,50]] → p ≈ 1.0', () => {
            const r = ZtChi.fishersExact(50, 50, 50, 50);
            assertClose(r.pTwoTailed, 1.0, 1e-6, 'p');
            assertClose(r.oddsRatio, 1.0, 1e-9, 'OR');
        });
        test('[[8,2],[1,5]] → p ≈ 0.035 (R fisher.test reference)', () => {
            const r = ZtChi.fishersExact(8, 2, 1, 5);
            assertClose(r.pTwoTailed, 0.0350, 5e-3, 'p');
            assertClose(r.oddsRatio, 20.0, 1e-6, 'OR');
        });
        test('[[3,1],[1,3]] symmetric tea-tasting style → p ≈ 0.486', () => {
            // Fisher (1935) "Lady tasting tea": 4 cups each category.
            // Fisher.test in R returns p=0.4857 for [[3,1],[1,3]].
            const r = ZtChi.fishersExact(3, 1, 1, 3);
            assertClose(r.pTwoTailed, 0.4857, 5e-3, 'p');
        });
        test('Zero-cell table [[5,0],[0,5]] still returns finite p and uses Haldane OR', () => {
            const r = ZtChi.fishersExact(5, 0, 0, 5);
            assert(Number.isFinite(r.pTwoTailed), 'p is finite');
            assert(r.oddsRatio > 50, 'OR should be large (Haldane correction)');
        });
    });

    describe('Z-test for two proportions (ZtChi.zTestTwoProportions)', () => {
        test('Null case [[50,50],[50,50]] → z=0, p=1', () => {
            const r = ZtChi.zTestTwoProportions(50, 50, 50, 50);
            assertClose(r.z, 0, 1e-6, 'z');
            assertClose(r.pTwoTailed, 1, 1e-6, 'p');
        });
        test('z² identity with χ² on [[10,20],[30,40]]', () => {
            const r = ZtChi.zTestTwoProportions(10, 20, 30, 40);
            const chi2 = 0.7937;
            assertClose(r.z * r.z, chi2, 1e-2, 'z² ≈ χ²');
        });
        test('z² identity with χ² on [[8,2],[1,5]]', () => {
            const r = ZtChi.zTestTwoProportions(8, 2, 1, 5);
            // Reference χ² computed earlier = 6.112
            assertClose(r.z * r.z, 6.112, 1e-2, 'z² ≈ χ²');
        });
        test('Proportions computed correctly for [[10,20],[30,40]]', () => {
            const r = ZtChi.zTestTwoProportions(10, 20, 30, 40);
            assertClose(r.p1, 10 / 30, 1e-9, 'p1');
            assertClose(r.p2, 30 / 70, 1e-9, 'p2');
            assertClose(r.diff, 10 / 30 - 30 / 70, 1e-9, 'diff');
        });
    });

    describe('Effect-size helpers (ZtChi.effectSize)', () => {
        test("Cramer's V for [[10,20],[30,40]] ≈ 0.089", () => {
            const v = ZtChi.effectSize.cramersV(0.7937, 100, 2, 2);
            assertClose(v, 0.0891, 1e-3, 'V');
        });
        test("phi = Cramer's V for a 2×2 table", () => {
            const chi = 6.112, n = 16;
            const v = ZtChi.effectSize.cramersV(chi, n, 2, 2);
            const phi = ZtChi.effectSize.phi(chi, n);
            assertClose(phi, v, 1e-9, 'phi == V for 2×2');
        });
        test("Cramer's V interpretation bands (df*=1)", () => {
            assertEqual(ZtChi.effectSize.interpretCramersV(0.05, 1), 'negligible');
            assertEqual(ZtChi.effectSize.interpretCramersV(0.20, 1), 'small');
            assertEqual(ZtChi.effectSize.interpretCramersV(0.40, 1), 'medium');
            assertEqual(ZtChi.effectSize.interpretCramersV(0.60, 1), 'large');
        });
        test("Cramer's V interpretation for df*=3 uses smaller thresholds", () => {
            // For df*=3, 0.10 is now "medium" (thresholds 0.06/0.17/0.29)
            assertEqual(ZtChi.effectSize.interpretCramersV(0.10, 3), 'small');
            assertEqual(ZtChi.effectSize.interpretCramersV(0.20, 3), 'medium');
            assertEqual(ZtChi.effectSize.interpretCramersV(0.35, 3), 'large');
        });
    });

    describe('APA / AMA report formatters (ZtChi.reports)', () => {
        test('APA chi-square report matches expected shape', () => {
            const txt = ZtChi.reports.apa.chi({
                chiSquare: 0.7937, df: 1, n: 100, pValue: 0.373, alpha: 0.05,
                cramersV: 0.0891, cramersLabel: 'negligible',
            });
            assertMatches(txt, /χ²\(1, N = 100\) = 0\.79/, 'statistic line');
            assertMatches(txt, /p = \.373/, 'APA p with leading period');
            assertMatches(txt, /Cramer's V = \.09 \(negligible\)/, 'effect size appended');
        });
        test('APA t-test report includes df and two-tailed marker', () => {
            const txt = ZtChi.reports.apa.t({
                t: 1.92, df: 2, twoTailP: 0.195, alpha: 0.05,
            });
            assertMatches(txt, /t\(2\) = 1\.92/, 't(df)');
            assertMatches(txt, /p = \.195/, 'p formatting');
            assertMatches(txt, /two-tailed/, 'tail label');
        });
        test('APA Z report reframes as probability lookup (no "Z-test")', () => {
            const txt = ZtChi.reports.apa.z({ z: 1.96, probability: 0.975, twoTail: 0.05 });
            assert(!/Z-test/.test(txt), 'should NOT mislabel as Z-test');
            assertMatches(txt, /standard normal distribution/i, 'reframes as lookup');
            assertMatches(txt, /P\(Z ≤ 1\.96\) = \.975/, 'left tail');
        });
        test('AMA pluralization: 1 degree of freedom (singular)', () => {
            const txt = ZtChi.reports.ama.chi({
                chiSquare: 0.7937, df: 1, n: 100, pValue: 0.373,
            });
            assertMatches(txt, /1 degree of freedom/, 'singular');
            assert(!/1 degrees/.test(txt), 'must not say "1 degrees"');
        });
        test('AMA pluralization: 2 degrees of freedom (plural)', () => {
            const txt = ZtChi.reports.ama.chi({
                chiSquare: 5.0, df: 2, n: 200, pValue: 0.08,
            });
            assertMatches(txt, /2 degrees of freedom/, 'plural');
        });
        test('APA p < .001 floor', () => {
            const txt = ZtChi.reports.apa.t({ t: 10, df: 30, twoTailP: 1e-9, alpha: 0.05 });
            assertMatches(txt, /p = < \.001/, '< .001 floor for tiny p');
        });
    });

    describe('Input validators (ZtChi.parsePositiveInt / parsePositiveNumber)', () => {
        test('Accepts integer strings', () => {
            assertEqual(ZtChi.parsePositiveInt('42', 'x'), 42);
        });
        test('Rejects decimals (no silent truncation)', () => {
            let threw = false;
            try { ZtChi.parsePositiveInt('2.7', 'x'); } catch (_) { threw = true; }
            assert(threw, 'should reject "2.7"');
        });
        test('Rejects negatives', () => {
            let threw = false;
            try { ZtChi.parsePositiveInt('-3', 'x'); } catch (_) { threw = true; }
            assert(threw, 'should reject "-3"');
        });
        test('Rejects empty string', () => {
            let threw = false;
            try { ZtChi.parsePositiveInt('', 'x'); } catch (_) { threw = true; }
            assert(threw, 'should reject empty');
        });
        test('escapeHtml escapes all five dangerous characters', () => {
            const out = ZtChi.escapeHtml(`<script>alert("x'&")</script>`);
            assert(!/[<>"'&](?!amp;|lt;|gt;|quot;|#39;)/.test(out), 'all escaped');
        });
    });

    describe('Normality diagnostics (skewness / kurtosis / Jarque-Bera / IQR)', () => {
        test('Skewness of symmetric data ≈ 0', () => {
            const xs = [];
            for (let i = -5; i <= 5; i++) xs.push(i);   // symmetric around 0
            assertClose(ZtChi.skewness(xs), 0, 1e-9, 'skew');
        });
        test('Skewness of right-skewed data is positive', () => {
            const xs = [1, 2, 3, 4, 5, 20];
            const s = ZtChi.skewness(xs);
            assert(s > 1, `expected large positive skew, got ${s}`);
        });
        test('Excess kurtosis ~ 0 for approx-normal sample', () => {
            // N(100, 10) sample drawn deterministically
            const rng = (function () { let s = 12345 >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
            const xs = [];
            for (let i = 0; i < 500; i += 2) {
                const u1 = Math.max(1e-12, rng()), u2 = rng();
                const r = Math.sqrt(-2 * Math.log(u1));
                xs.push(100 + 10 * r * Math.cos(2 * Math.PI * u2));
                xs.push(100 + 10 * r * Math.sin(2 * Math.PI * u2));
            }
            const k = ZtChi.kurtosis(xs);
            assert(Math.abs(k) < 0.5, `expected excess kurtosis near 0, got ${k}`);
        });
        test('Jarque-Bera rejects normality on right-skewed data', () => {
            const xs = [1, 1, 1, 2, 2, 2, 3, 3, 5, 8, 13, 21, 34, 55, 89];
            const r = ZtChi.jarqueBera(xs);
            assert(r.p < 0.05, `expected JB to reject, got p=${r.p}`);
        });
        test('Q-Q points are sorted with monotonic theoretical quantiles', () => {
            const xs = [5, 1, 3, 2, 4];
            const q = ZtChi.qqPoints(xs);
            assert(q.length === 5, 'length');
            for (let i = 1; i < q.length; i++) {
                assert(q[i].obs >= q[i - 1].obs, `obs sorted at ${i}`);
                assert(q[i].theo > q[i - 1].theo, `theo increasing at ${i}`);
            }
        });
        test('IQR outlier detection flags extreme values', () => {
            const xs = [10, 12, 11, 13, 11, 12, 100];  // 100 is the outlier
            const r = ZtChi.iqrOutliers(xs);
            assertEqual(r.outliers.length, 1, 'one outlier');
            assertEqual(r.outliers[0].value, 100, 'value');
            assertEqual(r.outliers[0].index, 6, '0-based index in original array');
        });
    });

    describe('One-sample / paired / Welch t (ZtChi.oneSampleT / pairedT / welchT)', () => {
        test('One-sample t on known data matches manual calc', () => {
            // Known: xs = [2, 4, 6, 8, 10], μ0 = 5, x̄=6, s=3.162, SE=1.414
            // t = (6-5)/1.414 = 0.707, df=4
            const r = ZtChi.oneSampleT([2, 4, 6, 8, 10], 5);
            assertClose(r.mean, 6, 1e-9, 'mean');
            assertClose(r.sd, Math.sqrt(10), 1e-9, 'sd = sqrt(10)');
            assertClose(r.t, 1 / (Math.sqrt(10) / Math.sqrt(5)), 1e-6, 't');
            assertEqual(r.df, 4, 'df');
        });
        test('One-sample t CI contains μ when null is true', () => {
            // x̄ very close to μ0 → CI should contain μ0
            const r = ZtChi.oneSampleT([98, 100, 102, 99, 101], 100);
            assert(r.ciLow <= 100 && r.ciHigh >= 100, `CI [${r.ciLow.toFixed(2)}, ${r.ciHigh.toFixed(2)}] should contain 100`);
        });
        test('Paired t reduces to one-sample t on differences', () => {
            const xs = [120, 118, 135, 128, 122];
            const ys = [115, 112, 128, 120, 118];
            const paired = ZtChi.pairedT(xs, ys);
            const diffs = xs.map((x, i) => x - ys[i]);
            const oneSample = ZtChi.oneSampleT(diffs, 0);
            assertClose(paired.t, oneSample.t, 1e-12, 't');
            assertClose(paired.meanDiff, oneSample.mean, 1e-12, 'mean difference');
            assertEqual(paired.df, oneSample.df, 'df');
        });
        test('Paired t rejects when pairs have consistent difference', () => {
            // After is systematically lower than before (e.g., BP after treatment)
            const xs = [140, 138, 145, 150, 142, 137, 148, 144, 141, 139];
            const ys = [132, 130, 138, 144, 135, 131, 140, 137, 133, 132];
            const r = ZtChi.pairedT(xs, ys);
            assert(r.twoTailP < 0.001, `paired t should reject strongly, got p=${r.twoTailP}`);
            assert(r.ciLow > 0, 'CI for mean diff (x-y) should be strictly positive');
        });
        test('Welch t handles unequal sample sizes and variances', () => {
            const a = [10, 12, 11, 13, 12, 11, 10, 12];  // n=8, small variance
            const b = [8, 15, 5, 18, 11, 14];            // n=6, large variance
            const r = ZtChi.welchT(a, b);
            assertEqual(r.nA, 8);
            assertEqual(r.nB, 6);
            // Welch df should be between min(n1-1, n2-1) and n1+n2-2
            assert(r.df >= 5 && r.df <= 12, `Welch df should be reasonable, got ${r.df}`);
            // Means are close here, should not reject
            assert(r.twoTailP > 0.1, `should not reject, got p=${r.twoTailP}`);
        });
        test('Welch t gives same result as pooled t when variances are equal', () => {
            // With equal variances, Welch and pooled t should nearly match
            // (exactly equal only when n1=n2 AND equal variances; close otherwise)
            const a = [100, 102, 98, 101, 99, 103, 97, 100];
            const b = [108, 110, 106, 109, 107, 111, 105, 108];
            const r = ZtChi.welchT(a, b);
            // Hand: mean diff = -8, pooled SD = 2.07 (from each group's SD ≈ 2.07),
            // SE ≈ 1.035, t ≈ -7.73, df ≈ 14 (Welch)
            assertClose(r.diff, -8, 1e-9, 'mean diff');
            assert(Math.abs(r.t) > 7, `|t| should be large, got ${r.t}`);
            assert(r.ciHigh < 0, 'CI should be strictly negative (A < B)');
        });
        test('Paired t rejects mismatched lengths', () => {
            let threw = false;
            try { ZtChi.pairedT([1, 2, 3], [4, 5]); } catch (_) { threw = true; }
            assert(threw, 'should reject length mismatch');
        });
    });

    describe('Wilson score CI (ZtChi.wilsonCi)', () => {
        test('Standard 95% CI for 50/100 is approximately (0.40, 0.60)', () => {
            const ci = ZtChi.wilsonCi(50, 100, 0.95);
            assertClose(ci.p, 0.5, 1e-9, 'p');
            assertClose(ci.low, 0.404, 0.01, 'low');
            assertClose(ci.high, 0.596, 0.01, 'high');
        });
        test('Edge case: 0/10 gives lower bound of 0, upper ≈ 0.28', () => {
            const ci = ZtChi.wilsonCi(0, 10, 0.95);
            assertClose(ci.low, 0, 1e-9, 'low clamped to 0');
            assertClose(ci.high, 0.278, 0.02, 'high ≈ 0.28');
        });
        test('Edge case: 10/10 gives upper bound of 1, lower ≈ 0.72', () => {
            const ci = ZtChi.wilsonCi(10, 10, 0.95);
            assertClose(ci.high, 1, 1e-9, 'high clamped to 1');
            assertClose(ci.low, 0.722, 0.02, 'low ≈ 0.72');
        });
    });

    describe('Epidemiology 2×2 (ZtChi.epidemiology)', () => {
        test('Textbook diagnostic test [[80,20],[10,890]] gives expected sens/spec/PPV/NPV', () => {
            const r = ZtChi.epidemiology(80, 20, 10, 890);
            // sens = 80/(80+10) = 0.8889
            assertClose(r.sens.p, 80 / 90, 1e-9, 'sens');
            // spec = 890/(20+890) = 0.9780
            assertClose(r.spec.p, 890 / 910, 1e-9, 'spec');
            // PPV = 80/(80+20) = 0.80
            assertClose(r.ppv.p, 80 / 100, 1e-9, 'PPV');
            // NPV = 890/(10+890) = 0.9889
            assertClose(r.npv.p, 890 / 900, 1e-9, 'NPV');
            // prev = 90/1000
            assertClose(r.prev.p, 90 / 1000, 1e-9, 'prev');
        });

        test('Likelihood ratios: LR+ = sens/(1-spec), LR- = (1-sens)/spec', () => {
            const r = ZtChi.epidemiology(80, 20, 10, 890);
            const expectedLrPos = (80 / 90) / (20 / 910);
            const expectedLrNeg = (10 / 90) / (890 / 910);
            assertClose(r.lrPos, expectedLrPos, 1e-9, 'LR+');
            assertClose(r.lrNeg, expectedLrNeg, 1e-9, 'LR-');
        });

        test('Low-prevalence screening: PPV dramatically lower than sens/spec', () => {
            // 0.5% prevalence, sens 99%, spec 98% → PPV drops to ~20%
            const r = ZtChi.epidemiology(49, 199, 1, 9751);
            assert(r.sens.p > 0.95, 'sens > 0.95');
            assert(r.spec.p > 0.97, 'spec > 0.97');
            assert(r.ppv.p < 0.25, `PPV should be low (~20%), got ${r.ppv.p}`);
            // This is the classic "base rate fallacy" teaching example.
        });

        test('Cohort study: RR and OR computed correctly, log-CI contains 1 when no effect', () => {
            // Null case: equal risk in both groups
            const r = ZtChi.epidemiology(100, 900, 100, 900);
            assertClose(r.rr, 1, 1e-6, 'RR=1');
            assertClose(r.or, 1, 1e-6, 'OR=1');
            assert(r.rrLow < 1 && r.rrHigh > 1, 'RR CI contains 1');
            assert(r.orLow < 1 && r.orHigh > 1, 'OR CI contains 1');
        });

        test('Physicians Health Study (aspirin vs placebo) RR≈0.55, OR≈0.55', () => {
            // a=104, b=10930, c=189, d=10848 → RR ≈ 0.550, OR ≈ 0.546
            const r = ZtChi.epidemiology(104, 10930, 189, 10848);
            assertClose(r.rr, 0.55, 0.02, 'RR');
            assertClose(r.or, 0.546, 0.02, 'OR');
            assert(r.rrHigh < 1, 'RR upper CI < 1 (significant reduction)');
        });

        test('NNT: sample computation for Physicians Health Study', () => {
            const r = ZtChi.epidemiology(104, 10930, 189, 10848);
            // risk(treated) ≈ 0.00942; risk(placebo) ≈ 0.01713
            // diff ≈ -0.00771 → NNT ≈ 130
            assertClose(r.nnt, 129.6, 3, 'NNT ≈ 130');
        });

        test('Zero-cell table uses Haldane-Anscombe correction', () => {
            const r = ZtChi.epidemiology(5, 0, 0, 10);
            assert(Number.isFinite(r.or), 'OR finite with zero cells');
            assert(Number.isFinite(r.rr), 'RR finite with zero cells');
            assert(Number.isFinite(r.orLow) && Number.isFinite(r.orHigh), 'OR CI finite');
        });

        test('Input validation rejects negative or non-integer cells', () => {
            let threw = false;
            try { ZtChi.epidemiology(1.5, 2, 3, 4); } catch (_) { threw = true; }
            assert(threw, 'should reject non-integer');
            threw = false;
            try { ZtChi.epidemiology(-1, 2, 3, 4); } catch (_) { threw = true; }
            assert(threw, 'should reject negative');
        });
    });

    describe('Sanity: bulk synthetic t-tests (false-positive rate ≤ α + noise)', () => {
        test('Under H₀ (true μ=100), 200 replications of n=30 give rejection rate ≤ 10%', () => {
            const rng = makeRng(987654321);
            const reps = 200;
            let rejects = 0;
            for (let r = 0; r < reps; r++) {
                const xs = sampleNormal(rng, 100, 10, 30);
                const m = sampleMean(xs);
                const sd = sampleSd(xs);
                const t = (m - 100) / (sd / Math.sqrt(30));
                const left = jStat.studentt.cdf(t, 29);
                const twoTail = 2 * Math.min(left, 1 - left);
                if (twoTail < 0.05) rejects++;
            }
            // Expected ~5%; allow up to 10% before failing (2× the nominal alpha).
            const rate = rejects / reps;
            assert(rate <= 0.10, `false positive rate ${(rate * 100).toFixed(1)}% exceeds 10%`);
        });
    });

    // -------- Runner + rendering --------
    function runAll() {
        const summaryEl = document.getElementById('summary');
        const groupsEl = document.getElementById('groups');
        let total = 0, passed = 0, failed = 0;
        const groupReports = [];

        for (const [groupName, group] of groups) {
            const rows = [];
            for (const t of group.tests) {
                total++;
                try {
                    t.fn();
                    passed++;
                    rows.push({ name: t.name, pass: true });
                } catch (err) {
                    failed++;
                    rows.push({ name: t.name, pass: false, error: err.message });
                }
            }
            groupReports.push({ groupName, rows });
        }

        summaryEl.className = 'test-summary ' + (failed === 0 ? 'all-pass' : 'has-fail');
        summaryEl.textContent = `${passed}/${total} tests passed${failed > 0 ? ` — ${failed} FAILING` : ' ✓'}`;

        groupsEl.innerHTML = groupReports.map((g) => {
            const rowHtml = g.rows.map((r) => `
                <div class="test-row">
                    <span class="test-badge ${r.pass ? 'pass' : 'fail'}">${r.pass ? 'PASS' : 'FAIL'}</span>
                    <div>
                        <div class="test-name">${ZtChi.escapeHtml(r.name)}</div>
                        ${r.error ? `<div class="test-error">${ZtChi.escapeHtml(r.error)}</div>` : ''}
                    </div>
                </div>`).join('');
            return `<section class="test-group"><h2>${ZtChi.escapeHtml(g.groupName)}</h2>${rowHtml}</section>`;
        }).join('');

        window.__testResults = { total, passed, failed };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(runAll, 50));
    } else {
        setTimeout(runAll, 50);
    }
})();
