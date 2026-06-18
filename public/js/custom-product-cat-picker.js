/**
 * 訂製品主／子分類選單（與產品設計頁相同資料來源與 UI）
 * GET /api/custom-product-categories
 */
(function (global) {
    'use strict';

    var categoriesData = [];
    var config = {};
    var mainListEl, subListEl, mainHiddenEl, subHiddenEl;

    function tKey(key, fb) {
        if (typeof global.i18n !== 'undefined' && typeof global.i18n.t === 'function') {
            var v = global.i18n.t(key);
            if (v && v !== key) return v;
        }
        return fb || key;
    }

    function categoryDisplayName(key, fallback) {
        if (!key) return fallback || '';
        var k = 'category.' + String(key);
        return tKey(k, fallback || key || '');
    }

    function getValues() {
        return {
            mainKey: (mainHiddenEl && mainHiddenEl.value) ? String(mainHiddenEl.value).trim() : '',
            subKey: (subHiddenEl && subHiddenEl.value) ? String(subHiddenEl.value).trim() : ''
        };
    }

    function fireChange() {
        if (typeof config.onChange === 'function') config.onChange(getValues());
        try {
            document.dispatchEvent(new CustomEvent('matchdo:categoryChanged', { detail: getValues() }));
        } catch (e) { /* ignore */ }
    }

    function updateSubList(mainKeyFromClick) {
        if (!subListEl || !subHiddenEl) return;
        var mainKey = mainKeyFromClick != null ? mainKeyFromClick : (mainHiddenEl ? mainHiddenEl.value : '');
        subListEl.classList.remove('empty');
        subListEl.innerHTML = '';
        subHiddenEl.value = '';
        if (!mainKey) {
            subListEl.classList.add('empty');
            subListEl.textContent = tKey('customProduct.selectMainFirst', '請先選左側主分類');
            fireChange();
            return;
        }
        var cat = categoriesData.find(function (c) {
            return (c.key != null ? String(c.key) : '') === String(mainKey);
        });
        if (!cat || !cat.subcategories || !cat.subcategories.length) {
            subListEl.classList.add('empty');
            subListEl.textContent = tKey('customProduct.noSubcategory', '此主分類尚無子分類');
            fireChange();
            return;
        }
        cat.subcategories.forEach(function (sub) {
            var subKey = (sub.key != null && sub.key !== '') ? String(sub.key) : '';
            var subDisplayName = categoryDisplayName(subKey, sub.name || sub.key);
            var opt = document.createElement('div');
            opt.className = 'cat-option';
            opt.setAttribute('role', 'option');
            opt.setAttribute('tabindex', '0');
            opt.setAttribute('data-key', subKey);
            opt.textContent = subDisplayName;
            opt.addEventListener('click', function () {
                subListEl.querySelectorAll('.cat-option').forEach(function (el) { el.classList.remove('selected'); });
                opt.classList.add('selected');
                subHiddenEl.value = subKey;
                fireChange();
            });
            subListEl.appendChild(opt);
        });
        var first = subListEl.querySelector('.cat-option');
        if (first) {
            first.classList.add('selected');
            subHiddenEl.value = first.getAttribute('data-key') || '';
        }
        fireChange();
    }

    function selectMain(mainKey, subKey) {
        if (!mainListEl || !mainHiddenEl) return;
        mainListEl.querySelectorAll('.cat-option').forEach(function (el) { el.classList.remove('selected'); });
        var esc = mainKey.replace(/"/g, '\\"');
        var mainOpt = mainListEl.querySelector('.cat-option[data-key="' + esc + '"]');
        if (mainOpt) mainOpt.classList.add('selected');
        mainHiddenEl.value = mainKey;
        updateSubList(mainKey);
        if (subKey && subListEl) {
            var subEsc = subKey.replace(/"/g, '\\"');
            var subOpt = subListEl.querySelector('.cat-option[data-key="' + subEsc + '"]');
            if (subOpt) {
                subListEl.querySelectorAll('.cat-option').forEach(function (el) { el.classList.remove('selected'); });
                subOpt.classList.add('selected');
                subHiddenEl.value = subKey;
                fireChange();
            }
        }
    }

    function renderMainList() {
        if (!mainListEl || !mainHiddenEl) return;
        mainListEl.innerHTML = '';
        categoriesData.forEach(function (c) {
            var key = (c.key != null && c.key !== '') ? String(c.key) : '';
            var displayName = categoryDisplayName(key, c.name || c.key);
            var opt = document.createElement('div');
            opt.className = 'cat-option';
            opt.setAttribute('role', 'option');
            opt.setAttribute('tabindex', '0');
            opt.setAttribute('data-key', key);
            opt.textContent = displayName;
            opt.addEventListener('click', function () {
                mainListEl.querySelectorAll('.cat-option').forEach(function (el) { el.classList.remove('selected'); });
                opt.classList.add('selected');
                mainHiddenEl.value = key;
                updateSubList(key);
            });
            mainListEl.appendChild(opt);
        });
    }

    function init(options) {
        config = options || {};
        mainListEl = document.getElementById(config.mainListId || 'imageCategoryMainList');
        subListEl = document.getElementById(config.subListId || 'imageCategorySubList');
        mainHiddenEl = document.getElementById(config.mainHiddenId || 'imageCategoryMainSelect');
        subHiddenEl = document.getElementById(config.subHiddenId || 'imageCategorySubSelect');
        if (!mainListEl || !mainHiddenEl) return Promise.resolve(null);

        var lang = (global.i18n && global.i18n.getLang) ? global.i18n.getLang() : '';
        var url = '/api/custom-product-categories';
        if (lang === 'en') url += '?lang=en';

        return fetch(url, { cache: 'no-store' })
            .then(function (r) { return r.json(); })
            .then(function (res) {
                categoriesData = Array.isArray(res && res.categories) ? res.categories : [];
                renderMainList();
                if (!categoriesData.length) return getValues();

                var firstKey = categoriesData[0].key != null ? String(categoriesData[0].key) : '';
                var preMain = (config.preMainKey || '').trim();
                var preSub = (config.preSubKey || '').trim();
                try {
                    if (!preMain) preMain = (global.sessionStorage.getItem('redesignCategoryKey') || '').trim();
                    if (!preSub) preSub = (global.sessionStorage.getItem('redesignSubcategoryKey') || '').trim();
                    if (preMain || preSub) {
                        global.sessionStorage.removeItem('redesignCategoryKey');
                        global.sessionStorage.removeItem('redesignSubcategoryKey');
                    }
                } catch (e) { /* ignore */ }
                if (!preMain && !config.skipUrlCategoryPrefill && typeof URLSearchParams !== 'undefined') {
                    var rp = new URLSearchParams(global.location.search);
                    preMain = (rp.get('category_key') || '').trim();
                    preSub = (rp.get('subcategory_key') || '').trim();
                }
                var mainKeyToUse = firstKey;
                if (preMain && categoriesData.some(function (c) { return (c.key != null ? String(c.key) : '') === preMain; })) {
                    mainKeyToUse = preMain;
                }
                selectMain(mainKeyToUse, preSub);
                if (typeof config.onReady === 'function') config.onReady(getValues());
                return getValues();
            })
            .catch(function () {
                categoriesData = [];
                if (mainListEl) {
                    mainListEl.innerHTML = '';
                    mainListEl.classList.add('empty');
                    mainListEl.textContent = tKey('customProduct.loadFailed', '載入分類失敗');
                }
                return getValues();
            });
    }

    function resyncFromHiddenInputs() {
        if (!categoriesData.length || !mainHiddenEl) return;
        var mainKey = (mainHiddenEl.value || '').trim();
        var subKey = (subHiddenEl && subHiddenEl.value) ? String(subHiddenEl.value).trim() : '';
        if (mainKey) selectMain(mainKey, subKey);
    }

    global.CustomProductCatPicker = {
        init: init,
        getValues: getValues,
        getCategoriesData: function () { return categoriesData.slice(); },
        setSelection: selectMain,
        resyncFromHiddenInputs: resyncFromHiddenInputs
    };
})(typeof window !== 'undefined' ? window : this);
