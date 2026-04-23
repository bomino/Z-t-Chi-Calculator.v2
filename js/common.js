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
