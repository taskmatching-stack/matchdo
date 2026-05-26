'use strict';

const path = require('path');
const fs = require('fs');

function registerVendorPageRoutes(app, deps) {
    const { supabase, BASE_URL } = deps;
    const rootDir = deps.rootDir || path.join(__dirname, '..');
// vendor-profile 動態 OG：有 ?id= 時依廠商資料輸出 meta，供社群爬蟲與分享預覽
    app.get('/vendor-profile.html', async (req, res, next) => {
    const id = (req.query.id || '').trim();
    if (!id) return next();
    try {
        const { data: mfr } = await supabase.from('manufacturers').select('id, name, description, logo_url').eq('id', id).maybeSingle();
        if (!mfr) return next();
        let coverUrl = mfr.logo_url || null;
        if (!coverUrl) {
            const { data: first } = await supabase.from('manufacturer_portfolio').select('image_url').eq('manufacturer_id', id).order('sort_order', { ascending: true }).limit(1).maybeSingle();
            if (first && first.image_url) coverUrl = first.image_url;
        }
        const origin = (req.get('x-forwarded-proto') && req.get('host')) ? `${req.get('x-forwarded-proto')}://${req.get('host')}` : null;
        const base = origin || BASE_URL;
        const pageUrl = base + '/vendor-profile.html?id=' + encodeURIComponent(id);
        const supabaseOrigin = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
        if (coverUrl && coverUrl.startsWith('http') && supabaseOrigin && coverUrl.startsWith(supabaseOrigin + '/')) {
            coverUrl = base + '/api/proxy-image?url=' + encodeURIComponent(coverUrl);
        }
        const name = (mfr.name || '廠商').replace(/</g, '&lt;').replace(/"/g, '&quot;');
        const desc = ((mfr.description || '') + ' - MATCHDO 合做').trim().slice(0, 160).replace(/</g, '&lt;').replace(/"/g, '&quot;') || (name + ' - 在 MATCHDO 合做瀏覽廠商作品與聯繫方式');
        const htmlPath = path.join(rootDir, 'public', 'vendor-profile.html');
        if (!fs.existsSync(htmlPath)) return next();
        let html = fs.readFileSync(htmlPath, 'utf8');
        html = html.replace(/<title>[^<]*<\/title>/, '<title>' + name + ' - MATCHDO 合做</title>');
        html = html.replace(/<meta name="description" content="[^"]*">/, '<meta name="description" content="' + desc + '">');
        html = html.replace(/<meta property="og:title" content="[^"]*">/, '<meta property="og:title" content="' + name + ' - MATCHDO 合做">');
        html = html.replace(/<meta property="og:description" content="[^"]*">/, '<meta property="og:description" content="' + desc + '">');
        html = html.replace(/<meta property="og:image" content="[^"]*">/, '<meta property="og:image" content="' + (coverUrl || (base + '/img/og-vendors.jpg')) + '">');
        html = html.replace(/<meta property="og:url" content="[^"]*">/, '<meta property="og:url" content="' + pageUrl.replace(/"/g, '&quot;') + '">');
        html = html.replace(/<meta name="twitter:title" content="[^"]*">/, '<meta name="twitter:title" content="' + name + ' - MATCHDO 合做">');
        html = html.replace(/<meta name="twitter:description" content="[^"]*">/, '<meta name="twitter:description" content="' + desc + '">');
        html = html.replace(/<meta name="twitter:image" content="[^"]*">/, '<meta name="twitter:image" content="' + (coverUrl || (base + '/img/og-vendors.jpg')) + '">');
        html = html.replace(/<link rel="canonical" href="[^"]*" id="canonicalTag">/, '<link rel="canonical" href="' + pageUrl.replace(/"/g, '&quot;') + '" id="canonicalTag">');
        html = html.replace(/<link rel="alternate" hreflang="zh-TW" href="[^"]*" id="hreflangZh">/, '<link rel="alternate" hreflang="zh-TW" href="' + pageUrl.replace(/"/g, '&quot;') + '" id="hreflangZh">');
        html = html.replace(/<link rel="alternate" hreflang="en" href="[^"]*" id="hreflangEn">/, '<link rel="alternate" hreflang="en" href="' + pageUrl.replace(/"/g, '&quot;') + '&lang=en" id="hreflangEn">');
        html = html.replace(/<link rel="alternate" hreflang="x-default" href="[^"]*">/, '<link rel="alternate" hreflang="x-default" href="' + pageUrl.replace(/"/g, '&quot;') + '">');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.send(html);
    } catch (e) {
        console.error('GET /vendor-profile.html 動態 OG 異常:', e && e.message);
        next();
    }
});
}

module.exports = { registerVendorPageRoutes };
