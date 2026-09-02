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
            out.url = String((b && b.url) || '').slice(0, 2000);
            out.caption = String((b && b.caption) || '').slice(0, 300);
            out.caption_en = String((b && b.caption_en) || '').slice(0, 300);
        } else {
            out.video_id = parseYoutubeId((b && (b.video_id || b.url)) || '');
        }
        return out;
    }).filter(function (b) {
        if (b.type === 'text') return !!(b.text || b.text_en);
        if (b.type === 'image') return !!b.url;
        return !!b.video_id;
    });
}

function pick(zh, en, lang) {
    return publicLang.pickLocalizedName(zh, en, lang);
}

function renderSimpleMarkup(md, lang) {
    var src = String(md || '').replace(/\r\n/g, '\n');
    var lines = src.split('\n');
    var html = [];
    var list = [];
    function flushList() {
        if (!list.length) return;
        html.push('<ul>' + list.map(function (item) { return '<li>' + inlineFmt(item) + '</li>'; }).join('') + '</ul>');
        list = [];
    }
    function inlineFmt(s) {
        var e = escapeHtml(s);
        return e.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
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
            list.push(t.replace(/^[-*]\s+/, ''));
            return;
        }
        flushList();
        html.push('<p>' + inlineFmt(t) + '</p>');
    });
    flushList();
    return html.join('\n');
}

function renderBlocks(blocks, lang) {
    return sanitizeBlocks(blocks).map(function (b) {
        if (b.type === 'youtube' && b.video_id) {
            return '<div class="help-embed ratio ratio-16x9 mb-4"><iframe src="https://www.youtube.com/embed/' +
                escapeHtml(b.video_id) + '" title="YouTube" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>';
        }
        if (b.type === 'image' && b.url) {
            var cap = pick(b.caption, b.caption_en, lang);
            return '<figure class="help-figure mb-4"><img src="' + escapeHtml(b.url) + '" alt="' + escapeHtml(cap) +
                '" class="img-fluid rounded border">' +
                (cap ? ('<figcaption class="small text-muted mt-1">' + escapeHtml(cap) + '</figcaption>') : '') +
                '</figure>';
        }
        var text = pick(b.text, b.text_en, lang);
        return '<div class="help-prose mb-3">' + renderSimpleMarkup(text, lang) + '</div>';
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
    renderBlocks: renderBlocks,
    pagePath: pagePath,
    folderPath: folderPath,
    listPublishedTree: listPublishedTree,
    listPublishedUrls: listPublishedUrls,
    getPublishedFolder: getPublishedFolder,
    getPublishedPage: getPublishedPage,
    isMissingTableError: isMissingTableError
};
