'use strict';

function isChineseLocale(tag) {
    if (!tag || typeof tag !== 'string') return false;
    var l = tag.trim().toLowerCase().replace(/_/g, '-');
    if (l === 'zh') return true;
    return l.indexOf('zh-') === 0;
}

function normalizePublicLang(lang) {
    if (!lang || typeof lang !== 'string') return 'zh-TW';
    var l = lang.trim().toLowerCase().replace(/_/g, '-');
    if (l === 'en' || l.indexOf('en-') === 0) return 'en';
    if (isChineseLocale(l)) return 'zh-TW';
    return 'en';
}

function detectLangFromAcceptLanguage(header) {
    if (!header) return 'zh-TW';
    var parts = String(header).split(',');
    for (var i = 0; i < parts.length; i++) {
        var tag = parts[i].split(';')[0].trim();
        if (isChineseLocale(tag)) return 'zh-TW';
    }
    return 'en';
}

function parseLangFromCookieHeader(cookieHeader) {
    if (!cookieHeader) return '';
    var parts = String(cookieHeader).split(';');
    for (var i = 0; i < parts.length; i++) {
        var seg = parts[i].trim();
        if (!seg) continue;
        var eq = seg.indexOf('=');
        if (eq < 0) continue;
        var k = seg.slice(0, eq).trim();
        if (k !== 'lang') continue;
        try {
            return decodeURIComponent(seg.slice(eq + 1).trim());
        } catch (_) {
            return seg.slice(eq + 1).trim();
        }
    }
    return '';
}

/** 對齊 public/js/i18n.js：?lang= → Cookie lang → Accept-Language → zh-TW */
function resolvePublicLang(opts) {
    opts = opts || {};
    if (opts.queryLang) return normalizePublicLang(opts.queryLang);
    if (opts.cookieLang) return normalizePublicLang(opts.cookieLang);
    if (opts.acceptLanguage) return detectLangFromAcceptLanguage(opts.acceptLanguage);
    return 'zh-TW';
}

function pickLocalizedName(zh, en, lang) {
    lang = normalizePublicLang(lang);
    if (lang === 'en') {
        var e = en != null ? String(en).trim() : '';
        if (e) return e;
    }
    return zh != null ? String(zh).trim() : (en != null ? String(en).trim() : '');
}

module.exports = {
    isChineseLocale: isChineseLocale,
    normalizePublicLang: normalizePublicLang,
    detectLangFromAcceptLanguage: detectLangFromAcceptLanguage,
    parseLangFromCookieHeader: parseLangFromCookieHeader,
    resolvePublicLang: resolvePublicLang,
    pickLocalizedName: pickLocalizedName
};
