/**
 * 網站共用導航系統
 * 修改時注意：勿在同一 function 重複宣告變數；登入連結須帶 returnUrl。詳見 .cursor/rules/site-header-and-auth.mdc
 */
(function () {
    // Bootstrap JS 全站保底載入
    if (typeof window.bootstrap === 'undefined' && !document.getElementById('bs-bundle-js')) {
        var _bs = document.createElement('script');
        _bs.id = 'bs-bundle-js';
        _bs.src = 'https://cdn.jsdelivr.net/npm/bootstrap@5.0.0/dist/js/bootstrap.bundle.min.js';
        document.head.appendChild(_bs);
    }
    // Space Grotesk 字型保底載入
    if (!document.getElementById('nb-font')) {
        var _f = document.createElement('link');
        _f.id = 'nb-font';
        _f.rel = 'stylesheet';
        _f.href = 'https://fonts.googleapis.com/css2?family=Space+Grotesk&display=swap';
        document.head.appendChild(_f);
    }
    // Navbar 全站統一樣式注入
    if (!document.getElementById('nb-css')) {
        var _c = document.createElement('style');
        _c.id = 'nb-css';
        _c.textContent = [
            '#site-header{min-height:60px;}',
            '.navbar{padding:15px 0;font-family:"Space Grotesk",sans-serif;font-size:18px;border-bottom:2px solid #445D7E;}',
            '.navbar .navbar-nav .nav-link{margin-left:30px;padding:0;outline:none;color:#333;}',
            '.navbar .navbar-nav .nav-link .nav-hover-caret{color:#445D7E;font-size:16px;line-height:1;vertical-align:middle;margin-left:4px;opacity:.6;transition:opacity .15s;}',
            '.navbar .navbar-nav .nav-link:hover .nav-hover-caret,.navbar .navbar-nav .nav-link.active .nav-hover-caret{opacity:1;}',
            '.navbar .navbar-nav .nav-link:hover,.navbar .navbar-nav .nav-link.active{color:#445D7E!important;}',
            '.navbar .dropdown-toggle::after{display:none!important;}',
            '.navbar .dropdown-menu .dropdown-item:hover,.navbar .dropdown-menu .dropdown-item.active{background:#445D7E!important;color:#fff!important;}',
            '@keyframes nbDropIn{from{opacity:0;transform:translateY(-6px);}to{opacity:1;transform:translateY(0);}}',
            '.nav-hover-menu{min-width:180px;padding:.5rem 0;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.12);border:1px solid #e5e7eb;}',
            '.nav-hover-menu .dropdown-item{font-size:.9rem;padding:.5rem 1rem;display:flex;align-items:center;gap:.5rem;color:#374151;}',
            '.nav-hover-menu .dropdown-item:hover{background:#445D7E!important;color:#fff!important;}',
            '@media(max-width:991.98px){.navbar .navbar-nav .nav-link{margin-left:0;padding:10px 0;}}',
            '@media(min-width:992px){',
            '.nav-item.nav-has-hover:hover .nav-hover-caret{opacity:1;}',
            '.nav-item.nav-has-hover:hover>.nav-hover-menu{display:block;margin-top:2px;animation:nbDropIn .15s ease;}',
            '#site-header .navbar{flex-wrap:wrap;}',
            '#site-header .navbar-collapse{order:1;width:100%;flex-grow:1;border-bottom:1px solid #dee2e6;}',
            '#site-header .navbar-brand{order:2;display:flex!important;border-right:none!important;padding:0;margin:-39px auto 0;position:relative;z-index:5;}',
            '#site-header .nav-second-row-wrap .navbar-brand{order:0!important;margin:-39px auto 0!important;}',
            '#site-header .navbar-brand img{height:78px!important;background:#fff;padding:4px 12px;border-radius:4px;}',
            '#site-header #authSection{width:auto;min-width:auto;max-width:none;justify-content:flex-end;padding-left:0.5rem;padding-right:0;}',
            '#site-header .nav-avatar-toggle{flex-direction:column;background:transparent!important;border:none;}',
            '#site-header .nav-avatar-toggle .nav-avatar-ring{flex-shrink:0;background:var(--bs-primary);}',
            '#site-header .nav-avatar-toggle:hover .nav-avatar-ring{filter:brightness(1.1);}',
            '#site-header .nav-avatar-toggle::after{display:block!important;margin-left:0;margin-top:2px;color:#445D7E!important;border-top-color:#445D7E!important;}',
            '}'
        ].join('');
        document.head.appendChild(_c);
    }
    // 不在此渲染 navbar 內容，統一交由 DOMContentLoaded 的 loadSiteHeader 處理
    // 原因：IIFE 執行時 i18n 未就緒，渲染出錯誤 key；且二次渲染會造成跳動
})();

function getPublicConfig() {
    if (window.__PUBLIC_CONFIG__) return Promise.resolve(window.__PUBLIC_CONFIG__);
    return fetch('/api/public-config').then(function (r) { return r.json(); }).then(function (j) {
        window.__PUBLIC_CONFIG__ = j;
        return j;
    }).catch(function () {
        window.__PUBLIC_CONFIG__ = { enableServiceMatching: false };
        return window.__PUBLIC_CONFIG__;
    });
}

/** 登入後會員三區能力（additive；失敗時回 null，header 維持舊行為） */
async function fetchMeCapabilities() {
    if (typeof window.AuthService === 'undefined' || !window.AuthService.getSession) return null;
    try {
        var session = await window.AuthService.getSession();
        if (!session || !session.access_token) return null;
        var r = await fetch('/api/me/capabilities', {
            headers: { Authorization: 'Bearer ' + session.access_token }
        });
        if (!r.ok) return null;
        return await r.json();
    } catch (e) {
        return null;
    }
}

function ensureNavLocaleReady() {
    if (window.i18n && window.i18n.ready) {
        return window.i18n.ready.then(function () {
            if (window.i18n && window.i18n.t) return window.__I18N__ && window.__I18N__.messages;
            return {};
        });
    }
    var lang = 'zh-TW';
    try {
        var params = new URLSearchParams(window.location.search || '');
        if (params.get('lang')) lang = params.get('lang').toLowerCase() === 'en' ? 'en' : 'zh-TW';
        else {
            var stored = localStorage.getItem('lang');
            if (stored && stored.toLowerCase() === 'en') lang = 'en';
        }
    } catch (e) {}
    return fetch('/locales/' + lang + '.json')
        .then(function (r) { return r.ok ? r.json() : {}; })
        .then(function (data) {
            window.__I18N__ = { lang: lang, messages: data || {} };
            if (!window.i18n) window.i18n = {};
            window.i18n.getLang = function () { return lang; };
            window.i18n.t = function (k) { return (window.__I18N__.messages && window.__I18N__.messages[k]) || k; };
            return data;
        })
        .catch(function () { return {}; });
}

var _siteHeaderAuthListenersBound = false;

function bindSiteHeaderAuthListeners(initialSession) {
    if (_siteHeaderAuthListenersBound) return;
    _siteHeaderAuthListenersBound = true;
    if (window.AuthService && typeof AuthService.onAuthStateChange === 'function') {
        AuthService.onAuthStateChange(function (event, newSession) {
            if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
                _navFullyRendered = false;
                loadSiteHeader(newSession);
                return;
            }
            if (event === 'INITIAL_SESSION') {
                var hadUser = _lastRenderedUserId != null && _lastRenderedUserId !== undefined;
                var hasUser = newSession && newSession.user;
                if (hasUser && !hadUser) {
                    _navFullyRendered = false;
                    loadSiteHeader(newSession);
                }
            }
        });
    }
    scheduleHeaderAuthRetries(initialSession);
}

function bootSiteHeader() {
    var headerContainer = document.getElementById('site-header');
    if (!headerContainer || headerContainer.getAttribute('data-header-booted') === '1') return;
    headerContainer.setAttribute('data-header-booted', '1');
    var session = (window.getSessionFromStorage && window.getSessionFromStorage()) || window.__authSessionForHeader || null;
    loadSiteHeader(session, { fastFirst: true }).then(function () {
        bindSiteHeaderAuthListeners(session);
    }).catch(function (err) {
        console.error('site-header init:', err);
        loadSiteHeader(session || window.__authSessionForHeader || null, { fastFirst: true }).then(function () {
            bindSiteHeaderAuthListeners(session);
        });
    });
    Promise.all([
        ensureNavLocaleReady(),
        new Promise(function (resolve) { setTimeout(resolve, 0); })
    ]).then(function () {
        var sess = (window.getSessionFromStorage && window.getSessionFromStorage()) || window.__authSessionForHeader || session || null;
        _navFullyRendered = false;
        return loadSiteHeader(sess, { fastFirst: false });
    }).catch(function () {});
}

if (document.getElementById('site-header')) {
    bootSiteHeader();
}
document.addEventListener('DOMContentLoaded', bootSiteHeader);

/** locale 或首次渲染較慢時，稍後再以 session 重畫（避免誤顯示「登入」） */
function scheduleHeaderAuthRetries(initialSession) {
    var delays = [400, 1200];
    delays.forEach(function (ms) {
        setTimeout(function () {
            if (_lastRenderedUserId) return;
            var s = (window.getSessionFromStorage && window.getSessionFromStorage()) || window.__authSessionForHeader || initialSession || null;
            if (s && s.user) {
                _navFullyRendered = false;
                loadSiteHeader(s);
            } else if (window.AuthService && typeof AuthService.getSession === 'function') {
                AuthService.getSession().then(function (sess) {
                    if (sess && sess.user && !_lastRenderedUserId) {
                        _navFullyRendered = false;
                        loadSiteHeader(sess);
                    }
                }).catch(function () {});
            }
        }, ms);
    });
}

var _lastRenderedUserId = undefined;
var _navFullyRendered = false;
async function resolveHeaderUser(sessionFromEvent, opts) {
    opts = opts || {};
    var user = sessionFromEvent && sessionFromEvent.user ? sessionFromEvent.user : null;
    if (!user && window.__authSessionForHeader && window.__authSessionForHeader.user) {
        user = window.__authSessionForHeader.user;
    }
    if (!user && window.getSessionFromStorage) {
        var fromStore = getSessionFromStorage();
        if (fromStore && fromStore.user) user = fromStore.user;
    }
    if (!opts.allowNetworkSession) return user;
    if (!user && window.AuthService) {
        try {
            var session = await AuthService.getSession();
            user = session && session.user ? session.user : null;
        } catch (e) {}
    }
    return user;
}

function loadSiteHeader(sessionFromEvent, options) {
    options = options || {};
    var headerContainer = document.getElementById('site-header');
    if (!headerContainer) return Promise.resolve();
    return (async function () {
        var fastFirst = !!options.fastFirst;
        var user = await resolveHeaderUser(sessionFromEvent, { allowNetworkSession: !fastFirst });
        var uid = user ? (user.id || user.email || 'user') : null;
        if (_navFullyRendered && uid === _lastRenderedUserId) return;

        if (fastFirst) {
            await renderHeader(headerContainer, user, { enableServiceMatching: false }, null, { skipProfile: true });
            _lastRenderedUserId = uid;
            _navFullyRendered = true;
            return;
        }

        var configCaps = await Promise.all([
            getPublicConfig(),
            user ? fetchMeCapabilities() : Promise.resolve(null)
        ]);
        await renderHeader(headerContainer, user, configCaps[0], configCaps[1], { skipProfile: false });
        _lastRenderedUserId = uid;
        _navFullyRendered = true;
    })();
}

function isCustomProductSection() {
    const p = (typeof window !== 'undefined' && window.location && window.location.pathname) ? window.location.pathname : '';
    return p.startsWith('/custom') || p.includes('custom-product') || p.includes('my-custom-products') || p.includes('manufacturer-');
}
function isRemakeSection() {
    const p = (typeof window !== 'undefined' && window.location && window.location.pathname) ? window.location.pathname : '';
    return p.startsWith('/remake') || p.includes('remake-product');
}

/**
 * 全站選單＋登入區。修改時必守：
 * - 本 function 內勿重複宣告同一變數（例如已有 const path 就不要再 var path），否則整支腳本報錯、選單與登入會壞。
 * - loginHref 必須帶 returnUrl 或使用 AuthService.getLoginUrl(path)，不可只寫 '/login.html'。
 */
async function renderHeader(headerContainer, user, config, meCapabilitiesPreloaded, renderOpts) {
    renderOpts = renderOpts || {};
    if (!config) config = { enableServiceMatching: false };
    // 服務媒合選單已廢除，不再顯示（不依 config，避免誤觸或快取導致再次出現）
    // 讀快取名字/頭像，避免顯示「載入中...」
    var _nbCache = null;
    try { _nbCache = JSON.parse(localStorage.getItem('nb_uinfo') || 'null'); } catch(e) {}
    var _nbCacheOk = _nbCache && user && _nbCache.id === user.id;
    var _initDisplayName = _nbCacheOk ? _nbCache.name : (user && (user.user_metadata?.full_name || user.email?.split('@')[0]) || '用戶');
    var _initAvatarUrl = _nbCacheOk ? _nbCache.avatar : (user && (user.user_metadata?.avatar_url || ('https://ui-avatars.com/api/?name=' + encodeURIComponent(_initDisplayName) + '&background=667eea&color=fff')) || '');
    let isAdmin = false;
    let isTesterOrAdmin = false;
    if (user && window.AuthService && !renderOpts.skipProfile) {
        try {
            const profile = await AuthService.getUserProfile();
            isAdmin = user.user_metadata?.role === 'admin' || profile?.role === 'admin';
            isTesterOrAdmin = isAdmin || user.user_metadata?.role === 'tester' || profile?.role === 'tester';
        } catch (error) {
            console.error('無法取得用戶角色:', error);
        }
    }
    const isCustom = isCustomProductSection();
    const isRemake = isRemakeSection();
    const brandUrl = '/';
    const path = (typeof window !== 'undefined' && window.location && window.location.pathname) ? window.location.pathname : '';
    const isHomePage = path === '/' || path === '/index.html' || path === '';
    const homeActive = isHomePage ? ' active' : '';
    const customActive = isCustom ? ' active' : '';
    const remakeActive = isRemake ? ' active' : '';
    const customUrl = '/custom/';
    const remakeUrl = '/remake/';
        const loginHref = (typeof AuthService !== 'undefined' && AuthService.getLoginUrl) ? AuthService.getLoginUrl(path) : ('/login.html?returnUrl=' + encodeURIComponent(path || '/'));
    if ((isCustom || isRemake) && typeof document !== 'undefined' && document.documentElement) {
        document.documentElement.setAttribute('data-theme', isRemake ? 'remake' : 'custom');
        if (!document.querySelector('link[href*="theme-custom.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = '/css/theme-custom.css';
            document.head.appendChild(link);
        }
    }
    // 登入即顯示「我的功能」：僅放頂部選單沒有的工作入口（不重複客製產品／設計風向 ▾）。
    const showMyFeaturesDropdown = !!user;
    var meCapabilities = meCapabilitiesPreloaded != null ? meCapabilitiesPreloaded : null;
    if (user && meCapabilities == null) {
        meCapabilities = await fetchMeCapabilities();
    }
    if (user && meCapabilities) {
        try {
            window.__ME_CAPABILITIES__ = meCapabilities;
        } catch (eCap) {}
    }
    var showSupplierZone = meCapabilities
        ? !!(meCapabilities.nav && meCapabilities.nav.show_supplier_zone)
        : true;
    var rawT = (window.i18n && window.i18n.t) ? window.i18n.t : function (k) { return k; };
    var navLang = (window.i18n && window.i18n.getLang) ? window.i18n.getLang() : ((window.__I18N__ && window.__I18N__.lang) || 'zh-TW');
    var navFallbackZh = { 'nav.brand': 'MatchDO 合做', 'nav.home': '首頁', 'nav.serviceMatching': '服務媒合', 'nav.customProduct': '客製產品', 'nav.remake': '設計風向', 'nav.remakeSection': '設計風向', 'nav.remakeHome': '設計風向首頁', 'nav.remakeAnalysis': '設計意圖分析', 'nav.remakeDesign': '設計意圖分析', 'nav.remakeMyDesigns': '我的設計風向', 'nav.remakeGallery': '圖庫找靈感', 'nav.subscriptionPlans': '方案與定價', 'nav.login': '登入', 'nav.myFeatures': '我的功能', 'nav.myFeaturesTitle': '工作入口', 'nav.accountInfo': '帳號資訊', 'nav.dropdownRoles': '依角色分類', 'nav.customizerSection': '訂製者', 'nav.manufacturerSection': '製造商', 'nav.supplierSection': '產業供應商', 'nav.supplierPortal': '供應商入口', 'nav.supplierPrototypeLib': '原型組目錄', 'nav.supplierMaterialLib': '材料目錄', 'nav.dropdownCustom': '訂製品（客戶／供應商兼用）', 'nav.dropdownCustomClient': '訂製品客戶', 'nav.designSection': '設計／找廠商', 'nav.vendorSection': '製造商', 'nav.customHome': '客製產品首頁', 'nav.createProduct': '建立新產品', 'nav.myCustomProducts': '我的數位資產', 'nav.galleryFindVendor': '圖庫找廠商', 'nav.dropdownVendor': '訂製品供應商', 'nav.createVendor': '建立廠商資料', 'nav.vendorDashboard': '廠商控制台', 'nav.vendorPortfolio': '我的廠商作品', 'nav.vendorBaseModels': '我的數位版型 (Base Models)', 'nav.vendorInquiries': '訂製詢價列表', 'nav.vendorContact': '聯絡方式（與設計者溝通）', 'nav.myCredits': '我的點數', 'nav.findMakers': '找製作方', 'nav.myMessages': '我的對話', 'nav.makerSection': '製作方', 'nav.demands': '訂製需求', 'nav.dropdownWork': '工作入口', 'nav.expertSection': '專家功能', 'nav.expertDashboard': '專家控制台', 'nav.myListings': '我的報價', 'nav.matchedProjects': '我已媒合的專案', 'nav.browseProjects': '可媒合專案', 'nav.myPortfolio': '我的作品', 'nav.clientSection': '發案功能', 'nav.clientDashboard': '發案控制台', 'nav.myProjects': '我的專案', 'nav.accountSettings': '帳號與設定', 'nav.loading': '載入中...', 'nav.settings': '設定', 'nav.contactSettings': '聯絡資訊設定', 'nav.adminSection': '管理功能', 'nav.userManagement': '用戶管理', 'nav.categoryManagement': '分類管理', 'nav.categoryImages': '分類圖片管理', 'nav.logout': '登出', 'nav.langZh': '中文', 'nav.langEn': 'EN', 'nav.aiUpscale': 'AI 圖片放大', 'nav.aiEditArea': '我的 AI 編輯區' };
    var navFallbackEn = { 'nav.brand': 'MatchDO', 'nav.home': 'Home', 'nav.customProduct': 'Custom Products', 'nav.remake': 'Design Direction', 'nav.remakeSection': 'Design Direction', 'nav.remakeHome': 'Design Direction home', 'nav.remakeAnalysis': 'Design intent analysis', 'nav.remakeDesign': 'Design intent analysis', 'nav.remakeMyDesigns': 'My design directions', 'nav.remakeGallery': 'Gallery & inspiration', 'nav.subscriptionPlans': 'Plans & Pricing', 'nav.login': 'Log in', 'nav.myFeatures': 'My Workspace', 'nav.myFeaturesTitle': 'Workspace', 'nav.dropdownCustom': 'Custom products', 'nav.dropdownRoles': 'By role', 'nav.designSection': 'Design / Find vendor', 'nav.customizerSection': 'Customizer', 'nav.manufacturerSection': 'Manufacturer', 'nav.supplierSection': 'Industry supplier', 'nav.supplierPortal': 'Supplier portal', 'nav.supplierPrototypeLib': 'Prototype sets', 'nav.supplierMaterialLib': 'Materials catalog', 'nav.customHome': 'Custom product home', 'nav.createProduct': 'Create product', 'nav.myCustomProducts': 'My digital assets', 'nav.galleryFindVendor': 'Gallery – find vendors', 'nav.findMakers': 'Find makers', 'nav.myMessages': 'My messages', 'nav.myCredits': 'My credits', 'nav.aiEditArea': 'My AI edit area', 'nav.createVendor': 'Create vendor profile', 'nav.demands': 'Customization requests', 'nav.vendorDashboard': 'Vendor dashboard', 'nav.vendorPortfolio': 'My portfolio', 'nav.vendorBaseModels': 'My base models', 'nav.vendorContact': 'Contact (for designers)', 'nav.clientDashboard': 'Project console', 'nav.accountInfo': 'Account', 'nav.accountSettings': 'Account & settings', 'nav.contactSettings': 'Contact settings', 'nav.logout': 'Log out', 'nav.langZh': '中文', 'nav.langEn': 'EN' };
    var navFallback = (navLang === 'en') ? navFallbackEn : navFallbackZh;
    var t = function (k) { var v = rawT(k); return (v && v !== k) ? v : (navFallback[k] || k); };
    var showLangSwitch = path.indexOf('/admin/') === -1;
    const navHTML = `
        <!-- Navbar Start -->
        <nav class="navbar navbar-expand-lg bg-white navbar-light sticky-top p-0">
            <a href="${brandUrl}" class="navbar-brand d-flex align-items-center border-end px-4 px-lg-5 ${user ? 'd-lg-none' : ''}">
                <img src="/img/matchdo-logo.png" alt="MatchDO 合做" style="height:52px;width:auto;">
            </a>
            ${user ? `<div id="navPointsMobile" class="d-lg-none nav-points-mobile align-self-center ms-auto me-2"><a href="/credits.html" class="nav-points-link text-decoration-none"><i class="bi bi-currency-exchange me-1"></i><span id="navPointsMobileValue">—</span> 點</a></div>` : ''}
            <button type="button" class="navbar-toggler me-4" data-bs-toggle="collapse" data-bs-target="#navbarCollapse">
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="navbarCollapse">
                <div class="navbar-nav ms-auto p-4 p-lg-0">
                    <div class="nav-item dropdown nav-has-hover">
                        <a href="${customUrl}" class="nav-link${customActive}" style="display:inline-flex;align-items:center;">` + t('nav.customProduct') + `<span class="nav-hover-caret">▾</span></a>
                        <div class="dropdown-menu nav-hover-menu">
                            <a href="/custom-product.html" class="dropdown-item"><i class="bi bi-plus-circle"></i>建立客製產品</a>
                            <a href="/client/find-makers.html" class="dropdown-item"><i class="bi bi-shop"></i>找製作方</a>
                            <a href="/custom/gallery.html" class="dropdown-item"><i class="bi bi-images"></i>圖庫找廠商</a>
                            <a href="/client/my-custom-products.html" class="dropdown-item"><i class="bi bi-box-seam"></i>我的數位資產</a>
                        </div>
                    </div>
                    <div class="nav-item dropdown nav-has-hover">
                        <a href="${remakeUrl}" class="nav-link${remakeActive}" style="display:inline-flex;align-items:center;">` + (t('nav.remake') || '設計風向') + `<span class="badge bg-warning text-dark ms-1" style="font-size:0.65rem;font-weight:500;" title="` + (t('remake.badgeTesting') || '測試中') + `">` + (t('remake.badgeTesting') || '測試中') + `</span><span class="nav-hover-caret">▾</span></a>
                        <div class="dropdown-menu nav-hover-menu">
                            <h6 class="dropdown-header text-muted small">` + t('nav.remakeSection') + `</h6>
                            <a href="${remakeUrl}" class="dropdown-item"><i class="bi bi-compass"></i>` + t('nav.remakeHome') + `</a>
                            <a href="/remake-product.html" class="dropdown-item"><i class="bi bi-lightbulb"></i>` + t('nav.remakeAnalysis') + `</a>
                            <a href="/client/my-custom-products.html?view=design-direction" class="dropdown-item"><i class="bi bi-collection"></i>` + t('nav.remakeMyDesigns') + `</a>
                            <div class="dropdown-divider"></div>
                            <a href="/client/find-makers.html" class="dropdown-item"><i class="bi bi-shop"></i>` + t('nav.findMakers') + `</a>
                            <a href="/custom/gallery.html" class="dropdown-item"><i class="bi bi-images"></i>` + t('nav.remakeGallery') + `</a>
                        </div>
                    </div>
                    <a href="/subscription-plans.html" class="nav-item nav-link nav-link-subscription">` + (t('nav.subscriptionPlans') || '方案與定價') + `</a>
                    
                    ${showMyFeaturesDropdown ? `
                        <div class="nav-item dropdown">
                            <a href="#" class="nav-link dropdown-toggle" data-bs-toggle="dropdown" title="` + t('nav.myFeaturesTitle') + `" style="display:inline-flex;align-items:center;">` + t('nav.myFeatures') + `<span class="nav-hover-caret">▾</span></a>
                            <div class="dropdown-menu bg-light m-0">
                                <h6 class="dropdown-header text-muted small">` + t('nav.myFeaturesTitle') + `</h6>
                                <h6 class="dropdown-header"><i class="bi bi-pencil-square me-2"></i>` + t('nav.customizerSection') + `</h6>
                                <a href="/client/dashboard.html" class="dropdown-item"><i class="bi bi-speedometer2 me-2"></i>` + t('nav.clientDashboard') + `</a>
                                <a href="/client/messages.html" class="dropdown-item"><i class="bi bi-chat-dots me-2"></i>` + t('nav.myMessages') + `</a>
                                <a href="/credits.html" class="dropdown-item"><i class="bi bi-currency-exchange me-2"></i>` + t('nav.myCredits') + `</a>
                                <a href="/client/ai-edit.html" class="dropdown-item"><i class="bi bi-palette me-2"></i>` + t('nav.aiEditArea') + `</a>
                                <div class="dropdown-divider"></div>
                                <h6 class="dropdown-header"><i class="bi bi-shop me-2"></i>` + t('nav.manufacturerSection') + `</h6>
                                <a href="/client/manufacturer-dashboard.html" class="dropdown-item"><i class="bi bi-speedometer2 me-2"></i>` + t('nav.vendorDashboard') + `</a>
                                <a href="#" id="nav-my-vendor-home" class="dropdown-item d-none"><i class="bi bi-house-door me-2"></i>` + t('nav.myVendorPublicPage') + `</a>
                                <a href="/client/manufacturer-portfolio.html" class="dropdown-item"><i class="bi bi-images me-2"></i>` + t('nav.vendorPortfolio') + `</a>
                                <a href="/client/manufacturer-materials.html" class="dropdown-item"><i class="bi bi-folder2-open me-2"></i>` + t('nav.vendorBaseModels') + `</a>
                                <a href="/client/demands.html" class="dropdown-item"><i class="bi bi-inbox me-2"></i>` + t('nav.demands') + `</a>
                                <a href="/profile/contact-info.html" class="dropdown-item"><i class="bi bi-chat-dots me-2"></i>` + t('nav.vendorContact') + `</a>
                                <div class="dropdown-divider"></div>
                                <a href="/client/manufacturer-dashboard.html" class="dropdown-item text-muted small"><i class="bi bi-building-add me-2"></i>` + t('nav.createVendor') + `</a>
                                <a href="/vendors.html" class="dropdown-item text-muted small"><i class="bi bi-grid me-2"></i>` + t('nav.browseAllVendors') + `</a>
                                ${showSupplierZone ? `
                                <div class="dropdown-divider"></div>
                                <h6 class="dropdown-header"><i class="bi bi-truck me-2"></i>` + t('nav.supplierSection') + `</h6>
                                <a href="/client/supplier-portal.html" class="dropdown-item"><i class="bi bi-box-seam me-2"></i>` + t('nav.supplierPortal') + `</a>
                                <a href="/client/supplier-portal.html" class="dropdown-item"><i class="bi bi-layers me-2"></i>` + t('nav.supplierPrototypeLib') + `</a>
                                <a href="/client/supplier-portal.html" class="dropdown-item"><i class="bi bi-palette me-2"></i>` + t('nav.supplierMaterialLib') + `</a>
                                ` : ''}
                            </div>
                        </div>
                    ` : ''}
                    
                </div>
                
                ${showLangSwitch ? '<div class="d-none d-lg-flex align-items-center px-2 border-end"><a href="#" class="lang-link small text-muted text-decoration-none me-1" data-lang="zh-TW">' + t('nav.langZh') + '</a><span class="text-muted">|</span><a href="#" class="lang-link small text-muted text-decoration-none ms-1" data-lang="en">' + t('nav.langEn') + '</a></div>' : ''}
                
                <div class="d-none d-lg-flex align-items-center px-4" id="authSection">
                    ${user ? `
                        <div class="dropdown">
                            <a class="btn btn-primary p-0 d-flex align-items-center justify-content-center dropdown-toggle nav-avatar-toggle" href="#" role="button" data-bs-toggle="dropdown" id="userDropdownDesktop" title="${_initDisplayName}">
                                <span class="nav-avatar-ring d-flex align-items-center justify-content-center" style="width:42px;height:42px;border-radius:50%;overflow:hidden;"><img id="userAvatar" src="${_initAvatarUrl}" alt="" style="width:30px;height:30px;border-radius:50%;object-fit:cover;display:block;"></span>
                            </a>
                            <ul class="dropdown-menu dropdown-menu-end" aria-labelledby="userDropdownDesktop">
                                <li class="dropdown-header text-muted small">` + t('nav.accountSettings') + `</li>
                                <li><a class="dropdown-item" href="/"><i class="bi bi-house me-2"></i>` + t('nav.home') + `</a></li>
                                <li><hr class="dropdown-divider"></li>
                                <li class="dropdown-header"><i class="bi bi-gear me-2"></i>` + t('nav.settings') + `</li>
                                <li><a class="dropdown-item" href="/profile/account.html"><i class="bi bi-person-circle me-2"></i>` + (t('nav.accountInfo') || '帳號資訊') + `</a></li>
                                <li><a class="dropdown-item" href="/credits.html"><i class="bi bi-currency-exchange me-2"></i>` + (t('nav.myCredits') || '我的點數') + `</a></li>
                                <li><a class="dropdown-item" href="/profile/contact-info.html"><i class="bi bi-telephone me-2"></i>` + t('nav.contactSettings') + `</a></li>
                                ${isTesterOrAdmin ? `
                                <li><hr class="dropdown-divider"></li>
                                <li class="dropdown-header"><i class="bi bi-shield-lock me-2"></i>` + (isAdmin ? t('nav.adminSection') : '測試員功能') + `</li>
                                <li><a class="dropdown-item" href="/admin/playground.html"><i class="bi bi-brush me-2"></i>Playground</a></li>
                                <li><a class="dropdown-item" href="/admin/ai-tools.html"><i class="bi bi-magic me-2"></i>AI 工具</a></li>
                                ` + (isAdmin ? `
                                <li><a class="dropdown-item" href="/admin/user-management.html"><i class="bi bi-people me-2"></i>` + t('nav.userManagement') + `</a></li>
                                <li><a class="dropdown-item" href="/admin/payment-settings.html"><i class="bi bi-currency-exchange me-2"></i>金流設定</a></li>
                                <li><a class="dropdown-item" href="/admin/categories.html"><i class="bi bi-tag me-2"></i>` + t('nav.categoryManagement') + `</a></li>
                                <li><a class="dropdown-item" href="/admin/category-images.html"><i class="bi bi-images me-2"></i>` + t('nav.categoryImages') + `</a></li>
                                ` : '') + `
                                ` : ''}
                                <li><hr class="dropdown-divider"></li>
                                <li><a class="dropdown-item" href="#" onclick="handleLogout(event)"><i class="bi bi-box-arrow-right me-2"></i>` + t('nav.logout') + `</a></li>
                            </ul>
                        </div>
                    ` : `
                        <a href="${loginHref}" class="btn btn-primary py-2 px-4"><i class="bi bi-person me-2"></i>` + t('nav.login') + `</a>
                    `}
                </div>
                <div class="d-lg-none px-4 pb-3 pt-2 border-top mt-2" id="authSectionMobile">
                    ${showLangSwitch ? '<div class="mb-2"><a href="#" class="lang-link small text-muted me-2" data-lang="zh-TW">' + t('nav.langZh') + '</a><a href="#" class="lang-link small text-muted" data-lang="en">' + t('nav.langEn') + '</a></div>' : ''}
                    ${user ? `
                        <div class="dropdown">
                            <a class="btn btn-primary p-0 d-flex align-items-center justify-content-center dropdown-toggle nav-avatar-toggle" href="#" role="button" data-bs-toggle="dropdown" id="userDropdownMobile" title="${_initDisplayName}">
                                <span class="nav-avatar-ring d-flex align-items-center justify-content-center" style="width:42px;height:42px;border-radius:50%;overflow:hidden;"><img id="userAvatarMobile" src="${_initAvatarUrl}" alt="" style="width:30px;height:30px;border-radius:50%;object-fit:cover;display:block;"></span>
                            </a>
                            <ul class="dropdown-menu dropdown-menu-end w-100">
                                <li class="dropdown-header text-muted small">` + t('nav.accountSettings') + `</li>
                                <li><a class="dropdown-item" href="/"><i class="bi bi-house me-2"></i>` + t('nav.home') + `</a></li>
                                <li><hr class="dropdown-divider"></li>
                                <li><a class="dropdown-item" href="/profile/account.html"><i class="bi bi-person-circle me-2"></i>` + (t('nav.accountInfo') || '帳號資訊') + `</a></li>
                                <li><a class="dropdown-item" href="/credits.html"><i class="bi bi-currency-exchange me-2"></i>` + (t('nav.myCredits') || '我的點數') + `</a></li>
                                <li><a class="dropdown-item" href="/profile/contact-info.html"><i class="bi bi-telephone me-2"></i>` + t('nav.contactSettings') + `</a></li>
                                ${isTesterOrAdmin ? '<li><a class="dropdown-item" href="/admin/playground.html"><i class="bi bi-brush me-2"></i>Playground</a></li><li><a class="dropdown-item" href="/admin/ai-tools.html"><i class="bi bi-magic me-2"></i>AI 工具</a></li>' + (isAdmin ? '<li><a class="dropdown-item" href="/admin/user-management.html"><i class="bi bi-people me-2"></i>' + t('nav.userManagement') + '</a></li><li><a class="dropdown-item" href="/admin/payment-settings.html"><i class="bi bi-currency-exchange me-2"></i>金流設定</a></li><li><a class="dropdown-item" href="/admin/categories.html"><i class="bi bi-tag me-2"></i>' + t('nav.categoryManagement') + '</a></li><li><a class="dropdown-item" href="/admin/category-images.html"><i class="bi bi-images me-2"></i>' + t('nav.categoryImages') + '</a></li>' : '') : ''}
                                <li><hr class="dropdown-divider"></li>
                                <li><a class="dropdown-item" href="#" onclick="handleLogout(event)"><i class="bi bi-box-arrow-right me-2"></i>` + t('nav.logout') + `</a></li>
                            </ul>
                        </div>
                    ` : `
                        <a href="${loginHref}" class="btn btn-primary w-100 py-2"><i class="bi bi-person me-2"></i>` + t('nav.login') + `</a>
                    `}
                </div>
            </div>
            ${user ? `<div class="nav-second-row-wrap d-none d-lg-flex align-items-center px-0 py-1" style="order:2;flex:0 0 100%;width:100%;"><div class="nav-second-row-left" style="flex:1;min-width:0;"></div><a href="${brandUrl}" class="navbar-brand d-flex align-items-center px-4" style="flex:0 0 auto;border:none !important;"><img src="/img/matchdo-logo.png" alt="MatchDO 合做" style="height:52px;width:auto;"></a><div class="nav-second-row-right d-flex align-items-center justify-content-end px-4" style="flex:1;min-width:0;"><a href="/credits.html" class="nav-points-desktop text-decoration-none small text-muted" title="${t('nav.myCredits') || '我的點數'}"><i class="bi bi-currency-exchange me-1"></i><span id="navPointsDesktopValue">—</span> 點</a></div></div>` : ''}
        </nav>
        <div id="nav-mobile-drawer" class="nav-mobile-drawer" aria-hidden="true">
            <div class="nav-mobile-drawer-backdrop"></div>
            <div class="nav-mobile-drawer-panel">
                <div class="nav-mobile-drawer-header">
                    <button type="button" class="nav-mobile-drawer-back" aria-label="返回">&#8592; 返回</button>
                    <span class="nav-mobile-drawer-title"></span>
                </div>
                <div class="nav-mobile-drawer-body"></div>
            </div>
        </div>
    `;
    
    headerContainer.innerHTML = navHTML;

    initMobileNavDrawer(headerContainer);

    if (user && typeof AuthService !== 'undefined' && AuthService.getSession) {
        loadRenewalReminderBanner(headerContainer);
        loadHeaderCredits(headerContainer);
        loadHeaderManufacturerNavLinks(headerContainer);
    }

    var langLinks = headerContainer.querySelectorAll('.lang-link');
    for (var i = 0; i < langLinks.length; i++) {
        langLinks[i].addEventListener('click', function (e) {
            e.preventDefault();
            var lang = this.getAttribute('data-lang');
            if (lang && window.i18n && window.i18n.setLang) window.i18n.setLang(lang);
        });
    }
    
    if (user && window.AuthService) {
        updateUserInfo(user);
    }
}

/** 已登入且有廠商資料時，顯示「我的廠商首頁（公開）」連結 */
function loadHeaderManufacturerNavLinks(headerContainer) {
    if (!headerContainer || typeof window.AuthService === 'undefined' || !window.AuthService.getSession) return;
    window.AuthService.getSession().then(function (session) {
        if (!session || !session.access_token) return;
        var link = headerContainer.querySelector('#nav-my-vendor-home');
        if (!link) return;
        fetch('/api/me/manufacturer', { headers: { Authorization: 'Bearer ' + session.access_token } })
            .then(function (r) {
                if (r.status === 404) return null;
                return r.ok ? r.json() : null;
            })
            .then(function (mfr) {
                if (!mfr || !mfr.id) return;
                link.href = '/vendor-profile.html?id=' + encodeURIComponent(mfr.id);
                link.classList.remove('d-none');
                link.setAttribute('target', '_blank');
                link.setAttribute('rel', 'noopener noreferrer');
            })
            .catch(function () {});
    }).catch(function () {});
}

/** 取得點數餘額並更新 header 內桌機／手機點數顯示（僅在已登入時呼叫） */
function loadHeaderCredits(headerContainer) {
    if (!headerContainer || typeof window.AuthService === 'undefined' || !window.AuthService.getSession) return;
    window.AuthService.getSession().then(function (session) {
        if (!session || !session.access_token) return;
        fetch('/api/me/credits', { headers: { 'Authorization': 'Bearer ' + session.access_token } })
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (data) {
                var balance = (data && typeof data.balance === 'number') ? String(data.balance) : '—';
                var desktopEl = headerContainer.querySelector('#navPointsDesktopValue');
                var mobileEl = headerContainer.querySelector('#navPointsMobileValue');
                if (desktopEl) desktopEl.textContent = balance;
                if (mobileEl) mobileEl.textContent = balance;
            })
            .catch(function () {
                var desktopEl = headerContainer.querySelector('#navPointsDesktopValue');
                var mobileEl = headerContainer.querySelector('#navPointsMobileValue');
                if (desktopEl) desktopEl.textContent = '—';
                if (mobileEl) mobileEl.textContent = '—';
            });
    }).catch(function () {});
}

function initMobileNavDrawer(headerContainer) {
    var drawer = document.getElementById('nav-mobile-drawer');
    if (!drawer) return;
    var panel = drawer.querySelector('.nav-mobile-drawer-panel');
    var body = drawer.querySelector('.nav-mobile-drawer-body');
    var titleEl = drawer.querySelector('.nav-mobile-drawer-title');
    var backBtn = drawer.querySelector('.nav-mobile-drawer-back');
    var backdrop = drawer.querySelector('.nav-mobile-drawer-backdrop');
    function closeDrawer() {
        drawer.classList.remove('is-open');
        drawer.setAttribute('aria-hidden', 'true');
    }
    function openDrawer(menuTitle, menuHtml) {
        titleEl.textContent = menuTitle;
        body.innerHTML = menuHtml;
        drawer.classList.add('is-open');
        drawer.setAttribute('aria-hidden', 'false');
    }
    if (backBtn) backBtn.addEventListener('click', closeDrawer);
    if (backdrop) backdrop.addEventListener('click', closeDrawer);
    var nav = headerContainer.querySelector('.navbar-collapse .navbar-nav');
    if (!nav) return;
    var triggerLinks = nav.querySelectorAll('.nav-item.dropdown > .nav-link, .nav-item.nav-has-hover > .nav-link');
    for (var i = 0; i < triggerLinks.length; i++) {
        (function (link) {
            link.addEventListener('click', function (e) {
                if (window.innerWidth > 991.98) return;
                var item = link.closest('.nav-item');
                var menu = item.querySelector('.dropdown-menu, .nav-hover-menu');
                if (!menu) return;
                e.preventDefault();
                e.stopPropagation();
                var title = link.textContent.replace(/\s*▾\s*$/, '').trim();
                var menuClone = menu.cloneNode(true);
                var links = menuClone.querySelectorAll('a');
                for (var j = 0; j < links.length; j++) {
                    links[j].addEventListener('click', function () { closeDrawer(); });
                }
                openDrawer(title, menuClone.innerHTML);
            });
        })(triggerLinks[i]);
    }
}

function loadRenewalReminderBanner(headerContainer) {
    var existing = document.getElementById('site-header-renewal-bar');
    if (existing) existing.remove();
    AuthService.getSession().then(function (session) {
        if (!session || !session.access_token) return;
        fetch('/api/me/subscription', { headers: { 'Authorization': 'Bearer ' + session.access_token } })
            .then(function (r) { return r.status === 200 ? r.json() : null; })
            .then(function (data) {
                if (!data || !data.renewal_reminder) return;
                var r = data.renewal_reminder;
                var endStr = r.end_date ? new Date(r.end_date).toLocaleDateString('zh-TW') : '';
                var msg = '您的「' + (r.plan_name || '年付方案') + '」將於 ' + endStr + ' 到期（約 ' + r.days_left + ' 天），請及早續訂。';
                var bar = document.createElement('div');
                bar.id = 'site-header-renewal-bar';
                bar.className = 'renewal-reminder-bar bg-warning bg-opacity-25 small py-2 px-3 text-center border-bottom';
                bar.innerHTML = '<i class="bi bi-calendar-event me-1"></i>' + msg + ' <a href="/subscription-plans.html" class="fw-bold text-dark">立即續訂</a>';
                headerContainer.insertBefore(bar, headerContainer.firstChild);
            })
            .catch(function () {});
    }).catch(function () {});
}

async function updateUserInfo(user) {
    let displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || '用戶';
    let avatarUrl = user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=667eea&color=fff`;
    // 讀目前畫面上的值，只有真的不同才更新 DOM（避免跳動）
    const desktopBtn = document.getElementById('userDropdownDesktop');
    const mobileBtn = document.getElementById('userDropdownMobile');
    const curName = (desktopBtn && desktopBtn.title) || '';
    const curAvatar = (document.getElementById('userAvatar') || {}).src || '';
    try {
        const profile = await AuthService.getUserProfile();
        if (profile?.full_name) displayName = profile.full_name;
        if (profile?.avatar_url) avatarUrl = profile.avatar_url;
    } catch (e) {}
    try { localStorage.setItem('nb_uinfo', JSON.stringify({ id: user.id, name: displayName, avatar: avatarUrl })); } catch(e) {}
    if (displayName !== curName) {
        if (desktopBtn) desktopBtn.title = displayName;
        if (mobileBtn) mobileBtn.title = displayName;
    }
    if (avatarUrl && !curAvatar.includes(encodeURIComponent(displayName.split('')[0])) && curAvatar !== avatarUrl) {
        var av = document.getElementById('userAvatar');
        var avM = document.getElementById('userAvatarMobile');
        if (av) av.src = avatarUrl;
        if (avM) avM.src = avatarUrl;
    }
}

async function handleLogout(event) {
    event.preventDefault();
    var msg = (window.i18n && window.i18n.t) ? window.i18n.t('auth.logoutConfirm') : '確定要登出嗎？';
    var failMsg = (window.i18n && window.i18n.t) ? window.i18n.t('auth.logoutFail') : '登出失敗，請稍後再試';
    if (confirm(msg)) {
        try {
            await AuthService.signOut();
        } catch (error) {
            console.error('登出失敗:', error);
            alert(failMsg);
        }
    }
}

// GA4 網站行為分析：若頁面尚未載入 ga4-loader，由導覽注入以覆蓋全站（後台「網站設定」可填衡量 ID）
(function () {
    if (document.querySelector('script[src*="ga4-loader"]')) return;
    var s = document.createElement('script');
    s.src = '/js/ga4-loader.js';
    s.async = true;
    document.head.appendChild(s);
})();

