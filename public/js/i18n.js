/**
 * 前台多語系（僅前台，/admin/ 不納入）
 * 使用方式：頁面載入後 loadLocale → applyPage；導覽由 site-header 用 t() 輸出。
 * 語系優先序：URL ?lang= → localStorage（使用者手動切換）→ 瀏覽器語系（非中文/簡中→en）→ zh-TW。
 */
(function () {
    var STORAGE_KEY = 'lang';
    var DEFAULT_LANG = 'zh-TW';
    var messages = {};
    var readyPromise = null;

    function isChineseLocale(tag) {
        if (!tag || typeof tag !== 'string') return false;
        var l = tag.trim().toLowerCase().replace(/_/g, '-');
        if (l === 'zh') return true;
        return l.indexOf('zh-') === 0;
    }

    function detectBrowserLang() {
        try {
            var list = (navigator.languages && navigator.languages.length)
                ? navigator.languages
                : [navigator.language || navigator.userLanguage || ''];
            for (var i = 0; i < list.length; i++) {
                if (isChineseLocale(list[i])) return DEFAULT_LANG;
            }
        } catch (e) { /* ignore */ }
        return 'en';
    }

    function normalizeLang(lang) {
        if (!lang || typeof lang !== 'string') return DEFAULT_LANG;
        var l = lang.trim().toLowerCase().replace(/_/g, '-');
        if (l === 'en' || l.indexOf('en-') === 0) return 'en';
        if (isChineseLocale(l)) return DEFAULT_LANG;
        return 'en';
    }

    function getLang() {
        var path = (typeof window !== 'undefined' && window.location && window.location.pathname) ? window.location.pathname : '';
        if (path.indexOf('/admin/') !== -1) return DEFAULT_LANG;
        var params = typeof window !== 'undefined' && window.location && window.location.search
            ? new URLSearchParams(window.location.search) : null;
        if (params && params.get('lang')) return normalizeLang(params.get('lang'));
        try {
            var stored = localStorage.getItem(STORAGE_KEY);
            if (stored) return normalizeLang(stored);
        } catch (e) {}
        /* 版型列表 SSR 預設中文：勿因瀏覽器英文語系把選單翻成英文 */
        if (typeof window !== 'undefined' && window.__MATCHDO_BROWSE_DEFAULT_ZH__) return DEFAULT_LANG;
        return detectBrowserLang();
    }

    function setLang(lang) {
        lang = normalizeLang(lang);
        try {
            localStorage.setItem(STORAGE_KEY, lang);
        } catch (e) {}
        var search = (window.location.search || '').replace(/\?lang=[^&]+&?|&?lang=[^&]+/g, '').replace(/^\?&/, '');
        var url = window.location.pathname + (search || '');
        url += (url.indexOf('?') === -1 ? '?' : '&') + 'lang=' + encodeURIComponent(lang);
        window.location.href = url;
    }

    function syncDocumentLang(lang) {
        if (typeof document === 'undefined') return;
        try {
            document.documentElement.lang = (normalizeLang(lang) === 'en') ? 'en' : 'zh-TW';
        } catch (e) { /* ignore */ }
    }

    var LOCALE_CACHE_V = '20260903-auth-dual';

    function loadLocale(lang) {
        lang = lang || getLang();
        syncDocumentLang(lang);
        if (readyPromise && window.__I18N__ && window.__I18N__.lang === lang) return readyPromise;
        var localeUrl = '/locales/' + lang + '.json';
        try {
            var verMeta = document.querySelector('meta[name="matchdo-asset-version"]');
            var ver = verMeta && verMeta.content ? String(verMeta.content).trim() : LOCALE_CACHE_V;
            if (ver) localeUrl += (localeUrl.indexOf('?') === -1 ? '?' : '&') + 'v=' + encodeURIComponent(ver);
        } catch (e) { /* ignore */ }
        readyPromise = fetch(localeUrl)
            .then(function (r) {
                if (!r.ok) throw new Error('locale not found');
                return r.json();
            })
            .then(function (data) {
                messages = data;
                window.__I18N__ = { lang: lang, messages: messages };
                syncDocumentLang(lang);
                return messages;
            })
            .catch(function () {
                if (lang !== DEFAULT_LANG) return loadLocale(DEFAULT_LANG);
                window.__I18N__ = { lang: DEFAULT_LANG, messages: {} };
                return {};
            });
        return readyPromise;
    }

    function t(key) {
        var m = window.__I18N__ && window.__I18N__.messages ? window.__I18N__.messages : messages;
        return (m && m[key]) || key;
    }

    function applyPage() {
        var m = window.__I18N__ && window.__I18N__.messages ? window.__I18N__.messages : messages;
        if (!m || !Object.keys(m).length) return;
        document.querySelectorAll('[data-i18n]').forEach(function (el) {
            var key = el.getAttribute('data-i18n');
            if (m[key]) el.textContent = m[key];
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
            var key = el.getAttribute('data-i18n-placeholder');
            if (m[key]) el.placeholder = m[key];
        });
        document.querySelectorAll('[data-i18n-title]').forEach(function (el) {
            var key = el.getAttribute('data-i18n-title');
            if (m[key]) el.title = m[key];
        });
        document.querySelectorAll('[data-i18n-alt]').forEach(function (el) {
            var key = el.getAttribute('data-i18n-alt');
            if (m[key]) el.alt = m[key];
        });
        document.querySelectorAll('[data-i18n-aria-label]').forEach(function (el) {
            var key = el.getAttribute('data-i18n-aria-label');
            if (m[key]) el.setAttribute('aria-label', m[key]);
        });
        document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
            var key = el.getAttribute('data-i18n-html');
            if (m[key]) el.innerHTML = m[key];
        });
        document.querySelectorAll('[data-i18n-meta-desc]').forEach(function (el) {
            var key = el.getAttribute('data-i18n-meta-desc');
            if (m[key]) el.setAttribute('content', m[key]);
        });
        document.querySelectorAll('[data-i18n-doc-title]').forEach(function (el) {
            var key = el.getAttribute('data-i18n-doc-title');
            if (m[key]) document.title = m[key];
        });
    }

    window.__matchdoLangDetect = {
        isChineseLocale: isChineseLocale,
        detectBrowserLang: detectBrowserLang,
        normalizeLang: normalizeLang
    };

    window.i18n = {
        getLang: getLang,
        setLang: setLang,
        loadLocale: loadLocale,
        t: t,
        applyPage: applyPage,
        ready: null
    };

    window.i18n.ready = loadLocale(getLang());
})();
