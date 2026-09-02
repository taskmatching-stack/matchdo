/**
 * Supabase Auth 配置與初始化
 * 提供全站使用的認證功能
 */

const SUPABASE_URL = 'https://uuhxyaggbrhaytmyaqmo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1aHh5YWdnYnJoYXl0bXlhcW1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxOTg2MzYsImV4cCI6MjA4NTc3NDYzNn0.vlApgjO-jC0IFa0z4MpasM4m6SwRLDrcvthOx-HwHgU';

var supabaseClient = window.__supabaseClient;
if (!supabaseClient && typeof supabase !== 'undefined') {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    window.__supabaseClient = supabaseClient;
}
if (supabaseClient && supabaseClient.auth && typeof supabaseClient.auth.onAuthStateChange === 'function') {
    supabaseClient.auth.onAuthStateChange(function (event, session) {
        if (event === 'INITIAL_SESSION' && session) {
            window.__authSessionForHeader = session;
        }
    });
}

function getSessionFromStorage() {
    try {
        if (typeof localStorage === 'undefined') return null;
        var keys = [];
        for (var i = 0; i < localStorage.length; i++) {
            var k = localStorage.key(i);
            if (k && (k.indexOf('sb-') === 0 || k.indexOf('-auth-token') !== -1)) keys.push(k);
        }
        for (var j = 0; j < keys.length; j++) {
            var raw = localStorage.getItem(keys[j]);
            if (!raw) continue;
            try {
                var data = JSON.parse(raw);
                if (data && data.current_session && data.current_session.user) return data.current_session;
                if (data && data.session && data.session.user) return data.session;
                if (data && data.user && data.access_token) return { user: data.user, access_token: data.access_token, refresh_token: data.refresh_token, expires_at: data.expires_at };
                if (data && data.user && data.current_session && data.current_session.access_token) return data.current_session;
            } catch (e2) {}
        }
        return null;
    } catch (e) {
        return null;
    }
}
window.getSessionFromStorage = getSessionFromStorage;

/** Session 是否仍有效（預設提前 120 秒視為需刷新，避免長編輯／AI 送出時剛好過期） */
function isAuthSessionFresh(session, skewSeconds) {
    if (!session || !session.access_token) return false;
    var skew = (skewSeconds != null && Number.isFinite(Number(skewSeconds))) ? Number(skewSeconds) : 120;
    var exp = session.expires_at;
    if (exp == null && session.expires_in != null && session.expires_in > 0) {
        return true;
    }
    if (exp == null) return true;
    var expMs = Number(exp) > 1e12 ? Number(exp) : Number(exp) * 1000;
    if (!Number.isFinite(expMs)) return true;
    return expMs > Date.now() + skew * 1000;
}
window.isAuthSessionFresh = isAuthSessionFresh;

async function fetchSupabaseSession(timeoutMs) {
    if (!supabaseClient || !supabaseClient.auth) return null;
    var ms = timeoutMs != null ? timeoutMs : 4000;
    try {
        var timeout = new Promise(function (_, reject) { setTimeout(function () { reject(new Error('timeout')); }, ms); });
        var out = await Promise.race([supabaseClient.auth.getSession(), timeout]);
        if (out && out.data && out.data.session) return out.data.session;
    } catch (e) { /* ignore */ }
    return null;
}

/** 並行 refresh 共用同一 Promise，避免多請求同時 refresh 互踩 refresh_token */
var __authRefreshInFlight = null;
async function refreshSupabaseSession(timeoutMs) {
    if (!supabaseClient || !supabaseClient.auth || typeof supabaseClient.auth.refreshSession !== 'function') return null;
    if (__authRefreshInFlight) {
        try { return await __authRefreshInFlight; } catch (e) { return null; }
    }
    var ms = timeoutMs != null ? timeoutMs : 15000;
    __authRefreshInFlight = (async function () {
        try {
            var timeout = new Promise(function (_, reject) { setTimeout(function () { reject(new Error('timeout')); }, ms); });
            var out = await Promise.race([supabaseClient.auth.refreshSession(), timeout]);
            if (out && out.data && out.data.session) return out.data.session;
        } catch (e) { /* ignore */ }
        return null;
    })();
    try {
        return await __authRefreshInFlight;
    } finally {
        __authRefreshInFlight = null;
    }
}

/** 分頁開啟時背景續期：勿等按儲存才發現過期 */
var __authKeepAliveTimer = null;
function ensureAuthSessionKeepAlive() {
    if (typeof document === 'undefined' || __authKeepAliveTimer) return;
    async function tick() {
        try {
            if (document.visibilityState === 'hidden') return;
            var s = await fetchSupabaseSession(4000);
            if (s && isAuthSessionFresh(s, 600)) return; // 還有 >10 分鐘則不動
            await refreshSupabaseSession(15000);
        } catch (e) { /* ignore */ }
    }
    __authKeepAliveTimer = setInterval(tick, 12 * 60 * 1000);
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') tick();
    });
    setTimeout(tick, 8000);
}
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ensureAuthSessionKeepAlive);
    } else {
        ensureAuthSessionKeepAlive();
    }
}

/**
 * 認證服務
 */
const AuthService = {
    /**
     * Google OAuth 登入
     */
    async signInWithGoogle() {
        var returnUrl = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('auth_return_url');
        if (!returnUrl) returnUrl = '/index.html';
        if (sessionStorage) sessionStorage.setItem('auth_return_url', returnUrl);
        const { data, error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin + '/auth-callback.html'
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
                emailRedirectTo: window.location.origin + '/auth-callback.html'
            }
        });

        if (error) {
            console.error('Email 註冊失敗:', error);
            throw error;
        }
        return data;
    },

    /**
     * 發送密碼重設信（會寄到該 email，含重設連結）
     * 若連線逾時會拋錯，避免按鈕一直轉圈。
     */
    async resetPasswordForEmail(email) {
        var redirectTo = window.location.origin + '/reset-password.html';
        try {
            var timeout = new Promise(function (_, reject) { setTimeout(function () { reject(new Error('連線逾時，請檢查網路或稍後再試')); }, 15000); });
            var result = await Promise.race([
                supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: redirectTo }),
                timeout
            ]);
            if (result && result.error) throw result.error;
            return result;
        } catch (e) {
            console.error('重設密碼發送失敗:', e);
            throw e;
        }
    },

    hasGoogleIdentity: function (user) {
        var ids = (user && user.identities) || [];
        for (var i = 0; i < ids.length; i++) {
            if (ids[i] && ids[i].provider === 'google') return true;
        }
        return false;
    },

    hasEmailIdentity: function (user) {
        var ids = (user && user.identities) || [];
        for (var i = 0; i < ids.length; i++) {
            if (ids[i] && ids[i].provider === 'email') return true;
        }
        return false;
    },

    async updatePassword(newPassword) {
        if (!supabaseClient || !supabaseClient.auth) throw new Error('尚未載入登入服務');
        const { data, error } = await supabaseClient.auth.updateUser({ password: newPassword });
        if (error) throw error;
        return data;
    },

    /**
     * 僅清除本地 session（不導向）。用於 token 無效時讓畫面與狀態一致，避免顯示「已登入」卻 API 回 401。
     */
    clearLocalSession() {
        try {
            if (typeof localStorage !== 'undefined') {
                var keys = [];
                for (var i = 0; i < localStorage.length; i++) {
                    var k = localStorage.key(i);
                    if (k && (k.indexOf('sb-') === 0 || k.indexOf('-auth-token') !== -1)) keys.push(k);
                }
                for (var j = 0; j < keys.length; j++) localStorage.removeItem(keys[j]);
            }
        } catch (e) {}
    },

    /**
     * 登出：先清除本地 session，再導向（不等待 API，前後台都能登出）
     */
    signOut() {
        try {
            if (typeof localStorage !== 'undefined') {
                var keys = [];
                for (var i = 0; i < localStorage.length; i++) {
                    var k = localStorage.key(i);
                    if (k && (k.indexOf('sb-') === 0 || k.indexOf('-auth-token') !== -1)) keys.push(k);
                }
                for (var j = 0; j < keys.length; j++) localStorage.removeItem(keys[j]);
            }
            if (supabaseClient && supabaseClient.auth) supabaseClient.auth.signOut().catch(function () {});
        } catch (e) {}
        var isAdmin = typeof window !== 'undefined' && window.location && window.location.pathname.indexOf('/admin') === 0;
        window.location.href = isAdmin ? '/login.html' : '/index.html';
    },

    /**
     * 取得當前用戶（無 session 時不拋錯，回傳 null）
     */
    async getCurrentUser() {
        try {
            var session = await this.getSession();
            return session ? session.user : null;
        } catch (e) {
            return null;
        }
    },

    /**
     * 取得當前 Session。
     * 本地有「未過期」session 時快速回傳；已過期／即將過期則走 Supabase 刷新，避免拿舊 token 打 API。
     */
    async getSession() {
        var fromStorage = getSessionFromStorage();
        if (fromStorage && isAuthSessionFresh(fromStorage, 120)) return fromStorage;
        var fromSdk = await fetchSupabaseSession(fromStorage ? 4000 : 2000);
        if (fromSdk && isAuthSessionFresh(fromSdk, 120)) return fromSdk;
        if ((fromStorage && !isAuthSessionFresh(fromStorage, 120)) || (fromSdk && !isAuthSessionFresh(fromSdk, 120))) {
            var refreshed = await refreshSupabaseSession(15000);
            if (refreshed) return refreshed;
        }
        if (fromSdk && isAuthSessionFresh(fromSdk, 0)) return fromSdk;
        if (fromStorage && isAuthSessionFresh(fromStorage, 0)) return fromStorage;
        return fromSdk || fromStorage || null;
    },

    /**
     * 取得 Session 供打 API／AI 用：優先刷新有效 token。
     * 绝不回傳「已知已過期」的 token（避免編輯中途才出現「登入已過期或無效」）。
     */
    async getSessionForApi() {
        var fromSdk = await fetchSupabaseSession(4000);
        if (fromSdk && isAuthSessionFresh(fromSdk, 180)) return fromSdk;
        var refreshed = await refreshSupabaseSession(15000);
        if (refreshed && isAuthSessionFresh(refreshed, 0)) return refreshed;
        if (fromSdk && isAuthSessionFresh(fromSdk, 0)) return fromSdk;
        var fromStorage = getSessionFromStorage();
        if (fromStorage && isAuthSessionFresh(fromStorage, 60)) return fromStorage;
        if (fromStorage && !isAuthSessionFresh(fromStorage, 0)) {
            refreshed = await refreshSupabaseSession(15000);
            if (refreshed && isAuthSessionFresh(refreshed, 0)) return refreshed;
            return null;
        }
        if (fromStorage && isAuthSessionFresh(fromStorage, 0)) return fromStorage;
        return null;
    },

    /**
     * 監聽認證狀態變化
     */
    onAuthStateChange(callback) {
        if (!supabaseClient || !supabaseClient.auth || typeof supabaseClient.auth.onAuthStateChange !== 'function') {
            return { data: { subscription: { unsubscribe: function () {} } } };
        }
        return supabaseClient.auth.onAuthStateChange(function (event, session) {
            callback(event, session);
        });
    },

    /**
     * 取得用戶完整資料（含角色），整段最多等 5 秒，避免卡住
     */
    async getUserProfile() {
        var timeoutMs = 5000;
        var timeoutPromise = new Promise(function (_, reject) {
            setTimeout(function () { reject(new Error('getUserProfile_timeout')); }, timeoutMs);
        });
        var work = (function (self) {
            return async function () {
                try {
                    var session = await self.getSessionForApi();
                    var user = session ? session.user : null;
                    if (!user) return null;
                    if (session && session.access_token) {
                        try {
                            var res = await fetch('/api/me/profile', {
                                headers: { Authorization: 'Bearer ' + session.access_token }
                            });
                            if (res && res.ok) {
                                var profile = await res.json();
                                if (profile && (profile.id || profile.email !== undefined)) return profile;
                            }
                        } catch (e) {}
                    }
                    if (!supabaseClient || !supabaseClient.auth) return null;
                    var _p = await supabaseClient.from('profiles').select('*').eq('id', user.id).maybeSingle();
                    if (!_p.error && _p.data) return _p.data;
                    var email = (user.email || '').trim().toLowerCase();
                    if (email) {
                        var _pe = await supabaseClient.from('profiles').select('*').eq('email', email).maybeSingle();
                        if (!_pe.error && _pe.data) return Object.assign({}, _pe.data, { id: user.id });
                    }
                    var _u = await supabaseClient.from('users').select('*, experts_profile(*)').eq('id', user.id).single();
                    if (!_u.error && _u.data) return _u.data;
                    return null;
                } catch (e) {
                    return null;
                }
            };
        })(this);
        try {
            return await Promise.race([work(), timeoutPromise]);
        } catch (e) {
            return null;
        }
    },

    /**
     * 建立/更新用戶資料（首次登入時使用）
     */
    async createOrUpdateUser(userId, userData = {}) {
        try {
            var out = await supabaseClient
                .from('users')
                .upsert({
                    id: userId,
                    profile_completed: true,
                    ...userData
                })
                .select()
                .single();
            if (out.error) {
                var isAbort = out.error.message && String(out.error.message).indexOf('aborted') !== -1;
                if (!isAbort) console.error('更新用戶資料失敗:', out.error);
                return null;
            }
            return out.data;
        } catch (e) {
            if (e && (e.name === 'AbortError' || (e.message && String(e.message).indexOf('aborted') !== -1))) return null;
            console.error('更新用戶資料失敗:', e && e.message);
            throw e;
        }
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
     * 檢查用戶是否為測試員或管理員（可進入 Playground / AI 工具）
     */
    async isTesterOrAdmin() {
        const user = await this.getCurrentUser();
        if (!user) return false;
        if (user.user_metadata?.role === 'admin' || user.user_metadata?.role === 'tester') return true;
        const { data: profile } = await supabaseClient
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
        return profile?.role === 'admin' || profile?.role === 'tester';
    },

    /**
     * 檢查用戶是否為專家（承包商）— Phase 1.7 專家頁面權限
     */
    async isExpert() {
        const user = await this.getCurrentUser();
        if (!user) return false;
        if (user.user_metadata?.role === 'expert' || user.user_metadata?.role === 'admin') return true;
        const { data: profile } = await supabaseClient
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
        return profile?.role === 'expert' || profile?.role === 'admin';
    },

    /**
     * 檢查用戶是否為發案者 — Phase 1.7 發案者頁面權限
     */
    async isClient() {
        const user = await this.getCurrentUser();
        if (!user) return false;
        if (user.user_metadata?.role === 'client' || user.user_metadata?.role === 'admin') return true;
        const { data: profile } = await supabaseClient
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
        return profile?.role === 'client' || profile?.role === 'admin';
    },

    /**
     * 暴露 Supabase 客戶端供其他功能使用
     */
    get supabase() {
        return supabaseClient;
    },

    /**
     * 取得登入頁網址（帶 returnUrl，全站導向登入時使用，登入後可回原頁）
     */
    getLoginUrl(returnPath) {
        var path = (returnPath != null && returnPath !== '') ? returnPath : (typeof window !== 'undefined' && window.location ? (window.location.pathname || '') + (window.location.search || '') : '');
        if (!path || path === '/login.html') path = '/index.html';
        return '/login.html?returnUrl=' + encodeURIComponent(path);
    }
};

// 暴露到全域
window.AuthService = AuthService;
window.supabaseClient = supabaseClient;
