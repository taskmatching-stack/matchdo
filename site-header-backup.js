/**
 * 蝬脩??梁撠蝟餌絞
 * 頛?嗡?撠勗??怠撠汗+?餃??嚗?蝑?DOMContentLoaded
 * 靽格?釣???踹?? function ??摰??霈嚗?仿???葆 returnUrl?底閬?.cursor/rules/site-header-and-auth.mdc
 */
(function () {
    var el = document.getElementById('site-header');
    if (el && !el.innerHTML) {
        var path = (typeof window !== 'undefined' && window.location && window.location.pathname) ? window.location.pathname : '';
        if (!path || path === '/login.html') path = '/index.html';
        var loginHref = '/login.html?returnUrl=' + encodeURIComponent(path);
        var isAdmin = path.indexOf('/admin/') !== -1;
        el.innerHTML = '<nav class="navbar navbar-expand-lg bg-white navbar-light sticky-top p-0">' +
            '<a href="/index.html" class="navbar-brand d-flex align-items-center border-end px-4 px-lg-5"><img src="/img/matchdo-logo.png" alt="MatchDO ??" style="height:52px;width:auto;"></a>' +
            '<button type="button" class="navbar-toggler me-4" data-bs-toggle="collapse" data-bs-target="#navbarCollapse"><span class="navbar-toggler-icon"></span></button>' +
            '<div class="collapse navbar-collapse" id="navbarCollapse">' +
            '<div class="navbar-nav ms-auto p-4 p-lg-0">' +
            '<a href="/index.html" class="nav-item nav-link">擐?</a>' +
            '<a href="/index.html#ai-estimate" class="nav-item nav-link">??慦?</a>' +
            '<a href="/custom/" class="nav-item nav-link">摰Ｚˊ?Ｗ?</a>' +
            '<a href="/remake/" class="nav-item nav-link">?ˊ?寞?</a>' +
            '<a href="/subscription-plans.html" class="nav-item nav-link">?寞?????/a>' +
            '<span id="myFeaturesNav"></span>' +
            '</div>' +
            (!isAdmin ? '<div class="d-none d-lg-flex align-items-center px-2 border-end"><a href="#" class="lang-link small text-muted text-decoration-none me-1" data-lang="zh-TW">銝剜?</a><span class="text-muted">|</span><a href="#" class="lang-link small text-muted text-decoration-none ms-1" data-lang="en">EN</a></div>' : '') +
            '<div class="d-none d-lg-flex align-items-center px-4" id="authSection"><a href="' + loginHref + '" class="btn btn-primary py-2 px-4"><i class="bi bi-person me-2"></i>?餃</a></div>' +
            '<div class="d-lg-none px-4 pb-3 pt-2 border-top mt-2" id="authSectionMobile"><a href="' + loginHref + '" class="btn btn-primary w-100 py-2"><i class="bi bi-person me-2"></i>?餃</a></div>' +
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
    var user = session && session.user ? session.user : null;
    var whenReady = (window.i18n && window.i18n.ready) ? window.i18n.ready : Promise.resolve();
    whenReady.then(function () {
        return getPublicConfig();
    }).then(function (config) {
        return renderHeader(headerContainer, user, config);
    }).then(function () {
        if (window.AuthService && typeof AuthService.onAuthStateChange === 'function') {
            AuthService.onAuthStateChange(function (event, session) {
                if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
                    loadSiteHeader(session);
                }
            });
        }
        if (!user) loadSiteHeader(null);
    }).catch(function () {
        getPublicConfig().then(function (config) {
            renderHeader(headerContainer, user, config);
        });
    });
});

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
 * ?函??詨嚗?亙??耨?寞?敹?嚗? * - ??function ?批??摰????霈嚗?憒歇??const path 撠曹?閬? var path嚗??血??湔?單?梢??株??餃???? * - loginHref 敹?撣?returnUrl ?蝙??AuthService.getLoginUrl(path)嚗??臬撖?'/login.html'?? */
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
            console.error('?⊥????冽閫:', error);
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
    // ?餃?喲＊蝷箝????賬?敺憿舐內閮ˊ??閮ˊ??鋆賭??對?嚗???桃??    const showMyFeaturesDropdown = !!user;
    var rawT = (window.i18n && window.i18n.t) ? window.i18n.t : function (k) { return k; };
    var navFallbackZh = { 'nav.brand': 'MatchDO ??', 'nav.home': '擐?', 'nav.serviceMatching': '??慦?', 'nav.customProduct': '摰Ｚˊ?Ｗ?', 'nav.remake': '?ˊ?寞?', 'nav.remakeDesign': '?ˊ閮剛?', 'nav.subscriptionPlans': '?寞?????, 'nav.login': '?餃', 'nav.myFeatures': '???', 'nav.myFeaturesTitle': '撌乩??亙', 'nav.dropdownCustom': '閮ˊ??摰Ｘ嚗????潛嚗?, 'nav.dropdownCustomClient': '閮ˊ?恥??, 'nav.customHome': '摰Ｚˊ?Ｗ?擐?', 'nav.createProduct': '撱箇??啁??, 'nav.myCustomProducts': '???訾?鞈', 'nav.galleryFindVendor': '?澈?曉???, 'nav.dropdownVendor': '閮ˊ????', 'nav.vendorDashboard': '撱??批??, 'nav.vendorPortfolio': '??撱?雿?', 'nav.vendorInquiries': '閮ˊ閰Ｗ?”', 'nav.findMakers': '?曇ˊ雿', 'nav.myMessages': '??撠店', 'nav.makerSection': '鋆賭???, 'nav.demands': '閮ˊ?瘙?, 'nav.dropdownWork': '撌乩??亙', 'nav.expertSection': '撠振?', 'nav.expertDashboard': '撠振?批??, 'nav.myListings': '???勗', 'nav.matchedProjects': '?歇慦???獢?, 'nav.browseProjects': '?臬???獢?, 'nav.myPortfolio': '??雿?', 'nav.clientSection': '?潭??', 'nav.clientDashboard': '?潭??批??, 'nav.myProjects': '??撠?', 'nav.accountSettings': '撣唾??身摰?, 'nav.loading': '頛銝?..', 'nav.settings': '閮剖?', 'nav.contactSettings': '?舐窗鞈?閮剖?', 'nav.adminSection': '蝞∠??', 'nav.userManagement': '?冽蝞∠?', 'nav.categoryManagement': '??蝞∠?', 'nav.categoryImages': '????蝞∠?', 'nav.logout': '?餃', 'nav.langZh': '銝剜?', 'nav.langEn': 'EN', 'nav.aiUpscale': 'AI ???曉之', 'nav.aiEditArea': '?? AI 蝺刻摩?' };
    var t = function (k) { var v = rawT(k); return (v && v !== k) ? v : (navFallbackZh[k] || k); };
    var showLangSwitch = path.indexOf('/admin/') === -1;

    // ?? 蝯 auth / myFeatures HTML嚗?摰皜脫??翰??啣?剁???
    const desktopAuthHTML = user ? `
        <div class="dropdown">
            <a class="btn btn-primary py-2 px-4 d-flex align-items-center dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown" id="userDropdownDesktop" title="${t('nav.accountSettings')}">
                <img id="userAvatar" src="" alt="Avatar" style="width:30px;height:30px;border-radius:50%;margin-right:10px;">
                <span id="userName">${t('nav.loading')}</span>
            </a>
            <ul class="dropdown-menu dropdown-menu-end" aria-labelledby="userDropdownDesktop">
                <li class="dropdown-header text-muted small">${t('nav.accountSettings')}</li>
                <li><a class="dropdown-item" href="/index.html"><i class="bi bi-house me-2"></i>${t('nav.home')}</a></li>
                <li><hr class="dropdown-divider"></li>
                <li class="dropdown-header"><i class="bi bi-gear me-2"></i>${t('nav.settings')}</li>
                <li><a class="dropdown-item" href="/credits.html"><i class="bi bi-currency-exchange me-2"></i>${t('nav.myCredits') || '??暺'}</a></li>
                <li><a class="dropdown-item" href="/profile/contact-info.html"><i class="bi bi-telephone me-2"></i>${t('nav.contactSettings')}</a></li>
                ${isTesterOrAdmin ? `
                <li><hr class="dropdown-divider"></li>
                <li class="dropdown-header"><i class="bi bi-shield-lock me-2"></i>${isAdmin ? t('nav.adminSection') : '皜祈岫?∪???}</li>
                <li><a class="dropdown-item" href="/admin/playground.html"><i class="bi bi-brush me-2"></i>Playground</a></li>
                <li><a class="dropdown-item" href="/admin/ai-tools.html"><i class="bi bi-magic me-2"></i>AI 撌亙</a></li>
                ${isAdmin ? `
                <li><a class="dropdown-item" href="/admin/user-management.html"><i class="bi bi-people me-2"></i>${t('nav.userManagement')}</a></li>
                <li><a class="dropdown-item" href="/admin/payment-settings.html"><i class="bi bi-currency-exchange me-2"></i>??閮剖?</a></li>
                <li><a class="dropdown-item" href="/admin/categories.html"><i class="bi bi-tag me-2"></i>${t('nav.categoryManagement')}</a></li>
                <li><a class="dropdown-item" href="/admin/category-images.html"><i class="bi bi-images me-2"></i>${t('nav.categoryImages')}</a></li>
                ` : ''}
                ` : ''}
                <li><hr class="dropdown-divider"></li>
                <li><a class="dropdown-item" href="#" onclick="handleLogout(event)"><i class="bi bi-box-arrow-right me-2"></i>${t('nav.logout')}</a></li>
            </ul>
        </div>` : `<a href="${loginHref}" class="btn btn-primary py-2 px-4"><i class="bi bi-person me-2"></i>${t('nav.login')}</a>`;

    const mobileAuthHTML = user ? `
        <div class="dropdown">
            <a class="btn btn-primary w-100 py-2 d-flex align-items-center justify-content-center dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown" id="userDropdownMobile">
                <img id="userAvatarMobile" src="" alt="" style="width:28px;height:28px;border-radius:50%;margin-right:8px;">
                <span id="userNameMobile">${t('nav.loading')}</span>
            </a>
            <ul class="dropdown-menu dropdown-menu-end w-100">
                <li class="dropdown-header text-muted small">${t('nav.accountSettings')}</li>
                <li><a class="dropdown-item" href="/index.html"><i class="bi bi-house me-2"></i>${t('nav.home')}</a></li>
                <li><hr class="dropdown-divider"></li>
                <li><a class="dropdown-item" href="/credits.html"><i class="bi bi-currency-exchange me-2"></i>${t('nav.myCredits') || '??暺'}</a></li>
                <li><a class="dropdown-item" href="/profile/contact-info.html"><i class="bi bi-telephone me-2"></i>${t('nav.contactSettings')}</a></li>
                ${isTesterOrAdmin ? '<li><a class="dropdown-item" href="/admin/playground.html"><i class="bi bi-brush me-2"></i>Playground</a></li><li><a class="dropdown-item" href="/admin/ai-tools.html"><i class="bi bi-magic me-2"></i>AI 撌亙</a></li>' + (isAdmin ? '<li><a class="dropdown-item" href="/admin/user-management.html"><i class="bi bi-people me-2"></i>' + t('nav.userManagement') + '</a></li><li><a class="dropdown-item" href="/admin/payment-settings.html"><i class="bi bi-currency-exchange me-2"></i>??閮剖?</a></li><li><a class="dropdown-item" href="/admin/categories.html"><i class="bi bi-tag me-2"></i>' + t('nav.categoryManagement') + '</a></li><li><a class="dropdown-item" href="/admin/category-images.html"><i class="bi bi-images me-2"></i>' + t('nav.categoryImages') + '</a></li>' : '') : ''}
                <li><hr class="dropdown-divider"></li>
                <li><a class="dropdown-item" href="#" onclick="handleLogout(event)"><i class="bi bi-box-arrow-right me-2"></i>${t('nav.logout')}</a></li>
            </ul>
        </div>` : `<a href="${loginHref}" class="btn btn-primary w-100 py-2"><i class="bi bi-person me-2"></i>${t('nav.login')}</a>`;

    const myFeaturesHTML = showMyFeaturesDropdown ? `
        <div class="nav-item dropdown">
            <a href="#" class="nav-link dropdown-toggle" data-bs-toggle="dropdown" title="${t('nav.myFeaturesTitle')}">${t('nav.myFeatures')}</a>
            <div class="dropdown-menu bg-light m-0">
                <h6 class="dropdown-header text-muted small">${t('nav.dropdownCustom')}</h6>
                <h6 class="dropdown-header"><i class="bi bi-person me-2"></i>${t('nav.dropdownCustomClient')}</h6>
                <a href="/custom/" class="dropdown-item"><i class="bi bi-house me-2"></i>${t('nav.customHome')}</a>
                <a href="/custom-product.html" class="dropdown-item"><i class="bi bi-plus-circle me-2"></i>${t('nav.createProduct')}</a>
                <a href="/remake-product.html" class="dropdown-item"><i class="bi bi-tools me-2"></i>${t('nav.remakeDesign') || '?ˊ閮剛?'}</a>
                <a href="/client/my-custom-products.html" class="dropdown-item"><i class="bi bi-images me-2"></i>${t('nav.myCustomProducts')}</a>
                <a href="/custom/gallery.html" class="dropdown-item"><i class="bi bi-images me-2"></i>${t('nav.galleryFindVendor')}</a>
                <a href="/client/messages.html" class="dropdown-item"><i class="bi bi-chat-dots me-2"></i>${t('nav.myMessages')}</a>
                <a href="/credits.html" class="dropdown-item"><i class="bi bi-currency-exchange me-2"></i>${t('nav.myCredits') || '??暺'}</a>
                <a href="/client/ai-edit.html" class="dropdown-item"><i class="bi bi-palette me-2"></i>${t('nav.aiEditArea') || '?? AI 蝺刻摩?'}</a>
                <div class="dropdown-divider"></div>
                <h6 class="dropdown-header"><i class="bi bi-shop me-2"></i>${t('nav.makerSection')}</h6>
                <a href="/client/demands.html" class="dropdown-item"><i class="bi bi-list-ul me-2"></i>${t('nav.demands')}</a>
                <a href="/client/manufacturer-dashboard.html" class="dropdown-item"><i class="bi bi-speedometer2 me-2"></i>${t('nav.vendorDashboard')}</a>
                <a href="/client/manufacturer-portfolio.html" class="dropdown-item"><i class="bi bi-images me-2"></i>${t('nav.vendorPortfolio')}</a>
                <a href="/client/manufacturer-inquiries.html" class="dropdown-item"><i class="bi bi-chat-quote me-2"></i>${t('nav.vendorInquiries')}</a>
            </div>
        </div>` : '';

    // ?? navbar 撌脣??冽?嚗?湔 auth / myFeatures嚗??遣?游?navbar嚗??日?????
    if (headerContainer.querySelector('#navbarCollapse')) {
        const authSec = headerContainer.querySelector('#authSection');
        const authSecMobile = headerContainer.querySelector('#authSectionMobile');
        const myFeatNav = headerContainer.querySelector('#myFeaturesNav');
        if (authSec) authSec.innerHTML = desktopAuthHTML;
        if (authSecMobile) {
            authSecMobile.innerHTML = (showLangSwitch ? '<div class="mb-2"><a href="#" class="lang-link small text-muted me-2" data-lang="zh-TW">銝剜?</a><a href="#" class="lang-link small text-muted" data-lang="en">EN</a></div>' : '') + mobileAuthHTML;
        }
        if (myFeatNav) myFeatNav.innerHTML = myFeaturesHTML;
        var ll = headerContainer.querySelectorAll('.lang-link');
        for (var i = 0; i < ll.length; i++) {
            ll[i].addEventListener('click', function (e) { e.preventDefault(); var lang = this.getAttribute('data-lang'); if (lang && window.i18n && window.i18n.setLang) window.i18n.setLang(lang); });
        }
        if (user && typeof AuthService !== 'undefined' && AuthService.getSession) loadRenewalReminderBanner(headerContainer);
        if (user && window.AuthService) updateUserInfo(user);
        return;
    }

    const navHTML = `
        <!-- Navbar Start -->
        <nav class="navbar navbar-expand-lg bg-white navbar-light sticky-top p-0">
            <a href="${brandUrl}" class="navbar-brand d-flex align-items-center border-end px-4 px-lg-5">
                <img src="/img/matchdo-logo.png" alt="MatchDO ??" style="height:52px;width:auto;">
            </a>
            <button type="button" class="navbar-toggler me-4" data-bs-toggle="collapse" data-bs-target="#navbarCollapse">
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="navbarCollapse">
                <div class="navbar-nav ms-auto p-4 p-lg-0">
                    <a href="/index.html" class="nav-item nav-link${homeActive}">` + t('nav.home') + `</a>
                    ${showServiceMatchingNav ? '<a href="/index.html#ai-estimate" class="nav-item nav-link">' + t('nav.serviceMatching') + '</a>' : ''}
                    <a href="${customUrl}" class="nav-item nav-link${customActive}">` + t('nav.customProduct') + `</a>
                    <a href="${remakeUrl}" class="nav-item nav-link${remakeActive}">` + (t('nav.remake') || '?ˊ?寞?') + `</a>
                    <a href="/subscription-plans.html" class="nav-item nav-link">` + (t('nav.subscriptionPlans') || '?寞?????) + `</a>
                    
                    <span id="myFeaturesNav">${myFeaturesHTML}</span>
                    
                </div>
                
                ${showLangSwitch ? '<div class="d-none d-lg-flex align-items-center px-2 border-end"><a href="#" class="lang-link small text-muted text-decoration-none me-1" data-lang="zh-TW">' + t('nav.langZh') + '</a><span class="text-muted">|</span><a href="#" class="lang-link small text-muted text-decoration-none ms-1" data-lang="en">' + t('nav.langEn') + '</a></div>' : ''}
                
                <div class="d-none d-lg-flex align-items-center px-4" id="authSection">${desktopAuthHTML}</div>
                <div class="d-lg-none px-4 pb-3 pt-2 border-top mt-2" id="authSectionMobile">
                    ${showLangSwitch ? '<div class="mb-2"><a href="#" class="lang-link small text-muted me-2" data-lang="zh-TW">' + t('nav.langZh') + '</a><a href="#" class="lang-link small text-muted" data-lang="en">' + t('nav.langEn') + '</a></div>' : ''}
                    ${mobileAuthHTML}
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
                var msg = '?函??? + (r.plan_name || '撟港??寞?') + '????' + endStr + ' ?唳?嚗? ' + r.days_left + ' 憭抬?嚗??蝥???;
                var bar = document.createElement('div');
                bar.id = 'site-header-renewal-bar';
                bar.className = 'renewal-reminder-bar bg-warning bg-opacity-25 small py-2 px-3 text-center border-bottom';
                bar.innerHTML = '<i class="bi bi-calendar-event me-1"></i>' + msg + ' <a href="/subscription-plans.html" class="fw-bold text-dark">蝡蝥?</a>';
                headerContainer.insertBefore(bar, headerContainer.firstChild);
            })
            .catch(function () {});
    }).catch(function () {});
}

async function updateUserInfo(user) {
    let displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || '?冽';
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
    var msg = (window.i18n && window.i18n.t) ? window.i18n.t('auth.logoutConfirm') : '蝣箏?閬?箏?嚗?;
    var failMsg = (window.i18n && window.i18n.t) ? window.i18n.t('auth.logoutFail') : '?餃憭望?嚗?蝔??岫';
    if (confirm(msg)) {
        try {
            await AuthService.signOut();
        } catch (error) {
            console.error('?餃憭望?:', error);
            alert(failMsg);
        }
    }
}

