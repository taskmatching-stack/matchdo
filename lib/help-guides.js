'use strict';

const publicLang = require('./public-lang');

function escapeHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function sanitizeSlug(raw) {
    var s = String(raw || '').trim().toLowerCase().replace(/_/g, '-');
    s = s.replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    return s.slice(0, 64);
}

function headingId(text) {
    var s = String(text || '').trim().toLowerCase().replace(/\s+/g, '-');
    s = s.replace(/[^\w\u4e00-\u9fff-]/g, '');
    return s.slice(0, 80) || 'section';
}

function parseYoutubeId(raw) {
    var s = String(raw || '').trim();
    if (!s) return '';
    if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
    try {
        var u = new URL(s);
        var host = (u.hostname || '').replace(/^www\./, '');
        if (host === 'youtu.be') return (u.pathname || '').replace(/^\//, '').slice(0, 11);
        if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
            if (u.searchParams.get('v')) return String(u.searchParams.get('v')).slice(0, 11);
            var parts = (u.pathname || '').split('/').filter(Boolean);
            if (parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'live') return String(parts[1] || '').slice(0, 11);
        }
    } catch (_) {}
    return '';
}

function clipUrl(raw) {
    return String(raw || '').trim().slice(0, 2000);
}

function firstNonEmpty() {
    for (var i = 0; i < arguments.length; i++) {
        var s = String(arguments[i] || '').trim();
        if (s) return s;
    }
    return '';
}

/** lang=en|zh；viewport=desktop|mobile。缺檔依 同語系另一視窗 → 另一語系 退。 */
function pickVariant(desktopZh, desktopEn, mobileZh, mobileEn, lang, viewport) {
    var dz = String(desktopZh || '').trim();
    var de = String(desktopEn || '').trim();
    var mz = String(mobileZh || '').trim();
    var me = String(mobileEn || '').trim();
    var isEn = lang === 'en';
    if (viewport === 'mobile') {
        return isEn ? firstNonEmpty(me, de, mz, dz) : firstNonEmpty(mz, dz, me, de);
    }
    return isEn ? firstNonEmpty(de, me, dz, mz) : firstNonEmpty(dz, mz, de, me);
}

function imageHasMedia(b) {
    return !!(b && (b.url_desktop_zh || b.url_desktop_en || b.url_mobile_zh || b.url_mobile_en || b.url));
}

function youtubeHasMedia(b) {
    return !!(b && (b.video_id_desktop_zh || b.video_id_desktop_en || b.video_id_mobile_zh ||
        b.video_id_mobile_en || b.video_id));
}

function pickImageUrl(b, lang, viewport) {
    if (!b) return '';
    var dz = b.url_desktop_zh || b.url || '';
    return pickVariant(dz, b.url_desktop_en, b.url_mobile_zh, b.url_mobile_en, lang, viewport);
}

function pickYoutubeId(b, lang, viewport) {
    if (!b) return '';
    var dz = b.video_id_desktop_zh || b.video_id || '';
    return pickVariant(dz, b.video_id_desktop_en, b.video_id_mobile_zh, b.video_id_mobile_en, lang, viewport);
}

function sanitizeBlocks(raw) {
    var arr = raw;
    if (typeof arr === 'string') {
        try { arr = JSON.parse(arr); } catch (_) { arr = []; }
    }
    if (!Array.isArray(arr)) arr = [];
    return arr.slice(0, 80).map(function (b, i) {
        var type = String((b && b.type) || 'text');
        if (type !== 'text' && type !== 'image' && type !== 'youtube') type = 'text';
        var out = { type: type, sort: i };
        if (type === 'text') {
            out.text = String((b && b.text) || '').slice(0, 20000);
            out.text_en = String((b && b.text_en) || '').slice(0, 20000);
        } else if (type === 'image') {
            var dz = clipUrl((b && b.url_desktop_zh) || (b && b.url));
            out.url_desktop_zh = dz;
            out.url_desktop_en = clipUrl(b && b.url_desktop_en);
            out.url_mobile_zh = clipUrl(b && b.url_mobile_zh);
            out.url_mobile_en = clipUrl(b && b.url_mobile_en);
            out.url = dz;
            out.caption = String((b && b.caption) || '').slice(0, 300);
            out.caption_en = String((b && b.caption_en) || '').slice(0, 300);
        } else {
            var yz = parseYoutubeId((b && (b.video_id_desktop_zh || b.video_id || b.url)) || '');
            out.video_id_desktop_zh = yz;
            out.video_id_desktop_en = parseYoutubeId((b && b.video_id_desktop_en) || '');
            out.video_id_mobile_zh = parseYoutubeId((b && b.video_id_mobile_zh) || '');
            out.video_id_mobile_en = parseYoutubeId((b && b.video_id_mobile_en) || '');
            out.video_id = yz;
        }
        return out;
    }).filter(function (b) {
        if (b.type === 'text') return !!(b.text || b.text_en);
        if (b.type === 'image') return imageHasMedia(b);
        return youtubeHasMedia(b);
    });
}

function pick(zh, en, lang) {
    return publicLang.pickLocalizedName(zh, en, lang);
}

function looksLikeHtml(s) {
    return /<\s*(h2|h3|p|ul|ol|li|strong|a|br)\b/i.test(String(s || ''));
}

function sanitizeHelpHtml(raw) {
    var s = String(raw || '');
    s = s.replace(/<script[\s\S]*?<\/script>/gi, '');
    s = s.replace(/<style[\s\S]*?<\/style>/gi, '');
    s = s.replace(/\sclass="[^"]*"/gi, '');
    s = s.replace(/\sstyle="[^"]*"/gi, '');
    s = s.replace(/on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    s = s.replace(/<\/?(?!h2|h3|p|ul|ol|li|strong|a|br)\w+\b[^>]*>/gi, '');
    s = s.replace(/<a\s+([^>]*?)href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))([^>]*)>/gi, function (_, pre, q, dq, sq, bare) {
        var href = dq || sq || bare || '';
        if (!/^https?:\/\//i.test(href) && !/^\//.test(href)) return '';
        return '<a href="' + escapeHtml(href) + '">';
    });
    return s;
}

function addHeadingAnchors(html) {
    return String(html || '').replace(/<h([23])(\s[^>]*)?>([\s\S]*?)<\/h\1>/gi, function (_, level, attrs, inner) {
        var plain = String(inner).replace(/<[^>]+>/g, '').replace(/\s*#\s*$/, '').trim();
        if (!plain) return '<h' + level + '>' + inner + '</h' + level + '>';
        var id = headingId(plain);
        return '<h' + level + ' id="' + escapeHtml(id) + '">' + inner +
            ' <a class="help-anchor" href="#' + escapeHtml(id) + '" aria-label="copy">#</a></h' + level + '>';
    });
}

function renderHelpText(text, lang) {
    if (!text) return '';
    if (looksLikeHtml(text)) {
        return addHeadingAnchors(sanitizeHelpHtml(text));
    }
    return renderSimpleMarkup(text, lang);
}

function renderSimpleMarkup(md, lang) {
    var src = String(md || '').replace(/\r\n/g, '\n');
    var lines = src.split('\n');
    var html = [];
    var list = [];
    var listTag = 'ul';
    function flushList() {
        if (!list.length) return;
        html.push('<' + listTag + '>' + list.map(function (item) { return '<li>' + inlineFmt(item) + '</li>'; }).join('') + '</' + listTag + '>');
        list = [];
        listTag = 'ul';
    }
    function inlineFmt(s) {
        var e = escapeHtml(s);
        e = e.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        e = e.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (_, label, href) {
            var h = String(href || '').trim();
            if (!/^https?:\/\//i.test(h) && !/^\//.test(h)) return _;
            return '<a href="' + escapeHtml(h) + '">' + escapeHtml(label) + '</a>';
        });
        return e;
    }
    lines.forEach(function (line) {
        var t = line.trim();
        if (!t) {
            flushList();
            return;
        }
        if (/^###\s+/.test(t)) {
            flushList();
            var h3 = t.replace(/^###\s+/, '');
            html.push('<h3 id="' + escapeHtml(headingId(h3)) + '">' + inlineFmt(h3) +
                ' <a class="help-anchor" href="#' + escapeHtml(headingId(h3)) + '" aria-label="copy">#</a></h3>');
            return;
        }
        if (/^##\s+/.test(t)) {
            flushList();
            var h2 = t.replace(/^##\s+/, '');
            html.push('<h2 id="' + escapeHtml(headingId(h2)) + '">' + inlineFmt(h2) +
                ' <a class="help-anchor" href="#' + escapeHtml(headingId(h2)) + '">#</a></h2>');
            return;
        }
        if (/^[-*]\s+/.test(t)) {
            if (list.length && listTag !== 'ul') flushList();
            listTag = 'ul';
            list.push(t.replace(/^[-*]\s+/, ''));
            return;
        }
        if (/^\d+\.\s+/.test(t)) {
            if (list.length && listTag !== 'ol') flushList();
            listTag = 'ol';
            list.push(t.replace(/^\d+\.\s+/, ''));
            return;
        }
        flushList();
        html.push('<p>' + inlineFmt(t) + '</p>');
    });
    flushList();
    return html.join('\n');
}

function youtubeIframeHtml(videoId) {
    return '<div class="help-embed ratio ratio-16x9"><iframe src="https://www.youtube.com/embed/' +
        escapeHtml(videoId) + '" title="YouTube" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>';
}

function renderBlocks(blocks, lang) {
    return sanitizeBlocks(blocks).map(function (b) {
        if (b.type === 'youtube') {
            var yDesk = pickYoutubeId(b, lang, 'desktop');
            var yMob = pickYoutubeId(b, lang, 'mobile');
            if (!yDesk && !yMob) return '';
            if (!yMob || !yDesk || yDesk === yMob) {
                return '<div class="mb-4">' + youtubeIframeHtml(yDesk || yMob) + '</div>';
            }
            return '<div class="help-yt mb-4">' +
                '<div class="d-none d-md-block">' + youtubeIframeHtml(yDesk) + '</div>' +
                '<div class="d-md-none">' + youtubeIframeHtml(yMob) + '</div>' +
                '</div>';
        }
        if (b.type === 'image') {
            var desk = pickImageUrl(b, lang, 'desktop');
            var mob = pickImageUrl(b, lang, 'mobile');
            if (!desk && !mob) return '';
            var cap = pick(b.caption, b.caption_en, lang);
            var img = '<img src="' + escapeHtml(desk || mob) + '" alt="' + escapeHtml(cap) +
                '" class="img-fluid rounded border">';
            if (mob && desk && mob !== desk) {
                img = '<picture>' +
                    '<source media="(max-width: 767.98px)" srcset="' + escapeHtml(mob) + '">' +
                    img +
                    '</picture>';
            }
            return '<figure class="help-figure mb-4">' + img +
                (cap ? ('<figcaption class="small text-muted mt-1">' + escapeHtml(cap) + '</figcaption>') : '') +
                '</figure>';
        }
        var text = pick(b.text, b.text_en, lang);
        return '<div class="help-prose mb-3">' + renderHelpText(text, lang) + '</div>';
    }).join('\n');
}

function pagePath(folderSlug, pageSlug) {
    return '/help/' + folderSlug + '/' + pageSlug;
}

function folderPath(folderSlug) {
    return '/help/' + folderSlug + '/';
}

async function listPublishedTree(supabase) {
    const { data: folders, error: fErr } = await supabase
        .from('help_guide_folders')
        .select('id, slug, title, title_en, sort_order')
        .eq('is_published', true)
        .order('sort_order', { ascending: true });
    if (fErr) throw fErr;
    const { data: pages, error: pErr } = await supabase
        .from('help_guide_pages')
        .select('id, folder_id, slug, title, title_en, summary, summary_en, sort_order')
        .eq('is_published', true)
        .order('sort_order', { ascending: true });
    if (pErr) throw pErr;
    const byFolder = {};
    (pages || []).forEach(function (p) {
        if (!byFolder[p.folder_id]) byFolder[p.folder_id] = [];
        byFolder[p.folder_id].push(p);
    });
    return (folders || []).map(function (f) {
        return Object.assign({}, f, { pages: byFolder[f.id] || [] });
    });
}

async function listPublishedUrls(supabase) {
    const tree = await listPublishedTree(supabase);
    const urls = ['/help/'];
    tree.forEach(function (f) {
        urls.push(folderPath(f.slug));
        (f.pages || []).forEach(function (p) {
            urls.push(pagePath(f.slug, p.slug));
        });
    });
    return urls;
}

async function getPublishedFolder(supabase, folderSlug) {
    const { data, error } = await supabase
        .from('help_guide_folders')
        .select('*')
        .eq('slug', folderSlug)
        .eq('is_published', true)
        .maybeSingle();
    if (error) throw error;
    return data || null;
}

async function getPublishedPage(supabase, folderSlug, pageSlug) {
    const folder = await getPublishedFolder(supabase, folderSlug);
    if (!folder) return null;
    const { data, error } = await supabase
        .from('help_guide_pages')
        .select('*')
        .eq('folder_id', folder.id)
        .eq('slug', pageSlug)
        .eq('is_published', true)
        .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return { folder: folder, page: data };
}

function isMissingTableError(err) {
    if (!err) return false;
    var c = String(err.code || '');
    var m = String(err.message || '');
    return c === '42P01' || c === 'PGRST205' || /does not exist|schema cache/i.test(m);
}

module.exports = {
    escapeHtml: escapeHtml,
    sanitizeSlug: sanitizeSlug,
    headingId: headingId,
    parseYoutubeId: parseYoutubeId,
    sanitizeBlocks: sanitizeBlocks,
    pick: pick,
    looksLikeHtml: looksLikeHtml,
    renderHelpText: renderHelpText,
    pickImageUrl: pickImageUrl,
    pickYoutubeId: pickYoutubeId,
    renderBlocks: renderBlocks,
    pagePath: pagePath,
    folderPath: folderPath,
    listPublishedTree: listPublishedTree,
    listPublishedUrls: listPublishedUrls,
    getPublishedFolder: getPublishedFolder,
    getPublishedPage: getPublishedPage,
    isMissingTableError: isMissingTableError
};
