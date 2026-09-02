/**
 * 網站共用導航系統
 * 修改時注意：勿在同一 function 重複宣告變數；登入連結須帶 returnUrl。詳見 .cursor/rules/site-header-and-auth.mdc
 */

function matchdoIsChineseLocale(tag) {
    if (!tag || typeof tag !== 'string') return false;
    var l = tag.trim().toLowerCase().replace(/_/g, '-');
    if (l === 'zh') return true;
    return l.indexOf('zh-') === 0;
}

function matchdoDetectBrowserLang() {
    if (window.__matchdoLangDetect && window.__matchdoLangDetect.detectBrowserLang) {
        return window.__matchdoLangDetect.detectBrowserLang();
    }
    try {
        var list = (navigator.languages && navigator.languages.length)
            ? navigator.languages
            : [navigator.language || navigator.userLanguage || ''];
        for (var i = 0; i < list.length; i++) {
            if (matchdoIsChineseLocale(list[i])) return 'zh-TW';
        }
    } catch (e) { /* ignore */ }
    return 'en';
}

function matchdoNormalizeLang(lang) {
    if (window.__matchdoLangDetect && window.__matchdoLangDetect.normalizeLang) {
        return window.__matchdoLangDetect.normalizeLang(lang);
    }
    if (!lang || typeof lang !== 'string') return 'zh-TW';
    var l = lang.trim().toLowerCase().replace(/_/g, '-');
    if (l === 'en' || l.indexOf('en-') === 0) return 'en';
    if (matchdoIsChineseLocale(l)) return 'zh-TW';
    return 'en';
}

function matchdoResolvePublicLang() {
    try {
        var params = new URLSearchParams(window.location.search || '');
        if (params.get('lang')) return matchdoNormalizeLang(params.get('lang'));
        var stored = localStorage.getItem('lang');
        if (stored) return matchdoNormalizeLang(stored);
    } catch (e) { /* ignore */ }
    return matchdoDetectBrowserLang();
}

(function injectSiteHeaderStyles() {
    if (!document.getElementById('morandi-global-css')) {
        var _m = document.createElement('link');
        _m.id = 'morandi-global-css';
        _m.rel = 'stylesheet';
        _m.href = '/css/morandi-global.css?v=11';
        document.head.appendChild(_m);
    }
    // nav-cp-menu.css 由 style.css @import 載入（勿在此重複注入）
    // Bootstrap：禁止在 mid-body 同步注入（長頁雙載入會沖掉頭像 Dropdown）。
    // 保底改由 ensureBootstrapScriptPresent（window.load）處理。
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
            '#site-header .nav-hover-menu{display:none!important;}',
            '.navbar{padding:15px 0;font-family:"Space Grotesk",sans-serif;font-size:18px;border-bottom:1px solid rgba(122,143,161,0.28);}',
            '.navbar .navbar-nav .nav-link{margin-left:30px;padding:0;outline:none;color:#333;}',
            '.navbar .navbar-nav .nav-link .nav-hover-caret{color:var(--bs-primary,#7A8FA3);font-size:16px;line-height:1;vertical-align:middle;margin-left:4px;opacity:.6;transition:opacity .15s;}',
            '.navbar .navbar-nav .nav-link:hover .nav-hover-caret,.navbar .navbar-nav .nav-link.active .nav-hover-caret{opacity:1;}',
            '.navbar .navbar-nav .nav-link:hover,.navbar .navbar-nav .nav-link.active{color:var(--bs-primary,#7A8FA3)!important;}',
            '.navbar .dropdown-toggle::after{display:none!important;}',
            '.navbar .dropdown-menu:not(.nav-cp-menu) .dropdown-item:hover,.navbar .dropdown-menu:not(.nav-cp-menu) .dropdown-item.active{background:var(--bs-primary,#7A8FA3)!important;color:#fff!important;}',
            '@keyframes nbDropIn{from{opacity:0;transform:translateY(-6px);}to{opacity:1;transform:translateY(0);}}',
            '.nav-hover-menu:not(.nav-cp-menu){min-width:180px;padding:.5rem 0;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.12);border:1px solid #e5e7eb;}',
            '.nav-hover-menu:not(.nav-cp-menu) .dropdown-item{font-size:.9rem;padding:.5rem 1rem;display:flex;align-items:center;gap:.5rem;color:#374151;}',
            '.nav-hover-menu:not(.nav-cp-menu) .dropdown-item:hover{background:var(--bs-primary,#7A8FA3)!important;color:#fff!important;}',
            '@media(max-width:991.98px){.navbar .navbar-nav .nav-link{margin-left:0;padding:10px 0;}}',
            '@media(min-width:992px){',
            '.nav-item.nav-has-hover:hover .nav-hover-caret{opacity:1;}',
            '.nav-item.nav-has-hover:hover>.nav-hover-menu{display:block;margin-top:2px;animation:nbDropIn .15s ease;}',
            '#site-header .navbar{flex-wrap:wrap;}',
            '#site-header .navbar-collapse{order:1;width:100%;flex-grow:1;border-bottom:1px solid rgba(88,100,112,0.12);}',
            '#site-header .navbar-brand:not(.d-lg-none){order:2;display:flex!important;border-right:none!important;padding:0;margin:-39px auto 0;position:relative;z-index:5;}',
            '#site-header .navbar-brand.d-lg-none{display:none!important;}',
            '#site-header .nav-second-row-wrap .navbar-brand{order:0!important;margin:-39px auto 0!important;}',
            '#site-header .navbar-brand img{height:78px!important;background:#fff;padding:4px 12px;border-radius:4px;}',
            '#site-header #authSection{width:auto;min-width:auto;max-width:none;justify-content:flex-end;padding-left:0.5rem;padding-right:0;}',
            '#site-header .nav-avatar-toggle{flex-direction:column;background:transparent!important;border:none;}',
            '#site-header .nav-avatar-toggle .nav-avatar-ring{flex-shrink:0;background:var(--bs-primary);}',
            '#site-header .nav-avatar-toggle:hover .nav-avatar-ring{filter:brightness(1.1);}',
            '#site-header .nav-avatar-toggle::after{display:block!important;margin-left:0;margin-top:2px;color:var(--bs-primary,#7A8FA3)!important;border-top-color:var(--bs-primary,#7A8FA3)!important;}',
            '}'
        ].join('');
        document.head.appendChild(_c);
    }
})();

function markSiteHeaderReady(headerContainer) {
    if (headerContainer) headerContainer.setAttribute('data-header-ready', '1');
}

/** 若整頁都沒有 Bootstrap script，才在 load 後補一份（避免與頁尾 defer 雙載入） */
function ensureBootstrapScriptPresent() {
    if (typeof window.bootstrap !== 'undefined' && window.bootstrap.Dropdown) return;
    if (document.getElementById('bs-bundle-js')) return;
    if (document.querySelector('script[src*="bootstrap.bundle"]')) return;
    var _bs = document.createElement('script');
    _bs.id = 'bs-bundle-js';
    _bs.src = 'https://cdn.jsdelivr.net/npm/bootstrap@5.0.0/dist/js/bootstrap.bundle.min.js';
    document.head.appendChild(_bs);
}

/** 等 Bootstrap bundle 載入後初始化點擊下拉（頭像、我的功能） */
function ensureBootstrapReady() {
    if (typeof window.bootstrap !== 'undefined' && window.bootstrap.Dropdown) {
        return Promise.resolve(window.bootstrap);
    }
    return new Promise(function (resolve) {
        var settled = false;
        function finish() {
            if (settled) return;
            if (typeof window.bootstrap !== 'undefined' && window.bootstrap.Dropdown) {
                settled = true;
                resolve(window.bootstrap);
            }
        }
        var bsTag = document.getElementById('bs-bundle-js') || document.querySelector('script[src*="bootstrap.bundle"]');
        if (bsTag) {
            bsTag.addEventListener('load', finish);
        }
        var tries = 0;
        (function poll() {
            finish();
            if (settled) return;
            if (tries++ > 240) {
                settled = true;
                resolve(null);
                return;
            }
            // 解析後期才出現的 #bs-bundle-js：補綁 load
            if (!bsTag) {
                bsTag = document.getElementById('bs-bundle-js') || document.querySelector('script[src*="bootstrap.bundle"]');
                if (bsTag) bsTag.addEventListener('load', finish);
            }
            setTimeout(poll, 50);
        })();
    });
}

function initSiteHeaderDropdowns(root) {
    if (!root) return;
    ensureBootstrapReady().then(function (bs) {
        if (!bs || !bs.Dropdown) return;
        root.querySelectorAll('[data-bs-toggle="dropdown"]').forEach(function (el) {
            try {
                if (typeof bs.Dropdown.getOrCreateInstance === 'function') {
                    bs.Dropdown.getOrCreateInstance(el);
                } else {
                    var inst = bs.Dropdown.getInstance(el);
                    if (!inst) new bs.Dropdown(el);
                }
            } catch (e) { /* ignore */ }
        });
    });
}

function getNavLang() {
    if (window.i18n && window.i18n.getLang) return window.i18n.getLang();
    if (window.__I18N__ && window.__I18N__.lang) return window.__I18N__.lang;
    return matchdoResolvePublicLang();
}

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

/** 登入後能力（頁面/API 用；選單全顯示不依此隱藏 — 見 docs/account-one-login-capabilities.md） */
async function fetchMeCapabilities() {
    if (typeof window.AuthService === 'undefined' || !window.AuthService.getSession) return null;
    if (window.__ME_CAPABILITIES__) return window.__ME_CAPABILITIES__;
    if (window.__ME_CAPABILITIES_PROMISE__) return window.__ME_CAPABILITIES_PROMISE__;
    window.__ME_CAPABILITIES_PROMISE__ = (async function () {
        try {
            var getter = window.AuthService.getSessionForApi || window.AuthService.getSession;
            var session = typeof getter === 'function' ? await getter.call(window.AuthService) : null;
            if (!session || !session.access_token) return null;
            var r = await fetch('/api/me/capabilities', {
                headers: { Authorization: 'Bearer ' + session.access_token }
            });
            if (!r.ok) return null;
            var data = await r.json();
            window.__ME_CAPABILITIES__ = data;
            return data;
        } catch (e) {
            return null;
        } finally {
            window.__ME_CAPABILITIES_PROMISE__ = null;
        }
    })();
    return window.__ME_CAPABILITIES_PROMISE__;
}

/** 付費會員或管理員／測試員：數位資產庫可勾選是否上媒體牆 */
async function canControlDesignShowOnHomepage() {
    var caps = await fetchMeCapabilities();
    return !!(caps && caps.can_control_design_show_on_homepage);
}

function ensureNavLocaleReady() {
    if (window.i18n && window.i18n.ready) {
        return window.i18n.ready.then(function () {
            if (window.i18n && window.i18n.t) return window.__I18N__ && window.__I18N__.messages;
            return {};
        });
    }
    var lang = matchdoResolvePublicLang();
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
var _siteHeaderRetriesScheduled = false;

function bindSiteHeaderAuthListeners(initialSession) {
    if (!_siteHeaderRetriesScheduled) {
        _siteHeaderRetriesScheduled = true;
        scheduleHeaderAuthRetries(initialSession);
    }
    if (_siteHeaderAuthListenersBound) return;
    if (window.AuthService && typeof AuthService.onAuthStateChange === 'function') {
        _siteHeaderAuthListenersBound = true;
        AuthService.onAuthStateChange(function (event, newSession) {
            if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
                clearHeaderSessionCaches();
                try {
                    window.__ME_CAPABILITIES__ = null;
                    window.__ME_CAPABILITIES_PROMISE__ = null;
                } catch (_) {}
                var newUid = newSession && newSession.user
                    ? (newSession.user.id || newSession.user.email || 'user')
                    : null;
                if (event === 'SIGNED_IN' && newUid && newUid === _lastRenderedUserId) return;
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
        return;
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            bindSiteHeaderAuthListeners(initialSession);
        });
        return;
    }
    // auth-config 晚於 site-header 時：DOM 已就緒仍要再試綁定，否則會永遠顯示登出
    setTimeout(function () {
        if (!_siteHeaderAuthListenersBound) bindSiteHeaderAuthListeners(initialSession);
    }, 50);
}

function bootSiteHeader() {
    var headerContainer = document.getElementById('site-header');
    if (!headerContainer || headerContainer.getAttribute('data-header-booted') === '1') return;
    headerContainer.setAttribute('data-header-booted', '1');
    var session = (window.getSessionFromStorage && window.getSessionFromStorage()) || window.__authSessionForHeader || null;

    ensureNavLocaleReady()
        .then(function () {
            return loadSiteHeader(session, { fastFirst: true });
        })
        .then(function () {
            bindSiteHeaderAuthListeners(session);
            return resolveBootHeaderSession(session);
        })
        .then(function (sess) {
            if (!sess || !sess.user) return null;
            _navFullyRendered = false;
            return loadSiteHeader(sess, { fastFirst: false });
        })
        .catch(function (err) {
            console.error('site-header init:', err);
            return resolveBootHeaderSession(session || window.__authSessionForHeader || null).then(function (sess) {
                bindSiteHeaderAuthListeners(session);
                if (sess && sess.user) {
                    _navFullyRendered = false;
                    return loadSiteHeader(sess, { fastFirst: false });
                }
                return loadSiteHeader(session || window.__authSessionForHeader || null, { fastFirst: true });
            });
        });
}

function resolveBootHeaderSession(fallbackSession) {
    var sess = (window.getSessionFromStorage && window.getSessionFromStorage()) || window.__authSessionForHeader || fallbackSession || null;
    if (sess && sess.user) return Promise.resolve(sess);
    if (window.AuthService && typeof AuthService.getSession === 'function') {
        return AuthService.getSession().then(function (s) { return (s && s.user) ? s : sess; }).catch(function () { return sess; });
    }
    return Promise.resolve(sess);
}

if (document.getElementById('site-header')) {
    bootSiteHeader();
} else {
    document.addEventListener('DOMContentLoaded', bootSiteHeader);
}

/** 頁尾 defer 載入 Bootstrap 的長頁（如 custom-product）：load 後再綁一次下拉 */
window.addEventListener('load', function () {
    ensureBootstrapScriptPresent();
    var root = document.getElementById('site-header');
    if (root) initSiteHeaderDropdowns(root);
});

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
            await renderHeader(headerContainer, user, { enableServiceMatching: false }, null, {
                skipProfile: true,
                skipCapabilities: true,
                skipDeferredLoads: true
            });
            _lastRenderedUserId = uid;
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
    return p.startsWith('/custom') || p.includes('custom-product') || p.includes('my-custom-products') || p.includes('manufacturer-') || p.includes('material-dual-color') || p.includes('print-asset') || p === '/pattern-extract' || p.startsWith('/pattern-extract/') || p === '/design-to-physical' || p.startsWith('/design-to-physical/') || p === '/scene-sim' || p.startsWith('/scene-sim/') || p === '/promo-image' || p.startsWith('/promo-image/') || p === '/vendor-styles' || p.startsWith('/vendor-styles/') || p === '/official-templates' || p.startsWith('/official-templates/') || p === '/promo-camera' || p.startsWith('/promo-camera');
}
function isRemakeSection() {
    const p = (typeof window !== 'undefined' && window.location && window.location.pathname) ? window.location.pathname : '';
    return p.startsWith('/design-direction') || p.startsWith('/remake') || p.includes('remake-product');
}

/**
 * 全站選單＋登入區。修改時必守：
 * - 本 function 內勿重複宣告同一變數（例如已有 const path 就不要再 var path），否則整支腳本報錯、選單與登入會壞。
 * - loginHref 必須帶 returnUrl 或使用 AuthService.getLoginUrl(path)，不可只寫 '/login.html'。
 */
/** 客製產品 dropdown 內容 — 須與 lib/nav-cp-menu-html.js 同步 */
function buildNavCpMenuInnerHtml(t) {
    t = typeof t === 'function' ? t : function (k) { return k; };
    return (
        '<a href="/custom-product.html" class="nav-cp-link nav-cp-link--design"><i class="bi bi-pencil-square"></i>' +
        (t('nav.productDesign') || '設計稿') + '</a>' +
        '<div class="nav-cp-section nav-cp-section--structure">' +
        '<span class="nav-cp-section-label">' + (t('nav.sectionStructure') || '以結構') + '</span>' +
        '<a href="/vendor-styles/" class="nav-cp-link"><i class="bi bi-grid"></i>' + t('nav.browseVendorStyles') + '</a>' +
        '<a href="/official-templates/" class="nav-cp-link"><i class="bi bi-collection"></i>' + t('nav.browseOfficialTemplates') + '</a>' +
        '</div>' +
        '<div class="nav-cp-section nav-cp-section--style">' +
        '<span class="nav-cp-section-label">' + (t('nav.sectionStyle') || '以風格') + '</span>' +
        '<a href="/client/material-dual-color.html?return=design" class="nav-cp-link"><i class="bi bi-layout-split"></i>' +
        (t('nav.materialCombination') || '材料組合') + '</a>' +
        '<a href="/client/print-asset.html" class="nav-cp-link"><i class="bi bi-flower1"></i>' + (t('nav.printAsset') || '印花') + '</a>' +
        '</div>' +
        '<div class="nav-cp-section nav-cp-section--marketing">' +
        '<span class="nav-cp-section-label">' + (t('nav.marketingVisuals') || '行銷影像') + '</span>' +
        '<a href="/promo-image/" class="nav-cp-link"><i class="bi bi-megaphone"></i>' + t('nav.promoImage') + '</a>' +
        '<a href="/promo-camera" class="nav-cp-link"><i class="bi bi-camera"></i>' + (t('nav.promoCamera') || '商攝導演') + '</a>' +
        '</div>' +
        '<div class="nav-cp-section nav-cp-section--assist">' +
        '<span class="nav-cp-section-label">' + (t('nav.sectionAssistTools') || '輔助工具') + '</span>' +
        '<a href="/pattern-extract/" class="nav-cp-link"><i class="bi bi-bounding-box"></i>' + t('nav.patternExtract') + '</a>' +
        '<a href="/design-to-physical/" class="nav-cp-link"><i class="bi bi-box"></i>' + t('nav.designToPhysical') + '</a>' +
        '<a href="/scene-sim/" class="nav-cp-link"><i class="bi bi-image"></i>' + t('nav.sceneSim') + '</a>' +
        '</div>' +
        '<div class="nav-cp-section nav-cp-section--utility">' +
        '<a href="/client/my-custom-products.html" class="nav-cp-link"><i class="bi bi-box-seam"></i>' +
        (t('nav.myCustomProducts') || '我的數位資產') + '</a>' +
        '<a href="/custom/gallery.html" class="nav-cp-link"><i class="bi bi-images"></i>' +
        (t('gallery.title') || '圖庫找廠商') + '</a>' +
        '</div>'
    );
}

function siteBrandTaglinesHtml(t) {
    var cat = t('site.taglineCategory') || '訂製品設計與製作協作';
    var slo = t('site.taglineSlogan') || '設計稿 · 影像 · 廠商素材';
    var esc = function (s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    };
    return '<div class="site-brand-taglines" title="' + esc(cat + ' · ' + slo) + '">' +
        '<span class="site-brand-taglines-cat" data-i18n="site.taglineCategory">' + esc(cat) + '</span>' +
        '<span class="site-brand-taglines-sep" aria-hidden="true">·</span>' +
        '<span class="site-brand-taglines-slo" data-i18n="site.taglineSlogan">' + esc(slo) + '</span>' +
        '</div>';
}

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
    var profile = null;
    if (user && window.AuthService && !renderOpts.skipProfile) {
        try {
            profile = await AuthService.getUserProfile();
            if (profile && profile.role) {
                try { sessionStorage.setItem(_HEADER_PROFILE_ROLE_KEY, String(profile.role)); } catch (_) {}
            }
        } catch (error) {
            console.error('無法取得用戶角色:', error);
        }
    }
    var roles = resolveHeaderRoles(user, profile, renderOpts);
    isAdmin = roles.isAdmin;
    isTesterOrAdmin = roles.isTesterOrAdmin;
    const isCustom = isCustomProductSection();
    const isRemake = isRemakeSection();
    const brandUrl = '/';
    const path = (typeof window !== 'undefined' && window.location && window.location.pathname) ? window.location.pathname : '';
    const isHomePage = path === '/' || path === '/index.html' || path === '';
    const homeActive = isHomePage ? ' active' : '';
    const customActive = isCustom ? ' active' : '';
    const remakeActive = isRemake ? ' active' : '';
    const customUrl = '/custom-product.html';
    const remakeUrl = '/design-direction/';
        const loginHref = (typeof AuthService !== 'undefined' && AuthService.getLoginUrl) ? AuthService.getLoginUrl(path) : ('/login.html?returnUrl=' + encodeURIComponent(path || '/'));
    if ((isCustom || isRemake) && typeof document !== 'undefined' && document.documentElement) {
        document.documentElement.setAttribute('data-theme', isRemake ? 'remake' : 'custom');
        if (!document.querySelector('link[href*="theme-custom.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = '/css/theme-custom.css?v=3';
            document.head.appendChild(link);
        }
    }
    // 登入即顯示「我的功能」：僅放頂部選單沒有的工作入口（不重複客製產品／設計風向 ▾）。
    const showMyFeaturesDropdown = !!user;
    var meCapabilities = meCapabilitiesPreloaded != null ? meCapabilitiesPreloaded : null;
    if (user && meCapabilities == null && !renderOpts.skipCapabilities) {
        meCapabilities = await fetchMeCapabilities();
    }
    if (user && meCapabilities) {
        try {
            window.__ME_CAPABILITIES__ = meCapabilities;
        } catch (eCap) {}
    }
    var rawT = (window.i18n && window.i18n.t) ? window.i18n.t : function (k) { return k; };
    var navLang = getNavLang();
    var navFallbackZh = { 'site.taglineCategory': '訂製品設計與製作協作', 'site.taglineSlogan': '設計稿 · 影像 · 廠商素材', 'remake.badgeTesting': '測試中', 'nav.brand': 'MatchDO 合做', 'nav.home': '首頁', 'nav.serviceMatching': '服務媒合', 'nav.customProduct': '客製產品', 'nav.productDesign': '設計稿', 'nav.marketingVisuals': '行銷影像', 'nav.promoImage': '情境圖', 'nav.patternExtract': '圖樣提取', 'nav.designToPhysical': '寫實化', 'nav.sceneSim': '實境模擬', 'nav.browseVendorStyles': '廠商版型', 'nav.browseOfficialTemplates': '官方版型', 'nav.sectionStructure': '以結構', 'nav.sectionStyle': '以風格', 'nav.sectionAssistTools': '輔助工具', 'nav.materialCombination': '材料組合', 'nav.printAsset': '印花', 'nav.remake': '設計風向', 'nav.remakeSection': '設計風向', 'nav.remakeHome': '設計風向首頁', 'nav.remakeAnalysis': '設計意圖分析', 'nav.remakeDesign': '設計意圖分析', 'nav.remakeMyDesigns': '我的設計風向', 'nav.remakeGallery': '圖庫找靈感', 'nav.subscriptionPlans': '方案與定價', 'nav.login': '登入', 'nav.myFeatures': '我的功能', 'nav.myFeaturesTitle': '工作入口', 'nav.accountInfo': '帳號資訊', 'nav.dropdownRoles': '同一帳號・工作入口', 'nav.customizerSection': '① 訂製／設計', 'nav.manufacturerSection': '② 製造商', 'nav.supplierSection': '③ 產業供應商', 'nav.mfrUpstreamSection': '上游採購（B 線）', 'nav.mfrBrowseUpstream': '瀏覽產業供應商目錄', 'nav.mfrMyImports': '已匯入上游品項', 'nav.mySupplierPublicPage': '我的供應商首頁（公開）', 'nav.supplierManufacturerRefs': '製造商引用紀錄', 'nav.supplierCatalogManage': '上架數位產品庫', 'nav.myVendorPublicPage': '我的廠商首頁（公開）', 'nav.supplierPortal': '產業供應商說明', 'nav.supplierDashboard': '供應商控制台', 'nav.industrySuppliersList': '產業供應商目錄', 'nav.mySupplierReferences': '供應商引用管理', 'nav.supplierPrototypeLib': '原型組目錄', 'nav.supplierMaterialLib': '材料目錄', 'nav.dropdownCustom': '訂製品（客戶／供應商兼用）', 'nav.dropdownCustomClient': '訂製品客戶', 'nav.designSection': '設計／找廠商', 'nav.vendorSection': '製造商', 'nav.customHome': '客製產品首頁', 'nav.createProduct': '建立新產品', 'nav.myCustomProducts': '我的數位資產', 'nav.galleryFindVendor': '圖庫找廠商', 'nav.dropdownVendor': '訂製品供應商', 'nav.createVendor': '建立廠商資料', 'nav.vendorDashboard': '廠商控制台', 'nav.vendorPortfolio': '上傳展示案例', 'nav.vendorBaseModels': '我的數位版型', 'nav.vendorInquiries': '訂製詢價列表', 'nav.vendorContact': '聯絡方式', 'nav.myCredits': '我的點數', 'nav.promoCamera': '商攝導演', 'nav.findMakers': '找製作方', 'nav.myMessages': '我的對話', 'nav.makerSection': '製作方', 'nav.demands': '訂製需求', 'nav.dropdownWork': '工作入口', 'nav.expertSection': '專家功能', 'nav.expertDashboard': '專家控制台', 'nav.myListings': '我的報價', 'nav.matchedProjects': '我已媒合的專案', 'nav.browseProjects': '可媒合專案', 'nav.myPortfolio': '我的作品', 'nav.clientSection': '發案功能', 'nav.clientDashboard': '設計者控制台', 'nav.myProjects': '我的專案', 'nav.accountSettings': '帳號與設定', 'nav.loading': '載入中...', 'nav.settings': '設定', 'nav.contactSettings': '聯絡資訊設定', 'nav.adminSection': '管理功能', 'nav.testerSection': '測試員功能', 'nav.aiTools': 'AI 工具', 'nav.paymentSettings': '金流設定', 'nav.officialTemplateLibrary': '官方版型庫', 'nav.userManagement': '用戶管理', 'nav.categoryManagement': '分類管理', 'nav.categoryImages': '分類圖片管理', 'nav.logout': '登出', 'nav.langZh': '中文', 'nav.langEn': 'EN', 'nav.aiUpscale': 'AI 圖片放大', 'nav.aiEditArea': '我的 AI 編輯區', 'nav.pointsUnit': '點', 'nav.back': '返回' };
    var navFallbackEn = { 'site.taglineCategory': 'Custom design & production', 'site.taglineSlogan': 'Drafts · scenes · vendor assets', 'remake.badgeTesting': 'Beta', 'nav.brand': 'MatchDO', 'nav.home': 'Home', 'nav.serviceMatching': 'Services', 'nav.customProduct': 'Custom', 'nav.productDesign': 'Design', 'nav.marketingVisuals': 'Marketing', 'nav.promoImage': 'Scenes', 'nav.patternExtract': 'Extract', 'nav.designToPhysical': 'Realistic', 'nav.sceneSim': 'Scene sim', 'nav.browseVendorStyles': 'Vendor', 'nav.browseOfficialTemplates': 'Official', 'nav.sectionStructure': 'Structure', 'nav.sectionStyle': 'Style', 'nav.sectionAssistTools': 'Tools', 'nav.materialCombination': 'Materials', 'nav.printAsset': 'Print', 'nav.promoCamera': 'Promo cam', 'nav.remake': 'Direction', 'nav.remakeSection': 'Design direction', 'nav.remakeHome': 'Direction home', 'nav.remakeAnalysis': 'Intent analysis', 'nav.remakeDesign': 'Intent analysis', 'nav.remakeMyDesigns': 'My directions', 'nav.remakeGallery': 'Gallery', 'nav.subscriptionPlans': 'Plans', 'nav.login': 'Log in', 'nav.myFeatures': 'My menu', 'nav.myFeaturesTitle': 'Workspace', 'nav.accountInfo': 'Account', 'nav.dropdownRoles': 'One account', 'nav.dropdownCustom': 'Custom products', 'nav.dropdownCustomClient': 'Custom client', 'nav.dropdownVendor': 'Custom vendor', 'nav.dropdownWork': 'Work', 'nav.customizerSection': '① Design', 'nav.manufacturerSection': '② Manufacturer', 'nav.supplierSection': '③ Supplier', 'nav.mfrUpstreamSection': 'Upstream (B)', 'nav.mfrBrowseUpstream': 'Browse suppliers', 'nav.mfrMyImports': 'My imports', 'nav.mySupplierPublicPage': 'My supplier page', 'nav.supplierManufacturerRefs': 'Mfr references', 'nav.supplierCatalogManage': 'Publish catalog', 'nav.myVendorPublicPage': 'My vendor page', 'nav.supplierPortal': 'Supplier guide', 'nav.supplierDashboard': 'Supplier dashboard', 'nav.industrySuppliersList': 'Industry suppliers', 'nav.mySupplierReferences': 'References', 'nav.supplierPrototypeLib': 'Prototype sets', 'nav.supplierMaterialLib': 'Materials catalog', 'nav.designSection': 'Design / vendors', 'nav.vendorSection': 'Manufacturer', 'nav.customHome': 'Custom home', 'nav.createProduct': 'New product', 'nav.myCustomProducts': 'Digital assets', 'nav.galleryFindVendor': 'Gallery', 'nav.createVendor': 'Create vendor', 'nav.vendorDashboard': 'Vendor dashboard', 'nav.vendorPortfolio': 'Portfolio', 'nav.vendorBaseModels': 'Base models', 'nav.vendorInquiries': 'Inquiries', 'nav.vendorContact': 'Contact info', 'nav.findMakers': 'Find makers', 'nav.myMessages': 'Messages', 'nav.makerSection': 'Makers', 'nav.demands': 'Demands', 'nav.expertSection': 'Expert', 'nav.expertDashboard': 'Expert dashboard', 'nav.myListings': 'My listings', 'nav.matchedProjects': 'Matched', 'nav.browseProjects': 'Browse projects', 'nav.myPortfolio': 'Portfolio', 'nav.clientSection': 'Client', 'nav.clientDashboard': 'Dashboard', 'nav.myProjects': 'My projects', 'nav.myCredits': 'Credits', 'nav.accountSettings': 'Account', 'nav.loading': 'Loading…', 'nav.settings': 'Settings', 'nav.contactSettings': 'Contact', 'nav.adminSection': 'Admin', 'nav.testerSection': 'Tester', 'nav.aiTools': 'AI tools', 'nav.paymentSettings': 'Payments', 'nav.officialTemplateLibrary': 'Official library', 'nav.userManagement': 'Users', 'nav.categoryManagement': 'Categories', 'nav.categoryImages': 'Category images', 'nav.logout': 'Log out', 'nav.langZh': '中文', 'nav.langEn': 'EN', 'nav.aiUpscale': 'AI upscale', 'nav.aiEditArea': 'AI edit area', 'nav.pointsUnit': 'pts', 'nav.back': 'Back' };
    var navFallback = (navLang === 'en') ? navFallbackEn : navFallbackZh;
    var t = function (k) { var v = rawT(k); return (v && v !== k) ? v : (navFallback[k] || k); };
    var showLangSwitch = path.indexOf('/admin/') === -1;
    const navHTML = `
        <!-- Navbar Start -->
        <nav class="navbar navbar-expand-lg bg-white navbar-light sticky-top p-0">
            <a href="${brandUrl}" class="navbar-brand d-flex align-items-center border-end px-4 px-lg-5 ${user ? 'd-lg-none' : ''}">
                <img src="/img/matchdo-logo.png" alt="MatchDO 合做" style="height:52px;width:auto;">
            </a>
            ${user ? `<div id="navPointsMobile" class="d-lg-none nav-points-mobile align-self-center ms-auto me-2"><a href="/credits.html" class="nav-points-link text-decoration-none"><i class="bi bi-currency-exchange me-1"></i><span id="navPointsMobileValue">—</span> ` + t('nav.pointsUnit') + `</a></div>` : ''}
            <button type="button" class="navbar-toggler me-4" data-bs-toggle="collapse" data-bs-target="#navbarCollapse">
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="navbarCollapse">
                <div class="navbar-nav ms-auto p-4 p-lg-0">
                    <div class="nav-item dropdown nav-has-hover">
                        <a href="${customUrl}" class="nav-link${customActive}" style="display:inline-flex;align-items:center;">` + t('nav.customProduct') + `<span class="nav-hover-caret">▾</span></a>
                        <div class="dropdown-menu nav-hover-menu nav-cp-menu">` +
                        buildNavCpMenuInnerHtml(t) + `
                        </div>
                    </div>
                    <div class="nav-item dropdown nav-has-hover">
                        <a href="${remakeUrl}" class="nav-link${remakeActive}" style="display:inline-flex;align-items:center;">` + (t('nav.remake') || '設計風向') + `<span class="badge bg-warning text-dark ms-1" style="font-size:0.65rem;font-weight:500;" title="` + (t('remake.badgeTesting') || '測試中') + `">` + (t('remake.badgeTesting') || '測試中') + `</span><span class="nav-hover-caret">▾</span></a>
                        <div class="dropdown-menu nav-hover-menu">
                            <h6 class="dropdown-header text-muted small">` + t('nav.remakeSection') + `</h6>
                            <a href="${remakeUrl}" class="dropdown-item"><i class="bi bi-compass"></i>` + t('nav.remakeHome') + `</a>
                            <a href="/design-direction/analysis.html" class="dropdown-item"><i class="bi bi-lightbulb"></i>` + t('nav.remakeAnalysis') + `</a>
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
                            <div class="dropdown-menu bg-light m-0" style="min-width:15rem;">
                                <h6 class="dropdown-header text-muted small mb-1">` + t('nav.dropdownRoles') + `</h6>
                                <h6 class="dropdown-header py-1"><i class="bi bi-pencil-square me-2"></i>` + t('nav.customizerSection') + `</h6>
                                <a href="/client/dashboard.html" class="dropdown-item"><i class="bi bi-speedometer2 me-2"></i>` + t('nav.clientDashboard') + `</a>
                                <a href="/client/my-custom-products.html" class="dropdown-item"><i class="bi bi-box-seam me-2"></i>` + t('nav.myCustomProducts') + `</a>
                                <a href="/client/messages.html" class="dropdown-item"><i class="bi bi-chat-dots me-2"></i>` + t('nav.myMessages') + `</a>
                                <a href="/credits.html" class="dropdown-item"><i class="bi bi-currency-exchange me-2"></i>` + t('nav.myCredits') + `</a>
                                <a href="/client/ai-edit.html" class="dropdown-item"><i class="bi bi-palette me-2"></i>` + t('nav.aiEditArea') + `</a>
                                <a href="/client/material-dual-color.html?return=design" class="dropdown-item"><i class="bi bi-layout-split me-2"></i>` + (t('nav.materialCombination') || '材料組合') + `</a>
                                <a href="/client/print-asset.html" class="dropdown-item"><i class="bi bi-flower1 me-2"></i>` + (t('nav.printAsset') || '印花') + `</a>
                                <div class="dropdown-divider"></div>
                                <h6 class="dropdown-header py-1"><i class="bi bi-shop me-2"></i>` + t('nav.manufacturerSection') + `</h6>
                                <a href="/client/manufacturer-dashboard.html" class="dropdown-item"><i class="bi bi-speedometer2 me-2"></i>` + t('nav.vendorDashboard') + `</a>
                                <a href="#" id="nav-my-vendor-home" class="dropdown-item"><i class="bi bi-house-door me-2"></i>` + t('nav.myVendorPublicPage') + `</a>
                                <a href="/client/manufacturer-portfolio.html" class="dropdown-item"><i class="bi bi-images me-2"></i>` + t('nav.vendorPortfolio') + `</a>
                                <a href="/client/manufacturer-materials.html" class="dropdown-item"><i class="bi bi-folder2-open me-2"></i>` + t('nav.vendorBaseModels') + `</a>
                                <h6 class="dropdown-header text-muted small py-1 mb-0">` + t('nav.mfrUpstreamSection') + `</h6>
                                <a href="/client/industry-suppliers.html" class="dropdown-item"><i class="bi bi-grid me-2"></i>` + t('nav.mfrBrowseUpstream') + `</a>
                                <a href="/client/my-supplier-references.html" class="dropdown-item"><i class="bi bi-link-45deg me-2"></i>` + t('nav.mfrMyImports') + `</a>
                                <a href="/client/demands.html" class="dropdown-item"><i class="bi bi-inbox me-2"></i>` + t('nav.demands') + `</a>
                                <a href="/profile/contact-info.html" class="dropdown-item"><i class="bi bi-chat-dots me-2"></i>` + t('nav.vendorContact') + `</a>
                                <div class="dropdown-divider"></div>
                                <h6 class="dropdown-header py-1"><i class="bi bi-truck me-2"></i>` + t('nav.supplierSection') + `</h6>
                                <a href="/client/supplier-catalog-manage.html" class="dropdown-item"><i class="bi bi-cloud-upload me-2"></i>` + t('nav.supplierCatalogManage') + `</a>
                                <a href="/client/industry-supplier-dashboard.html" class="dropdown-item"><i class="bi bi-people me-2"></i>` + t('nav.supplierManufacturerRefs') + `</a>
                                <a href="#" id="nav-my-supplier-home" class="dropdown-item"><i class="bi bi-house-door me-2"></i>` + t('nav.mySupplierPublicPage') + `</a>
                                <div class="dropdown-divider"></div>
                                <a href="/help/" class="dropdown-item"><i class="bi bi-question-circle me-2"></i>` + (t('nav.operationGuides') || '操作介紹') + `</a>
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
                                <li><a class="dropdown-item" href="/subscription-plans.html"><i class="bi bi-calendar-check me-2"></i>` + (t('nav.subscriptionPlans') || '方案與定價') + `</a></li>
                                <li><a class="dropdown-item" href="/help/"><i class="bi bi-question-circle me-2"></i>` + (t('nav.operationGuides') || '操作介紹') + `</a></li>
                                <li><a class="dropdown-item" href="/promo-camera"><i class="bi bi-camera me-2"></i>` + (t('nav.promoCamera') || '商攝導演') + `</a></li>
                                <li><a class="dropdown-item" href="/profile/contact-info.html"><i class="bi bi-telephone me-2"></i>` + t('nav.contactSettings') + `</a></li>
                                ${isTesterOrAdmin ? `
                                <li><hr class="dropdown-divider"></li>
                                <li class="dropdown-header"><i class="bi bi-shield-lock me-2"></i>` + (isAdmin ? t('nav.adminSection') : t('nav.testerSection')) + `</li>
                                <li><a class="dropdown-item" href="/admin/playground.html"><i class="bi bi-brush me-2"></i>Playground</a></li>
                                <li><a class="dropdown-item" href="/admin/ai-tools.html"><i class="bi bi-magic me-2"></i>` + t('nav.aiTools') + `</a></li>
                                ` + (isAdmin ? `
                                <li><a class="dropdown-item" href="/admin/user-management.html"><i class="bi bi-people me-2"></i>` + t('nav.userManagement') + `</a></li>
                                <li><a class="dropdown-item" href="/admin/payment-settings.html"><i class="bi bi-currency-exchange me-2"></i>` + t('nav.paymentSettings') + `</a></li>
                                <li><a class="dropdown-item" href="/admin/categories.html"><i class="bi bi-tag me-2"></i>` + t('nav.categoryManagement') + `</a></li>
                                <li><a class="dropdown-item" href="/admin/category-images.html"><i class="bi bi-images me-2"></i>` + t('nav.categoryImages') + `</a></li>
                                <li><a class="dropdown-item" href="/client/manufacturer-materials.html?official_platform=1&manage=1"><i class="bi bi-collection me-2"></i>` + t('nav.officialTemplateLibrary') + `</a></li>
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
                                <li><a class="dropdown-item" href="/subscription-plans.html"><i class="bi bi-calendar-check me-2"></i>` + (t('nav.subscriptionPlans') || '方案與定價') + `</a></li>
                                <li><a class="dropdown-item" href="/help/"><i class="bi bi-question-circle me-2"></i>` + (t('nav.operationGuides') || '操作介紹') + `</a></li>
                                <li><a class="dropdown-item" href="/promo-camera"><i class="bi bi-camera me-2"></i>` + (t('nav.promoCamera') || '商攝導演') + `</a></li>
                                <li><a class="dropdown-item" href="/profile/contact-info.html"><i class="bi bi-telephone me-2"></i>` + t('nav.contactSettings') + `</a></li>
                                ${isTesterOrAdmin ? '<li><a class="dropdown-item" href="/admin/playground.html"><i class="bi bi-brush me-2"></i>Playground</a></li><li><a class="dropdown-item" href="/admin/ai-tools.html"><i class="bi bi-magic me-2"></i>' + t('nav.aiTools') + '</a></li>' + (isAdmin ? '<li><a class="dropdown-item" href="/admin/user-management.html"><i class="bi bi-people me-2"></i>' + t('nav.userManagement') + '</a></li><li><a class="dropdown-item" href="/admin/payment-settings.html"><i class="bi bi-currency-exchange me-2"></i>' + t('nav.paymentSettings') + '</a></li><li><a class="dropdown-item" href="/admin/categories.html"><i class="bi bi-tag me-2"></i>' + t('nav.categoryManagement') + '</a></li><li><a class="dropdown-item" href="/admin/category-images.html"><i class="bi bi-images me-2"></i>' + t('nav.categoryImages') + '</a></li><li><a class="dropdown-item" href="/client/manufacturer-materials.html?official_platform=1&manage=1"><i class="bi bi-collection me-2"></i>' + t('nav.officialTemplateLibrary') + '</a></li>' : '') : ''}
                                <li><hr class="dropdown-divider"></li>
                                <li><a class="dropdown-item" href="#" onclick="handleLogout(event)"><i class="bi bi-box-arrow-right me-2"></i>` + t('nav.logout') + `</a></li>
                            </ul>
                        </div>
                    ` : `
                        <a href="${loginHref}" class="btn btn-primary w-100 py-2"><i class="bi bi-person me-2"></i>` + t('nav.login') + `</a>
                    `}
                </div>
            </div>
            ${user ? `<div class="nav-second-row-wrap d-none d-lg-flex align-items-center px-0 py-1" style="order:2;flex:0 0 100%;width:100%;"><div class="nav-second-row-left" style="flex:1;min-width:0;"></div><a href="${brandUrl}" class="navbar-brand d-flex align-items-center px-4" style="flex:0 0 auto;border:none !important;"><img src="/img/matchdo-logo.png" alt="MatchDO 合做" style="height:52px;width:auto;"></a><div class="nav-second-row-right d-flex align-items-center justify-content-end px-4" style="flex:1;min-width:0;"><a href="/credits.html" class="nav-points-desktop text-decoration-none small text-muted" title="${t('nav.myCredits')}"><i class="bi bi-currency-exchange me-1"></i><span id="navPointsDesktopValue">—</span> ` + t('nav.pointsUnit') + `</a></div></div>` : ''}
        </nav>
        <div id="nav-mobile-drawer" class="nav-mobile-drawer" aria-hidden="true">
            <div class="nav-mobile-drawer-backdrop"></div>
            <div class="nav-mobile-drawer-panel">
                <div class="nav-mobile-drawer-header">
                    <button type="button" class="nav-mobile-drawer-back" aria-label="` + t('nav.back') + `">&#8592; ` + t('nav.back') + `</button>
                    <span class="nav-mobile-drawer-title"></span>
                </div>
                <div class="nav-mobile-drawer-body"></div>
            </div>
        </div>
    `;
    
    headerContainer.innerHTML = navHTML;
    markSiteHeaderReady(headerContainer);

    if (window.i18n && typeof window.i18n.applyPage === 'function') {
        window.i18n.applyPage(headerContainer);
    }

    initSiteHeaderDropdowns(headerContainer);
    initMobileNavDrawer(headerContainer);

    if (user && typeof AuthService !== 'undefined' && AuthService.getSession && !renderOpts.skipDeferredLoads) {
        deferHeaderDeferredLoads(headerContainer);
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

var _HEADER_PROFILE_ROLE_KEY = 'nb_profile_role';

function clearHeaderSessionCaches() {
    try { sessionStorage.removeItem(_HEADER_PROFILE_ROLE_KEY); } catch (_) {}
}

function resolveHeaderRoles(user, profile, renderOpts) {
    var isAdmin = false;
    var isTesterOrAdmin = false;
    if (!user) return { isAdmin: isAdmin, isTesterOrAdmin: isTesterOrAdmin };
    var role = '';
    if (profile && profile.role) role = String(profile.role).trim();
    if (!role && user.user_metadata && user.user_metadata.role) role = String(user.user_metadata.role).trim();
    if (!role && renderOpts && renderOpts.skipProfile) {
        try {
            var cached = sessionStorage.getItem(_HEADER_PROFILE_ROLE_KEY);
            if (cached) role = String(cached).trim();
        } catch (_) {}
    }
    isAdmin = role === 'admin';
    isTesterOrAdmin = isAdmin || role === 'tester';
    return { isAdmin: isAdmin, isTesterOrAdmin: isTesterOrAdmin };
}

function deferHeaderDeferredLoads(headerContainer) {
    var run = function () {
        loadRenewalReminderBanner(headerContainer);
        loadHeaderCredits(headerContainer);
        loadHeaderManufacturerNavLinks(headerContainer);
        loadHeaderSupplierNavLinks(headerContainer);
    };
    if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(run, { timeout: 2500 });
    } else {
        setTimeout(run, 0);
    }
}

function applyManufacturerNavLink(link, manufacturerId) {
    if (!link) return;
    link.href = '/client/manufacturer-dashboard.html';
    link.removeAttribute('target');
    link.removeAttribute('rel');
    if (manufacturerId) {
        link.href = '/vendor-profile.html?id=' + encodeURIComponent(manufacturerId);
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
    }
}

/** 已登入時設定「我的廠商首頁」連結（用 capabilities.manufacturer_id，避免非廠商打 /api/me/manufacturer 404） */
function loadHeaderManufacturerNavLinks(headerContainer) {
    if (!headerContainer) return;
    var link = headerContainer.querySelector('#nav-my-vendor-home');
    if (!link) return;
    var caps = window.__ME_CAPABILITIES__;
    if (caps) {
        applyManufacturerNavLink(link, caps.manufacturer_id || null);
        return;
    }
    fetchMeCapabilities().then(function (c) {
        applyManufacturerNavLink(link, c && c.manufacturer_id ? c.manufacturer_id : null);
    }).catch(function () {
        applyManufacturerNavLink(link, null);
    });
}

/** 已登入時設定「我的供應商首頁」連結（無綁定則導向上架頁說明） */
function loadHeaderSupplierNavLinks(headerContainer) {
    if (!headerContainer || typeof window.AuthService === 'undefined' || !window.AuthService.getSession) return;
    window.AuthService.getSession().then(function (session) {
        if (!session || !session.access_token) return;
        var link = headerContainer.querySelector('#nav-my-supplier-home');
        if (!link) return;
        var fallback = '/client/supplier-catalog-manage.html';
        link.href = fallback;
        var caps = window.__ME_CAPABILITIES__;
        if (caps && caps.is_industry_supplier === false) {
            return;
        }
        if (caps && caps.industry_supplier_id) {
            link.href = '/client/industry-supplier-catalog.html?id=' + encodeURIComponent(caps.industry_supplier_id);
            link.setAttribute('target', '_blank');
            link.setAttribute('rel', 'noopener noreferrer');
            return;
        }
        fetch('/api/me/industry-supplier?lite=1', { headers: { Authorization: 'Bearer ' + session.access_token } })
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (data) {
                var sup = data && data.supplier;
                if (sup && sup.id) {
                    link.href = '/client/industry-supplier-catalog.html?id=' + encodeURIComponent(sup.id);
                    link.setAttribute('target', '_blank');
                    link.setAttribute('rel', 'noopener noreferrer');
                }
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

