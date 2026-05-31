'use strict';

const GEMINI_MODEL_TAGGING_DEFAULT = 'gemini-3.1-flash-lite';
const PROMPT_VERSION = 'v3';

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

/** 與前台 lang 無關：每次產標籤須中英並存 */
const BILINGUAL_TAGS_RULE = `雙語標籤（必守，與使用者介面語系無關）：
- tags 陣列 14～28 個，須同時包含繁體中文與英文搜尋詞（約各半）。
- 每個重要概念盡量提供「中文 + 英文」各一個（例：皮革、leather）。
- 下列分維陣列皆須填寫（看不清可留空陣列 []，但 tags 不可為空）：
  · style_keywords（風格） · materials（材質） · colors（顏色／配色）
  · structure（結構／版型） · features（特色／賣點／功能件）
  · patterns（圖案／紋理） · craftsmanship（工藝／製程）
  · form（形態／輪廓） · mood（氛圍／調性） · use_case（場景／用途）
- intent_summary 用一行：繁中說明，後接「 / 」再寫一句英文。
- product_description_zh：一段繁體中文產品說明（2～4 句，給廠商素材「簡短說明」欄位用）。
- product_description_en：一段英文產品說明（與中文對應，2～4 句）。`;

const SEMANTICS_PROMPT_KEYS = [
    'prototype_tagging_prompt',
    'prompt_semantics_prompt',
    'generated_image_semantics_prompt'
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

    prompt_semantics_prompt: `你是訂製產品設計分析師。請解析以下使用者提示詞與產品描述，輸出僅一段 JSON，不要 markdown。

${BILINGUAL_TAGS_RULE}

${SEMANTICS_TAXONOMY_JSON_EXAMPLE}`,

    generated_image_semantics_prompt: `你是 MatchDO 合做平台的產品視覺專家。請分析「訂製設計頁」由 AI 生成的產品示意圖（非廠商上傳的數位原型），產出可供靈感牆搜尋與流行趨勢分析的結構化語意。

規則：
1. 只輸出一段 JSON，不要 markdown。以圖片實際視覺為準，不要只複述使用者提示詞。
2. tags 不可為空陣列。

${BILINGUAL_TAGS_RULE}

JSON 格式（欄位名稱必須一致）：
${SEMANTICS_TAXONOMY_JSON_EXAMPLE}`
};

function normTagArray(val, max = 12) {
    if (!Array.isArray(val)) return [];
    return val.map((t) => String(t).trim()).filter(Boolean).slice(0, max);
}

function parseSemanticsJson(responseText) {
    const raw = (responseText != null ? String(responseText) : '').trim();
    if (!raw) return null;
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    try {
        const obj = JSON.parse(jsonMatch[0]);
        const tags = Array.isArray(obj.tags)
            ? obj.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 30)
            : [];
        if (!tags.length) return null;
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

async function analyzeImageSemantics(deps, imagePart, context = {}) {
    const { supabase, genAI, runInGeminiQueue, getTaggingModelName: getModel } = deps;
    if (!process.env.GEMINI_API_KEY) throw new Error('未設定 GEMINI_API_KEY');
    const model = await (getModel ? getModel() : getTaggingModelName(supabase));
    const basePrompt = await getConfigPrompt(supabase, 'prototype_tagging_prompt');
    const ctxLines = [];
    if (context.category_key) ctxLines.push(`主分類：${context.category_key}`);
    if (context.title) ctxLines.push(`標題：${context.title}`);
    if (context.description) ctxLines.push(`說明：${context.description}`);
    const promptText = ctxLines.length
        ? `${basePrompt}\n\n補充：\n${ctxLines.join('\n')}`
        : basePrompt;
    const parts = [{ text: promptText }, imagePart];
    const { text, model: usedModel } = await callGemini({ genAI, runInGeminiQueue, model, parts });
    const parsed = parseSemanticsJson(text);
    if (!parsed) throw new Error('無法解析 AI 標籤，請重試');
    return { ...parsed, model: usedModel, prompt_version: PROMPT_VERSION };
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
    if (!summary) return null;
    const sep = summary.indexOf(' / ');
    if (sep >= 0) {
        return summary.slice(0, sep).trim() + '\n\n' + summary.slice(sep + 3).trim();
    }
    return summary;
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

/**
 * 由 AI 參考分類語意產生標題：中文介面「鬱金香木-tulipwood」；英文介面「tulipwood-鬱金香木」
 * @param {object} semantics image_semantics_json
 * @param {'material'|'prototype'} assetKind
 * @param {{ locale?: string, subcategoryName?: string, materialCatalogHint?: string }} opts
 */
function buildVendorAssetTitleFromSemantics(semantics, assetKind, opts) {
    if (!semantics || typeof semantics !== 'object') return null;
    const kind = assetKind === 'material' ? 'material' : 'prototype';
    const sources = [semantics.tags];
    if (kind === 'material') {
        sources.unshift(semantics.materials);
    } else {
        sources.unshift(semantics.structure, semantics.style_keywords, semantics.features, semantics.form);
    }
    const pair = pickZhEnPair(sources, {
        subcategoryName: opts && opts.subcategoryName,
        materialCatalogHint: opts && opts.materialCatalogHint,
        categoryGuess: semantics.category_guess
    });
    if ((!pair.zh || !pair.en) && semantics.intent_summary) {
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
    analyzePromptSemantics,
    analyzeGeneratedImageSemantics,
    bufferToImagePart,
    fetchUrlToImagePart,
    mergeTags,
    buildVendorAssetDescriptionFromSemantics,
    buildVendorAssetTitleFromSemantics
};
