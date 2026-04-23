# Z-t-Chi Calculator

A browser-native statistical calculator suite for biostatistics education. Developed for MPHO 605: Introduction to Biostatistics. No build step, no server required, no tracking; runs entirely in the browser and works offline after first visit (PWA).

## What's inside

Ten pages, each focused on a teaching moment that the others don't cover:

| Page | What it does |
|---|---|
| **Z Calculator** | Standard normal tail probabilities and inverse lookup, with shaded-region visualizations |
| **t Calculator** | Four modes — direct t-statistic, one-sample / paired / Welch's two-sample from raw data. Reports a 95% CI for the mean (or mean difference) in raw-data modes |
| **Chi-Square Calculator** | χ² test of independence for r × c contingency tables, with Cramer's V effect size |
| **Compare** | Side-by-side χ², Yates-corrected χ², Fisher's exact, and Z-for-proportions on one 2×2 table. Pedagogical divergence panel when tests disagree |
| **Simulate** | Bootstrap CIs (percentile method) and two-sample permutation p-values in a Web Worker, with histogram and cross-check against the formula-based result |
| **Epi 2×2** | Sensitivity / specificity / PPV / NPV / LR+ / LR− / RR / OR / NNT — all with Wilson and log-Wald CIs; diagnostic-test and cohort-study framings |
| **Datasets** | Curated biostatistics data (Salk polio vaccine, Lady Tasting Tea, Physicians' Health Study, Mackowiak body temperature, …) with one-click "Load into …" routing |
| **Assumption Coach** | Q-Q plot + skewness + kurtosis + Jarque-Bera + IQR outliers + traffic-light recommendation about whether parametric tests are appropriate |
| **Guide** | Decision tree + quick-start walkthroughs + instructor notes + reference card + troubleshooting FAQ |
| **Tests** | 65 deterministic regression tests (synthetic-data driven, seeded Box-Muller) against every math path |

Pedagogy layer woven through every result page:

- **Predict-Then-Reveal** — optional Learning Mode prompts students to commit to a prediction before seeing a p-value (pretesting effect: Kornell, Hays & Bjork 2009)
- **Show-Work** — LaTeX step-by-step rendering of the computation via MathJax
- **Formative self-checks** — 2 misconception cards per test, pooled from an item bank citing ASA (2016), Haller & Krauss (2002), Cumming (2014), and 14 other verified sources
- **APA and AMA report generators** — one-click clipboard copy with correct p-value formatting
- **Print-optimized stylesheet** — clean one-page homework submissions

## Running locally

No build step. Open any HTML file directly, or serve the folder:

```bash
# Python 3
python -m http.server 8000

# Node.js
npx http-server -p 8000
```

Then visit `http://localhost:8000/`.

> **Note on service worker:** the PWA service worker only registers over `http(s)` (or `localhost`), not over `file://`. You'll see the app without PWA features when opening HTML files directly.

## Deploying to GitHub Pages

A GitHub Actions workflow at `.github/workflows/deploy.yml` is preconfigured. It uses `actions/configure-pages@v5` with `enablement: true`, which attempts to turn Pages on automatically when the workflow first runs. In most cases the first push will enable and deploy Pages in one go.

**If the workflow fails with `Get Pages site failed … HttpError: Not Found`**, Pages couldn't be auto-enabled (common on org-restricted or brand-new repos). Enable it manually, then re-run the workflow:

1. Open your repo on github.com.
2. Go to **Settings → Pages** (left sidebar).
3. Under *Build and deployment → Source*, choose **GitHub Actions**.
4. Go to the **Actions** tab, open the failed run, and click **Re-run all jobs**.

Every subsequent push to `main` redeploys automatically. The live URL appears at **Settings → Pages** and in each workflow run summary — it will look like `https://<user>.github.io/<repo>/`. For this repo specifically: <https://bomino.github.io/Z-t-Chi-Calculator.v2/>.

The workflow uploads the repo root as the Pages artifact, so `index.html` becomes the landing page.

### First-time push from a local clone

```bash
git remote set-url origin https://github.com/<user>/<repo>.git
git push -u origin main
```

## PWA install

Once deployed (or served over `localhost`):

- **Desktop Chrome / Edge:** the address bar shows an install icon. Click → "Install Z-t-Chi Calculator" → launches in a standalone window like a native app.
- **Mobile Chrome / Safari:** use the browser menu → "Add to Home Screen" → appears as a normal app on the home screen.
- **Offline:** after the first visit, the app shell (all HTML/CSS/JS) is cached. Subsequent visits work without a network connection; CDN dependencies (jStat, MathJax) are cached on first successful fetch.

The service worker is versioned via `CACHE_VERSION` in `sw.js`; bumping this value invalidates the old cache on the next visit so new deployments take effect.

## Optional backend (Instructor Mode signing + AI interpreter)

Two features live behind an optional Cloudflare Worker backend: HMAC-signed instructor problem links, and the opt-in "Explain in plain English (AI)" button on calculator results. Both degrade silently when no backend is configured — the main app is unaffected.

See [`backend/DEPLOY.md`](./backend/DEPLOY.md) for the full step-by-step walkthrough (prerequisites, CLI install, secret generation, origin allowlist, deployment, browser verification, monitoring, rotation, custom domains, cost estimates, and troubleshooting). Total first-time setup is ~20 minutes; estimated semester cost for a 50-student class is ~$2.

## Embedding in an LMS

Append `?embed=1` to any calculator URL to hide the navigation and footer:

```html
<iframe src="https://your-hosted-url/t_calculator.html?embed=1"
        width="100%" height="900" style="border: 0;"></iframe>
```

## Technologies

- HTML5, CSS3, vanilla JavaScript — no bundler or toolchain.
- [jStat](https://github.com/jstat/jstat) 1.9.5 for distribution functions, loaded from cdnjs with SRI.
- [MathJax 3](https://www.mathjax.org/) for LaTeX rendering in the Show-Work panels, loaded from jsDelivr with SRI.
- Web Worker (inline Blob URL) for simulation resampling.
- Service worker for offline caching.

## Project structure

```
Z-t-Chi-Calculator/
├── .github/workflows/deploy.yml   GH Actions → Pages deploy
├── index.html                     Landing page
├── z_calculator.html              ...
├── t_calculator.html
├── chi_square.html
├── compare.html
├── simulate.html
├── epidemiology.html
├── datasets.html
├── assumption.html
├── guide.html
├── tests.html                     Regression test harness
├── manifest.webmanifest           PWA manifest
├── icon.svg                       App icon
├── sw.js                          Service worker
├── styles.css                     Shared stylesheet
├── js/
│   ├── common.js                  Shared namespace (ZtChi.*): validators,
│   │                              summary stats, epidemiology, effect
│   │                              sizes, normality diagnostics, banner,
│   │                              toast, csv helpers
│   ├── state.js                   URL-hash state codec + sessionStorage
│   │                              recent-results ring buffer
│   ├── layout.js                  Nav injector, embed-mode, SW registrar
│   ├── reports.js                 APA / AMA report generators
│   ├── predict.js                 Predict-Then-Reveal dialog
│   ├── checks.js                  Formative self-check item bank
│   ├── show-work.js               LaTeX step-by-step renderer
│   ├── datasets.js                Curated dataset library + loadInto
│   ├── z_calculator.js            ...
│   ├── t_calculator.js
│   ├── chi_square.js
│   ├── compare.js
│   ├── simulate.js
│   ├── epidemiology.js
│   └── assumption.js
├── documentation.md               API reference for the math helpers
├── tests.js                       65-test regression harness
├── LICENSE                        MIT
└── README.md                      This file.
```

## Running the regression tests

Open `tests.html` in a served browser (or over `http://localhost:…`). All 65 tests run on load and report pass/fail. Tests cover:

- Standard normal CDF and inverse
- Student t distribution including convergence to normal at large df
- Synthetic-data-driven t-test pipeline
- Chi-square on 2×2 and 3×2 tables
- Fisher's exact (verified against R's `fisher.test` for Lady-Tasting-Tea and the small-N case)
- Z-for-proportions with z² = χ² identity check
- Cramer's V, phi, and interpretive bands for df* = 1 and df* = 3
- Wilson score CI at edge cases
- Epidemiology bundle (sens/spec/PPV/NPV/LR±/RR/OR/NNT)
- APA and AMA report formatter output shapes (including pluralization)
- Input validators (reject decimals / negatives / empty)
- Normality diagnostics (skewness, kurtosis, Jarque-Bera, Q-Q monotonicity, IQR outliers)
- One-sample / paired / Welch's t helpers
- A 200-rep stress test confirming false-positive rate ≤ 10% under nominal α = 0.05

## Dependencies

All runtime dependencies are loaded from public CDNs with Subresource Integrity (SRI) hashes pinned in the HTML:

- [jStat](https://github.com/jstat/jstat) — distribution functions
- [MathJax](https://www.mathjax.org/) — LaTeX rendering

No local install. No `node_modules`. No `package.json`.

## Contributing

Pull requests welcome. For significant changes please open an issue first so the direction can be discussed. All new statistical content should cite a verifiable published source.

## License

Released under the [MIT License](./LICENSE).

## Acknowledgments

- Statistical formulas follow standard references for the normal, Student's t, chi-square, hypergeometric, and related distributions.
- Pedagogy (Predict-Then-Reveal, formative self-checks) is grounded in the ASA Statement on p-Values (2016), GAISE 2016 recommendations, the pretesting-effect literature (Kornell, Hays & Bjork, 2009; Roediger & Karpicke, 2006), Cumming's New Statistics (2014), and Cochran's (1954) classic guidance on χ² usage.
- Curated dataset examples cite their original sources (Francis et al. 1955 for Salk; Steering Committee 1989 for PHS; Mackowiak et al. 1992 for body temperature; Fisher 1935 for Lady Tasting Tea).
