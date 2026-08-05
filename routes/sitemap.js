'use strict';

/**
 * Sitemap 與 robots.txt（由 server.js 掛載，須在 express.static 之前）
 */
function resolveSitemapBase(BASE_URL) {
    const strip = (u) => String(u || '').trim().replace(/\/$/, '');
    const publicSite = strip(process.env.PUBLIC_SITE_URL);
    if (publicSite) return publicSite;
    const base = strip(BASE_URL);
    if (base) {
        try {
            const host = new URL(base).hostname || '';
            if (/\.run\.app$/i.test(host)) return 'https://matchdo.cc';
        } catch (_) { /* ignore */ }
        return base;
    }
    return 'https://matchdo.cc';
}

function registerSitemapRoutes(app, deps) {
    const { supabase, BASE_URL } = deps;

    // GET /sitemap.xml — SEO 用網站地圖「索引」；子 sitemap 持續由 DB/靜態清單更新（見 docs/sitemap.md）
    // 公開 landing（/client/* 工作區不列入，見 architecture-and-seo-principles §2.1 D）
    const SITEMAP_PAGES = [
        { path: '/',                        priority: '1.0', changefreq: 'weekly' },
        { path: '/?lang=en',                priority: '0.95', changefreq: 'weekly' },
        { path: '/custom/',                 priority: '0.9', changefreq: 'weekly' },
        { path: '/custom/gallery.html',     priority: '0.9', changefreq: 'weekly' },
        { path: '/design-direction/',       priority: '0.9', changefreq: 'weekly' },
        { path: '/subscription-plans.html', priority: '0.8', changefreq: 'monthly' },
        { path: '/custom-product.html',     priority: '0.8', changefreq: 'monthly' },
        { path: '/custom-product.html?tab=scene-sim',     priority: '0.8', changefreq: 'monthly' },
        { path: '/custom-product.html?tab=promo-image',  priority: '0.8', changefreq: 'monthly' },
        { path: '/custom-product.html?tab=design-to-physical', priority: '0.8', changefreq: 'monthly' },
        { path: '/custom-product.html?tab=vendor-styles', priority: '0.8', changefreq: 'monthly' },
        // 官方版型：真列表 /official-templates/（勿再用設計頁 ?browse=official 當 SEO 落地）
        { path: '/official-templates/',           priority: '0.8', changefreq: 'weekly' },
        { path: '/custom-product.html?tab=pattern-extract', priority: '0.8', changefreq: 'monthly' },
        { path: '/promo-camera',            priority: '0.75', changefreq: 'monthly' },
        { path: '/promo-camera-app',        priority: '0.72', changefreq: 'monthly' },
        { path: '/client/ai-edit.html',     priority: '0.75', changefreq: 'monthly' },
        { path: '/client/ai-upscale.html',  priority: '0.75', changefreq: 'monthly' },
        { path: '/client/material-dual-color.html', priority: '0.75', changefreq: 'monthly' },
        { path: '/client/print-asset.html', priority: '0.75', changefreq: 'monthly' },
        { path: '/client/supplier-portal.html', priority: '0.7', changefreq: 'monthly' },
        { path: '/client/industry-supplier-dashboard.html', priority: '0.7', changefreq: 'monthly' },
        { path: '/client/vendor-prototype-insights.html', priority: '0.65', changefreq: 'monthly' },
        { path: '/product-tree.html', priority: '0.68', changefreq: 'monthly' },
        { path: '/design-direction/analysis.html',     priority: '0.8', changefreq: 'monthly' },
        { path: '/help/',                   priority: '0.65', changefreq: 'monthly' },
        { path: '/vendors.html',            priority: '0.8', changefreq: 'weekly' },
        { path: '/about.html',              priority: '0.6', changefreq: 'yearly' },
        { path: '/contact.html',            priority: '0.6', changefreq: 'yearly' }
        // 不含 login/register（低價值）；不含首頁 layout_type 變體（避免 dirty sitemap 耗 crawl budget）
    ];
    function escapeXml(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
    }
    function siteBase() {
        return resolveSitemapBase(BASE_URL);
    }
    // Sitemap 索引：pages / categories / vendors / collections / inspiration（2026-05-26 起不列入 products，見 docs/SEO-PROGRESS.md）
    app.get('/sitemap.xml', (req, res) => {
        const base = siteBase();
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
        const base = siteBase();
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
    // 動態：首頁分類 + 版型庫 tab 分類 landing（/?category_key= 與 custom-product?tab=vendor-styles&…）
    app.get('/sitemap-categories.xml', async (req, res) => {
        const base = siteBase();
        const lastmod = new Date().toISOString().slice(0, 10);
        const urls = [];
        function pushVendorStylesUrl(catKey, subKey, official) {
            if (official) {
                const params = new URLSearchParams();
                if (catKey) params.set('category_key', catKey);
                if (subKey) params.set('subcategory_key', subKey);
                const q = params.toString();
                const loc = base + '/official-templates/' + (q ? ('?' + q) : '');
                urls.push('  <url><loc>' + escapeXml(loc) + '</loc><lastmod>' + lastmod + '</lastmod><changefreq>weekly</changefreq><priority>0.75</priority></url>');
                return;
            }
            const params = new URLSearchParams();
            params.set('tab', 'vendor-styles');
            params.set('category_key', catKey);
            if (subKey) params.set('subcategory_key', subKey);
            const loc = base + '/custom-product.html?' + params.toString();
            urls.push('  <url><loc>' + escapeXml(loc) + '</loc><lastmod>' + lastmod + '</lastmod><changefreq>weekly</changefreq><priority>0.72</priority></url>');
        }
        try {
            const { data: rows, error } = await supabase.from('custom_product_categories').select('key, sort_order').eq('is_active', true).order('sort_order', { ascending: true });
            if (!error && Array.isArray(rows) && rows.length > 0) {
                rows.forEach(r => {
                    if (r && r.key) {
                        const loc = base + '/?category_key=' + encodeURIComponent(r.key);
                        urls.push('  <url><loc>' + escapeXml(loc) + '</loc><lastmod>' + lastmod + '</lastmod><changefreq>weekly</changefreq><priority>0.85</priority></url>');
                        pushVendorStylesUrl(r.key, '', false);
                        pushVendorStylesUrl(r.key, '', true);
                    }
                });
            }
            const { data: subRows, error: subErr } = await supabase
                .from('custom_product_subcategories')
                .select('category_key, key, sort_order')
                .eq('is_active', true)
                .order('category_key', { ascending: true })
                .order('sort_order', { ascending: true });
            if (!subErr && Array.isArray(subRows)) {
                subRows.forEach(s => {
                    if (s && s.category_key && s.key) {
                        pushVendorStylesUrl(s.category_key, s.key, false);
                        pushVendorStylesUrl(s.category_key, s.key, true);
                    }
                });
            }
        } catch (e) {
            console.warn('sitemap-categories.xml 查詢 custom_product_categories 失敗:', e && e.message);
        }
        const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.join('\n') + '\n</urlset>';
        res.set('Content-Type', 'application/xml; charset=utf-8');
        res.set('Cache-Control', 'public, max-age=3600');
        res.send(xml);
    });
    const SITEMAP_PRODUCT_TREE_LIMIT = 200;
    const SITEMAP_SUPPLIER_CATALOG_LIMIT = 100;
    // 動態：廠商／製作方列表與詳情頁；產業供應商目錄 landing；公開主產品「看可搭配」guide
    app.get('/sitemap-vendors.xml', async (req, res) => {
        const base = siteBase();
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
            const { data: supRows } = await supabase
                .from('industry_suppliers')
                .select('id, updated_at, created_at')
                .eq('is_active', true)
                .order('updated_at', { ascending: false })
                .limit(SITEMAP_SUPPLIER_CATALOG_LIMIT);
            for (const r of (supRows || [])) {
                if (!r || !r.id) continue;
                const lastmod = (r.updated_at || r.created_at) ? new Date(r.updated_at || r.created_at).toISOString().slice(0, 10) : today;
                const loc = base + '/client/industry-supplier-catalog.html?supplier_id=' + encodeURIComponent(r.id);
                urls.push('  <url><loc>' + escapeXml(loc) + '</loc><lastmod>' + lastmod + '</lastmod><changefreq>monthly</changefreq><priority>0.58</priority></url>');
            }
            const { data: protoRows } = await supabase
                .from('vendor_assets')
                .select('id, updated_at, created_at, asset_kind, is_public')
                .eq('is_public', true)
                .order('updated_at', { ascending: false })
                .limit(SITEMAP_PRODUCT_TREE_LIMIT + 40);
            let productTreeCount = 0;
            for (const r of (protoRows || [])) {
                if (!r || !r.id) continue;
                const kind = String(r.asset_kind || '').toLowerCase();
                if (kind !== 'prototype') continue;
                if (productTreeCount >= SITEMAP_PRODUCT_TREE_LIMIT) break;
                productTreeCount += 1;
                const lastmod = (r.updated_at || r.created_at) ? new Date(r.updated_at || r.created_at).toISOString().slice(0, 10) : today;
                const loc = base + '/product-tree.html?prototype_asset_id=' + encodeURIComponent(r.id);
                urls.push('  <url><loc>' + escapeXml(loc) + '</loc><lastmod>' + lastmod + '</lastmod><changefreq>monthly</changefreq><priority>0.55</priority></url>');
            }
        } catch (e) {
            console.error('sitemap-vendors:', e);
        }
        const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.join('\n') + '\n</urlset>';
        res.set('Content-Type', 'application/xml; charset=utf-8');
        res.set('Cache-Control', 'public, max-age=1800');
        res.send(xml);
    });

    // Legacy：已自 /sitemap.xml 索引移除；若直接請求則輸出與 inspiration 相同條件的 /inspiration/user_design/*（不用 visibility）
    app.get('/sitemap-products.xml', async (req, res) => {
        const base = siteBase();
        const today = new Date().toISOString().slice(0, 10);
        const urls = [];
        try {
            const { data: rows } = await supabase
                .from('custom_products')
                .select('id, updated_at, created_at')
                .not('ai_generated_image_url', 'is', null)
                .or('show_on_homepage.eq.true,show_on_homepage.is.null')
                .order('created_at', { ascending: false })
                .limit(50);
            for (const r of (rows || [])) {
                const lastmod = (r.updated_at || r.created_at) ? new Date(r.updated_at || r.created_at).toISOString().slice(0, 10) : today;
                urls.push('  <url><loc>' + escapeXml(base + '/inspiration/user_design/' + encodeURIComponent(r.id)) + '</loc><lastmod>' + lastmod + '</lastmod><changefreq>monthly</changefreq><priority>0.5</priority></url>');
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
        const base = siteBase();
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
    const SITEMAP_INSPIRATION_LIMIT = 500;
    app.get('/sitemap-inspiration.xml', async (req, res) => {
        const base = siteBase();
        const today = new Date().toISOString().slice(0, 10);
        const urls = [];
        try {
            const { data: userRows } = await supabase
                .from('custom_products')
                .select('id, updated_at, created_at')
                .not('ai_generated_image_url', 'is', null)
                .or('show_on_homepage.eq.true,show_on_homepage.is.null')
                .order('created_at', { ascending: false })
                .limit(80);
            for (const r of (userRows || [])) {
                const lastmod = (r.updated_at || r.created_at) ? new Date(r.updated_at || r.created_at).toISOString().slice(0, 10) : today;
                urls.push('  <url><loc>' + escapeXml(base + '/inspiration/user_design/' + encodeURIComponent(r.id)) + '</loc><lastmod>' + lastmod + '</lastmod><changefreq>monthly</changefreq><priority>0.5</priority></url>');
            }
            const { data: portRows } = await supabase
                .from('manufacturer_portfolio')
                .select('id, image_url_before, updated_at, created_at')
                .eq('show_on_media_wall', true)
                .order('created_at', { ascending: false })
                .limit(80);
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
                .limit(50);
            for (const r of (collRows || [])) {
                const lastmod = (r.updated_at || r.created_at) ? new Date(r.updated_at || r.created_at).toISOString().slice(0, 10) : today;
                urls.push('  <url><loc>' + escapeXml(base + '/inspiration/collection/' + encodeURIComponent(r.id)) + '</loc><lastmod>' + lastmod + '</lastmod><changefreq>weekly</changefreq><priority>0.5</priority></url>');
            }
            const { data: assetRows } = await supabase
                .from('vendor_assets')
                .select('id, asset_kind, updated_at, created_at, is_public')
                .eq('is_public', true)
                .in('asset_kind', ['prototype', 'part', 'material'])
                .order('updated_at', { ascending: false })
                .limit(250);
            for (const r of (assetRows || [])) {
                const kind = String(r.asset_kind || 'prototype').toLowerCase();
                if (kind !== 'prototype' && kind !== 'part' && kind !== 'material') continue;
                const lastmod = (r.updated_at || r.created_at) ? new Date(r.updated_at || r.created_at).toISOString().slice(0, 10) : today;
                urls.push('  <url><loc>' + escapeXml(base + '/inspiration/' + kind + '/' + encodeURIComponent(r.id)) + '</loc><lastmod>' + lastmod + '</lastmod><changefreq>monthly</changefreq><priority>0.5</priority></url>');
            }
            let promoRows = [];
            const promoRes = await supabase
                .from('product_promo_generations')
                .select('id, created_at, semantics_generated_at')
                .eq('status', 'success')
                .eq('show_on_homepage', true)
                .not('result_image_url', 'is', null)
                .order('created_at', { ascending: false })
                .limit(50);
            if (promoRes.error && (promoRes.error.code === '42703' || String(promoRes.error.message || '').includes('show_on_homepage'))) {
                const promoFb = await supabase
                    .from('product_promo_generations')
                    .select('id, created_at')
                    .eq('status', 'success')
                    .not('result_image_url', 'is', null)
                    .order('created_at', { ascending: false })
                    .limit(50);
                promoRows = promoFb.data || [];
            } else {
                promoRows = promoRes.data || [];
            }
            for (const r of promoRows) {
                const lastmod = (r.semantics_generated_at || r.created_at) ? new Date(r.semantics_generated_at || r.created_at).toISOString().slice(0, 10) : today;
                urls.push('  <url><loc>' + escapeXml(base + '/inspiration/promo_scene/' + encodeURIComponent(r.id)) + '</loc><lastmod>' + lastmod + '</lastmod><changefreq>monthly</changefreq><priority>0.5</priority></url>');
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
        const base = siteBase();
        const body = 'User-agent: *\nDisallow: /admin/\nDisallow: /api/\nDisallow: /payment/\nAllow: /\n\nSitemap: ' + base + '/sitemap.xml\n';
        res.set('Content-Type', 'text/plain; charset=utf-8');
        res.set('Cache-Control', 'public, max-age=86400');
        res.send(body);
    });
}

module.exports = { registerSitemapRoutes };
