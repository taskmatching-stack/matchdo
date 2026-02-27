/**
 * 網站共用導航系統
 * 載入當下就先畫出導覽+登入按鈕，不等 DOMContentLoaded
 */
(function () {
    var el = document.getElementById('site-header');
    if (el && !el.innerHTML) {
        var path = (typeof window !== 'undefined' && window.location && window.location.pathname) ? window.location.pathname : '';
        if (!path || path === '/login.html') path = '/index.html';
        var loginHref = '/login.html?returnUrl=' + encodeURIComponent(path);
        var isCustom = path.indexOf('/custom') !== -1;
        var homeUrl = isCustom ? '/custom/' : '/index.html';
        el.innerHTML = '<nav class="navbar navbar-expand-lg bg-white navbar-light sticky-top p-0">' +
            '<a href="' + homeUrl + '" class="navbar-brand d-flex align-items-center border-end px-4 px-lg-5"><h2 class="m-0 text-primary">MatchDO 合做</h2></a>' +
            '<button type="button" class="navbar-toggler me-4" data-bs-toggle="collapse" data-bs-target="#navbarCollapse"><span class="navbar-toggler-icon"></span></button>' +
            '<div class="collapse navbar-collapse" id="navbarCollapse">' +
            '<div class="navbar-nav ms-auto p-4 p-lg-0">' +
            '<a href="' + homeUrl + '" class="nav-item nav-link">首頁</a>' +
            '<a href="/index.html#ai-estimate" class="nav-item nav-link">服務媒合</a>' +
            '<a href="/custom/" class="nav-item nav-link">客製產品</a>' +
            '<a href="/subscription-plans.html" class="nav-item nav-link">方案與定價</a>' +
            '</div>' +
            '<div class="d-none d-lg-flex align-items-center px-4"><a href="' + loginHref + '" class="btn btn-primary py-2 px-4"><i class="bi bi-person me-2"></i>登入</a></div>' +
            '<div class="d-lg-none px-4 pb-3 pt-2 border-top mt-2"><a href="' + loginHref + '" class="btn btn-primary w-100 py-2"><i class="bi bi-person me-2"></i>登入</a></div>' +
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

// 錯誤時仍顯示至少「登入」按鈕，避免 AbortError 等導致整塊選單消失
function renderHeaderFallback(container) {
    if (!container) return;
    try {
        container.innerHTML = '<nav class="navbar navbar-expand-lg bg-white navbar-light sticky-top p-0">' +
            '<a href="/index.html" class="navbar-brand d-flex align-items-center border-end px-4 px-lg-5"><h2 class="m-0 text-primary">MatchDO 合做</h2></a>' +
            '<button type="button" class="navbar-toggler me-4" data-bs-toggle="collapse" data-bs-target="#navbarCollapse"><span class="navbar-toggler-icon"></span></button>' +
            '<div class="collapse navbar-collapse" id="navbarCollapse">' +
            '<div class="navbar-nav ms-auto p-4 p-lg-0">' +
            '<a href="/index.html" class="nav-item nav-link active">首頁</a>' +
            '<a href="/index.html#ai-estimate" class="nav-item nav-link">服務媒合</a>' +
            '<a href="/custom/" class="nav-item nav-link">客製產品</a>' +
            '<a href="/subscription-plans.html" class="nav-item nav-link">方案與定價</a>' +
            '</div>' +
            '<div class="d-none d-lg-flex align-items-center px-4"><a href="/login.html" class="btn btn-primary py-2 px-4"><i class="bi bi-person me-2"></i>登入</a></div>' +
            '<div class="d-lg-none px-4 pb-3 pt-2 border-top mt-2"><a href="/login.html" class="btn btn-primary w-100 py-2"><i class="bi bi-person me-2"></i>登入</a></div>' +
            '</div></nav>';
    } catch (e) {
        console.warn('renderHeaderFallback:', e?.message || e);
    }
}

document.addEventListener('DOMContentLoaded', function () {
    var headerContainer = document.getElementById('site-header');
    var session = (window.getSessionFromStorage && window.getSessionFromStorage()) || null;
    var user = session && session.user ? session.user : null;
    try {
        if (headerContainer) {
            getPublicConfig().then(function (config) {
                return renderHeader(headerContainer, user, config);
            }).catch(function () {
                renderHeaderFallback(headerContainer);
            });
        }
    } catch (e) {
        renderHeaderFallback(headerContainer);
    }
    try {
        if (window.AuthService && typeof AuthService.onAuthStateChange === 'function') {
            AuthService.onAuthStateChange(function (event, session) {
                if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
                    loadSiteHeader(session);
                }
            });
        }
    } catch (e2) {}
    if (!user) loadSiteHeader();
    var delays = [300, 800];
    if (window.location.hash && (window.location.hash.indexOf('access_token') !== -1 || window.location.hash.indexOf('refresh_token') !== -1)) {
        delays = [150, 400, 800, 1200, 2000, 3500];
    }
    delays.forEach(function (ms) {
        setTimeout(function () {
            try {
                loadSiteHeader();
            } catch (e3) {
                renderHeaderFallback(document.getElementById('site-header'));
            }
        }, ms);
    });
    window.addEventListener('hashchange', function () {
        try {
            loadSiteHeader();
        } catch (e4) {
            renderHeaderFallback(document.getElementById('site-header'));
        }
    });
});

function loadSiteHeader(sessionFromEvent) {
    var headerContainer = document.getElementById('site-header');
    if (!headerContainer) return;
    function safeRender(user, config) {
        function onErr() {
            renderHeaderFallback(headerContainer);
        }
        try {
            var p = renderHeader(headerContainer, user, config);
            if (p && typeof p.catch === 'function') {
                p.catch(onErr);
            }
        } catch (e) {
            onErr();
        }
    }
    var user = null;
    if (sessionFromEvent && sessionFromEvent.user) {
        user = sessionFromEvent.user;
    } else if (window.__authSessionForHeader && window.__authSessionForHeader.user) {
        user = window.__authSessionForHeader.user;
        delete window.__authSessionForHeader;
    }
    getPublicConfig().then(function (config) {
        if (user) {
            safeRender(user, config);
            return;
        }
        if (!window.AuthService) {
            safeRender(null, config);
            return;
        }
        AuthService.getSession().then(function (session) {
            var u = session && session.user ? session.user : null;
            if (!u && window.location.hash && window.location.hash.indexOf('access_token') !== -1) {
                return;
            }
            safeRender(u, config);
        }).catch(function () {
            safeRender(null, config);
        });
    }).catch(function () {
        safeRender(user, { enableServiceMatching: true });
    });
}

async function renderHeader(headerContainer, user, config) {
    if (!config) config = { enableServiceMatching: true };
    const enableServiceMatching = config.enableServiceMatching !== false;
    let isAdmin = false;
    if (user && window.AuthService) {
        try {
            const profile = await AuthService.getUserProfile();
            isAdmin = user.user_metadata?.role === 'admin' || profile?.role === 'admin';
        } catch (error) {
            console.error('無法取得用戶角色:', error);
        }
    }
    const showServiceMatchingNav = enableServiceMatching;
    const showMyFeaturesDropdown = user && enableServiceMatching;
    const navHTML = `
        <!-- Navbar Start -->
        <nav class="navbar navbar-expand-lg bg-white navbar-light sticky-top p-0">
            <a href="/index.html" class="navbar-brand d-flex align-items-center border-end px-4 px-lg-5">
                <h2 class="m-0 text-primary">MatchDO 合做</h2>
            </a>
            <button type="button" class="navbar-toggler me-4" data-bs-toggle="collapse" data-bs-target="#navbarCollapse">
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="navbarCollapse">
                <div class="navbar-nav ms-auto p-4 p-lg-0">
                    <a href="/index.html" class="nav-item nav-link active">首頁</a>
                    ${showServiceMatchingNav ? '<a href="/index.html#ai-estimate" class="nav-item nav-link">服務媒合</a>' : ''}
                    <a href="/custom/" class="nav-item nav-link">客製產品</a>
                    <a href="/subscription-plans.html" class="nav-item nav-link">方案與定價</a>
                    
                    ${showMyFeaturesDropdown ? `
                        <!-- 已登入：功能選單 -->
                        <div class="nav-item dropdown">
                            <a href="#" class="nav-link dropdown-toggle" data-bs-toggle="dropdown">我的功能</a>
                            <div class="dropdown-menu bg-light m-0">
                                <h6 class="dropdown-header"><i class="bi bi-briefcase me-2"></i>專家功能</h6>
                                <a href="/iStudio-1.0.0/expert/dashboard.html" class="dropdown-item">
                                    <i class="bi bi-speedometer2 me-2"></i>專家控制台
                                </a>
                                <a href="/iStudio-1.0.0/expert/my-listings.html" class="dropdown-item">
                                    <i class="bi bi-list-ul me-2"></i>我的報價
                                </a>
                                <a href="/iStudio-1.0.0/expert/matched-projects.html" class="dropdown-item">
                                    <i class="bi bi-lightning me-2"></i>媒合專案
                                </a>
                                <a href="/expert/my-profile.html" class="dropdown-item">
                                    <i class="bi bi-person-badge me-2"></i>專家自介頁
                                </a>
                                <div class="dropdown-divider"></div>
                                <h6 class="dropdown-header"><i class="bi bi-person me-2"></i>發案功能</h6>
                                <a href="/client/dashboard.html" class="dropdown-item">
                                    <i class="bi bi-speedometer2 me-2"></i>發案控制台
                                </a>
                                <a href="/iStudio-1.0.0/client/my-projects.html" class="dropdown-item">
                                    <i class="bi bi-folder me-2"></i>我的專案
                                </a>
                    </div>
                </div>
                    ` : ''}
                </div>
                
                <!-- 登入/用戶資訊區（桌面：每頁都顯示） -->
                <div class="d-none d-lg-flex align-items-center px-4" id="authSection">
                    ${user ? `
                        <div class="dropdown">
                            <a class="btn btn-primary py-2 px-4 d-flex align-items-center dropdown-toggle" 
                               href="#" role="button" data-bs-toggle="dropdown" id="userDropdownDesktop">
                                <img id="userAvatar" src="" alt="Avatar" 
                                     style="width: 30px; height: 30px; border-radius: 50%; margin-right: 10px;">
                                <span id="userName">載入中...</span>
                            </a>
                            <ul class="dropdown-menu dropdown-menu-end" aria-labelledby="userDropdownDesktop">
                                <li class="dropdown-header text-muted small">帳號與設定</li>
                                <li><a class="dropdown-item" href="/index.html"><i class="bi bi-house me-2"></i>首頁</a></li>
                                ${showServiceMatchingNav ? `
                                <li><hr class="dropdown-divider"></li>
                                <li class="dropdown-header"><i class="bi bi-briefcase me-2"></i>專家功能</li>
                                <li><a class="dropdown-item" href="/iStudio-1.0.0/expert/dashboard.html">
                                    <i class="bi bi-speedometer2 me-2"></i>專家控制台
                                </a></li>
                                <li><a class="dropdown-item" href="/iStudio-1.0.0/expert/my-listings.html">
                                    <i class="bi bi-list-ul me-2"></i>我的報價
                                </a></li>
                                <li><a class="dropdown-item" href="/iStudio-1.0.0/expert/matched-projects.html">
                                    <i class="bi bi-lightning me-2"></i>媒合專案
                                </a></li>
                                <li><a class="dropdown-item" href="/expert/my-profile.html">
                                    <i class="bi bi-person-badge me-2"></i>專家自介頁
                                </a></li>
                                <li><hr class="dropdown-divider"></li>
                                <li class="dropdown-header"><i class="bi bi-person me-2"></i>發案功能</li>
                                <li><a class="dropdown-item" href="/client/dashboard.html">
                                    <i class="bi bi-speedometer2 me-2"></i>發案控制台
                                </a></li>
                                <li><a class="dropdown-item" href="/iStudio-1.0.0/client/my-projects.html">
                                    <i class="bi bi-folder me-2"></i>我的專案
                                </a></li>
                                ` : ''}
                                <li><hr class="dropdown-divider"></li>
                                <li class="dropdown-header"><i class="bi bi-gear me-2"></i>設定</li>
                                <li><a class="dropdown-item" href="/profile/contact-info.html">
                                    <i class="bi bi-telephone me-2"></i>聯絡資訊設定
                                </a></li>
                                <li><hr class="dropdown-divider"></li>
                                <li><a class="dropdown-item" href="#" onclick="handleLogout(event)">
                                    <i class="bi bi-box-arrow-right me-2"></i>登出
                                </a></li>
                            </ul>
                        </div>
                    ` : `
                        <!-- 未登入：登入按鈕（帶 returnUrl 登入後回本頁） -->
                        <a href="${(typeof AuthService !== 'undefined' && AuthService.getLoginUrl) ? AuthService.getLoginUrl() : '/login.html'}" class="btn btn-primary py-2 px-4">
                            <i class="bi bi-person me-2"></i>登入
                        </a>
                    `}
                </div>
                <!-- 手機版：帳號選單在收合內顯示，避免消失 -->
                <div class="d-lg-none px-4 pb-3 pt-2 border-top mt-2" id="authSectionMobile">
                    ${user ? `
                        <div class="dropdown">
                            <a class="btn btn-primary w-100 py-2 d-flex align-items-center justify-content-center dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown" id="userDropdownMobile">
                                <img id="userAvatarMobile" src="" alt="" style="width: 28px; height: 28px; border-radius: 50%; margin-right: 8px;">
                                <span id="userNameMobile">載入中...</span>
                            </a>
                            <ul class="dropdown-menu dropdown-menu-end w-100">
                                <li class="dropdown-header text-muted small">帳號與設定</li>
                                <li><a class="dropdown-item" href="/index.html"><i class="bi bi-house me-2"></i>首頁</a></li>
                                <li><hr class="dropdown-divider"></li>
                                <li><a class="dropdown-item" href="/profile/contact-info.html"><i class="bi bi-telephone me-2"></i>聯絡資訊設定</a></li>
                                <li><hr class="dropdown-divider"></li>
                                <li><a class="dropdown-item" href="#" onclick="handleLogout(event)"><i class="bi bi-box-arrow-right me-2"></i>登出</a></li>
                            </ul>
                        </div>
                    ` : `
                        <a href="${(typeof AuthService !== 'undefined' && AuthService.getLoginUrl) ? AuthService.getLoginUrl() : '/login.html'}" class="btn btn-primary w-100 py-2"><i class="bi bi-person me-2"></i>登入</a>
                    `}
                </div>
            </div>
        </nav>
        <!-- Navbar End -->
    `;
    
    headerContainer.innerHTML = navHTML;
    
    // 如果已登入，更新用戶資訊
    if (user && window.AuthService) {
        updateUserInfo(user);
    }
}

async function updateUserInfo(user) {
    let displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || '用戶';
    let avatarUrl = user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=667eea&color=fff`;
    try {
        const profile = await AuthService.getUserProfile();
        if (profile?.full_name) displayName = profile.full_name;
        if (profile?.avatar_url) avatarUrl = profile.avatar_url;
    } catch (e) {}
    [['userName', displayName, false], ['userAvatar', avatarUrl, true], ['userNameMobile', displayName, false], ['userAvatarMobile', avatarUrl, true]].forEach(function (a) {
        var el = document.getElementById(a[0]);
        if (el) el[a[2] ? 'src' : 'textContent'] = a[1];
    });
}

async function handleLogout(event) {
    event.preventDefault();
    
    if (confirm('確定要登出嗎？')) {
        try {
            await AuthService.signOut();
        } catch (error) {
            console.error('登出失敗:', error);
            alert('登出失敗，請稍後再試');
        }
    }
}

