'use strict';

const GEMINI_MODEL_TAGGING_DEFAULT = 'gemini-3.1-flash-lite';
const PROMPT_VERSION = 'v3.1';
const MATERIAL_PROMPT_VERSION = 'v7-material-tags-only';
const MATERIAL_FLUX_EDIT_PROMPT_VERSION = 'v1-material-flux-edit';

/** 分析維度 key → semantics 物件欄位名（image_semantics_json 內） */
const SEMANTICS_DIMENSION_FIELDS = {
    style: 'style_keywords',
    material: 'materials',
    color: 'colors',
    structure: 'structure',
    features: 'features',
    patterns: 'patterns',
    craftsmanship: 'craftsmanship',
    form: 'form',
    mood: 'mood',
    use_case: 'use_case'
};

const SEMANTICS_TAXONOMY_JSON_EXAMPLE = `{
  "tags": ["皮革", "leather", "極簡", "minimalist", "翻蓋", "flap"],
  "category_guess": "手提包 / Handbag",
  "style_keywords": ["極簡", "minimalist", "都會", "urban"],
  "materials": ["皮革", "leather", "金屬扣", "metal hardware"],
  "colors": ["米白", "off-white", "焦糖", "caramel"],
  "structure": ["翻蓋", "flap", "單肩", "shoulder strap"],
  "features": ["磁扣", "magnetic closure", "內袋", "inner pocket"],
  "patterns": ["素面", "plain", "無紋", "no pattern"],
  "craftsmanship": ["車縫", "stitched", "油邊", "edge painted"],
  "form": ["橫長", "horizontal", "軟結構", "soft structure"],
  "mood": ["精品感", "premium"],
  "use_case": ["通勤", "commute", "日常", "daily"],
  "intent_summary": "都會極簡皮革包訂製 / Urban minimalist leather bag customization",
  "product_description_zh": "（一段繁體中文產品說明，2～4 句，客觀描述外觀、材質、用途，勿 markdown）",
  "product_description_en": "(One English product description paragraph, 2–4 sentences, same content as zh, no markdown)",
  "locale": "zh-TW+en"
}`;

/** 情境圖：JSON 範例僅用占位符，禁止在 prompt 內寫死特定品類／材質範例 */
const PROMO_SCENE_SEMANTICS_JSON_EXAMPLE = `{
  "tags": ["（繁中搜尋詞）", "（english search term）"],
  "category_guess": "（依圖推斷品類，繁中 / English）",
  "style_keywords": [],
  "materials": [],
  "colors": [],
  "structure": [],
  "features": [],
  "patterns": [],
  "craftsmanship": [],
  "form": [],
  "mood": [],
  "use_case": [],
  "intent_summary": "（一行：繁中 / English）",
  "product_description_zh": "（2～4 句繁中：綜合可見場景與產品在畫面中的特色、表面質感、配色與宣傳調性；以圖為準，勿 markdown）",
  "product_description_en": "(2–4 English sentences: same synthesis of scene + visible product character and surface quality; image-first, no markdown)",
  "locale": "zh-TW+en"
}`;

/** 情境圖：雙語標籤與描述規則（通用詞，不列舉特定產品） */
const PROMO_SCENE_BILINGUAL_TAGS_RULE = `雙語標籤（必守，與使用者介面語系無關）：
- tags 陣列 14～28 個，須同時包含繁體中文與英文（約各半）；每個重要概念盡量「中文 + 英文」各一。
- 以圖片像素為準；附帶文字僅供對照，不可照抄或腦補圖中不存在的元素。
- 標籤須涵蓋兩類（依圖可見者填寫，看不清的維度留 []）：
  A. 場景／宣傳面：場景類型、氛圍、光線、構圖、用途調性（寫入 mood、use_case 等）
  B. 產品面：可見外型、主色與配色、表面材質、紋理／圖案、工藝質感、功能或賣點（寫入 materials、colors、patterns、craftsmanship、features 等）
- 下列分維陣列依圖填寫：style_keywords、materials、colors、structure、features、patterns、craftsmanship、form、mood、use_case。
- intent_summary：一行濃縮「場景 + 產品」整體印象，繁中後接「 / 」再寫英文。
- product_description_zh / product_description_en（**必填**，各 2～4 句）：
  · 須**綜合**寫出：① 場景／環境與光線氛圍 ② 產品在畫面中的呈現 ③ 可見特色與**表面質感** ④ 宣傳或用途調性
  · 只描述圖中可見內容；禁止空泛詞（精美、好看、高品質、時尚）與 markdown
  · 不可只重複 intent_summary 一句話`;

/** 與前台 lang 無關：每次產標籤須中英並存 */
const BILINGUAL_TAGS_RULE = `雙語標籤（必守，與使用者介面語系無關）：
- tags 陣列 14～28 個，須同時包含繁體中文與英文搜尋詞（約各半）。
- 每個重要概念盡量提供「中文 + 英文」各一個（例：皮革、leather）。
- 下列分維陣列皆須填寫（看不清可留空陣列 []，但 tags 不可為空）：
  · style_keywords（風格） · materials（材質） · colors（顏色／配色）
  · structure（結構／版型） · features（特色／賣點／功能件）
  · patterns（圖案／紋理） · craftsmanship（工藝／製程）
  · form（形態／輪廓） · mood（氛圍／調性） · use_case（場景／用途）
- intent_summary 用一行：繁中說明，後接「 / 」再寫一句英文；**繁中前半寫入 title、英文句寫入 title_en**（靈感牆依語系顯示），須具體描述圖中品項，禁止「產品設計圖」「未命名」「訂製產品」「Untitled」「Product design」等通用詞。
- product_description_zh：**必填**，3～5 句繁體中文產品說明（給廠商「簡短說明」欄位）。須具體寫：品項類型、可見外型輪廓、主色與配色、材質／表面質感、1～2 個可見賣點或功能件、典型訂製／使用情境；禁止空泛詞（精美、好看、高品質、時尚）與 markdown。
- product_description_en：**必填**，3～5 句英文段落，資訊與中文對應，勿逐字機翻腔、勿 markdown。
- product_description_zh/en 不可只重複 intent_summary 一句話。`;

/** 材料參考：不分析外型／展示載體，聚焦表面材質四要素 */
const MATERIAL_BILINGUAL_TAGS_RULE = `雙語標籤（必守，與使用者介面語系無關）：
- tags 陣列 14～28 個，須同時包含繁體中文與英文（約各半），且**主體必須是材質面向詞**，勿填室內設計、渲染場景、成品品類、風格空話。
- 下列四類為核心，每類至少 1 組「中文 + 英文」並寫入 tags 與對應欄位（缺一不可）：
  ① materials — 材質種類（例：大理石、marble；丹寧、denim）
  ② patterns — 紋理／圖案（例：流紋、veined；編織紋、woven texture）
  ③ colors — 配色（例：黑白灰、monochrome；焦糖棕、caramel brown）
  ④ craftsmanship — 光澤與表面工藝（例：拋光、polished；霧面、matte；拉丝、brushed）
- style_keywords、mood、use_case 僅可少量補充（合計不超過 tags 的 25%），不可取代上述四類。
- structure、features、form 一律 []。
- intent_summary：一行濃縮「材料特色」（須含種類＋紋理或配色或光澤／工藝），繁中後接「 / 」再寫英文；此句會作為素材預設標題。
- product_description_zh / product_description_en（**必填**，各 2～4 句）：只寫材質種類、紋理尺度、配色、光澤／工藝；勿寫球體、色卡架、渲染、室內／建築場景或成品品類。`;

const MATERIAL_SEMANTICS_JSON_EXAMPLE = `{
  "tags": ["大理石", "marble", "流紋", "veined", "黑白灰", "monochrome", "拋光", "polished", "亮面", "glossy", "雲紋", "marble grain"],
  "category_guess": "大理石 / Marble",
  "style_keywords": ["現代", "modern"],
  "materials": ["大理石", "marble", "天然石材", "natural stone"],
  "colors": ["黑", "black", "白", "white", "灰", "gray", "黑白灰", "monochrome"],
  "structure": [],
  "features": [],
  "patterns": ["流紋", "veined", "雲紋", "marble grain"],
  "craftsmanship": ["拋光", "polished", "亮面", "glossy finish"],
  "form": [],
  "mood": ["精品感", "premium"],
  "use_case": ["室內地坪", "interior flooring", "牆面", "wall cladding"],
  "intent_summary": "黑白流紋大理石拋光面 / Polished black-white veined marble",
  "product_description_zh": "（繁中：描述材質紋理、光澤與配色，2～4 句，勿提球體或成品）",
  "product_description_en": "(English: material surface only, 2–4 sentences, no shape or mockup)",
  "locale": "zh-TW+en"
}`;

/** 與材質無關的場景／應用雜訊（勿進 tags／標題） */
const MATERIAL_NON_FOCUS_BLOCKLIST = [
    'interior design', 'indoor design', '室內設計', '室內裝潢', '建築設計', 'architecture design',
    '軟裝', '軟裝設計', '陳設', 'visualization', 'visualisation', 'archviz',
    'product design', '產品設計', 'render scene', '場景渲染'
];

const MATERIAL_SHAPE_CARRIER_BLOCKLIST = [
    'sphere', 'ball', 'orb', 'hemisphere', 'cube', 'cuboid', 'cylinder', 'cone', 'pyramid',
    'geometry', 'geometric shape', '3d model', '3d render', 'digital render', 'cgi render',
    'rendering', 'mockup', 'product mockup', 'studio shot', 'display sphere', 'sample ball',
    'uv sphere', 'mesh ball', 'preview ball', 'swatch ball',
    '球體', '球面', '球形', '圓球', '球狀', '展示球', '樣品球', '渲染球', '模型球',
    '立方體', '立方', '方塊', '圓柱', '圓柱體', '圓錐', '錐體', '幾何', '幾何形', '立體模型',
    '數位渲染', '渲染圖', '三维', '3d', '立體球'
];

const SEMANTICS_PROMPT_KEYS = [
    'prototype_tagging_prompt',
    'material_tagging_prompt',
    'material_flux_edit_prompt',
    'prompt_semantics_prompt',
    'generated_image_semantics_prompt',
    'promo_scene_semantics_prompt'
];

const DEFAULT_PROMPTS = {
    prototype_tagging_prompt: `你是 MatchDO 合做平台的產品視覺與訂製品類專家。請分析使用者上傳的「產品數位原型／版型」圖片，產出可供站內搜尋、靈感牆篩選與日後流行趨勢分析的結構化語意。

規則：
1. 只輸出一段 JSON，不要 markdown、不要前言。
2. 避免空泛詞（如「好看」「產品」「product」）；避免重複。
3. 若圖中看不清某項，該陣列可省略，但 tags 不可為空陣列。

${BILINGUAL_TAGS_RULE}

JSON 格式（欄位名稱必須一致）：
${SEMANTICS_TAXONOMY_JSON_EXAMPLE}`,

    material_tagging_prompt: `你是 MatchDO 合做平台的「表面材質／飾材」分析專家。使用者上傳的是「材料參考」圖（色板、石材、布料、皮革、木紋、金屬板等），供訂製時指定材質。

【必守：忠實記錄可見特徵，禁止發揮】
- 你是**記錄員**，不是設計師：只如實描述相片像素中可見的表面，禁止腦補、美化、升級或替換成另一種「常見」材質。
- 禁止把影像寫成與像素不符的材質（例：可見大顆荔枝紋皮革，勿寫成細粒噪點、砂岩、毛毡、generic texture）。
- patterns 須寫**可見紋理族與顆粒／織紋尺度**（例：荔枝紋、pebbled grain；細斜紋、fine crosshatch），勿用空泛詞（texture、pattern、材質感）代替。
- colors 須對應**實際色相與冷暖**（例：暖米色 tan beige、冷灰褐 cool gray-brown），勿偏離成泛用棕或灰。
- 此 JSON 僅供站內搜尋、標籤與設計頁材料附錄；不送 FLUX 生圖。材料 AI 優化另用 material_flux_edit_prompt 產出英文編輯句。

【必守：只分析材質本身，不分析外型】
- 圖中球體、立方、色卡支架、陰影、渲染載體等僅為展示，**不是**材質屬性；禁止寫入任何欄位。
- 禁止：球體、sphere、3D、digital render、室內設計、interior design、成品品類（手提包、家具等）。
- category_guess 填**材質名稱**（例：大理石 / Marble、丹寧布 / Denim），勿填應用場景或成品。

【必守：材質四要素 — tags 與欄位都要寫】
1. 材質種類 materials
2. 紋理 patterns（表面可見的紋理／重複圖樣）
3. 配色 colors
4. 光澤／表面工藝 craftsmanship
- tags 以以上四類為主；每類至少 1 組中英詞。

【必守：以影像為準、全 JSON 自洽】
- 只描述**相片像素**中可見的表面；標題、檔名、分類僅供輔助，若與影像不符**以影像為準**。
- 整份 JSON 內禁止語意衝突：materials、patterns、colors、craftsmanship、intent_summary、tags 必須描述**同一張**材料表面，不可並列互斥形容。
- patterns 宜精簡（通常 1 組中英詞描述同一紋理即可）；禁止堆砌同義詞或矛盾的紋理形容。
- intent_summary 是一句與各欄位一致的概觀，不可與 patterns 等欄位矛盾。

規則：
1. 只輸出一段 JSON，不要 markdown、不要前言。
2. 避免空泛詞（好看、產品、圖片、裝飾、設計風格等）；避免重複。
3. tags 不可為空陣列。

${MATERIAL_BILINGUAL_TAGS_RULE}

JSON 格式（欄位名稱必須一致）：
${MATERIAL_SEMANTICS_JSON_EXAMPLE}`,

    material_flux_edit_prompt: `你是 MatchDO 材料參考圖的「FLUX.2 單圖編輯提示詞」撰寫員（BFL image editing API）。

【任務】看 input 影像，輸出僅一段英文（2～4 句），作為 FLUX input_image 編輯的 prompt。

【你不是在畫圖】
- 不輸出 JSON、不輸出標籤表、不描述「請生成某材質」。
- 只寫**編輯指示**：明確「允許改什麼」與「必須保留什麼」（BFL：be specific about changes and explicit about what stays unchanged）。

【必守】
- 以影像像素為準；標題／檔名僅輔助，衝突時以影像為準。
- **保留**：材質種類、可見紋理族與顆粒／織紋尺度、色相飽和度、光澤、滿版構圖。
- **僅允許改動**：清晰度、對焦、均勻柔光、輕微降噪。
- **禁止**：發明／替換／理想化另一種材質、換色、換紋理、改變顆粒尺度、新增產品／道具／文字／浮水印。

【輸出格式】
- 僅英文 plain text，無 markdown、無 JSON、無標題行。
- 句型參考（依實圖撰寫，勿抄範例材質）：Keep the [visible material and pattern at same scale and colors]. Only improve sharpness, even diffuse lighting, and reduce noise. Do not change material type, hue, pattern family, or composition.`,

    prompt_semantics_prompt: `你是訂製產品設計分析師。請解析以下使用者提示詞與產品描述，輸出僅一段 JSON，不要 markdown。

${BILINGUAL_TAGS_RULE}

${SEMANTICS_TAXONOMY_JSON_EXAMPLE}`,

    generated_image_semantics_prompt: `你是 MatchDO 合做平台的產品視覺專家。請分析「訂製設計頁」由 AI 生成的產品示意圖（非廠商上傳的數位原型），產出可供靈感牆搜尋與流行趨勢分析的結構化語意。

規則：
1. 只輸出一段 JSON，不要 markdown。以圖片實際視覺為準，不要只複述使用者提示詞。
2. tags 不可為空陣列。
3. intent_summary 必填：繁中前半寫入 title、英文句寫入 title_en；須依圖寫出具體品類與可見特色，不可使用通用占位詞。

${BILINGUAL_TAGS_RULE}

JSON 格式（欄位名稱必須一致）：
${SEMANTICS_TAXONOMY_JSON_EXAMPLE}`,

    promo_scene_semantics_prompt: `你是 MatchDO 合做平台的產品情境圖（推廣／展示成圖）視覺分析專家。請分析 AI 生成的「產品置入場景」成圖，產出可供靈感牆搜尋與展示的結構化語意。

任務重點：
- 以圖片實際視覺為準（非白底單品圖，而是產品在場景中的宣傳成圖）。
- 標籤與描述須**同時**反映：場景／環境／光線／氛圍，以及畫面中產品的可見特色、配色與**表面質感**。
- 所有輸出內容必須從圖中推斷；勿套用 prompt 未出現的品類或材質，勿寫死特定產業範例。

規則：
1. 只輸出一段 JSON，不要 markdown、不要前言。
2. tags 不可為空陣列。
3. product_description_zh / product_description_en 必填：各 2～4 句，**綜合**場景描述與產品特色／質感（見下方雙語規則）。
4. 若附帶「來源品項／主題模板／場景模板／使用者補充／生成提示詞」等文字，僅作對照，不可替代以圖為準的判斷。

${PROMO_SCENE_BILINGUAL_TAGS_RULE}

JSON 格式（欄位名稱必須一致；範例括號內為占位說明，輸出時須換成依圖填寫的真實內容）：
${PROMO_SCENE_SEMANTICS_JSON_EXAMPLE}`
};

function normTagArray(val, max = 12) {
    if (!Array.isArray(val)) return [];
    return val.map((t) => String(t).trim()).filter(Boolean).slice(0, max);
}

function coalesceTagsFromSemanticsObject(obj) {
    if (!obj || typeof obj !== 'object') return [];
    const fromTags = Array.isArray(obj.tags)
        ? obj.tags.map((t) => String(t).trim()).filter(Boolean)
        : [];
    if (fromTags.length) return fromTags.slice(0, 30);
    return mergeTags(
        obj.materials,
        obj.patterns,
        obj.colors,
        obj.craftsmanship,
        obj.style_keywords,
        obj.mood,
        obj.use_case
    ).slice(0, 30);
}

function resolveMaterialTaggingPromptText(dbPrompt) {
    const v = (dbPrompt || '').trim();
    const def = DEFAULT_PROMPTS.material_tagging_prompt || '';
    if (!v) return def;
    if (v.length < 280 || !/"tags"\s*:/.test(v)) {
        return def;
    }
    return v;
}

function resolvePrototypeTaggingPromptText(dbPrompt) {
    const v = (dbPrompt || '').trim();
    const def = DEFAULT_PROMPTS.prototype_tagging_prompt || '';
    if (!v) return def;
    if (v.length < 400 || !/product_description_zh/.test(v)) {
        return def;
    }
    return v;
}

function resolvePromoSceneTaggingPromptText(dbPrompt) {
    const v = (dbPrompt || '').trim();
    const def = DEFAULT_PROMPTS.promo_scene_semantics_prompt || '';
    if (!v) return def;
    if (v.length < 320 || !/product_description_zh/.test(v) || !/以圖/.test(v)) {
        return def;
    }
    return v;
}

function parseSemanticsJson(responseText) {
    const raw = (responseText != null ? String(responseText) : '').trim();
    if (!raw) return null;
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    try {
        const obj = JSON.parse(jsonMatch[0]);
        const tags = coalesceTagsFromSemanticsObject(obj);
        const hasDesc = (obj.product_description_zh != null && String(obj.product_description_zh).trim())
            || (obj.product_description_en != null && String(obj.product_description_en).trim());
        if (!tags.length && !hasDesc) return null;
        const semantics = {
            tags,
            taxonomy_version: 'v1',
            category_guess: obj.category_guess != null ? String(obj.category_guess).trim() : null,
            style_keywords: normTagArray(obj.style_keywords),
            materials: normTagArray(obj.materials),
            colors: normTagArray(obj.colors),
            structure: normTagArray(obj.structure),
            features: normTagArray(obj.features),
            patterns: normTagArray(obj.patterns),
            craftsmanship: normTagArray(obj.craftsmanship),
            form: normTagArray(obj.form),
            mood: normTagArray(obj.mood),
            use_case: normTagArray(obj.use_case),
            intent_summary: obj.intent_summary != null ? String(obj.intent_summary).trim() : null,
            product_description_zh: obj.product_description_zh != null ? String(obj.product_description_zh).trim() : null,
            product_description_en: obj.product_description_en != null ? String(obj.product_description_en).trim() : null,
            locale: obj.locale || 'zh-TW+en'
        };
        semantics.ai_tags_by_dimension = buildTagsByDimension(semantics);
        return { tags, semantics };
    } catch (_) {
        return null;
    }
}

async function getConfigPrompt(supabase, key) {
    try {
        const { data: row } = await supabase.from('payment_config').select('value').eq('key', key).maybeSingle();
        const v = row?.value?.trim?.();
        if (v) return v;
    } catch (_) {}
    return DEFAULT_PROMPTS[key] || '';
}

async function getTaggingModelName(supabase, envFallback) {
    try {
        const { data: row } = await supabase.from('payment_config').select('value').eq('key', 'gemini_model_tagging').maybeSingle();
        const fromDb = row?.value?.trim?.();
        if (fromDb) return fromDb;
    } catch (_) {}
    return envFallback || process.env.GEMINI_MODEL_TAGGING || GEMINI_MODEL_TAGGING_DEFAULT;
}

function modelFallbackChain(model) {
    const primary = (model || GEMINI_MODEL_TAGGING_DEFAULT).trim();
    return [primary];
}

async function callGemini({ genAI, runInGeminiQueue, model, parts }) {
    const modelsToTry = modelFallbackChain(model);
    let lastErr = null;
    for (const m of modelsToTry) {
        try {
            const result = await runInGeminiQueue(() => genAI.models.generateContent({
                model: m,
                contents: [{ role: 'user', parts }]
            }));
            const text = (result && result.text != null ? String(result.text) : '') || '';
            if (text.trim()) return { text, model: m };
        } catch (e) {
            lastErr = e;
            console.warn('visual-semantics model', m, e.message);
        }
    }
    throw lastErr || new Error('Gemini 語意解析失敗');
}

function tagLooksLikeMaterialShapeOrCarrier(tag) {
    const raw = String(tag).trim();
    if (!raw) return true;
    const lower = raw.toLowerCase();
    for (const blocked of MATERIAL_SHAPE_CARRIER_BLOCKLIST) {
        const b = blocked.toLowerCase();
        if (lower === b || lower.includes(b)) return true;
    }
    if (/球體|球形|圓球|sphere|\bball\b/i.test(raw) && !/地球|氣球|眼球/.test(raw)) return true;
    return false;
}

function tagMatchesBlockedPhrase(lower, blocked) {
    const b = blocked.toLowerCase();
    if (lower === b) return true;
    if (b.length <= 4) {
        return new RegExp(`(?:^|[\\s,;/\\-])${b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[\\s,;/\\-])`).test(` ${lower} `);
    }
    return lower.includes(b);
}

function tagLooksLikeNonMaterialFocus(tag) {
    if (tagLooksLikeMaterialShapeOrCarrier(tag)) return true;
    const lower = String(tag).trim().toLowerCase();
    for (const blocked of MATERIAL_NON_FOCUS_BLOCKLIST) {
        if (tagMatchesBlockedPhrase(lower, blocked)) return true;
    }
    return false;
}

function filterMaterialTagList(arr, max = 30) {
    return normTagArray(arr, max).filter((t) => !tagLooksLikeNonMaterialFocus(t));
}

/** 以材質四要素重組 tags（材質種類、紋理、配色、光澤／工藝） */
function rebuildMaterialTagsFromDimensions(semantics) {
    if (!semantics) return [];
    const core = filterMaterialTagList(mergeTags(
        semantics.materials,
        semantics.patterns,
        semantics.colors,
        semantics.craftsmanship
    ), 28);
    const supplemental = filterMaterialTagList(mergeTags(
        semantics.style_keywords,
        semantics.mood,
        semantics.use_case
    ), 8);
    const maxSupplemental = Math.max(0, 28 - core.length);
    let tags = core.slice(0, 28);
    let added = 0;
    for (const t of supplemental) {
        if (added >= maxSupplemental || tags.length >= 28) break;
        if (tags.indexOf(t) === -1) {
            tags.push(t);
            added++;
        }
    }
    if (tags.length < 8) {
        tags = filterMaterialTagList(mergeTags(tags, semantics.tags), 28);
    }
    return tags.slice(0, 28);
}

/**
 * 材料 FLUX：把 Gemini JSON 原樣轉成英文約束句（不推斷材質類型、不做規則分類）。
 */
function buildMaterialFluxFidelityLine(semanticsJson, opts) {
    if (!semanticsJson || typeof semanticsJson !== 'object') return '';
    const o = opts && typeof opts === 'object' ? opts : {};
    const s = sanitizeMaterialSemantics(semanticsJson);
    const parts = [];
    const appendField = (label, arr) => {
        const list = filterMaterialTagList(normTagArray(arr, 8), 8);
        if (list.length) parts.push(`${label}: ${list.join(', ')}`);
    };
    if (s.category_guess) parts.push(`category: ${String(s.category_guess).trim()}`);
    appendField('materials', s.materials);
    appendField('colors', s.colors);
    appendField('patterns', s.patterns);
    if (!o.omitSurfaceTechniques) appendField('finish', s.craftsmanship);
    if (s.intent_summary) {
        parts.push(`summary: ${String(s.intent_summary).trim()}`);
    }
    if (!parts.length && Array.isArray(s.tags) && s.tags.length) {
        const tags = filterMaterialTagList(s.tags, 10);
        if (tags.length) parts.push(`tags: ${tags.join(', ')}`);
    }
    if (!parts.length) return '';
    return parts.join('; ') + '.';
}

/** 材料讀圖後過濾外型／展示載體標籤，並清空 structure／features／form */
function sanitizeMaterialSemantics(semantics) {
    if (!semantics || typeof semantics !== 'object') return semantics;
    const out = { ...semantics };
    out.structure = [];
    out.features = [];
    out.form = [];
    const dimFields = [
        'materials', 'colors', 'patterns', 'craftsmanship', 'style_keywords', 'mood', 'use_case'
    ];
    dimFields.forEach((f) => {
        if (Array.isArray(out[f])) out[f] = filterMaterialTagList(out[f], 16);
    });
    out.tags = rebuildMaterialTagsFromDimensions(out);
    if (!out.tags.length) {
        const fallback = filterMaterialTagList(mergeTags(
            out.materials, out.patterns, out.colors, out.craftsmanship
        ), 28);
        if (fallback.length) out.tags = fallback;
    }
    if (out.category_guess && tagLooksLikeNonMaterialFocus(out.category_guess)) {
        out.category_guess = null;
    }
    out.ai_tags_by_dimension = buildTagsByDimension(out);
    return out;
}

async function analyzeImageSemantics(deps, imagePart, context = {}) {
    const label = (context.image_label || context.filename_hint || '').trim();
    return analyzeImageSemanticsMulti(deps, [{ part: imagePart, label }], context);
}

async function analyzeImageSemanticsMulti(deps, imageEntries, context = {}) {
    const { supabase, genAI, runInGeminiQueue, getTaggingModelName: getModel } = deps;
    if (!process.env.GEMINI_API_KEY) throw new Error('未設定 GEMINI_API_KEY');
    const entries = (imageEntries || []).filter((e) => e && e.part);
    if (!entries.length) throw new Error('無圖片可分析');
    const isMaterial = context.asset_kind === 'material';
    const model = await (getModel ? getModel() : getTaggingModelName(supabase));
    const promptKey = isMaterial ? 'material_tagging_prompt' : 'prototype_tagging_prompt';
    const dbPrompt = await getConfigPrompt(supabase, promptKey);
    const basePrompt = isMaterial ? resolveMaterialTaggingPromptText(dbPrompt) : resolvePrototypeTaggingPromptText(dbPrompt);
    const ctxLines = [];
    if (isMaterial) ctxLines.push('素材類型：材料參考（僅分析表面材質，忽略球體／色卡載體外型；產出 JSON 標籤，非 FLUX 編輯句）');
    if (context.category_key) ctxLines.push(`主分類：${context.category_key}`);
    if (context.subcategory_name) ctxLines.push(`子分類：${context.subcategory_name}`);
    else if (context.subcategory_key) ctxLines.push(`子分類：${context.subcategory_key}`);
    if (context.material_catalog_hint) ctxLines.push(`廠商材料分類：${context.material_catalog_hint}`);
    if (context.title) ctxLines.push(`標題：${context.title}`);
    if (context.design_highlight) ctxLines.push(`產品特色：${context.design_highlight}`);
    if (context.description) ctxLines.push(`說明：${context.description}`);
    if (entries.length > 1) {
        ctxLines.push(`使用者提供了 ${entries.length} 張圖片（同一產品的多角度／細節）。請綜合**所有圖片**的可見特徵，產出**一份**合併的 JSON 標籤與語意；各角度不重複的特徵都要納入 tags。`);
    } else {
        const imageLabel = (entries[0].label || '').trim();
        if (imageLabel) ctxLines.push(`檔名／圖片標籤（僅輔助，以影像為準）：${imageLabel}`);
    }
    const promptText = ctxLines.length
        ? `${basePrompt}\n\n補充：\n${ctxLines.join('\n')}`
        : basePrompt;
    const parts = [{ text: promptText }];
    entries.forEach((entry, i) => {
        const lbl = (entry.label || '').trim();
        if (entries.length > 1) {
            const cap = lbl || (i === 0 ? '封面' : `圖 ${i + 1}`);
            parts.push({ text: `--- 圖片 ${i + 1}：${cap} ---` });
        }
        parts.push(entry.part);
    });
    let parsed = null;
    let usedModel = model;
    let lastText = '';
    for (let attempt = 0; attempt < 2; attempt++) {
        const gem = await callGemini({ genAI, runInGeminiQueue, model, parts });
        lastText = gem.text;
        usedModel = gem.model;
        parsed = parseSemanticsJson(lastText);
        if (parsed) break;
    }
    if (!parsed) {
        console.warn('parseSemanticsJson failed', {
            asset_kind: context.asset_kind || null,
            image_count: entries.length,
            preview: lastText.slice(0, 400)
        });
        throw new Error('無法解析 AI 標籤，請重試');
    }
    let semantics = parsed.semantics;
    let tags = parsed.tags;
    if (isMaterial) {
        semantics = sanitizeMaterialSemantics(semantics);
        tags = semantics.tags;
        if (!tags.length) {
            const hasDesc = (semantics.product_description_zh || '').trim() || (semantics.product_description_en || '').trim();
            const hasDims = ['materials', 'patterns', 'colors', 'craftsmanship'].some(
                (f) => Array.isArray(semantics[f]) && semantics[f].length
            );
            if (!hasDesc && !hasDims) {
                throw new Error('材質標籤產生結果為空，請換一張較清晰的材料特寫圖後重試');
            }
            if (hasDims) {
                tags = mergeTags(semantics.materials, semantics.patterns, semantics.colors, semantics.craftsmanship).slice(0, 28);
            }
        }
    }
    const promptVersion = isMaterial ? MATERIAL_PROMPT_VERSION : PROMPT_VERSION;
    return {
        tags,
        semantics,
        model: usedModel,
        prompt_version: entries.length > 1 ? `${promptVersion}-multi` : promptVersion
    };
}

function stripPlainGeminiText(text) {
    let t = (text != null ? String(text) : '').trim();
    if (!t) return '';
    if (t.startsWith('```')) {
        t = t.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
    }
    return t.replace(/^["']|["']$/g, '').trim();
}

/** 材料 FLUX optimize：Gemini 產出英文單圖編輯提示詞（非 JSON、非生圖） */
async function analyzeMaterialFluxEditPrompt(deps, imagePart, context = {}) {
    const { supabase, genAI, runInGeminiQueue, getTaggingModelName: getModel } = deps;
    if (!process.env.GEMINI_API_KEY) throw new Error('未設定 GEMINI_API_KEY');
    const model = await (getModel ? getModel() : getTaggingModelName(supabase));
    const dbPrompt = await getConfigPrompt(supabase, 'material_flux_edit_prompt');
    const basePrompt = (dbPrompt && dbPrompt.trim().length >= 120)
        ? dbPrompt.trim()
        : (DEFAULT_PROMPTS.material_flux_edit_prompt || '');
    const ctxLines = ['素材類型：材料參考（產出 FLUX input_image 編輯用英文句，不是 JSON）'];
    if (context.material_catalog_hint) ctxLines.push(`廠商材料分類（僅輔助）：${context.material_catalog_hint}`);
    if (context.title) ctxLines.push(`標題（僅輔助）：${context.title}`);
    const imageLabel = (context.image_label || context.filename_hint || '').trim();
    if (imageLabel) ctxLines.push(`檔名／圖片標籤（僅輔助，以影像為準）：${imageLabel}`);
    const promptText = `${basePrompt}\n\n補充：\n${ctxLines.join('\n')}`;
    let usedModel = model;
    let lastText = '';
    for (let attempt = 0; attempt < 2; attempt++) {
        const gem = await callGemini({
            genAI,
            runInGeminiQueue,
            model,
            parts: [{ text: promptText }, imagePart]
        });
        lastText = gem.text;
        usedModel = gem.model;
        const plain = stripPlainGeminiText(lastText);
        if (plain.length >= 40) {
            return {
                prompt: plain,
                model: usedModel,
                prompt_version: MATERIAL_FLUX_EDIT_PROMPT_VERSION
            };
        }
    }
    console.warn('analyzeMaterialFluxEditPrompt empty', { preview: lastText.slice(0, 400) });
    throw new Error('無法產生材料編輯提示詞，請重試');
}

async function analyzePromptSemantics(deps, textInput, context = {}) {
    const { supabase, genAI, runInGeminiQueue, getTaggingModelName: getModel } = deps;
    if (!process.env.GEMINI_API_KEY) throw new Error('未設定 GEMINI_API_KEY');
    const t = (textInput || '').trim();
    if (!t) throw new Error('缺少提示詞文字');
    const model = await (getModel ? getModel() : getTaggingModelName(supabase));
    const basePrompt = await getConfigPrompt(supabase, 'prompt_semantics_prompt');
    const promptText = `${basePrompt}\n\n---\n${t}`;
    const { text, model: usedModel } = await callGemini({
        genAI,
        runInGeminiQueue,
        model,
        parts: [{ text: promptText }]
    });
    const parsed = parseSemanticsJson(text);
    if (!parsed) throw new Error('無法解析提示詞語意');
    return { ...parsed, model: usedModel, prompt_version: PROMPT_VERSION };
}

async function analyzeGeneratedImageSemantics(deps, imagePart, context = {}) {
    const { supabase, genAI, runInGeminiQueue, getTaggingModelName: getModel } = deps;
    if (!process.env.GEMINI_API_KEY) throw new Error('未設定 GEMINI_API_KEY');
    const model = await (getModel ? getModel() : getTaggingModelName(supabase));
    const basePrompt = await getConfigPrompt(supabase, 'generated_image_semantics_prompt');
    let promptText = basePrompt;
    if (context.generation_prompt) {
        promptText += `\n\n（使用者原始提示詞僅供對照，請以圖片視覺為準）\n${context.generation_prompt}`;
    }
    const { text, model: usedModel } = await callGemini({
        genAI,
        runInGeminiQueue,
        model,
        parts: [{ text: promptText }, imagePart]
    });
    const parsed = parseSemanticsJson(text);
    if (!parsed) throw new Error('無法解析生成圖語意');
    return { ...parsed, model: usedModel, prompt_version: PROMPT_VERSION };
}

async function analyzePromoSceneImageSemantics(deps, imagePart, context = {}) {
    const { supabase, genAI, runInGeminiQueue, getTaggingModelName: getModel } = deps;
    if (!process.env.GEMINI_API_KEY) throw new Error('未設定 GEMINI_API_KEY');
    const model = await (getModel ? getModel() : getTaggingModelName(supabase));
    const basePrompt = resolvePromoSceneTaggingPromptText(await getConfigPrompt(supabase, 'promo_scene_semantics_prompt'));
    let promptText = basePrompt;
    const ctxText = (context.context_text || '').trim();
    if (ctxText) promptText += `\n\n---\n附帶資訊（僅供對照，請以圖片視覺為準）：\n${ctxText}`;
    const userPrompt = (context.user_prompt || '').trim();
    if (userPrompt) promptText += `\n\n使用者補充（僅供對照）：\n${userPrompt}`;
    const finalPrompt = (context.final_prompt || '').trim();
    if (finalPrompt) promptText += `\n\n生成提示詞摘要（僅供對照，不可取代以圖為準）：\n${finalPrompt.slice(0, 1200)}`;
    const { text, model: usedModel } = await callGemini({
        genAI,
        runInGeminiQueue,
        model,
        parts: [{ text: promptText }, imagePart]
    });
    const parsed = parseSemanticsJson(text);
    if (!parsed) throw new Error('無法解析情境圖語意');
    return { ...parsed, model: usedModel, prompt_version: PROMPT_VERSION };
}

function bufferToImagePart(buffer, mimeType) {
    return {
        inlineData: {
            data: Buffer.from(buffer).toString('base64'),
            mimeType: mimeType || 'image/jpeg'
        }
    };
}

async function fetchUrlToImagePart(fetchFn, imageUrl) {
    const res = await fetchFn(imageUrl, { redirect: 'follow' });
    if (!res.ok) throw new Error('無法讀取圖片 URL');
    const buf = Buffer.from(await res.arrayBuffer());
    const mimeType = (res.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
    return bufferToImagePart(buf, mimeType);
}

/** 供 custom_products.ai_tags_by_dimension 與報表聚合 */
function buildTagsByDimension(semantics) {
    if (!semantics || typeof semantics !== 'object') return {};
    const out = {};
    for (const [dimKey, fieldName] of Object.entries(SEMANTICS_DIMENSION_FIELDS)) {
        out[dimKey] = normTagArray(semantics[fieldName], 16);
    }
    if (semantics.category_guess) {
        out.category = [String(semantics.category_guess).trim()].filter(Boolean);
    } else {
        out.category = [];
    }
    return out;
}

/** 廠商素材「簡短說明」：一段中文 + 空行 + 一段英文 */
function buildVendorAssetDescriptionFromSemantics(semantics) {
    if (!semantics || typeof semantics !== 'object') return null;
    const zh = (semantics.product_description_zh || '').trim();
    const en = (semantics.product_description_en || '').trim();
    if (zh && en) return zh + '\n\n' + en;
    if (zh) return zh;
    if (en) return en;
    const summary = (semantics.intent_summary || '').trim();
    if (summary) {
        const sep = summary.indexOf(' / ');
        if (sep >= 0) {
            return summary.slice(0, sep).trim() + '\n\n' + summary.slice(sep + 3).trim();
        }
        return summary;
    }
    const zhParts = [];
    const mats = normTagArray(semantics.materials, 6);
    const pats = normTagArray(semantics.patterns, 6);
    const cols = normTagArray(semantics.colors, 6);
    const craft = normTagArray(semantics.craftsmanship, 4);
    if (mats.length) zhParts.push('材質：' + mats.join('、'));
    if (pats.length) zhParts.push('紋理／圖案：' + pats.join('、'));
    if (cols.length) zhParts.push('配色：' + cols.join('、'));
    if (craft.length) zhParts.push('工藝／質感：' + craft.join('、'));
    if (zhParts.length) return zhParts.join('；') + '。';
    return null;
}

function mergeTags(...arrays) {
    const seen = new Set();
    const out = [];
    for (const arr of arrays) {
        for (const t of arr || []) {
            const s = String(t).trim();
            if (!s || seen.has(s)) continue;
            seen.add(s);
            out.push(s);
        }
    }
    return out.slice(0, 36);
}

function isMostlyCjk(s) {
    return /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/.test(String(s));
}

function isMostlyLatin(s) {
    const t = String(s).trim();
    if (!t) return false;
    const letters = t.replace(/[^a-zA-Z]/g, '');
    return letters.length >= 2 && letters.length >= t.replace(/\s/g, '').length * 0.45;
}

function normalizeEnTitlePart(en) {
    const t = String(en).trim();
    if (!t) return '';
    if (!/\s/.test(t) && /^[a-zA-Z][a-zA-Z0-9\-']*$/.test(t)) return t.toLowerCase();
    return t;
}

/** 「手提包 / Handbag」或單語 */
function splitBilingualSlash(s) {
    const t = String(s).trim();
    if (!t) return { zh: null, en: null };
    const sep = t.indexOf(' / ');
    if (sep >= 0) {
        const a = t.slice(0, sep).trim();
        const b = t.slice(sep + 3).trim();
        return {
            zh: isMostlyCjk(a) ? a : (isMostlyCjk(b) ? b : null),
            en: isMostlyLatin(b) ? b : (isMostlyLatin(a) ? a : null)
        };
    }
    const sep2 = t.indexOf('/');
    if (sep2 > 0 && sep2 < t.length - 1) {
        const a = t.slice(0, sep2).trim();
        const b = t.slice(sep2 + 1).trim();
        if (isMostlyCjk(a) && isMostlyLatin(b)) return { zh: a, en: b };
        if (isMostlyLatin(a) && isMostlyCjk(b)) return { zh: b, en: a };
    }
    if (isMostlyCjk(t)) return { zh: t, en: null };
    if (isMostlyLatin(t)) return { zh: null, en: t };
    return { zh: null, en: null };
}

function pickZhEnPair(tagSources, hints) {
    const merged = [];
    const seen = new Set();
    for (const src of tagSources) {
        for (const t of src || []) {
            const s = String(t).trim();
            if (!s || seen.has(s)) continue;
            seen.add(s);
            merged.push(s);
        }
    }
    let zh = null;
    let en = null;
    for (const s of merged) {
        if (!zh && isMostlyCjk(s) && s.length <= 24) zh = s;
        if (!en && isMostlyLatin(s) && s.length <= 48) en = s;
        if (zh && en) break;
    }
    if (hints && hints.subcategoryName) {
        const sub = splitBilingualSlash(hints.subcategoryName);
        if (!zh && sub.zh) zh = sub.zh;
        if (!en && sub.en) en = sub.en;
        if (!zh && isMostlyCjk(hints.subcategoryName)) zh = String(hints.subcategoryName).trim();
    }
    if (hints && hints.materialCatalogHint) {
        const hint = String(hints.materialCatalogHint).split(/[,，、]/)[0].trim();
        if (hint && !zh && isMostlyCjk(hint)) zh = hint;
    }
    if (hints && hints.categoryGuess) {
        const cg = splitBilingualSlash(hints.categoryGuess);
        if (!zh && cg.zh) zh = cg.zh;
        if (!en && cg.en) en = cg.en;
    }
    return { zh, en: en ? normalizeEnTitlePart(en) : null };
}

function firstZhEnInTagList(list) {
    let zh = null;
    let en = null;
    for (const t of list || []) {
        const s = String(t).trim();
        if (!s) continue;
        if (!zh && isMostlyCjk(s)) zh = s;
        if (!en && isMostlyLatin(s)) en = normalizeEnTitlePart(s);
        if (zh && en) break;
    }
    return { zh, en };
}

function pushUniqueTitlePiece(pieces, piece) {
    const p = (piece || '').trim();
    if (!p) return;
    if (pieces.some((x) => x === p || x.includes(p) || p.includes(x))) return;
    pieces.push(p);
}

/** 由四要素組成材料特色標題（光澤／配色／紋理／材質種類） */
function buildMaterialCharacteristicTitle(semantics) {
    if (!semantics) return { zh: null, en: null };
    const craft = firstZhEnInTagList(semantics.craftsmanship);
    const col = firstZhEnInTagList(semantics.colors);
    const pat = firstZhEnInTagList(semantics.patterns);
    const mat = firstZhEnInTagList(semantics.materials);

    const zhPieces = [];
    pushUniqueTitlePiece(zhPieces, craft.zh);
    pushUniqueTitlePiece(zhPieces, col.zh);
    pushUniqueTitlePiece(zhPieces, pat.zh);
    pushUniqueTitlePiece(zhPieces, mat.zh);
    let zh = zhPieces.join('');
    if (zh.length > 40) zh = zh.slice(0, 40);

    const enPieces = [];
    pushUniqueTitlePiece(enPieces, craft.en);
    pushUniqueTitlePiece(enPieces, col.en);
    pushUniqueTitlePiece(enPieces, pat.en);
    pushUniqueTitlePiece(enPieces, mat.en);
    let en = enPieces.join(' ');
    if (en.length > 60) en = en.slice(0, 60).trim();

    const cg = splitBilingualSlash(semantics.category_guess || '');
    if (!zh) zh = cg.zh || mat.zh || null;
    if (!en) en = (cg.en ? normalizeEnTitlePart(cg.en) : null) || mat.en || null;
    return { zh, en };
}

/**
 * 材料標題：描述材料特色（非僅材質學名）
 * 優先 intent_summary，其次四要素組句，最後才用材質種類名
 */
function pickZhEnPairForMaterialTitle(semantics, hints) {
    if (semantics.intent_summary) {
        const head = String(semantics.intent_summary).split(/[；;]/)[0].trim();
        const sum = splitBilingualSlash(head);
        if (sum.zh && sum.en) {
            return {
                zh: sum.zh.length > 40 ? sum.zh.slice(0, 40) : sum.zh,
                en: normalizeEnTitlePart(sum.en.length > 60 ? sum.en.slice(0, 60) : sum.en)
            };
        }
        if (sum.zh && !sum.en) {
            const built = buildMaterialCharacteristicTitle(semantics);
            if (built.en) return { zh: sum.zh.slice(0, 40), en: built.en };
        }
        if (!sum.zh && sum.en) {
            const built = buildMaterialCharacteristicTitle(semantics);
            if (built.zh) return { zh: built.zh, en: normalizeEnTitlePart(sum.en) };
        }
    }
    const built = buildMaterialCharacteristicTitle(semantics);
    if (built.zh && built.en) return built;
    if (built.zh || built.en) {
        const cg = splitBilingualSlash(semantics.category_guess || '');
        return {
            zh: built.zh || cg.zh || null,
            en: built.en || (cg.en ? normalizeEnTitlePart(cg.en) : null)
        };
    }
    return pickZhEnPair([semantics.materials], {
        materialCatalogHint: hints && hints.materialCatalogHint,
        categoryGuess: semantics.category_guess
    });
}

/**
 * 由 AI 語意產生標題：材料「特色描述」；原型「款式」
 * 中文介面 zh-en；英文介面 en-zh
 */

function buildVendorAssetTitleFromSemantics(semantics, assetKind, opts) {
    if (!semantics || typeof semantics !== 'object') return null;
    const kind = assetKind === 'material' ? 'material' : 'prototype';
    let pair;
    if (kind === 'material') {
        pair = pickZhEnPairForMaterialTitle(semantics, opts);
    } else {
        const sources = [semantics.tags, semantics.structure, semantics.style_keywords, semantics.features, semantics.form];
        pair = pickZhEnPair(sources, {
            subcategoryName: opts && opts.subcategoryName,
            materialCatalogHint: opts && opts.materialCatalogHint,
            categoryGuess: semantics.category_guess
        });
    }
    if (kind !== 'material' && (!pair.zh || !pair.en) && semantics.intent_summary) {
        const head = String(semantics.intent_summary).split(/[；;]/)[0];
        const sum = splitBilingualSlash(head);
        if (!pair.zh && sum.zh) pair.zh = sum.zh;
        if (!pair.en && sum.en) pair.en = normalizeEnTitlePart(sum.en);
    }
    if (!pair.zh && !pair.en) return null;
    const locale = (opts && opts.locale) ? String(opts.locale) : 'zh-TW';
    const enUi = /^en/i.test(locale);
    if (pair.zh && pair.en) return enUi ? `${pair.en}-${pair.zh}` : `${pair.zh}-${pair.en}`;
    return pair.zh || pair.en;
}

const GENERIC_PRODUCT_TITLES = new Set(['產品設計圖', '未命名', '推廣圖', '情境圖', 'Untitled', 'Product design', 'Custom product', 'Promo image']);

function truncateTitlePart(text, maxLen = 56) {
    const s = String(text || '').replace(/\s+/g, ' ').trim();
    if (!s) return '';
    if (s.length <= maxLen) return s;
    return s.slice(0, maxLen) + '…';
}

/** 設計頁生成圖語意 → 產品標題雙語（custom_products.title / title_en） */
function buildCustomProductTitlePairFromSemantics(semantics) {
    if (!semantics || typeof semantics !== 'object') return null;
    if (semantics.intent_summary) {
        const head = String(semantics.intent_summary).split(/[；;]/)[0].trim();
        const sum = splitBilingualSlash(head);
        let zh = sum.zh ? truncateTitlePart(sum.zh) : '';
        let en = sum.en ? truncateTitlePart(normalizeEnTitlePart(sum.en)) : '';
        if (zh && GENERIC_PRODUCT_TITLES.has(zh)) zh = '';
        if (en && GENERIC_PRODUCT_TITLES.has(en)) en = '';
        if (zh || en) return { zh: zh || null, en: en || null };
    }
    const cg = splitBilingualSlash(semantics.category_guess || '');
    let zh = cg.zh ? truncateTitlePart(cg.zh) : '';
    let en = cg.en ? truncateTitlePart(normalizeEnTitlePart(cg.en)) : '';
    if (zh && GENERIC_PRODUCT_TITLES.has(zh)) zh = '';
    if (en && GENERIC_PRODUCT_TITLES.has(en)) en = '';
    if (zh || en) return { zh: zh || null, en: en || null };
    return null;
}

/** @deprecated 使用 buildCustomProductTitlePairFromSemantics */
function buildCustomProductTitleFromSemantics(semantics) {
    const pair = buildCustomProductTitlePairFromSemantics(semantics);
    return pair && pair.zh ? pair.zh : null;
}

module.exports = {
    GEMINI_MODEL_TAGGING_DEFAULT,
    PROMPT_VERSION,
    SEMANTICS_PROMPT_KEYS,
    SEMANTICS_DIMENSION_FIELDS,
    DEFAULT_PROMPTS,
    BILINGUAL_TAGS_RULE,
    buildTagsByDimension,
    parseSemanticsJson,
    getTaggingModelName,
    getConfigPrompt,
    analyzeImageSemantics,
    analyzeImageSemanticsMulti,
    analyzeMaterialFluxEditPrompt,
    analyzePromptSemantics,
    analyzeGeneratedImageSemantics,
    analyzePromoSceneImageSemantics,
    bufferToImagePart,
    fetchUrlToImagePart,
    mergeTags,
    buildVendorAssetDescriptionFromSemantics,
    buildVendorAssetTitleFromSemantics,
    buildCustomProductTitleFromSemantics,
    buildCustomProductTitlePairFromSemantics,
    sanitizeMaterialSemantics,
    buildMaterialFluxFidelityLine,
    rebuildMaterialTagsFromDimensions,
    tagLooksLikeMaterialShapeOrCarrier,
    tagLooksLikeNonMaterialFocus,
    MATERIAL_BILINGUAL_TAGS_RULE
};
