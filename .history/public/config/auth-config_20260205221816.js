/**
 * Supabase Auth 配置與初始化
 * 提供全站使用的認證功能
 */

const SUPABASE_URL = 'https://uuhxyaggbrhaytmyaqmo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1aHh5YWdnYnJoYXl0bXlhcW1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxOTg2MzYsImV4cCI6MjA4NTc3NDYzNn0.vlApgjO-jC0IFa0z4MpasM4m6SwRLDrcvthOx-HwHgU';

// 初始化 Supabase 客戶端
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * 認證服務
 */
const AuthService = {
    /**
     * Google OAuth 登入
     */
    async signInWithGoogle() {
        const { data, error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/index.html`
            }
        });

        if (error) {
            console.error('Google 登入失敗:', error);
            throw error;
        }
        return data;
    },

    /**
     * Email/密碼登入（備用）
     */
    async signInWithEmail(email, password) {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            console.error('Email 登入失敗:', error);
            throw error;
        }
        return data;
    },

    /**
     * Email/密碼註冊（備用）
     */
    async signUpWithEmail(email, password) {
        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: `${window.location.origin}/index.html`
            }
        });

        if (error) {
            console.error('Email 註冊失敗:', error);
            throw error;
        }
        return data;
    },

    /**
     * 登出
     */
    async signOut() {
        const { error } = await supabaseClient.auth.signOut();
        if (error) {
            console.error('登出失敗:', error);
            throw error;
        }
        window.location.href = '/iStudio-1.0.0/index.html';
    },

    /**
     * 取得當前用戶
     */
    async getCurrentUser() {
        const { data: { user }, error } = await supabaseClient.auth.getUser();
        if (error) {
            console.error('取得用戶失敗:', error);
            return null;
        }
        return user;
    },

    /**
     * 取得當前 Session
     */
    async getSession() {
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        if (error) {
            console.error('取得 Session 失敗:', error);
            return null;
        }
        return session;
    },

    /**
     * 監聽認證狀態變化
     */
    onAuthStateChange(callback) {
        return supabaseClient.auth.onAuthStateChange((event, session) => {
            callback(event, session);
        });
    },

    /**
     * 取得用戶完整資料（含角色）
     */
    async getUserProfile() {
        const user = await this.getCurrentUser();
        if (!user) return null;

        // 先嘗試從 profiles 表取得
        const { data: profile, error: profileError } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (!profileError && profile) {
            return profile;
        }

        // 如果 profiles 表沒有，嘗試 users 表
        const { data, error } = await supabaseClient
            .from('users')
            .select('*, experts_profile(*)')
            .eq('id', user.id)
            .single();

        if (error) {
            console.error('取得用戶資料失敗:', error);
            return null;
        }
        return data;
    },

    /**
     * 建立/更新用戶資料（首次登入時使用）
     */
    async createOrUpdateUser(userId, userData = {}) {
        const { data, error } = await supabaseClient
            .from('users')
            .upsert({
                id: userId,
                profile_completed: true,
                ...userData
            })
            .select()
            .single();

        if (error) {
            console.error('更新用戶資料失敗:', error);
            throw error;
        }
        return data;
    },

    /**
     * 建立專家檔案
     */
    async createExpertProfile(userId, profileData) {
        const { data, error } = await supabaseClient
            .from('experts_profile')
            .insert({
                user_id: userId,
                ...profileData
            })
            .select()
            .single();

        if (error) {
            console.error('建立專家檔案失敗:', error);
            throw error;
        }
        return data;
    },

    /**
     * 檢查用戶是否已完成註冊
     */
    async isProfileCompleted() {
        const profile = await this.getUserProfile();
        return profile && profile.profile_completed;
    },

    /**
     * 取得當前用戶（舊版相容方法）
     */
    async getUser() {
        return await supabaseClient.auth.getUser();
    },
    
    /**
     * 檢查用戶是否為管理員
     */
    async isAdmin() {
        const user = await this.getCurrentUser();
        if (!user) return false;
        
        // 檢查 user_metadata 中的 role
        if (user.user_metadata?.role === 'admin') {
            return true;
        }
        
        // 檢查 profiles 表中的 role
        const { data: profile } = await supabaseClient
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
        
        return profile?.role === 'admin';
    },

    /**
     * 暴露 Supabase 客戶端供其他功能使用
     */
    get supabase() {
        return supabaseClient;
    }
};

// 暴露到全域
window.AuthService = AuthService;
window.supabaseClient = supabaseClient;
