'use strict';

const mw = require('../lib/media-wall');

function registerInspirationRoutes(app, deps) {
    const { BASE_URL, fetch } = deps;
    const { attachDisplayTags, buildInspirationTagsBlockHtml } = mw;
// 靈感牆單一作品獨立 URL：穩定落地頁（SEO／分享）；?open=1 可選導向首頁 lightbox
    app.get('/inspiration/:type/:id', async (req, res) => {
    const type = (req.params.type || '').trim();
    const id = (req.params.id || '').trim();
    if (!['user_design', 'comparison', 'series', 'collection'].includes(type) || !id) {
        res.status(400).send('Invalid type or id');
        return;
    }
    try {
        const origin = (req.get('x-forwarded-proto') && req.get('host')) ? `${req.get('x-forwarded-proto')}://${req.get('host')}` : null;
        const base = origin || BASE_URL;
        const apiRes = await fetch(`${base}/api/media-wall-item/${encodeURIComponent(type)}/${encodeURIComponent(id)}`, { headers: { accept: 'application/json' } });
        if (!apiRes.ok) {
            res.status(apiRes.status === 404 ? 404 : 500).send(apiRes.status === 404 ? '找不到該作品' : '暫時無法載入');
            return;
        }
        const { item } = await apiRes.json();
        if (!item) {
            res.status(404).send('找不到該作品');
            return;
        }
        attachDisplayTags(item);
        const displayTags = item.display_tags || [];
        const tagsKeywords = displayTags.slice(0, 24).join(', ');
        const title = (item.title || '作品').replace(/</g, '&lt;').replace(/"/g, '&quot;');
        let descRaw = (item.description || item.generation_prompt || item.title || 'MATCHDO 靈感牆作品').toString();
        if (tagsKeywords) descRaw = (descRaw + ' — ' + tagsKeywords).slice(0, 300);
        const desc = descRaw.slice(0, 160).replace(/</g, '&lt;').replace(/"/g, '&quot;');
        const metaKeywords = tagsKeywords.replace(/</g, '&lt;').replace(/"/g, '&quot;');
        const img = item.image_url || item.cover_image_url || '';
        let imgUrl = '';
        if (img) {
            const supabaseOrigin = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
            if (img.startsWith('http')) {
                imgUrl = (supabaseOrigin && img.startsWith(supabaseOrigin + '/'))
                    ? (base + '/api/proxy-image?url=' + encodeURIComponent(img))
                    : img;
            } else {
                imgUrl = base + (img.startsWith('/') ? '' : '/') + img;
            }
        }
        const pageUrl = `${base}/inspiration/${encodeURIComponent(type)}/${encodeURIComponent(id)}`;
        const itemParam = `${encodeURIComponent(type)}-${encodeURIComponent(id)}`;
        const lightboxUrl = `${base}/?item=${itemParam}`;
        const openLightbox = req.query.open === '1' || req.query.open === 'true';
        const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} - MATCHDO 靈感牆</title>
<meta name="description" content="${desc}">
${metaKeywords ? `<meta name="keywords" content="${metaKeywords}">` : ''}
<meta property="og:type" content="website">
<meta property="og:site_name" content="MATCHDO 合做">
<meta property="og:title" content="${title} - MATCHDO 靈感牆">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="${pageUrl}">
<link rel="canonical" href="${pageUrl.replace(/"/g, '&quot;')}">
${imgUrl ? `<meta property="og:image" content="${imgUrl.replace(/"/g, '&quot;')}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title} - MATCHDO 靈感牆">
<meta name="twitter:description" content="${desc}">
${imgUrl ? `<meta name="twitter:image" content="${imgUrl.replace(/"/g, '&quot;')}">` : ''}
<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: item.title || '作品',
    description: descRaw.slice(0, 200),
    ...(imgUrl ? { image: imgUrl } : {}),
    url: pageUrl,
    ...(displayTags.length ? { keywords: displayTags.slice(0, 30).join(', ') } : {})
}).replace(/</g, '\\u003c')}</script>
<style>
.inspiration-page{max-width:720px;margin:1.5rem auto;padding:0 1rem;font-family:system-ui,sans-serif}
.inspiration-page h1{font-size:1.25rem;margin:0 0 .75rem}
.inspiration-page .inspiration-img{max-width:100%;height:auto;border-radius:8px}
.inspiration-tags-details{margin:1rem 0;font-size:.875rem}
.inspiration-tags-details summary{cursor:pointer;color:#445D7E;font-weight:600;list-style:none;display:inline-flex;align-items:center;gap:.35rem}
.inspiration-tags-details summary::-webkit-details-marker{display:none}
.inspiration-tags-list{display:flex;flex-wrap:wrap;gap:.35rem;margin-top:.5rem}
.inspiration-tag{display:inline-block;padding:.2rem .5rem;background:#f0f4f8;border-radius:4px;font-size:.75rem;color:#333}
.inspiration-open-btn{display:inline-block;margin-top:1rem;padding:.5rem 1rem;background:#445D7E;color:#fff!important;text-decoration:none;border-radius:6px;font-size:.9rem}
</style>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
</head>
<body>
<article class="inspiration-page">
<h1>${title}</h1>
${imgUrl ? `<img class="inspiration-img" src="${imgUrl.replace(/"/g, '&quot;')}" alt="${title}">` : ''}
${buildInspirationTagsBlockHtml(displayTags)}
<p class="inspiration-url-hint"><small>永久連結：</small> <a href="${pageUrl.replace(/"/g, '&quot;')}">${pageUrl.replace(/</g, '&lt;')}</a></p>
<p><a class="inspiration-open-btn" href="${lightboxUrl.replace(/"/g, '&quot;')}">在首頁靈感牆中開啟</a></p>
</article>
${openLightbox ? `<script>setTimeout(function(){window.location.replace(${JSON.stringify(lightboxUrl)});},800);</script>` : ''}
<noscript><p><a href="${lightboxUrl.replace(/"/g, '&quot;')}">前往靈感牆</a></p></noscript>
</body>
</html>`;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=120');
        res.send(html);
    } catch (e) {
        console.error('GET /inspiration/:type/:id 異常:', e);
        if (!res.headersSent) res.status(500).send('暫時無法載入');
    }
});
}

module.exports = { registerInspirationRoutes };
