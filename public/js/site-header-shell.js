/**
 * 同步注入靜態導覽列（零依賴），首屏即有選單；site-header.js 載入後會替換為完整版。
 */
(function (global) {
    function navLang() {
        try {
            var p = new URLSearchParams(global.location.search || '');
            if (p.get('lang')) return String(p.get('lang')).toLowerCase() === 'en' ? 'en' : 'zh-TW';
            var s = global.localStorage.getItem('lang');
            if (s && String(s).toLowerCase() === 'en') return 'en';
        } catch (e) {}
        return 'zh-TW';
    }

    function labels(lang) {
        if (lang === 'en') {
            return {
                customProduct: 'Custom Products',
                remake: 'Design Direction',
                plans: 'Plans & Pricing',
                login: 'Log in',
                brandAlt: 'MatchDO'
            };
        }
        return {
            customProduct: '客製產品',
            remake: '設計風向',
            plans: '方案與定價',
            login: '登入',
            brandAlt: 'MatchDO 合做'
        };
    }

    function injectSiteHeaderShell() {
        var el = document.getElementById('site-header');
        if (!el) return;
        if (el.querySelector('nav.navbar')) return;

        var lang = navLang();
        var L = labels(lang);
        var path = (global.location && global.location.pathname) || '';
        var search = (global.location && global.location.search) || '';
        var customActive = (path.indexOf('/custom') === 0 || path.indexOf('custom-product') !== -1) ? ' active' : '';
        var remakeActive = (path.indexOf('/remake') === 0 || path.indexOf('remake-product') !== -1) ? ' active' : '';
        var loginUrl = '/login.html?returnUrl=' + encodeURIComponent(path + search);

        el.innerHTML =
            '<nav class="navbar navbar-expand-lg bg-white navbar-light sticky-top p-0">' +
            '<a href="/" class="navbar-brand d-flex align-items-center border-end px-4 px-lg-5">' +
            '<img src="/img/matchdo-logo.png" alt="' + L.brandAlt + '" width="120" height="52" decoding="async">' +
            '</a>' +
            '<button type="button" class="navbar-toggler me-4" data-bs-toggle="collapse" data-bs-target="#navbarCollapseShell" aria-label="Menu">' +
            '<span class="navbar-toggler-icon"></span>' +
            '</button>' +
            '<div class="collapse navbar-collapse" id="navbarCollapseShell">' +
            '<div class="navbar-nav ms-auto p-4 p-lg-0">' +
            '<a href="/custom/" class="nav-item nav-link' + customActive + '">' + L.customProduct + '</a>' +
            '<a href="/remake/" class="nav-item nav-link' + remakeActive + '">' + L.remake + '</a>' +
            '<a href="/subscription-plans.html" class="nav-item nav-link">' + L.plans + '</a>' +
            '</div>' +
            '<div class="d-flex align-items-center px-4 pb-3 pb-lg-0" id="authSectionShell">' +
            '<a href="' + loginUrl + '" class="btn btn-primary py-2 px-4"><i class="bi bi-person me-2"></i>' + L.login + '</a>' +
            '</div>' +
            '</div>' +
            '</nav>';

        el.setAttribute('data-header-shell', '1');
    }

    injectSiteHeaderShell();
    global.injectSiteHeaderShell = injectSiteHeaderShell;
})(typeof window !== 'undefined' ? window : this);
