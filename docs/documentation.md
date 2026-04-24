# Z-t-Chi Calculator Documentation

## Technical Documentation

### Statistical Implementations

#### Z-Score Calculator
The Z-score calculator implements standard normal distribution calculations:
```javascript
// Z to probability (left-tail area)
probability = jStat.normal.cdf(zScore, 0, 1);

// Probability to Z (inverse CDF)
zScore = jStat.normal.inv(probability, 0, 1);

// Right-tail and two-tailed probabilities are derived from the left-tail:
rightTail = 1 - probability;
twoTail   = 2 * Math.min(probability, 1 - probability);
```

#### t-Test Calculator
The t-test calculator uses Student's t-distribution:
```javascript
// P-values for a given t statistic and df
leftTailP  = jStat.studentt.cdf(tStat, df);
rightTailP = 1 - leftTailP;
twoTailP   = 2 * Math.min(leftTailP, rightTailP);

// Critical values for significance level alpha
leftCritical     = jStat.studentt.inv(alpha, df);
rightCritical    = jStat.studentt.inv(1 - alpha, df);
twoTailCritical  = jStat.studentt.inv(1 - alpha / 2, df);
```

#### Chi-Square Calculator
The chi-square calculator implements a test of independence over a contingency table:
```javascript
// Expected frequency for each cell
expected[i][j] = (rowTotal[i] * colTotal[j]) / grandTotal;

// Chi-square statistic (sum of (O - E)^2 / E over all cells)
chiSquare += Math.pow(observed[i][j] - expected[i][j], 2) / expected[i][j];

// Degrees of freedom for an r x c table of independence
df = (rows - 1) * (cols - 1);

// P-value (upper tail) and critical value (right tail)
pValue        = 1 - jStat.chisquare.cdf(chiSquare, df);
criticalValue = jStat.chisquare.inv(1 - alpha, df);
```

The calculator also flags contingency tables in which any expected cell is below 5, since the chi-square approximation becomes unreliable under that condition; Fisher's exact test is the recommended alternative in that case.

### Visualization Implementation
- SVG-based normal-curve rendering for the Z calculator
- Shaded regions for left-tail, right-tail, and two-tailed probabilities
- The Z-score marker is clamped to the visible x-range ([-4, 4]) to keep the marker on-screen for extreme inputs

## User Guide

### Z-Score Calculator
1. Enter a Z-score or a probability
2. Click the corresponding "Find" button
3. Review the left-, right-, and two-tailed probabilities, percentile, and visualizations

### t-Test Calculator
1. Enter the significance level (alpha)
2. Enter the degrees of freedom (positive integer)
3. Enter the observed t statistic
4. Click "Calculate t Test Results" for p-values, critical values, and a conclusion per tail

### Chi-Square Calculator
1. Choose the number of rows and columns (2-5 each)
2. Click "Generate Table" and fill the contingency table with observed counts
3. (Optional) "Show Contingency Table Info" for expected frequencies and marginal totals
4. Choose a significance level and click "Calculate Chi-Square"
5. (Optional) Save, load, export to CSV, or reset the table

## API Documentation

### Z Calculator (`js/z_calculator.js`)
```javascript
calculateZtoP()    // reads #z-to-p, writes #z-to-p-result and #z-to-p-interpretation
calculatePtoZ()    // reads #p-to-z, writes #p-to-z-result and #p-to-z-interpretation
validateZInput(event)
validatePInput(event)
createNormalCurveVisualization(zScore, type)  // type: 'left' | 'right' | 'both'
generateVisualizations(zScore, probability)
clearResults()
```

### t Calculator (`js/t_calculator.js`)
```javascript
calculateT()   // reads #alpha, #df, #t-stat; writes #p-left, #p-right, #p-two, #t-crit-*, #summary-*, #test-conclusion
resetForm()
```

### Chi-Square Calculator (`js/chi_square.js`)
```javascript
generateTable()
toggleContingencyInfo()
showContingencyInfo()
performChiSquareTest()

calculateExpectedFrequencies(rows, cols, observed)  // returns { expected, rowTotals, colTotals, grandTotal }
calculateChiSquare(observed, expected, rows, cols)  // returns { chiSquare, contributions }
getCriticalValue(df, alpha)
getPValue(chiSquare, df)

exportToCSV()
saveState()
loadState()
resetForm()
setupKeyboardNavigation()
escapeHtml(value)
```

### Shared CSS Classes
- `.calculator-container` - Main container on each calculator page
- `.visualization-box` - Container for SVG visualizations
- `.results-flex-container` - Flex layout for results + summary side-by-side
- `.stats-grid` / `.stat-item` / `.stat-label` / `.stat-value` - Summary statistics
- `.interpretation-details` - Z-calculator rich interpretation block
- `.expected-table` / `.totals-section` / `.totals-grid` - Chi-square contingency displays
- `.warning-message` - Banner shown when chi-square expected counts are below 5

## Troubleshooting

1. Incorrect probability calculations
   - Verify input values are numeric and within their expected range
   - For Z and t inputs, verify the significance level is strictly between 0 and 1

2. Visualization not displaying
   - Confirm the browser supports inline SVG (all modern browsers do)
   - Check the JavaScript console for errors

3. Results not updating
   - Confirm event listeners attached (check console for errors on page load)
   - Verify inputs are not flagged as invalid by HTML5 constraints (red border)
