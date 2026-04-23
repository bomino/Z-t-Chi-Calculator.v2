/**
 * Theme switcher UI.
 * The actual [data-theme] attribute is set before first paint by a tiny
 * inline script in each HTML <head>; this module only handles the
 * interactive switcher (rendered into the nav by layout.js) and
 * localStorage persistence.
 */
(function () {
    'use strict';

    const ZtChi = window.ZtChi || (window.ZtChi = {});
    const LS_KEY = 'ZtChi.theme';
    const OPTIONS = [
        { value: 'auto', label: 'Auto (match system)' },
        { value: 'light', label: 'Light' },
        { value: 'dark', label: 'Dark' },
        { value: 'high-contrast', label: 'High contrast' },
    ];

    function currentStored() {
        try { return localStorage.getItem(LS_KEY) || 'auto'; } catch (_) { return 'auto'; }
    }

    function resolveEffective(pref) {
        if (pref === 'auto') {
            return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
                ? 'dark' : 'light';
        }
        return pref;
    }

    function apply(pref) {
        try { localStorage.setItem(LS_KEY, pref); } catch (_) { /* noop */ }
        const effective = resolveEffective(pref);
        document.documentElement.setAttribute('data-theme', effective);
        // Update any visible switchers (all pages share one nav, but defensive)
        document.querySelectorAll('.theme-switcher select').forEach((sel) => {
            sel.value = pref;
        });
    }

    function renderInto(host) {
        if (!host) return;
        const current = currentStored();
        host.innerHTML =
            `<label class="theme-switcher" aria-label="Theme">` +
            `<span class="theme-switcher-label" aria-hidden="true">🎨 Theme</span>` +
            `<select aria-label="Theme">${
                OPTIONS.map((o) => `<option value="${o.value}"${o.value === current ? ' selected' : ''}>${o.label}</option>`).join('')
            }</select>` +
            `</label>`;
        const select = host.querySelector('select');
        select.addEventListener('change', (e) => apply(e.target.value));
    }

    // If the user chose "auto" and then the OS preference changes at runtime,
    // reflect that change immediately.
    if (window.matchMedia) {
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = () => {
            if (currentStored() === 'auto') apply('auto');
        };
        if (mq.addEventListener) mq.addEventListener('change', handler);
        else if (mq.addListener) mq.addListener(handler);
    }

    ZtChi.theme = { apply, currentStored, resolveEffective, renderInto };
})();
