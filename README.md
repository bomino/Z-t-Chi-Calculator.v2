# Z-t-Chi Calculator

A browser-native statistical calculator suite for biostatistics education. Developed for MPHO 605: Introduction to Biostatistics by [Hadiza Galadima, PhD](https://hgaladima.com/). Live at **[ztchi.hgaladima.com](https://ztchi.hgaladima.com/)**. No build step, no server required, no tracking; runs entirely in the browser and works offline after first visit (PWA).

## What's inside

Fourteen student-facing pages, each focused on a teaching moment that the others don't cover:

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

- **Predict-Then-Reveal** — optional Learning Mode prompts students to commit to a prediction before seeing a p-value. An active-learning cue inspired by the retrieval-practice literature (Kornell, Hays & Bjork 2009; Richland, Kornell & Kao 2009); the binary reject/fail-to-reject form here is a lighter instance than the generative protocols those studies evaluated, so treat this as plausibly helpful rather than empirically proven for this specific task.
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

## Deployment

**Primary**: two Cloudflare Pages projects from this repo, served at `ztchi.hgaladima.com` and `teach.hgaladima.com` (see *Subdomain layout* below). CF auto-deploys on every push to `main`.

**Optional mirror**: `.github/workflows/deploy.yml` ships the repo root to GitHub Pages at <https://bomino.github.io/Z-t-Chi-Calculator.v2/> as a fallback / preview path. Canonical tags on every page point at the `ztchi.hgaladima.com` form so search engines treat the GH Pages mirror as a duplicate, not a separate ranking target.

The migration from GH-Pages-only to the dual CF Pages setup happened in April 2026; see `docs/migration-runbook.md` for the full historical record (kept for reference).

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

## Subdomain layout

The student calculator and the instructor builder are deployed to **separate CF Pages projects** from the same repository:

| Subdomain | Project | Purpose | What it serves |
|---|---|---|---|
| `ztchi.hgaladima.com` | `ztchi-calculator` | Student-facing calculator suite | Every page except `instructor.html`; blocks `/instructor.html` → 404 |
| `teach.hgaladima.com` | `ztchi-teach` | Instructor builder (token-gated) | Only `instructor.html` (served at `/`); every other calculator path → 404 |

Both projects connect to the **same git remote** and the **same `main` branch**. The split is enforced at the Cloudflare edge via host-based rules in `functions/_middleware.js` — no source-level duplication. Both projects share the `functions/api/[[path]].js` Pages Function which proxies `/api/*` to the backend Worker via service binding, so signed-link generation (teach.hgaladima.com) and verification (ztchi.hgaladima.com) both work.

Why separate subdomains: students never see the instructor builder in their nav or URL bar. Dr. Galadima (or a TA who's been given the instructor token) bookmarks `https://teach.hgaladima.com/` and the whole builder UI is there with no student-facing chrome. See `backend/DEPLOY.md` for setup of the second CF Pages project.

The footer of every page reverse-cross-links the author back to [hgaladima.com](https://hgaladima.com/) (her professional portfolio) — closes the link-equity loop with the parent property.

## SEO and indexing

The calculator is fully indexable; the instructor builder is comprehensively de-indexed.

**Per-page SEO** (every student-facing HTML page):
- Unique `<title>` and `<meta name="description">`
- `<link rel="canonical">` pointing at the `ztchi.hgaladima.com/` form
- Open Graph + Twitter Card meta with `og-default.svg` as the social preview image
- Page-type JSON-LD: `SoftwareApplication` for the 8 calculator pages, `LearningResource` for the 4 reference pages, `WebSite` + `BreadcrumbList` on the home page

**Static `sitemap.xml`** at the repo root lists all 13 indexable URLs.

**Host-aware `/robots.txt`** is served by `functions/robots.txt.js`, which inspects the request `Host` header:
- `teach.hgaladima.com` → `User-agent: * \n Disallow: /` (block everything)
- `ztchi.hgaladima.com` (and any other host) → standard allow + sitemap pointer

**Three-layer noindex on `teach.hgaladima.com`**:
1. The host-aware `robots.txt` above.
2. `X-Robots-Tag: noindex, nofollow, noarchive` HTTP header injected by `functions/_middleware.js` on every teach-host response.
3. `<meta name="robots" content="noindex, nofollow, noarchive">` on `instructor.html`.

Belt + suspenders + parachute. Even if a crawler ignores robots.txt and ignores the header, the meta tag still applies; if it ignored all three, the host's middleware also blocks all student-page paths so there's almost no content to index.

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
├── .github/workflows/deploy.yml   GH Actions → Pages mirror deploy (optional)
├── index.html                     Landing page
├── z_calculator.html              Z-test calculator
├── t_calculator.html              t-test calculator (4 modes)
├── chi_square.html                χ² test of independence
├── compare.html                   Compare χ² / Fisher / Z on a 2×2 table
├── simulate.html                  Bootstrap CIs + permutation tests
├── epidemiology.html              Epi 2×2 (sens/spec/PPV/RR/OR/NNT)
├── corrections.html               Multiple-comparisons corrections + inflation viz
├── datasets.html                  Curated dataset library
├── assumption.html                Assumption Coach (normality diagnostics)
├── guide.html                     Decision tree + walkthrough
├── notation.html                  Notation translator (textbook ↔ SPSS ↔ R ↔ APA)
├── error-traps.html               Common-error library
├── instructor.html                Instructor Mode builder (noindex; teach subdomain)
├── tests.html                     Regression test harness (noindex)
├── 404.html                       Custom 404 (noindex)
├── manifest.webmanifest           PWA manifest
├── icon.svg                       App icon
├── og-default.svg                 Social-preview OG image (1200×630)
├── sw.js                          Service worker
├── sitemap.xml                    13 indexable student-facing URLs
├── styles.css                     Shared stylesheet
├── tests.js                       65-test regression harness
├── functions/                     Cloudflare Pages Functions (host-aware edge logic)
│   ├── _middleware.js             Host-based routing + X-Robots-Tag for teach
│   ├── robots.txt.js              Host-aware robots.txt (Allow vs Disallow:/)
│   └── api/[[path]].js            Service-binding proxy → backend Worker
├── js/                            Per-page modules + shared infrastructure
│   ├── common.js                  Shared namespace (ZtChi.*): validators,
│   │                              summary stats, epidemiology, effect sizes,
│   │                              normality diagnostics, banner, toast, csv
│   ├── state.js                   URL-hash state codec + sessionStorage
│   ├── backend.js                 Backend feature detection (/health probe)
│   ├── theme.js                   Light / dark / high-contrast switcher
│   ├── layout.js                  Nav injector, embed-mode, SW registrar
│   ├── reports.js                 APA / AMA report generators
│   ├── predict.js                 Predict-Then-Reveal dialog
│   ├── checks.js                  Formative self-check item bank
│   ├── show-work.js               LaTeX step-by-step renderer
│   ├── three-level.js             Three-level interpretation (data/stats/plain)
│   ├── datasets.js                Curated dataset library + loadInto
│   ├── ai-interpret.js            Opt-in AI interpretation (requires backend)
│   ├── instructor.js              Instructor Mode spec encoder + sign client
│   ├── instructor-builder.js      Instructor Mode builder UI glue
│   ├── problem-overlay.js         Student-facing problem overlay
│   └── (per-page logic)           z_calculator.js, t_calculator.js,
│                                  chi_square.js, compare.js, simulate.js,
│                                  epidemiology.js, corrections.js,
│                                  assumption.js
├── backend/                       Optional Cloudflare Worker — see backend/DEPLOY.md
│   ├── worker.js                  /health, /sign, /ai, /verify endpoints
│   ├── wrangler.toml              CF Workers config
│   ├── README.md                  Short overview + pointer to DEPLOY.md
│   └── DEPLOY.md                  Step-by-step deployment walkthrough
├── docs/
│   ├── documentation.md           Math-helper API reference
│   ├── migration-runbook.md       The April 2026 GH Pages → CF Pages migration
│   │                              (kept for reference; migration is complete)
│   └── audits/                    Scientific-critical-thinking review records
│       ├── scientific-critical-review-2026-04.md
│       └── scientific-critical-review-new-code-2026-04.md
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
- Pedagogy (Predict-Then-Reveal, formative self-checks) is informed by the ASA Statement on p-Values (2016), GAISE 2016 recommendations, the retrieval-practice literature (Kornell, Hays & Bjork, 2009; Roediger & Karpicke, 2006), Cumming's New Statistics (2014), and Cochran's (1954) classic guidance on χ² usage. Individual alignment with each source is partial — see `docs/audits/scientific-critical-review-2026-04.md` for a specific accounting of what's backed by the cited work and what is a plausible extension.
- Curated dataset examples cite their original sources (Francis et al. 1955 for Salk; Steering Committee 1989 for PHS; Mackowiak et al. 1992 for body temperature; Fisher 1935 for Lady Tasting Tea).
