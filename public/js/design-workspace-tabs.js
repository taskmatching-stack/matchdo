/**
 * 設計工作區 Tab 列（設計稿／版型／材料／行銷／輔助）
 * Node SSR 與瀏覽器共用；瀏覽器會自動 mount [data-design-workspace-tabs]
 */
'use strict';

var TAB_GROUPS = [
    {
        key: 'design',
        css: 'cp-tab-g-design',
        tabs: [
            { tool: 'product-design', href: '/custom-product.html', label: '設計稿', i18n: 'customProduct.productDesignTab' },
            { tool: 'vendor-styles', href: '/vendor-styles/', label: '廠商版型', i18n: 'customProduct.vendorStylesTab' },
            { tool: 'official-templates', href: '/official-templates/', label: '官方版型', i18n: 'customProduct.officialStylesTab' }
        ]
    },
    {
        key: 'style',
        css: 'cp-tab-g-style',
        tabs: [
            { tool: 'material-combo', href: '/client/material-dual-color.html?return=design', label: '材料組合', i18n: 'nav.materialCombination' },
            { tool: 'print-asset', href: '/client/print-asset.html', label: '印花', i18n: 'nav.printAsset' }
        ]
    },
    {
        key: 'marketing',
        css: 'cp-tab-g-marketing',
        tabs: [
            { tool: 'promo-image', href: '/promo-image/', label: '情境圖', i18n: 'customProduct.promoImageTab' },
            { tool: 'promo-camera', href: '/promo-camera', label: '商攝導演', i18n: 'customProduct.promoCameraTab' }
        ]
    },
    {
        key: 'assist',
        css: 'cp-tab-g-assist',
        tabs: [
            { tool: 'pattern-extract', href: '/pattern-extract/', label: '圖樣提取', i18n: 'customProduct.patternExtractTab' },
            { tool: 'design-to-physical', href: '/design-to-physical/', label: '寫實化', i18n: 'customProduct.designToPhysicalTab' },
            { tool: 'scene-sim', href: '/scene-sim/', label: '實境模擬', i18n: 'home.sceneSim' }
        ]
    }
];

function escapeAttr(s) {
    return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;');
}

function buildDesignWorkspaceTabsHtml(activeTool) {
    activeTool = String(activeTool || 'product-design').trim();
    var parts = [
        '<div class="design-workspace-tabs cp-tab-groups cp-tab-groups--single">',
        '<div class="cp-tab-strip-wrap">',
        '<ul class="cp-tab-strip" role="tablist">'
    ];
    TAB_GROUPS.forEach(function (group, gi) {
        if (gi > 0) {
            parts.push('<li class="cp-tab-divider" aria-hidden="true"></li>');
        }
        group.tabs.forEach(function (tab) {
            var isActive = tab.tool === activeTool;
            parts.push(
                '<li class="cp-tab-item ' + group.css + '" role="presentation">',
                '<a class="cp-tab-link' + (isActive ? ' active' : '') + '"',
                ' href="' + escapeAttr(tab.href) + '"',
                ' role="tab"',
                ' aria-selected="' + (isActive ? 'true' : 'false') + '"',
                ' data-design-tool="' + escapeAttr(tab.tool) + '"',
                (tab.i18n ? ' data-i18n="' + escapeAttr(tab.i18n) + '"' : ''),
                '>' + tab.label + '</a>',
                '</li>'
            );
        });
    });
    parts.push('</ul></div></div>');
    return parts.join('');
}

function detectActiveToolFromPath(pathname) {
    pathname = String(pathname || '/').split('?')[0].replace(/\/$/, '') || '/';
    if (pathname.indexOf('material-dual-color') !== -1) return 'material-combo';
    if (pathname.indexOf('print-asset') !== -1) return 'print-asset';
    if (pathname === '/vendor-styles' || pathname.indexOf('/vendor-styles/') === 0) return 'vendor-styles';
    if (pathname === '/official-templates' || pathname.indexOf('/official-templates/') === 0) return 'official-templates';
    if (pathname.indexOf('pattern-extract') !== -1) return 'pattern-extract';
    if (pathname.indexOf('design-to-physical') !== -1) return 'design-to-physical';
    if (pathname.indexOf('scene-sim') !== -1) return 'scene-sim';
    if (pathname.indexOf('promo-image') !== -1) return 'promo-image';
    if (pathname.indexOf('promo-camera') !== -1) return 'promo-camera';
    if (pathname.indexOf('custom-product') !== -1) return 'product-design';
    return 'product-design';
}

function mountDesignWorkspaceTabs() {
    if (typeof document === 'undefined') return;
    document.querySelectorAll('[data-design-workspace-tabs]').forEach(function (el) {
        var active = el.getAttribute('data-active-tool') || detectActiveToolFromPath(window.location.pathname);
        el.outerHTML = buildDesignWorkspaceTabsHtml(active);
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        TAB_GROUPS: TAB_GROUPS,
        buildDesignWorkspaceTabsHtml: buildDesignWorkspaceTabsHtml,
        detectActiveToolFromPath: detectActiveToolFromPath,
        mountDesignWorkspaceTabs: mountDesignWorkspaceTabs
    };
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mountDesignWorkspaceTabs);
    } else {
        mountDesignWorkspaceTabs();
    }
}
