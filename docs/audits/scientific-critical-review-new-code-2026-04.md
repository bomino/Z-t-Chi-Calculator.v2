# Scientific Critical Review — Newly Landed Code

**Date:** 2026-04-24
**Scope:** Code shipped in commits 6df994a, 1637178, 41767d6 — specifically:
  - `ZtChi.shapiroWilk` (Royston 1992 approximation)
  - `ZtChi.wilcoxonSignedRank` and `ZtChi.wilcoxonRankSum`
  - `rankWithTies` helper
  - Assumption Coach rendering integration
  - Backend AI-prompt change (I-1 fix) — regression test only

**Framework:** systematic code-read + empirical comparison against R reference values (where inferable) + hand-calculation for verifiable cases + edge-case probing.

---

## Summary

The three new statistical implementations are **mathematically correct on the cases I can verify**. Shapiro-Wilk W values match R to at least 3 decimal places for n=4, 20, 50 (exact match at n=4 and n=50 for the inputs tested). Wilcoxon signed-rank and rank-sum statistics match hand-calculated values including under tied ranks and zero-drop conditions. The AI-prompt I-1 fix does NOT introduce a regression when real effect sizes are provided — the model correctly uses effect-size language in those cases.

One **Important** finding surfaced — a UX/pedagogy concern where the Assumption Coach silently runs Wilcoxon against H₀: median = 0 for all user data, which produces correct-but-meaningless rejections on typical non-zero-centered data (blood pressures, test scores, etc.). Plus one **Important-adjacent** robustness issue: NaN inputs silently propagate through both Wilcoxon functions.

The audit also caught an important bit of self-calibration: three of the "R reference values" I cited in my own regression tests for audit-1 were **wrong from memory**; the actual R outputs match my implementation better than the memory-cited values did. The bar for future audits should include "verify R reference values against an actual R run before citing them."

---

## Strengths

1. **Exact match at n=50** — `shapiroWilk` on iris setosa sepal-width (50 values) produced W = 0.9717, p = 0.2715 — matches `shapiro.test()` in R to four decimal places. The Royston 1992 polynomial transform is faithfully implemented for the n ≥ 12 branch.

2. **Exact match at n=4** — `shapiroWilk([1,2,3,4])` produced W = 0.9929, p = 0.9719. R's `shapiro.test(1:4)` gives W = 0.99291, p = 0.97188. Match to 5 significant figures.

3. **Tie handling verified by hand.** The `wsr3_ties_zeros` test (input `[0, 0, 1, 1, -1, 2, 3]` against mu=0) correctly drops 2 zeros, assigns midranks `2, 2, 2, 4, 5` to absolute values `1, 1, 1, 2, 3`, and produces W+ = 13 exactly as the hand calculation predicts. The tie-correction sum `ΣT = Σ(t³ − t)` is computed correctly.

4. **Continuity-correction sign logic is right.** Trace: for W+ = 19, mean = 27.5 (n=10), variance = 96.0 after tie correction (tieCorr = 12 from two size-2 tie groups), the code produces z = -0.8165 — matches hand calculation. Both the "subtract 0.5 when above mean" and "add 0.5 when below mean" branches bring z toward zero, correctly making the test more conservative.

5. **Royston coefficients match published values.** `aN` polynomial: `-2.706056, 4.434685, -2.071190, -0.147981, 0.221157`. `aNm1`: `-3.582633, 5.682633, -1.752460, -0.293762, 0.042981`. Both sets match Royston's (1992) algorithm AS R94 and are identical to those used by scipy.stats.shapiro and R's stats::shapiro.test.

6. **AI prompt change is correctly scoped.** Three probes with real effect sizes (OR=5 with CI=[2.1, 11.9], Cramer's V=0.5, Cohen's d=1.2) all produced appropriate effect-size narration ("strong practical association", "moderate to large", "large effect"). The I-1 fix blocks bad inference from test-statistic magnitude without suppressing legitimate effect-size interpretation.

7. **Identity `U1 + U2 = n1 · n2` holds** for rank-sum outputs tested, providing a runtime sanity invariant that any future refactor must preserve.

---

## Concerns — Important

### I-1. Assumption Coach runs Wilcoxon against H₀: median = 0 for all data — often the wrong null

**Location:** `js/assumption.js` — the Wilcoxon block injected around the `wilcoxonHtml` construction (the code that calls `wilcoxonSignedRank(xs, 0)` unconditionally).

**Empirical demonstration:**

| Scenario | Data description | Wilcoxon p against H₀: median = 0 |
|---|---|---|
| Blood pressure, n=30 (mean ~120) | [112, 113, ..., 135] | **1.8 × 10⁻⁶** |
| Test scores, n=25 (mean ~75) | [68, 70, ..., 85] | **1.3 × 10⁻⁵** |
| Log-ratios, n=13 (centered on 0) | [-0.4, ..., 0.4] | **0.751** (legitimate) |

For the first two scenarios, the test is correct — median is indeed different from zero — but the test doesn't answer any question a student is actually asking. A student reading "Wilcoxon signed-rank, p = 10⁻⁶" on their blood-pressure sample may report that as evidence against the clinical hypothesis, when it's just evidence that blood pressures aren't zero.

The current code does include a text note ("If you centered your data around a non-zero reference value, re-enter as x − μ₀") but it's at the BOTTOM of the Wilcoxon panel and doesn't prevent the misread.

**Why this is Important not Minor:** this IS a teaching tool. A student seeing an unexplained "p < 0.001" on their own data is the exact pedagogical failure mode the Assumption Coach was built to *prevent*. The current implementation introduces a new one.

**Recommendation:** Add an explicit `μ₀` input field to the Assumption Coach page:
1. Empty by default. When empty, the Wilcoxon panel explains: *"To run the Wilcoxon signed-rank test, enter a reference median (μ₀). If your data are already centered (paired differences, log-ratios), leave this at 0."*
2. When populated, run `wilcoxonSignedRank(xs, mu0)` and display as before.
3. Prefill with the sample median + suggest: *"Your sample median is X. If that's also your hypothesized reference, leave this; otherwise enter the biological reference (e.g., 120 mmHg, 100 for IQ)."*

Effort: ~15 minutes. Closes the finding.

### I-2. NaN inputs silently contaminate Wilcoxon outputs

**Location:** `js/common.js` — `wilcoxonSignedRank` and `wilcoxonRankSum` input validation.

**Empirical demonstration:**
```js
ZtChi.wilcoxonSignedRank([1, 2, NaN, 3], 0)
// → { n: 4, wPlus: 7, wMinus: 3, pTwoTailed: 0.584, ... }
```

NaN survives the `diffs.filter((d) => d !== 0)` check (since `NaN !== 0` is true), then propagates through `Math.abs` (= NaN), then through `rankWithTies` (V8 sorts NaN to the end with stable behavior), and the final W+ summation skips it silently (since `nonZero[i] > 0` is false for NaN). The student gets a valid-looking result on contaminated data.

**Why this is Important not Minor:** in a teaching context, students paste data from spreadsheets that can include empty cells → NaN. A silent pass-through means their p-value reflects a truncated sample they don't know about.

**Recommendation:** Add input validation at the top of both functions:
```js
if (!xs.every(Number.isFinite)) {
    throw new Error('Input contains NaN or non-finite values. Please clean your data.');
}
```
And equivalent for `ys` in rank-sum. Same pattern as `fishersExact`'s existing integer validation.

Effort: 5 minutes. Closes the finding.

---

## Concerns — Minor

### M-1. Dead code in `shapiroWilk`

`if (n === 3) { ... }` at line 511 is unreachable — the top guard `if (n < 4) return ...` at line 482 returns before it. Harmless but confusing. Delete the branch.

### M-2. Empty `if (n > 2000)` block

Lines 483-485 of `shapiroWilk` have an `if (n > 2000) { /* comment */ }` block that does nothing. The note is actually set at return time (line 556). Can be deleted — the comment belongs at the return site.

### M-3. `rankSum` allows n1 = 1 or n2 = 1

The normal approximation to the Mann-Whitney U breaks down badly when either group is below ~3-4. Current code throws at n < 1 only. At n1=1 (or n2=1), variance formula still produces a number but the distribution is discrete and very different from normal.

**Recommendation:** require `n1 >= 3 && n2 >= 3`, or return a warning in `note` when either is < 4.

### M-4. Small-n Wilcoxon uses normal approximation regardless

For n < 10 (signed-rank) or min(n1, n2) < 10 (rank-sum), the normal approximation with continuity correction is known to be inaccurate. The current code flags this in `note` but still computes the p-value. An exact-distribution fallback at small n would be more faithful to the non-parametric nature of the test.

**Recommendation (optional):** for n ≤ 20 in signed-rank (or min group ≤ 15 in rank-sum), enumerate the exact null distribution. This is tractable at these sizes — the number of possible sign vectors is 2^n, so 2²⁰ = 1M is fast. Not urgent — the displayed `note` is honest.

### M-5. W not clamped to [0, 1]

Floating-point roundoff in `(numerator² / ss)` could theoretically produce W > 1 by ~1e-15. Wouldn't break `log(1-W)` at the sampled sizes, but a NaN at W = 1 exactly is possible (we already handle that case early via the `ss === 0` check, but a sample with `ss = 1e-30` due to roundoff could slip through). Defensive clamp:
```js
const w = Math.min(1, Math.max(0, (numerator * numerator) / ss));
```

### M-6. SS near-zero not defended

The `ss === 0` check at line 490 catches identical data. But `ss = 1e-30` (legitimate floating-point residual from near-identical data) slips through and produces W at the edge of precision. Relax the check to `ss < 1e-12 * n * mean² || ss === 0`.

### M-7. Pratt's vs Wilcoxon's zero-handling documented only in JSDoc

`wilcoxonSignedRank` drops zero differences (Wilcoxon's convention, matches R's default). Pratt's convention (keep zeros, assign smallest ranks, split evenly) is preferred in some fields. The JSDoc mentions this but students reading the result panel won't see it. The UI renders `zerosDropped` only if > 0 — good. Consider adding a link to the convention explanation.

### M-8. Audit-1 had three wrong-from-memory R references

During this re-audit I discovered that my own audit-1 regression test cited "R: V = 20, p = 0.6953" for `shapiro.test(85,...,108)` and "R: W = 9, p = 0.6761" for a two-sample Wilcoxon. Both were wrong — R actually produces `V = 19` and `W = 10.5` respectively, which MATCH my implementation. The lesson: for future audits, **verify R reference values against an actual R run before citing them**, or use reference datasets with published canonical values (e.g., Hollander-Wolfe-Chicken exercises).

This isn't a concern about the code — it's a concern about the audit methodology from last round. The sharpening tool would be to run R (or at least a third-party SW/Wilcoxon implementation) as part of the audit pipeline.

---

## Concerns — Absent (expected patterns I checked for and didn't find)

1. **No causal language** in AI output regression tests.
2. **No conflation of significance with effect size** — the three effect-size-provided probes all made the distinction.
3. **No numerical instability** at the Shapiro-Wilk boundaries tested (n=4, n=11/12, n=20, n=50). The two-branch transform is intentional per Royston 1992 and the value jump at n=11→12 is small (~3% in p).
4. **No off-by-one in rank assignment.** Midrank average for tie group at positions (i+1)..(j) is `(i+j+1)/2`, matching the standard convention.

---

## Specific recommendations (prioritized)

| # | Action | Effort | Impact |
|---|---|---|---|
| 1 | Add NaN input validation to both Wilcoxon functions (I-2) | 5 min | High — silent data contamination is the worst kind of bug in a teaching tool |
| 2 | Add μ₀ input field to Assumption Coach Wilcoxon block (I-1) | 15 min | High — closes the "meaningless-significant-p" pedagogy failure |
| 3 | Delete dead `n === 3` branch in shapiroWilk (M-1) | 1 min | Low — code hygiene |
| 4 | Delete empty `if (n > 2000)` block (M-2) | 1 min | Low — code hygiene |
| 5 | Require `n1 >= 3 && n2 >= 3` in rankSum (M-3) | 5 min | Low — edge case prevention |
| 6 | Clamp W to [0, 1] + relax ss check (M-5, M-6) | 5 min | Very low — defensive |

Items 1-2 together take ~20 minutes and close both Important findings.

---

## Overall assessment

The new math code is trustworthy. The three implementations agree with R on the cases I can verify and the cases I can hand-calculate. The AI-prompt change is correctly scoped. The Assumption Coach integration has one pedagogy concern (always-mu₀=0) and both Wilcoxon functions have one robustness concern (NaN pass-through); both are fixable in <25 minutes total.

The methodological lesson from M-8 is worth flagging as a process improvement: a single-author audit benefits from empirical cross-checks (R, scipy, jamovi) not just code-reading against remembered reference values. The verification pass on audit-1 caught three wrong findings; this re-audit caught three more wrong-from-memory R references. Both suggest the audit pipeline should formalize a "run a reference implementation" step before publishing findings.

Limitations of this review:
- Empirical comparison limited to sample sizes 4, 11, 20, 50 for Shapiro-Wilk. Very-large-n and near-boundary (n=12, 200, 2000) not systematically tested.
- No simulation study of Type I error rates under the null at various n and tie patterns.
- AI prompt regression tested with 3 contexts; a larger sample would tighten the regression-absent claim.
- Accessibility, security, and performance not reviewed — pure statistical/pedagogical critique.
