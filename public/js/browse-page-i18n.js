/**
 * Browse SSR 頁（廠商／官方版型）— i18n 套用、分類 API（對齊首頁 custom-product-cat-picker）
 */
(function () {
    var categoriesByKey = null;

    function currentLang() {
        return (window.i18n && window.i18n.getLang) ? window.i18n.getLang() : 'zh-TW';
    }

    function tf(key, fb, map) {
        var s = (window.i18n && window.i18n.t) ? window.i18n.t(key) : key;
        if (!s || s === key) s = fb || key;
        if (map) {
            Object.keys(map).forEach(function (k) {
                s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), String(map[k]));
            });
        }
        return s;
    }

    function categoryDisplayName(key, apiName, lang) {
        lang = lang || currentLang();
        var name = apiName != null ? String(apiName).trim() : '';
        if (lang === 'en') {
            if (name) return name;
            var locKey = 'category.' + String(key || '');
            var localized = tf(locKey, '', {});
            if (localized && localized !== locKey) return localized;
        }
        return name || String(key || '');
    }

    function pickCatLabel(zh, en, lang, key) {
        lang = lang || currentLang();
        key = key || '';
        if (categoriesByKey && categoriesByKey[key]) {
            return categoryDisplayName(key, categoriesByKey[key].name, lang);
        }
        if (lang === 'en') {
            var e = en != null ? String(en).trim() : '';
            if (e) return e;
            var locKey = 'category.' + String(key);
            var localized = tf(locKey, '', {});
            if (localized && localized !== locKey) return localized;
        }
        return zh != null ? String(zh).trim() : (en != null ? String(en).trim() : '');
    }

    function applyBrowseCategoryI18n() {
        var lang = currentLang();
        document.querySelectorAll('.bs-cat-filter-label').forEach(function (el) {
            var key = el.getAttribute('data-cat-key') || '';
            el.textContent = pickCatLabel(
                el.getAttribute('data-name-zh') || '',
                el.getAttribute('data-name-en') || '',
                lang,
                key
            );
        });
        document.querySelectorAll('.dw-browse-filters-toggle-label').forEach(function (el) {
            var key = el.getAttribute('data-filter-key') || '';
            if (!key) {
                el.textContent = tf('browseStyles.filterAll', '全部', {});
                return;
            }
            var catEl = document.querySelector('.bs-cat-filter-label[data-cat-key="' + key.replace(/"/g, '\\"') + '"]');
            if (catEl) {
                el.textContent = pickCatLabel(
                    catEl.getAttribute('data-name-zh') || '',
                    catEl.getAttribute('data-name-en') || '',
                    lang,
                    key
                );
            }
        });
        document.querySelectorAll('.dw-browse-filters-toggle-prefix').forEach(function (el) {
            if (el.getAttribute('data-i18n')) return;
            el.setAttribute('data-i18n', 'browseStyles.filterCategory');
            el.textContent = tf('browseStyles.filterCategory', '分類', {});
        });
    }

    function applyBrowseDynamicI18n() {
        var lang = currentLang();
        document.querySelectorAll('[data-i18n-link-count]').forEach(function (el) {
            var n = el.getAttribute('data-i18n-link-count') || '0';
            el.textContent = tf('browseStyles.linkCountBadge', '可搭配 {n} 項', { n: n });
        });
        document.querySelectorAll('[data-browse-count]').forEach(function (el) {
            var n = el.getAttribute('data-browse-count') || '0';
            var filtered = el.getAttribute('data-browse-filtered') === '1';
            var base = tf('browseStyles.countLine', '共 {n} 項', { n: n });
            if (filtered) {
                base += ' ' + tf('browseStyles.countFiltered', '（已篩選分類）', {});
            }
            el.textContent = base;
        });
        document.querySelectorAll('[data-i18n-doc-title]').forEach(function (el) {
            var key = el.getAttribute('data-i18n-doc-title');
            if (!key) return;
            var catZh = el.getAttribute('data-cat-name-zh') || '';
            var catEn = el.getAttribute('data-cat-name-en') || '';
            var catKey = el.getAttribute('data-cat-key') || '';
            var cat = pickCatLabel(catZh, catEn, lang, catKey);
            var title = tf(key, document.title, cat ? { cat: cat } : {});
            if (title && title !== key) document.title = title;
        });
        document.querySelectorAll('[data-i18n-meta-desc]').forEach(function (el) {
            var key = el.getAttribute('data-i18n-meta-desc');
            if (!key) return;
            var desc = tf(key, el.getAttribute('content') || '', {});
            if (desc && desc !== key) el.setAttribute('content', desc);
        });
        applyBrowseCategoryI18n();
        document.documentElement.lang = (lang === 'en') ? 'en' : 'zh-TW';
    }

    function loadCategoriesFromApi(lang) {
        lang = lang || currentLang();
        var url = '/api/custom-product-categories';
        if (lang === 'en') url += '?lang=en';
        return fetch(url, { cache: 'no-store' })
            .then(function (r) { return r.ok ? r.json() : { categories: [] }; })
            .then(function (res) {
                var map = {};
                (Array.isArray(res && res.categories) ? res.categories : []).forEach(function (c) {
                    if (c && c.key) map[String(c.key)] = c;
                });
                categoriesByKey = map;
                applyBrowseCategoryI18n();
            })
            .catch(function () {
                categoriesByKey = null;
            });
    }

    function applyAll() {
        if (window.i18n && window.i18n.applyPage) window.i18n.applyPage();
        applyBrowseDynamicI18n();
        return loadCategoriesFromApi(currentLang());
    }

    function bootBrowseI18n() {
        if (!window.i18n || !window.i18n.ready) {
            setTimeout(bootBrowseI18n, 16);
            return;
        }
        window.i18n.ready.then(function () {
            applyAll();
        }).catch(function () {});
    }

    window.matchdoBrowseI18n = {
        applyAll: applyAll,
        applyBrowseCategoryI18n: applyBrowseCategoryI18n,
        applyBrowseDynamicI18n: applyBrowseDynamicI18n
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootBrowseI18n);
    } else {
        bootBrowseI18n();
    }
})();
