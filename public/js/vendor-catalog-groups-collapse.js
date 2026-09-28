/**
 * Shared collapse UI for「我的素材分類」cards (manufacturer + supplier catalog).
 */
(function () {
    'use strict';

    var DEFAULT_PREF_KEY = 'matchdo.catalogGroupsDefaultCollapsed';

    function tr(k, fb) {
        if (window.i18n && window.i18n.t) {
            var v = window.i18n.t(k);
            if (v && v !== k) return v;
        }
        return fb != null ? fb : k;
    }

    function getPref(prefKey, kind) {
        try {
            var v = localStorage.getItem(prefKey + '.' + kind);
            if (v === '1') return true;
            if (v === '0') return false;
        } catch (_) {}
        return null;
    }

    function resolveCollapsed(prefKey, kind) {
        var pref = getPref(prefKey, kind);
        if (pref !== null) return pref;
        return true;
    }

    function setCollapsed(kind, collapsed, getGroupCount) {
        var panel = document.getElementById('catalog-groups-panel-' + kind);
        var card = document.querySelector('.catalog-groups-card[data-catalog-kind="' + kind + '"]');
        var btn = card ? card.querySelector('.btn-catalog-groups-toggle[data-catalog-kind="' + kind + '"]') : null;
        var icon = card ? card.querySelector('.catalog-groups-toggle-icon') : null;
        var label = card ? card.querySelector('.catalog-groups-toggle-label') : null;
        var summary = document.getElementById('catalog-groups-collapsed-summary-' + kind);
        if (panel) panel.classList.toggle('catalog-groups-panel--collapsed', !!collapsed);
        if (btn) btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
        if (icon) {
            icon.className = (collapsed ? 'bi bi-chevron-down' : 'bi bi-chevron-up') + ' catalog-groups-toggle-icon';
        }
        if (label) {
            label.textContent = collapsed
                ? tr('baseModels.catalogGroupsExpand', '展開')
                : tr('baseModels.catalogGroupsCollapse', '收起');
        }
        if (summary) {
            var n = typeof getGroupCount === 'function' ? getGroupCount(kind) : 0;
            if (collapsed && n) {
                summary.textContent = String(tr('baseModels.catalogGroupsCollapsedSummary', '共 {n} 個分類 · 點「展開」可新增、拖曳排序'))
                    .replace(/\{n\}/g, String(n));
                summary.classList.remove('d-none');
            } else {
                summary.classList.add('d-none');
                summary.textContent = '';
            }
        }
    }

    function initKind(kind, opts) {
        opts = opts || {};
        var prefKey = opts.prefKey || DEFAULT_PREF_KEY;
        var getGroupCount = opts.getGroupCount || function () { return 0; };
        if (opts.initedMap && opts.initedMap[kind]) {
            setCollapsed(kind, !!opts.collapsedMap[kind], getGroupCount);
            return;
        }
        if (opts.initedMap) opts.initedMap[kind] = true;
        var card = document.querySelector('.catalog-groups-card[data-catalog-kind="' + kind + '"]');
        if (!card) return;
        var prefCb = card.querySelector('.catalog-groups-pref-collapsed[data-catalog-kind="' + kind + '"]');
        var toggleBtn = card.querySelector('.btn-catalog-groups-toggle[data-catalog-kind="' + kind + '"]');
        var pref = getPref(prefKey, kind);
        var collapsed = resolveCollapsed(prefKey, kind);
        if (opts.collapsedMap) opts.collapsedMap[kind] = collapsed;
        if (prefCb) {
            prefCb.checked = pref !== false;
            prefCb.addEventListener('change', function () {
                try {
                    localStorage.setItem(prefKey + '.' + kind, prefCb.checked ? '1' : '0');
                } catch (_) {}
                if (opts.collapsedMap) opts.collapsedMap[kind] = !!prefCb.checked;
                setCollapsed(kind, !!prefCb.checked, getGroupCount);
            });
        }
        if (toggleBtn) {
            toggleBtn.addEventListener('click', function () {
                var next = !(opts.collapsedMap && opts.collapsedMap[kind]);
                if (opts.collapsedMap) opts.collapsedMap[kind] = next;
                setCollapsed(kind, next, getGroupCount);
            });
        }
        setCollapsed(kind, collapsed, getGroupCount);
    }

    window.matchdoCatalogGroupsCollapse = {
        initKind: initKind,
        setCollapsed: setCollapsed,
        resolveCollapsed: resolveCollapsed
    };
})();
