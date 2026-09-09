/**
 * Media wall ↔ generation tool links (layout_type / promo_kind aligned with server.js promoMediaWallItemMatchesKindFilter).
 */
(function (root) {
    'use strict';

    var CATALOG = {
        user_design: {
            wall: { layout_type: 'user_design' },
            genUrl: '/custom-product.html',
            wallLabelKey: 'home.layoutDesign',
            wallLabelFallback: '設計稿'
        },
        promo_design: {
            wall: { layout_type: 'promo_scene', promo_kind: 'design' },
            genUrl: '/promo-image/',
            wallLabelKey: 'home.promoKindDesign',
            wallLabelFallback: '產品情境圖'
        },
        promo_product: {
            wall: { layout_type: 'promo_scene', promo_kind: 'product' },
            genUrl: '/promo-camera/product',
            wallLabelKey: 'home.promoKindProduct',
            wallLabelFallback: '商攝・產品'
        },
        promo_space: {
            wall: { layout_type: 'promo_scene', promo_kind: 'space' },
            genUrl: '/promo-camera/space',
            wallLabelKey: 'home.promoKindSpace',
            wallLabelFallback: '空間鎖定'
        },
        promo_portrait: {
            wall: { layout_type: 'promo_scene', promo_kind: 'portrait' },
            genUrl: '/promo-camera/portrait',
            wallLabelKey: 'home.promoKindPortrait',
            wallLabelFallback: '商攝・人像'
        }
    };

    function t(key, fallback, vars) {
        var s = fallback || '';
        if (root.i18n && root.i18n.t) {
            var v = root.i18n.t(key);
            if (v) s = v;
        }
        if (vars) {
            Object.keys(vars).forEach(function (k) {
                s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]);
            });
        }
        return s;
    }

    function esc(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');
    }

    function buildWallUrl(spec) {
        spec = spec || {};
        var params = new URLSearchParams();
        if (spec.layout_type) params.set('layout_type', spec.layout_type);
        if (spec.promo_kind) params.set('promo_kind', spec.promo_kind);
        return '/?' + params.toString() + '#media-wall-section';
    }

    function catalogLabel(key) {
        var item = CATALOG[key];
        if (!item) return '';
        return t(item.wallLabelKey, item.wallLabelFallback);
    }

    function catalogKeyFromWallFilter(layoutType, promoKind) {
        layoutType = String(layoutType || '').trim();
        promoKind = String(promoKind || '').trim();
        if (layoutType === 'user_design') return 'user_design';
        if (layoutType === 'promo_scene') {
            if (promoKind === 'design') return 'promo_design';
            if (promoKind === 'product') return 'promo_product';
            if (promoKind === 'space') return 'promo_space';
            if (promoKind === 'portrait') return 'promo_portrait';
        }
        return null;
    }

    function catalogKeyFromDesignPath() {
        var p = String(root.location && root.location.pathname || '').replace(/\/$/, '');
        if (p === '/promo-image') return 'promo_design';
        if (p === '/pattern-extract' || p === '/design-to-physical' || p === '/scene-sim') return null;
        if (/custom-product\.html$/i.test(p) || p === '/custom-product') {
            var tab = new URLSearchParams(root.location.search || '').get('tab');
            if (tab === 'promo-image') return 'promo_design';
            if (tab && tab !== 'product-design') return null;
            return 'user_design';
        }
        return null;
    }

    function catalogKeyFromPromoCameraMode(mode) {
        mode = String(mode || '').toLowerCase();
        if (mode === 'space') return 'promo_space';
        if (mode === 'portrait') return 'promo_portrait';
        if (mode === 'product') return 'promo_product';
        return null;
    }

    function renderGenToWallLink(el, catalogKey) {
        if (!el) return;
        if (!catalogKey || !CATALOG[catalogKey]) {
            el.classList.add('d-none');
            el.innerHTML = '';
            return;
        }
        if (root.document && root.document.body && root.document.body.classList.contains('pc-embed-design')) {
            el.classList.add('d-none');
            el.innerHTML = '';
            return;
        }
        var item = CATALOG[catalogKey];
        var label = catalogLabel(catalogKey);
        var href = buildWallUrl(item.wall);
        var text = t('mediaWallGen.seeExamplesArrow', '看同類範例 → {label}', { label: label });
        el.innerHTML = '<a href="' + esc(href) + '" class="mw-gen-wall-link-a text-muted">' + esc(text) + '</a>';
        el.classList.remove('d-none');
    }

    function renderWallGenCta(el, layoutType, promoKind) {
        if (!el) return;
        var key = catalogKeyFromWallFilter(layoutType, promoKind);
        if (!key || !CATALOG[key]) {
            el.classList.add('d-none');
            el.innerHTML = '';
            return;
        }
        var item = CATALOG[key];
        var text = t('mediaWallGen.goGenerateArrow', '用此工具生成 →');
        el.innerHTML = '<a href="' + esc(item.genUrl) + '" class="mw-gen-wall-link-a text-muted">' + esc(text) + '</a>';
        el.classList.remove('d-none');
    }

    root.MatchdoMediaWallGenLinks = {
        CATALOG: CATALOG,
        buildWallUrl: buildWallUrl,
        catalogKeyFromWallFilter: catalogKeyFromWallFilter,
        catalogKeyFromDesignPath: catalogKeyFromDesignPath,
        catalogKeyFromPromoCameraMode: catalogKeyFromPromoCameraMode,
        renderGenToWallLink: renderGenToWallLink,
        renderWallGenCta: renderWallGenCta
    };
})(typeof window !== 'undefined' ? window : this);
