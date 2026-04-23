/**
 * Curated biostatistics datasets for teaching.
 *
 * Each entry provides:
 *  - metadata (title, citation, context, what to look for)
 *  - a `targets` map keyed by calculator page, containing the payload that the
 *    calculator reads out of sessionStorage['ZtChi.datasetHandoff'] on load.
 *
 * The sessionStorage handoff is set by `ZtChi.datasets.loadInto(id, target)`
 * and immediately consumed + cleared by the destination calculator.
 */
(function () {
    'use strict';

    const ZtChi = window.ZtChi || (window.ZtChi = {});

    const DATASETS = [
        {
            id: 'salk-1954',
            title: 'Salk Polio Vaccine Trial (1954)',
            year: 1954,
            citation: 'Francis T Jr, et al. (1955). An evaluation of the 1954 poliomyelitis vaccine trials. American Journal of Public Health, 45(5, Pt 2), 1–50.',
            context:
                'The largest placebo-controlled trial of its era: 401,974 children randomised to the Salk inactivated polio vaccine or a saline placebo. The trial produced one of the most convincing 2×2 tables in public health history — paralytic polio was roughly three times more common in the placebo arm.',
            whatToLearn: 'A cohort-study 2×2 with a large, clinically meaningful risk ratio. Try Compare (χ² agrees with Fisher here because of the enormous N) and Epi (RR ≈ 0.29 — i.e., vaccine cut risk by ~71%).',
            targets: {
                compare: {
                    a: 33, b: 200712, c: 115, d: 201114,
                    rowLabelA: 'Vaccinated', rowLabelB: 'Placebo',
                    colLabel0: 'Paralytic polio', colLabel1: 'No polio',
                    alpha: 0.05,
                },
                epi: {
                    mode: 'cohort',
                    a: 33, b: 200712, c: 115, d: 201114,
                    conf: 0.95,
                },
            },
        },

        {
            id: 'lady-tasting-tea',
            title: 'Lady Tasting Tea (Fisher, 1935)',
            year: 1935,
            citation: 'Fisher RA. (1935). The Design of Experiments. Oliver & Boyd.',
            context:
                'Ronald Fisher tested Muriel Bristol\'s claim that she could tell whether milk was added to tea before or after brewing. He presented 8 cups, 4 of each. She got 3 of 4 "milk first" cups correct. Fisher\'s exact test was invented for exactly this kind of small-N 2×2.',
            whatToLearn: 'The classical "small-N Fisher example." Compare mode will show that χ² and Fisher can disagree sharply on tiny tables — Fisher gives p ≈ 0.49, not "significant" at α=0.05. Great counter-example to the intuition that "she got 3 of 4 right, that\'s impressive."',
            targets: {
                compare: {
                    a: 3, b: 1, c: 1, d: 3,
                    rowLabelA: 'Said "milk first"', rowLabelB: 'Said "tea first"',
                    colLabel0: 'Actually milk first', colLabel1: 'Actually tea first',
                    alpha: 0.05,
                },
            },
        },

        {
            id: 'physicians-health-study',
            title: "Physicians' Health Study — Aspirin and MI (1989)",
            year: 1989,
            citation: 'Steering Committee of the Physicians\' Health Study Research Group. (1989). Final report on the aspirin component of the ongoing Physicians\' Health Study. New England Journal of Medicine, 321(3), 129–135.',
            context:
                '22,071 US male physicians randomised to aspirin (325 mg every other day) or placebo. During follow-up there were 104 myocardial infarctions in the aspirin group and 189 in the placebo group. The trial was stopped early because of the strength of the aspirin benefit.',
            whatToLearn: 'Try Epi (cohort mode): RR ≈ 0.55, OR ≈ 0.55, NNT ≈ 130 to prevent one MI. A real NNT of 130 is in the "worthwhile, widely given" range and was the basis for decades of clinical guidance.',
            targets: {
                epi: {
                    mode: 'cohort',
                    a: 104, b: 10930, c: 189, d: 10848,
                    conf: 0.95,
                },
                compare: {
                    a: 104, b: 10930, c: 189, d: 10848,
                    rowLabelA: 'Aspirin', rowLabelB: 'Placebo',
                    colLabel0: 'MI', colLabel1: 'No MI',
                    alpha: 0.05,
                },
            },
        },

        {
            id: 'body-temperature',
            title: 'Body Temperature — Challenging 98.6°F (Mackowiak 1992)',
            year: 1992,
            citation: 'Mackowiak PA, Wasserman SS, Levine MM. (1992). A critical appraisal of 98.6°F, the upper limit of the normal body temperature... JAMA, 268(12), 1578–1580.',
            context:
                'The 98.6°F figure traces to Carl Wunderlich\'s 1868 monograph. Mackowiak et al. measured 148 healthy adults and found a mean oral temperature of ≈98.2°F — significantly lower than Wunderlich\'s 98.6°F. The data below are illustrative values drawn from a distribution matching the paper\'s reported summary (mean ≈ 98.25°F, SD ≈ 0.73°F, n = 30).',
            whatToLearn: 'A one-sample t-test against a "traditional" μ₀. Try Simulate (bootstrap CI for the mean) and t-calculator (one-sample mode with μ₀ = 98.6). The 95% CI for the mean should exclude 98.6 — which is the Mackowiak finding.',
            isSynthetic: true,
            targets: {
                t: {
                    mode: 'one-sample',
                    mu0: 98.6,
                    alpha: 0.05,
                    dataA: '98.4 97.8 98.2 98.1 99.1 97.6 98.7 98.3 98.0 98.5 97.4 98.6 98.2 97.9 98.8 98.1 98.3 97.7 98.0 98.4 98.6 97.5 98.2 98.9 98.0 97.8 98.4 98.1 98.3 97.9',
                    datasetName: 'Body Temperature (Mackowiak 1992-style sample)',
                },
                simulate: {
                    mode: 'bootstrap',
                    dataA: '98.4 97.8 98.2 98.1 99.1 97.6 98.7 98.3 98.0 98.5 97.4 98.6 98.2 97.9 98.8 98.1 98.3 97.7 98.0 98.4 98.6 97.5 98.2 98.9 98.0 97.8 98.4 98.1 98.3 97.9',
                    iterations: 10000,
                    ciLevel: 0.95,
                    datasetName: 'Body Temperature (Mackowiak 1992-style sample)',
                },
            },
        },

        {
            id: 'bp-before-after',
            title: 'Blood Pressure Before / After a Treatment',
            year: null,
            citation: 'Illustrative teaching dataset — not from a specific published study.',
            context:
                'Systolic blood pressure (mmHg) in 12 hypertensive patients measured before and after 8 weeks on a new medication. Paired design: each "after" value corresponds to the same patient\'s "before" value. Typical of a small pilot RCT.',
            whatToLearn: 'Try the t-calculator in paired mode. The CI for the mean drop should exclude 0 and give you a sense of the typical effect size (around 10–15 mmHg). This is the canonical paired t-test teaching example.',
            isSynthetic: true,
            targets: {
                t: {
                    mode: 'paired',
                    alpha: 0.05,
                    dataA: '148 152 163 145 157 141 168 155 160 149 153 158',
                    dataB: '132 138 147 135 144 128 155 140 148 138 141 145',
                    datasetName: 'BP Before/After (illustrative, n=12)',
                },
            },
        },

        {
            id: 'cholesterol-two-group',
            title: 'Cholesterol — Treatment vs Control (illustrative)',
            year: null,
            citation: 'Illustrative teaching dataset — not from a specific published study.',
            context:
                'Total cholesterol (mg/dL) in two independent groups: 20 patients on a statin and 20 matched controls. The groups are independent (not paired), so Welch\'s t-test is the right tool.',
            whatToLearn: 'Try t-calculator in Welch\'s mode, and then Simulate in permutation mode on the same data. The permutation p should match Welch\'s p closely (by design, equal variances) — demonstrating the "same conclusion from two angles" thesis.',
            isSynthetic: true,
            targets: {
                t: {
                    mode: 'welch',
                    alpha: 0.05,
                    dataA: '198 210 215 185 202 220 192 207 188 219 205 197 213 208 195 201 218 199 211 206',
                    dataB: '225 232 218 241 229 237 224 239 220 244 228 235 222 240 230 233 238 226 242 231',
                    datasetName: 'Cholesterol — statin vs control (illustrative, n=20/group)',
                },
                simulate: {
                    mode: 'permutation',
                    dataA: '198 210 215 185 202 220 192 207 188 219 205 197 213 208 195 201 218 199 211 206',
                    dataB: '225 232 218 241 229 237 224 239 220 244 228 235 222 240 230 233 238 226 242 231',
                    iterations: 10000,
                    datasetName: 'Cholesterol — statin vs control (illustrative, n=20/group)',
                },
            },
        },
    ];

    function byId(id) { return DATASETS.find((d) => d.id === id) || null; }

    /**
     * Write the dataset payload to sessionStorage and navigate to the target page.
     */
    function loadInto(datasetId, target) {
        const ds = byId(datasetId);
        if (!ds) { throw new Error('Unknown dataset: ' + datasetId); }
        const payload = ds.targets && ds.targets[target];
        if (!payload) { throw new Error(`Dataset ${datasetId} has no payload for target ${target}.`); }
        const enriched = Object.assign({ calculator: target, datasetName: ds.title }, payload);
        try {
            sessionStorage.setItem('ZtChi.datasetHandoff', JSON.stringify(enriched));
        } catch (_) {
            // sessionStorage may be disabled; fall through
        }
        const href = ({
            t: 't_calculator.html',
            compare: 'compare.html',
            epi: 'epidemiology.html',
            simulate: 'simulate.html',
            z: 'z_calculator.html',
            chi: 'chi_square.html',
        })[target];
        if (!href) { throw new Error('No target page for: ' + target); }
        window.location.href = href;
    }

    ZtChi.datasets = {
        all: DATASETS,
        byId,
        loadInto,
    };
})();
