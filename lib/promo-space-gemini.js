'use strict';

/** 商攝・空間 layout_plan / eye_level — prompt 與尺寸（Gemini 生圖在 server.js 接線） */

const SPACE_1K_MIN_EDGE = 1024;
const SPACE_LAYOUT_MIN_EDGE = 2048;
const SPACE_4K_MIN_EDGE = 4096;
const SPACE_MAX_EDGE = 4096;

/** 官方 generateContent imageConfig.imageSize（K 须大写，见 ai.google.dev/gemini-api/docs/image-generation） */
const GEMINI_IMAGE_SIZES = Object.freeze(['1K', '2K', '4K']);

/** gemini-3-pro-image 支援的 aspectRatio（Google Cloud 模型卡） */
const GEMINI_SUPPORTED_ASPECT_RATIOS = new Set([
    '1:1', '3:2', '2:3', '3:4', '4:3', '4:5', '5:4', '1:4', '4:1', '1:8', '8:1', '9:16', '16:9', '21:9', '9:21'
]);

const SPACE_RATIO_ASPECT = {
    '1:1': 1,
    '4:3': 4 / 3,
    '3:2': 3 / 2,
    '3:4': 3 / 4,
    '2:3': 2 / 3,
    '16:9': 16 / 9,
    '9:16': 9 / 16,
    '21:9': 21 / 9,
    '3:1': 3,
    '4:1': 4,
    '9:21': 9 / 21,
    '1:3': 1 / 3,
    '1:4': 1 / 4
};

function normalizeSpaceResolutionTier(raw, width, height) {
    const key = String(raw || '').trim().toLowerCase();
    if (key === '4k') return '4k';
    if (key === '1k') return '1k';
    if (key === '2k') return '2k';
    const w = parseInt(width, 10) || 0;
    const h = parseInt(height, 10) || 0;
    if (Math.max(w, h) >= SPACE_4K_MIN_EDGE) return '4k';
    /* 未帶 tier 時一律 2k；勿因 width=1024 推成 1k（空間模式禁止） */
    return '2k';
}

function minEdgeForSpaceTier(tier) {
    const t = normalizeSpaceResolutionTier(tier);
    if (t === '4k') return SPACE_4K_MIN_EDGE;
    if (t === '1k') return SPACE_1K_MIN_EDGE;
    return SPACE_LAYOUT_MIN_EDGE;
}

/** 内部 tier（1k/2k/4k）→ 官方 imageSize（1K/2K/4K；K 须大写） */
function geminiImageSizeFromTier(tier) {
    const t = normalizeSpaceResolutionTier(tier);
    if (t === '4k') return '4K';
    if (t === '1k') return '1K';
    return '2K';
}

/** UI 长宽比 → 官方 aspectRatio；不支援者映射至最接近 */
function normalizeGeminiAspectRatio(ratio) {
    const r = String(ratio || '1:1').trim();
    if (GEMINI_SUPPORTED_ASPECT_RATIOS.has(r)) return r;
    const fallback = { '3:1': '21:9', '1:3': '9:21' };
    if (fallback[r]) return fallback[r];
    return '1:1';
}

/**
 * @google/genai generateContent config.imageConfig（舊路徑；空間生圖已改 Interactions）
 * @see https://ai.google.dev/gemini-api/docs/image-generation
 */
function buildPromoSpaceGeminiImageConfig(opts) {
    const o = opts && typeof opts === 'object' ? opts : {};
    return {
        aspectRatio: normalizeGeminiAspectRatio(o.aspectRatio || o.aspect_ratio),
        imageSize: geminiImageSizeFromTier(o.tier || o.space_resolution_tier)
    };
}

function buildPromoSpaceGeminiGenerateConfig(opts) {
    return {
        responseModalities: ['Image'],
        imageConfig: buildPromoSpaceGeminiImageConfig(opts)
    };
}

/**
 * Interactions API response_format（需 @google/genai >= 2.0）
 * 官方：aspect_ratio + image_size 在 response_format，不在 generation_config.image_config
 * @see https://ai.google.dev/gemini-api/docs/interactions/image-generation
 */
function buildPromoSpaceInteractionsResponseFormat(opts) {
    const o = opts && typeof opts === 'object' ? opts : {};
    return {
        type: 'image',
        mime_type: 'image/jpeg',
        aspect_ratio: normalizeGeminiAspectRatio(o.aspectRatio || o.aspect_ratio),
        image_size: geminiImageSizeFromTier(o.tier || o.space_resolution_tier)
    };
}

/** Interactions multimodal input：文字 + 參考圖（type/image + mime_type + data） */
function buildPromoSpaceInteractionsInput(promptText, imageRefs) {
    const input = [{ type: 'text', text: String(promptText || '').trim() }];
    (Array.isArray(imageRefs) ? imageRefs : []).forEach(function (img) {
        if (!img || !img.base64) return;
        input.push({
            type: 'image',
            mime_type: String(img.mime || img.mimeType || 'image/jpeg').split(';')[0] || 'image/jpeg',
            data: String(img.base64)
        });
    });
    return input;
}

/** 空間模式：依長寬比 + 2K／4K 檔位計算輸出尺寸（最長邊 = 2048 或 4096） */
function dimsForSpaceRatio(ratio, tier) {
    const t = normalizeSpaceResolutionTier(tier);
    const minLong = minEdgeForSpaceTier(t);
    const usedRatio = SPACE_RATIO_ASPECT[ratio] ? ratio : '1:1';
    const aspect = SPACE_RATIO_ASPECT[usedRatio] || 1;
    let w;
    let h;
    if (aspect >= 1) {
        w = minLong;
        h = Math.round(minLong / aspect);
    } else {
        h = minLong;
        w = Math.round(minLong * aspect);
    }
    w = Math.max(512, Math.round(w / 8) * 8);
    h = Math.max(512, Math.round(h / 8) * 8);
    return {
        width: w,
        height: h,
        w: w,
        h: h,
        ratio: usedRatio,
        space_resolution_tier: t,
        tier: t,
        tierLabel: t === '4k' ? '4K' : '2K'
    };
}

const SPACE_USE_TYPES = {
    residential: {
        label: '住家空間',
        label_en: 'Residential',
        layoutLabel: '住家／住宅空間',
        layoutLabel_en: 'residential / home interior'
    },
    restaurant: {
        label: '餐飲商業空間',
        label_en: 'Dining / F&B',
        layoutLabel: '餐飲商業空間',
        layoutLabel_en: 'restaurant / dining commercial space'
    },
    retail: {
        label: '零售商業空間',
        label_en: 'Retail',
        layoutLabel: '零售商業空間',
        layoutLabel_en: 'retail commercial space'
    },
    office: {
        label: '辦公商業空間',
        label_en: 'Office',
        layoutLabel: '辦公商業空間',
        layoutLabel_en: 'office commercial space'
    },
    exhibition: {
        label: '展覽商業空間',
        label_en: 'Exhibition',
        layoutLabel: '展覽／活動空間',
        layoutLabel_en: 'exhibition / event space'
    },
    hotel: {
        label: '飯店／民宿空間',
        label_en: 'Hotel / B&B',
        layoutLabel: '飯店 hospitality 商業空間',
        layoutLabel_en: 'hotel / hospitality commercial space'
    },
    clinic: {
        label: '診所／美業空間',
        label_en: 'Clinic / Beauty',
        layoutLabel: '醫美商業空間',
        layoutLabel_en: 'clinic / beauty commercial space'
    }
};

function normalizeSpaceUseType(raw) {
    const key = String(raw || 'residential').trim().toLowerCase();
    if (SPACE_USE_TYPES[key]) return key;
    /* 後台可新增 key；未知格式才回退 residential */
    if (/^[a-z][a-z0-9_]{0,63}$/.test(key)) return key;
    return 'residential';
}

/** layout_plan 空間地圖視角：iso_45（預設）｜top_down（正上方俯視） */
function normalizeSpaceLayoutView(raw) {
    const v = String(raw || 'iso_45').trim().toLowerCase();
    if (v === 'top_down' || v === 'topdown' || v === 'bird_eye' || v === 'birdseye') return 'top_down';
    return 'iso_45';
}

function spaceLayoutViewLabel(view) {
    return normalizeSpaceLayoutView(view) === 'top_down' ? '俯視空間地圖' : 'ISO 空間地圖';
}

function getSpaceUseLayoutLabel(spaceUseType, lang) {
    const key = normalizeSpaceUseType(spaceUseType);
    const t = SPACE_USE_TYPES[key];
    if (t) {
        if (String(lang || '').toLowerCase() === 'en' && t.layoutLabel_en) return t.layoutLabel_en;
        return t.layoutLabel;
    }
    return key;
}

function listSpaceUseTypesForApi(lang) {
    const en = String(lang || '').toLowerCase() === 'en';
    return Object.keys(SPACE_USE_TYPES).map(function (key) {
        const row = SPACE_USE_TYPES[key];
        return {
            key: key,
            name: en && row.label_en ? row.label_en : row.label,
            name_en: row.label_en || row.label
        };
    });
}

/** §3.6.2 平視套圖區域（P1 內建；後台 DB 就緒前 fallback） */
const SPACE_ZONE_INTENTS = {
    residential: [
        { key: 'living', name: '客廳', name_en: 'Living room', intent_brief: 'living room', sort_order: 10 },
        { key: 'master_bedroom', name: '主臥', name_en: 'Master bedroom', intent_brief: 'master bedroom', sort_order: 20 },
        { key: 'kitchen_dining', name: '餐廚', name_en: 'Kitchen & dining', intent_brief: 'kitchen and dining area', sort_order: 30 },
        { key: 'bathroom', name: '衛浴', name_en: 'Bathroom', intent_brief: 'bathroom', sort_order: 40 },
        { key: 'study', name: '書房', name_en: 'Study', intent_brief: 'study or home office', sort_order: 50 },
        { key: 'balcony', name: '陽台', name_en: 'Balcony', intent_brief: 'balcony', sort_order: 60 },
        { key: 'entry', name: '玄關', name_en: 'Entry', intent_brief: 'entry foyer', sort_order: 70 }
    ],
    restaurant: [
        { key: 'dining', name: '用餐區', name_en: 'Dining area', intent_brief: 'main dining area', sort_order: 10 },
        { key: 'bar', name: '吧台', name_en: 'Bar', intent_brief: 'bar counter area', sort_order: 20 },
        { key: 'kitchen_open', name: '開放廚房', name_en: 'Open kitchen', intent_brief: 'open kitchen', sort_order: 30 },
        { key: 'private_room', name: '包廂', name_en: 'Private room', intent_brief: 'private dining room', sort_order: 40 },
        { key: 'entry', name: '候位／入口', name_en: 'Entry', intent_brief: 'entry and waiting area', sort_order: 50 }
    ],
    retail: [
        { key: 'window', name: '入口橱窗', name_en: 'Storefront', intent_brief: 'storefront window display', sort_order: 10 },
        { key: 'main_aisle', name: '主通道', name_en: 'Main aisle', intent_brief: 'main circulation aisle', sort_order: 20 },
        { key: 'display', name: '陳列區', name_en: 'Display zone', intent_brief: 'product display zone', sort_order: 30 },
        { key: 'checkout', name: '收銀', name_en: 'Checkout', intent_brief: 'checkout counter', sort_order: 40 },
        { key: 'fitting', name: '試衣／體驗', name_en: 'Fitting / experience', intent_brief: 'fitting or experience zone', sort_order: 50 }
    ],
    office: [
        { key: 'reception', name: '接待大廳', name_en: 'Reception', intent_brief: 'reception lobby', sort_order: 10 },
        { key: 'open_office', name: '開放工位', name_en: 'Open office', intent_brief: 'open workspace', sort_order: 20 },
        { key: 'meeting', name: '會議室', name_en: 'Meeting room', intent_brief: 'meeting room', sort_order: 30 },
        { key: 'executive', name: '主管室', name_en: 'Executive office', intent_brief: 'executive office', sort_order: 40 },
        { key: 'pantry', name: '茶水區', name_en: 'Pantry', intent_brief: 'pantry break area', sort_order: 50 }
    ],
    exhibition: [
        { key: 'main_entry', name: '主入口', name_en: 'Main entry', intent_brief: 'main exhibition entry', sort_order: 10 },
        { key: 'main_aisle', name: '主通道', name_en: 'Main aisle', intent_brief: 'main circulation path', sort_order: 20 },
        { key: 'core_display', name: '核心展區', name_en: 'Core display', intent_brief: 'core exhibition zone', sort_order: 30 },
        { key: 'meeting', name: '洽談區', name_en: 'Meeting area', intent_brief: 'meeting and discussion area', sort_order: 40 },
        { key: 'service', name: '服務台', name_en: 'Service desk', intent_brief: 'service counter', sort_order: 50 }
    ],
    hotel: [
        { key: 'lobby', name: '大廳', name_en: 'Lobby', intent_brief: 'hotel lobby', sort_order: 10 },
        { key: 'guest_room', name: '客房', name_en: 'Guest room', intent_brief: 'guest room', sort_order: 20 },
        { key: 'bathroom', name: '衛浴', name_en: 'Bathroom', intent_brief: 'bathroom', sort_order: 30 },
        { key: 'restaurant', name: '餐廳', name_en: 'Restaurant', intent_brief: 'hotel restaurant', sort_order: 40 },
        { key: 'corridor', name: '走廊', name_en: 'Corridor', intent_brief: 'corridor', sort_order: 50 }
    ],
    clinic: [
        { key: 'reception', name: '接待', name_en: 'Reception', intent_brief: 'reception desk', sort_order: 10 },
        { key: 'waiting', name: '候診', name_en: 'Waiting area', intent_brief: 'waiting lounge', sort_order: 20 },
        { key: 'treatment', name: '診療／服務區', name_en: 'Treatment area', intent_brief: 'treatment or service room', sort_order: 30 },
        { key: 'corridor', name: '動線 corridor', name_en: 'Corridor', intent_brief: 'circulation corridor', sort_order: 40 }
    ]
};

const SPACE_USE_PHOTOGRAPHY_BRIEF = {
    residential: '室內設計住宅商業攝影',
    restaurant: '餐飲空間商業攝影，氛圍與動線',
    retail: '零售陳列商業攝影，商品與走道可讀',
    office: '辦公空間商業攝影，專業與採光',
    exhibition: '展場商業攝影，展品與人流動線',
    hotel: '飯店 hospitality 商業攝影',
    clinic: '診所／美業商業攝影，乾淨專業氛圍'
};

/**
 * 平視主訴求句 — 凍結（使用者定案，禁止改 *** 範圍與句式）
 * 僅 {from}/{to} 由站點／望向替換；鏡頭與曝光只接在後面，不得改寫主句。
 *
 * ***捨棄原圖ISO視角***，***禁止俯視圖***，解讀這個地圖後幫我重繪呈現***人在此場景內從B看向C的低視角***，視角內的格局和結構不能和原圖衝突，室內設計用的商業攝影圖，***不需要任何文字和標註***
 */
const EYE_LEVEL_PROMPT_TEMPLATE =
    '***捨棄原圖ISO視角***，***禁止俯視圖***，解讀這個地圖後幫我重繪呈現***人在此場景內從{from}看向{to}的低視角***，視角內的格局和結構不能和原圖衝突，室內設計用的商業攝影圖，***不需要任何文字和標註***';

function fillEyeLevelPromptTemplate(tpl, vars) {
    return String(tpl || '')
        .replace(/\{from\}/g, String((vars && vars.from) || '').trim())
        .replace(/\{to\}/g, String((vars && vars.to) || '').trim());
}

function normalizeEyeLevelMarkLetter(raw) {
    const s = String(raw || '').trim().toUpperCase();
    if (/^[A-Z]$/.test(s)) return s;
    return '';
}

/** 鏡頭／產品只接在定案主句之後，不得插入或改寫主句 */
function appendEyeLevelCameraAndProduct(prompt, opts) {
    let out = String(prompt || '');
    const o = opts && typeof opts === 'object' ? opts : {};
    const cameraBlock = String(o.cameraBlock || '').trim();
    if (cameraBlock) out += '，' + cameraBlock;
    if (o.hasStagingProduct === true) {
        out += '，並自然呈現產品參考圖中的產品';
    }
    return out;
}

function listKnownSpaceRoomLabels(spaceUseType) {
    const rows = SPACE_ZONE_INTENTS[normalizeSpaceUseType(spaceUseType)] || SPACE_ZONE_INTENTS.residential;
    const labels = [];
    rows.forEach(function (r) {
        const n = String(r.name || '').trim();
        const en = String(r.name_en || '').trim();
        if (n) labels.push(n);
        if (en && en !== n) labels.push(en);
    });
    return labels;
}

function defaultRoomLabelForSpaceUse(spaceUseType) {
    const rows = SPACE_ZONE_INTENTS[normalizeSpaceUseType(spaceUseType)] || SPACE_ZONE_INTENTS.residential;
    const sorted = rows.slice().sort(function (a, b) {
        return (a.sort_order || 0) - (b.sort_order || 0);
    });
    return (sorted[0] && sorted[0].name) || '空間';
}

/**
 * 從視角句抽出區域名：只認已知區域。
 * 「看沙發」→ room 不填沙發，改預設該用途第一區（住家＝客廳）。
 */
function inferRoomLabelFromViewpoint(viewpoint, spaceUseType) {
    const vp = String(viewpoint || '').trim();
    if (!vp) return '';
    const known = listKnownSpaceRoomLabels(spaceUseType);
    for (let i = 0; i < known.length; i++) {
        const label = known[i];
        if (!label) continue;
        if (vp.indexOf(label) !== -1) return label;
    }
    return '';
}

function resolveEyeLevelRoomLabel(opts) {
    const o = opts && typeof opts === 'object' ? opts : {};
    const useType = normalizeSpaceUseType(o.spaceUseType);
    const explicit = String(o.zoneHint || o.roomLabel || o.room || '').trim();
    if (explicit) {
        const known = listKnownSpaceRoomLabels(useType);
        if (known.indexOf(explicit) !== -1) return explicit;
        if (!/沙發|茶几|桌子|床|櫃/.test(explicit)) return explicit;
    }
    const inferred = inferRoomLabelFromViewpoint(o.viewpoint || o.userPrompt, useType);
    if (inferred) return inferred;
    return defaultRoomLabelForSpaceUse(useType);
}

function applySpaceZoneIntentLocale(row, lang) {
    const r = row && typeof row === 'object' ? row : {};
    const en = lang === 'en';
    return {
        key: r.key,
        name: en && r.name_en ? r.name_en : r.name,
        name_en: r.name_en || r.name,
        intent_brief: r.intent_brief || r.name_en || r.name,
        sort_order: r.sort_order || 0
    };
}

function listSpaceZoneIntentsForApi(spaceUseType, lang) {
    const useType = normalizeSpaceUseType(spaceUseType);
    const rows = SPACE_ZONE_INTENTS[useType] || SPACE_ZONE_INTENTS.residential;
    return rows.slice().sort(function (a, b) {
        return (a.sort_order || 0) - (b.sort_order || 0);
    }).map(function (row) {
        return applySpaceZoneIntentLocale(row, lang);
    });
}

function listAllSpaceZoneIntentsForApi(lang) {
    const out = {};
    Object.keys(SPACE_ZONE_INTENTS).forEach(function (useType) {
        out[useType] = listSpaceZoneIntentsForApi(useType, lang);
    });
    return out;
}

function getSpaceZoneIntent(spaceUseType, intentKey) {
    const key = String(intentKey || '').trim();
    if (!key) return null;
    const rows = SPACE_ZONE_INTENTS[normalizeSpaceUseType(spaceUseType)] || [];
    return rows.find(function (r) { return r.key === key; }) || null;
}

function listSpaceRatioPresetsForApi(tier) {
    const t = normalizeSpaceResolutionTier(tier);
    const out = {};
    Object.keys(SPACE_RATIO_ASPECT).forEach(function (ratio) {
        const d = dimsForSpaceRatio(ratio, t);
        out[ratio] = { w: d.width, h: d.height, width: d.width, height: d.height, mp: Math.ceil((d.width * d.height) / (1024 * 1024)) };
    });
    return out;
}

/** 依 UI 長寬比 + 2K/4K 檔位解析輸出尺寸（空間預設 2K＝2048；不採信前端 1024） */
function clampPromoSpaceLayoutDimensions(width, height, opts) {
    const o = opts && typeof opts === 'object' ? opts : {};
    const tier = normalizeSpaceResolutionTier(o.tier || o.space_resolution_tier, width, height);
    const minEdge = minEdgeForSpaceTier(tier);
    let w = parseInt(width, 10) || minEdge;
    let h = parseInt(height, 10) || minEdge;
    w = Math.min(SPACE_MAX_EDGE, Math.max(512, w));
    h = Math.min(SPACE_MAX_EDGE, Math.max(512, h));
    const long = Math.max(w, h);
    if (long < minEdge) {
        const scale = minEdge / long;
        w = Math.round(w * scale);
        h = Math.round(h * scale);
    }
    w = Math.min(SPACE_MAX_EDGE, Math.max(512, Math.round(w / 8) * 8));
    h = Math.min(SPACE_MAX_EDGE, Math.max(512, Math.round(h / 8) * 8));
    return { width: w, height: h, space_resolution_tier: tier };
}

/** 依來源圖比例縮放到指定檔位（最長邊 = 該檔 min edge） */
function dimensionsFromSourceRatio(srcW, srcH, tier) {
    const t = normalizeSpaceResolutionTier(tier);
    const minLong = minEdgeForSpaceTier(t);
    const sw = Math.max(1, parseInt(srcW, 10) || minLong);
    const sh = Math.max(1, parseInt(srcH, 10) || minLong);
    let w;
    let h;
    if (sw >= sh) {
        w = minLong;
        h = Math.round(minLong * sh / sw);
    } else {
        h = minLong;
        w = Math.round(minLong * sw / sh);
    }
    return clampPromoSpaceLayoutDimensions(w, h, { tier: t });
}

function resolveSpaceOutputDimensions(opts) {
    const o = opts && typeof opts === 'object' ? opts : {};
    /* 未帶 tier 時一律 2k（產品預設），勿因 body.width=1024 降成 1K */
    const tier = normalizeSpaceResolutionTier(o.tier || o.space_resolution_tier || '2k');
    if (o.use_source_ratio || o.useSourceRatio) {
        const sw = o.source_width || o.sourceWidth;
        const sh = o.source_height || o.sourceHeight;
        if (sw && sh) return dimensionsFromSourceRatio(sw, sh, tier);
    }
    const ratio = String(o.aspectRatio || o.aspect_ratio || '1:1').trim() || '1:1';
    const fromRatio = dimsForSpaceRatio(ratio, tier);
    return clampPromoSpaceLayoutDimensions(fromRatio.width, fromRatio.height, { tier: tier });
}

/**
 * ISO 空間配置圖 Gemini prompt（僅 {風格}、{空間用途} 可變；其餘固定）
 */
function buildPromoSpaceLayoutPlanGeminiPrompt(opts) {
    const o = opts && typeof opts === 'object' ? opts : {};
    const styleSource = o.styleSource === 'image' ? 'image' : 'prompt';
    const styleText = String(o.styleText || '').trim();
    const supplement = String(o.supplement || '').trim();
    const hasStagingProduct = o.hasStagingProduct === true;
    const cameraBlock = String(o.cameraBlock || '').trim();
    const dims = resolveSpaceOutputDimensions({
        tier: o.tier || o.space_resolution_tier,
        aspect_ratio: o.aspect_ratio || o.aspectRatio,
        width: o.width,
        height: o.height
    });
    const w = dims.width;
    const h = dims.height;
    const spaceUseLabel = getSpaceUseLayoutLabel(o.spaceUseType);

    let stylePhrase;
    if (styleSource === 'image') {
        stylePhrase = '風格請依風格參考圖的材質、色調、採光與設計語言';
    } else {
        if (!styleText) throw new Error('請填寫風格描述（例：莫蘭迪配色）');
        stylePhrase = styleText;
    }

    const supplementBit = supplement ? `，${supplement}` : '';
    const productBit = hasStagingProduct
        ? '，並將產品／陳列參考圖中的物件依平面配置自然置入空間適當位置，外形與該參考圖一致'
        : '';
    const layoutView = normalizeSpaceLayoutView(o.layoutView || o.space_layout_view);
    const angleBlock = layoutView === 'top_down'
        ? [
            '***正上方俯視（90度鳥瞰）視角呈現空間圖，盡量放大並完整呈現平面配置（完整呈現不裁切），每個門和隔間務必對照原圖並且清晰合邏輯***，',
            '須為真實空間的頂視攝影視角；禁止45度ISO、斜角透視、軸測或假3D透視；門、隔間、牆體位置不可移位、合併或省略，'
        ]
        : [
            '***45度ISO視角呈現空間圖，盡量放大並完整呈現（完整呈現不裁切），每個門和隔間務必對照原圖並且清晰合邏輯***，',
            '牆面須可見高度與厚度；禁止正俯視、鳥瞰、90度頂視、平面配置圖視角或2D平面重繪；門、隔間、牆體位置不可移位、合併或省略，'
        ];

    return [
        `幫我把第一張平面配置圖改為***寫實攝影品質***${stylePhrase}的${spaceUseLabel}${supplementBit}${productBit}，`,
        angleBlock[0],
        angleBlock[1],
        '材質與光感須寫實：自然採光、真實紋理、柔和陰影；禁止3D示意模型感、插畫感、遊戲引擎渲染感或過度平滑的假數位質感，',
        cameraBlock ? (cameraBlock + '，') : '',
        '不須任何文字描述、標籤或 logo，***寫實攝影品質***，',
        `解析度${w}X${h}`
    ].join('');
}

/**
 * 人像攝影（清晰＝Banana Pro，氛圍草稿＝Lite）
 * 輸出尺寸依使用者 MP：1MP＝1K、4MP＝2K、16MP＝4K。不是空間模式的「最低 2K」。
 */
function buildPromoPortraitGeminiPrompt(opts) {
    const o = opts && typeof opts === 'object' ? opts : {};
    const tier = normalizeSpaceResolutionTier(o.tier || o.space_resolution_tier);
    const defaultMin = minEdgeForSpaceTier(tier);
    const minLong = Math.max(1, parseInt(o.minLongEdge, 10) || defaultMin);
    let w = parseInt(o.width, 10) || minLong;
    let h = parseInt(o.height, 10) || minLong;
    const long = Math.max(w, h);
    if (long < minLong) {
        const scale = minLong / long;
        w = Math.round(w * scale);
        h = Math.round(h * scale);
    }
    const themeLabel = String(o.themeLabel || o.themeKey || '').trim();
    const themePrompt = String(o.themePrompt || '').trim();
    const themeComposition = String(o.themeComposition || '').trim();
    const sceneLabel = String(o.sceneLabel || '').trim();
    const scenePrompt = String(o.scenePrompt || '').trim();
    const sceneComposition = String(o.sceneComposition || '').trim();
    const userPrompt = String(o.userPrompt || '').trim();
    const shotBrief = String(o.shotBrief || '').trim();
    const cameraBlock = String(o.cameraBlock || '').trim();
    const hasSceneImage = !!o.hasSceneImage;
    const hasStagingProduct = !!o.hasStagingProduct;
    const parts = [];

    parts.push(
        'Commercial portrait photography. Preserve the same person\'s facial identity and likeness from reference image 1. '
        + 'Clothing, hairstyle, accessories, and styling may follow the user description and theme.'
    );
    if (hasSceneImage && hasStagingProduct) {
        parts.push(
            'Reference image 2 is the scene/environment. Reference image 3 is a product or prop. '
            + 'Place the same person into the scene and integrate the product naturally.'
        );
    } else if (hasSceneImage) {
        parts.push(
            'Reference image 2 is the scene/environment. Place the same person into this environment; match lighting and spatial context.'
        );
    } else if (hasStagingProduct) {
        parts.push(
            'Reference image 2 is a product or prop to feature. Integrate it naturally while preserving facial identity.'
        );
    }
    if (themeLabel || themePrompt || themeComposition) {
        parts.push(
            ['Shoot theme', themeLabel, themePrompt, themeComposition].filter(Boolean).join(': ')
        );
    }
    if (hasSceneImage) {
        parts.push('Use the scene reference for environment; do not invent a conflicting background.');
    } else if (sceneLabel || scenePrompt || sceneComposition) {
        parts.push(
            ['Scene', sceneLabel, scenePrompt, sceneComposition].filter(Boolean).join(': ')
        );
    }
    if (userPrompt) parts.push('Styling and details: ' + userPrompt);
    if (shotBrief) parts.push('This shot variation: ' + shotBrief);
    if (cameraBlock) parts.push(cameraBlock);
    parts.push('No text, labels, logos, or watermarks in the image.');
    parts.push('Output resolution ' + w + 'x' + h + '.');
    return parts.filter(Boolean).join(' ');
}

/**
 * eye_level — 定案主句（僅替換 from/to）；鏡頭參數只附加在後
 */
function buildPromoSpaceEyeLevelExplicitGeminiPrompt(opts) {
    const o = opts && typeof opts === 'object' ? opts : {};
    const from = normalizeEyeLevelMarkLetter(o.from || o.lookFrom || o.look_from) || 'B';
    const to = normalizeEyeLevelMarkLetter(o.to || o.lookTo || o.look_to) || 'C';
    if (from === to) throw new Error('站點與望向不可相同');
    /* 主句必須與此字串一致（*** 範圍不可改） */
    const base =
        '***捨棄原圖ISO視角***，***禁止俯視圖***，解讀這個地圖後幫我重繪呈現***人在此場景內從'
        + from
        + '看向'
        + to
        + '的低視角***，視角內的格局和結構不能和原圖衝突，需注意家具和隔間的角度，室內設計用的商業攝影圖，***不需要任何文字和標註***';
    return appendEyeLevelCameraAndProduct(base, o);
}

/**
 * eye_level guided — 同定案主句（from/to）
 */
function buildPromoSpaceEyeLevelGuidedGeminiPrompt(opts) {
    return buildPromoSpaceEyeLevelExplicitGeminiPrompt(opts);
}

/** Gemini SDK 常忽略 imageSize:2K；一律 sharp 縮放至目標像素（官方文件：2K=2048 長邊） */
async function measurePromoSpaceImageDimensions(buffer) {
    const sharp = require('sharp');
    const meta = await sharp(buffer, { failOn: 'none' }).metadata();
    return { width: meta.width || 0, height: meta.height || 0 };
}

async function ensurePromoSpaceOutputDimensions(buffer, width, height, opts) {
    const sharp = require('sharp');
    const clamped = resolveSpaceOutputDimensions(Object.assign({}, opts || {}, {
        tier: (opts && opts.tier) || (opts && opts.space_resolution_tier),
        width: width,
        height: height
    }));
    const tw = clamped.width;
    const th = clamped.height;
    if (!buffer || !buffer.length) {
        throw new Error('輸出圖為空');
    }
    const before = await measurePromoSpaceImageDimensions(buffer);
    const out = await sharp(buffer, { failOn: 'none' }).rotate()
        .resize(tw, th, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
        .jpeg({ quality: 92, mozjpeg: true })
        .toBuffer();
    const measured = await measurePromoSpaceImageDimensions(out);
    const minEdge = minEdgeForSpaceTier(clamped.space_resolution_tier || (opts && opts.tier));
    console.log('[promo-space] resize', before.width + 'x' + before.height, '→', measured.width + 'x' + measured.height, 'target', tw + 'x' + th, 'tier', clamped.space_resolution_tier);
    if (measured.width !== tw || measured.height !== th) {
        throw new Error(`輸出尺寸不符（得 ${measured.width}x${measured.height}，要 ${tw}x${th}）`);
    }
    if (Math.max(measured.width, measured.height) < minEdge) {
        throw new Error(`輸出解析度不足（${measured.width}x${measured.height}，要求長邊≥${minEdge}）`);
    }
    return out;
}

/** @deprecated 改用 ensurePromoSpaceOutputDimensions */
async function ensurePromoSpaceImageMinEdge(buffer, minEdge) {
    const edge = Math.max(512, parseInt(minEdge, 10) || SPACE_LAYOUT_MIN_EDGE);
    return ensurePromoSpaceOutputDimensions(buffer, edge, edge, { tier: edge >= SPACE_4K_MIN_EDGE ? '4k' : '2k' });
}

module.exports = {
    SPACE_LAYOUT_MIN_EDGE,
    SPACE_4K_MIN_EDGE,
    SPACE_MAX_EDGE,
    SPACE_USE_TYPES,
    SPACE_RATIO_ASPECT,
    normalizeSpaceUseType,
    normalizeSpaceLayoutView,
    spaceLayoutViewLabel,
    normalizeSpaceResolutionTier,
    minEdgeForSpaceTier,
    geminiImageSizeFromTier,
    normalizeGeminiAspectRatio,
    buildPromoSpaceGeminiImageConfig,
    buildPromoSpaceGeminiGenerateConfig,
    buildPromoSpaceInteractionsResponseFormat,
    buildPromoSpaceInteractionsInput,
    dimsForSpaceRatio,
    getSpaceUseLayoutLabel,
    listSpaceUseTypesForApi,
    listSpaceZoneIntentsForApi,
    listAllSpaceZoneIntentsForApi,
    getSpaceZoneIntent,
    listSpaceRatioPresetsForApi,
    resolveSpaceOutputDimensions,
    dimensionsFromSourceRatio,
    measurePromoSpaceImageDimensions,
    clampPromoSpaceLayoutDimensions,
    buildPromoSpaceLayoutPlanGeminiPrompt,
    buildPromoPortraitGeminiPrompt,
    buildPromoSpaceEyeLevelExplicitGeminiPrompt,
    buildPromoSpaceEyeLevelGuidedGeminiPrompt,
    normalizeEyeLevelMarkLetter,
    ensurePromoSpaceOutputDimensions,
    ensurePromoSpaceImageMinEdge
};
