/**
 * Shared layout: injects the nav bar and marks the active link based on pathname.
 * Keeps a single source of truth for nav links across all calculator pages.
 *
 * Usage: drop a <nav data-ztchi-nav></nav> placeholder into the page, or leave
 * the existing nav in place and this script will rewrite it on DOMContentLoaded.
 */
(function () {
    'use strict';

    const NAV_LINKS = [
        { href: 'index.html', label: 'Home' },
        { href: 'z_calculator.html', label: 'Z Calculator' },
        { href: 't_calculator.html', label: 't Calculator' },
        { href: 'chi_square.html', label: 'Chi-Square Calculator' },
        { href: 'compare.html', label: 'Compare' },
        { href: 'simulate.html', label: 'Simulate' },
        { href: 'epidemiology.html', label: 'Epi 2×2' },
        { href: 'datasets.html', label: 'Datasets' },
        { href: 'assumption.html', label: 'Assumption Coach' },
        { href: 'guide.html', label: 'Guide' },
        { href: 'notation.html', label: 'Notation' },
        { href: 'error-traps.html', label: 'Error Traps' },
    ];

    function currentPage() {
        const path = window.location.pathname || '';
        const file = path.split('/').pop();
        return file && file !== '' ? file : 'index.html';
    }

    function renderNav() {
        const active = currentPage();
        const items = NAV_LINKS.map(({ href, label }) => {
            const cls = href === active ? ' class="active"' : '';
            return `<li><a href="${href}"${cls}>${label}</a></li>`;
        }).join('');
        return `<ul class="nav-bar">${items}</ul>`;
    }

    function injectNav() {
        const navs = document.querySelectorAll('nav[data-ztchi-nav], nav > ul.nav-bar');
        navs.forEach((el) => {
            const nav = el.tagName === 'NAV' ? el : el.parentElement;
            if (nav) nav.innerHTML = renderNav();
        });
    }

    function applyEmbedMode() {
        const params = new URLSearchParams(window.location.search);
        if (params.get('embed') === '1') {
            document.body.classList.add('embed-mode');
        }
    }

    function registerServiceWorker() {
        // Only register when the browser supports SW and we're served over
        // http(s) (GitHub Pages, localhost). Skipped for file:// and in
        // environments where SW isn't supported. Failures are silent.
        if (!('serviceWorker' in navigator)) return;
        if (window.location.protocol === 'file:') return;
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js').catch(() => { /* silent */ });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            applyEmbedMode();
            injectNav();
            registerServiceWorker();
        });
    } else {
        applyEmbedMode();
        injectNav();
        registerServiceWorker();
    }
})();
