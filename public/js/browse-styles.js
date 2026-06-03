/**
 * 廠商版型 Tab：委派 custom-product.js（與素材庫相同 buildVendorAssetsFetchUrl / loadVendorAssetsPickerList 邏輯）
 */
(function (global) {
    'use strict';

    function isEmbedded() {
        return !!document.getElementById('panel-vendor-styles');
    }

    function redirectStandalone() {
        var p = new URLSearchParams(global.location.search);
        p.set('tab', 'vendor-styles');
        global.location.replace('/custom-product.html?' + p.toString());
    }

    function loadItems() {
        if (typeof global.loadVendorStylesTabList === 'function') {
            global.loadVendorStylesTabList();
        }
    }

    function init() {
        if (global.i18n && typeof global.i18n.applyPage === 'function') global.i18n.applyPage();
        if (isEmbedded()) {
            var tabVendor = document.getElementById('tab-vendor-styles');
            if (tabVendor) {
                tabVendor.addEventListener('shown.bs.tab', loadItems);
            }
            return;
        }
        if (document.body && document.body.classList.contains('browse-styles-page')) {
            redirectStandalone();
        }
    }

    global.VendorStyleBrowse = { loadItems: loadItems };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(typeof window !== 'undefined' ? window : this);
