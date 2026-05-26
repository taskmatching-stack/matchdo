'use strict';

const mw = require('../lib/media-wall');

function registerMediaWallRoutes(app, deps) {
    mw.init(deps);
    const { supabase } = deps;
    const {
        attachDisplayTags,
        parseMediaWallTagFilters,
        mediaWallItemMatchesTagFilters,
        mediaWallItemSearchHaystack
    } = mw;
// ?per_page=48&page=1&q=關鍵字&tag=標籤1,標籤2&category_key=主分類&subcategory_key=子分類&layout_type=（可疊加）
    app.get('/api/media-wall', async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const perPage = Math.min(100, Math.max(10, parseInt(req.query.per_page, 10) || 48));
    const offset = (page - 1) * perPage;
    const searchQ = (req.query.q && String(req.query.q).trim()) || '';
    const tagFilters = parseMediaWallTagFilters(req.query.tag);
    const filterCategoryKey = (req.query.category_key && String(req.query.category_key).trim()) || '';
    const filterSubcategoryKey = (req.query.subcategory_key && String(req.query.subcategory_key).trim()) || '';
    const filterLayoutType = (req.query.layout_type && String(req.query.layout_type).trim()) || '';
    const layoutOnly = ['user_design', 'comparison', 'collection', 'series'].includes(filterLayoutType) ? filterLayoutType : null;

    const out = [];
    const hasCategoryFilter = !!(filterCategoryKey || filterSubcategoryKey);
    const clientFilterActive = !!(searchQ || tagFilters.length);
    // 有 q 或 tag 時多取一批，再與分類／類型條件 AND 後分頁
    const searchPool = clientFilterActive ? Math.min(100, Math.max(offset + perPage * 2, perPage * 2)) : 0;
    const dbOffset = clientFilterActive ? 0 : offset;
    const nUserLimit = (layoutOnly === 'user_design' || layoutOnly === null) ? (clientFilterActive ? searchPool : perPage) : 0;
    const nComparisonLimit = (layoutOnly === 'comparison' || layoutOnly === null) ? (clientFilterActive ? searchPool : perPage) : 0;
    const nSeriesLimit = (layoutOnly === 'series' || layoutOnly === 'collection') ? (clientFilterActive ? searchPool : perPage) : 0;
    // 混合模式時 1x2 只取少數，避免壓過 1x1；篩選「系列／資料夾」時才取滿一頁
    const nCollectionLimit = (layoutOnly === 'series' || layoutOnly === 'collection')
        ? Math.max(1, Math.floor((clientFilterActive ? searchPool : perPage) / 2))
        : (layoutOnly === null ? (clientFilterActive ? Math.min(12, Math.max(6, Math.floor(searchPool / 8))) : 6) : 0);

    try {
        {
        // 主分類篩選時：custom_products.category 可能存「主分類 key」或「子分類 key」（表單只送一個欄位），故需包含該主分類下所有子分類 key
        let categoryKeysToMatch = filterCategoryKey ? [filterCategoryKey] : null;
        if (filterCategoryKey) {
            try {
                const { data: subRows } = await supabase
                    .from('custom_product_subcategories')
                    .select('key')
                    .eq('category_key', filterCategoryKey);
                if (subRows && subRows.length) {
                    categoryKeysToMatch = [filterCategoryKey, ...subRows.map(r => r.key).filter(Boolean)];
                }
            } catch (_) {}
        }

        // 用戶設計：只查「有圖」且允許顯示在首頁的；可依 category / subcategory_key 篩選
        let userRows = [];
        if (!layoutOnly || layoutOnly === 'user_design') {
        let userQuery = supabase
            .from('custom_products')
            .select('id, title, category, subcategory_key, ai_generated_image_url, reference_image_url, created_at, owner_id, analysis_json, generation_prompt, generation_seed, show_on_homepage, ai_tags, image_semantics_json')
            .not('ai_generated_image_url', 'eq', null)
            .or('show_on_homepage.eq.true,show_on_homepage.is.null');
        if (categoryKeysToMatch && categoryKeysToMatch.length) userQuery = userQuery.in('category', categoryKeysToMatch);
        else if (filterCategoryKey) userQuery = userQuery.eq('category', filterCategoryKey);
        if (filterSubcategoryKey) userQuery = userQuery.eq('subcategory_key', filterSubcategoryKey);
        userQuery = userQuery.order('created_at', { ascending: false }).range(dbOffset, dbOffset + (hasCategoryFilter && !clientFilterActive ? perPage : nUserLimit) - 1);
        const userRes = await userQuery;
        if (!userRes.error) userRows = userRes.data || [];
        if (userRes.error && userRes.error.code !== '42703') console.warn('GET /api/media-wall 用戶設計查詢失敗:', userRes.error.message);
        if (userRes.error && /column.*show_on_homepage|column.*subcategory_key|42703/i.test(userRes.error.message || userRes.error.code)) {
            let fallbackQuery = supabase
                .from('custom_products')
                .select('id, title, category, ai_generated_image_url, reference_image_url, created_at, owner_id, analysis_json, generation_prompt, generation_seed')
                .not('ai_generated_image_url', 'eq', null);
            if (categoryKeysToMatch && categoryKeysToMatch.length) fallbackQuery = fallbackQuery.in('category', categoryKeysToMatch);
            else if (filterCategoryKey) fallbackQuery = fallbackQuery.eq('category', filterCategoryKey);
            fallbackQuery = fallbackQuery.order('created_at', { ascending: false }).range(dbOffset, dbOffset + (hasCategoryFilter && !clientFilterActive ? perPage : nUserLimit) - 1);
            const fallback = await fallbackQuery;
            userRows = (fallback.data && fallback.data.length) ? fallback.data : [];
            if (filterSubcategoryKey && userRows.length) userRows = userRows.filter(p => (p.subcategory_key || '') === filterSubcategoryKey);
        }
        let ownerDisplayMap = {};
        if (userRows && userRows.length) {
            const ownerIds = [...new Set(userRows.map(p => p.owner_id).filter(Boolean))];
            if (ownerIds.length > 0) {
                try {
                    const { data: profs } = await supabase.from('profiles').select('id, full_name, email').in('id', ownerIds);
                    if (profs) profs.forEach(pr => { ownerDisplayMap[pr.id] = (pr.full_name && pr.full_name.trim()) || pr.email || ''; });
                } catch (_) {}
            }
            // 照抄 GET /api/custom-products 的 product 形狀；確保 analysis_json 為物件，且 generation_seed 從 analysis_json 帶出
            userRows.forEach(p => {
                let aj = p.analysis_json;
                if (typeof aj === 'string') try { aj = JSON.parse(aj); } catch (_) { aj = null; }
                const seed = p.generation_seed ?? (aj && (aj.generation_seed ?? aj.seed));
                const userItem = attachDisplayTags({
                    ...p,
                    analysis_json: aj || null,
                    generation_seed: seed != null && seed !== '' ? seed : null,
                    type: 'user_design',
                    size: '1x1',
                    title: p.title || '未命名',
                    image_url: p.ai_generated_image_url || p.reference_image_url,
                    link: '/custom/gallery.html',
                    inspiration_url: p.id ? `/inspiration/user_design/${p.id}` : null,
                    owner_display: ownerDisplayMap[p.owner_id] || null,
                    category_key: p.category || null,
                    subcategory_key: p.subcategory_key || null
                });
                out.push(userItem);
            });
        }
        }

        // 廠商對比：有分類篩選時只回傳該分類的對比圖，無篩選時回傳 show_on_media_wall 的項目（需 category_key 欄位請執行 docs/add-manufacturer-portfolio-category-fields.sql）
        // 篩選「對照圖」時只查有 image_url_before 的項目，沒傳對照圖的不能出現在對照圖區
        let compRows = [];
        if (!layoutOnly || layoutOnly === 'comparison') {
        const compSelect = 'id, manufacturer_id, title, image_url, image_url_before, design_highlight, tags, ai_tags, image_semantics_json, description, show_on_media_wall, category_key, subcategory_key, series_image_valid_until, before_image_valid_until, series_image_urls, created_at';
        if (hasCategoryFilter && categoryKeysToMatch && categoryKeysToMatch.length) {
            let compQuery = supabase
                .from('manufacturer_portfolio')
                .select(compSelect)
                .eq('show_on_media_wall', true)
                .in('category_key', categoryKeysToMatch)
                .order('created_at', { ascending: false })
                .range(dbOffset, dbOffset + nComparisonLimit - 1);
            if (layoutOnly === 'comparison') compQuery = compQuery.not('image_url_before', 'is', null);
            if (filterSubcategoryKey) compQuery = compQuery.eq('subcategory_key', filterSubcategoryKey);
            const compRes = await compQuery;
            if (!compRes.error) compRows = compRes.data || [];
            if (compRes.error && compRes.error.code !== '42703') console.warn('GET /api/media-wall 廠商對比（依分類）查詢:', compRes.error.message);
        } else {
            let compQuery = supabase
                .from('manufacturer_portfolio')
                .select(compSelect)
                .eq('show_on_media_wall', true)
                .order('created_at', { ascending: false })
                .range(dbOffset, dbOffset + nComparisonLimit - 1);
            if (layoutOnly === 'comparison') compQuery = compQuery.not('image_url_before', 'is', null);
            const compRes = await compQuery;
            if (!compRes.error) compRows = compRes.data || [];
            if (compRes.error && compRes.error.code !== '42703') console.warn('GET /api/media-wall 廠商對比查詢:', compRes.error.message);
            if (compRes.error && /column.*show_on_media_wall|column.*category_key|42703/i.test(compRes.error.message || compRes.error.code)) {
                let fallbackQuery = supabase
                    .from('manufacturer_portfolio')
                    .select('id, manufacturer_id, title, image_url, image_url_before, design_highlight, series_image_valid_until, before_image_valid_until, series_image_urls')
                    .order('created_at', { ascending: false })
                    .range(dbOffset, dbOffset + nComparisonLimit - 1);
                if (layoutOnly === 'comparison') fallbackQuery = fallbackQuery.not('image_url_before', 'is', null);
                const fallback = await fallbackQuery;
                compRows = fallback.data || [];
            }
        }
        }
        if (compRows && compRows.length) {
            // Batch-fetch manufacturer user_id so the lightbox can offer in-app contact
            const compMfrIds = [...new Set(compRows.map(p => p.manufacturer_id).filter(Boolean))];
            let compMfrMap = {};
            if (compMfrIds.length) {
                const { data: compMfrs } = await supabase
                    .from('manufacturers')
                    .select('id, user_id')
                    .in('id', compMfrIds)
                    .eq('is_active', true);
                (compMfrs || []).forEach(m => { compMfrMap[m.id] = m.user_id || null; });
            }
            const nowIso = new Date().toISOString();
            compRows.forEach(p => {
                const seriesExpired = p.series_image_valid_until && p.series_image_valid_until < nowIso;
                const imageUrl = seriesExpired ? null : (p.image_url || null);
                // 舊圖（設計圖）一律回傳，不因 before_image_valid_until 過期而隱藏，否則首頁對照圖左半不顯示
                const imageUrlBefore = (p.image_url_before || null);
                const seriesUrls = (Array.isArray(p.series_image_urls) && p.series_image_urls.length) ? (seriesExpired ? [] : p.series_image_urls) : (imageUrl ? [imageUrl] : []);
                // 有 image_url_before 才是對照圖（設計圖+作品圖）；否則為系列圖（多張或單張）
                const itemType = imageUrlBefore ? 'comparison' : 'series';
                const mfrUserId = compMfrMap[p.manufacturer_id] || null;
                const payload = attachDisplayTags({
                    type: itemType,
                    size: '1x1',
                    id: p.id,
                    manufacturer_id: p.manufacturer_id,
                    manufacturer_user_id: mfrUserId,
                    title: p.title || '廠商作品',
                    image_url: imageUrl,
                    design_highlight: p.design_highlight || null,
                    tags: Array.isArray(p.tags) ? p.tags : [],
                    ai_tags: Array.isArray(p.ai_tags) ? p.ai_tags : [],
                    image_semantics_json: p.image_semantics_json || null,
                    description: p.description || null,
                    category_key: p.category_key || null,
                    subcategory_key: p.subcategory_key || null,
                    link: p.manufacturer_id ? '/vendor-profile.html?id=' + encodeURIComponent(p.manufacturer_id) : '/custom/gallery.html',
                    inspiration_url: p.id ? `/inspiration/${itemType}/${p.id}` : null,
                    created_at: p.created_at || null
                });
                if (itemType === 'comparison') payload.image_url_before = imageUrlBefore;
                if (itemType === 'series' && seriesUrls.length) payload.series_image_urls = seriesUrls;
                // 篩選「對照圖」時只回傳真正的對照圖（有設計圖），不把系列圖塞進對照圖區
                if (layoutOnly === 'comparison' && itemType !== 'comparison') return;
                out.push(payload);
            });
        }
        // 沒有對比圖時不顯示對比（不塞 demo），每種類型都要有分類
        }

        // 系列圖專用：篩選「系列圖」或「資料夾」時皆查 image_url_before 為 null 的廠商作品（與資料夾整合為同一種）
        let seriesRows = [];
        if ((layoutOnly === 'series' || layoutOnly === 'collection') && nSeriesLimit > 0) {
            try {
                const seriesSelect = 'id, manufacturer_id, title, image_url, design_highlight, tags, ai_tags, image_semantics_json, description, show_on_media_wall, category_key, subcategory_key, series_image_valid_until, series_image_urls, created_at';
                if (hasCategoryFilter && categoryKeysToMatch && categoryKeysToMatch.length) {
                    let seriesQuery = supabase
                        .from('manufacturer_portfolio')
                        .select(seriesSelect)
                        .eq('show_on_media_wall', true)
                        .is('image_url_before', null)
                        .in('category_key', categoryKeysToMatch)
                        .order('created_at', { ascending: false })
                        .range(dbOffset, dbOffset + nSeriesLimit - 1);
                    if (filterSubcategoryKey) seriesQuery = seriesQuery.eq('subcategory_key', filterSubcategoryKey);
                    const seriesRes = await seriesQuery;
                    if (!seriesRes.error) seriesRows = seriesRes.data || [];
                    if (seriesRes.error && /column.*show_on_media_wall|column.*category_key|42703/i.test(String(seriesRes.error.message || seriesRes.error.code))) {
                        let fallbackQuery = supabase
                            .from('manufacturer_portfolio')
                            .select('id, manufacturer_id, title, image_url, design_highlight, series_image_valid_until, series_image_urls')
                            .is('image_url_before', null)
                            .order('created_at', { ascending: false })
                            .range(dbOffset, dbOffset + nSeriesLimit - 1);
                        const fallbackRes = await fallbackQuery;
                        seriesRows = (fallbackRes.data || []).map(r => ({ ...r, tags: [], description: null, category_key: null, subcategory_key: null }));
                    }
                } else {
                    const seriesRes = await supabase
                        .from('manufacturer_portfolio')
                        .select(seriesSelect)
                        .eq('show_on_media_wall', true)
                        .is('image_url_before', null)
                        .order('created_at', { ascending: false })
                        .range(dbOffset, dbOffset + nSeriesLimit - 1);
                    if (!seriesRes.error) seriesRows = seriesRes.data || [];
                    if (seriesRes.error && /column.*show_on_media_wall|column.*category_key|42703/i.test(String(seriesRes.error.message || seriesRes.error.code))) {
                        const fallbackRes = await supabase
                            .from('manufacturer_portfolio')
                            .select('id, manufacturer_id, title, image_url, design_highlight, series_image_valid_until, series_image_urls')
                            .is('image_url_before', null)
                            .order('created_at', { ascending: false })
                            .range(dbOffset, dbOffset + nSeriesLimit - 1);
                        seriesRows = (fallbackRes.data || []).map(r => ({ ...r, tags: [], description: null, category_key: null, subcategory_key: null }));
                    }
                }
            } catch (seriesErr) {
                console.warn('GET /api/media-wall 系列圖查詢:', seriesErr && seriesErr.message);
            }
        }
        if (seriesRows && seriesRows.length) {
            const seriesMfrIds = [...new Set(seriesRows.map(p => p.manufacturer_id).filter(Boolean))];
            let seriesMfrMap = {};
            if (seriesMfrIds.length) {
                const { data: seriesMfrs } = await supabase
                    .from('manufacturers')
                    .select('id, user_id')
                    .in('id', seriesMfrIds)
                    .eq('is_active', true);
                (seriesMfrs || []).forEach(m => { seriesMfrMap[m.id] = m.user_id || null; });
            }
            const nowIso = new Date().toISOString();
            seriesRows.forEach(p => {
                const seriesExpired = p.series_image_valid_until && p.series_image_valid_until < nowIso;
                const imageUrl = seriesExpired ? null : (p.image_url || null);
                const seriesUrls = (Array.isArray(p.series_image_urls) && p.series_image_urls.length) ? (seriesExpired ? [] : p.series_image_urls) : (imageUrl ? [imageUrl] : []);
                const mfrUserId = seriesMfrMap[p.manufacturer_id] || null;
                out.push(attachDisplayTags({
                    type: 'series',
                    size: '1x2',
                    id: p.id,
                    manufacturer_id: p.manufacturer_id,
                    manufacturer_user_id: mfrUserId,
                    title: p.title || '廠商作品',
                    image_url: imageUrl,
                    design_highlight: p.design_highlight || null,
                    tags: Array.isArray(p.tags) ? p.tags : [],
                    ai_tags: Array.isArray(p.ai_tags) ? p.ai_tags : [],
                    image_semantics_json: p.image_semantics_json || null,
                    description: p.description || null,
                    category_key: p.category_key || null,
                    subcategory_key: p.subcategory_key || null,
                    link: p.manufacturer_id ? '/vendor-profile.html?id=' + encodeURIComponent(p.manufacturer_id) : '/custom/gallery.html',
                    inspiration_url: p.id ? `/inspiration/series/${p.id}` : null,
                    created_at: p.created_at || null,
                    series_image_urls: seriesUrls
                }));
            });
        }

        // 資料夾：與系列圖整合為同一種，回傳 type=series；篩選「系列圖」或「資料夾」時皆會查
        let collRows = [];
        if (!layoutOnly || layoutOnly === 'collection' || layoutOnly === 'series') {
        const collLimit = hasCategoryFilter ? Math.min(nCollectionLimit * 3, 30) : nCollectionLimit;
        if (collLimit > 0) {
            const collRes = await supabase
                .from('media_collections')
                .select('id, title, slug, cover_image_url, image_urls, description, category_keys, manufacturer_id, created_at')
                .eq('is_active', true)
                .order('sort_order', { ascending: true })
                .order('created_at', { ascending: false })
                .range(dbOffset, dbOffset + collLimit - 1);
            let raw = (collRes.data || []);
            let canFilterByCategory = true;
            if (collRes.error && /column|42703/i.test(String(collRes.error.message || collRes.error.code))) {
                const simple = await supabase.from('media_collections').select('id, title, slug, cover_image_url, description, created_at').eq('is_active', true).order('sort_order', { ascending: true }).order('created_at', { ascending: false }).range(dbOffset, dbOffset + collLimit - 1);
                raw = (simple.data || []).map(r => ({ ...r, manufacturer_id: null }));
                canFilterByCategory = false;
            }
            if (hasCategoryFilter && filterCategoryKey) {
                if (!canFilterByCategory || !raw.length) {
                    collRows = [];
                } else {
                    // 只顯示 category_keys 含有該主分類 key 的資料夾；沒設分類的資料夾一律不顯示
                    collRows = raw.filter(function (p) {
                        const keys = p.category_keys;
                        if (!keys || !Array.isArray(keys) || keys.length === 0) return false;
                        return keys.indexOf(filterCategoryKey) !== -1;
                    }).slice(0, nCollectionLimit);
                }
            } else {
                collRows = raw.slice(0, nCollectionLimit);
            }
        }
        }
        // Batch-fetch manufacturer user_id for collections that have manufacturer_id
        const collMfrIds = [...new Set(collRows.map(p => p.manufacturer_id).filter(Boolean))];
        let collMfrMap = {};
        if (collMfrIds.length) {
            const { data: collMfrs } = await supabase
                .from('manufacturers')
                .select('id, user_id')
                .in('id', collMfrIds)
                .eq('is_active', true);
            (collMfrs || []).forEach(m => { collMfrMap[m.id] = m.user_id || null; });
        }
        // 資料夾（media_collections）用 type=collection，與廠商系列圖 type=series 區分，前端篩選「系列圖／資料夾」才正確
        collRows.forEach(p => {
            const cover = p.cover_image_url || null;
            const imageUrls = (p.image_urls && Array.isArray(p.image_urls) && p.image_urls.length > 0) ? p.image_urls : (cover ? [cover] : []);
            const mfrId = p.manufacturer_id || null;
            const mfrUserId = collMfrMap[mfrId] || null;
            out.push({
                type: 'collection',
                size: '1x2',
                id: p.id,
                title: p.title || '系列',
                slug: p.slug,
                cover_image_url: cover,
                series_image_urls: imageUrls,
                description: p.description || null,
                manufacturer_id: mfrId,
                manufacturer_user_id: mfrUserId,
                link: mfrId ? '/vendor-profile.html?id=' + encodeURIComponent(mfrId) : (p.slug ? '/custom/collection.html?slug=' + encodeURIComponent(p.slug) : '/custom/gallery.html'),
                inspiration_url: p.id ? `/inspiration/collection/${p.id}` : null,
                created_at: p.created_at || null,
                category_keys: (p.category_keys && Array.isArray(p.category_keys)) ? p.category_keys : []
            });
        });

        // 防呆：API 回傳絕不把廠商作品當設計圖（設計圖只准 AI 生成寫入 custom_products，廠商圖絕不當設計圖）
        out.forEach(function (item) {
            if (item.manufacturer_id && item.type === 'user_design') {
                item.type = (item.image_url_before ? 'comparison' : 'series');
                if (item.type === 'series' && (!item.series_image_urls || !item.series_image_urls.length) && item.image_url) {
                    item.series_image_urls = [item.image_url];
                }
            }
        });
        // 篩選類型時只回傳該類型：設計圖＝僅 AI 生成；對照圖／系列圖／資料夾＝依 type 篩選（勿對 const out 重新賦值）
        let items = out;
        if (layoutOnly === 'user_design') {
            items = out.filter(function (item) { return item.type === 'user_design' && !item.manufacturer_id; });
        } else if (layoutOnly === 'comparison') {
            items = out.filter(function (item) { return item.type === 'comparison'; });
        } else if (layoutOnly === 'series') {
            items = out.filter(function (item) { return item.type === 'series'; });
        } else if (layoutOnly === 'collection') {
            items = out.filter(function (item) { return item.type === 'collection'; });
        }

        if (clientFilterActive) {
            if (tagFilters.length) {
                items = items.filter(function (item) { return mediaWallItemMatchesTagFilters(item, tagFilters); });
            }
            if (searchQ) {
                const qLower = searchQ.toLowerCase();
                items = items.filter(function (item) { return mediaWallItemSearchHaystack(item).includes(qLower); });
            }
            items.sort(function (a, b) { return new Date(b.created_at || 0) - new Date(a.created_at || 0); });
            items = items.slice(offset, offset + perPage);
        }

        res.set('Cache-Control', 'public, max-age=120');
        res.json({ items: items, page, per_page: perPage, filtered: clientFilterActive, tags: tagFilters });
    } catch (e) {
        console.error('GET /api/media-wall 異常:', e);
        res.set('Cache-Control', 'public, max-age=60');
        res.status(200).json({ items: [], page, per_page: perPage });
    }
});

// 首頁靈感牆刪除/隱藏：與 GET /api/me/profile 共用查詢（id 優先，再以 email 對應舊列）
/** 首頁靈感牆刪除／隱藏：僅 profiles.role = admin */
function profileCanDeleteMediaWall(profile) {
    if (!profile) return false;
    return String(profile.role || '').trim().toLowerCase() === 'admin';
}

async function resolveProfileForAuthUser(user) {
    if (!user?.id) return { profile: null, error: null };
    const normEmail = String(user.email || '').trim().toLowerCase();
    async function loadById(uid) {
        let { data, error } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
        if (error && error.code === '42703' && String(error.message || '').includes('can_delete_media_wall')) {
            const retry = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
            data = retry.data;
            error = retry.error;
        }
        return { data, error };
    }
    let { data: profile, error } = await loadById(user.id);
    let byEmail = null;
    if (normEmail) {
        const emailRes = await supabase.from('profiles').select('*').eq('email', normEmail).maybeSingle();
        if (!emailRes.error) byEmail = emailRes.data;
    }
    if (!profile && byEmail) {
        profile = { ...byEmail, id: user.id };
        error = null;
    } else if (
        profile && byEmail && normEmail
        && String(byEmail.email || '').trim().toLowerCase() === normEmail
        && profileCanDeleteMediaWall(byEmail) && !profileCanDeleteMediaWall(profile)
    ) {
        // Google 登入 id 與舊 Email 註冊列不同時，同 email 的管理員權限對齊
        profile = { ...byEmail, id: user.id };
    }
    if (profile && profile.can_delete_media_wall == null) profile.can_delete_media_wall = false;
    return { profile, error };
}

async function requireMediaWallDelete(req, res) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        res.status(401).json({ error: '未授權' });
        return null;
    }
    const token = authHeader.replace(/^\s*Bearer\s+/i, '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
        res.status(401).json({ error: 'token 無效' });
        return null;
    }
    const { profile, error: profErr } = await resolveProfileForAuthUser(user);
    if (profErr) {
        console.error('requireMediaWallDelete profile:', profErr);
        res.status(500).json({ error: '查詢權限失敗' });
        return null;
    }
    if (!profileCanDeleteMediaWall(profile)) {
        res.status(403).json({
            error: '僅管理員可操作首頁靈感牆刪除／隱藏',
            hint: '請確認 Supabase profiles 中此帳號 role 為 admin（見 docs/fix-admin-media-wall-delete.sql）。'
        });
        return null;
    }
    return user;
}

// PATCH /api/admin/media-wall-item — 管理員在首頁關閉/開啟個別項目顯示
app.patch('/api/admin/media-wall-item', express.json(), async (req, res) => {
    try {
        const adminUser = await requireMediaWallDelete(req, res);
        if (!adminUser) return;
        const { type, id, show } = req.body || {};
        if (!type || !id || typeof show !== 'boolean') {
            return res.status(400).json({ error: '請提供 type（user_design|comparison|collection）、id、show（boolean）' });
        }
        const tid = String(type).toLowerCase();
        if (tid === 'user_design') {
            const { error } = await supabase.from('custom_products').update({ show_on_homepage: show }).eq('id', id);
            if (error) {
                if (/column.*show_on_homepage/i.test(error.message)) return res.status(503).json({ error: '請先執行 docs/add-custom-products-show-on-homepage.sql' });
                return res.status(500).json({ error: error.message });
            }
        } else if (tid === 'comparison' || tid === 'series') {
            const { error } = await supabase.from('manufacturer_portfolio').update({ show_on_media_wall: show }).eq('id', id);
            if (error) {
                if (/column.*show_on_media_wall/i.test(error.message)) return res.status(503).json({ error: '請先執行媒體牆說明文件中 manufacturer_portfolio.show_on_media_wall 的 SQL' });
                return res.status(500).json({ error: error.message });
            }
        } else if (tid === 'collection') {
            const { error } = await supabase.from('media_collections').update({ is_active: show }).eq('id', id);
            if (error) return res.status(500).json({ error: error.message });
        } else {
            return res.status(400).json({ error: 'type 須為 user_design、comparison、series 或 collection' });
        }
        res.json({ success: true, show });
    } catch (e) {
        console.error('PATCH /api/admin/media-wall-item 異常:', e);
        if (!res.headersSent) res.status(500).json({ error: '系統錯誤' });
    }
});

// DELETE /api/admin/media-wall-item — 管理員永久移除項目（user_design 刪除資料；comparison/collection 僅隱藏）
app.delete('/api/admin/media-wall-item', express.json(), async (req, res) => {
    try {
        const adminUser = await requireMediaWallDelete(req, res);
        if (!adminUser) return;
        const type = (req.body && req.body.type) || req.query.type;
        const id = (req.body && req.body.id) || req.query.id;
        if (!type || !id) {
            return res.status(400).json({ error: '請提供 type（user_design|comparison|series|collection）與 id' });
        }
        const tid = String(type).toLowerCase();
        if (tid === 'user_design') {
            const { error } = await supabase.from('custom_products').delete().eq('id', id);
            if (error) return res.status(500).json({ error: error.message });
            return res.json({ success: true, deleted: true });
        }
        if (tid === 'comparison' || tid === 'series') {
            const { error } = await supabase.from('manufacturer_portfolio').update({ show_on_media_wall: false }).eq('id', id);
            if (error) return res.status(500).json({ error: error.message });
            return res.json({ success: true, deleted: false, hidden: true });
        }
        if (tid === 'collection') {
            const { error } = await supabase.from('media_collections').update({ is_active: false }).eq('id', id);
            if (error) return res.status(500).json({ error: error.message });
            return res.json({ success: true, deleted: false, hidden: true });
        }
        return res.status(400).json({ error: 'type 須為 user_design、comparison、series 或 collection' });
    } catch (e) {
        console.error('DELETE /api/admin/media-wall-item 異常:', e);
        if (!res.headersSent) res.status(500).json({ error: '系統錯誤' });
    }
});

// GET /api/media-wall-item/:type/:id — 單一靈感牆作品（供獨立 URL 頁與 lightbox 使用）
const MEDIA_WALL_ITEM_TYPES = ['user_design', 'comparison', 'series', 'collection'];
    app.get('/api/media-wall-item/:type/:id', async (req, res) => {
    const type = (req.params.type || '').trim();
    const id = (req.params.id || '').trim();
    if (!MEDIA_WALL_ITEM_TYPES.includes(type) || !id) {
        return res.status(400).json({ error: 'type 須為 user_design、comparison、series、collection，且 id 必填' });
    }
    try {
        if (type === 'user_design') {
            const { data: row, error } = await supabase
                .from('custom_products')
                .select('id, title, category, subcategory_key, ai_generated_image_url, reference_image_url, created_at, owner_id, analysis_json, generation_prompt, generation_seed, show_on_homepage, ai_tags, image_semantics_json')
                .eq('id', id)
                .maybeSingle();
            if (error || !row) return res.status(404).json({ error: '找不到該作品' });
            if (!row.ai_generated_image_url && !row.reference_image_url) return res.status(404).json({ error: '找不到該作品' });
            let ownerDisplay = '';
            if (row.owner_id) {
                const { data: prof } = await supabase.from('profiles').select('full_name, email').eq('id', row.owner_id).maybeSingle();
                if (prof) ownerDisplay = (prof.full_name && prof.full_name.trim()) || prof.email || '';
            }
            let aj = row.analysis_json;
            if (typeof aj === 'string') try { aj = JSON.parse(aj); } catch (_) { aj = null; }
            const seed = row.generation_seed ?? (aj && (aj.generation_seed ?? aj.seed));
            const item = attachDisplayTags({
                ...row,
                analysis_json: aj || null,
                generation_seed: seed != null && seed !== '' ? seed : null,
                type: 'user_design',
                size: '1x1',
                title: row.title || '未命名',
                image_url: row.ai_generated_image_url || row.reference_image_url,
                link: '/custom/gallery.html',
                inspiration_url: `/inspiration/user_design/${id}`,
                owner_display: ownerDisplay || null,
                category_key: row.category || null,
                subcategory_key: row.subcategory_key || null
            });
            return res.set('Cache-Control', 'public, max-age=120').json({ item });
        }
        if (type === 'comparison' || type === 'series') {
            const { data: row, error } = await supabase
                .from('manufacturer_portfolio')
                .select('id, manufacturer_id, title, image_url, image_url_before, design_highlight, tags, ai_tags, image_semantics_json, description, show_on_media_wall, category_key, subcategory_key, series_image_valid_until, series_image_urls, before_image_valid_until, min_order_quantity')
                .eq('id', id)
                .maybeSingle();
            if (error || !row) return res.status(404).json({ error: '找不到該作品' });
            const isComparison = !!row.image_url_before;
            if (type === 'comparison' && !isComparison) return res.status(404).json({ error: '找不到該對照圖' });
            if (type === 'series' && isComparison) return res.status(404).json({ error: '找不到該系列圖' });
            let mfrUserId = null;
            if (row.manufacturer_id) {
                const { data: mfr } = await supabase.from('manufacturers').select('user_id').eq('id', row.manufacturer_id).eq('is_active', true).maybeSingle();
                if (mfr) mfrUserId = mfr.user_id || null;
            }
            const nowIso = new Date().toISOString();
            const seriesExpired = row.series_image_valid_until && row.series_image_valid_until < nowIso;
            const imageUrl = seriesExpired ? null : (row.image_url || null);
            const imageUrlBefore = row.image_url_before || null;
            const seriesUrls = (Array.isArray(row.series_image_urls) && row.series_image_urls.length) ? (seriesExpired ? [] : row.series_image_urls) : (imageUrl ? [imageUrl] : []);
            const item = attachDisplayTags({
                type: type,
                size: '1x1',
                id: row.id,
                manufacturer_id: row.manufacturer_id,
                manufacturer_user_id: mfrUserId,
                title: row.title || '廠商作品',
                image_url: imageUrl,
                design_highlight: row.design_highlight || null,
                tags: Array.isArray(row.tags) ? row.tags : [],
                ai_tags: Array.isArray(row.ai_tags) ? row.ai_tags : [],
                image_semantics_json: row.image_semantics_json || null,
                description: row.description || null,
                category_key: row.category_key || null,
                subcategory_key: row.subcategory_key || null,
                link: row.manufacturer_id ? '/vendor-profile.html?id=' + encodeURIComponent(row.manufacturer_id) : '/custom/gallery.html',
                inspiration_url: `/inspiration/${type}/${id}`,
                min_order_quantity: (row.min_order_quantity != null && Number.isFinite(Number(row.min_order_quantity))) ? Number(row.min_order_quantity) : null
            });
            if (type === 'comparison') item.image_url_before = imageUrlBefore;
            if (type === 'series' && seriesUrls.length) item.series_image_urls = seriesUrls;
            return res.set('Cache-Control', 'public, max-age=120').json({ item });
        }
        if (type === 'collection') {
            const { data: row, error } = await supabase
                .from('media_collections')
                .select('id, title, slug, cover_image_url, image_urls, description, category_keys, manufacturer_id')
                .eq('id', id)
                .eq('is_active', true)
                .maybeSingle();
            if (error || !row) return res.status(404).json({ error: '找不到該系列' });
            let mfrUserId = null;
            if (row.manufacturer_id) {
                const { data: mfr } = await supabase.from('manufacturers').select('user_id').eq('id', row.manufacturer_id).eq('is_active', true).maybeSingle();
                if (mfr) mfrUserId = mfr.user_id || null;
            }
            const cover = row.cover_image_url || null;
            const imageUrls = (row.image_urls && Array.isArray(row.image_urls) && row.image_urls.length) ? row.image_urls : (cover ? [cover] : []);
            const item = {
                type: 'collection',
                size: '1x2',
                id: row.id,
                title: row.title || '系列',
                slug: row.slug,
                cover_image_url: cover,
                series_image_urls: imageUrls,
                description: row.description || null,
                manufacturer_id: row.manufacturer_id || null,
                manufacturer_user_id: mfrUserId,
                link: row.manufacturer_id ? '/vendor-profile.html?id=' + encodeURIComponent(row.manufacturer_id) : (row.slug ? '/custom/collection.html?slug=' + encodeURIComponent(row.slug) : '/custom/gallery.html'),
                category_keys: Array.isArray(row.category_keys) ? row.category_keys : []
            };
            return res.set('Cache-Control', 'public, max-age=120').json({ item });
        }
        return res.status(400).json({ error: '不支援的 type' });
    } catch (e) {
        console.error('GET /api/media-wall-item 異常:', e);
        if (!res.headersSent) res.status(500).json({ error: '系統錯誤' });
    }
});
}

module.exports = { registerMediaWallRoutes };
