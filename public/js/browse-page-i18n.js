/**
 * Browse SSR 頁（廠商／官方版型）— i18n 套用與動態字串
 */
(function () {
    function currentLang() {
        return (window.i18n && window.i18n.getLang) ? window.i18n.getLang() : 'zh-TW';
    }

    function pickCatLabel(zh, en, lang) {
        lang = lang || currentLang();
        if (lang === 'en') {
            var e = en != null ? String(en).trim() : '';
            if (e) return e;
        }
        return zh != null ? String(zh).trim() : (en != null ? String(en).trim() : '');
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

    function applyBrowseCategoryI18n() {
        var lang = currentLang();
        document.querySelectorAll('.bs-cat-filter-label').forEach(function (el) {
            el.textContent = pickCatLabel(
                el.getAttribute('data-name-zh') || '',
                el.getAttribute('data-name-en') || '',
                lang
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
                    lang
                );
            }
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
            var cat = pickCatLabel(catZh, catEn, lang);
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
        if (lang === 'en') {
            document.documentElement.lang = 'en';
        } else {
            document.documentElement.lang = 'zh-TW';
        }
    }

    function bootBrowseI18n() {
        if (!window.i18n || !window.i18n.ready) return;
        window.i18n.ready.then(function () {
            if (window.i18n.applyPage) window.i18n.applyPage();
            applyBrowseDynamicI18n();
        }).catch(function () {});
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootBrowseI18n);
    } else {
        bootBrowseI18n();
    }
})();
