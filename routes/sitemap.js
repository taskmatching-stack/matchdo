'use strict';

/**
 * Sitemap 與 robots.txt（由 server.js 掛載，須在 express.static 之前）
 */
function registerSitemapRoutes(app, deps) {
    const { supabase, BASE_URL } = deps;

    // GET /sitemap.xml — SEO 用網站地圖「索引」；子 sitemap 持續由 DB/靜態清單更新（見 docs/sitemap.md）
    // 首頁：全部(/) + 三種 layout_type + 中英文變體（與 hreflang 對應，利於收錄）
    const SITEMAP_PAGES = [
        { path: '/',                        priority: '1.0', changefreq: 'weekly' },
        { path: '/?layout_type=user_design', priority: '0.9', changefreq: 'weekly' },
        { path: '/?layout_type=comparison', priority: '0.9', changefreq: 'weekly' },
        { path: '/?layout_type=collection', priority: '0.9', changefreq: 'weekly' },
        { path: '/?lang=en',                priority: '0.95', changefreq: 'weekly' },
        { path: '/?layout_type=user_design&lang=en', priority: '0.9', changefreq: 'weekly' },
        { path: '/?layout_type=comparison&lang=en',  priority: '0.9', changefreq: 'weekly' },
        { path: '/?layout_type=collection&lang=en',  priority: '0.9', changefreq: 'weekly' },
        { path: '/custom/',                 priority: '0.9', changefreq: 'weekly' },
        { path: '/custom/gallery.html',     priority: '0.9', changefreq: 'weekly' },
        { path: '/remake/',                 priority: '0.9', changefreq: 'weekly' },
        { path: '/subscription-plans.html', priority: '0.8', changefreq: 'monthly' },
        { path: '/custom-product.html',     priority: '0.8', changefreq: 'monthly' },
        { path: '/custom-product.html?tab=scene-sim',     priority: '0.8', changefreq: 'monthly' },
        { path: '/custom-product.html?tab=pattern-extract', priority: '0.8', changefreq: 'monthly' },
        { path: '/remake-product.html',     priority: '0.8', changefreq: 'monthly' },
        { path: '/about.html',              priority: '0.6', changefreq: 'yearly' },
        { path: '/contact.html',            priority: '0.6', changefreq: 'yearly' },
        { path: '/login.html',              priority: '0.3', changefreq: 'yearly' },
        { path: '/register.html',           priority: '0.3', changefreq: 'yearly' }
        // 移除無實際內容的 iStudio 範本殼頁：service / feature / project / testimonial / team
        // credits.html 為登入後才有意義的頁面，不列入公開索引
    ];
    function escapeXml(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
    }
    // Sitemap 索引：pages / categories / vendors / collections / inspiration（2026-05-26 起不列入 products，見 docs/SEO-PROGRESS.md）
    app.get('/sitemap.xml', (req, res) => {
        const base = (BASE_URL || '').replace(/\/$/, '');
        const now = new Date().toISOString().slice(0, 10);
        const entries = [
            '<sitemap><loc>' + escapeXml(base + '/sitemap-pages.xml') + '</loc><lastmod>' + now + '</lastmod></sitemap>',
            '<sitemap><loc>' + escapeXml(base + '/sitemap-categories.xml') + '</loc><lastmod>' + now + '</lastmod></sitemap>',
            '<sitemap><loc>' + escapeXml(base + '/sitemap-vendors.xml') + '</loc><lastmod>' + now + '</lastmod></sitemap>',
            // sitemap-products.xml 路由保留（舊連結），但不納入索引；UGC 以 sitemap-inspiration + /inspiration/* 為準
            '<sitemap><loc>' + escapeXml(base + '/sitemap-collections.xml') + '</loc><lastmod>' + now + '</lastmod></sitemap>',
            '<sitemap><loc>' + escapeXml(base + '/sitemap-inspiration.xml') + '</loc><lastmod>' + now + '</lastmod></sitemap>'
        ];
        const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  ' + entries.join('\n  ') + '\n</sitemapindex>';
        res.set('Content-Type', 'application/xml; charset=utf-8');
        res.set('Cache-Control', 'public, max-age=3600');
        res.send(xml);
    });
    // 靜態／半靜態公開頁（固定清單）
    app.get('/sitemap-pages.xml', (req, res) => {
        const base = (BASE_URL || '').replace(/\/$/, '');
        const lastmod = new Date().toISOString().slice(0, 10);
        const urls = SITEMAP_PAGES.map(p => {
            const loc = p.path === '/' ? base + '/' : base + p.path;
            return '  <url><loc>' + escapeXml(loc) + '</loc><lastmod>' + lastmod + '</lastmod><changefreq>' + (p.changefreq || 'monthly') + '</changefreq><priority>' + (p.priority || '0.5') + '</priority></url>';
        }).join('\n');
        const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls + '\n</urlset>';
        res.set('Content-Type', 'application/xml; charset=utf-8');
        res.set('Cache-Control', 'public, max-age=3600');
        res.send(xml);
    });
    // 動態：首頁「分類」篩選 URL（ai_categories 主分類，/?category_key=xxx），與 layout_type／lang 可疊加
    app.get('/sitemap-categories.xml', async (req, res) => {
        const base = (BASE_URL || '').replace(/\/$/, '');
        const lastmod = new Date().toISOString().slice(0, 10);
        const urls = [];
        try {
            const { data: rows, error } = await supabase.from('ai_categories').select('key, sort_order').order('sort_order', { ascending: true });
            if (!error && Array.isArray(rows) && rows.length > 0) {
                rows.forEach(r => {
                    if (r && r.key) {
                        const loc = base + '/?category_key=' + encodeURIComponent(r.key);
                        urls.push('  <url><loc>' + escapeXml(loc) + '</loc><lastmod>' + lastmod + '</lastmod><changefreq>weekly</changefreq><priority>0.85</priority></url>');
                    }
                });
            }
        } catch (e) {
            console.warn('sitemap-categories.xml 查詢 ai_categories 失敗:', e && e.message);
        }
        const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.join('\n') + '\n</urlset>';
        res.set('Content-Type', 'application/xml; charset=utf-8');
        res.set('Cache-Control', 'public, max-age=3600');
        res.send(xml);
    });
    // 動態：廠商／製作方列表與詳情頁（由 DB 查詢，每次請求即時更新，新會員/作品上線即被收錄）
    app.get('/sitemap-vendors.xml', async (req, res) => {
        const base = (BASE_URL || '').replace(/\/$/, '');
        const today = new Date().toISOString().slice(0, 10);
        const urls = [];
        urls.push('  <url><loc>' + escapeXml(base + '/vendors.html') + '</loc><lastmod>' + today + '</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>');
        try {
            const { data: rows } = await supabase
                .from('manufacturers')
                .select('id, updated_at, created_at')
                .eq('is_active', true);
            const list = rows || [];
            for (const r of list) {
                const lastmod = (r.updated_at || r.created_at) ? new Date(r.updated_at || r.created_at).toISOString().slice(0, 10) : today;
                urls.push('  <url><loc>' + escapeXml(base + '/vendor-profile.html?id=' + encodeURIComponent(r.id)) + '</loc><lastmod>' + lastmod + '</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>');
            }
        } catch (e) {
            console.error('sitemap-vendors:', e);
        }
        const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.join('\n') + '\n</urlset>';
        res.set('Content-Type', 'application/xml; charset=utf-8');
        res.set('Cache-Control', 'public, max-age=1800');
        res.send(xml);
    });

    // Legacy：CSR 詳情頁（visibility 欄位未齊）；已自 /sitemap.xml 索引移除，Step 4 前勿擴充
    app.get('/sitemap-products.xml', async (req, res) => {
        const base = (BASE_URL || '').replace(/\/$/, '');
        const today = new Date().toISOString().slice(0, 10);
        const urls = [];
        try {
            const { data: rows } = await supabase
                .from('custom_products')
                .select('id, updated_at, created_at')
                .eq('visibility', 'public');
            for (const r of (rows || [])) {
                const lastmod = (r.updated_at || r.created_at) ? new Date(r.updated_at || r.created_at).toISOString().slice(0, 10) : today;
                urls.push('  <url><loc>' + escapeXml(base + '/custom-product-detail.html?id=' + encodeURIComponent(r.id)) + '</loc><lastmod>' + lastmod + '</lastmod><changefreq>monthly</changefreq><priority>0.5</priority></url>');
            }
        } catch (e) {
            console.error('sitemap-products:', e);
        }
        const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.join('\n') + '\n</urlset>';
        res.set('Content-Type', 'application/xml; charset=utf-8');
        res.set('Cache-Control', 'public, max-age=1800');
        res.send(xml);
    });

    // 動態：作品資料夾系列頁（media_collections，is_active=true，以 slug 為 URL 參數）
    app.get('/sitemap-collections.xml', async (req, res) => {
        const base = (BASE_URL || '').replace(/\/$/, '');
        const today = new Date().toISOString().slice(0, 10);
        const urls = [];
        try {
            const { data: rows } = await supabase
                .from('media_collections')
                .select('slug, updated_at, created_at')
                .eq('is_active', true);
            for (const r of (rows || [])) {
                if (!r.slug) continue;
                const lastmod = (r.updated_at || r.created_at) ? new Date(r.updated_at || r.created_at).toISOString().slice(0, 10) : today;
                urls.push('  <url><loc>' + escapeXml(base + '/custom/collection.html?slug=' + encodeURIComponent(r.slug)) + '</loc><lastmod>' + lastmod + '</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>');
            }
        } catch (e) {
            console.error('sitemap-collections:', e);
        }
        const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.join('\n') + '\n</urlset>';
        res.set('Content-Type', 'application/xml; charset=utf-8');
        res.set('Cache-Control', 'public, max-age=1800');
        res.send(xml);
    });

    // 動態：靈感牆單一作品獨立 URL（/inspiration/:type/:id），收錄近期作品供搜尋引擎索引
    const SITEMAP_INSPIRATION_LIMIT = 150; // 單一 sitemap 建議不超過 5000，此處保守取 150
    app.get('/sitemap-inspiration.xml', async (req, res) => {
        const base = (BASE_URL || '').replace(/\/$/, '');
        const today = new Date().toISOString().slice(0, 10);
        const urls = [];
        try {
            const { data: userRows } = await supabase
                .from('custom_products')
                .select('id, updated_at, created_at')
                .not('ai_generated_image_url', 'is', null)
                .or('show_on_homepage.eq.true,show_on_homepage.is.null')
                .order('created_at', { ascending: false })
                .limit(50);
            for (const r of (userRows || [])) {
                const lastmod = (r.updated_at || r.created_at) ? new Date(r.updated_at || r.created_at).toISOString().slice(0, 10) : today;
                urls.push('  <url><loc>' + escapeXml(base + '/inspiration/user_design/' + encodeURIComponent(r.id)) + '</loc><lastmod>' + lastmod + '</lastmod><changefreq>monthly</changefreq><priority>0.5</priority></url>');
            }
            const { data: portRows } = await supabase
                .from('manufacturer_portfolio')
                .select('id, image_url_before, updated_at, created_at')
                .eq('show_on_media_wall', true)
                .order('created_at', { ascending: false })
                .limit(60);
            for (const r of (portRows || [])) {
                const type = r.image_url_before ? 'comparison' : 'series';
                const lastmod = (r.updated_at || r.created_at) ? new Date(r.updated_at || r.created_at).toISOString().slice(0, 10) : today;
                urls.push('  <url><loc>' + escapeXml(base + '/inspiration/' + type + '/' + encodeURIComponent(r.id)) + '</loc><lastmod>' + lastmod + '</lastmod><changefreq>monthly</changefreq><priority>0.5</priority></url>');
            }
            const { data: collRows } = await supabase
                .from('media_collections')
                .select('id, updated_at, created_at')
                .eq('is_active', true)
                .order('sort_order', { ascending: true })
                .order('created_at', { ascending: false })
                .limit(40);
            for (const r of (collRows || [])) {
                const lastmod = (r.updated_at || r.created_at) ? new Date(r.updated_at || r.created_at).toISOString().slice(0, 10) : today;
                urls.push('  <url><loc>' + escapeXml(base + '/inspiration/collection/' + encodeURIComponent(r.id)) + '</loc><lastmod>' + lastmod + '</lastmod><changefreq>weekly</changefreq><priority>0.5</priority></url>');
            }
            if (urls.length > SITEMAP_INSPIRATION_LIMIT) urls.length = SITEMAP_INSPIRATION_LIMIT;
        } catch (e) {
            console.warn('sitemap-inspiration.xml:', e && e.message);
        }
        const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.join('\n') + '\n</urlset>';
        res.set('Content-Type', 'application/xml; charset=utf-8');
        res.set('Cache-Control', 'public, max-age=1800');
        res.send(xml);
    });

    // GET /robots.txt — 告知搜尋引擎 Sitemap 位置並限制爬取範圍（SEO）
    app.get('/robots.txt', (req, res) => {
        const base = (BASE_URL || '').replace(/\/$/, '');
        const body = 'User-agent: *\nDisallow: /admin/\nDisallow: /api/\nDisallow: /payment/\nAllow: /\n\nSitemap: ' + base + '/sitemap.xml\n';
        res.set('Content-Type', 'text/plain; charset=utf-8');
        res.set('Cache-Control', 'public, max-age=86400');
        res.send(body);
    });
}

module.exports = { registerSitemapRoutes };
