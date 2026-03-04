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

document.addEventListener('DOMContentLoaded', function () {
    var headerContainer = document.getElementById('site-header');
    if (!headerContainer) return;
    var session = (window.getSessionFromStorage && window.getSessionFromStorage()) || null;
    var whenReady = (window.i18n && window.i18n.ready) ? window.i18n.ready : Promise.resolve();
    whenReady.then(function () {
        return loadSiteHeader(session);
    }).then(function () {
        if (window.AuthService && typeof AuthService.onAuthStateChange === 'function') {
            AuthService.onAuthStateChange(function (event, newSession) {
                // INITIAL_SESSION 只是初始確認，不是狀態變更，不重畫
                if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
                    loadSiteHeader(newSession);
                }
            });
        }
    }).catch(function () {
        loadSiteHeader(null);
    });
});

var _lastRenderedUserId = undefined;
var _navFullyRendered = false;
function loadSiteHeader(sessionFromEvent) {
    var headerContainer = document.getElementById('site-header');
    if (!headerContainer) return Promise.resolve();
    return (async function () {
        var user = sessionFromEvent && sessionFromEvent.user ? sessionFromEvent.user : null;
        if (!user && window.AuthService) {
            try {
                var session = await AuthService.getSession();
                user = session && session.user ? session.user : null;
            } catch (e) {}
        }
        var uid = user ? (user.id || user.email || 'user') : null;
        // 已完整渲染且同一 user → 跳過，防止重複觸發
        if (_navFullyRendered && uid === _lastRenderedUserId) return;
        _lastRenderedUserId = uid;
        _navFullyRendered = true;
        var config = await getPublicConfig();
        await renderHeader(headerContainer, user, config);
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
async function renderHeader(headerContainer, user, config) {
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
    if (user && window.AuthService) {
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
    const brandUrl = '/index.html';
    const path = (typeof window !== 'undefined' && window.location && window.location.pathname) ? window.location.pathname : '';
    const isHomePage = path === '/' || path === '/index.html' || path === '';
    const homeActive = isHomePage ? ' active' : '';
    const customActive = isCustom ? ' active' : '';
    const remakeActive = isRemake ? ' active' : '';
    const customUrl = '/custom/';
    const remakeUrl = '/remake/';
    const loginHref = (typeof AuthService !== 'undefined' && AuthService.getLoginUrl) ? AuthService.getLoginUrl(path) : ('/login.html?returnUrl=' + encodeURIComponent(path || '/index.html'));
    if ((isCustom || isRemake) && typeof document !== 'undefined' && document.documentElement) {
        document.documentElement.setAttribute('data-theme', isRemake ? 'remake' : 'custom');
        if (!document.querySelector('link[href*="theme-custom.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = '/css/theme-custom.css';
            document.head.appendChild(link);
        }
    }
    // 登入即顯示「我的功能」。一律只顯示訂製品（訂製者+製作方），每頁選單相同。
    const showMyFeaturesDropdown = !!user;
    var rawT = (window.i18n && window.i18n.t) ? window.i18n.t : function (k) { return k; };
    var navFallbackZh = { 'nav.brand': 'MatchDO 合做', 'nav.home': '首頁', 'nav.serviceMatching': '服務媒合', 'nav.customProduct': '客製產品', 'nav.remake': '再製方案', 'nav.remakeDesign': '再製設計', 'nav.subscriptionPlans': '方案與定價', 'nav.login': '登入', 'nav.myFeatures': '我的功能', 'nav.myFeaturesTitle': '工作入口', 'nav.dropdownCustom': '訂製品（客戶／供應商兼用）', 'nav.dropdownCustomClient': '訂製品客戶', 'nav.customHome': '客製產品首頁', 'nav.createProduct': '建立新產品', 'nav.myCustomProducts': '我的數位資產', 'nav.galleryFindVendor': '圖庫找廠商', 'nav.dropdownVendor': '訂製品供應商', 'nav.vendorDashboard': '廠商控制台', 'nav.vendorPortfolio': '我的廠商作品', 'nav.vendorInquiries': '訂製詢價列表', 'nav.findMakers': '找製作方', 'nav.myMessages': '我的對話', 'nav.makerSection': '製作方', 'nav.demands': '訂製需求', 'nav.dropdownWork': '工作入口', 'nav.expertSection': '專家功能', 'nav.expertDashboard': '專家控制台', 'nav.myListings': '我的報價', 'nav.matchedProjects': '我已媒合的專案', 'nav.browseProjects': '可媒合專案', 'nav.myPortfolio': '我的作品', 'nav.clientSection': '發案功能', 'nav.clientDashboard': '發案控制台', 'nav.myProjects': '我的專案', 'nav.accountSettings': '帳號與設定', 'nav.loading': '載入中...', 'nav.settings': '設定', 'nav.contactSettings': '聯絡資訊設定', 'nav.adminSection': '管理功能', 'nav.userManagement': '用戶管理', 'nav.categoryManagement': '分類管理', 'nav.categoryImages': '分類圖片管理', 'nav.logout': '登出', 'nav.langZh': '中文', 'nav.langEn': 'EN', 'nav.aiUpscale': 'AI 圖片放大', 'nav.aiEditArea': '我的 AI 編輯區' };
    var t = function (k) { var v = rawT(k); return (v && v !== k) ? v : (navFallbackZh[k] || k); };
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
                        <a href="${remakeUrl}" class="nav-link${remakeActive}" style="display:inline-flex;align-items:center;">` + (t('nav.remake') || '再製方案') + `<span class="badge bg-warning text-dark ms-1" style="font-size:0.65rem;font-weight:500;" title="` + (t('remake.badgeTesting') || '測試中') + `">` + (t('remake.badgeTesting') || '測試中') + `</span><span class="nav-hover-caret">▾</span></a>
                        <div class="dropdown-menu nav-hover-menu">
                            <a href="/remake-product.html" class="dropdown-item"><i class="bi bi-tools"></i>建立再製設計</a>
                            <a href="/client/find-makers.html" class="dropdown-item"><i class="bi bi-shop"></i>找製作方</a>
                            <a href="/custom/gallery.html" class="dropdown-item"><i class="bi bi-images"></i>圖庫找廠商</a>
                            <a href="/client/my-custom-products.html" class="dropdown-item"><i class="bi bi-box-seam"></i>我的產品</a>
                        </div>
                    </div>
                    <a href="/subscription-plans.html" class="nav-item nav-link nav-link-subscription">` + (t('nav.subscriptionPlans') || '方案與定價') + `</a>
                    
                    ${showMyFeaturesDropdown ? `
                        <div class="nav-item dropdown">
                            <a href="#" class="nav-link dropdown-toggle" data-bs-toggle="dropdown" title="` + t('nav.myFeaturesTitle') + `" style="display:inline-flex;align-items:center;">` + t('nav.myFeatures') + `<span class="nav-hover-caret">▾</span></a>
                            <div class="dropdown-menu bg-light m-0">
                                <h6 class="dropdown-header text-muted small">` + t('nav.dropdownCustom') + `</h6>
                                <h6 class="dropdown-header"><i class="bi bi-person me-2"></i>` + t('nav.dropdownCustomClient') + `</h6>
                                <a href="/client/dashboard.html" class="dropdown-item"><i class="bi bi-speedometer2 me-2"></i>` + (t('nav.clientDashboard') || '設計者控制台') + `</a>
                                <a href="/custom/" class="dropdown-item"><i class="bi bi-house me-2"></i>` + t('nav.customHome') + `</a>
                                <a href="/custom-product.html" class="dropdown-item"><i class="bi bi-plus-circle me-2"></i>` + t('nav.createProduct') + `</a>
                                <a href="/remake-product.html" class="dropdown-item"><i class="bi bi-tools me-2"></i>` + (t('nav.remakeDesign') || '再製設計') + `</a>
                                <a href="/client/my-custom-products.html" class="dropdown-item"><i class="bi bi-images me-2"></i>` + t('nav.myCustomProducts') + `</a>
                                <a href="/custom/gallery.html" class="dropdown-item"><i class="bi bi-images me-2"></i>` + t('nav.galleryFindVendor') + `</a>
                                <a href="/client/messages.html" class="dropdown-item"><i class="bi bi-chat-dots me-2"></i>` + t('nav.myMessages') + `</a>
                                <a href="/credits.html" class="dropdown-item"><i class="bi bi-currency-exchange me-2"></i>` + (t('nav.myCredits') || '我的點數') + `</a>
                                <a href="/client/ai-edit.html" class="dropdown-item"><i class="bi bi-palette me-2"></i>` + (t('nav.aiEditArea') || '我的 AI 編輯區') + `</a>
                                <div class="dropdown-divider"></div>
                                <h6 class="dropdown-header"><i class="bi bi-shop me-2"></i>` + t('nav.makerSection') + `</h6>
                                <a href="/client/demands.html" class="dropdown-item"><i class="bi bi-list-ul me-2"></i>` + t('nav.demands') + `</a>
                                <a href="/client/manufacturer-dashboard.html" class="dropdown-item"><i class="bi bi-speedometer2 me-2"></i>` + t('nav.vendorDashboard') + `</a>
                                <a href="/client/manufacturer-portfolio.html" class="dropdown-item"><i class="bi bi-images me-2"></i>` + t('nav.vendorPortfolio') + `</a>
                                <a href="/client/manufacturer-inquiries.html" class="dropdown-item"><i class="bi bi-chat-quote me-2"></i>` + t('nav.vendorInquiries') + `</a>
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
                                <li><a class="dropdown-item" href="/index.html"><i class="bi bi-house me-2"></i>` + t('nav.home') + `</a></li>
                                <li><hr class="dropdown-divider"></li>
                                <li class="dropdown-header"><i class="bi bi-gear me-2"></i>` + t('nav.settings') + `</li>
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
                                <li><a class="dropdown-item" href="/index.html"><i class="bi bi-house me-2"></i>` + t('nav.home') + `</a></li>
                                <li><hr class="dropdown-divider"></li>
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

