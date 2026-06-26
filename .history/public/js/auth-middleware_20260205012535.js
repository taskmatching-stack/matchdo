/**
 * 認證中介層 - 頁面導航保護與權限檢查
 */

const AuthMiddleware = {
    /**
     * 檢查是否已登入
     * @param {string} redirectUrl - 未登入時導向的 URL（預設：login.html）
     */
    async requireAuth(redirectUrl = '/login.html') {
        const user = await AuthService.getCurrentUser();
        if (!user) {
            window.location.href = redirectUrl;
            return false;
        }
        return true;
    },

    /**
     * 檢查是否已完成註冊
     * @param {string} redirectUrl - 未完成註冊時導向的 URL（預設：register.html）
     */
    async requireProfileCompleted(redirectUrl = '/register.html') {
        const isAuth = await this.requireAuth(redirectUrl);
        if (!isAuth) return false;

        const profile = await AuthService.getUserProfile();
        if (!profile || !profile.profile_completed) {
            window.location.href = redirectUrl;
            return false;
        }
        return true;
    },

    /**
     * 檢查用戶角色
     * @param {string} requiredRole - 需要的角色（'client' 或 'expert'）
     * @param {string} redirectUrl - 角色不符時導向的 URL
     */
    async requireRole(requiredRole, redirectUrl = '/iStudio-1.0.0/index.html') {
        const isCompleted = await this.requireProfileCompleted();
        if (!isCompleted) return false;

        const profile = await AuthService.getUserProfile();
        if (profile.role !== requiredRole) {
            alert(`此頁面僅限${requiredRole === 'expert' ? '專家' : '發案者'}使用`);
            window.location.href = redirectUrl;
            return false;
        }
        return true;
    },

    /**
     * 專家頁面保護（快捷方法）
     */
    async requireExpert() {
        return await this.requireRole('expert', '/iStudio-1.0.0/client/dashboard.html');
    },

    /**
     * 發案者頁面保護（快捷方法）
     */
    async requireClient() {
        return await this.requireRole('client', '/iStudio-1.0.0/expert/dashboard.html');
    },

    /**
     * 後台頁面保護（需登入即可）
     */
    async requireAdmin() {
        return await this.requireAuth('/login.html');
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
        const roleName = profile?.role === 'expert' ? '專家' : '發案者';

        container.innerHTML = `
            <div class="dropdown">
                <a class="nav-link dropdown-toggle d-flex align-items-center" href="#" role="button" data-bs-toggle="dropdown">
                    <img src="${avatarUrl}" alt="Avatar" style="width: 35px; height: 35px; border-radius: 50%; margin-right: 10px;">
                    <span>${displayName}</span>
                    <span class="badge bg-primary ms-2">${roleName}</span>
                </a>
                <ul class="dropdown-menu dropdown-menu-end">
                    <li><a class="dropdown-item" href="${profile?.role === 'expert' ? '/iStudio-1.0.0/expert/dashboard.html' : '/iStudio-1.0.0/client/dashboard.html'}">
                        <i class="bi bi-speedometer2"></i> 我的控制台
                    </a></li>
                    <li><a class="dropdown-item" href="/iStudio-1.0.0/expert/my-listings.html" ${profile?.role !== 'expert' ? 'style="display:none;"' : ''}>
                        <i class="bi bi-list-ul"></i> 我的報價
                    </a></li>
                    <li><a class="dropdown-item" href="/iStudio-1.0.0/client/my-projects.html" ${profile?.role !== 'client' ? 'style="display:none;"' : ''}>
                        <i class="bi bi-folder"></i> 我的專案
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
