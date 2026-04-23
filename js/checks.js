/**
 * Formative self-check cards keyed to each test's common misconceptions.
 * Shown inline after every result. Not graded; purely pedagogical.
 *
 * Item priority:
 *   - 'flagship' : the documented top-priority misconception for the test
 *     (always included when rendered; the second card is randomised among the rest).
 *   - 'standard' : rotates in the second slot.
 *
 * Content basis (verified citations only):
 *   - ASA Statement on p-Values: Wasserstein, R. L., & Lazar, N. A. (2016).
 *     The ASA's statement on p-values: Context, process, and purpose.
 *     The American Statistician, 70(2), 129-133.
 *   - Haller, H., & Krauss, S. (2002). Misinterpretations of significance:
 *     A problem students share with their teachers? Methods of Psychological
 *     Research, 7(1), 1-20.
 *   - Cumming, G. (2014). The New Statistics: Why and how.
 *     Psychological Science, 25(1), 7-29.
 *   - Cochran, W. G. (1954). Some methods for strengthening the common χ²
 *     tests. Biometrics, 10(4), 417-451.
 *   - Cohen, J. (1988). Statistical Power Analysis for the Behavioral
 *     Sciences (2nd ed.). Lawrence Erlbaum.
 *   - Pearson, K. (1900). On the criterion that a given system of deviations
 *     ... can be reasonably supposed to have arisen from random sampling.
 *     Philosophical Magazine, 5th Series, 50(302), 157-175.
 *   - McNemar, Q. (1947). Note on the sampling error of the difference
 *     between correlated proportions or percentages. Psychometrika, 12(2), 153-157.
 *   - Student [W. S. Gosset] (1908). The probable error of a mean.
 *     Biometrika, 6(1), 1-25.
 *   - Altman, D. G., & Bland, J. M. (1995). Absence of evidence is not
 *     evidence of absence. BMJ, 311(7003), 485.
 *   - Rosner, B. (2015). Fundamentals of Biostatistics (8th ed.). Cengage.
 *   - Moore, D. S., McCabe, G. P., & Craig, B. A. (2021). Introduction
 *     to the Practice of Statistics (10th ed.). W. H. Freeman.
 *   - Agresti, A. (2018). Statistical Methods for the Social Sciences (5th ed.).
 *     Pearson.
 */
(function () {
    'use strict';

    const ZtChi = window.ZtChi || (window.ZtChi = {});

    /**
     * Each item: { statement, correct ('true'|'false'), explanation, source, priority }
     * priority 'flagship' → always shown; 'standard' → rotates into the second slot.
     */
    const BANK = {
        z: [
            {
                statement: 'A Z-score of 2.00 tells you the observation is 2 units above the mean.',
                correct: 'false',
                explanation: 'A Z-score measures distance from the mean in <strong>standard deviations</strong>, not raw data units. Z = 2 means the value is 2 <em>standard deviations</em> above the mean μ — the raw-unit distance depends on what σ is for that variable.',
                source: 'Moore, McCabe &amp; Craig (2021), Ch. 1.',
                priority: 'standard',
            },
            {
                statement: 'A p-value of 0.05 means there is a 5% probability that the null hypothesis is true.',
                correct: 'false',
                explanation: 'The p-value is P(data as extreme as observed | H₀ is true) — it conditions on H₀ being true, it does not give the probability of H₀. Assigning probability to H₀ itself requires Bayesian reasoning, not a frequentist p-value.',
                source: 'Wasserstein &amp; Lazar (2016), ASA Statement on p-values; Haller &amp; Krauss (2002).',
                priority: 'flagship',
            },
            {
                statement: 'The area under the standard normal curve between −1.96 and +1.96 is approximately 0.95.',
                correct: 'true',
                explanation: 'Correct. Φ(1.96) − Φ(−1.96) ≈ 0.9500. This is the basis for the familiar 95% confidence interval using ±1.96 for a standard normal distribution.',
                source: 'Standard normal table (Rosner, 2015, Appendix A).',
                priority: 'standard',
            },
            {
                statement: 'A 95% confidence interval means there is a 95% probability that the true parameter lies in this specific interval.',
                correct: 'false',
                explanation: 'If the sampling procedure were repeated many times, about 95% of the resulting CIs would contain the true parameter. For any <em>one specific</em> interval (like the one you just computed), the true value is either inside or outside — the probability is not a property of a single interval in frequentist statistics.',
                source: 'Cumming (2014), The New Statistics; Hoekstra et al. (2014).',
                priority: 'standard',
            },
            {
                statement: 'If two observations have Z-scores of +1 and −1, they are equidistant from the population mean.',
                correct: 'true',
                explanation: 'Correct. Both are one standard deviation from the mean, just on opposite sides. The Z-score\'s magnitude measures distance; its sign indicates direction.',
                source: 'Moore, McCabe &amp; Craig (2021), Ch. 1.',
                priority: 'standard',
            },
            {
                statement: 'A Z-score of −2 corresponds to a lower percentile than a Z-score of +1.',
                correct: 'true',
                explanation: 'Correct. Φ(−2) ≈ 2.3rd percentile vs. Φ(+1) ≈ 84.1st percentile. Percentile increases monotonically with Z.',
                source: 'Standard normal CDF (Rosner, 2015, Appendix A).',
                priority: 'standard',
            },
        ],
        t: [
            {
                statement: 'As the degrees of freedom increase, the t-distribution approaches the standard normal distribution.',
                correct: 'true',
                explanation: 'Correct. For df ≳ 30, the t- and z-distributions are nearly indistinguishable. This is why large-sample tests of means often use z rather than t.',
                source: 'Student [Gosset] (1908); Rosner (2015), Ch. 7.',
                priority: 'standard',
            },
            {
                statement: 'Failing to reject H₀ proves that H₀ is true.',
                correct: 'false',
                explanation: '"Absence of evidence is not evidence of absence." Failing to reject only means the data were not strong enough to rule out H₀; a true effect may still exist but the study was too underpowered to detect it.',
                source: 'Altman &amp; Bland (1995), BMJ; Wasserstein &amp; Lazar (2016).',
                priority: 'flagship',
            },
            {
                statement: 'A statistically significant t-test result (p &lt; α) means the effect is practically important.',
                correct: 'false',
                explanation: 'Statistical significance and practical importance are different. With a sufficiently large n, even a tiny effect becomes statistically significant. Always interpret significance alongside an <strong>effect size</strong> (e.g., Cohen\'s d) and context about what magnitude matters in your field.',
                source: 'Cohen (1988); Wasserstein &amp; Lazar (2016).',
                priority: 'standard',
            },
            {
                statement: 'The t-test assumes the sample data are approximately normally distributed.',
                correct: 'true',
                explanation: 'Correct <em>in spirit</em>, but strictly the assumption is that the <strong>sampling distribution of the mean</strong> is normal. This is guaranteed when the raw data are normal. For large n (≳30) the Central Limit Theorem makes the sampling distribution approximately normal even if the raw data are skewed. For small n with skewed data, consider a non-parametric alternative (e.g., Wilcoxon signed-rank).',
                source: 'Student [Gosset] (1908); Rosner (2015), Ch. 7; Sawilowsky &amp; Blair (1992).',
                priority: 'standard',
            },
            {
                statement: 'In a one-sample t-test, the standard error of the mean decreases as the sample size n increases.',
                correct: 'true',
                explanation: 'Correct. SE = s / √n. A larger n shrinks the SE, which increases |t| for a given mean difference, which increases statistical power.',
                source: 'Rosner (2015), Ch. 6.',
                priority: 'standard',
            },
            {
                statement: 'The t-statistic uses the sample standard deviation s (rather than the population σ) because σ is typically unknown.',
                correct: 'true',
                explanation: 'Correct — this is <em>the</em> defining difference between the t-test and the z-test. Because we\'re substituting the sample estimate s for the unknown σ, the sampling distribution has heavier tails than the standard normal, especially for small n. This is why Gosset derived the t-distribution in 1908.',
                source: 'Student [Gosset] (1908).',
                priority: 'standard',
            },
        ],
        chi: [
            {
                statement: 'A significant chi-square test of independence tells you how STRONG the relationship between the two variables is.',
                correct: 'false',
                explanation: 'Chi-square tests whether an association <em>exists</em>, not how strong it is. With a large enough N, even a trivial association becomes significant. To quantify strength, compute <strong>Cramer\'s V</strong> (or φ for a 2×2 table).',
                source: 'Cohen (1988); Agresti (2018), Ch. 8.',
                priority: 'flagship',
            },
            {
                statement: 'The chi-square test of independence is reliable when all expected cell frequencies are at least 5.',
                correct: 'true',
                explanation: 'Correct — this is the standard rule of thumb (Cochran, 1954). When expected counts fall below 5, the χ² approximation breaks down; prefer Fisher\'s exact test.',
                source: 'Cochran (1954), Biometrics.',
                priority: 'standard',
            },
            {
                statement: 'Degrees of freedom for a chi-square test of independence on an r × c table are r × c.',
                correct: 'false',
                explanation: 'df = (r − 1) × (c − 1). The row and column marginal totals are fixed by the data, which reduces the number of freely-varying cells.',
                source: 'Pearson (1900); Agresti (2018), Ch. 3.',
                priority: 'standard',
            },
            {
                statement: 'Chi-square tests are appropriate for comparing means between two groups.',
                correct: 'false',
                explanation: 'The chi-square test of independence (and goodness-of-fit) is for <strong>categorical</strong> data — counts in categories. To compare means, use a t-test (two groups) or ANOVA (three or more).',
                source: 'Rosner (2015), Ch. 7 &amp; 10.',
                priority: 'standard',
            },
            {
                statement: 'The chi-square test of independence assumes observations are independent of one another.',
                correct: 'true',
                explanation: 'Correct. Each observation must contribute to exactly one cell, independently of every other. If the same subjects are measured repeatedly (e.g., before/after), the independence assumption is violated and a different test is needed (McNemar\'s for 2×2 matched pairs).',
                source: 'Pearson (1900); Agresti (2018), Ch. 3.',
                priority: 'standard',
            },
            {
                statement: 'The standard chi-square test of independence can be applied to paired/matched categorical data (e.g., before/after on the same subjects).',
                correct: 'false',
                explanation: 'Paired/matched binary data violate the independence assumption and should be analyzed with <strong>McNemar\'s test</strong> (for 2×2) or its extensions. Using the standard χ² on matched data will generally underestimate the effect.',
                source: 'McNemar (1947); Rosner (2015), Ch. 10.',
                priority: 'standard',
            },
        ],
    };

    /**
     * Pick two items: always include one 'flagship', with the second slot randomised
     * among the remaining items. Order of the two is randomised so the flagship
     * does not always appear first.
     */
    function pickTwo(pool) {
        if (!Array.isArray(pool) || pool.length === 0) return [];
        if (pool.length === 1) return pool.slice();
        const flagships = pool.filter((x) => x.priority === 'flagship');
        const standards = pool.filter((x) => x.priority !== 'flagship');
        if (flagships.length === 0) {
            const a = Math.floor(Math.random() * pool.length);
            let b;
            do { b = Math.floor(Math.random() * pool.length); } while (b === a);
            return [pool[a], pool[b]];
        }
        const flagship = flagships[Math.floor(Math.random() * flagships.length)];
        if (standards.length === 0) return [flagship];
        const standard = standards[Math.floor(Math.random() * standards.length)];
        return Math.random() < 0.5 ? [flagship, standard] : [standard, flagship];
    }

    function cardHtml(item, index) {
        const escape = (ZtChi.escapeHtml || ((s) => s));
        const cardId = `check-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`;
        return `
            <div class="self-check-card" data-check-card="${cardId}">
                <p class="check-question"><strong>Quick check:</strong> ${item.statement}</p>
                <div class="check-buttons">
                    <button type="button" class="secondary-button" data-check-answer="true">True</button>
                    <button type="button" class="secondary-button" data-check-answer="false">False</button>
                </div>
                <div class="check-reveal" hidden>
                    <p class="check-verdict"></p>
                    <p class="check-explain">${item.explanation}</p>
                    <p class="check-source"><em>Source:</em> ${escape(item.source)}</p>
                </div>
                <input type="hidden" data-check-correct="${item.correct}">
            </div>
        `;
    }

    function renderFor(testType) {
        const pool = BANK[testType];
        if (!pool) return '';
        const items = pickTwo(pool);
        if (items.length === 0) return '';
        const cards = items.map((item, i) => cardHtml(item, i)).join('');
        return `
            <section class="self-checks no-print" aria-label="Quick self-checks">
                <h3>Quick self-check</h3>
                <p class="self-check-intro">Low-stakes — click to commit to an answer and see the reasoning. Citations shown so you can verify.</p>
                ${cards}
            </section>
        `;
    }

    /**
     * Delegated click handler for True/False buttons. Idempotent.
     */
    let _delegated = false;
    function ensureDelegatedClickHandler() {
        if (_delegated) return;
        _delegated = true;
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-check-answer]');
            if (!btn) return;
            const card = btn.closest('.self-check-card');
            if (!card || card.classList.contains('answered')) return;
            const answer = btn.getAttribute('data-check-answer');
            const correctHolder = card.querySelector('[data-check-correct]');
            const correct = correctHolder ? correctHolder.getAttribute('data-check-correct') : '';
            const reveal = card.querySelector('.check-reveal');
            const verdict = card.querySelector('.check-verdict');
            const isRight = answer === correct;
            card.classList.add('answered', isRight ? 'correct' : 'incorrect');
            verdict.innerHTML = isRight
                ? '<strong>Correct.</strong>'
                : `<strong>Not quite.</strong> The answer is <strong>${correct === 'true' ? 'True' : 'False'}</strong>.`;
            reveal.hidden = false;
            card.querySelectorAll('[data-check-answer]').forEach((b) => {
                b.disabled = true;
                if (b.getAttribute('data-check-answer') === correct) b.classList.add('is-correct-answer');
                else if (b.getAttribute('data-check-answer') === answer && !isRight) b.classList.add('is-wrong-answer');
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ensureDelegatedClickHandler);
    } else {
        ensureDelegatedClickHandler();
    }

    ZtChi.checks = {
        renderFor,
        BANK,
    };
})();
