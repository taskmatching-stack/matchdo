'use strict';

/**
 * 情境主題／場景顯示名：API lang=en 時用 DB name_en；
 * 舊列未填或 name_en 仍是中文時，用種子／已知中文名 fallback。
 */

function looksLatinDisplayName(s) {
    return /[A-Za-z]/.test(String(s || ''));
}

const NAME_EN_BY_KEY = {
    product_hero_ad: 'Hero / Banner',
    hero_banner: 'Hero / Banner',
    banner_hero: 'Hero / Banner',
    flyer_dm: 'Email / EDM',
    campaign_promo: 'Campaign promo',
    brand_premium: 'Brand premium ad',
    catalog_ad: 'Catalog / ecommerce ad',
    social_post: 'Social post',
    social_feed: 'Social post',
    portrait_corporate: 'Corporate portrait',
    portrait_fashion_lookbook: 'Fashion lookbook',
    portrait_lifestyle: 'Lifestyle',
    portrait_sports: 'Sports',
    portrait_beauty: 'Beauty',
    portrait_formal_id: 'Formal ID portrait',
    portrait_brand_image: 'Brand image',
    portrait_social_content: 'Social content',
    scene_clean_studio: 'Clean studio',
    scene_retail_display: 'Retail display',
    scene_exhibition: 'Exhibition booth',
    scene_soft_gradient: 'Soft gradient',
    scene_outdoor_campaign: 'Outdoor campaign'
};

const NAME_EN_BY_ZH = {
    '主視覺/Banner': 'Hero / Banner',
    '產品主視覺廣告': 'Hero product ad',
    '商品頁情境輔助圖': 'Product-page lifestyle',
    '社群貼文': 'Social post',
    '活動宣傳風': 'Campaign promo',
    '廣告投放素材': 'Paid ad creative',
    '品牌質感廣告': 'Brand premium ad',
    '型錄／電商廣告': 'Catalog / ecommerce ad',
    '型錄/電商廣告': 'Catalog / ecommerce ad',
    '電子報/EDM行銷': 'Email / EDM',
    'DM／傳單風': 'Flyer / DM',
    '品牌形象/關於我們頁面': 'Brand / About page',
    '純商品規格展示（無情境）': 'Spec shot (no scene)',
    '商業形象': 'Corporate portrait',
    '時尚型錄': 'Fashion lookbook',
    '生活情境': 'Lifestyle',
    '運動': 'Sports',
    '美妝': 'Beauty',
    '證件／正式肖像': 'Formal ID portrait',
    '品牌形象': 'Brand image',
    '社群內容': 'Social content',
    '乾淨棚拍場景': 'Clean studio',
    '零售陳列場景': 'Retail display',
    '展場／活動攤位': 'Exhibition booth',
    '柔色漸層背景': 'Soft gradient',
    '戶外廣告場景': 'Outdoor campaign'
};

function resolvePromoTemplateDisplayName(row, lang) {
    if (!row) return '';
    const l = String(lang || '').toLowerCase().replace(/-.*$/, '');
    const zh = String(row.name || '').trim();
    const key = String(row.key || '').trim();
    if (l === 'en') {
        const fromDb = String(row.name_en || '').trim();
        if (fromDb && looksLatinDisplayName(fromDb)) return fromDb;
        const mapped = NAME_EN_BY_ZH[zh] || NAME_EN_BY_KEY[key];
        if (mapped) return mapped;
        return fromDb || zh;
    }
    const col = { ja: 'name_ja', es: 'name_es', de: 'name_de', fr: 'name_fr' }[l];
    if (col && row[col] && String(row[col]).trim()) return String(row[col]).trim();
    return zh;
}

module.exports = {
    looksLatinDisplayName,
    NAME_EN_BY_KEY,
    NAME_EN_BY_ZH,
    resolvePromoTemplateDisplayName
};
