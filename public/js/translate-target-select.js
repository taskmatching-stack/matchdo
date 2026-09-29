/**
 * 共用：翻譯目標語下拉（對話、訂製需求等）。
 * 依 GET /api/translation/target-languages；選擇寫入 localStorage。
 */
(function (global) {
    'use strict';

    var DEFAULT_STORAGE_KEY = 'matchdo.translateTargetLang';

    function escapeHtml(s) {
        var d = document.createElement('div');
        d.textContent = s == null ? '' : s;
        return d.innerHTML;
    }

    function getUiLocale() {
        return (global.i18n && global.i18n.getLang) ? global.i18n.getLang() : 'zh-TW';
    }

    function resolveSelect(elOrId) {
        if (!elOrId) return null;
        if (typeof elOrId === 'string') return document.getElementById(elOrId);
        return elOrId;
    }

    /**
     * @param {{ selectEl?: HTMLElement, selectId?: string, storageKey?: string }} opts
     */
    async function mountTranslateTargetSelect(opts) {
        var sel = resolveSelect(opts && (opts.selectEl || opts.selectId));
        if (!sel) return;
        var storageKey = (opts && opts.storageKey) || DEFAULT_STORAGE_KEY;
        var saved = '';
        try { saved = localStorage.getItem(storageKey) || ''; } catch (e) { /* ignore */ }
        var uiLang = getUiLocale();
        try {
            var res = await fetch('/api/translation/target-languages?lang=' + encodeURIComponent(uiLang));
            var data = await res.json();
            var items = (data && data.items) ? data.items : [];
            var def = (data && data.default) ? data.default : 'en';
            sel.innerHTML = items.map(function (it) {
                return '<option value="' + escapeHtml(it.code) + '">' + escapeHtml(it.label || it.code) + '</option>';
            }).join('');
            var pick = saved || def;
            if (pick && sel.querySelector('option[value="' + String(pick).replace(/"/g, '') + '"]')) sel.value = pick;
            else if (def) sel.value = def;
        } catch (e) {
            sel.innerHTML = '<option value="zh-TW">繁體中文</option><option value="en">English</option>';
            if (saved) sel.value = saved;
        }
        if (!sel.__matchdoTranslateTargetWired) {
            sel.__matchdoTranslateTargetWired = true;
            sel.addEventListener('change', function () {
                try { localStorage.setItem(storageKey, sel.value); } catch (err) { /* ignore */ }
            });
        }
    }

    function getTranslateTargetValue(elOrId, storageKey) {
        var sel = resolveSelect(elOrId);
        if (sel && sel.value) return sel.value;
        var key = storageKey || DEFAULT_STORAGE_KEY;
        try {
            var saved = localStorage.getItem(key);
            if (saved) return saved;
        } catch (e) { /* ignore */ }
        return 'en';
    }

    global.MatchdoTranslateTargetSelect = {
        DEFAULT_STORAGE_KEY: DEFAULT_STORAGE_KEY,
        mount: mountTranslateTargetSelect,
        getValue: getTranslateTargetValue
    };
})(typeof window !== 'undefined' ? window : global);
