# Scientific Critical Review — Z-t-Chi Calculator

**Date:** 2026-04-24
**Scope:** 4-lens review (statistical correctness, pedagogy claims, AI interpreter outputs, Assumption Coach decision rule)
**Framework:** systematic evaluation using methodological/bias/statistical-pitfall/claim-evaluation criteria.
**Verification pass:** each finding re-checked against the actual codebase. Corrections noted inline and summarized at the end.

---

## Summary

The calculator's **computational layer is solid** — the math paths sampled match canonical references (R's `p.adjust`, Agresti & Coull, BH 1995, Welch-Satterthwaite, jStat's distribution functions) to at least 4 decimal places, and the 65-test regression harness passes 65/65. The **pedagogy claims are mostly sound, with one material overclaim** (the "pretesting effect" is invoked for a binary reject/fail-to-reject guess that differs substantively from the retrieval-practice protocol the cited papers actually validated). The **AI interpreter output** is strong on prosecutor's-fallacy and power caveats but has a specific, reproducible failure mode: conflating **test-statistic magnitude with effect size**. The **Assumption Coach decision rule** is defensible but encodes the n≥30 CLT rule-of-thumb less carefully than current literature warrants.

Nothing in this review indicates a fatal correctness defect. Three findings rise to "Important" severity; the rest are "Minor" tunings or documentation tweaks.

---

## Strengths

1. **Canonical formulas, faithfully implemented.**
   - BH 1995 15-test adjusted p-values match R's `p.adjust(method="BH")` to 4 decimals.
   - Fisher's exact test uses log-space hypergeometric with Fisher's original "method of small p-values" (matches R's default).
   - Wilson score CI (Agresti & Coull 1998) and Welch-Satterthwaite df (approximation) are textbook-correct.
   - Haldane-Anscombe 0.5 continuity correction applied consistently for zero-cell OR/RR.
   - G1/G2 bias-corrected skewness/kurtosis match SPSS / R `e1071::skewness(type=2)`.

2. **Honest hedging in the AI interpreter system prompt.**
   Every sampled output includes the prosecutor's-fallacy caveat ("p is NOT the probability the null is true") and, on null results, a power caveat. No sample produced causal language from a statistical test.

3. **Low-expected-count warning (Cochran 1954) in chi-square** — correctly flags E<5 cells and points users to Fisher's exact.

4. **Graceful degradation throughout.** The optional backend's absence leaves both Instructor Mode and the AI button in well-labeled degraded states; the core app works identically without them.

5. **Explicit references in source.** Every statistical *helper* module (`common.js`, `simulate.js`, `assumption.js`, `compare.js`, `corrections.js`, `checks.js`, `predict.js`, `three-level.js`) JSDoc-cites its canonical sources. Good hygiene, makes the rest of this review tractable. *Verified caveat:* the three calculator UI modules (`z_calculator.js`, `t_calculator.js`, `chi_square.js`) have no file-level citations — they delegate math to well-cited helpers, so no practical gap, but the audit's original "every statistical helper" framing was slightly broader than reality.

6. **Regression harness at `tests.html`** — 65 deterministic tests covering Z/t/chi/compare/simulate/epi/corrections paths against known values and cross-method consistency. All passing.

---

## Concerns — Important (threaten the tool's teaching message if unaddressed)

### I-1. AI interpreter conflates test-statistic magnitude with effect size

**Evidence:** Sample E (z = 4.5, p = 3e-6) produced:
> "The Z-statistic of 4.5 indicates a very large departure from the null expectation — a practically meaningful difference. This magnitude suggests the effect is not merely statistically significant but also substantial."

Sample F (t = -0.02, p = 0.984):
> "...indicating the groups are nearly identical in their central tendency..."

Sample A (z = 0.5) also makes a softer version of the same move: "the small z-value (0.5) suggests any practical difference is minimal."

**Why this matters:** z and t scale with √n. A huge sample can produce a very large z for a practically trivial effect; a tiny sample can produce a tiny z for a huge effect that's obscured by noise. Teaching a student that "big z = big effect" is a durable pedagogical error — it's the exact kind of fallacy Cumming (2014) and the ASA (2016) statement were trying to displace. The calculator itself gets this right (it reports Cramer's V, sensitivity, etc. when computable). The AI should not un-teach it.

**Recommendation:** Extend the system prompt in `backend/worker.js` with:

> **Never interpret the magnitude of a test statistic (z, t, χ²) as the magnitude of an effect.** The test statistic scales with sample size and precision; a large z can come from a tiny effect in a very large sample, and a small z can come from a large effect in a small sample. If no effect size is provided (Cohen's d, Cramer's V, OR, r), explicitly state that you cannot infer one from the test statistic alone.

Re-sample after the change; the same 8 test contexts can serve as the regression set.

**Severity:** Important. Nothing in the interpretation pipeline currently catches this, and it will appear consistently across null-of-extreme contexts.

### I-2. "Pretesting effect" citation overclaims

**Claim location:** `js/predict.js` line 5–13 JSDoc, `guide.html` line 187, `README.md` line 24, the Predict-Then-Reveal dialog footnote.

**Cited papers** (all real and relevant):
- Kornell, Hays & Bjork (2009). *Unsuccessful retrieval attempts enhance subsequent learning.*
- Richland, Kornell & Kao (2009). *The pretesting effect: Do unsuccessful retrieval attempts enhance learning?*
- Roediger & Karpicke (2006). *Test-enhanced learning.*

**Gap:** The implementation asks students to commit to a binary choice — **"Reject H₀"** or **"Fail to reject H₀"**. This is effectively a coin-flip prediction for a naive student with no prior computation. The Kornell/Richland protocol asks learners to *generate* a candidate answer before being shown the correct one — e.g., translate an unfamiliar word, or recall a definition. The generative act is load-bearing in the cited research; Richland, Kornell & Kao (2009) specifically titled their replication "Do unsuccessful retrieval attempts enhance learning?" because the effect size is *smaller* for prediction tasks with no relevant prior knowledge than for retrieval tasks.

The Predict-Then-Reveal feature is a reasonable educational gesture. But invoking the pretesting-effect literature to justify it, without acknowledging the generative-vs-binary distinction, is an appeal-to-authority that implies stronger empirical support than exists.

**Recommendation:** Soften the claim to:

> "Committing to a prediction before seeing feedback is a common active-learning technique (related to the pretesting effect literature — Kornell, Hays & Bjork 2009; Richland, Kornell & Kao 2009 — though the binary reject/fail-to-reject choice is a weaker instance of the original retrieval-practice paradigm)."

Alternatively, strengthen the intervention: ask the student to predict the approximate *p-value range* or *effect size direction*, which is closer to generative. That brings the implementation closer to the evidence.

**Severity:** Important. The claim is load-bearing for the app's "research-backed pedagogy" positioning, and unchanged it could embarrass the project at a USCOTS / eCOTS review.

### I-3. Assumption Coach uses the n≥30 CLT shortcut without adequate caveats

**Location:** `js/assumption.js` lines 133–135:

```js
if (n >= 30 && jb.p < 0.01 && absSkew < 1.2) {
    conditions.push(`JB rejects normality (p = ${pFmt(jb.p)}) but n = ${n} is moderate; CLT likely makes the t-test approximately valid for the mean.`);
    if (tier === 'red' && absSkew < 1.2) tier = 'yellow';
}
```

**Why this matters:** The "n=30 makes everything OK" heuristic is widely repeated and widely wrong in specific cases. Simulation studies (Wilcox 2012; Micceri 1989) show that for heavy-tailed or strongly skewed distributions, t-test Type I error rates can remain well above α even at n=100 or n=200. The threshold n=30 traces to Lehmann's (1999) textbook suggestion for *moderate* departures — not heavy tails or strong skew.

The coach does guard (`absSkew < 1.2`), which is better than nothing. But the verification pass surfaced a **sharper concern than originally reported**:

- Look at line 123-126: if `absExcKurt > 2.0`, tier is set to 'red'.
- Then at line 135: `if (tier === 'red' && absSkew < 1.2) tier = 'yellow';`
- The demotion condition **only checks skewness**. A red verdict that was set *because of high kurtosis* will be demoted to yellow whenever skewness happens to be low. This is exactly backward — kurtosis-driven departures from normality are a bigger threat to t-test CLT behavior at moderate n than skewness-driven ones.

So this isn't just optimistic wording — there's a real logic bug that demotes the kurtosis verdict based on skew alone.

- "CLT likely makes the t-test approximately valid" is directional-but-optimistic language for a student who may already be primed to want a green light.

**Recommendation:**
1. Fix the demotion condition to require **both** low skew AND low kurtosis: `if (tier === 'red' && absSkew < 1.2 && absExcKurt < 2.0) tier = 'yellow';`
2. Reword to: "*CLT may help with moderate skew at n = X, but the t-test's p-values and CIs can still be biased if the distribution is heavy-tailed or bimodal. If in doubt, use the bootstrap on the Simulate page as a cross-check.*"
3. Offer a concrete threshold, e.g.: "For |skew| between 0.5 and 1.2 and n < 100, the t-test can still have Type I error rates around 7-8% at a nominal α = 0.05."

**Severity:** Important. This is the core "should I use a parametric test?" advice the Coach exists to give; currently it nudges toward "yes" more confidently than the evidence supports.

---

## Concerns — Minor (tunings and documentation)

### M-1. Bootstrap CI index convention (simulate.js)

Line 63–64 of `js/simulate.js`:
```js
const lowIdx = Math.floor(((1 - ciLevel) / 2) * iterations);
const highIdx = Math.min(iterations - 1, Math.floor(((1 + ciLevel) / 2) * iterations));
```
Efron's original formulation uses `(1 − α/2)(B + 1)`-th order statistic. The implementation uses `floor((α/2) · B)` / `floor((1 − α/2) · B)` which is off by one at the fence for very small B. Irrelevant at B = 10,000 (the default) but worth noting. **Not a bug, convention choice.**

### M-2. Permutation p-value can return exactly 0

`js/simulate.js` line 104–109. A permutation count of 0 extreme-or-more samples yields p = 0. Some statisticians prefer `(1 + count) / (1 + iterations)` to produce a non-zero lower bound (reflecting that the observed table is itself one possible permutation). Minor pedagogical improvement.

### M-3. Hardcoded z-critical value (`1.959963984540054`) — *downgraded after verification*

Originally flagged at three sites. Verification shows only **one** of them (`js/common.js` line 188, in `zTestTwoProportions`) is a genuine "instead of jStat" use. The other two occurrences (lines 461, 509) are **defensive fallbacks** used only when `jStat` is undefined — that's the correct pattern, not a problem. Only line 188 is worth tidying up.

### M-4. Jarque-Bera uses biased moments while display shows bias-corrected G1/G2

By design — JB's chi-square reference distribution assumes biased-moment inputs. But a student could see "skew = 0.42" displayed and separately be told "JB uses S = 0.39" and be confused. **Add a footnote** explaining the two values.

### M-5. Shapiro-Wilk cited but not implemented

`js/assumption.js` header cites Shapiro & Wilk (1965) but the test isn't implemented. For n < 50, S-W is more powerful than Jarque-Bera at detecting deviations from normality. The current reliance on JB is the weakest of the common normality tests at small n.

*Verified softening:* `assumption.html` line 76 **openly discloses** this absence to students: "*The Shapiro-Wilk test (not provided here) is stricter for small n.*" So the tool isn't misleading anyone; it just leaves capability on the table. Either:
- Remove the citation (it's currently just a footnote), or
- Implement a reasonable approximation (Royston 1982 gives a computable form), which would materially improve the Coach's detection at the smaller samples it already cautions about.

### ~~M-6. CI-first claim vs implementation gap~~ — *withdrawn after verification*

On re-reading, `README.md` does **not** actually claim "CI-first" anywhere. The claim only lives in internal planning docs and code-comments. The user-facing language on line 12 is appropriately scoped: "Reports a 95% CI for the mean (or mean difference) *in raw-data modes*." README line 206 says pedagogy is "grounded in the ASA Statement on p-Values (2016)" — see M-7 for that phrasing — but does not invoke "CI-first" as a branding claim. Finding withdrawn; the original audit was incorrect here.

### M-7. "GAISE 2016 alignment" in README is marketing-toned

The six GAISE recommendations are (1) teach statistical thinking, (2) focus on conceptual understanding, (3) integrate real data, (4) foster active learning, (5) use technology, (6) use assessments to improve learning. The app arguably hits (3), (5), (6) cleanly; (1), (2), (4) are more debatable. "Grounded in" implies stronger alignment than "informed by" would. Softer phrasing would survive closer scrutiny.

### M-8. Wilcoxon is recommended but not implemented

Assumption Coach's red-tier advice (`js/assumption.js` line 156): "Use: the Wilcoxon signed-rank / rank-sum test (not provided here), OR the bootstrap CI + permutation p-value on the Simulate page."

*Verified softening:* the bootstrap/permutation path *is* routable within the app, so the red tier isn't zero-actionability — just under-served relative to the yellow tier (which has multiple concrete options). Implementing Wilcoxon would close that gap. Adds a `js/nonparametric.js` and a page, or at minimum a rank-based fallback inside the Simulate page.

### M-9. Chi-square E < 5 warning could cite both Cochran 1954 and more recent work — *location corrected*

*Verified correction:* My original audit said "the current inline warning cites Cochran's rule generically." That was wrong in two places:
- `chi_square.js` line 82's warning says "expected frequency cell(s) are below 5" with **no author citation at all**.
- `compare.js` line 188's divergence note **does** cite "Cochran's (1954) rule."

So the actual finding is: the chi-square page's inline warning is unattributed, while the compare page's divergence note is correctly attributed but could pair Cochran 1954 with more recent empirical work (Larntz 1978; Campbell 2007) that shows E ≥ 5 is often overly conservative. Low-value item either way.

---

## Concerns — Absence of claims I checked for and didn't find

These are *good* — listing for transparency:

- **No causal language** detected in any of 8 AI samples (z-test, t-test, chi-square, epi 2×2, extreme and null-like).
- **No "accepts" the null** anywhere in codebase (uses "retain" or "fail to reject" consistently).
- **No conflation of statistical and practical significance** in the canned interpretation prose (only in the AI output — see I-1).
- **No overgeneralization-beyond-sample** language.
- **No "proves"** in the prose (cross-verified against `README.md`, `guide.html`, `error-traps.html`).

---

## Specific recommendations (prioritized)

| # | Action | Effort | Impact |
|---|---|---|---|
| 1 | Extend AI system prompt to forbid inferring effect magnitude from test-statistic magnitude (I-1) | 10 min | High — fixes the single clear pedagogy error in AI output |
| 2 | Soften "pretesting effect" claim to "related to the pretesting effect literature" (I-2) | 5 min | Medium — honesty for conference-facing claim |
| 3 | Add kurtosis gate + more conservative CLT wording in Assumption Coach (I-3) | 15 min | High — the Coach is the main guidance artifact for a student's test choice |
| 4 | Add footnote explaining JB's biased moments vs displayed G1/G2 (M-4) | 5 min | Low — kills one potential confusion |
| 5 | Implement Shapiro-Wilk (Royston approximation) (M-5) | 1-2 hr | Medium — materially improves Coach at the small-n regime where it matters most |
| 6 | Implement Wilcoxon signed-rank / rank-sum so "red tier" is actionable (M-8) | 3-4 hr | Medium — makes the non-parametric advice something students can actually act on |
| 7 | Caveat README "CI-first" claim until Phase 2 raw-data modes ship (M-6) | 5 min | Low — internal honesty |

Items 1, 2, 3 together take under half an hour and close the three Important findings.

---

## Overall assessment

The computational layer of this calculator is **trustworthy** at the level of fidelity a student will ever care about. The pedagogy layer is **well-intentioned and mostly accurate**, with one overclaimed citation (pretesting) and one pattern in AI output (statistic-as-effect-size) that together are both fixable in under an hour. The Assumption Coach is **useful but optimistic** — currently it nudges toward parametric tests more confidently than current literature supports.

Of all the issues surfaced, none is a fatal flaw; the project's core claim ("a browser-native biostatistics tool whose math you can trust") stands. The fixes at the top of the recommendations table would move the project from *good* to *defensible at USCOTS / eCOTS / JSM peer review* with minimal code churn.

Limitations of this review:
- AI sample size is 8, not 100. A systematic 100-sample audit would tighten the Important-finding estimate on I-1.
- No simulation study was run to benchmark the Assumption Coach's traffic-light rule against ground truth across skew/kurtosis combinations; finding I-3 is based on cited literature and a code-reading, not a direct empirical test here.
- Accessibility, security, and privacy were not reviewed — this is a pure statistical/pedagogical critique.

---

## Verification pass — what changed between the draft and this version

Every finding was re-checked against the codebase. Of the 12 original findings:

- **8 confirmed unchanged**: I-1, I-2 (on code facts), M-1, M-2, M-4, M-5 (softened), M-7, M-8 (softened).
- **1 sharpened**: I-3 — the verification surfaced a specific logic bug (kurtosis-driven red verdict gets demoted to yellow based on skew alone at line 135 of `js/assumption.js`), sharper than the originally-reported "no kurtosis guard" wording.
- **2 corrected**: M-3 (originally claimed 3 hardcoded sites; verification showed only 1 genuine "instead of jStat" — the other two are correct defensive fallbacks when jStat is undefined), M-9 (originally mis-located the Cochran citation).
- **1 withdrawn**: M-6 — the original audit claimed README calls the tool "CI-first"; verification shows this phrasing only appears in internal planning docs, not user-facing copy. README is appropriately caveated.
- **1 strength softened**: "every statistical helper cites its sources" was broadly true for helper modules but not for the three calculator UI modules (which delegate math to well-cited helpers, so no practical defect).

The net effect on the overall assessment: three Important findings still stand (I-1, I-2 on code facts, I-3 — now with a sharper bug description). The roadmap of fixes is unchanged. This verification pass is itself an application of the critical-thinking principle that a single-author review benefits from a second look.
