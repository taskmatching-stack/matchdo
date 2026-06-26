/**
 * 廠商素材可分享深連結（試做／搭配導覽／材料帶入）
 * 見 docs/PROGRESS-vendor-asset-share-links.md
 */
(function (root) {
    function originBase() {
        return (root && root.location && root.location.origin) ? root.location.origin : '';
    }

    function buildShareDesignUrl(item, origin) {
        if (!item || !item.id) {
            return originBase() + '/custom-product.html?tab=product-design';
        }
        var base = String(origin || originBase()).replace(/\/$/, '');
        var url = base + '/custom-product.html?tab=product-design&prototype_asset_id=' + encodeURIComponent(item.id);
        if (item.manufacturer_id) url += '&manufacturer_id=' + encodeURIComponent(item.manufacturer_id);
        if (item.category_key) url += '&category_key=' + encodeURIComponent(item.category_key);
        if (item.subcategory_key) url += '&subcategory_key=' + encodeURIComponent(item.subcategory_key);
        return url;
    }

    function buildShareGuideUrl(item, origin) {
        if (!item || !item.id) return '';
        var base = String(origin || originBase()).replace(/\/$/, '');
        return base + '/product-tree.html?prototype_asset_id=' + encodeURIComponent(item.id);
    }

    function buildShareMaterialUrl(item, origin) {
        if (!item || !item.id) return '';
        var base = String(origin || originBase()).replace(/\/$/, '');
        return base + '/custom-product.html?tab=product-design&vendor_asset_id=' + encodeURIComponent(item.id);
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
        buildShareDesignUrl: buildShareDesignUrl,
        buildShareGuideUrl: buildShareGuideUrl,
        buildShareMaterialUrl: buildShareMaterialUrl,
        copyTextToClipboard: copyTextToClipboard
    };
})(typeof window !== 'undefined' ? window : globalThis);
