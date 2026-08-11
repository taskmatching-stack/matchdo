'use strict';

/** 商攝・空間 layout_plan / eye_level — prompt 與尺寸（Gemini 生圖在 server.js 接線） */

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
    '3:4': 3 / 4,
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
    if (key === '2k') return '2k';
    const w = parseInt(width, 10) || 0;
    const h = parseInt(height, 10) || 0;
    if (Math.max(w, h) >= SPACE_4K_MIN_EDGE) return '4k';
    return '2k';
}

function minEdgeForSpaceTier(tier) {
    return normalizeSpaceResolutionTier(tier) === '4k' ? SPACE_4K_MIN_EDGE : SPACE_LAYOUT_MIN_EDGE;
}

/** 内部 tier（2k/4k）→ 官方 imageConfig.imageSize（2K/4K） */
function geminiImageSizeFromTier(tier) {
    return normalizeSpaceResolutionTier(tier) === '4k' ? '4K' : '2K';
}

/** UI 长宽比 → 官方 imageConfig.aspectRatio；不支援者映射至最接近 */
function normalizeGeminiAspectRatio(ratio) {
    const r = String(ratio || '1:1').trim();
    if (GEMINI_SUPPORTED_ASPECT_RATIOS.has(r)) return r;
    const fallback = { '3:1': '21:9', '1:3': '9:21' };
    if (fallback[r]) return fallback[r];
    return '1:1';
}

/**
 * @google/genai generateContent config.imageConfig
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
    /* 官網：未設 imageSize 時預設 1K＝1024×1024；必須傳大寫 2K／4K
       https://ai.google.dev/gemini-api/docs/image-generation */
    return {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: buildPromoSpaceGeminiImageConfig(opts)
    };
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
    residential: { label: '住家空間', layoutLabel: '住家／住宅空間' },
    restaurant: { label: '餐飲商業空間', layoutLabel: '餐飲商業空間' },
    retail: { label: '零售商業空間', layoutLabel: '零售商業空間' },
    office: { label: '辦公商業空間', layoutLabel: '辦公商業空間' },
    exhibition: { label: '展覽商業空間', layoutLabel: '展覽／活動空間' },
    hotel: { label: '飯店／民宿空間', layoutLabel: '飯店 hospitality 商業空間' },
    clinic: { label: '診所／美業空間', layoutLabel: '醫美商業空間' }
};

function normalizeSpaceUseType(raw) {
    const key = String(raw || 'residential').trim().toLowerCase();
    return SPACE_USE_TYPES[key] ? key : 'residential';
}

function getSpaceUseLayoutLabel(spaceUseType) {
    const t = SPACE_USE_TYPES[normalizeSpaceUseType(spaceUseType)];
    return t.layoutLabel;
}

function listSpaceUseTypesForApi() {
    return Object.keys(SPACE_USE_TYPES).map(function (key) {
        const row = SPACE_USE_TYPES[key];
        return { key: key, name: row.label, name_en: row.label };
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
 * 平視主訴求句 — 對齊官網實測（*** 分開強調視角／捨棄原圖／商業攝影）
 * 鏡頭句可附加（官網加鏡頭也OK）；禁止刪 *** 與「捨棄原圖視角」
 */
const EYE_LEVEL_PROMPT_TEMPLATE_EXPLICIT =
    '利用這個地圖幫我生成***{viewpoint}***，***捨棄原圖視角***，室內設計用的{room}***商業攝影圖***，不需要任何文字';
const EYE_LEVEL_PROMPT_TEMPLATE_GUIDED =
    '利用這個地圖幫我生成***站在門口看{room}的視角***，***捨棄原圖視角***，室內設計用的{room}***商業攝影圖***，不需要任何文字';

function fillEyeLevelPromptTemplate(tpl, vars) {
    return String(tpl || '')
        .replace(/\{viewpoint\}/g, String((vars && vars.viewpoint) || '').trim())
        .replace(/\{room\}/g, String((vars && vars.room) || '').trim());
}

/** 從「站在門口看客廳」類句子抽出區域名，供官網模板 [客廳] 替換 */
function inferRoomLabelFromViewpoint(viewpoint) {
    const vp = String(viewpoint || '').trim();
    if (!vp) return '';
    const m = vp.match(/看\s*([^\s的，,]+?)(?:的視角|視角)?$/);
    if (m && m[1]) return m[1].trim();
    return '';
}

function appendEyeLevelCameraAndProduct(prompt, opts) {
    let out = String(prompt || '');
    const cameraBlock = String((opts && opts.cameraBlock) || '').trim();
    if (cameraBlock) out += `，鏡頭與曝光：${cameraBlock}`;
    if (opts && opts.hasStagingProduct === true) {
        out += '，並自然呈現產品參考圖中的產品';
    }
    return out;
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

/** 依 UI 長寬比 + 2K/4K 檔位解析輸出尺寸（不信任前端 1024 預設） */
function resolveSpaceOutputDimensions(opts) {
    const o = opts && typeof opts === 'object' ? opts : {};
    const tier = normalizeSpaceResolutionTier(o.tier || o.space_resolution_tier, o.width, o.height);
    const ratio = String(o.aspectRatio || o.aspect_ratio || '1:1').trim() || '1:1';
    const fromRatio = dimsForSpaceRatio(ratio, tier);
    return clampPromoSpaceLayoutDimensions(fromRatio.width, fromRatio.height, { tier: tier });
}

/**
 * layout_plan 輸出尺寸：最長邊 ≥ 2048（P0 空間 Pro 最低 2K）
 */
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

    return [
        `幫我把第一張平面配置圖改為***寫實攝影品質***${stylePhrase}的${spaceUseLabel}${supplementBit}${productBit}，`,
        '***45度ISO視角呈現空間圖，盡量放大並完整呈現，每個門和隔間務必對照原圖並且清晰合邏輯***，',
        '牆面須可見高度與厚度；禁止正俯視、鳥瞰、90度頂視、平面配置圖視角或2D平面重繪；門、隔間、牆體位置不可移位、合併或省略，',
        '材質與光感須寫實：自然採光、真實紋理、柔和陰影；禁止3D示意模型感、插畫感、遊戲引擎渲染感或過度平滑的假數位質感，',
        cameraBlock ? `鏡頭與曝光：${cameraBlock}，` : '',
        '不須任何文字描述、標籤或 logo，***寫實攝影品質***，',
        `解析度${w}X${h}`
    ].join('');
}

/**
 * eye_level（明確視角）— 官網主訴求句 + 可附加鏡頭句
 * 例：利用這個地圖幫我生成***站在門口看客廳的視角***，***捨棄原圖視角***，室內設計用的客廳***商業攝影圖***，不需要任何文字，鏡頭與曝光：…
 */
function buildPromoSpaceEyeLevelExplicitGeminiPrompt(opts) {
    const o = opts && typeof opts === 'object' ? opts : {};
    const viewpoint = String(o.viewpoint || o.userPrompt || '').trim();
    if (!viewpoint) throw new Error('請填寫拍攝視角（例：站在門口看客廳）');
    const room = String(o.zoneHint || o.roomLabel || o.room || '').trim()
        || inferRoomLabelFromViewpoint(viewpoint)
        || '空間';
    const viewpointForStar = /視角\s*$/.test(viewpoint) ? viewpoint : (viewpoint + '的視角');
    const base = fillEyeLevelPromptTemplate(EYE_LEVEL_PROMPT_TEMPLATE_EXPLICIT, {
        viewpoint: viewpointForStar,
        room: room
    });
    return appendEyeLevelCameraAndProduct(base, o);
}

/**
 * eye_level guided — 同官網主訴求（[客廳]→區域名）+ 可附加鏡頭句
 */
function buildPromoSpaceEyeLevelGuidedGeminiPrompt(opts) {
    const o = opts && typeof opts === 'object' ? opts : {};
    const useType = normalizeSpaceUseType(o.spaceUseType);
    const intentKey = String(o.intentKey || o.zoneKey || '').trim();
    const zoneRow = getSpaceZoneIntent(useType, intentKey);
    if (!zoneRow) throw new Error('無效的拍攝區域');
    const room = String(o.zoneLabel || zoneRow.name || '').trim();
    if (!room) throw new Error('無效的拍攝區域');
    const base = fillEyeLevelPromptTemplate(EYE_LEVEL_PROMPT_TEMPLATE_GUIDED, { room: room });
    return appendEyeLevelCameraAndProduct(base, o);
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
    const out = await sharp(buffer, { failOn: 'none' }).rotate()
        .resize(tw, th, { fit: 'cover', position: 'centre', kernel: sharp.kernel.lanczos3 })
        .jpeg({ quality: 92, mozjpeg: true })
        .toBuffer();
    const measured = await measurePromoSpaceImageDimensions(out);
    const minEdge = minEdgeForSpaceTier(clamped.space_resolution_tier || (opts && opts.tier));
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
    normalizeSpaceResolutionTier,
    minEdgeForSpaceTier,
    geminiImageSizeFromTier,
    normalizeGeminiAspectRatio,
    buildPromoSpaceGeminiImageConfig,
    buildPromoSpaceGeminiGenerateConfig,
    dimsForSpaceRatio,
    getSpaceUseLayoutLabel,
    listSpaceUseTypesForApi,
    listSpaceZoneIntentsForApi,
    listAllSpaceZoneIntentsForApi,
    getSpaceZoneIntent,
    listSpaceRatioPresetsForApi,
    resolveSpaceOutputDimensions,
    measurePromoSpaceImageDimensions,
    clampPromoSpaceLayoutDimensions,
    buildPromoSpaceLayoutPlanGeminiPrompt,
    buildPromoSpaceEyeLevelExplicitGeminiPrompt,
    buildPromoSpaceEyeLevelGuidedGeminiPrompt,
    ensurePromoSpaceOutputDimensions,
    ensurePromoSpaceImageMinEdge
};
