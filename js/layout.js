/**
 * Shared layout: injects the nav bar and marks the active link based on pathname.
 * Keeps a single source of truth for nav links across all calculator pages.
 *
 * Usage: drop a <nav data-ztchi-nav></nav> placeholder into the page, or leave
 * the existing nav in place and this script will rewrite it on DOMContentLoaded.
 */
(function () {
    'use strict';

    // Grouped navigation. Home + three task-shaped dropdowns + a Teach corner.
    // The Teach affordance is visually separated so students don't see it in
    // their primary task list.
    const NAV_GROUPS = [
        { label: 'Home', href: 'index.html' },
        {
            label: 'Calculate',
            children: [
                { href: 'z_calculator.html', label: 'Z Calculator' },
                { href: 't_calculator.html', label: 't Calculator' },
                { href: 'chi_square.html', label: 'Chi-Square' },
                { href: 'compare.html', label: 'Compare Tests' },
                { href: 'corrections.html', label: 'Corrections' },
                { href: 'epidemiology.html', label: 'Epi 2×2' },
            ],
        },
        {
            label: 'Study',
            children: [
                { href: 'simulate.html', label: 'Simulate' },
                { href: 'assumption.html', label: 'Assumption Coach' },
                { href: 'datasets.html', label: 'Datasets' },
            ],
        },
        {
            label: 'Reference',
            children: [
                { href: 'guide.html', label: 'Guide' },
                { href: 'notation.html', label: 'Notation' },
                { href: 'error-traps.html', label: 'Error Traps' },
            ],
        },
    ];

    const TEACH_LINK = { href: 'instructor.html', label: 'Teach' };

    function currentPage() {
        const path = window.location.pathname || '';
        const file = path.split('/').pop();
        return file && file !== '' ? file : 'index.html';
    }

    function renderLink({ href, label }, active) {
        const cls = href === active ? ' class="active"' : '';
        return `<li><a href="${href}"${cls}>${label}</a></li>`;
    }

    function groupContainsActive(group, active) {
        return group.children && group.children.some((c) => c.href === active);
    }

    function renderGroup(group, active) {
        if (!group.children) return renderLink(group, active);
        const hasActive = groupContainsActive(group, active);
        const toggleCls = hasActive ? 'nav-group-toggle active' : 'nav-group-toggle';
        const subId = `nav-sub-${group.label.toLowerCase()}`;
        const items = group.children.map((c) => renderLink(c, active)).join('');
        return (
            `<li class="nav-group">` +
            `<button type="button" class="${toggleCls}" aria-expanded="false" aria-controls="${subId}">` +
            `<span>${group.label}</span><span class="nav-caret" aria-hidden="true">▾</span>` +
            `</button>` +
            `<ul class="nav-submenu" id="${subId}" role="menu">${items}</ul>` +
            `</li>`
        );
    }

    function renderTeach(active) {
        const cls = TEACH_LINK.href === active ? 'nav-teach active' : 'nav-teach';
        return `<li class="${cls}"><a href="${TEACH_LINK.href}" aria-label="Instructor mode"><span class="nav-teach-icon" aria-hidden="true">◆</span> ${TEACH_LINK.label}</a></li>`;
    }

    function renderNav() {
        const active = currentPage();
        const items = NAV_GROUPS.map((g) => renderGroup(g, active)).join('');
        return `<ul class="nav-bar">${items}${renderTeach(active)}</ul>`;
    }

    function wireGroupToggles(nav) {
        const toggles = nav.querySelectorAll('.nav-group-toggle');
        toggles.forEach((toggle) => {
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const parent = toggle.closest('.nav-group');
                const expanded = toggle.getAttribute('aria-expanded') === 'true';
                // Close all other groups
                nav.querySelectorAll('.nav-group.open').forEach((el) => {
                    if (el !== parent) {
                        el.classList.remove('open');
                        const t = el.querySelector('.nav-group-toggle');
                        if (t) t.setAttribute('aria-expanded', 'false');
                    }
                });
                parent.classList.toggle('open', !expanded);
                toggle.setAttribute('aria-expanded', String(!expanded));
            });
        });
        // Close open dropdowns when clicking elsewhere or pressing Escape
        document.addEventListener('click', (e) => {
            if (!nav.contains(e.target)) {
                nav.querySelectorAll('.nav-group.open').forEach((el) => {
                    el.classList.remove('open');
                    const t = el.querySelector('.nav-group-toggle');
                    if (t) t.setAttribute('aria-expanded', 'false');
                });
            }
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                nav.querySelectorAll('.nav-group.open').forEach((el) => {
                    el.classList.remove('open');
                    const t = el.querySelector('.nav-group-toggle');
                    if (t) t.setAttribute('aria-expanded', 'false');
                });
            }
        });
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
                // Auto-close the menu when a leaf link inside is clicked (mobile UX).
                // Group-toggle buttons are handled separately and must not collapse
                // the whole menu when opening a submenu.
                list.addEventListener('click', (e) => {
                    if (e.target.tagName === 'A') {
                        list.classList.remove('open');
                        toggle.setAttribute('aria-expanded', 'false');
                    }
                });
            }

            wireGroupToggles(nav);

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
