# Z-t-Chi Calculator

A browser-based statistical calculator suite covering Z-scores, t-tests, and chi-square tests of independence. Developed for MPHO 605: Introduction to Biostatistics.

## Features

### Z Calculator
- Left-, right-, and two-tailed probabilities for a Z-score
- Z-score lookup for a target probability (percentile)
- Interactive normal-curve visualizations with shaded regions
- Detailed interpretation block with percentile, CI, and hypothesis-testing context

### t Calculator
- P-values and critical values for left-, right-, and two-tailed tests
- Adjustable significance level and degrees of freedom
- Per-tail reject / fail-to-reject conclusion

### Chi-Square Calculator
- Test of independence for r x c contingency tables (up to 5 x 5)
- Observed and expected frequencies shown side-by-side
- Automatic warning when any expected count is below 5
- Save / load current table in browser storage
- Export current table to CSV
- Keyboard navigation between cells (arrow keys, Enter)

## Technologies
- HTML5, CSS3, vanilla JavaScript (no build step)
- [jStat](https://github.com/jstat/jstat) 1.9.5 for distribution functions (normal, t, chi-square)

## Project Structure
```
Z-t-Chi-Calculator/
├── index.html               # Landing page linking to the three calculators
├── z_calculator.html        # Z-score calculator
├── t_calculator.html        # t-test calculator
├── chi_square.html          # Chi-square calculator
├── styles.css               # Shared stylesheet
├── js/
│   ├── z_calculator.js
│   ├── t_calculator.js
│   └── chi_square.js
├── documentation.md         # Technical and API documentation
├── LICENSE
└── README.md
```

## Running Locally

No build step is required. Open any of the HTML files directly, or serve the folder with a local web server:

```bash
# Python 3
python -m http.server 8000

# Node.js
npx http-server
```

Then visit `http://localhost:8000/` in a modern browser.

## Usage
1. Open the landing page (`index.html`) and pick a calculator.
2. Enter your inputs according to the on-page instructions.
3. Click the calculate button to see results and (for Z) visualizations.

## Dependencies
- [jStat](https://github.com/jstat/jstat) - Statistical computations, loaded from a CDN.

## Contributing
Pull requests are welcome. For significant changes please open an issue first so we can discuss the direction.

## License
Released under the [MIT License](./LICENSE).

## Acknowledgments
- Statistical formulas follow standard references for the normal, Student's t, and chi-square distributions.
- Visualizations inspired by introductory biostatistics teaching materials.
