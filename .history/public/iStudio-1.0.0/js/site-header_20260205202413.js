/**
 * 網站共用導航系統
 * 根據登入狀態顯示不同選單
 */

document.addEventListener('DOMContentLoaded', async () => {
    await loadSiteHeader();
});

async function loadSiteHeader() {
    const headerContainer = document.getElementById('site-header');
    if (!headerContainer) return;

    // 檢查登入狀態
    const user = await (window.AuthService ? AuthService.getCurrentUser() : null);
    
    // 檢查是否為管理員
    let isAdmin = false;
    if (user && window.AuthService) {
        try {
            const profile = await AuthService.getUserProfile();
            isAdmin = user.user_metadata?.role === 'admin' || profile?.role === 'admin';
        } catch (error) {
            console.error('無法取得用戶角色:', error);
        }
    }
    
    const navHTML = `
        <!-- Navbar Start -->
        <nav class="navbar navbar-expand-lg bg-white navbar-light sticky-top p-0">
            <a href="/iStudio-1.0.0/index.html" class="navbar-brand d-flex align-items-center border-end px-4 px-lg-5">
                <h2 class="m-0 text-primary">MatchDO 合做</h2>
            </a>
            <button type="button" class="navbar-toggler me-4" data-bs-toggle="collapse" data-bs-target="#navbarCollapse">
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="navbarCollapse">
                <div class="navbar-nav ms-auto p-4 p-lg-0">
                    <a href="/iStudio-1.0.0/index.html" class="nav-item nav-link active">首頁</a>
                    <a href="/iStudio-1.0.0/index.html#ai-estimate" class="nav-item nav-link">服務媒合</a>
                    <a href="/iStudio-1.0.0/custom-product.html" class="nav-item nav-link">客製產品</a>
                    
                    ${user ? `
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
                                <div class="dropdown-divider"></div>
                                <h6 class="dropdown-header"><i class="bi bi-person me-2"></i>發案功能</h6>
                                <a href="/client/dashboard.html" class="dropdown-item">
                                    <i class="bi bi-speedometer2 me-2"></i>發案控制台
                                </a>
                                <a href="/iStudio-1.0.0/client/my-projects.html" class="dropdown-item">
                                    <i class="bi bi-folder me-2"></i>我的專案
                                </a>
                                <div class="dropdown-divider"></div>
                                <h6 class="dropdown-header"><i class="bi bi-palette me-2"></i>客製產品</h6>
                                <a href="/iStudio-1.0.0/custom-product.html" class="dropdown-item">
                                    <i class="bi bi-plus-circle me-2"></i>建立新產品
                                </a>
                                <a href="/iStudio-1.0.0/client/my-custom-products.html" class="dropdown-item">
                                    <i class="bi bi-box-seam me-2"></i>我的客製產品
                                </a>
                            </div>
                        </div>
                    ` : ''}
                    
                    <a href="/iStudio-1.0.0/contact.html" class="nav-item nav-link">聯絡我們</a>
                </div>
                
                <!-- 登入/用戶資訊區 -->
                <div class="d-none d-lg-flex align-items-center px-4" id="authSection">
                    ${user ? `
                        <!-- 已登入：用戶下拉選單 -->
                        <div class="dropdown">
                            <a class="btn btn-primary py-2 px-4 d-flex align-items-center dropdown-toggle" 
                               href="#" role="button" data-bs-toggle="dropdown">
                                <img id="userAvatar" src="" alt="Avatar" 
                                     style="width: 30px; height: 30px; border-radius: 50%; margin-right: 10px;">
                                <span id="userName">載入中...</span>
                            </a>
                            <ul class="dropdown-menu dropdown-menu-end">
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
                                <li><hr class="dropdown-divider"></li>
                                <li class="dropdown-header"><i class="bi bi-person me-2"></i>發案功能</li>
                                <li><a class="dropdown-item" href="/client/dashboard.html">
                                    <i class="bi bi-speedometer2 me-2"></i>發案控制台
                                </a></li>
                                <li><a class="dropdown-item" href="/iStudio-1.0.0/client/my-projects.html">
                                    <i class="bi bi-folder me-2"></i>我的專案
                                </a></li>
                                <li><hr class="dropdown-divider"></li>
                                <li class="dropdown-header"><i class="bi bi-palette me-2"></i>客製產品</li>
                                <li><a class="dropdown-item" href="/iStudio-1.0.0/custom-product.html">
                                    <i class="bi bi-plus-circle me-2"></i>建立新產品
                                </a></li>
                                <li><a class="dropdown-item" href="/iStudio-1.0.0/client/my-custom-products.html">
                                    <i class="bi bi-box-seam me-2"></i>我的客製產品
                                </a></li>
                                <li><hr class="dropdown-divider"></li>
                                <li class="dropdown-header"><i class="bi bi-gear me-2"></i>設定</li>
                                <li><a class="dropdown-item" href="/iStudio-1.0.0/profile/contact-info.html">
                                    <i class="bi bi-telephone me-2"></i>聯絡資訊設定
                                </a></li>
                                ${isAdmin ? `
                                <li><hr class="dropdown-divider"></li>
                                <li class="dropdown-header"><i class="bi bi-shield-lock me-2"></i>管理功能</li>
                                <li><a class="dropdown-item" href="/admin/user-management.html">
                                    <i class="bi bi-people me-2"></i>用戶管理
                                </a></li>
                                <li><a class="dropdown-item" href="/admin/categories.html">
                                    <i class="bi bi-tag me-2"></i>分類管理
                                </a></li>
                                <li><a class="dropdown-item" href="/admin/category-images.html">
                                    <i class="bi bi-images me-2"></i>分類圖片管理
                                </a></li>
                                ` : ''}
                                <li><hr class="dropdown-divider"></li>
                                <li><a class="dropdown-item" href="#" onclick="handleLogout(event)">
                                    <i class="bi bi-box-arrow-right me-2"></i>登出
                                </a></li>
                            </ul>
                        </div>
                    ` : `
                        <!-- 未登入：登入按鈕 -->
                        <a href="/login.html" class="btn btn-primary py-2 px-4">
                            <i class="bi bi-person me-2"></i>登入
                        </a>
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
    const userNameEl = document.getElementById('userName');
    const userAvatarEl = document.getElementById('userAvatar');
    
    if (!userNameEl || !userAvatarEl) return;
    
    try {
        const profile = await AuthService.getUserProfile();
        const displayName = user.user_metadata?.full_name || profile?.full_name || user.email.split('@')[0];
        const avatarUrl = user.user_metadata?.avatar_url || profile?.avatar_url || 
                         `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=667eea&color=fff`;
        
        userNameEl.textContent = displayName;
        userAvatarEl.src = avatarUrl;
    } catch (error) {
        console.error('更新用戶資訊失敗:', error);
        userNameEl.textContent = user.email.split('@')[0];
        userAvatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email)}&background=667eea&color=fff`;
    }
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

