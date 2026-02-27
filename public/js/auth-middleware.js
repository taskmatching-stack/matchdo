/**
 * 認證中介層 - 頁面導航保護與權限檢查
 */

const AuthMiddleware = {
    /**
     * 檢查是否已登入
     * @param {string} redirectUrl - 未登入時導向的 URL（預設：login.html）
     */
    async requireAuth(redirectUrl) {
        const user = await AuthService.getCurrentUser();
        if (!user) {
            var url = (AuthService.getLoginUrl && typeof AuthService.getLoginUrl === 'function') ? AuthService.getLoginUrl() : '/login.html';
            window.location.href = url;
            return false;
        }
        return true;
    },

    /**
     * 後台頁面保護 — Phase 1.7：需登入且 role=admin
     */
    async requireAdmin(redirectUrl = '/login.html') {
        const ok = await this.requireAuth(redirectUrl);
        if (!ok) return false;
        const admin = await AuthService.isAdmin();
        if (!admin) {
            window.location.href = '/no-access.html?for=admin';
            return false;
        }
        return true;
    },

    /**
     * 專家頁面保護 — Phase 1.7：需登入且 role=expert 或 admin
     */
    async requireExpert(redirectUrl = '/login.html') {
        const ok = await this.requireAuth(redirectUrl);
        if (!ok) return false;
        const expert = await AuthService.isExpert();
        if (!expert) {
            window.location.href = '/no-access.html?for=expert';
            return false;
        }
        return true;
    },

    /**
     * 發案者頁面保護 — Phase 1.7：需登入且 role=client 或 admin
     */
    async requireClient(redirectUrl = '/login.html') {
        const ok = await this.requireAuth(redirectUrl);
        if (!ok) return false;
        const client = await AuthService.isClient();
        if (!client) {
            window.location.href = '/no-access.html?for=client';
            return false;
        }
        return true;
    },

    /**
     * 顯示用戶資訊在導航欄
     * @param {string} containerId - 用戶資訊容器的 ID
     */
    async renderUserInfo(containerId = 'userInfoContainer') {
        const user = await AuthService.getCurrentUser();
        const profile = await AuthService.getUserProfile();
        
        if (!user) return;

        const container = document.getElementById(containerId);
        if (!container) return;

        const avatarUrl = user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email)}`;
        const displayName = user.user_metadata?.full_name || profile?.full_name || user.email.split('@')[0];

        container.innerHTML = `
            <div class="dropdown">
                <a class="nav-link dropdown-toggle d-flex align-items-center" href="#" role="button" data-bs-toggle="dropdown">
                    <img src="${avatarUrl}" alt="Avatar" style="width: 35px; height: 35px; border-radius: 50%; margin-right: 10px;">
                    <span>${displayName}</span>
                </a>
                <ul class="dropdown-menu dropdown-menu-end">
                    <li><a class="dropdown-item" href="/index.html">
                        <i class="bi bi-house"></i> 首頁
                    </a></li>
                    <li><a class="dropdown-item" href="/expert/my-listings.html">
                        <i class="bi bi-list-ul"></i> 我的報價
                    </a></li>
                    <li><a class="dropdown-item" href="/client/my-projects.html">
                        <i class="bi bi-folder"></i> 我的專案
                    </a></li>
                    <li><a class="dropdown-item" href="/custom-product.html">
                        <i class="bi bi-palette"></i> 客製產品
                    </a></li>
                    <li><hr class="dropdown-divider"></li>
                    <li><a class="dropdown-item" href="#" onclick="AuthService.signOut()">
                        <i class="bi bi-box-arrow-right"></i> 登出
                    </a></li>
                </ul>
            </div>
        `;
    },

    /**
     * 初始化認證狀態監聽
     */
    initAuthListener() {
        AuthService.onAuthStateChange((event, session) => {
            console.log('Auth 狀態變化:', event);
            
            if (event === 'SIGNED_OUT') {
                // 登出時清除本地資料
                localStorage.clear();
                sessionStorage.clear();
            }
            
            if (event === 'SIGNED_IN' && session) {
                console.log('用戶已登入:', session.user.email);
            }
        });
    }
};

// 暴露到全域
window.AuthMiddleware = AuthMiddleware;

// 自動初始化監聽器
document.addEventListener('DOMContentLoaded', () => {
    AuthMiddleware.initAuthListener();
});
