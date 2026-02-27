/* ========================================
   MatchDO 後台導航整理
   管理員後台 vs 會員後台 清楚分離
   ======================================== */

const SiteNavigation = {
    // 🏠 公開頁面（無需登入）
    public: {
        home: '/',
        login: '/login.html',
        register: '/register.html',
        about: '/about.html',
        contact: '/contact.html'
    },
    
    // ⭐ 管理員後台（需要 admin 權限）
    admin: {
        dashboard: '/admin/index.html',
        users: '/admin/user-management.html',
        categories: '/admin/categories.html',
        categoryImages: '/admin/category-images.html',
        // 未來可能新增
        systemSettings: '/admin/settings.html',
        logs: '/admin/logs.html'
    },
    
    // 👤 客戶後台（發案者）
    client: {
        dashboard: '/client/dashboard.html',
        myProjects: '/client/my-projects.html',
        projectDetail: '/client/project-detail.html', // + ?id=xxx
        projectItems: '/client/project-items.html', // + ?projectId=xxx
        myCustomProducts: '/client/my-custom-products.html',
        // 未來可能新增
        messages: '/client/messages.html',
        contacts: '/client/contacts.html'
    },
    
    // 🔧 專家後台（接案者）
    expert: {
        dashboard: '/expert/dashboard.html',
        myListings: '/expert/my-listings.html',
        matchedProjects: '/expert/matched-projects.html',
        listingDetail: '/expert/listing-detail.html', // + ?id=xxx
        // 未來可能新增
        earnings: '/expert/earnings.html',
        portfolio: '/expert/portfolio.html'
    },
    
    // 🎨 客製產品（共用）
    customProduct: {
        create: '/custom-product.html',
        myProducts: '/client/my-custom-products.html',
        browse: '/custom-products-browse.html' // 未來：瀏覽所有產品
    }
};

// 選單生成器
class NavigationBuilder {
    constructor() {
        this.currentUser = null;
        this.isAdmin = false;
        this.isTesterOrAdmin = false;
    }
    
    async init() {
        if (!window.AuthService) return;
        try {
            const r = await fetch('/api/public-config');
            const j = await r.json();
            this.publicConfig = j;
        } catch (e) {
            this.publicConfig = { enableServiceMatching: true };
        }
        this.currentUser = await AuthService.getCurrentUser();
        if (this.currentUser) {
            this.isAdmin = await AuthService.isAdmin();
            this.isTesterOrAdmin = await (AuthService.isTesterOrAdmin && AuthService.isTesterOrAdmin()) || this.isAdmin;
        }
    }
    
    // 取得導航選單項目
    getMenuItems() {
        const items = [];
        
        // 首頁
        items.push({
            label: '首頁',
            url: SiteNavigation.public.home,
            icon: 'fas fa-home'
        });
        
        if (!this.currentUser) {
            // 未登入：顯示登入/註冊
            items.push(
                {
                    label: '登入',
                    url: SiteNavigation.public.login,
                    icon: 'fas fa-sign-in-alt'
                },
                {
                    label: '註冊',
                    url: SiteNavigation.public.register,
                    icon: 'fas fa-user-plus'
                }
            );
        } else {
            // 已登入：顯示功能選單（服務媒合關閉時不顯示發案/專家區塊）
            const enableServiceMatching = (this.publicConfig && this.publicConfig.enableServiceMatching !== false);
            if (enableServiceMatching) {
                // 👤 客戶功能（發案）
                items.push({
                    label: '我的專案',
                    icon: 'fas fa-project-diagram',
                    submenu: [
                        {
                            label: '發案控制台',
                            url: SiteNavigation.client.dashboard,
                            icon: 'fas fa-tachometer-alt'
                        },
                        {
                            label: '我的專案',
                            url: SiteNavigation.client.myProjects,
                            icon: 'fas fa-list'
                        },
                        {
                            label: '我的數位資產',
                            url: SiteNavigation.client.myCustomProducts,
                            icon: 'fas fa-images'
                        }
                    ]
                });
                // 🔧 專家功能（接案）
                items.push({
                    label: '專家服務',
                    icon: 'fas fa-tools',
                    submenu: [
                        {
                            label: '專家控制台',
                            url: SiteNavigation.expert.dashboard,
                            icon: 'fas fa-tachometer-alt'
                        },
                        {
                            label: '我的報價',
                            url: SiteNavigation.expert.myListings,
                            icon: 'fas fa-tags'
                        },
                        {
                            label: '媒合專案',
                            url: SiteNavigation.expert.matchedProjects,
                            icon: 'fas fa-handshake'
                        }
                    ]
                });
            } else {
                // 僅顯示數位資產入口
                items.push({
                    label: '我的數位資產',
                    url: SiteNavigation.client.myCustomProducts,
                    icon: 'fas fa-images'
                });
            }
            
            // ⭐ 測試員／管理員功能（Playground、AI 工具；管理員另見完整後台）
            if (this.isTesterOrAdmin) {
                const testerSubmenu = [
                    { label: 'Playground', url: '/admin/playground.html', icon: 'fas fa-brush' },
                    { label: 'AI 工具', url: '/admin/ai-tools.html', icon: 'fas fa-magic' }
                ];
                if (this.isAdmin) {
                    testerSubmenu.push(
                        { label: '管理控制台', url: SiteNavigation.admin.dashboard, icon: 'fas fa-shield-alt' },
                        { label: '用戶管理', url: SiteNavigation.admin.users, icon: 'fas fa-users' },
                        { label: '分類管理', url: SiteNavigation.admin.categories, icon: 'fas fa-sitemap' },
                        { label: '分類圖片', url: SiteNavigation.admin.categoryImages, icon: 'fas fa-images' }
                    );
                }
                items.push({
                    label: this.isAdmin ? '管理功能' : '測試員功能',
                    icon: 'fas fa-cog',
                    className: (this.isAdmin ? 'text-danger fw-bold' : ''),
                    submenu: testerSubmenu
                });
            }
            
            // 登出
            items.push({
                label: '登出',
                url: '#',
                icon: 'fas fa-sign-out-alt',
                onClick: 'handleLogout()'
            });
        }
        
        return items;
    }
    
    // 產生 HTML
    generateHTML() {
        const items = this.getMenuItems();
        let html = '<ul class="navbar-nav ms-auto">';
        
        items.forEach(item => {
            if (item.submenu) {
                // 下拉選單
                html += `
                    <li class="nav-item dropdown ${item.className || ''}">
                        <a class="nav-link dropdown-toggle" href="#" role="button" 
                           data-bs-toggle="dropdown" aria-expanded="false">
                            <i class="${item.icon} me-1"></i>${item.label}
                        </a>
                        <ul class="dropdown-menu">
                            ${item.submenu.map(sub => `
                                <li>
                                    <a class="dropdown-item" href="${sub.url}">
                                        <i class="${sub.icon} me-2"></i>${sub.label}
                                    </a>
                                </li>
                            `).join('')}
                        </ul>
                    </li>
                `;
            } else {
                // 一般連結
                html += `
                    <li class="nav-item">
                        <a class="nav-link" href="${item.url}" 
                           ${item.onClick ? `onclick="${item.onClick}; return false;"` : ''}>
                            <i class="${item.icon} me-1"></i>${item.label}
                        </a>
                    </li>
                `;
            }
        });
        
        html += '</ul>';
        return html;
    }
}

// 登出處理
async function handleLogout() {
    if (!confirm('確定要登出嗎？')) return;
    
    try {
        await AuthService.logout();
        alert('✅ 已登出');
        window.location.href = '/';
    } catch (error) {
        console.error('登出失敗:', error);
        alert('❌ 登出失敗');
    }
}

// 初始化導航（在 HTML 中使用）
async function initNavigation() {
    const navBuilder = new NavigationBuilder();
    await navBuilder.init();
    
    const navContainer = document.getElementById('mainNavigation');
    if (navContainer) {
        navContainer.innerHTML = navBuilder.generateHTML();
    }
    
    return navBuilder;
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SiteNavigation, NavigationBuilder };
}
