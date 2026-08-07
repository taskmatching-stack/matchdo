/**
 * 設計工作區 — 版型列表 SSR 頁共用殼（廠商／官方）
 * 結構對齊 public/client/material-dual-color.html：標題在上 → 大框（Tab + 內容）
 */
'use strict';

const cards = require('./browse-style-card-ssr');

var WORKSPACE_CSS_V = '12';
var TABS_JS_V = '7';

function buildWorkspaceShell(activeTool, h1, sub, bodyHtml) {
    return (
        '<div class="design-workspace-shell">\n' +
        '<div class="design-workspace-layout">\n' +
        '<div class="design-workspace-head">\n' +
        '<div class="design-workspace-head-main">\n' +
        '<h1 class="design-workspace-title">' + cards.escapeHtmlText(h1) + '</h1>\n' +
        '<p class="design-workspace-sub">' + cards.escapeHtmlText(sub) + '</p>\n' +
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
        '<html lang="zh-TW">\n<head>\n' +
        '<meta charset="utf-8">\n' +
        '<title>' + cards.escapeHtmlText(docTitle) + '</title>\n' +
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
        '<meta name="robots" content="index, follow">\n' +
        '<meta name="description" content="' + cards.escapeHtmlAttr(metaDesc) + '">\n' +
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
        '<link href="/css/browse-styles.css?v=7" rel="stylesheet">\n' +
        '<script id="bs-bundle-js" src="https://cdn.jsdelivr.net/npm/bootstrap@5.0.0/dist/js/bootstrap.bundle.min.js" defer><\/script>\n' +
        jsonLdBlock +
        headStyleBlock +
        '</head>\n<body>\n' +
        '<div id="site-header"></div>\n' +
        '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"><\/script>\n' +
        '<script src="/config/auth-config.js"><\/script>\n' +
        '<script src="/js/site-header.js?v=20260807-nav-cp2"><\/script>\n' +
        buildWorkspaceShell(activeTool, h1, sub, bodyHtml) +
        '<script src="/js/design-workspace-tabs.js?v=' + TABS_JS_V + '"><\/script>\n' +
        '<script src="/js/i18n.js"><\/script>\n' +
        '</body>\n</html>\n';
}

module.exports = {
    WORKSPACE_CSS_V: WORKSPACE_CSS_V,
    TABS_JS_V: TABS_JS_V,
    buildWorkspaceShell: buildWorkspaceShell,
    buildDesignWorkspaceBrowsePageHtml: buildDesignWorkspaceBrowsePageHtml
};
