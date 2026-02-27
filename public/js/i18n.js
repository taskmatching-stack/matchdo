/**
 * 前台多語系（僅前台，/admin/ 不納入）
 * 使用方式：頁面載入後 loadLocale → applyPage；導覽由 site-header 用 t() 輸出。
 * 語系：URL ?lang=en 優先，其次 localStorage 'lang'，預設 zh-TW。
 */
(function () {
    var STORAGE_KEY = 'lang';
    var DEFAULT_LANG = 'zh-TW';
    var messages = {};
    var readyPromise = null;

    function normalizeLang(lang) {
        if (!lang || typeof lang !== 'string') return DEFAULT_LANG;
        var l = lang.trim().toLowerCase();
        if (l === 'zh' || l === 'zh-tw' || l === 'zh_tw') return 'zh-TW';
        if (l === 'en') return 'en';
        return lang;
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
        return DEFAULT_LANG;
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

    function loadLocale(lang) {
        lang = lang || getLang();
        if (readyPromise && window.__I18N__ && window.__I18N__.lang === lang) return readyPromise;
        readyPromise = fetch('/locales/' + lang + '.json')
            .then(function (r) {
                if (!r.ok) throw new Error('locale not found');
                return r.json();
            })
            .then(function (data) {
                messages = data;
                window.__I18N__ = { lang: lang, messages: messages };
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
    }

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
