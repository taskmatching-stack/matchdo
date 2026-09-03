'use strict';

const publicLang = require('./public-lang');
const hg = require('./help-guides');

function langSuffix(lang) {
    return lang === 'en' ? '?lang=en' : '';
}

function withLang(path, lang) {
    return path + langSuffix(lang);
}

function extractToc(blocks, lang) {
    var items = [];
    hg.sanitizeBlocks(blocks).forEach(function (b) {
        if (b.type !== 'text') return;
        var text = hg.pick(b.text, b.text_en, lang);
        if (hg.looksLikeHtml(text)) {
            String(text || '').replace(/<h([23])(\s[^>]*)?>([\s\S]*?)<\/h\1>/gi, function (_, level, attrs, inner) {
                var heading = String(inner).replace(/<[^>]+>/g, '').replace(/\s*#\s*$/, '').trim();
                if (!heading) return '';
                items.push({ id: hg.headingId(heading), text: heading, level: Number(level) });
                return '';
            });
            return;
        }
        String(text || '').replace(/\r\n/g, '\n').split('\n').forEach(function (line) {
            var t = line.trim();
            var level = 0;
            var heading = '';
            if (/^###\s+/.test(t)) {
                level = 3;
                heading = t.replace(/^###\s+/, '');
            } else if (/^##\s+/.test(t)) {
                level = 2;
                heading = t.replace(/^##\s+/, '');
            }
            if (!heading) return;
            items.push({ id: hg.headingId(heading), text: heading, level: level });
        });
    });
    return items;
}

function tocHtml(items) {
    if (!items.length) return '';
    return '<nav class="help-toc mb-4" aria-label="On this page"><p class="small text-muted mb-1">本篇大綱</p><ul class="list-unstyled small mb-0">' +
        items.map(function (it) {
            return '<li class="' + (it.level === 3 ? 'ps-3' : '') + '"><a href="#' + hg.escapeHtml(it.id) + '">' + hg.escapeHtml(it.text) + '</a></li>';
        }).join('') +
        '</ul></nav>';
}

function folderNavHtml(folder, pages, activeSlug, lang) {
    var title = hg.pick(folder.title, folder.title_en, lang);
    return '<aside class="help-aside mb-4">' +
        '<p class="small text-muted mb-1"><a href="' + hg.escapeHtml(withLang('/help/', lang)) + '">' +
        (lang === 'en' ? 'All guides' : '操作介紹目錄') + '</a></p>' +
        '<h2 class="h6 mb-2">' + hg.escapeHtml(title) + '</h2>' +
        '<ul class="list-unstyled small mb-0">' +
        (pages || []).map(function (p) {
            var href = withLang(hg.pagePath(folder.slug, p.slug), lang);
            var name = hg.pick(p.title, p.title_en, lang);
            var cls = p.slug === activeSlug ? ' fw-semibold' : '';
            return '<li class="mb-1"><a class="' + cls + '" href="' + hg.escapeHtml(href) + '">' + hg.escapeHtml(name) + '</a></li>';
        }).join('') +
        '</ul></aside>';
}

function pageShell(opts) {
    var lang = opts.lang === 'en' ? 'en' : 'zh-TW';
    var htmlLang = lang === 'en' ? 'en' : 'zh-TW';
    var jsonLd = opts.jsonLd ? ('<script type="application/ld+json">' + JSON.stringify(opts.jsonLd) + '</script>\n') : '';
    return '<!DOCTYPE html>\n<html lang="' + htmlLang + '">\n<head>\n' +
        '<meta charset="UTF-8">\n' +
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
        '<title>' + hg.escapeHtml(opts.docTitle) + '</title>\n' +
        '<meta name="robots" content="index, follow">\n' +
        '<meta name="description" content="' + hg.escapeHtml(opts.metaDesc) + '">\n' +
        '<link rel="canonical" href="' + hg.escapeHtml(opts.canonical) + '">\n' +
        '<link href="/img/favicon.ico" rel="icon">\n' +
        '<link href="/css/bootstrap.min.css" rel="stylesheet">\n' +
        '<link href="/css/style.css" rel="stylesheet">\n' +
        '<link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css" rel="stylesheet">\n' +
        jsonLd +
        '<style>\n' +
        '.help-prose h2{font-size:1.35rem;font-weight:700;margin:1.75rem 0 .65rem;line-height:1.35;color:#1a1a1a;}\n' +
        '.help-prose h3{font-size:1.125rem;font-weight:600;margin:1.25rem 0 .5rem;line-height:1.4;color:#2a2a2a;}\n' +
        '.help-prose h2:first-child,.help-prose h3:first-child{margin-top:0;}\n' +
        '.help-prose p{margin-bottom:.85rem;line-height:1.7;color:#333;}\n' +
        '.help-prose ul,.help-prose ol{margin-bottom:.85rem;padding-left:1.35rem;}\n' +
        '.help-prose li{margin-bottom:.35rem;line-height:1.65;}\n' +
        '.help-anchor{font-size:.8rem;opacity:.45;text-decoration:none;margin-left:.25rem;font-weight:400;}\n' +
        '.help-anchor:hover{opacity:1;}\n' +
        '.help-figure img{max-width:100%;height:auto;}\n' +
        '.help-figure picture{display:block;}\n' +
        '.help-copy-page{cursor:pointer;}\n' +
        '</style>\n</head>\n<body>\n' +
        '<div id="site-header"></div>\n' +
        '<div class="container-fluid page-title-bar py-3 border-bottom">\n' +
        '<div class="container d-flex flex-wrap align-items-start justify-content-between gap-2">\n' +
        '<div>\n<h1 class="h4 mb-1">' + hg.escapeHtml(opts.h1) + '</h1>\n' +
        (opts.sub ? ('<p class="text-muted small mb-0">' + hg.escapeHtml(opts.sub) + '</p>\n') : '') +
        '</div>\n' +
        (opts.showCopy
            ? '<button type="button" class="btn btn-sm btn-outline-secondary help-copy-page">' + (lang === 'en' ? 'Copy page URL' : '複製本頁網址') + '</button>\n'
            : '') +
        '</div>\n</div>\n' +
        '<div class="container py-4">\n' + opts.bodyHtml + '\n</div>\n' +
        '<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.0.0/dist/js/bootstrap.bundle.min.js"><\/script>\n' +
        '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"><\/script>\n' +
        '<script src="/config/auth-config.js"><\/script>\n' +
        '<script src="/js/site-header.js?v=20260903-help"><\/script>\n' +
        '<script src="/js/i18n.js"><\/script>\n' +
        '<script>\n' +
        '(function(){var btn=document.querySelector(".help-copy-page");if(btn){btn.addEventListener("click",function(){var u=location.href.split("#")[0];if(navigator.clipboard){navigator.clipboard.writeText(u).then(function(){btn.textContent=' +
        JSON.stringify(lang === 'en' ? 'Copied' : '已複製') +
        ';setTimeout(function(){btn.textContent=' + JSON.stringify(lang === 'en' ? 'Copy page URL' : '複製本頁網址') + ';},1500);});}});}document.querySelectorAll(".help-anchor").forEach(function(a){a.addEventListener("click",function(e){e.preventDefault();var u=location.origin+location.pathname+location.search+a.getAttribute("href");if(navigator.clipboard)navigator.clipboard.writeText(u);location.hash=a.getAttribute("href");});});})();\n' +
        '<\/script>\n' +
        '</body>\n</html>\n';
}

function buildIndexHtml(opts) {
    var lang = opts.lang;
    var base = String(opts.base || '').replace(/\/$/, '');
    var tree = opts.tree || [];
    var isEn = lang === 'en';
    var h1 = isEn ? 'How-to guides' : '操作介紹';
    var sub = isEn ? 'Guides for design, vendor tools, and membership.' : '各功能操作說明，可複製單篇網址分享。';
    var cards = tree.map(function (f) {
        var title = hg.pick(f.title, f.title_en, lang);
        var pages = (f.pages || []).map(function (p) {
            return '<li><a href="' + hg.escapeHtml(withLang(hg.pagePath(f.slug, p.slug), lang)) + '">' +
                hg.escapeHtml(hg.pick(p.title, p.title_en, lang)) + '</a></li>';
        }).join('');
        return '<div class="col-md-6 mb-3"><div class="border rounded p-3 h-100">' +
            '<h2 class="h6"><a href="' + hg.escapeHtml(withLang(hg.folderPath(f.slug), lang)) + '">' + hg.escapeHtml(title) + '</a></h2>' +
            (pages ? ('<ul class="small mb-0">' + pages + '</ul>') : '<p class="small text-muted mb-0">' + (isEn ? 'No articles yet.' : '此資料夾尚無文章。') + '</p>') +
            '</div></div>';
    }).join('');
    var body = '<div class="row">' + (cards || ('<p class="text-muted">' + (isEn ? 'No published guides yet.' : '尚無已發佈的操作介紹。') + '</p>')) + '</div>';
    return pageShell({
        lang: lang,
        docTitle: h1 + ' - MATCHDO 合做',
        metaDesc: sub,
        canonical: base + '/help/',
        h1: h1,
        sub: sub,
        showCopy: false,
        jsonLd: {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: h1,
            url: base + '/help/',
            description: sub
        },
        bodyHtml: body
    });
}

function buildFolderHtml(opts) {
    var lang = opts.lang;
    var base = String(opts.base || '').replace(/\/$/, '');
    var folder = opts.folder;
    var pages = opts.pages || [];
    var isEn = lang === 'en';
    var title = hg.pick(folder.title, folder.title_en, lang);
    var list = pages.length
        ? ('<ul class="mb-0">' + pages.map(function (p) {
            var sum = hg.pick(p.summary, p.summary_en, lang);
            return '<li class="mb-2"><a href="' + hg.escapeHtml(withLang(hg.pagePath(folder.slug, p.slug), lang)) + '">' +
                hg.escapeHtml(hg.pick(p.title, p.title_en, lang)) + '</a>' +
                (sum ? ('<div class="small text-muted">' + hg.escapeHtml(sum) + '</div>') : '') +
                '</li>';
        }).join('') + '</ul>')
        : ('<p class="text-muted">' + (isEn ? 'No published articles in this folder.' : '此資料夾尚無已發佈文章。') + '</p>');
    var body = '<div class="row"><div class="col-lg-3">' + folderNavHtml(folder, pages, '', lang) + '</div>' +
        '<div class="col-lg-9">' + list + '</div></div>';
    return pageShell({
        lang: lang,
        docTitle: title + ' - MATCHDO 合做',
        metaDesc: title,
        canonical: base + hg.folderPath(folder.slug),
        h1: title,
        sub: isEn ? 'Articles in this topic' : '此功能相關說明',
        showCopy: true,
        jsonLd: {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: title,
            url: base + hg.folderPath(folder.slug)
        },
        bodyHtml: body
    });
}

function buildArticleHtml(opts) {
    var lang = opts.lang;
    var base = String(opts.base || '').replace(/\/$/, '');
    var folder = opts.folder;
    var page = opts.page;
    var pages = opts.pages || [];
    var title = hg.pick(page.title, page.title_en, lang);
    var summary = hg.pick(page.summary, page.summary_en, lang);
    var toc = tocHtml(extractToc(page.blocks_json, lang));
    var article = hg.renderBlocks(page.blocks_json, lang);
    var body = '<div class="row"><div class="col-lg-3">' + folderNavHtml(folder, pages, page.slug, lang) + '</div>' +
        '<div class="col-lg-9">' + toc + article + '</div></div>';
    return pageShell({
        lang: lang,
        docTitle: title + ' - MATCHDO 合做',
        metaDesc: summary || title,
        canonical: base + hg.pagePath(folder.slug, page.slug),
        h1: title,
        sub: summary,
        showCopy: true,
        jsonLd: {
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: title,
            description: summary || title,
            url: base + hg.pagePath(folder.slug, page.slug)
        },
        bodyHtml: body
    });
}

function resolveLang(req) {
    return publicLang.resolvePublicLang({
        queryLang: req.query && req.query.lang
    });
}

function requestBase(req, BASE_URL) {
    var origin = (req.get('x-forwarded-proto') && req.get('host'))
        ? (req.get('x-forwarded-proto') + '://' + req.get('host'))
        : null;
    return String(origin || BASE_URL || 'https://matchdo.cc').replace(/\/$/, '');
}

module.exports = {
    buildIndexHtml: buildIndexHtml,
    buildFolderHtml: buildFolderHtml,
    buildArticleHtml: buildArticleHtml,
    resolveLang: resolveLang,
    requestBase: requestBase
};
