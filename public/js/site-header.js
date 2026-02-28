/**
 * 網站共用導航系統
 * 載入當下就先畫出導覽+登入按鈕，不等 DOMContentLoaded
 * 修改時注意：勿在同一 function 重複宣告變數；登入連結須帶 returnUrl。詳見 .cursor/rules/site-header-and-auth.mdc
 */
(function () {
    if (!document.getElementById('nb-css')) {
        var _c = document.createElement('style');
        _c.id = 'nb-css';
        _c.textContent = '@media(min-width:992px){#site-header .navbar{position:relative;}#site-header .navbar-brand{position:absolute;left:50%;top:0;bottom:0;transform:translateX(-50%);display:flex!important;align-items:center;border-right:none!important;padding:0!important;margin:0;z-index:5;}#site-header .navbar-brand img{height:78px!important;background:#fff;padding:4px 12px;border-radius:4px;}#site-header #authSection{width:160px;min-width:160px;max-width:160px;justify-content:flex-end;}}';
        document.head.appendChild(_c);
    }
    var el = document.getElementById('site-header');
    if (el && !el.innerHTML) {
        var t = (window.i18n && window.i18n.t) ? window.i18n.t : function (k) { return k; };
        var path = (typeof window !== 'undefined' && window.location && window.location.pathname) ? window.location.pathname : '';
        if (!path || path === '/login.html') path = '/index.html';
        var loginHref = '/login.html?returnUrl=' + encodeURIComponent(path);
        var brandUrl = '/index.html';
        el.innerHTML = '<nav class="navbar navbar-expand-lg bg-white navbar-light sticky-top p-0">' +
            '<a href="' + brandUrl + '" class="navbar-brand d-flex align-items-center border-end px-4 px-lg-5"><img src="/img/matchdo-logo.png" alt="MatchDO 合做" style="height:52px;width:auto;"></a>' +
            '<button type="button" class="navbar-toggler me-4" data-bs-toggle="collapse" data-bs-target="#navbarCollapse"><span class="navbar-toggler-icon"></span></button>' +
            '<div class="collapse navbar-collapse" id="navbarCollapse">' +
            '<div class="navbar-nav ms-auto p-4 p-lg-0">' +
            '<a href="/index.html#ai-estimate" class="nav-item nav-link">' + t('nav.serviceMatching') + '</a>' +
            '<a href="/custom/" class="nav-item nav-link">' + t('nav.customProduct') + '</a>' +
            '<a href="/remake/" class="nav-item nav-link">' + (t('nav.remake') || '再製方案') + '</a>' +
            '<a href="/subscription-plans.html" class="nav-item nav-link">' + (t('nav.subscriptionPlans') || '方案與定價') + '</a>' +
            '</div>' +
            '<div class="d-none d-lg-flex align-items-center px-4" id="authSection">' + (window.getSessionFromStorage && window.getSessionFromStorage() ? '<span class="btn btn-primary py-2 px-4 disabled" style="opacity:.7;pointer-events:none;"><i class="bi bi-person me-2"></i>...</span>' : '<a href="' + loginHref + '" class="btn btn-primary py-2 px-4"><i class="bi bi-person me-2"></i>' + t('nav.login') + '</a>') + '</div>' +
            '<div class="d-lg-none px-4 pb-3 pt-2 border-top mt-2" id="authSectionMobile"><a href="' + loginHref + '" class="btn btn-primary w-100 py-2"><i class="bi bi-person me-2"></i>' + t('nav.login') + '</a></div>' +
            '</div></nav>';
    }
})();

function getPublicConfig() {
    if (window.__PUBLIC_CONFIG__) return Promise.resolve(window.__PUBLIC_CONFIG__);
    return fetch('/api/public-config').then(function (r) { return r.json(); }).then(function (j) {
        window.__PUBLIC_CONFIG__ = j;
        return j;
    }).catch(function () {
        window.__PUBLIC_CONFIG__ = { enableServiceMatching: true };
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
                if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
                    loadSiteHeader(newSession);
                }
            });
        }
    }).catch(function () {
        loadSiteHeader(null);
    });
});

var _lastRenderedUserId = (function () {
    var s = window.getSessionFromStorage && window.getSessionFromStorage();
    var u = s && s.user ? s.user : null;
    return u ? (u.id || u.email || 'user') : null;
})();
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
        if (_navFullyRendered && uid === _lastRenderedUserId) return; // 已完整渲染且 user 相同，跳過
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
    if (!config) config = { enableServiceMatching: true };
    const enableServiceMatching = config.enableServiceMatching !== false;
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
    const showServiceMatchingNav = enableServiceMatching;
    // 登入即顯示「我的功能」。一律只顯示訂製品（訂製者+製作方），每頁選單相同。
    const showMyFeaturesDropdown = !!user;
    var rawT = (window.i18n && window.i18n.t) ? window.i18n.t : function (k) { return k; };
    var navFallbackZh = { 'nav.brand': 'MatchDO 合做', 'nav.home': '首頁', 'nav.serviceMatching': '服務媒合', 'nav.customProduct': '客製產品', 'nav.remake': '再製方案', 'nav.remakeDesign': '再製設計', 'nav.subscriptionPlans': '方案與定價', 'nav.login': '登入', 'nav.myFeatures': '我的功能', 'nav.myFeaturesTitle': '工作入口', 'nav.dropdownCustom': '訂製品（客戶／供應商兼用）', 'nav.dropdownCustomClient': '訂製品客戶', 'nav.customHome': '客製產品首頁', 'nav.createProduct': '建立新產品', 'nav.myCustomProducts': '我的數位資產', 'nav.galleryFindVendor': '圖庫找廠商', 'nav.dropdownVendor': '訂製品供應商', 'nav.vendorDashboard': '廠商控制台', 'nav.vendorPortfolio': '我的廠商作品', 'nav.vendorInquiries': '訂製詢價列表', 'nav.findMakers': '找製作方', 'nav.myMessages': '我的對話', 'nav.makerSection': '製作方', 'nav.demands': '訂製需求', 'nav.dropdownWork': '工作入口', 'nav.expertSection': '專家功能', 'nav.expertDashboard': '專家控制台', 'nav.myListings': '我的報價', 'nav.matchedProjects': '我已媒合的專案', 'nav.browseProjects': '可媒合專案', 'nav.myPortfolio': '我的作品', 'nav.clientSection': '發案功能', 'nav.clientDashboard': '發案控制台', 'nav.myProjects': '我的專案', 'nav.accountSettings': '帳號與設定', 'nav.loading': '載入中...', 'nav.settings': '設定', 'nav.contactSettings': '聯絡資訊設定', 'nav.adminSection': '管理功能', 'nav.userManagement': '用戶管理', 'nav.categoryManagement': '分類管理', 'nav.categoryImages': '分類圖片管理', 'nav.logout': '登出', 'nav.langZh': '中文', 'nav.langEn': 'EN', 'nav.aiUpscale': 'AI 圖片放大', 'nav.aiEditArea': '我的 AI 編輯區' };
    var t = function (k) { var v = rawT(k); return (v && v !== k) ? v : (navFallbackZh[k] || k); };
    var showLangSwitch = path.indexOf('/admin/') === -1;
    const navHTML = `
        <!-- Navbar Start -->
        <nav class="navbar navbar-expand-lg bg-white navbar-light sticky-top p-0">
            <a href="${brandUrl}" class="navbar-brand d-flex align-items-center border-end px-4 px-lg-5">
                <img src="/img/matchdo-logo.png" alt="MatchDO 合做" style="height:52px;width:auto;">
            </a>
            <button type="button" class="navbar-toggler me-4" data-bs-toggle="collapse" data-bs-target="#navbarCollapse">
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="navbarCollapse">
                <div class="navbar-nav ms-auto p-4 p-lg-0">
                    ${showServiceMatchingNav ? '<a href="/index.html#ai-estimate" class="nav-item nav-link">' + t('nav.serviceMatching') + '</a>' : ''}
                    <a href="${customUrl}" class="nav-item nav-link${customActive}">` + t('nav.customProduct') + `</a>
                    <a href="${remakeUrl}" class="nav-item nav-link${remakeActive}">` + (t('nav.remake') || '再製方案') + `</a>
                    <a href="/subscription-plans.html" class="nav-item nav-link">` + (t('nav.subscriptionPlans') || '方案與定價') + `</a>
                    
                    ${showMyFeaturesDropdown ? `
                        <div class="nav-item dropdown">
                            <a href="#" class="nav-link dropdown-toggle" data-bs-toggle="dropdown" title="` + t('nav.myFeaturesTitle') + `">` + t('nav.myFeatures') + `</a>
                            <div class="dropdown-menu bg-light m-0">
                                <h6 class="dropdown-header text-muted small">` + t('nav.dropdownCustom') + `</h6>
                                <h6 class="dropdown-header"><i class="bi bi-person me-2"></i>` + t('nav.dropdownCustomClient') + `</h6>
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
                            <a class="btn btn-primary py-2 px-4 d-flex align-items-center dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown" id="userDropdownDesktop" title="` + t('nav.accountSettings') + `">
                                <img id="userAvatar" src="" alt="Avatar" style="width: 30px; height: 30px; border-radius: 50%; margin-right: 10px;">
                                <span id="userName">` + t('nav.loading') + `</span>
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
                            <a class="btn btn-primary w-100 py-2 d-flex align-items-center justify-content-center dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown" id="userDropdownMobile">
                                <img id="userAvatarMobile" src="" alt="" style="width: 28px; height: 28px; border-radius: 50%; margin-right: 8px;">
                                <span id="userNameMobile">` + t('nav.loading') + `</span>
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
        </nav>
    `;
    
    headerContainer.innerHTML = navHTML;

    if (user && typeof AuthService !== 'undefined' && AuthService.getSession) {
        loadRenewalReminderBanner(headerContainer);
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
    try {
        const profile = await AuthService.getUserProfile();
        if (profile?.full_name) displayName = profile.full_name;
        if (profile?.avatar_url) avatarUrl = profile.avatar_url;
    } catch (e) {}
    const set = (id, val, isSrc) => {
        const el = document.getElementById(id);
        if (el) el[isSrc ? 'src' : 'textContent'] = val;
    };
    set('userName', displayName, false);
    set('userAvatar', avatarUrl, true);
    set('userNameMobile', displayName, false);
    set('userAvatarMobile', avatarUrl, true);
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

