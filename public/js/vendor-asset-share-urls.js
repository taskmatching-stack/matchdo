/**
 * 廠商素材可分享深連結（試做／搭配導覽／材料帶入）
 * 見 docs/PROGRESS-vendor-asset-share-links.md
 */
(function (root) {
    function originBase() {
        return (root && root.location && root.location.origin) ? root.location.origin : '';
    }

    function normalizeAssetKind(item) {
        var k = (item && item.asset_kind) ? String(item.asset_kind).trim().toLowerCase() : 'prototype';
        if (k === 'material' || k === 'part') return k;
        return 'prototype';
    }

    /** 站內相對路徑（href 用）；opts.vendorName 可選 */
    function buildShareDesignPath(item, opts) {
        opts = opts || {};
        if (!item || !item.id) return '/custom-product.html?tab=product-design';
        var kind = normalizeAssetKind(item);
        var url = '/custom-product.html?tab=product-design';
        if (opts.vendorName) url += '&vendor_name=' + encodeURIComponent(String(opts.vendorName));
        if (item.manufacturer_id) url += '&manufacturer_id=' + encodeURIComponent(item.manufacturer_id);
        if (kind === 'prototype') {
            url += '&prototype_asset_id=' + encodeURIComponent(item.id);
        } else {
            url += '&vendor_asset_id=' + encodeURIComponent(item.id);
        }
        if (item.category_key) url += '&category_key=' + encodeURIComponent(item.category_key);
        if (item.subcategory_key) url += '&subcategory_key=' + encodeURIComponent(item.subcategory_key);
        return url;
    }

    /** 站內相對路徑；opts.returnTo 可選（設計頁內導覽用） */
    function buildShareGuidePath(item, opts) {
        opts = opts || {};
        if (!item || !item.id || normalizeAssetKind(item) !== 'prototype') return '';
        var url = (item.match_guide_url && String(item.match_guide_url).trim())
            ? String(item.match_guide_url).trim()
            : ('/product-tree.html?prototype_asset_id=' + encodeURIComponent(item.id));
        if (opts.returnTo) {
            url += (url.indexOf('?') >= 0 ? '&' : '?') + 'return_to=' + encodeURIComponent(String(opts.returnTo));
        }
        return url;
    }

    function withOrigin(path, origin) {
        if (origin === false || origin === null || origin === '') return path;
        var base = String(origin || originBase()).replace(/\/$/, '');
        return base + path;
    }

    function buildShareDesignUrl(item, origin, opts) {
        return withOrigin(buildShareDesignPath(item, opts), origin);
    }

    function buildShareGuideUrl(item, origin, opts) {
        var path = buildShareGuidePath(item, opts);
        if (!path) return '';
        return withOrigin(path, origin);
    }

    function buildShareMaterialUrl(item, origin) {
        if (!item || !item.id) return '';
        return buildShareDesignUrl(Object.assign({}, item, { asset_kind: 'material' }), origin);
    }

    function prototypeLinkCount(item) {
        if (!item) return 0;
        if (item.link_count != null) return Number(item.link_count) || 0;
        return (Number(item.material_count || 0) + Number(item.part_count || 0)) || 0;
    }

    function shouldShowGuideLink(item) {
        return normalizeAssetKind(item) === 'prototype' && prototypeLinkCount(item) > 0;
    }

    function copyTextToClipboard(text, onDone) {
        if (!text) {
            if (typeof onDone === 'function') onDone(false);
            return;
        }
        function ok() { if (typeof onDone === 'function') onDone(true); }
        function fail() { if (typeof onDone === 'function') onDone(false); }
        if (root.navigator && root.navigator.clipboard && root.navigator.clipboard.writeText) {
            root.navigator.clipboard.writeText(text).then(ok).catch(fail);
            return;
        }
        try {
            var ta = root.document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            root.document.body.appendChild(ta);
            ta.select();
            root.document.execCommand('copy');
            root.document.body.removeChild(ta);
            ok();
        } catch (e) {
            fail();
        }
    }

    root.VendorAssetShareUrls = {
        buildShareDesignPath: buildShareDesignPath,
        buildShareGuidePath: buildShareGuidePath,
        buildShareDesignUrl: buildShareDesignUrl,
        buildShareGuideUrl: buildShareGuideUrl,
        buildShareMaterialUrl: buildShareMaterialUrl,
        prototypeLinkCount: prototypeLinkCount,
        shouldShowGuideLink: shouldShowGuideLink,
        copyTextToClipboard: copyTextToClipboard
    };
})(typeof window !== 'undefined' ? window : globalThis);
