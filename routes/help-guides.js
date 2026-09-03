'use strict';

const path = require('path');
const hg = require('../lib/help-guides');
const page = require('../lib/help-guides-page');

function sendStaticFallback(res) {
    res.sendFile(path.join(__dirname, '..', 'public', 'help', 'index.html'));
}

function sendMissingHtml(res, lang) {
    var msg = lang === 'en' ? 'This guide is not published.' : '此說明尚未發佈或不存在。';
    res.status(404).type('html').send(
        '<!DOCTYPE html><html lang="' + (lang === 'en' ? 'en' : 'zh-TW') + '"><head><meta charset="utf-8"><title>404</title>' +
        '<link href="/css/bootstrap.min.css" rel="stylesheet"></head><body><div id="site-header"></div>' +
        '<div class="container py-5"><p>' + msg + '</p><p><a href="/help/">← /help/</a></p></div>' +
        '<script src="/config/auth-config.js"><\/script><script src="/js/site-header.js?v=20260903-help"><\/script></body></html>'
    );
}

function folderFields(body) {
    var slug = hg.sanitizeSlug(body && body.slug);
    var title = String((body && body.title) || '').trim().slice(0, 200);
    var title_en = String((body && body.title_en) || '').trim().slice(0, 200);
    var sort_order = parseInt(body && body.sort_order, 10);
    if (!Number.isFinite(sort_order)) sort_order = 0;
    var is_published = !!(body && body.is_published);
    return { slug: slug, title: title, title_en: title_en, sort_order: sort_order, is_published: is_published };
}

function pageFields(body, includeFolder) {
    var out = {
        slug: hg.sanitizeSlug(body && body.slug),
        title: String((body && body.title) || '').trim().slice(0, 200),
        title_en: String((body && body.title_en) || '').trim().slice(0, 200),
        summary: String((body && body.summary) || '').trim().slice(0, 500),
        summary_en: String((body && body.summary_en) || '').trim().slice(0, 500),
        blocks_json: hg.sanitizeBlocks(body && body.blocks_json),
        sort_order: parseInt(body && body.sort_order, 10),
        is_published: !!(body && body.is_published)
    };
    if (!Number.isFinite(out.sort_order)) out.sort_order = 0;
    if (includeFolder) out.folder_id = String((body && body.folder_id) || '').trim();
    return out;
}

function registerHelpGuideRoutes(app, deps) {
    const { supabase, requireAdmin, upload, uploadToSupabaseStorage, BASE_URL, translateHelpGuideToEnglish } = deps;
    const staticHelp = path.join(__dirname, '..', 'public', 'help', 'index.html');

    async function tryPublishedTree() {
        try {
            return await hg.listPublishedTree(supabase);
        } catch (e) {
            if (hg.isMissingTableError(e)) return null;
            throw e;
        }
    }

    app.get(['/help', '/help/'], async (req, res) => {
        try {
            const tree = await tryPublishedTree();
            if (tree == null || !tree.length) return res.sendFile(staticHelp);
            const lang = page.resolveLang(req);
            const html = page.buildIndexHtml({
                base: page.requestBase(req, BASE_URL),
                lang: lang,
                tree: tree
            });
            res.set('Content-Type', 'text/html; charset=utf-8');
            res.set('Cache-Control', 'public, max-age=60');
            res.send(html);
        } catch (e) {
            console.error('GET /help/:', e);
            sendStaticFallback(res);
        }
    });

    app.get('/help/:folder', (req, res, next) => {
        if (/\./.test(String(req.params.folder || ''))) return next();
        var slug = hg.sanitizeSlug(req.params.folder);
        if (!slug) return res.redirect(302, '/help/');
        var q = req.url.indexOf('?') >= 0 ? req.url.slice(req.url.indexOf('?')) : '';
        res.redirect(301, '/help/' + slug + '/' + q);
    });

    app.get('/help/:folder/', async (req, res) => {
        const lang = page.resolveLang(req);
        try {
            const folderSlug = hg.sanitizeSlug(req.params.folder);
            if (!folderSlug) return res.redirect(302, '/help/');
            const folder = await hg.getPublishedFolder(supabase, folderSlug);
            if (!folder) return sendMissingHtml(res, lang);
            const tree = await hg.listPublishedTree(supabase);
            const node = (tree || []).find(function (f) { return f.id === folder.id; });
            const html = page.buildFolderHtml({
                base: page.requestBase(req, BASE_URL),
                lang: lang,
                folder: folder,
                pages: (node && node.pages) || []
            });
            res.set('Content-Type', 'text/html; charset=utf-8');
            res.set('Cache-Control', 'public, max-age=60');
            res.send(html);
        } catch (e) {
            if (hg.isMissingTableError(e)) return sendStaticFallback(res);
            console.error('GET /help/:folder/:', e);
            res.status(500).send('伺服器錯誤');
        }
    });

    app.get('/help/:folder/:page', async (req, res) => {
        const lang = page.resolveLang(req);
        try {
            const folderSlug = hg.sanitizeSlug(req.params.folder);
            const pageSlug = hg.sanitizeSlug(req.params.page);
            if (!folderSlug || !pageSlug) return sendMissingHtml(res, lang);
            const found = await hg.getPublishedPage(supabase, folderSlug, pageSlug);
            if (!found) return sendMissingHtml(res, lang);
            const tree = await hg.listPublishedTree(supabase);
            const node = (tree || []).find(function (f) { return f.id === found.folder.id; });
            const html = page.buildArticleHtml({
                base: page.requestBase(req, BASE_URL),
                lang: lang,
                folder: found.folder,
                page: found.page,
                pages: (node && node.pages) || []
            });
            res.set('Content-Type', 'text/html; charset=utf-8');
            res.set('Cache-Control', 'public, max-age=60');
            res.send(html);
        } catch (e) {
            if (hg.isMissingTableError(e)) return sendStaticFallback(res);
            console.error('GET /help/:folder/:page:', e);
            res.status(500).send('伺服器錯誤');
        }
    });

    app.get('/api/admin/help-guides', async (req, res) => {
        try {
            if (!(await requireAdmin(req, res))) return;
            const { data: folders, error: fErr } = await supabase
                .from('help_guide_folders')
                .select('*')
                .order('sort_order', { ascending: true });
            if (fErr) throw fErr;
            const { data: pages, error: pErr } = await supabase
                .from('help_guide_pages')
                .select('*')
                .order('sort_order', { ascending: true });
            if (pErr) throw pErr;
            const byFolder = {};
            (pages || []).forEach(function (p) {
                if (!byFolder[p.folder_id]) byFolder[p.folder_id] = [];
                byFolder[p.folder_id].push(p);
            });
            res.json({
                folders: (folders || []).map(function (f) {
                    return Object.assign({}, f, { pages: byFolder[f.id] || [] });
                })
            });
        } catch (e) {
            if (hg.isMissingTableError(e)) {
                return res.status(503).json({ error: '請先在資料庫維護執行 help-guides' });
            }
            console.error('GET /api/admin/help-guides:', e);
            res.status(500).json({ error: e.message || '載入失敗' });
        }
    });

    app.post('/api/admin/help-guides/folders', async (req, res) => {
        try {
            if (!(await requireAdmin(req, res))) return;
            const f = folderFields(req.body || {});
            if (!f.slug || !f.title) return res.status(400).json({ error: '請填 slug 與名稱' });
            const { data, error } = await supabase.from('help_guide_folders').insert(f).select('*').single();
            if (error) throw error;
            res.json({ folder: data });
        } catch (e) {
            console.error('POST help-guides/folders:', e);
            res.status(400).json({ error: e.message || '新增失敗' });
        }
    });

    app.patch('/api/admin/help-guides/folders/:id', async (req, res) => {
        try {
            if (!(await requireAdmin(req, res))) return;
            const id = String(req.params.id || '').trim();
            const f = folderFields(req.body || {});
            if (!f.slug || !f.title) return res.status(400).json({ error: '請填 slug 與名稱' });
            f.updated_at = new Date().toISOString();
            const { data, error } = await supabase.from('help_guide_folders').update(f).eq('id', id).select('*').single();
            if (error) throw error;
            res.json({ folder: data });
        } catch (e) {
            console.error('PATCH help-guides/folders:', e);
            res.status(400).json({ error: e.message || '儲存失敗' });
        }
    });

    app.delete('/api/admin/help-guides/folders/:id', async (req, res) => {
        try {
            if (!(await requireAdmin(req, res))) return;
            const id = String(req.params.id || '').trim();
            const { error } = await supabase.from('help_guide_folders').delete().eq('id', id);
            if (error) throw error;
            res.json({ ok: true });
        } catch (e) {
            console.error('DELETE help-guides/folders:', e);
            res.status(400).json({ error: e.message || '刪除失敗' });
        }
    });

    app.post('/api/admin/help-guides/pages', async (req, res) => {
        try {
            if (!(await requireAdmin(req, res))) return;
            const p = pageFields(req.body || {}, true);
            if (!p.folder_id || !p.slug || !p.title) return res.status(400).json({ error: '請填資料夾、slug 與標題' });
            const { data, error } = await supabase.from('help_guide_pages').insert(p).select('*').single();
            if (error) throw error;
            res.json({ page: data });
        } catch (e) {
            console.error('POST help-guides/pages:', e);
            res.status(400).json({ error: e.message || '新增失敗' });
        }
    });

    app.patch('/api/admin/help-guides/pages/:id', async (req, res) => {
        try {
            if (!(await requireAdmin(req, res))) return;
            const id = String(req.params.id || '').trim();
            const p = pageFields(req.body || {}, false);
            if (!p.slug || !p.title) return res.status(400).json({ error: '請填 slug 與標題' });
            p.updated_at = new Date().toISOString();
            const { data, error } = await supabase.from('help_guide_pages').update(p).eq('id', id).select('*').single();
            if (error) throw error;
            res.json({ page: data });
        } catch (e) {
            console.error('PATCH help-guides/pages:', e);
            res.status(400).json({ error: e.message || '儲存失敗' });
        }
    });

    app.delete('/api/admin/help-guides/pages/:id', async (req, res) => {
        try {
            if (!(await requireAdmin(req, res))) return;
            const id = String(req.params.id || '').trim();
            const { error } = await supabase.from('help_guide_pages').delete().eq('id', id);
            if (error) throw error;
            res.json({ ok: true });
        } catch (e) {
            console.error('DELETE help-guides/pages:', e);
            res.status(400).json({ error: e.message || '刪除失敗' });
        }
    });

    app.post('/api/admin/help-guides/upload', upload.single('file'), async (req, res) => {
        try {
            if (!(await requireAdmin(req, res))) return;
            const file = req.file;
            if (!file || !file.buffer) return res.status(400).json({ error: '請選擇檔案' });
            const mime = String(file.mimetype || '').toLowerCase();
            const isGif = mime === 'image/gif';
            const isImg = mime === 'image/jpeg' || mime === 'image/png' || mime === 'image/webp' || isGif;
            if (!isImg) return res.status(400).json({ error: '僅支援 JPG／PNG／WebP／GIF' });
            const max = isGif ? 8 * 1024 * 1024 : 2.5 * 1024 * 1024;
            if (file.size > max) return res.status(400).json({ error: isGif ? 'GIF 請小於 8MB' : '圖片請小於 2.5MB' });
            const ext = isGif ? 'gif' : (mime === 'image/png' ? 'png' : (mime === 'image/webp' ? 'webp' : 'jpg'));
            const uploaded = await uploadToSupabaseStorage(
                'custom-products',
                'help-guides',
                file,
                { ext: ext, contentType: mime, skipNormalize: isGif }
            );
            res.json({ url: uploaded.publicUrl });
        } catch (e) {
            console.error('POST help-guides/upload:', e);
            res.status(500).json({ error: e.message || '上傳失敗' });
        }
    });

    app.post('/api/admin/help-guides/translate', async (req, res) => {
        try {
            if (!(await requireAdmin(req, res))) return;
            if (typeof translateHelpGuideToEnglish !== 'function') {
                return res.status(500).json({ error: '翻譯未設定' });
            }
            const out = await translateHelpGuideToEnglish(req.body || {});
            res.json(out);
        } catch (e) {
            console.error('POST help-guides/translate:', e);
            res.status(400).json({ error: e.message || '翻譯失敗' });
        }
    });
}

module.exports = { registerHelpGuideRoutes };
