'use strict';

const GEMINI_MODEL_TAGGING_DEFAULT = 'gemini-3.1-flash-lite';
const PROMPT_VERSION = 'v2';

/** 與前台 lang 無關：每次產標籤須中英並存 */
const BILINGUAL_TAGS_RULE = `雙語標籤（必守，與使用者介面語系無關）：
- tags 陣列 12～24 個，須同時包含繁體中文與英文搜尋詞（約各半）。
- 每個重要概念（品類、風格、材質、配色、結構、場景、工藝等）盡量提供「中文標籤 + 對應英文標籤」各一個（例：皮革、leather；極簡、minimalist）。
- style_keywords、materials、colors、structure、mood 等欄位亦盡量中英並列。
- intent_summary 用一行：繁中說明，後接「 / 」再寫一句英文。`;

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
{
  "tags": ["皮革", "leather", "手提包", "handbag", "極簡", "minimalist"],
  "category_guess": "手提包 / Handbag",
  "style_keywords": ["極簡", "minimalist"],
  "materials": ["皮革", "leather"],
  "colors": ["米白", "off-white"],
  "structure": ["翻蓋", "flap"],
  "mood": ["精品感", "premium"],
  "intent_summary": "適合都會精品皮革訂製 / Urban premium leather customization",
  "locale": "zh-TW+en"
}`,

    prompt_semantics_prompt: `你是訂製產品設計分析師。請解析以下使用者提示詞與產品描述，輸出僅一段 JSON，不要 markdown。

${BILINGUAL_TAGS_RULE}

{
  "tags": ["訂製", "custom", "極簡", "minimalist"],
  "category_guess": "家具 / Furniture",
  "style_keywords": ["極簡", "minimalist"],
  "materials": [],
  "structure": [],
  "mood": [],
  "intent_summary": "繁中一句 / One English sentence",
  "locale": "zh-TW+en"
}`,

    generated_image_semantics_prompt: `你是 MatchDO 合做平台的產品視覺專家。請分析「訂製設計頁」由 AI 生成的產品示意圖（非廠商上傳的數位原型），產出可供靈感牆搜尋與流行趨勢分析的結構化語意。

規則：
1. 只輸出一段 JSON，不要 markdown。以圖片實際視覺為準，不要只複述使用者提示詞。
2. tags 不可為空陣列。

${BILINGUAL_TAGS_RULE}

JSON 格式（欄位名稱必須一致）：
{
  "tags": ["運動鞋", "sneaker", "網布", "mesh", "撞色", "color block"],
  "category_guess": "運動鞋 / Sneaker",
  "style_keywords": ["街頭", "streetwear"],
  "materials": ["網布", "mesh"],
  "colors": ["黑", "black"],
  "structure": ["高筒", "high-top"],
  "mood": ["活力", "energetic"],
  "intent_summary": "街頭運動風訂製鞋 / Streetwear custom sneaker",
  "locale": "zh-TW+en"
}`
};

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
        return {
            tags,
            semantics: {
                tags,
                category_guess: obj.category_guess != null ? String(obj.category_guess).trim() : null,
                style_keywords: Array.isArray(obj.style_keywords) ? obj.style_keywords.map(String) : [],
                materials: Array.isArray(obj.materials) ? obj.materials.map(String) : [],
                colors: Array.isArray(obj.colors) ? obj.colors.map(String) : [],
                structure: Array.isArray(obj.structure) ? obj.structure.map(String) : [],
                mood: Array.isArray(obj.mood) ? obj.mood.map(String) : [],
                intent_summary: obj.intent_summary != null ? String(obj.intent_summary).trim() : null,
                locale: obj.locale || 'zh-TW'
            }
        };
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

module.exports = {
    GEMINI_MODEL_TAGGING_DEFAULT,
    PROMPT_VERSION,
    SEMANTICS_PROMPT_KEYS,
    DEFAULT_PROMPTS,
    BILINGUAL_TAGS_RULE,
    parseSemanticsJson,
    getTaggingModelName,
    getConfigPrompt,
    analyzeImageSemantics,
    analyzePromptSemantics,
    analyzeGeneratedImageSemantics,
    bufferToImagePart,
    fetchUrlToImagePart,
    mergeTags
};
