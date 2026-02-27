// AuthService - 統一認證服務
// 提供 Supabase 認證功能的封裝

const SUPABASE_URL = 'https://bqxqetlcsdthqlmyxcpb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxeHFldGxjc2R0aHFsbXl4Y3BiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc5NDI5OTIsImV4cCI6MjA1MzUxODk5Mn0.Z0KI5MZL7wQFiCbMxKBWUGbCwQNxMU7AhKfj8KpN9QU';

class AuthService {
    constructor() {
        this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }

    // 取得當前用戶
    async getCurrentUser() {
        const { data: { user }, error } = await this.supabase.auth.getUser();
        if (error) {
            console.error('取得用戶失敗:', error);
            return null;
        }
        return user;
    }

    // 取得 Session
    async getSession() {
        const { data: { session }, error } = await this.supabase.auth.getSession();
        if (error) {
            console.error('取得 Session 失敗:', error);
            return null;
        }
        return session;
    }

    // Email 登入
    async signInWithEmail(email, password) {
        const { data, error } = await this.supabase.auth.signInWithPassword({
            email,
            password
        });
        if (error) throw error;
        return data;
    }

    // Email 註冊
    async signUpWithEmail(email, password, metadata = {}) {
        const { data, error } = await this.supabase.auth.signUp({
            email,
            password,
            options: {
                data: metadata
            }
        });
        if (error) throw error;
        return data;
    }

    // Google 登入
    async signInWithGoogle() {
        const { data, error } = await this.supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin
            }
        });
        if (error) throw error;
        return data;
    }

    // 登出
    async signOut() {
        const { error } = await this.supabase.auth.signOut();
        if (error) throw error;
    }

    // 取得用戶資料（含 profile）
    async getUserProfile() {
        const user = await this.getCurrentUser();
        if (!user) return null;

        try {
            const { data, error } = await this.supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (error) {
                console.error('取得 profile 失敗:', error);
                return { ...user, role: 'user' };
            }

            return { ...user, ...data };
        } catch (error) {
            console.error('getUserProfile 錯誤:', error);
            return { ...user, role: 'user' };
        }
    }

    // 檢查是否為管理員
    async isAdmin() {
        const profile = await this.getUserProfile();
        return profile?.role === 'admin';
    }
}

// 建立全域實例
const authService = new AuthService();

// 導出為 ES Module
export { authService as AuthService };

// 同時支援全域變數（向後相容）
if (typeof window !== 'undefined') {
    window.AuthService = authService;
}
