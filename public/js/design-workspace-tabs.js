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

function findTabByTool(tool) {
    var found = null;
    TAB_GROUPS.forEach(function (group) {
        group.tabs.forEach(function (tab) {
            if (tab.tool === tool) found = tab;
        });
    });
    return found;
}

function getActiveTabLabel(root) {
    if (!root) return '工作區';
    var active = root.querySelector('.cp-tab-strip .nav-link.active');
    if (active && active.textContent) return active.textContent.trim();
    return '工作區';
}

function findGroupByTool(tool) {
    var found = null;
    TAB_GROUPS.forEach(function (group) {
        group.tabs.forEach(function (tab) {
            if (tab.tool === tool) found = group;
        });
    });
    return found;
}

function buildMobileToggleHtml(activeTool) {
    var tab = findTabByTool(activeTool);
    var group = findGroupByTool(activeTool);
    var label = tab ? tab.label : '工作區';
    var groupCss = group ? group.css : 'cp-tab-g-design';
    return (
        '<button type="button" class="cp-tab-mobile-toggle ' + groupCss + '" aria-expanded="false" aria-controls="cp-tab-strip-panel">' +
        '<span class="cp-tab-mobile-toggle-text">' +
        '<span class="cp-tab-mobile-toggle-prefix">工作區</span>' +
        '<span class="cp-tab-mobile-toggle-label">' + label + '</span>' +
        '</span>' +
        '<i class="bi bi-chevron-down cp-tab-mobile-toggle-icon" aria-hidden="true"></i>' +
        '</button>'
    );
}

function buildDesignWorkspaceTabsHtml(activeTool) {
    activeTool = String(activeTool || 'product-design').trim();
    var parts = [
        '<div class="design-workspace-tabs cp-tab-groups cp-tab-groups--single">',
        buildMobileToggleHtml(activeTool),
        '<div class="cp-tab-strip-wrap" id="cp-tab-strip-panel">',
        '<ul class="nav nav-tabs cp-tab-strip" role="tablist">'
    ];
    TAB_GROUPS.forEach(function (group, gi) {
        if (gi > 0) {
            parts.push('<li class="cp-tab-divider" aria-hidden="true"></li>');
        }
        group.tabs.forEach(function (tab) {
            var isActive = tab.tool === activeTool;
            parts.push(
                '<li class="nav-item ' + group.css + '" role="presentation">',
                '<a class="nav-link' + (isActive ? ' active' : '') + '"',
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

function refreshMobileToggleLabel(root) {
    if (!root) return;
    var labelEl = root.querySelector('.cp-tab-mobile-toggle-label');
    if (labelEl) labelEl.textContent = getActiveTabLabel(root);
    var btn = root.querySelector('.cp-tab-mobile-toggle');
    var activeItem = root.querySelector('.cp-tab-strip .nav-link.active');
    if (btn && activeItem) {
        var groupItem = activeItem.closest('.nav-item');
        TAB_GROUPS.forEach(function (group) {
            btn.classList.remove(group.css);
        });
        if (groupItem) {
            TAB_GROUPS.forEach(function (group) {
                if (groupItem.classList.contains(group.css)) btn.classList.add(group.css);
            });
        }
    }
}

function ensureMobileToggle(root) {
    if (!root || root.querySelector('.cp-tab-mobile-toggle')) return;
    var wrap = root.querySelector('.cp-tab-strip-wrap');
    if (!wrap) return;
    var activeItem = root.querySelector('.cp-tab-strip .nav-link.active');
    var groupCss = 'cp-tab-g-design';
    if (activeItem) {
        var groupItem = activeItem.closest('.nav-item');
        TAB_GROUPS.forEach(function (group) {
            if (groupItem && groupItem.classList.contains(group.css)) groupCss = group.css;
        });
    }
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cp-tab-mobile-toggle ' + groupCss;
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', wrap.id || 'cp-tab-strip-panel');
    if (!wrap.id) wrap.id = 'cp-tab-strip-panel';
    btn.innerHTML =
        '<span class="cp-tab-mobile-toggle-text">' +
        '<span class="cp-tab-mobile-toggle-prefix">工作區</span>' +
        '<span class="cp-tab-mobile-toggle-label">' + getActiveTabLabel(root) + '</span>' +
        '</span>' +
        '<i class="bi bi-chevron-down cp-tab-mobile-toggle-icon" aria-hidden="true"></i>';
    root.insertBefore(btn, wrap);
}

function setMobileTabsExpanded(root, expanded) {
    if (!root) return;
    var btn = root.querySelector('.cp-tab-mobile-toggle');
    if (expanded) {
        root.classList.add('is-expanded');
        if (btn) btn.setAttribute('aria-expanded', 'true');
    } else {
        root.classList.remove('is-expanded');
        if (btn) btn.setAttribute('aria-expanded', 'false');
    }
}

function bindMobileToggle(root) {
    if (!root || root.getAttribute('data-cp-tab-mobile-bound') === '1') return;
    ensureMobileToggle(root);
    refreshMobileToggleLabel(root);
    var btn = root.querySelector('.cp-tab-mobile-toggle');
    if (!btn) return;
    btn.addEventListener('click', function (e) {
        e.stopPropagation();
        setMobileTabsExpanded(root, !root.classList.contains('is-expanded'));
    });
    root.querySelectorAll('.cp-tab-strip .nav-link').forEach(function (link) {
        link.addEventListener('click', function () {
            setMobileTabsExpanded(root, false);
        });
    });
    root.setAttribute('data-cp-tab-mobile-bound', '1');
}

function initDesignWorkspaceTabsMobile() {
    if (typeof document === 'undefined') return;
    document.querySelectorAll('.design-workspace-tabs').forEach(bindMobileToggle);
    if (!document.documentElement.getAttribute('data-cp-tab-mobile-doc-bound')) {
        document.documentElement.setAttribute('data-cp-tab-mobile-doc-bound', '1');
        document.addEventListener('click', function (e) {
            document.querySelectorAll('.design-workspace-tabs.is-expanded').forEach(function (root) {
                if (!root.contains(e.target)) setMobileTabsExpanded(root, false);
            });
            document.querySelectorAll('.dw-browse-filters-block.is-expanded, .vs-filters-block.is-expanded, .ot-filters-block.is-expanded').forEach(function (block) {
                if (!block.contains(e.target)) setBrowseFiltersExpanded(block, false);
            });
        });
        document.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape') return;
            document.querySelectorAll('.design-workspace-tabs.is-expanded').forEach(function (root) {
                setMobileTabsExpanded(root, false);
            });
            document.querySelectorAll('.dw-browse-filters-block.is-expanded, .vs-filters-block.is-expanded, .ot-filters-block.is-expanded').forEach(function (block) {
                setBrowseFiltersExpanded(block, false);
            });
        });
    }
    if (window.i18n && window.i18n.ready) {
        window.i18n.ready.then(function () {
            document.querySelectorAll('.design-workspace-tabs').forEach(refreshMobileToggleLabel);
        }).catch(function () {});
    }
}

function getBrowseFilterLabel(block) {
    if (!block) return '全部';
    var active = block.querySelector('.btn-secondary');
    if (active && active.textContent) return active.textContent.trim();
    return '全部';
}

function buildBrowseFiltersToggleHtml(label) {
    return (
        '<button type="button" class="dw-browse-filters-toggle" aria-expanded="false">' +
        '<span class="dw-browse-filters-toggle-text">' +
        '<span class="dw-browse-filters-toggle-prefix">分類</span>' +
        '<span class="dw-browse-filters-toggle-label">' + label + '</span>' +
        '</span>' +
        '<i class="bi bi-chevron-down dw-browse-filters-toggle-icon" aria-hidden="true"></i>' +
        '</button>'
    );
}

function setBrowseFiltersExpanded(block, expanded) {
    if (!block) return;
    var btn = block.querySelector('.dw-browse-filters-toggle');
    if (expanded) {
        block.classList.add('is-expanded');
        if (btn) btn.setAttribute('aria-expanded', 'true');
    } else {
        block.classList.remove('is-expanded');
        if (btn) btn.setAttribute('aria-expanded', 'false');
    }
}

function ensureBrowseFiltersBlock(filtersEl) {
    if (!filtersEl || filtersEl.closest('.dw-browse-filters-block, .vs-filters-block, .ot-filters-block')) return null;
    var blockClass = 'dw-browse-filters-block';
    if (filtersEl.classList.contains('vs-filters')) blockClass = 'vs-filters-block';
    if (filtersEl.classList.contains('ot-filters')) blockClass = 'ot-filters-block';
    var block = document.createElement('div');
    block.className = blockClass;
    var active = filtersEl.querySelector('.btn-secondary');
    var label = active && active.textContent ? active.textContent.trim() : '全部';
    block.innerHTML = buildBrowseFiltersToggleHtml(label);
    var panel = filtersEl;
    filtersEl.parentNode.insertBefore(block, filtersEl);
    block.appendChild(panel);
    return block;
}

function bindBrowseFiltersBlock(block) {
    if (!block || block.getAttribute('data-browse-filters-bound') === '1') return;
    var btn = block.querySelector('.dw-browse-filters-toggle');
    if (!btn) return;
    var labelEl = block.querySelector('.dw-browse-filters-toggle-label');
    if (labelEl) labelEl.textContent = getBrowseFilterLabel(block);
    btn.addEventListener('click', function (e) {
        e.stopPropagation();
        setBrowseFiltersExpanded(block, !block.classList.contains('is-expanded'));
    });
    block.querySelectorAll('a.btn').forEach(function (link) {
        link.addEventListener('click', function () {
            setBrowseFiltersExpanded(block, false);
        });
    });
    block.setAttribute('data-browse-filters-bound', '1');
}

function initBrowseFiltersMobile() {
    if (typeof document === 'undefined') return;
    document.querySelectorAll('.dw-browse-filters-block, .vs-filters-block, .ot-filters-block').forEach(bindBrowseFiltersBlock);
    document.querySelectorAll('.dw-browse-filters, .vs-filters, .ot-filters').forEach(function (el) {
        if (el.closest('.dw-browse-filters-block, .vs-filters-block, .ot-filters-block')) return;
        var block = ensureBrowseFiltersBlock(el);
        if (block) bindBrowseFiltersBlock(block);
    });
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
        mountDesignWorkspaceTabs: mountDesignWorkspaceTabs,
        initDesignWorkspaceTabsMobile: initDesignWorkspaceTabsMobile,
        initBrowseFiltersMobile: initBrowseFiltersMobile
    };
}

if (typeof document !== 'undefined') {
    function bootDesignWorkspaceTabs() {
        mountDesignWorkspaceTabs();
        initDesignWorkspaceTabsMobile();
        initBrowseFiltersMobile();
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootDesignWorkspaceTabs);
    } else {
        bootDesignWorkspaceTabs();
    }
}
