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
        { href: 'corrections.html', label: 'Corrections' },
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
            if (!nav) return;
            // Inject the mobile toggle + the nav list. CSS hides/shows the
            // toggle based on viewport width.
            nav.innerHTML =
                `<button type="button" class="nav-toggle" aria-expanded="false" aria-controls="ztchi-nav-list">` +
                `<span class="menu-icon" aria-hidden="true">☰</span><span class="menu-label">Menu</span>` +
                `</button>` +
                renderNav() +
                `<div class="theme-switcher-host"></div>`;

            const toggle = nav.querySelector('.nav-toggle');
            const list = nav.querySelector('.nav-bar');
            if (toggle && list) {
                list.id = 'ztchi-nav-list';
                toggle.addEventListener('click', () => {
                    const expanded = toggle.getAttribute('aria-expanded') === 'true';
                    toggle.setAttribute('aria-expanded', String(!expanded));
                    list.classList.toggle('open');
                });
                // Auto-close the menu when a link inside is clicked (mobile UX)
                list.addEventListener('click', (e) => {
                    if (e.target.tagName === 'A') {
                        list.classList.remove('open');
                        toggle.setAttribute('aria-expanded', 'false');
                    }
                });
            }

            // Theme switcher (if theme.js loaded)
            const themeHost = nav.querySelector('.theme-switcher-host');
            if (themeHost && window.ZtChi && window.ZtChi.theme) {
                window.ZtChi.theme.renderInto(themeHost);
            }
        });
    }

    /**
     * Toggle the `is-overflowing` class on each `.table-container` that
     * currently has more horizontal content than it can show. Drives the
     * right-edge scroll-hint gradient defined in styles.css.
     */
    function wireTableOverflowHints() {
        const update = () => {
            document.querySelectorAll('.table-container').forEach((el) => {
                const overflowing = el.scrollWidth > el.clientWidth + 1 &&
                    el.scrollLeft + el.clientWidth + 1 < el.scrollWidth;
                el.classList.toggle('is-overflowing', overflowing);
            });
        };
        update();
        window.addEventListener('resize', update);
        document.querySelectorAll('.table-container').forEach((el) => {
            el.addEventListener('scroll', update);
        });
        // Re-check after any DOM mutation inside a container (e.g., chi-square
        // regenerating the table with new dimensions).
        if (window.MutationObserver) {
            document.querySelectorAll('.table-container').forEach((el) => {
                const mo = new MutationObserver(update);
                mo.observe(el, { childList: true, subtree: true });
            });
        }
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
            navigator.serviceWorker.register('./sw.js').then((registration) => {
                // Detect new SW version and prompt the user to refresh.
                // The browser will have downloaded sw.js in the background;
                // if CACHE_VERSION changed, a new SW installs in the waiting
                // state while the old one still controls the page.
                function showUpdateToast() {
                    if (window.ZtChi && window.ZtChi.showNotification) {
                        window.ZtChi.showNotification(
                            'New version available. Reload this tab to apply the update.',
                            'info', { duration: 15000 }
                        );
                    }
                }
                // Case A: an update was found during this session.
                registration.addEventListener('updatefound', () => {
                    const installing = registration.installing;
                    if (!installing) return;
                    installing.addEventListener('statechange', () => {
                        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                            showUpdateToast();
                        }
                    });
                });
                // Case B: a waiting SW was already there when the page loaded
                // (user closed previous tabs while update was waiting).
                if (registration.waiting && navigator.serviceWorker.controller) {
                    showUpdateToast();
                }
                // Poll once every hour so long-lived tabs pick up updates.
                setInterval(() => { registration.update().catch(() => {}); }, 60 * 60 * 1000);
            }).catch(() => { /* silent */ });

            // If the active SW changes, the page will soon be controlled by
            // the new one — reload once to pick up the freshest assets.
            // Guarded to avoid infinite-reload loops when the user has
            // skipWaiting-style flows triggered from the SW itself.
            let _reloaded = false;
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (_reloaded) return;
                _reloaded = true;
                // Don't reload if skipWaiting is claiming the page on first
                // install (no previous controller). controllerchange fires
                // once on first install too, but _reloaded guards against
                // unnecessary thrash.
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            applyEmbedMode();
            injectNav();
            wireTableOverflowHints();
            registerServiceWorker();
        });
    } else {
        applyEmbedMode();
        injectNav();
        wireTableOverflowHints();
        registerServiceWorker();
    }
})();
