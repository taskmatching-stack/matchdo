/**
 * 設計工作區 — 版型列表 SSR 頁共用殼（廠商／官方）
 * 結構對齊 public/client/material-dual-color.html：標題在上 → 大框（Tab + 內容）
 */
'use strict';

const cards = require('./browse-style-card-ssr');

var WORKSPACE_CSS_V = '12';
var TABS_JS_V = '7';
var BROWSE_I18N_V = '5';

function buildWorkspaceShell(activeTool, h1, sub, bodyHtml, headI18n) {
    headI18n = headI18n || {};
    var h1Key = headI18n.h1Key ? String(headI18n.h1Key).trim() : '';
    var subKey = headI18n.subKey ? String(headI18n.subKey).trim() : '';
    var h1Attr = h1Key ? (' data-i18n="' + cards.escapeHtmlAttr(h1Key) + '"') : '';
    var subAttr = subKey ? (' data-i18n="' + cards.escapeHtmlAttr(subKey) + '"') : '';
    return (
        '<div class="design-workspace-shell">\n' +
        '<div class="design-workspace-layout">\n' +
        '<div class="design-workspace-head">\n' +
        '<div class="design-workspace-head-main">\n' +
        '<h1 class="design-workspace-title"' + h1Attr + '>' + cards.escapeHtmlText(h1) + '</h1>\n' +
        '<p class="design-workspace-sub"' + subAttr + '>' + cards.escapeHtmlText(sub) + '</p>\n' +
        '</div>\n' +
        '</div>\n' +
        '<div class="design-workspace-frame">\n' +
        '<div data-design-workspace-tabs data-active-tool="' + cards.escapeHtmlAttr(activeTool) + '"></div>\n' +
        '<div class="design-workspace-body">\n' +
        bodyHtml + '\n' +
        '</div>\n' +
        '</div>\n' +
        '</div>\n' +
        '</div>\n'
    );
}

function buildDesignWorkspaceBrowsePageHtml(opts) {
    opts = opts || {};
    var docTitle = String(opts.docTitle || '').trim();
    var metaDesc = String(opts.metaDesc || '').trim();
    var pageUrl = String(opts.pageUrl || '').trim();
    var h1 = String(opts.h1 || '').trim();
    var sub = String(opts.sub || '').trim();
    var activeTool = String(opts.activeTool || 'product-design').trim();
    var bodyHtml = String(opts.bodyHtml || '');
    var jsonLd = opts.jsonLd || null;
    var extraHeadStyle = String(opts.extraHeadStyle || '');
    var headI18n = opts.headI18n || {};
    var htmlLang = (opts.lang === 'en') ? 'en' : 'zh-TW';
    var docTitleKey = headI18n.docTitleKey ? String(headI18n.docTitleKey).trim() : '';
    var metaDescKey = headI18n.metaDescKey ? String(headI18n.metaDescKey).trim() : '';
    var catNameZh = headI18n.catNameZh ? String(headI18n.catNameZh).trim() : '';
    var catNameEn = headI18n.catNameEn ? String(headI18n.catNameEn).trim() : '';
    var docTitleMeta = docTitleKey
        ? ('<meta name="matchdo-i18n-doc-title" data-i18n-doc-title="' + cards.escapeHtmlAttr(docTitleKey) + '"' +
            (catNameZh ? (' data-cat-name-zh="' + cards.escapeHtmlAttr(catNameZh) + '"') : '') +
            (catNameEn ? (' data-cat-name-en="' + cards.escapeHtmlAttr(catNameEn) + '"') : '') +
            '>\n')
        : '';
    var metaDescAttr = metaDescKey
        ? (' data-i18n-meta-desc="' + cards.escapeHtmlAttr(metaDescKey) + '"')
        : '';

    if (!docTitle || !h1 || !pageUrl) {
        throw new Error('buildDesignWorkspaceBrowsePageHtml: docTitle, h1, pageUrl required');
    }

    var headStyleBlock = extraHeadStyle
        ? ('<style>\n' + extraHeadStyle + '\n</style>\n')
        : '';

    var jsonLdBlock = jsonLd
        ? ('<script type="application/ld+json">' + JSON.stringify(jsonLd) + '</script>\n')
        : '';

    return '<!DOCTYPE html>\n' +
        '<html lang="' + cards.escapeHtmlAttr(htmlLang) + '">\n<head>\n' +
        '<meta charset="utf-8">\n' +
        '<meta name="matchdo-asset-version" content="' + cards.escapeHtmlAttr(BROWSE_I18N_V) + '">\n' +
        '<title>' + cards.escapeHtmlText(docTitle) + '</title>\n' +
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
        '<meta name="robots" content="index, follow">\n' +
        '<meta name="description" content="' + cards.escapeHtmlAttr(metaDesc) + '"' + metaDescAttr + '>\n' +
        '<link rel="canonical" href="' + cards.escapeHtmlAttr(pageUrl) + '">\n' +
        '<meta property="og:type" content="website">\n' +
        '<meta property="og:site_name" content="MATCHDO 合做">\n' +
        '<meta property="og:title" content="' + cards.escapeHtmlAttr(docTitle) + '">\n' +
        '<meta property="og:description" content="' + cards.escapeHtmlAttr(metaDesc) + '">\n' +
        '<meta property="og:url" content="' + cards.escapeHtmlAttr(pageUrl) + '">\n' +
        '<meta property="og:locale" content="zh_TW">\n' +
        '<link href="/img/favicon.ico" rel="icon">\n' +
        '<link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css" rel="stylesheet">\n' +
        '<link href="/css/bootstrap.min.css" rel="stylesheet">\n' +
        '<link href="/css/style.css" rel="stylesheet">\n' +
        '<link href="/css/morandi-global.css?v=8" rel="stylesheet">\n' +
        '<link href="/css/design-workspace-tabs.css?v=' + WORKSPACE_CSS_V + '" rel="stylesheet">\n' +
        '<link href="/css/browse-styles.css?v=8" rel="stylesheet">\n' +
        '<script id="bs-bundle-js" src="https://cdn.jsdelivr.net/npm/bootstrap@5.0.0/dist/js/bootstrap.bundle.min.js" defer><\/script>\n' +
        jsonLdBlock +
        headStyleBlock +
        docTitleMeta +
        '</head>\n<body>\n' +
        '<div id="site-header"></div>\n' +
        '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"><\/script>\n' +
        '<script src="/config/auth-config.js"><\/script>\n' +
        '<script src="/js/site-header.js?v=20260807-i18n2"><\/script>\n' +
        buildWorkspaceShell(activeTool, h1, sub, bodyHtml, headI18n) +
        (htmlLang === 'en'
            ? ''
            : '<script>window.__MATCHDO_BROWSE_DEFAULT_ZH__=true;<\/script>\n') +
        '<script src="/js/i18n.js"><\/script>\n' +
        '<script src="/js/browse-page-i18n.js?v=' + BROWSE_I18N_V + '"><\/script>\n' +
        '<script src="/js/design-workspace-tabs.js?v=' + TABS_JS_V + '"><\/script>\n' +
        '</body>\n</html>\n';
}

module.exports = {
    WORKSPACE_CSS_V: WORKSPACE_CSS_V,
    TABS_JS_V: TABS_JS_V,
    BROWSE_I18N_V: BROWSE_I18N_V,
    buildWorkspaceShell: buildWorkspaceShell,
    buildDesignWorkspaceBrowsePageHtml: buildDesignWorkspaceBrowsePageHtml
};
