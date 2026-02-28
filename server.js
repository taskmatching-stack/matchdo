// build: 2026-03-01
const path = require('path');
const fs = require('fs');

for (let i = 0; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === '--stability-key' && process.argv[i + 1]) {
        process.env.STABILITY_API_KEY = process.argv[i + 1].trim();
        break;
    }
    if (arg.startsWith('--stability-key=')) {
        process.env.STABILITY_API_KEY = arg.slice(16).trim();
        break;
    }
}

const envPath = path.join(__dirname, '.env');
if (!process.env.STABILITY_API_KEY && !process.env.STABILITY_AI_API_KEY) {
    require('dotenv').config({ path: envPath });
    if (!process.env.STABILITY_API_KEY && !process.env.STABILITY_AI_API_KEY) require('dotenv').config();
}
if (!process.env.STABILITY_API_KEY && !process.env.STABILITY_AI_API_KEY && fs.existsSync(envPath)) {
    const stabilityKeys = ['STABILITY_API_KEY', 'STABILITY_AI_API_KEY', 'STABILITY_AI_KEY', 'STABILITY_KEY'];
    function tryParseEnv(buffer, encoding) {
        try {
            const raw = buffer.toString(encoding).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
            for (const ln of raw.split('\n')) {
                const line = ln.trim();
                if (!line || line.startsWith('#')) continue;
                const idx = line.indexOf('=');
                if (idx <= 0) continue;
                const key = line.slice(0, idx).trim().replace(/^\uFEFF/, '');
                let val = line.slice(idx + 1).trim();
                const comment = val.indexOf('#');
                if (comment >= 0) val = val.slice(0, comment).trim();
                if (stabilityKeys.includes(key) && val) {
                    process.env.STABILITY_API_KEY = val;
                    return true;
                }
            }
        } catch (_) {}
        return false;
    }
    const buf = fs.readFileSync(envPath);
    if (!tryParseEnv(buf, 'utf8')) tryParseEnv(buf, 'utf16le');
}
if (!process.env.STABILITY_API_KEY && !process.env.STABILITY_AI_API_KEY) {
    const tryPaths = [path.join(__dirname, 'stability-key.txt'), path.join(process.cwd(), 'stability-key.txt')];
    for (const keyPath of tryPaths) {
        if (!fs.existsSync(keyPath)) continue;
        try {
            const buf = fs.readFileSync(keyPath);
            for (const enc of ['utf8', 'utf16le']) {
                const key = (buf.toString(enc).split(/\r?\n/)[0] || '').trim();
                if (key && key.startsWith('sk-') && key.length > 30) {
                    process.env.STABILITY_API_KEY = key;
                    break;
                }
            }
            if (process.env.STABILITY_API_KEY) break;
        } catch (_) {}
    }
}
function getStabilityApiKey() {
    return process.env.STABILITY_API_KEY || process.env.STABILITY_AI_API_KEY || process.env.STABILITY_AI_KEY || process.env.STABILITY_KEY || null;
}
const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const { Pool } = require('pg');
const { GoogleGenAI } = require('@google/genai');
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
// 翻譯 prompt 用：可後台設定，見 getTranslationModelName
const GEMINI_MODEL_TRANSLATION_DEFAULT = 'gemini-2.5-flash-lite';
// 讀圖／分析／估算等：可後台設定，見 getReadModelName
const GEMINI_MODEL_READ_DEFAULT = 'gemini-3-flash-preview';
// Gemini API 排隊：多人同時用時依序送出
let _geminiQueueTail = Promise.resolve();
function runInGeminiQueue(fn) {
    const p = _geminiQueueTail.then(() => fn());
    _geminiQueueTail = p.catch(() => {});
    return p;
}
// 將 prompt 翻譯成英文（可關閉：.env 設 ENABLE_PROMPT_TRANSLATION=false 則不翻譯，直接送原文）
function looksLikeNonEnglish(str) {
    return /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(str);
}
// Gemini 僅用於讀圖產生描述（輔助），生圖僅用 FLUX
const { createClient } = require('@supabase/supabase-js');

const app = express();
// 上傳目錄保留供靜態服務（向後相容舊 URL）；Multer 改為 memory 後改傳 Supabase Storage
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
const upload = multer({ storage: multer.memoryStorage() });
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const supabase = createClient(process.env.SUPABASE_URL, SUPABASE_KEY);

async function getTranslationModelName() {
    try {
        const { data: row } = await supabase.from('payment_config').select('value').eq('key', 'gemini_model').maybeSingle();
        const fromDb = row?.value?.trim?.();
        if (fromDb) return fromDb;
    } catch (_) {}
    return process.env.GEMINI_MODEL || GEMINI_MODEL_TRANSLATION_DEFAULT;
}

async function getReadModelName() {
    try {
        const { data: row } = await supabase.from('payment_config').select('value').eq('key', 'gemini_model_read').maybeSingle();
        const fromDb = row?.value?.trim?.();
        if (fromDb) return fromDb;
    } catch (_) {}
    return process.env.GEMINI_MODEL_READ || GEMINI_MODEL_READ_DEFAULT;
}

// === 翻譯：送什麼 / 回什麼（就一件事）===
// 送：POST generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key=API_KEY
//     body: { contents: [ { parts: [ { text: "把這段翻成英文..." } ] } ] }
// 回：{ candidates: [ { content: { parts: [ { text: "英文結果" } ] } } ] } 或 { error: { code, message } }
// 我們只從回傳裡取出 candidates[0].content.parts[0].text 當翻譯結果。

async function translatePromptToEnglish(text) {
    if (!text || !String(text).trim()) return '';
    const t = String(text).trim();
    if (process.env.ENABLE_PROMPT_TRANSLATION === 'false' || process.env.ENABLE_PROMPT_TRANSLATION === '0') return t;
    if (!looksLikeNonEnglish(t)) return t;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return t;
    return runInGeminiQueue(async () => {
        const promptText = `Translate to English only, one line, no explanation:\n\n${t}`;
        let model = await getTranslationModelName();
        const modelsToTry = model === 'gemini-2.5-flash-lite' ? ['gemini-2.5-flash-lite', 'gemini-2.5-flash'] : [model];
        for (const m of modelsToTry) {
            try {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(apiKey)}`;
                const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] }) });
                const data = await res.json();
                if (data.error) {
                    if (data.error.code === 429 && m === 'gemini-2.5-flash-lite' && modelsToTry.length > 1) {
                        console.warn('Gemini 翻譯 429（gemini-2.5-flash-lite），改用 gemini-2.5-flash 重試');
                        continue;
                    }
                    console.error('Gemini 翻譯錯誤', data.error.code || res.status, data.error.message, 'model=', m);
                    return t;
                }
                const out = data.candidates?.[0]?.content?.parts?.[0]?.text;
                return (out != null ? String(out).trim() : '') || t;
            } catch (e) {
                console.error('translatePromptToEnglish:', e.message);
                return t;
            }
        }
        return t;
    });
}

/** 有 prompt + negativePrompt 時一次送、一次回，只打 1 次 API */
async function translatePromptAndNegativeToEnglish(prompt, negativePrompt) {
    const p = (prompt && String(prompt).trim()) || '';
    const n = (negativePrompt && String(negativePrompt).trim()) || '';
    if (process.env.ENABLE_PROMPT_TRANSLATION === 'false' || process.env.ENABLE_PROMPT_TRANSLATION === '0' || !process.env.GEMINI_API_KEY) return [p, n];
    const needP = p && looksLikeNonEnglish(p);
    const needN = n && looksLikeNonEnglish(n);
    if (!needP && !needN) return [p, n];
    if (!needP) return [p, await translatePromptToEnglish(n)];
    if (!needN) return [await translatePromptToEnglish(p), n];
    return runInGeminiQueue(async () => {
        const promptText = `Translate to English. Output exactly two lines: line1=first, line2=second. No other text.\n\nLine1:\n${p}\n\nLine2:\n${n}`;
        let model = await getTranslationModelName();
        const modelsToTry = model === 'gemini-2.5-flash-lite' ? ['gemini-2.5-flash-lite', 'gemini-2.5-flash'] : [model];
        for (const m of modelsToTry) {
            try {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`;
                const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] }) });
                const data = await res.json();
                if (data.error) {
                    if (data.error.code === 429 && m === 'gemini-2.5-flash-lite' && modelsToTry.length > 1) {
                        console.warn('Gemini 翻譯 429（gemini-2.5-flash-lite），改用 gemini-2.5-flash 重試');
                        continue;
                    }
                    console.error('Gemini 翻譯錯誤', data.error.code, data.error.message, 'model=', m);
                    return [p, n];
                }
                const out = data.candidates?.[0]?.content?.parts?.[0]?.text;
                const lines = (out != null ? String(out) : '').split(/\n/).map(s => s.trim()).filter(Boolean);
                return [lines[0] || p, lines[1] || n];
            } catch (e) {
                console.error('translatePromptAndNegative:', e.message);
                return [p, n];
            }
        }
        return [p, n];
    });
}

let ecpayConfig;
try { ecpayConfig = require('./config/ecpay-config.js'); } catch (_) { ecpayConfig = null; }

const BASE_URL = process.env.BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:' + (process.env.PORT || 3000));
const ECPAY_TEST_STAGE = 'https://vendor-stage.ecpay.com.tw';
const PAYPAL_DEV_DOC = 'https://developer.paypal.com';

/** 從 DB payment_config 讀取金流設定，與 env 合併（DB 優先） */
async function getPaymentConfig() {
    const out = {
        ecpay: {
            merchantID: process.env.ECPAY_MERCHANT_ID || (ecpayConfig && ecpayConfig.merchantID) || '2000132',
            hashKey: process.env.ECPAY_HASH_KEY || (ecpayConfig && ecpayConfig.hashKey) || '',
            hashIV: process.env.ECPAY_HASH_IV || (ecpayConfig && ecpayConfig.hashIV) || '',
            useProduction: process.env.ECPAY_USE_PRODUCTION === 'true',
            apiURL: (ecpayConfig && ecpayConfig.apiURL) || 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5',
            notifyURL: (ecpayConfig && ecpayConfig.notifyURL) || `${BASE_URL.replace(/\/$/, '')}/api/payment/notify`
        },
        paypal: {
            clientId: process.env.PAYPAL_CLIENT_ID || '',
            clientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
            sandbox: process.env.PAYPAL_SANDBOX !== 'false'
        }
    };
    try {
        const { data: rows } = await supabase.from('payment_config').select('key, value');
        if (rows && rows.length) {
            const m = {};
            rows.forEach(r => { m[r.key] = r.value; });
            if (m.ecpay_merchant_id != null && m.ecpay_merchant_id !== '') out.ecpay.merchantID = m.ecpay_merchant_id;
            if (m.ecpay_hash_key != null && m.ecpay_hash_key !== '') out.ecpay.hashKey = m.ecpay_hash_key;
            if (m.ecpay_hash_iv != null && m.ecpay_hash_iv !== '') out.ecpay.hashIV = m.ecpay_hash_iv;
            if (m.ecpay_use_production != null && m.ecpay_use_production !== '' && m.ecpay_use_production !== '0') out.ecpay.useProduction = true;
            if (out.ecpay.useProduction) {
                out.ecpay.apiURL = 'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5';
            }
            if (m.paypal_client_id != null && m.paypal_client_id !== '') out.paypal.clientId = m.paypal_client_id;
            if (m.paypal_client_secret != null && m.paypal_client_secret !== '') out.paypal.clientSecret = m.paypal_client_secret;
            if (m.paypal_sandbox != null && m.paypal_sandbox !== '' && m.paypal_sandbox !== '0' && m.paypal_sandbox !== 'false') out.paypal.sandbox = true;
            else if (m.paypal_sandbox === '0' || m.paypal_sandbox === 'false') out.paypal.sandbox = false;
        }
    } catch (e) {
        console.error('getPaymentConfig:', e.message);
    }
    return out;
}

/** Phase 1.6: 上傳單檔至 Supabase Storage，回傳 { path, publicUrl } */
async function uploadToSupabaseStorage(bucket, pathPrefix, file, options = {}) {
    const ext = (options.ext || path.extname(file.originalname || '') || '.jpg').replace(/^\./, '') || 'jpg';
    const filename = `${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;
    const objectPath = pathPrefix ? `${pathPrefix}/${filename}` : filename;
    const buffer = file.buffer || (file instanceof Buffer ? file : Buffer.from(file.data || ''));
    const contentType = options.contentType || file.mimetype || 'image/jpeg';
    const { data, error } = await supabase.storage
        .from(bucket)
        .upload(objectPath, buffer, { contentType, upsert: false });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(data.path);
    return { path: data.path, publicUrl };
}
const DB_URL = process.env.SUPABASE_DB_URL;
const LOCAL_CATEGORIES_PATH = path.join(__dirname, 'public', 'config', 'ai-categories.local.json');

/** subscription_plans 後台只查／寫這些欄位（多數環境表結構一致，不依賴直連 DB） */
const SUBSCRIPTION_PLANS_SELECT_COLUMNS = 'id, name, price, duration_months, credits_monthly, sort_order, is_active';

async function ensureAiCategoriesTableAndSeed() {
    if (!DB_URL) return; // 無 DB 直連就跳過
    const pool = new Pool({ connectionString: DB_URL });
    const client = await pool.connect();
    try {
        await client.query(`
            create table if not exists public.ai_categories (
                key text primary key,
                name text not null,
                prompt text not null default '',
                subcategories jsonb not null default '[]'::jsonb,
                updated_at timestamptz not null default now()
            );
        `);
        const { rows } = await client.query('select count(*)::int as cnt from public.ai_categories;');
        if (rows[0].cnt === 0) {
            const defPath = path.join(__dirname, 'public', 'config', 'default-categories.json');
            if (fs.existsSync(defPath)) {
                const raw = fs.readFileSync(defPath, 'utf-8');
                const json = JSON.parse(raw);
                const list = Array.isArray(json.categories) ? json.categories : [];
                for (const c of list) {
                    await client.query(
                        'insert into public.ai_categories(key, name, prompt, subcategories) values($1, $2, $3, $4) on conflict (key) do update set name=excluded.name, prompt=excluded.prompt, subcategories=excluded.subcategories',
                        [c.key, c.name, c.prompt || '', JSON.stringify(Array.isArray(c.sub) ? c.sub : [])]
                    );
                }
                console.log(`預設分類已匯入 ${list.length} 筆`);
            }
        }
    } catch (e) {
        console.error('初始化 ai_categories 失敗：', e.message);
    } finally {
        client.release();
        await pool.end();
    }
}

/**
 * 依客戶數量解析承包商的單價區間（支援階梯定價 price_tiers）
 * @param {object} listing - 含 price_min, price_max, price_tiers
 * @param {number} quantity - 客戶的數量
 * @returns {{ unit_price_min: number, unit_price_max: number }}
 */
function resolveUnitPriceForQuantity(listing, quantity) {
    const q = Number(quantity) || 1;
    const tiers = listing.price_tiers;
    if (tiers && Array.isArray(tiers) && tiers.length > 0) {
        const sorted = [...tiers].sort((a, b) => (Number(a.quantity_min) || 0) - (Number(b.quantity_min) || 0));
        for (const t of sorted) {
            const qMin = Number(t.quantity_min) ?? 0;
            const qMax = t.quantity_max != null ? Number(t.quantity_max) : null;
            if (q >= qMin && (qMax === null || q <= qMax)) {
                return {
                    unit_price_min: Number(t.unit_price_min) || 0,
                    unit_price_max: Number(t.unit_price_max) || 0
                };
            }
        }
        const last = sorted[sorted.length - 1];
        if (last && last.quantity_max == null)
            return { unit_price_min: Number(last.unit_price_min) || 0, unit_price_max: Number(last.unit_price_max) || 0 };
        const first = sorted[0];
        if (first)
            return { unit_price_min: Number(first.unit_price_min) || 0, unit_price_max: Number(first.unit_price_max) || 0 };
    }
    return {
        unit_price_min: listing.price_min != null ? Number(listing.price_min) : 0,
        unit_price_max: listing.price_max != null ? Number(listing.price_max) : 0
    };
}

// ==================== 通用單位對齊邏輯（所有分類共用，不硬編碼：比對僅做 trim + 小寫） ====================
/** 正規化單位字串（供比對用），傳入 null/undefined 回傳 '' */
function normalizeUnit(unit) {
    if (unit == null) return '';
    return String(unit).trim().toLowerCase();
}
/** 兩單位是否視為相同（發包項 vs 專家報價） */
function unitsMatch(unitA, unitB) {
    const a = normalizeUnit(unitA);
    const b = normalizeUnit(unitB);
    if (!a || !b) return false;
    return a === b;
}

// 標籤比對：刪除「通用尾字」後兩邊相同即算相符；清單由後台 /admin/tag-strip.html 管理
const TAG_STRIP_SUFFIXES_DEFAULT = ['工程', '課程', '服務', '設計', '製作', '施工', '安裝', '維修', '經營', '諮詢', '顧問', '行銷', '教學', '規劃', '整合'];
const tagStripSuffixesPath = path.join(__dirname, 'config', 'tag-strip-suffixes.json');
let _tagStripSuffixesCache = null;
function getTagStripSuffixes() {
    if (_tagStripSuffixesCache) return _tagStripSuffixesCache;
    try {
        if (fs.existsSync(tagStripSuffixesPath)) {
            const raw = fs.readFileSync(tagStripSuffixesPath, 'utf8');
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) {
                _tagStripSuffixesCache = arr.filter(w => typeof w === 'string' && w.trim());
                return _tagStripSuffixesCache;
            }
        }
    } catch (e) {
        console.warn('讀取 tag-strip-suffixes 失敗，使用預設:', e.message);
    }
    _tagStripSuffixesCache = [...TAG_STRIP_SUFFIXES_DEFAULT];
    return _tagStripSuffixesCache;
}
function normalizeTagForMatch(tag) {
    let s = (tag || '').toString().trim().toLowerCase();
    for (const w of getTagStripSuffixes()) {
        if (s.endsWith(w)) s = s.slice(0, -w.length).trim();
    }
    return s;
}
function tagsOverlapNormalized(itemTags, listingTags) {
    if (!Array.isArray(itemTags) || itemTags.length === 0 || !Array.isArray(listingTags) || listingTags.length === 0) return false;
    const set = new Set(itemTags.map(t => normalizeTagForMatch(t)).filter(Boolean));
    return listingTags.some(lt => set.has(normalizeTagForMatch(lt)));
}

// 中間件設置（JSON 放寬以接受客製產品儲存時可能帶的 base64 圖）
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// 允許本地開發時從其他 port（如 Live Server 5500）呼叫 API
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Auth-Token');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});
// 首頁：/ 與 /index.html 直接顯示 iStudio 內容（用 __dirname 避免 Cloud Run 等環境 cwd 不同）
const indexPath = path.join(__dirname, 'public', 'iStudio-1.0.0', 'index.html');
app.get(['/', '/index.html'], (req, res) => {
    res.sendFile(indexPath, (err) => {
        if (err) {
            console.error('首頁 sendFile 失敗:', err.message, 'path:', indexPath);
            res.status(err.status || 500).send(err.status === 404 ? 'File not found' : 'Server error');
        }
        // 成功時 sendFile 已送完，不需再 res.send
    });
});
// 【不准修改】首頁網址 /iStudio-1.0.0/ 必須導向 / ；使用者已多次被改壞，勿刪勿改此段
app.get(['/iStudio-1.0.0', '/iStudio-1.0.0/', '/iStudio-1.0.0/index.html'], (req, res) => {
    res.redirect(302, '/');
});
// 單一入口：產品設計表單與客戶端頁面（只維護 public/custom-product.html、client/*，舊網址導向正式路徑）
app.get('/iStudio-1.0.0/custom-product.html', (req, res) => res.redirect(302, '/custom-product.html'));
app.get('/iStudio-1.0.0/client/my-custom-products.html', (req, res) => res.redirect(302, '/client/my-custom-products.html'));
app.get('/iStudio-1.0.0/client/custom-product-detail.html', (req, res) => {
    const raw = req.originalUrl || req.url || '';
    const q = raw.indexOf('?') >= 0 ? raw.slice(raw.indexOf('?')) : '';
    res.redirect(302, '/client/custom-product-detail.html' + q);
});

// 圖庫找廠商：由伺服器注入資料，避免前端 fetch 失敗導致永遠沒顯示
async function getGalleryComparisonItems() {
    try {
        const { data: compRows } = await supabase
            .from('manufacturer_portfolio')
            .select('id, manufacturer_id, title, image_url, image_url_before, design_highlight')
            .order('created_at', { ascending: false })
            .limit(50);
        const out = (compRows || []).map(p => ({
            id: p.id,
            manufacturer_id: p.manufacturer_id,
            title: p.title || '廠商作品',
            image_url: p.image_url || null,
            image_url_before: p.image_url_before || null,
            design_highlight: p.design_highlight || null,
            manufacturer_name: '廠商作品',
            manufacturer_location: '',
            manufacturer_contact: null,
            tags: [],
            description: null
        }));
        if (out.length === 0) {
            out.push({
                id: 'demo-comparison',
                manufacturer_id: null,
                title: '對比範例',
                image_url: 'https://placehold.co/400x300/555/aaa?text=%E5%AF%A6%E5%93%81',
                image_url_before: 'https://placehold.co/400x300/888/ccc?text=%E6%A6%82%E5%BF%B5',
                design_highlight: null,
                manufacturer_name: '廠商作品',
                manufacturer_location: '',
                manufacturer_contact: null,
                tags: [],
                description: null
            });
        }
        return out;
    } catch (e) {
        console.error('getGalleryComparisonItems:', e);
        return [{
            id: 'demo-comparison',
            title: '對比範例',
            image_url: 'https://placehold.co/400x300/555/aaa?text=%E5%AF%A6%E5%93%81',
            image_url_before: 'https://placehold.co/400x300/888/ccc?text=%E6%A6%82%E5%BF%B5',
            manufacturer_name: '廠商作品',
            manufacturer_location: '',
            manufacturer_contact: null,
            tags: [],
            description: null
        }];
    }
}

app.get('/custom/gallery.html', async (req, res) => {
    try {
        const items = await getGalleryComparisonItems();
        const filePath = path.join(__dirname, 'public', 'custom', 'gallery.html');
        let html = await fs.promises.readFile(filePath, 'utf8');
        const inject = '<script>window.__GALLERY_ITEMS__=' + JSON.stringify(items).replace(/<\/script>/gi, '<\\/script>') + ';</script>';
        if (!html.includes('__GALLERY_ITEMS__')) {
            html = html.replace('</head>', inject + '\n</head>');
        }
        res.set('Content-Type', 'text/html; charset=utf-8');
        res.set('Cache-Control', 'private, max-age=60');
        res.send(html);
    } catch (e) {
        console.error('GET /custom/gallery.html:', e);
        res.status(500).send('伺服器錯誤');
    }
});

// GET /sitemap.xml — SEO 用網站地圖「索引」；子 sitemap 持續由 DB/靜態清單更新（見 docs/sitemap.md）
const SITEMAP_PAGES = [
    { path: '/', priority: '1.0', changefreq: 'weekly' },
    { path: '/subscription-plans.html', priority: '0.9', changefreq: 'monthly' },
    { path: '/credits.html', priority: '0.8', changefreq: 'monthly' },
    { path: '/custom/', priority: '0.9', changefreq: 'weekly' },
    { path: '/custom/gallery.html', priority: '0.9', changefreq: 'weekly' },
    { path: '/custom-product.html', priority: '0.8', changefreq: 'monthly' },
    { path: '/remake/', priority: '0.9', changefreq: 'weekly' },
    { path: '/remake-product.html', priority: '0.8', changefreq: 'monthly' },
    { path: '/about.html', priority: '0.6', changefreq: 'yearly' },
    { path: '/contact.html', priority: '0.7', changefreq: 'monthly' },
    { path: '/service.html', priority: '0.7', changefreq: 'monthly' },
    { path: '/feature.html', priority: '0.6', changefreq: 'monthly' },
    { path: '/project.html', priority: '0.6', changefreq: 'monthly' },
    { path: '/testimonial.html', priority: '0.6', changefreq: 'monthly' },
    { path: '/team.html', priority: '0.6', changefreq: 'monthly' },
    { path: '/login.html', priority: '0.4', changefreq: 'monthly' },
    { path: '/register.html', priority: '0.4', changefreq: 'monthly' }
];
function escapeXml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
// Sitemap 索引：列出所有子 sitemap，Google 會依此再抓取各子 sitemap（持續更新來源）
app.get('/sitemap.xml', (req, res) => {
    const base = (BASE_URL || '').replace(/\/$/, '');
    const now = new Date().toISOString().slice(0, 10);
    const entries = [
        '<sitemap><loc>' + escapeXml(base + '/sitemap-pages.xml') + '</loc><lastmod>' + now + '</lastmod></sitemap>',
        '<sitemap><loc>' + escapeXml(base + '/sitemap-vendors.xml') + '</loc><lastmod>' + now + '</lastmod></sitemap>'
    ];
    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  ' + entries.join('\n  ') + '\n</sitemapindex>';
    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(xml);
});
// 靜態／半靜態公開頁（固定清單）
app.get('/sitemap-pages.xml', (req, res) => {
    const base = (BASE_URL || '').replace(/\/$/, '');
    const lastmod = new Date().toISOString().slice(0, 10);
    const urls = SITEMAP_PAGES.map(p => {
        const loc = base + (p.path === '/' ? '' : p.path);
        return '  <url><loc>' + escapeXml(loc) + '</loc><lastmod>' + lastmod + '</lastmod><changefreq>' + (p.changefreq || 'monthly') + '</changefreq><priority>' + (p.priority || '0.5') + '</priority></url>';
    }).join('\n');
    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls + '\n</urlset>';
    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(xml);
});
// 動態：廠商／製作方列表與詳情頁（由 DB 查詢，每次請求即時更新，新會員/作品上線即被收錄）
app.get('/sitemap-vendors.xml', async (req, res) => {
    const base = (BASE_URL || '').replace(/\/$/, '');
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
    } catch (e) {
        console.error('sitemap-vendors:', e);
    }
    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.join('\n') + '\n</urlset>';
    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=1800');
    res.send(xml);
});

// GET /robots.txt — 告知搜尋引擎 Sitemap 位置並限制爬取範圍（SEO）
app.get('/robots.txt', (req, res) => {
    const base = (BASE_URL || '').replace(/\/$/, '');
    const body = 'User-agent: *\nDisallow: /admin/\nDisallow: /api/\nDisallow: /payment/\nAllow: /\n\nSitemap: ' + base + '/sitemap.xml\n';
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(body);
});

// 圖庫找廠商專用 API（與首頁同源資料），避免圖庫頁永遠空白
app.get('/api/gallery-items', async (req, res) => {
    try {
        const items = await getGalleryComparisonItems();
        res.set('Cache-Control', 'private, max-age=60');
        res.json({ items });
    } catch (e) {
        console.error('GET /api/gallery-items:', e);
        res.status(500).json({ error: '載入失敗' });
    }
});

// 後台：管理員驗證（供 /api/admin/users 等使用）
async function requireAdmin(req, res) {
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
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') {
        res.status(403).json({ error: '僅管理員可操作' });
        return null;
    }
    return user;
}

// 後台：管理員或測試員（僅 Playground / AI 工具頁用）
async function requireAdminOrTester(req, res) {
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
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin' && profile?.role !== 'tester') {
        res.status(403).json({ error: '僅管理員或測試員可操作' });
        return null;
    }
    return user;
}

// GET /api/admin/can-access — 供前端 /admin/* 權限閘使用：僅管理員或測試員回 200，未登入 401，其餘 403
// 若 .env 設 ALLOWED_TESTER_EMAILS=信箱1,信箱2 則該信箱可直接通過（繞過 profiles.role）
app.get('/api/admin/can-access', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        res.status(401).json({ error: '未授權' });
        return;
    }
    const token = authHeader.replace(/^\s*Bearer\s+/i, '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
        res.status(401).json({ error: 'token 無效' });
        return;
    }
    const email = (user.email || '').trim().toLowerCase();
    const allowedEmails = (process.env.ALLOWED_TESTER_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    if (allowedEmails.length > 0 && allowedEmails.includes(email)) {
        return res.json({ ok: true });
    }
    const { data: profile, error: profErr } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (profErr) {
        console.error('GET /api/admin/can-access profiles:', profErr);
        res.status(500).json({ error: '查詢角色失敗', debug: profErr.message });
        return;
    }
    const role = profile?.role !== undefined && profile?.role !== null ? profile.role : null;
    if (role !== 'admin' && role !== 'tester') {
        const hint = profile == null
            ? "INSERT INTO public.profiles (id, email, role) VALUES ('" + user.id + "', '" + (user.email || '').replace(/'/g, "''") + "', 'tester') ON CONFLICT (id) DO UPDATE SET role = 'tester';"
            : "UPDATE public.profiles SET role = 'tester' WHERE id = '" + user.id + "';";
        res.status(403).json({ error: '僅管理員或測試員可進入後台', role: role, hint: hint });
        return;
    }
    res.json({ ok: true });
});

// GET /api/admin/users — 用戶管理：列出所有用戶（含會員等級、點數），僅管理員（註冊於 static 前以確保不被靜態攔截）
app.get('/api/admin/users', async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) return;
        let list = [];
        const { data: profiles, error: profErr } = await supabase
            .from('profiles')
            .select('id, email, full_name, role, member_level')
            .order('email', { ascending: true });
        if (profErr) {
            if (profErr.code === '42703') {
                const { data: prof2, error: e2 } = await supabase
                    .from('profiles')
                    .select('id, email, full_name, role')
                    .order('email', { ascending: true });
                if (e2) {
                    console.error('GET /api/admin/users profiles:', e2);
                    return res.status(500).json({ error: '查詢用戶失敗' });
                }
                list = (prof2 || []).map(p => ({ ...p, member_level: '一般' }));
            } else {
                console.error('GET /api/admin/users profiles:', profErr);
                return res.status(500).json({ error: '查詢用戶失敗' });
            }
        } else {
            list = profiles || [];
        }
        const userIds = list.map(p => p.id).filter(Boolean);
        let creditsMap = {};
        if (userIds.length > 0) {
            try {
                const { data: credits } = await supabase
                    .from('user_credits')
                    .select('user_id, balance, total_earned, total_spent')
                    .in('user_id', userIds);
                (credits || []).forEach(c => { creditsMap[c.user_id] = c; });
            } catch (_) { /* user_credits 表可能尚未建立 */ }
        }
        const users = list.map(p => ({
            id: p.id,
            email: p.email || '',
            full_name: p.full_name || '',
            role: p.role || 'user',
            member_level: p.member_level || '一般',
            points: creditsMap[p.id] ? creditsMap[p.id].balance : 0,
            total_earned: creditsMap[p.id] ? creditsMap[p.id].total_earned : 0,
            total_spent: creditsMap[p.id] ? creditsMap[p.id].total_spent : 0
        }));
        res.json({ users });
    } catch (e) {
        console.error('GET /api/admin/users 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// POST /api/admin/users — 管理員手動建立帳號（email + 密碼，可設姓名、角色、會員等級）
app.post('/api/admin/users', express.json(), async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) return;
        const body = req.body || {};
        const email = (body.email != null && String(body.email).trim()) ? String(body.email).trim() : '';
        const password = String(body.password || '').trim();
        if (!email) return res.status(400).json({ error: '請填寫 Email' });
        if (password.length < 6) return res.status(400).json({ error: '密碼至少 6 個字元' });
        const fullName = body.full_name != null ? String(body.full_name).trim() : '';
        const role = (body.role === 'admin' || body.role === 'tester') ? body.role : 'user';
        const memberLevel = (body.member_level && ['一般', '進階', '尊榮', 'VIP'].includes(body.member_level)) ? body.member_level : '一般';

        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true
        });
        if (authError) {
            const msg = authError.message || '';
            if (msg.includes('already') || authError.status === 422) return res.status(400).json({ error: '此 Email 已被註冊' });
            console.error('POST /api/admin/users createUser:', authError);
            return res.status(400).json({ error: msg || '建立帳號失敗' });
        }
        const userId = authData.user?.id;
        if (!userId) return res.status(500).json({ error: '建立帳號後未取得用戶 ID' });

        const { error: profileErr } = await supabase.from('profiles')
            .upsert({
                id: userId,
                email,
                full_name: fullName || null,
                role
            }, { onConflict: 'id' });
        if (profileErr) {
            console.error('POST /api/admin/users profiles upsert:', profileErr);
            return res.status(500).json({ error: '更新用戶資料失敗' });
        }
        if (memberLevel && memberLevel !== '一般') {
            const { error: levelErr } = await supabase.from('profiles')
                .update({ member_level: memberLevel }).eq('id', userId);
            if (levelErr) { /* 若 profiles 尚無 member_level 欄位，忽略；請執行 docs/admin-user-management-profiles-migration.sql */ }
        }

        res.status(201).json({ success: true, id: userId, email });
    } catch (e) {
        console.error('POST /api/admin/users 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// GET /api/admin/payment-config — 金流設定（僅管理員），回傳時密鑰以尾四碼遮蔽
app.get('/api/admin/payment-config', async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) return;
        const { data: rows } = await supabase.from('payment_config').select('key, value');
        const obj = {};
        (rows || []).forEach(r => { obj[r.key] = r.value; });
        const mask = (v) => (v && v.length > 4) ? '****' + v.slice(-4) : (v ? '****' : '');
        res.json({
            ecpay_merchant_id: obj.ecpay_merchant_id || '',
            ecpay_hash_key: obj.ecpay_hash_key ? mask(obj.ecpay_hash_key) : '',
            ecpay_hash_key_set: !!(obj.ecpay_hash_key && obj.ecpay_hash_key.length > 0),
            ecpay_hash_iv: obj.ecpay_hash_iv ? mask(obj.ecpay_hash_iv) : '',
            ecpay_hash_iv_set: !!(obj.ecpay_hash_iv && obj.ecpay_hash_iv.length > 0),
            ecpay_use_production: obj.ecpay_use_production === '1' || obj.ecpay_use_production === 'true',
            paypal_client_id: obj.paypal_client_id || '',
            paypal_client_secret: obj.paypal_client_secret ? mask(obj.paypal_client_secret) : '',
            paypal_client_secret_set: !!(obj.paypal_client_secret && obj.paypal_client_secret.length > 0),
            paypal_sandbox: obj.paypal_sandbox !== '0' && obj.paypal_sandbox !== 'false'
        });
    } catch (e) {
        console.error('GET /api/admin/payment-config:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// PATCH /api/admin/payment-config — 儲存金流設定（僅管理員）
app.patch('/api/admin/payment-config', express.json(), async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) return;
        const body = req.body || {};
        const upsert = async (key, value) => {
            if (value === undefined || value === null) return;
            await supabase.from('payment_config').upsert({ key, value: String(value).trim(), updated_at: new Date().toISOString() }, { onConflict: 'key' });
        };
        if (body.ecpay_merchant_id !== undefined) await upsert('ecpay_merchant_id', body.ecpay_merchant_id);
        if (body.ecpay_hash_key !== undefined) await upsert('ecpay_hash_key', body.ecpay_hash_key);
        if (body.ecpay_hash_iv !== undefined) await upsert('ecpay_hash_iv', body.ecpay_hash_iv);
        if (body.ecpay_use_production !== undefined) await upsert('ecpay_use_production', body.ecpay_use_production ? '1' : '0');
        if (body.paypal_client_id !== undefined) await upsert('paypal_client_id', body.paypal_client_id);
        if (body.paypal_client_secret !== undefined) await upsert('paypal_client_secret', body.paypal_client_secret);
        if (body.paypal_sandbox !== undefined) await upsert('paypal_sandbox', body.paypal_sandbox ? '1' : '0');
        res.json({ success: true });
    } catch (e) {
        console.error('PATCH /api/admin/payment-config:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// GET /api/config/ga4 — 公開：回傳 GA4 衡量 ID（供前台載入 gtag，未設定則回傳空）
app.get('/api/config/ga4', async (req, res) => {
    try {
        const { data: row } = await supabase.from('payment_config').select('value').eq('key', 'ga4_measurement_id').maybeSingle();
        const measurementId = (row && row.value && String(row.value).trim()) ? String(row.value).trim() : '';
        res.set('Cache-Control', 'public, max-age=300');
        res.json({ measurementId });
    } catch (e) {
        res.set('Cache-Control', 'public, max-age=60');
        res.json({ measurementId: '' });
    }
});

// GET /api/admin/ga4 — 後台：取得 GA4 設定（僅管理員）
app.get('/api/admin/ga4', async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) return;
        const { data: row } = await supabase.from('payment_config').select('value').eq('key', 'ga4_measurement_id').maybeSingle();
        const measurementId = (row && row.value && String(row.value).trim()) ? String(row.value).trim() : '';
        res.json({ measurementId });
    } catch (e) {
        console.error('GET /api/admin/ga4:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// PATCH /api/admin/ga4 — 後台：儲存 GA4 衡量 ID（僅管理員）
app.patch('/api/admin/ga4', express.json(), async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) return;
        const measurementId = (req.body && req.body.measurementId != null) ? String(req.body.measurementId).trim() : '';
        await supabase.from('payment_config').upsert(
            { key: 'ga4_measurement_id', value: measurementId, updated_at: new Date().toISOString() },
            { onConflict: 'key' }
        );
        res.json({ success: true });
    } catch (e) {
        console.error('PATCH /api/admin/ga4:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// PATCH /api/admin/users/:id — 用戶管理：手動編輯會員等級、點數，僅管理員
app.patch('/api/admin/users/:id', express.json(), async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) return;
        const userId = req.params.id;
        if (!userId) return res.status(400).json({ error: '缺少用戶 id' });
        const body = req.body || {};
        const memberLevel = body.member_level != null ? String(body.member_level).trim() : null;
        const role = body.role != null ? String(body.role).trim() : null;
        const points = body.points != null ? parseInt(body.points, 10) : null;

        const allowedRoles = ['user', 'admin', 'tester'];
        if (role !== null && role !== '' && allowedRoles.indexOf(role) === -1) {
            return res.status(400).json({ error: '角色僅可為：user、admin、tester' });
        }

        if (memberLevel !== null) {
            const { data: prof, error: profErr } = await supabase
                .from('profiles')
                .select('id').eq('id', userId).single();
            if (profErr || !prof) return res.status(404).json({ error: '找不到該用戶' });
            const { error: updateErr } = await supabase
                .from('profiles')
                .update({ member_level: memberLevel || '一般' })
                .eq('id', userId);
            if (updateErr) {
                if (updateErr.code === '42703') {
                    return res.status(400).json({ error: '請先執行 docs/admin-user-management-profiles-migration.sql 新增 member_level 欄位' });
                }
                console.error('PATCH /api/admin/users profiles:', updateErr);
                return res.status(500).json({ error: '更新會員等級失敗' });
            }
        }

        if (role !== null && role !== '') {
            const { data: prof, error: profErr } = await supabase
                .from('profiles')
                .select('id').eq('id', userId).single();
            if (profErr || !prof) return res.status(404).json({ error: '找不到該用戶' });
            const { error: roleErr } = await supabase
                .from('profiles')
                .update({ role })
                .eq('id', userId);
            if (roleErr) {
                console.error('PATCH /api/admin/users profiles role:', roleErr);
                return res.status(500).json({ error: '更新角色失敗（請確認已執行 docs/migration-add-tester-role.sql）' });
            }
        }

        if (points !== null && !isNaN(points) && points >= 0) {
            const { data: existing } = await supabase.from('user_credits').select('user_id, balance').eq('user_id', userId).maybeSingle();
            if (existing) {
                const { error: credErr } = await supabase
                    .from('user_credits')
                    .update({ balance: points, updated_at: new Date().toISOString() })
                    .eq('user_id', userId);
                if (credErr) {
                    console.error('PATCH /api/admin/users user_credits update:', credErr);
                    return res.status(500).json({ error: '更新點數失敗' });
                }
            } else {
                const { error: insErr } = await supabase
                    .from('user_credits')
                    .insert({ user_id: userId, balance: points, total_earned: points, total_spent: 0 });
                if (insErr) {
                    console.error('PATCH /api/admin/users user_credits insert:', insErr);
                    return res.status(500).json({ error: '寫入點數失敗' });
                }
            }
        }

        res.json({ success: true });
    } catch (e) {
        console.error('PATCH /api/admin/users 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// 用「請求中的管理員 JWT」建 Supabase 用戶端，查 RLS 表時以該用戶身份查詢，RLS 才會通過
function supabaseWithAuth(req) {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.replace(/^\s*Bearer\s+/i, '').trim();
    if (!token) return supabase;
    const anonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;
    if (!anonKey) return supabase;
    return createClient(process.env.SUPABASE_URL, anonKey, {
        global: { headers: { Authorization: 'Bearer ' + token } }
    });
}

// GET /api/admin/subscription-plans — 列出所有方案（含停用），用全域 supabase（service_role 可繞過 RLS）
app.get('/api/admin/subscription-plans', async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) return;
        const { data: rows, error } = await supabase
            .from('subscription_plans')
            .select(SUBSCRIPTION_PLANS_SELECT_COLUMNS)
            .order('sort_order', { ascending: true });
        if (error) {
            console.error('GET /api/admin/subscription-plans:', error);
            const msg = error.message || '';
            const hint = (msg.includes('does not exist') || msg.includes('relation'))
                ? '請在 Supabase SQL Editor 執行 docs/subscriptions-schema.sql 建立 subscription_plans 表。'
                : '';
            return res.status(500).json({
                error: '查詢方案失敗',
                details: msg,
                hint: hint
            });
        }
        res.json({ plans: rows || [] });
    } catch (e) {
        console.error('GET /api/admin/subscription-plans 異常:', e);
        res.status(500).json({ error: '系統錯誤', details: e.message });
    }
});

// GET /api/subscription-plans — 公開：僅列出啟用中方案，供前台 subscription-plans.html 同步顯示
app.get('/api/subscription-plans', async (req, res) => {
    try {
        const { data: rows, error } = await supabase
            .from('subscription_plans')
            .select(SUBSCRIPTION_PLANS_SELECT_COLUMNS)
            .eq('is_active', true)
            .order('sort_order', { ascending: true });
        if (error) {
            console.error('GET /api/subscription-plans:', error);
            return res.status(500).json({ error: '查詢失敗', plans: [] });
        }
        res.set('Cache-Control', 'public, max-age=60');
        res.json({ plans: rows || [] });
    } catch (e) {
        console.error('GET /api/subscription-plans 異常:', e);
        res.status(500).json({ error: '系統錯誤', plans: [] });
    }
});

// PATCH /api/admin/subscription-plans/:id — 更新單一方案（名稱、月費、點數、排序、啟用）
app.patch('/api/admin/subscription-plans/:id', express.json(), async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) return;
        const id = req.params.id;
        const body = req.body || {};
        const updates = {};
        if (body.name !== undefined) updates.name = String(body.name).trim();
        if (body.price !== undefined) updates.price = parseInt(body.price, 10);
        if (body.duration_months !== undefined) updates.duration_months = parseInt(body.duration_months, 10);
        if (body.credits_monthly !== undefined) updates.credits_monthly = parseInt(body.credits_monthly, 10);
        if (body.sort_order !== undefined) updates.sort_order = parseInt(body.sort_order, 10);
        if (body.is_active !== undefined) updates.is_active = !!body.is_active;
        if (Object.keys(updates).length === 0) return res.status(400).json({ error: '無可更新欄位' });
        const { error: updErr } = await supabase.from('subscription_plans').update(updates).eq('id', id);
        if (updErr) {
            console.error('PATCH /api/admin/subscription-plans:', updErr);
            return res.status(500).json({ error: '更新方案失敗', details: updErr.message });
        }
        res.json({ success: true });
    } catch (e) {
        console.error('PATCH /api/admin/subscription-plans 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// GET /api/points-info — 公開點數說明（供前台 credits 頁顯示「用盡後加購」單價，與後台規則同步）
app.get('/api/points-info', async (req, res) => {
    try {
        const { data: rows } = await supabase.from('payment_config').select('key, value').eq('key', 'points_listing_per_category');
        const val = (rows && rows[0]) ? rows[0].value : null;
        res.set('Cache-Control', 'public, max-age=300');
        res.json({ points_listing_per_category: parseInt(val, 10) || 200 });
    } catch (e) {
        console.error('GET /api/points-info:', e);
        res.status(500).json({ points_listing_per_category: 200 });
    }
});

// GET /api/admin/points-config — 點數規則（管理員可調；測試員可讀，供 AI 工具頁顯示）
app.get('/api/admin/points-config', async (req, res) => {
    try {
        const adminUser = await requireAdminOrTester(req, res);
        if (!adminUser) return;
        const { data: rows } = await supabase.from('payment_config').select('key, value').in('key', [
            'points_text_to_image', 'points_image_to_image', 'points_ai_upscale', 'points_ai_sketch', 'points_ai_structure', 'points_ai_style', 'points_ai_style_transfer', 'points_ai_erase', 'points_ai_inpaint', 'points_ai_outpaint', 'points_ai_remove_bg', 'points_ai_replace_bg_relight', 'points_scene_simulate', 'points_translation', 'points_listing_per_category'
        ]);
        const obj = {};
        (rows || []).forEach(r => { obj[r.key] = r.value; });
        res.json({
            points_text_to_image: parseInt(obj.points_text_to_image, 10) || 15,
            points_image_to_image: parseInt(obj.points_image_to_image, 10) || 20,
            points_ai_upscale: parseInt(obj.points_ai_upscale, 10) || 10,
            points_ai_sketch: parseInt(obj.points_ai_sketch, 10) || 20,
            points_ai_structure: parseInt(obj.points_ai_structure, 10) || 20,
            points_ai_style: parseInt(obj.points_ai_style, 10) || 20,
            points_ai_style_transfer: parseInt(obj.points_ai_style_transfer, 10) || 30,
            points_ai_erase: parseInt(obj.points_ai_erase, 10) || 20,
            points_ai_inpaint: parseInt(obj.points_ai_inpaint, 10) || 20,
            points_ai_outpaint: parseInt(obj.points_ai_outpaint, 10) || 15,
            points_ai_remove_bg: parseInt(obj.points_ai_remove_bg, 10) || 15,
            points_ai_replace_bg_relight: parseInt(obj.points_ai_replace_bg_relight, 10) || 30,
            points_scene_simulate: parseInt(obj.points_scene_simulate, 10) || 20,
            points_translation: parseInt(obj.points_translation, 10) || 1,
            points_listing_per_category: parseInt(obj.points_listing_per_category, 10) || 200
        });
    } catch (e) {
        console.error('GET /api/admin/points-config:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// PATCH /api/admin/points-config — 儲存點數規則
app.patch('/api/admin/points-config', express.json(), async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) return;
        const body = req.body || {};
        const upsert = async (key, value) => {
            await supabase.from('payment_config').upsert({ key, value: String(value), updated_at: new Date().toISOString() }, { onConflict: 'key' });
        };
        if (body.points_text_to_image !== undefined) await upsert('points_text_to_image', body.points_text_to_image);
        if (body.points_image_to_image !== undefined) await upsert('points_image_to_image', body.points_image_to_image);
        if (body.points_ai_upscale !== undefined) await upsert('points_ai_upscale', body.points_ai_upscale);
        if (body.points_ai_sketch !== undefined) await upsert('points_ai_sketch', body.points_ai_sketch);
        if (body.points_ai_structure !== undefined) await upsert('points_ai_structure', body.points_ai_structure);
        if (body.points_ai_style !== undefined) await upsert('points_ai_style', body.points_ai_style);
        if (body.points_ai_style_transfer !== undefined) await upsert('points_ai_style_transfer', body.points_ai_style_transfer);
        if (body.points_ai_erase !== undefined) await upsert('points_ai_erase', body.points_ai_erase);
        if (body.points_ai_inpaint !== undefined) await upsert('points_ai_inpaint', body.points_ai_inpaint);
        if (body.points_ai_outpaint !== undefined) await upsert('points_ai_outpaint', body.points_ai_outpaint);
        if (body.points_ai_remove_bg !== undefined) await upsert('points_ai_remove_bg', body.points_ai_remove_bg);
        if (body.points_ai_replace_bg_relight !== undefined) await upsert('points_ai_replace_bg_relight', body.points_ai_replace_bg_relight);
        if (body.points_scene_simulate !== undefined) await upsert('points_scene_simulate', body.points_scene_simulate);
        if (body.points_translation !== undefined) await upsert('points_translation', body.points_translation);
        if (body.points_listing_per_category !== undefined) await upsert('points_listing_per_category', body.points_listing_per_category);
        res.json({ success: true });
    } catch (e) {
        console.error('PATCH /api/admin/points-config:', e);
        const details = (e && (e.code || e.message)) ? String(e.code || e.message) : undefined;
        res.status(500).json({ error: '系統錯誤', details });
    }
});

// GET /api/admin/ai-config — AI 模型設定（僅管理員）：翻譯 + 讀圖/分析
app.get('/api/admin/ai-config', async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) return;
        const { data: rows } = await supabase.from('payment_config').select('key, value').in('key', ['gemini_model', 'gemini_model_read']);
        const byKey = (rows || []).reduce((o, r) => { o[r.key] = r.value?.trim?.(); return o; }, {});
        res.json({
            gemini_model: byKey.gemini_model || process.env.GEMINI_MODEL || GEMINI_MODEL_TRANSLATION_DEFAULT,
            gemini_model_read: byKey.gemini_model_read || process.env.GEMINI_MODEL_READ || GEMINI_MODEL_READ_DEFAULT
        });
    } catch (e) {
        console.error('GET /api/admin/ai-config:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// PATCH /api/admin/ai-config — 儲存 AI 模型設定（僅管理員）
app.patch('/api/admin/ai-config', express.json(), async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) return;
        const body = req.body || {};
        const now = new Date().toISOString();
        if (body.gemini_model !== undefined) {
            await supabase.from('payment_config').upsert({
                key: 'gemini_model',
                value: String(body.gemini_model).trim(),
                updated_at: now
            }, { onConflict: 'key' });
        }
        if (body.gemini_model_read !== undefined) {
            await supabase.from('payment_config').upsert({
                key: 'gemini_model_read',
                value: String(body.gemini_model_read).trim(),
                updated_at: now
            }, { onConflict: 'key' });
        }
        res.json({ success: true });
    } catch (e) {
        console.error('PATCH /api/admin/ai-config:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// GET /api/admin/scene-sim-prompt — 實境模擬系統提示詞（僅管理員）
app.get('/api/admin/scene-sim-prompt', async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) return;
        const { data: row } = await supabase.from('payment_config').select('value').eq('key', 'scene_sim_system_prompt').maybeSingle();
        const system_prompt = (row && row.value != null) ? String(row.value).trim() : '';
        res.json({ system_prompt });
    } catch (e) {
        console.error('GET /api/admin/scene-sim-prompt:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// PATCH /api/admin/scene-sim-prompt — 儲存實境模擬系統提示詞（僅管理員）
app.patch('/api/admin/scene-sim-prompt', express.json(), async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) return;
        const system_prompt = (req.body && req.body.system_prompt != null) ? String(req.body.system_prompt).trim() : '';
        await supabase.from('payment_config').upsert({
            key: 'scene_sim_system_prompt',
            value: system_prompt,
            updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
        res.json({ success: true });
    } catch (e) {
        console.error('PATCH /api/admin/scene-sim-prompt:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// GET /api/admin/membership/user?email= — 依 email 查詢用戶等級、點數、訂閱（供會員管理頁「用戶等級與點數」）
app.get('/api/admin/membership/user', async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) return;
        const email = (req.query.email || '').trim().toLowerCase();
        if (!email) return res.status(400).json({ error: '請提供 email' });
        const { data: profile, error: profErr } = await supabase
            .from('profiles')
            .select('id, email, full_name, role, member_level')
            .ilike('email', email)
            .maybeSingle();
        if (profErr || !profile) return res.json({ user: null });
        const userId = profile.id;
        let credits = null;
        let subscription = null;
        const { data: cred } = await supabase.from('user_credits').select('balance, total_earned, total_spent').eq('user_id', userId).maybeSingle();
        if (cred) credits = cred;
        const now = new Date().toISOString();
        const { data: subRows } = await supabase
            .from('user_subscriptions')
            .select('id, start_date, end_date, status, subscription_plans(name, plan_key)')
            .eq('user_id', userId)
            .eq('status', 'active')
            .gt('end_date', now)
            .order('end_date', { ascending: false })
            .limit(1);
        if (subRows && subRows.length > 0) subscription = { ...subRows[0], plan_name: subRows[0].subscription_plans?.name, plan_key: subRows[0].subscription_plans?.plan_key };
        res.json({ user: { ...profile, credits, subscription } });
    } catch (e) {
        console.error('GET /api/admin/membership/user:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// POST /api/admin/membership/adjust-credits — 管理員手動調整用戶點數（補點或扣點）
app.post('/api/admin/membership/adjust-credits', express.json(), async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) return;
        const { email, amount, description } = req.body || {};
        const emailStr = (email && String(email).trim()).toLowerCase();
        if (!emailStr) return res.status(400).json({ error: '請提供 email' });
        const amt = parseInt(amount, 10);
        if (isNaN(amt) || amt === 0) return res.status(400).json({ error: '請提供有效點數（正數補點、負數扣點）' });
        const { data: profile } = await supabase.from('profiles').select('id').ilike('email', emailStr).maybeSingle();
        if (!profile) return res.status(404).json({ error: '找不到該用戶' });
        const userId = profile.id;
        const { data: existing } = await supabase.from('user_credits').select('user_id, balance, total_earned, total_spent').eq('user_id', userId).maybeSingle();
        const prevBalance = existing ? existing.balance : 0;
        const newBalance = Math.max(0, prevBalance + amt);
        if (existing) {
            const totalEarned = (existing.total_earned || 0) + (amt > 0 ? amt : 0);
            const totalSpent = (existing.total_spent || 0) + (amt < 0 ? Math.abs(amt) : 0);
            const { error: updErr } = await supabase.from('user_credits')
                .update({ balance: newBalance, total_earned: totalEarned, total_spent: totalSpent, updated_at: new Date().toISOString() })
                .eq('user_id', userId);
            if (updErr) return res.status(500).json({ error: '更新點數失敗' });
        } else {
            const { error: insErr } = await supabase.from('user_credits').insert({
                user_id: userId,
                balance: newBalance,
                total_earned: amt > 0 ? amt : 0,
                total_spent: amt < 0 ? Math.abs(amt) : 0
            });
            if (insErr) return res.status(500).json({ error: '寫入點數失敗' });
        }
        await supabase.from('credit_transactions').insert({
            user_id: userId,
            type: amt > 0 ? 'granted' : 'consumed',
            amount: amt,
            balance_after: newBalance,
            source: 'admin_adjust',
            description: description || (amt > 0 ? '管理員補點' : '管理員扣點')
        });
        res.json({ success: true, previous_balance: prevBalance, new_balance: newBalance });
    } catch (e) {
        console.error('POST /api/admin/membership/adjust-credits:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// GET /api/admin/membership/ledger?email= — 查詢用戶點數流水
app.get('/api/admin/membership/ledger', async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) return;
        const email = (req.query.email || '').trim().toLowerCase();
        if (!email) return res.status(400).json({ error: '請提供 email' });
        const { data: profile } = await supabase.from('profiles').select('id').ilike('email', email).maybeSingle();
        if (!profile) return res.json({ ledger: [] });
        const { data: rows } = await supabase
            .from('credit_transactions')
            .select('id, type, amount, balance_after, source, description, created_at')
            .eq('user_id', profile.id)
            .order('created_at', { ascending: false })
            .limit(100);
        res.json({ ledger: rows || [] });
    } catch (e) {
        console.error('GET /api/admin/membership/ledger:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// GET /api/admin/points-usage-stats — 各扣點功能：次數、點數累計、平均點數（供後台統計表）
app.get('/api/admin/points-usage-stats', async (req, res) => {
    try {
        const user = await requireAdmin(req, res);
        if (!user) return;
        const fromDate = (req.query.from_date || '').trim() || null;
        const toDate = (req.query.to_date || '').trim() || null;
        let query = supabase
            .from('credit_transactions')
            .select('amount, description, created_at, user_id')
            .eq('type', 'consumed')
            .lt('amount', 0)
            .order('created_at', { ascending: false });
        if (fromDate) query = query.gte('created_at', fromDate);
        if (toDate) query = query.lte('created_at', toDate + (toDate.length <= 10 ? 'T23:59:59.999Z' : ''));
        const { data: rows, error } = await query.limit(50000);
        if (error) {
            console.error('GET /api/admin/points-usage-stats:', error);
            return res.status(500).json({ error: '查詢失敗' });
        }
        const list = rows || [];
        const userIds = [...new Set((list || []).map(function (r) { return r.user_id; }).filter(Boolean))];
        let userIdToLevel = {};
        if (userIds.length > 0) {
            try {
                const { data: profiles } = await supabase.from('profiles').select('id, member_level').in('id', userIds);
                (profiles || []).forEach(function (p) {
                    userIdToLevel[p.id] = (p.member_level && String(p.member_level).trim()) || '一般';
                });
            } catch (_) { /* profiles 可能無 member_level */ }
        }
        const byDesc = {};
        const byDay = {};
        const byLevel = {};
        list.forEach(function (r) {
            const level = userIdToLevel[r.user_id] || '一般';
            if (!byLevel[level]) byLevel[level] = { total: 0, count: 0, userIds: new Set() };
            byLevel[level].total += Math.abs(parseInt(r.amount, 10) || 0);
            byLevel[level].count += 1;
            if (r.user_id) byLevel[level].userIds.add(r.user_id);
            const desc = (r.description && String(r.description).trim()) || '其他';
            if (!byDesc[desc]) byDesc[desc] = { total: 0, count: 0 };
            byDesc[desc].total += Math.abs(parseInt(r.amount, 10) || 0);
            byDesc[desc].count += 1;
            const day = r.created_at ? r.created_at.slice(0, 10) : null;
            if (day) {
                if (!byDay[day]) byDay[day] = { total: 0, count: 0 };
                byDay[day].total += Math.abs(parseInt(r.amount, 10) || 0);
                byDay[day].count += 1;
            }
        });
        const by_level = Object.keys(byLevel).sort().map(function (level) {
            const o = byLevel[level];
            return {
                member_level: level,
                total_points: o.total,
                count: o.count,
                user_count: o.userIds ? o.userIds.size : 0,
                avg_per_user: o.userIds && o.userIds.size > 0 ? Math.round((o.total / o.userIds.size) * 10) / 10 : 0
            };
        }).sort(function (a, b) { return b.total_points - a.total_points; });
        const stats = Object.keys(byDesc).sort().map(function (desc) {
            const o = byDesc[desc];
            return {
                description: desc,
                times: o.count,
                total_points: o.total,
                avg_points: o.count > 0 ? Math.round((o.total / o.count) * 10) / 10 : 0
            };
        }).sort(function (a, b) { return b.total_points - a.total_points; });
        const total_count = list.length;
        const total_points = list.reduce(function (sum, r) { return sum + Math.abs(parseInt(r.amount, 10) || 0); }, 0);
        const daily_totals = Object.keys(byDay).sort().map(function (d) {
            const o = byDay[d];
            return { date: d, total_points: o.total, count: o.count };
        });
        res.json({ stats, total_count, total_points, daily_totals, by_level });
    } catch (e) {
        console.error('GET /api/admin/points-usage-stats 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

const DESIGN_ACTION_WHITELIST = ['find_vendor', 'redesign_generate_ok', 'share_facebook', 'share_line', 'share_instagram', 'share_pinterest', 'share_copy_link'];

// POST /api/track-design-action — 記錄設計行為（找廠商訂製、再設計並生圖成功、社群分享）
app.post('/api/track-design-action', express.json(), async (req, res) => {
    try {
        const action = (req.body && req.body.action) ? String(req.body.action).trim() : '';
        if (DESIGN_ACTION_WHITELIST.indexOf(action) === -1) {
            return res.status(400).json({ error: '無效的 action' });
        }
        let userId = null;
        try {
            const authHeader = req.headers.authorization || req.headers['x-auth-token'];
            const token = authHeader && (authHeader.replace(/^\s*Bearer\s+/i, '') || authHeader);
            if (token) {
                const { data: { user } } = await supabase.auth.getUser(token);
                if (user && user.id) userId = user.id;
            }
        } catch (_) { /* 未登入不影響紀錄 */ }
        const { error } = await supabase.from('design_action_log').insert({ action, user_id: userId });
        if (error) {
            console.error('POST /api/track-design-action insert:', error);
            return res.status(500).json({ error: '寫入失敗' });
        }
        res.status(204).end();
    } catch (e) {
        console.error('POST /api/track-design-action:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// GET /api/admin/design-action-stats — 設計行為次數（供後台扣點統計頁）
app.get('/api/admin/design-action-stats', async (req, res) => {
    try {
        const user = await requireAdmin(req, res);
        if (!user) return;
        const fromDate = (req.query.from_date || '').trim() || null;
        const toDate = (req.query.to_date || '').trim() || null;
        let query = supabase.from('design_action_log').select('action, created_at').order('created_at', { ascending: false });
        if (fromDate) query = query.gte('created_at', fromDate);
        if (toDate) query = query.lte('created_at', toDate + (toDate.length <= 10 ? 'T23:59:59.999Z' : ''));
        const { data: rows, error } = await query.limit(100000);
        if (error) {
            console.error('GET /api/admin/design-action-stats:', error);
            return res.status(500).json({ error: '查詢失敗' });
        }
        const list = rows || [];
        const counts = { find_vendor: 0, redesign_generate_ok: 0, share_facebook: 0, share_line: 0, share_instagram: 0, share_pinterest: 0, share_copy_link: 0 };
        const byDay = {};
        list.forEach(function (r) {
            if (counts[r.action] != null) counts[r.action] += 1;
            const day = r.created_at ? r.created_at.slice(0, 10) : null;
            if (day) {
                if (!byDay[day]) byDay[day] = { find_vendor: 0, redesign_generate_ok: 0, share_facebook: 0, share_line: 0, share_instagram: 0, share_pinterest: 0, share_copy_link: 0 };
                if (byDay[day][r.action] != null) byDay[day][r.action] += 1;
            }
        });
        const daily_totals = Object.keys(byDay).sort().map(function (d) {
            const o = byDay[d];
            return { date: d, find_vendor: o.find_vendor, redesign_generate_ok: o.redesign_generate_ok, share_instagram: o.share_instagram, share_pinterest: o.share_pinterest, share_facebook: o.share_facebook, share_line: o.share_line, share_copy_link: o.share_copy_link };
        });
        res.json({
            find_vendor_count: counts.find_vendor,
            redesign_generate_ok_count: counts.redesign_generate_ok,
            share_instagram_count: counts.share_instagram,
            share_pinterest_count: counts.share_pinterest,
            share_facebook_count: counts.share_facebook,
            share_line_count: counts.share_line,
            share_copy_link_count: counts.share_copy_link,
            daily_totals
        });
    } catch (e) {
        console.error('GET /api/admin/design-action-stats 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// ---------- 點數與金流（需在 static 前） ----------
async function getCurrentUser(req, res) {
    const authHeader = req.headers.authorization || req.headers['x-auth-token'];
    const token = authHeader && (authHeader.replace(/^\s*Bearer\s+/i, '') || authHeader);
    if (!token) {
        res.status(401).json({ error: '請先登入' });
        return null;
    }
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
        res.status(401).json({ error: '登入已過期或無效' });
        return null;
    }
    return user;
}

// GET /api/me/credits — 查詢當前用戶點數餘額與近期紀錄
app.get('/api/me/credits', async (req, res) => {
    try {
        const user = await getCurrentUser(req, res);
        if (!user) return;
        const { data: credits, error: credErr } = await supabase
            .from('user_credits')
            .select('balance, total_earned, total_spent')
            .eq('user_id', user.id)
            .maybeSingle();
        if (credErr) {
            console.error('GET /api/me/credits:', credErr);
            return res.status(500).json({ error: '查詢點數失敗' });
        }
        const balance = credits ? credits.balance : 0;
        const total_earned = credits ? credits.total_earned : 0;
        const total_spent = credits ? credits.total_spent : 0;
        let transactions = [];
        try {
            const { data: tx } = await supabase
                .from('credit_transactions')
                .select('id, type, amount, balance_after, description, created_at')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(20);
            transactions = tx || [];
        } catch (_) { /* 表可能尚未建立 */ }
        res.json({ balance, total_earned, total_spent, transactions });
    } catch (e) {
        console.error('GET /api/me/credits 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// GET /api/me/subscription — 當前用戶有效訂閱與「到期前兩週」提醒
app.get('/api/me/subscription', async (req, res) => {
    try {
        const user = await getCurrentUser(req, res);
        if (!user) return; // getCurrentUser 已送 401，勿重複送
        const now = new Date();
        const { data: rows, error } = await supabase
            .from('user_subscriptions')
            .select('id, start_date, end_date, status, subscription_plans(name)')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .gt('end_date', now.toISOString())
            .order('end_date', { ascending: true });
        if (error) {
            console.error('GET /api/me/subscription:', error);
            return res.status(500).json({ error: '查詢訂閱失敗' });
        }
        const subscriptions = (rows || []).map(r => ({
            id: r.id,
            start_date: r.start_date,
            end_date: r.end_date,
            status: r.status,
            plan_name: (r.subscription_plans && r.subscription_plans.name) ? r.subscription_plans.name : null
        }));
        const twoWeeksFromNow = new Date(now);
        twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);
        let renewal_reminder = null;
        for (const sub of subscriptions) {
            const endDate = new Date(sub.end_date);
            if (endDate <= twoWeeksFromNow && endDate >= now) {
                const daysLeft = Math.ceil((endDate - now) / (24 * 60 * 60 * 1000));
                renewal_reminder = {
                    end_date: sub.end_date,
                    plan_name: sub.plan_name || '年付方案',
                    days_left: daysLeft
                };
                break;
            }
        }
        res.json({ subscriptions, renewal_reminder });
    } catch (e) {
        console.error('GET /api/me/subscription 異常:', e);
        if (!res.headersSent) res.status(500).json({ error: '系統錯誤' });
    }
});

// POST /api/credits/consume — 扣點（例如 AI 服務）
app.post('/api/credits/consume', express.json(), async (req, res) => {
    try {
        const user = await getCurrentUser(req, res);
        if (!user) return;
        const body = req.body || {};
        const amount = Math.abs(parseInt(body.amount, 10) || 0);
        const reason = (body.reason || body.description || '消費').toString().trim();
        if (amount <= 0) return res.status(400).json({ error: '請填寫有效扣點數量' });
        const { data: row, error: fetchErr } = await supabase
            .from('user_credits')
            .select('balance')
            .eq('user_id', user.id)
            .maybeSingle();
        if (fetchErr) {
            console.error('POST /api/credits/consume fetch:', fetchErr);
            return res.status(500).json({ error: '查詢點數失敗' });
        }
        const current = (row && row.balance) ? row.balance : 0;
        if (current < amount) return res.status(400).json({ error: '點數不足', balance: current });
        const balanceAfter = current - amount;
        const updates = { balance: balanceAfter, total_spent: (row ? (row.total_spent || 0) : 0) + amount, updated_at: new Date().toISOString() };
        if (!row) {
            const { error: insErr } = await supabase.from('user_credits').insert({
                user_id: user.id,
                balance: balanceAfter,
                total_earned: 0,
                total_spent: amount,
                updated_at: updates.updated_at
            });
            if (insErr) {
                console.error('POST /api/credits/consume insert:', insErr);
                return res.status(500).json({ error: '扣點失敗' });
            }
        } else {
            const { error: upErr } = await supabase.from('user_credits').update(updates).eq('user_id', user.id);
            if (upErr) {
                console.error('POST /api/credits/consume update:', upErr);
                return res.status(500).json({ error: '扣點失敗' });
            }
        }
        await supabase.from('credit_transactions').insert({
            user_id: user.id,
            type: 'consumed',
            amount: -amount,
            balance_after: balanceAfter,
            source: 'ai_service',
            description: reason,
            metadata: body.metadata || {}
        });
        res.json({ success: true, balance_after: balanceAfter });
    } catch (e) {
        console.error('POST /api/credits/consume 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// 綠界 CheckMacValue（SHA256：HashKey + 參數字串 + HashIV，URL encode 後小寫再 SHA256 大寫）
function ecpayCheckMacValue(params, hashKey, hashIV) {
    const exclude = ['CheckMacValue'];
    const pairs = Object.keys(params)
        .filter(k => !exclude.includes(k) && params[k] !== undefined && params[k] !== '')
        .sort()
        .map(k => k + '=' + params[k]);
    const dataStr = pairs.join('&');
    const beforeHash = hashKey + dataStr + hashIV;
    const encoded = encodeURIComponent(beforeHash).toLowerCase().replace(/%20/g, '+');
    return crypto.createHash('sha256').update(encoded).digest('hex').toUpperCase();
}

// POST /api/payment/ecpay/create — 建立綠界訂單，回傳自動送出表單的 HTML
app.post('/api/payment/ecpay/create', express.json(), async (req, res) => {
    try {
        const user = await getCurrentUser(req, res);
        if (!user) return;
        const config = await getPaymentConfig();
        const ecpay = config.ecpay;
        if (!ecpay.hashKey || !ecpay.hashIV) {
            return res.status(503).json({
                error: '綠界金流尚未設定',
                hint: '請至後台「金流設定」或 .env 填寫 ECPAY_HASH_KEY、ECPAY_HASH_IV。測試用可至綠界測試後台登入取得：' + ECPAY_TEST_STAGE
            });
        }
        const body = req.body || {};
        const amount = Math.abs(parseInt(body.amount, 10) || 0);
        const credits = Math.abs(parseInt(body.credits, 10) || 0);
        if (amount <= 0 || credits <= 0) return res.status(400).json({ error: '請填寫金額與點數' });
        const billing = (body.billing || '').toLowerCase();
        const planKey = body.plan && String(body.plan).trim() ? String(body.plan).trim() : null;
        const isYearly = billing === 'yearly' && planKey;
        const orderId = 'EC' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
        const insertPayload = {
            order_id: orderId,
            user_id: user.id,
            provider: 'ecpay',
            amount,
            currency: 'TWD',
            credits_to_grant: credits,
            status: 'pending'
        };
        if (isYearly) {
            insertPayload.order_type = 'yearly';
            insertPayload.metadata = { plan_key: planKey };
        }
        const { data: orderRow, error: orderErr } = await supabase
            .from('payment_orders')
            .insert(insertPayload)
            .select('id')
            .single();
        if (orderErr) {
            console.error('payment_orders insert:', orderErr);
            return res.status(500).json({ error: '建立訂單失敗' });
        }
        const tradeDate = new Date();
        const tradeDateStr = tradeDate.getFullYear() + '/' +
            String(tradeDate.getMonth() + 1).padStart(2, '0') + '/' +
            String(tradeDate.getDate()).padStart(2, '0') + ' ' +
            String(tradeDate.getHours()).padStart(2, '0') + ':' +
            String(tradeDate.getMinutes()).padStart(2, '0') + ':' +
            String(tradeDate.getSeconds()).padStart(2, '0');
        const returnBase = (process.env.BASE_URL || BASE_URL || '').replace(/\/$/, '');
        const params = {
            MerchantID: ecpay.merchantID,
            MerchantTradeNo: orderId,
            MerchantTradeDate: tradeDateStr,
            PaymentType: 'aio',
            TotalAmount: amount,
            TradeDesc: '點數儲值',
            ItemName: credits + ' 點數',
            ReturnURL: ecpay.notifyURL,
            ChoosePayment: 'ALL',
            NeedExtraPaidInfo: 'N',
            ClientBackURL: returnBase + '/payment/return.html?order_id=' + encodeURIComponent(orderId),
            EncryptType: 1
        };
        params.CheckMacValue = ecpayCheckMacValue(params, ecpay.hashKey, ecpay.hashIV);
        const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"/></head><body><form id="ecpayForm" method="POST" action="' + ecpay.apiURL + '">' +
            Object.keys(params).map(k => '<input type="hidden" name="' + k + '" value="' + String(params[k]).replace(/"/g, '&quot;') + '"/>').join('') +
            '</form><script>document.getElementById("ecpayForm").submit();</script></body></html>';
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
    } catch (e) {
        console.error('POST /api/payment/ecpay/create 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// POST /api/payment/ecpay/create-subscription — 綠界信用卡定期定額（月訂閱）
app.post('/api/payment/ecpay/create-subscription', express.json(), async (req, res) => {
    try {
        const user = await getCurrentUser(req, res);
        if (!user) return;
        const config = await getPaymentConfig();
        const ecpay = config.ecpay;
        if (!ecpay.hashKey || !ecpay.hashIV) {
            return res.status(503).json({
                error: '綠界金流尚未設定',
                hint: '請至後台「金流設定」或 .env 填寫 ECPAY_HASH_KEY、ECPAY_HASH_IV。'
            });
        }
        const body = req.body || {};
        const amount = Math.abs(parseInt(body.amount, 10) || 0);
        const credits = Math.abs(parseInt(body.credits, 10) || 0);
        if (amount <= 0 || credits <= 0) return res.status(400).json({ error: '請填寫月付金額與每期點數' });
        const orderId = 'ECP' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
        const { error: orderErr } = await supabase
            .from('payment_orders')
            .insert({
                order_id: orderId,
                user_id: user.id,
                provider: 'ecpay',
                amount,
                currency: 'TWD',
                credits_to_grant: credits,
                status: 'pending',
                order_type: 'subscription'
            })
            .select('id')
            .single();
        if (orderErr) {
            console.error('payment_orders insert subscription:', orderErr);
            return res.status(500).json({ error: '建立訂閱訂單失敗' });
        }
        const tradeDate = new Date();
        const tradeDateStr = tradeDate.getFullYear() + '/' +
            String(tradeDate.getMonth() + 1).padStart(2, '0') + '/' +
            String(tradeDate.getDate()).padStart(2, '0') + ' ' +
            String(tradeDate.getHours()).padStart(2, '0') + ':' +
            String(tradeDate.getMinutes()).padStart(2, '0') + ':' +
            String(tradeDate.getSeconds()).padStart(2, '0');
        const returnBase = (process.env.BASE_URL || BASE_URL || '').replace(/\/$/, '');
        const periodNotifyURL = returnBase + '/api/payment/notify-period';
        const params = {
            MerchantID: ecpay.merchantID,
            MerchantTradeNo: orderId,
            MerchantTradeDate: tradeDateStr,
            PaymentType: 'aio',
            TotalAmount: amount,
            TradeDesc: '月訂閱定期定額',
            ItemName: credits + ' 點/月',
            ReturnURL: ecpay.notifyURL,
            ChoosePayment: 'Credit',
            NeedExtraPaidInfo: 'N',
            ClientBackURL: returnBase + '/payment/return.html?order_id=' + encodeURIComponent(orderId),
            EncryptType: 1,
            PeriodAmount: amount,
            PeriodType: 'M',
            Frequency: 1,
            ExecTimes: 12,
            PeriodReturnURL: periodNotifyURL
        };
        params.CheckMacValue = ecpayCheckMacValue(params, ecpay.hashKey, ecpay.hashIV);
        const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"/></head><body><form id="ecpayForm" method="POST" action="' + ecpay.apiURL + '">' +
            Object.keys(params).map(k => '<input type="hidden" name="' + k + '" value="' + String(params[k]).replace(/"/g, '&quot;') + '"/>').join('') +
            '</form><script>document.getElementById("ecpayForm").submit();</script></body></html>';
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
    } catch (e) {
        console.error('POST /api/payment/ecpay/create-subscription 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// POST /api/payment/notify — 綠界付款結果回調（表單 application/x-www-form-urlencoded）
app.post('/api/payment/notify', express.urlencoded({ extended: true }), async (req, res) => {
    try {
        const body = req.body || {};
        const receivedMac = body.CheckMacValue;
        if (!receivedMac) {
            return res.status(400).send('0|缺少 CheckMacValue');
        }
        const config = await getPaymentConfig();
        const ecpay = config.ecpay;
        if (!ecpay.hashKey || !ecpay.hashIV) {
            return res.status(500).send('0|設定錯誤');
        }
        const computed = ecpayCheckMacValue(body, ecpay.hashKey, ecpay.hashIV);
        if (computed !== receivedMac) {
            console.error('ECPay CheckMacValue 驗證失敗');
            return res.status(400).send('0|CheckMacValue 錯誤');
        }
        const orderId = body.MerchantTradeNo;
        const rtnCode = parseInt(body.RtnCode, 10);
        // 付款失敗：僅更新訂單為 failed，不入點、不建立訂閱
        if (rtnCode !== 1) {
            await supabase.from('payment_orders').update({
                status: 'failed',
                raw_callback: body
            }).eq('order_id', orderId);
            return res.send('1|OK');
        }
        const { data: order, error: ordErr } = await supabase
            .from('payment_orders')
            .select('id, user_id, credits_to_grant, status, order_type, metadata')
            .eq('order_id', orderId)
            .single();
        if (ordErr || !order) {
            console.error('payment_orders select:', ordErr);
            return res.send('1|OK');
        }
        if (order.status === 'paid') {
            return res.send('1|OK');
        }
        // 以下僅在「付款成功」時執行：更新訂單為 paid，再依條件入點／建立年付訂閱
        const paidAt = new Date().toISOString();
        await supabase.from('payment_orders').update({
            status: 'paid',
            external_id: body.TradeNo,
            raw_callback: body,
            paid_at: paidAt
        }).eq('order_id', orderId);
        if (body.SimulatePaid === '1') {
            return res.send('1|OK');
        }
        // 非模擬付款：入點（點數僅在實際付款成功後更新）
        const credits = order.credits_to_grant;
        const { data: cred } = await supabase.from('user_credits').select('balance, total_earned, total_spent').eq('user_id', order.user_id).maybeSingle();
        const balanceBefore = (cred && cred.balance) ? cred.balance : 0;
        const balanceAfter = balanceBefore + credits;
        const totalEarned = (cred && cred.total_earned) ? cred.total_earned + credits : credits;
        const totalSpent = cred ? (cred.total_spent || 0) : 0;
        if (cred) {
            await supabase.from('user_credits').update({
                balance: balanceAfter,
                total_earned: totalEarned,
                updated_at: paidAt
            }).eq('user_id', order.user_id);
        } else {
            await supabase.from('user_credits').insert({
                user_id: order.user_id,
                balance: balanceAfter,
                total_earned: totalEarned,
                total_spent: 0,
                updated_at: paidAt
            });
        }
        await supabase.from('credit_transactions').insert({
            user_id: order.user_id,
            type: 'purchase',
            amount: credits,
            balance_after: balanceAfter,
            source: 'purchase',
            description: order.order_type === 'subscription' ? '綠界月訂閱' : '綠界儲值',
            metadata: { order_id: orderId, provider: 'ecpay' }
        });
        if (order.order_type === 'yearly' && order.metadata && order.metadata.plan_key) {
            const planKey = order.metadata.plan_key;
            const { data: plan } = await supabase.from('subscription_plans').select('id').eq('plan_key', planKey).maybeSingle();
            if (plan) {
                const start = new Date();
                const end = new Date(start);
                end.setFullYear(end.getFullYear() + 1);
                await supabase.from('user_subscriptions').insert({
                    user_id: order.user_id,
                    plan_id: plan.id,
                    start_date: start.toISOString(),
                    end_date: end.toISOString(),
                    status: 'active',
                    auto_renew: false
                });
            }
        }
        res.send('1|OK');
    } catch (e) {
        console.error('POST /api/payment/notify 異常:', e);
        res.status(500).send('0|Exception');
    }
});

// POST /api/payment/notify-period — 綠界定期定額每期扣款結果（PeriodReturnURL，見 5631）
app.post('/api/payment/notify-period', express.urlencoded({ extended: true }), async (req, res) => {
    try {
        const body = req.body || {};
        const receivedMac = body.CheckMacValue;
        if (!receivedMac) return res.status(400).send('0|缺少 CheckMacValue');
        const config = await getPaymentConfig();
        const ecpay = config.ecpay;
        if (!ecpay.hashKey || !ecpay.hashIV) return res.status(500).send('0|設定錯誤');
        const computed = ecpayCheckMacValue(body, ecpay.hashKey, ecpay.hashIV);
        if (computed !== receivedMac) {
            console.error('ECPay notify-period CheckMacValue 驗證失敗');
            return res.status(400).send('0|CheckMacValue 錯誤');
        }
        const rtnCode = parseInt(body.RtnCode, 10);
        // 該期失敗或模擬付款：不入點（定期定額失敗時綠界不撥款，該期不發點數）
        if (rtnCode !== 1) return res.send('1|OK');
        if (body.SimulatePaid === '1') return res.send('1|OK');
        const orderId = body.MerchantTradeNo;
        const periodIndex = String(body.TotalSuccessTimes || body.total_success_times || '');
        const { data: order, error: ordErr } = await supabase
            .from('payment_orders')
            .select('id, user_id, credits_to_grant, order_type')
            .eq('order_id', orderId)
            .single();
        if (ordErr || !order || order.order_type !== 'subscription') return res.send('1|OK');
        const { data: existing } = await supabase
            .from('credit_transactions')
            .select('id')
            .eq('user_id', order.user_id)
            .contains('metadata', { order_id: orderId, period_index: periodIndex })
            .limit(1)
            .maybeSingle();
        if (existing) return res.send('1|OK');
        const credits = order.credits_to_grant;
        const paidAt = new Date().toISOString();
        const { data: cred } = await supabase.from('user_credits').select('balance, total_earned').eq('user_id', order.user_id).maybeSingle();
        const balanceBefore = (cred && cred.balance) ? cred.balance : 0;
        const balanceAfter = balanceBefore + credits;
        const totalEarned = (cred && cred.total_earned) ? cred.total_earned + credits : credits;
        if (cred) {
            await supabase.from('user_credits').update({
                balance: balanceAfter,
                total_earned: totalEarned,
                updated_at: paidAt
            }).eq('user_id', order.user_id);
        } else {
            await supabase.from('user_credits').insert({
                user_id: order.user_id,
                balance: balanceAfter,
                total_earned: totalEarned,
                total_spent: 0,
                updated_at: paidAt
            });
        }
        await supabase.from('credit_transactions').insert({
            user_id: order.user_id,
            type: 'purchase',
            amount: credits,
            balance_after: balanceAfter,
            source: 'purchase',
            description: '綠界月訂閱（定期扣款）',
            metadata: { order_id: orderId, provider: 'ecpay', period_index: periodIndex }
        });
        res.send('1|OK');
    } catch (e) {
        console.error('POST /api/payment/notify-period 異常:', e);
        res.status(500).send('0|Exception');
    }
});

// PayPal 金流：依 getPaymentConfig() 動態建立 client（後台或 .env 設定）
function getPayPalClient(paypalConfig) {
    if (!paypalConfig || !paypalConfig.clientId || !paypalConfig.clientSecret) return null;
    try {
        const paypal = require('@paypal/checkout-server-sdk');
        const env = paypalConfig.sandbox
            ? new paypal.core.SandboxEnvironment(paypalConfig.clientId, paypalConfig.clientSecret)
            : new paypal.core.LiveEnvironment(paypalConfig.clientId, paypalConfig.clientSecret);
        return new paypal.core.PayPalHttpClient(env);
    } catch (_) {
        return null;
    }
}

// POST /api/payment/paypal/create — 建立 PayPal 訂單，回傳 approval_url
app.post('/api/payment/paypal/create', express.json(), async (req, res) => {
    try {
        const user = await getCurrentUser(req, res);
        if (!user) return;
        const config = await getPaymentConfig();
        const paypalClient = getPayPalClient(config.paypal);
        if (!paypalClient) {
            return res.status(503).json({
                error: 'PayPal 金流尚未設定',
                hint: '請至後台「金流設定」或 .env 填寫 PAYPAL_CLIENT_ID、PAYPAL_CLIENT_SECRET。測試用 Sandbox 帳號：' + PAYPAL_DEV_DOC
            });
        }
        const body = req.body || {};
        const amount = Math.abs(parseFloat(body.amount) || 0);
        const credits = Math.abs(parseInt(body.credits, 10) || 0);
        if (amount <= 0 || credits <= 0) return res.status(400).json({ error: '請填寫金額與點數' });
        const billing = (body.billing || '').toLowerCase();
        const planKey = body.plan && String(body.plan).trim() ? String(body.plan).trim() : null;
        const isYearly = billing === 'yearly' && planKey;
        const orderId = 'PP' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
        const insertPayload = {
            order_id: orderId,
            user_id: user.id,
            provider: 'paypal',
            amount: Math.round(amount),
            currency: 'USD',
            credits_to_grant: credits,
            status: 'pending'
        };
        if (isYearly) {
            insertPayload.order_type = 'yearly';
            insertPayload.metadata = { plan_key: planKey };
        }
        const { error: orderErr } = await supabase.from('payment_orders').insert(insertPayload);
        if (orderErr) {
            console.error('payment_orders insert:', orderErr);
            return res.status(500).json({ error: '建立訂單失敗' });
        }
        const paypal = require('@paypal/checkout-server-sdk');
        const baseUrl = (process.env.BASE_URL || BASE_URL || '').replace(/\/$/, '') || ('http://localhost:' + (process.env.PORT || 3000));
        const request = new paypal.orders.OrdersCreateRequest();
        request.prefer('return=representation');
        request.requestBody({
            intent: 'CAPTURE',
            purchase_units: [{
                reference_id: orderId,
                amount: { currency_code: 'USD', value: amount.toFixed(2) },
                description: credits + ' credits'
            }],
            application_context: {
                return_url: baseUrl + '/payment/return.html?provider=paypal&order_id=' + encodeURIComponent(orderId),
                cancel_url: baseUrl + '/payment/return.html?provider=paypal&cancel=1'
            }
        });
        const response = await paypalClient.execute(request);
        const approvalUrl = response.result.links && response.result.links.find(l => l.rel === 'approve');
        if (!approvalUrl || !approvalUrl.href) {
            return res.status(500).json({ error: '無法取得 PayPal 付款連結' });
        }
        await supabase.from('payment_orders').update({ external_id: response.result.id }).eq('order_id', orderId);
        res.json({ approval_url: approvalUrl.href, order_id: orderId });
    } catch (e) {
        console.error('POST /api/payment/paypal/create 異常:', e);
        res.status(500).json({ error: e.message || '系統錯誤' });
    }
});

// POST /api/payment/paypal/capture — 用戶從 PayPal 返回後帶 token 來完成請款並入點
app.post('/api/payment/paypal/capture', express.json(), async (req, res) => {
    try {
        const user = await getCurrentUser(req, res);
        if (!user) return;
        const token = (req.body || {}).token || req.query.token;
        if (!token) return res.status(400).json({ error: '缺少 token' });
        const config = await getPaymentConfig();
        const paypalClient = getPayPalClient(config.paypal);
        if (!paypalClient) return res.status(503).json({ error: 'PayPal 金流尚未設定' });
        const paypal = require('@paypal/checkout-server-sdk');
        const request = new paypal.orders.OrdersCaptureRequest(token);
        request.requestBody({});
        const response = await paypalClient.execute(request);
        const paypalOrderId = response.result.id;
        const refId = (response.result.purchase_units && response.result.purchase_units[0] && response.result.purchase_units[0].reference_id) || '';
        const { data: order, error: ordErr } = await supabase
            .from('payment_orders')
            .select('id, user_id, credits_to_grant, status, order_type, metadata')
            .eq('external_id', paypalOrderId)
            .eq('provider', 'paypal')
            .single();
        if (ordErr || !order || order.user_id !== user.id) {
            return res.status(404).json({ error: '找不到對應訂單' });
        }
        if (order.status === 'paid') {
            const { data: c } = await supabase.from('user_credits').select('balance').eq('user_id', user.id).maybeSingle();
            return res.json({ success: true, balance_after: (c && c.balance) ? c.balance : 0 });
        }
        const credits = order.credits_to_grant;
        const paidAt = new Date().toISOString();
        await supabase.from('payment_orders').update({ status: 'paid', paid_at: paidAt }).eq('id', order.id);
        const { data: cred } = await supabase.from('user_credits').select('balance, total_earned, total_spent').eq('user_id', user.id).maybeSingle();
        const balanceBefore = (cred && cred.balance) ? cred.balance : 0;
        const balanceAfter = balanceBefore + credits;
        const totalEarned = (cred && cred.total_earned) ? cred.total_earned + credits : credits;
        if (cred) {
            await supabase.from('user_credits').update({
                balance: balanceAfter,
                total_earned: totalEarned,
                updated_at: paidAt
            }).eq('user_id', user.id);
        } else {
            await supabase.from('user_credits').insert({
                user_id: user.id,
                balance: balanceAfter,
                total_earned: totalEarned,
                total_spent: 0,
                updated_at: paidAt
            });
        }
        await supabase.from('credit_transactions').insert({
            user_id: user.id,
            type: 'purchase',
            amount: credits,
            balance_after: balanceAfter,
            source: 'purchase',
            description: 'PayPal 儲值',
            metadata: { order_id: refId, provider: 'paypal' }
        });
        if (order.order_type === 'yearly' && order.metadata && order.metadata.plan_key) {
            const planKey = order.metadata.plan_key;
            const { data: plan } = await supabase.from('subscription_plans').select('id').eq('plan_key', planKey).maybeSingle();
            if (plan) {
                const start = new Date();
                const end = new Date(start);
                end.setFullYear(end.getFullYear() + 1);
                await supabase.from('user_subscriptions').insert({
                    user_id: order.user_id,
                    plan_id: plan.id,
                    start_date: start.toISOString(),
                    end_date: end.toISOString(),
                    status: 'active',
                    auto_renew: false
                });
            }
        }
        res.json({ success: true, balance_after: balanceAfter });
    } catch (e) {
        console.error('POST /api/payment/paypal/capture 異常:', e);
        res.status(500).json({ error: e.message || '系統錯誤' });
    }
});

app.use(express.static(path.join(__dirname, 'public')));
// 避免瀏覽器請求 /favicon.ico 時 404（若專案有 favicon 請放在 public/img/favicon.ico，並在頁面用 <link href="/img/favicon.ico" rel="icon">）
app.get('/favicon.ico', (req, res) => {
    const faviconPath = path.join(__dirname, 'public', 'img', 'favicon.ico');
    if (fs.existsSync(faviconPath)) return res.sendFile(faviconPath);
    res.status(204).end();
});
// 錯誤連結修正：/public/custom/* → /custom/*
app.get(/^\/public\/custom\/?(.*)$/, (req, res) => {
    const rest = (req.path.match(/^\/public\/custom\/?(.*)$/) || [])[1] || '';
    res.redirect(302, '/custom' + (rest ? '/' + rest : ''));
});
app.use('/uploads', express.static(uploadDir));
// 提供 client 和 expert 目錄的靜態服務
app.use('/client', express.static(path.join(__dirname, 'client')));
app.use('/expert', express.static(path.join(__dirname, 'expert')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));
// 提供 js 和 config 目錄的靜態服務
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/config', express.static(path.join(__dirname, 'config')));

// 啟動時若分類為空，從預設 JSON 引導一次（主分類 ai_categories + 子分類 ai_subcategories）
async function bootstrapCategories() {
    try {
        const { data, error } = await supabase
            .from('ai_categories')
            .select('key')
            .limit(1);
        if (error) {
            console.warn('檢查分類時發生錯誤：', error.message);
            return;
        }
        if (!data || data.length === 0) {
            const defaultsPath = path.join(__dirname, 'public', 'config', 'ai-categories.defaults.json');
            if (fs.existsSync(defaultsPath)) {
                try {
                    const raw = JSON.parse(fs.readFileSync(defaultsPath, 'utf-8'));
                    const list = raw.categories || [];
                    if (!list.length) return;
                    const mainPayload = list.map(c => ({ key: c.key, name: c.name, prompt: c.prompt || '' }));
                    const { error: upErr } = await supabase.from('ai_categories').upsert(mainPayload, { onConflict: 'key' });
                    if (upErr) {
                        console.warn('匯入預設主分類失敗：', upErr.message);
                        return;
                    }
                    let subCount = 0;
                    for (const c of list) {
                        const subs = Array.isArray(c.sub) ? c.sub : [];
                        for (let i = 0; i < subs.length; i++) {
                            const name = subs[i];
                            const subKey = c.key + '__' + String(name).replace(/\s+/g, '_').slice(0, 100);
                            const { error: subErr } = await supabase.from('ai_subcategories').upsert(
                                { key: subKey, name, category_key: c.key, sort_order: i },
                                { onConflict: 'key' }
                            );
                            if (!subErr) subCount++;
                        }
                    }
                    console.log(`已從預設檔匯入 ${list.length} 筆主分類、${subCount} 筆子分類`);
                } catch (e) {
                    console.warn('讀取/解析預設分類檔失敗：', e.message);
                }
            }
        }
    } catch (e) {
        console.warn('啟動分類引導時發生例外：', e.message);
    }
}

// AI 辨識階段：僅回傳項目陣列
app.post('/api/ai-detect', upload.array('designImages', 10), async (req, res) => {
    try {
        const files = req.files || [];
        const userDescription = req.body.userDescription || '';
        
        // 至少要有圖片或描述其中之一
        if (!files.length && !userDescription) {
            return res.status(400).json({ error: '請至少上傳一張設計圖或填寫需求描述' });
        }
        
        let base64Image = null;
        if (files.length > 0) {
            base64Image = (files[0].buffer || Buffer.from('')).toString('base64');
        }
        
        // 首頁換分類會送 req.body.category（主分類 key）、req.body.subcategory（子分類名稱）
        // 依 category 從 ai_categories 讀取該筆的 prompt；僅在「查無該筆或 prompt 為空」時用下方 fallback，不會改寫 DB 已儲存的提示詞
        const STRUCTURED_PROMPT_TEMPLATE = `你是專業企業服務與設計顧問,具備視覺設計分析與商業空間評估能力。

【分析流程】
1. 如用戶提供空間/設計稿/產品照片或影片,識別:
   - 業態類型(餐飲/零售/辦公/工廠等)
   - 空間風格與現況
   - 品牌視覺需求(Logo/招牌/包裝等)
   - 數位資產(網站/App/影片/圖檔)

2. 依據所選子分類「{subcategory}」,結合圖像資訊,列出:
   - 人力服務(設計師/開發者/行銷人員)
   - 交付項目(稿件/檔案/成品數量)
   - 周期與修改次數

3. 輸出格式:JSON 陣列 [{"item_name":"項目名稱", "spec":"規格說明", "quantity":數量, "unit":"單位"}]
   - 單位:式/件/場/個/小時/天
   - quantity 必須為數字

【注意事項】
- 無圖片時提供該類別標準服務包
- 標註交付時程與修改制度
- 區分初稿/精修/定稿階段`;
        let categoryPrompt = STRUCTURED_PROMPT_TEMPLATE.replace(/\{subcategory\}/g, req.body.subcategory || '該類別');
        
        if (req.body.category) {
            try {
                const { data, error } = await supabase
                    .from('ai_categories')
                    .select('prompt')
                    .eq('key', req.body.category)
                    .limit(1);
                if (!error && data && data[0] && data[0].prompt) {
                    categoryPrompt = data[0].prompt; // 使用 DB 已儲存的完整提示詞，不改寫
                    if (req.body.subcategory) {
                        categoryPrompt = categoryPrompt.replace(/\{subcategory\}/g, req.body.subcategory);
                    } else {
                        categoryPrompt = categoryPrompt.replace(/\{subcategory\}/g, '該類別');
                    }
                }
                // 若未進入上列 if，表示 DB 無該分類或 prompt 為空，沿用 fallback categoryPrompt（已含 {subcategory} 替換）
            } catch (e) {
                console.warn('無法讀取分類提示詞:', e.message);
            }
        }
        
        const prompt = req.body.prompt || categoryPrompt;
        let customPrompt = prompt;
        
        // 加入用戶描述
        if (userDescription) {
            customPrompt += `\n\n用戶需求描述：${userDescription}`;
            customPrompt += `\n請根據以上描述${base64Image ? '和圖片' : ''}來分析項目。`;
        }
        
        if (req.body.item) {
            customPrompt += `\n請優先辨識與「${req.body.item}」相關的項目。`;
        }
        if (req.body.unit) {
            customPrompt += `\n請將單位統一為「${req.body.unit}」或常見工程單位。`;
        }
        if (req.body.qty) {
            customPrompt += `\n若可判斷，請將「${req.body.item || '指定項目'}」的數量設為 ${req.body.qty}。`;
        }
        // 建立專案記錄（保留上傳檔與表單摘要）
        let tags = [];
        try {
          if (req.body.subcategories) tags = JSON.parse(req.body.subcategories);
        } catch {}
        const title = req.body.category ? `專案-${req.body.category}` : '專案-未分類';
        let project_id = null;
        let owner_id = null;
        // 先解析 token 以取得 owner_id，供上傳路徑與建立專案使用
        let token = null;
        if (req.headers.authorization) {
            token = req.headers.authorization.replace(/^\s*Bearer\s+/i, '');
        } else if (req.headers['x-auth-token']) {
            token = req.headers['x-auth-token'];
        }
        if (token) {
            try {
                const { data: { user }, error: authError } = await supabase.auth.getUser(token);
                if (!authError && user) owner_id = user.id;
            } catch (e) {}
        }
        let filesInfo = [];
        if (files.length > 0) {
            const pathPrefix = owner_id ? String(owner_id).replace(/-/g, '') : 'anon';
            for (const f of files) {
                try {
                    const { publicUrl } = await uploadToSupabaseStorage('project-images', pathPrefix, f);
                    filesInfo.push({ filename: f.originalname || 'image', url: publicUrl });
                } catch (e) {
                    console.warn('上傳至 Storage 失敗:', e.message);
                }
            }
        }
        if (owner_id) {
            try {
                // 收集動態欄位（優先使用 JSON 格式）
                let dynamicFields = {};
                if (req.body.dynamic_fields_json) {
                    try {
                        dynamicFields = JSON.parse(req.body.dynamic_fields_json);
                    } catch (e) {
                        console.warn('無法解析 dynamic_fields_json');
                    }
                }
                
                // 使用 SERVICE_ROLE_KEY 繞過 RLS
                const supabaseAdmin = createClient(
                    process.env.SUPABASE_URL,
                    process.env.SUPABASE_SERVICE_ROLE_KEY
                );
                
                const { data: projectInserted, error: insertError } = await supabaseAdmin
                    .from('projects')
                    .insert({
                        owner_id,
                        title,
                        description: JSON.stringify({ 
                            prompt, 
                            files: filesInfo,
                            subcategory: tags,
                            dynamic_fields: dynamicFields
                        }),
                        status: 'draft',
                        category: req.body.category || null,
                        subcategory: tags.length > 0 ? tags : null,
                        project_location: req.body.projectLocation ? [req.body.projectLocation] : []
                    })
                    .select('id')
                    .single();
                    
                if (!insertError && projectInserted && projectInserted.id) {
                    project_id = projectInserted.id;
                } else if (insertError) {
                    console.error('創建專案失敗:', insertError.message);
                }
            } catch (e) {
                console.error('創建專案例外:', e);
            }
        }

        // 構建 AI 請求內容
        const parts = [{ text: customPrompt }];
        if (base64Image) {
            parts.push({ inlineData: { mimeType: "image/jpeg", data: base64Image } });
        }
        
        const modelName = await getReadModelName();
        const result = await runInGeminiQueue(() => genAI.models.generateContent({
            model: modelName,
            contents: [{ role: 'user', parts }]
        }));
        const text = (result && result.text != null ? String(result.text) : '') || '';
        let items = [];
        try {
            // 支援 AI 回傳陣列或物件
            if (text.trim().startsWith('[')) {
                items = JSON.parse(text);
            } else {
                const aiResult = JSON.parse(text);
                items = aiResult.items || [];
            }
        } catch (e) {
            // 嘗試用正則抓取 JSON 區塊
            const match = text.match(/\[.*\]/s);
            if (match) {
                try {
                    items = JSON.parse(match[0]);
                } catch (e2) {
                    return res.status(500).json({ error: 'AI 回傳格式錯誤', raw: text, prompt: customPrompt });
                }
            } else {
                return res.status(500).json({ error: 'AI 回傳格式錯誤', raw: text, prompt: customPrompt });
            }
        }
        res.json({ success: true, project_id, items, uploaded_files: filesInfo });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: '系統忙碌中，請稍後再試' });
    }
});

// 估價階段：接收前端編輯後的項目陣列
app.post('/api/quote', express.json(), async (req, res) => {
    try {
        const items = req.body.items || [];
        let finalQuote = [];
        let totalEstimate = 0;
        for (let item of items) {
            const { data: prices, error } = await supabase
                .from('price_library')
                .select('supplier_id, unit_price, item_name')
                .ilike('item_name', `%${item.item_name}%`)
                .limit(1);
            if (prices && prices.length > 0) {
                const price = prices[0].unit_price;
                const cost = price * item.quantity;
                totalEstimate += cost;
                finalQuote.push({
                    item: item.item_name,
                    spec: item.spec,
                    qty: item.quantity,
                    unit: item.unit,
                    matched_price: price,
                    subtotal: cost
                });
            } else {
                finalQuote.push({
                    item: item.item_name,
                    spec: item.spec,
                    qty: item.quantity,
                    unit: item.unit,
                    matched_price: "未找到報價",
                    subtotal: 0
                });
            }
        }
        res.json({ success: true, total: totalEstimate, details: finalQuote });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: '系統忙碌中，請稍後再試' });
    }
});
// 查詢專案（驗證資料庫保存）
app.get('/api/projects/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .eq('id', req.params.id)
            .limit(1);
        if (error) return res.status(500).json({ error: error.message });
        if (!data || !data.length) return res.status(404).json({ error: 'Not found' });
        res.json({ success: true, project: data[0] });
    } catch (e) {
        res.status(500).json({ error: '查詢失敗' });
    }
});
app.post('/api/analyze', upload.array('designImages', 10), async (req, res) => {
    try {
        const files = req.files || [];
        if (!files.length) return res.status(400).json({ error: '請至少上傳一張設計圖' });
        const base64Image = (files[0].buffer || Buffer.from('')).toString('base64');
        // 支援自訂 prompt、項目、單位
        const prompt = req.body.prompt || "你是一個專業的工程估算師。請分析這張設計圖，列出所有需要的施工項目。請嚴格輸出為 JSON 格式，包含: item_name (項目), spec (規格描述), quantity (數量), unit (單位: 坪/才/式/公尺)。請標準化項目名稱，例如統一使用 '超耐磨地板', '系統櫃', '油漆'。";
        // 若有指定項目/單位/數量，補充進 prompt
        let customPrompt = prompt;
        if (req.body.item) {
            customPrompt += `\n請優先辨識與「${req.body.item}」相關的項目。`;
        }
        if (req.body.unit) {
            customPrompt += `\n請將單位統一為「${req.body.unit}」或常見工程單位。`;
        }
        if (req.body.qty) {
            customPrompt += `\n若可判斷，請將「${req.body.item || '指定項目'}」的數量設為 ${req.body.qty}。`;
        }
        const modelName = await getReadModelName();
        const result = await runInGeminiQueue(() => genAI.models.generateContent({
            model: modelName,
            contents: [{ role: 'user', parts: [{ text: customPrompt }, { inlineData: { mimeType: 'image/jpeg', data: base64Image } }] }]
        }));
        const text = (result && result.text != null ? String(result.text) : '') || '';
        let aiResult;
        let items = [];
        try {
            aiResult = JSON.parse(text);
            items = aiResult.items || [];
        } catch (e) {
            // 嘗試用正則抓取 JSON 區塊
            const match = text.match(/\{[\s\S]*\}/);
            if (match) {
                try {
                    aiResult = JSON.parse(match[0]);
                    items = aiResult.items || [];
                } catch (e2) {
                    return res.status(500).json({ error: 'AI 回傳格式錯誤', raw: text, prompt: customPrompt });
                }
            } else {
                return res.status(500).json({ error: 'AI 回傳格式錯誤', raw: text, prompt: customPrompt });
            }
        }
        let finalQuote = [];
        let totalEstimate = 0;
        for (let item of items) {
            const { data: prices, error } = await supabase
                .from('price_library')
                .select('supplier_id, unit_price, item_name')
                .ilike('item_name', `%${item.item_name}%`)
                .limit(1);
            if (prices && prices.length > 0) {
                const price = prices[0].unit_price;
                const cost = price * item.quantity;
                totalEstimate += cost;
                finalQuote.push({
                    item: item.item_name,
                    spec: item.spec,
                    qty: item.quantity,
                    unit: item.unit,
                    matched_price: price,
                    subtotal: cost
                });
            } else {
                // 沒有報價也要列出
                finalQuote.push({
                    item: item.item_name,
                    spec: item.spec,
                    qty: item.quantity,
                    unit: item.unit,
                    matched_price: "未找到報價",
                    subtotal: 0
                });
            }
        }
        res.json({ success: true, total: totalEstimate, details: finalQuote });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: '系統忙碌中，請稍後再試' });
    }
});

// 站點選單（供前台載入與後台編輯）
app.get('/api/site-menu', (req, res) => {
    try {
        const cfgPath = path.join(__dirname, 'public', 'config', 'site-menu.json');
        const raw = fs.readFileSync(cfgPath, 'utf-8');
        // 防止快取，確保前台能立即讀到最新選單
        res.set('Cache-Control', 'no-store');
        res.json(JSON.parse(raw));
    } catch (e) {
        res.status(500).json({ items: [], error: '讀取失敗' });
    }
});
app.put('/api/site-menu', express.json(), (req, res) => {
    try {
        const items = Array.isArray(req.body.items) ? req.body.items : [];
        const cfgPath = path.join(__dirname, 'public', 'config', 'site-menu.json');
        fs.writeFileSync(cfgPath, JSON.stringify({ items }, null, 2), 'utf-8');
        res.json({ success: true, count: items.length });
    } catch (e) {
        res.status(500).json({ error: '寫入失敗' });
    }
});

// 後台：媒合標籤過濾詞（去尾字後相同即相符），由 /admin/tag-strip.html 管理
app.get('/api/admin/tag-strip-suffixes', (req, res) => {
    try {
        res.json({ suffixes: getTagStripSuffixes() });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
app.put('/api/admin/tag-strip-suffixes', express.json(), (req, res) => {
    try {
        const list = Array.isArray(req.body.suffixes) ? req.body.suffixes : [];
        const suffixes = list.map(w => (w || '').toString().trim()).filter(Boolean);
        const dir = path.dirname(tagStripSuffixesPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(tagStripSuffixesPath, JSON.stringify(suffixes, null, 2), 'utf-8');
        _tagStripSuffixesCache = null;
        res.json({ success: true, suffixes });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 取得 AI 分類（唯一來源：ai_categories + ai_subcategories，前後端同一組資料）
app.get('/api/categories', async (req, res) => {
    try {
        let mainRows = null;
        let mainError = null;
        const { data: mainData, error: mainErr } = await supabase.from('ai_categories').select('key, name, prompt, sort_order');
        mainRows = mainData;
        mainError = mainErr;
        if (mainError) {
            const { data: fallback } = await supabase.from('ai_categories').select('key, name, prompt');
            if (fallback && fallback.length > 0) {
                mainRows = fallback;
                mainError = null;
            }
        }
        const { data: subRows, error: subError } = await supabase
            .from('ai_subcategories')
            .select('key, name, category_key, form_config, sort_order');

        if (mainError || !mainRows) {
            console.warn('GET /api/categories ai_categories 讀取失敗:', mainError && mainError.message);
            return res.status(500).json({ error: '讀取分類失敗：' + (mainError ? mainError.message : '無資料') });
        }

        const mainList = Array.isArray(mainRows) ? mainRows : [];
        if (mainList.length && mainList[0].sort_order != null) {
            mainList.sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999));
        }
        const subByCategory = {};
        if (!subError && Array.isArray(subRows)) {
            subRows.forEach(s => {
                if (!subByCategory[s.category_key]) subByCategory[s.category_key] = [];
                subByCategory[s.category_key].push({ name: s.name, form_config: s.form_config || [], sort_order: s.sort_order });
            });
            Object.keys(subByCategory).forEach(k => subByCategory[k].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));
        }

        const categories = mainList.map(m => ({
            key: m.key,
            name: m.name,
            prompt: m.prompt || '',
            sort_order: m.sort_order != null ? m.sort_order : 0,
            sub: (subByCategory[m.key] || []).map(s => s.name),
            sub_configs: (subByCategory[m.key] || []).reduce((acc, s) => {
                acc[s.name] = Array.isArray(s.form_config) ? s.form_config : (s.form_config || {});
                return acc;
            }, {})
        }));

        res.set('Cache-Control', 'no-store');
        res.json({ categories, via: 'split-db' });
    } catch (e) {
        console.error('GET /api/categories 異常:', e);
        res.status(500).json({ error: '載入分類失敗：' + e.message });
    }
});

// 計價單位只依「該分類」從 DB 撈（相同分類的專家報價用什麼單位，發包端／專家端就用什麼選項，不硬編碼）
app.get('/api/listings/units-by-category', async (req, res) => {
    try {
        const category = req.query.category;
        if (!category) return res.status(400).json({ error: '請提供 query 參數 category' });
        const { data: rows, error } = await supabase
            .from('listings')
            .select('unit')
            .eq('category', category)
            .eq('status', 'active')
            .not('unit', 'is', null);
        if (error) return res.status(500).json({ error: error.message });
        const raw = (rows || []).map(r => (r.unit || '').trim()).filter(Boolean);
        const units = [...new Set(raw)].sort();
        res.json({ success: true, category, units });
    } catch (e) {
        res.status(500).json({ error: '取得單位列表失敗' });
    }
});

// 獲取子分類及其 form_config
app.get('/api/subcategories', async (req, res) => {
    try {
        const category_key = req.query.category_key;
        if (!category_key) {
            return res.status(400).json({ error: '缺少 category_key 參數' });
        }
        
        const { data: subRows, error } = await supabase
            .from('ai_subcategories')
            .select('key, name, category_key, form_config, sort_order')
            .eq('category_key', category_key)
            .order('sort_order', { ascending: true });
        
        if (error) {
            return res.status(500).json({ error: error.message });
        }
        
        const subcategories = (subRows || []).map(s => ({
            key: s.key,
            name: s.name,
            form_config: Array.isArray(s.form_config) ? s.form_config : []
        }));
        
        res.json({ success: true, subcategories });
    } catch (e) {
        res.status(500).json({ error: '獲取子分類失敗' });
    }
});

// 更新子分類的 form_config
app.post('/api/subcategories/update-config', express.json(), async (req, res) => {
    try {
        const { category_key, subcategory_name, form_config } = req.body;
        
        if (!category_key || !subcategory_name) {
            return res.status(400).json({ error: '缺少必要參數' });
        }
        
        // 根據 category_key 和 name 更新 form_config
        const { error } = await supabase
            .from('ai_subcategories')
            .update({ form_config: form_config || [] })
            .eq('category_key', category_key)
            .eq('name', subcategory_name);
        
        if (error) {
            return res.status(500).json({ error: error.message });
        }
        
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: '更新子分類配置失敗' });
    }
});

// 一鍵初始化居家子分類的 form_config（從 home-subcategory-form-fields.json 讀取）
// 【測試】查詢並強制插入/更新一筆測試資料
app.get('/api/test-first-subcat', async (req, res) => {
    try {
        // 1. 查詢總數
        const { count: totalCount } = await supabase
            .from('ai_subcategories')
            .select('*', { count: 'exact', head: true });
        
        // 2. 查詢 home 分類的資料
        const { data: homeData, error: selectError } = await supabase
            .from('ai_subcategories')
            .select('*')
            .eq('category_key', 'home')
            .limit(3);
        
        // 3. 嘗試插入一筆測試資料（如果不存在）
        const testKey = 'home__清潔服務';
        const testFields = [
            {"name":"area","label":"施作坪數","type":"number","unit":"坪","required":true,"placeholder":"請輸入坪數"},
            {"name":"clean_type","label":"清潔類型","type":"select","required":true,"options":["日常清潔","空屋細清"]},
            {"name":"floor_elevator","label":"樓層與電梯","type":"text","required":true}
        ];
        
        // 先嘗試更新
        const { data: updateResult, error: updateError } = await supabase
            .from('ai_subcategories')
            .update({ form_config: testFields })
            .eq('key', testKey)
            .select();
        
        let insertResult = null;
        let insertError = null;
        
        // 如果更新沒有影響任何行，嘗試插入
        if (!updateResult || updateResult.length === 0) {
            const insertData = await supabase
                .from('ai_subcategories')
                .insert({
                    key: testKey,
                    name: '清潔服務',
                    category_key: 'home',
                    form_config: testFields,
                    sort_order: 0
                })
                .select();
            
            insertResult = insertData.data;
            insertError = insertData.error;
        }
        
        // 4. 再次查詢確認
        const { data: afterData } = await supabase
            .from('ai_subcategories')
            .select('key, name, form_config')
            .eq('key', testKey)
            .single();
        
        res.json({ 
            success: true,
            total_count: totalCount,
            home_data_count: homeData ? homeData.length : 0,
            home_data_sample: homeData ? homeData.slice(0, 1) : null,
            update_test: {
                updated: updateResult && updateResult.length > 0,
                update_error: updateError ? updateError.message : null,
                insert_result: insertResult ? '已插入' : '未插入',
                insert_error: insertError ? insertError.message : null
            },
            after_operation: afterData
        });
    } catch (e) {
        res.status(500).json({ error: e.message, stack: e.stack });
    }
});

// 【測試】更新單一記錄
app.post('/api/test-update-one', express.json(), async (req, res) => {
    try {
        const { key, fields } = req.body;
        console.log(`[TEST-UPDATE] key=${key}, fields 數量=${fields ? fields.length : 'null'}`);
        console.log(`[TEST-UPDATE] fields=`, JSON.stringify(fields));
        
        const { data, error } = await supabase
            .from('ai_subcategories')
            .update({ form_config: fields })
            .eq('key', key)
            .select('key, name, form_config');
        
        console.log(`[TEST-UPDATE] 結果: data=${data ? data.length : 'null'}, error=${error ? error.message : 'null'}`);
        
        if (error) {
            return res.status(500).json({ error: error.message });
        }
        
        res.json({ success: true, updated: data && data.length > 0, data });
    } catch (e) {
        console.error('[TEST-UPDATE] 例外:', e);
        res.status(500).json({ error: e.message });
    }
});

// 【強制更新】居家子分類 form_config（直接寫入，不檢查）
app.post('/api/subcategories/force-init-home', async (req, res) => {
    try {
        const filePath = path.join(__dirname, 'docs', 'home-subcategory-form-fields.json');
        console.log('[FORCE-INIT] 讀取檔案:', filePath);
        
        const raw = fs.readFileSync(filePath, 'utf-8');
        console.log('[FORCE-INIT] 檔案長度:', raw.length);
        
        const json = JSON.parse(raw);
        console.log('[FORCE-INIT] JSON 解析成功, subcategories 數量:', json.subcategories ? json.subcategories.length : 'null');
        
        if (!json.subcategories || !Array.isArray(json.subcategories)) {
            return res.status(400).json({ error: '檔案格式錯誤', json });
        }
        
        let results = [];
        let index = 0;
        
        for (const sub of json.subcategories) {
            index++;
            console.log(`[FORCE-INIT ${index}/${json.subcategories.length}] 處理: ${sub.key}, 欄位數: ${sub.fields.length}`);
            
            try {
                // 強制更新（不檢查是否存在）
                const { data, error, count } = await supabase
                    .from('ai_subcategories')
                    .update({ form_config: sub.fields })
                    .eq('key', sub.key)
                    .select('key, name, form_config');
                
                console.log(`[FORCE-INIT ${index}] Supabase 回應: data=${data ? data.length : 'null'}, error=${error ? error.message : 'null'}`);
                
                if (error) {
                    console.error(`[FORCE-INIT ${index}] ERROR:`, error);
                    results.push({ key: sub.key, status: 'ERROR', message: error.message });
                } else if (data && data.length > 0) {
                    const updatedConfig = data[0].form_config;
                    console.log(`[FORCE-INIT ${index}] SUCCESS: ${sub.key}, 欄位數: ${updatedConfig ? updatedConfig.length : 0}`);
                    results.push({ 
                        key: sub.key, 
                        status: 'SUCCESS', 
                        fields_count: Array.isArray(updatedConfig) ? updatedConfig.length : 0
                    });
                } else {
                    console.warn(`[FORCE-INIT ${index}] NOT_FOUND: ${sub.key} (data 為空)`);
                    results.push({ key: sub.key, status: 'NOT_FOUND', message: '資料庫中不存在此 key' });
                }
            } catch (err) {
                console.error(`[FORCE-INIT ${index}] EXCEPTION:`, err);
                results.push({ key: sub.key, status: 'EXCEPTION', message: err.message });
            }
        }
        
        const successCount = results.filter(r => r.status === 'SUCCESS').length;
        console.log(`[FORCE-INIT] 完成！成功: ${successCount}/${json.subcategories.length}`);
        
        res.json({ 
            success: true,
            total: json.subcategories.length,
            success_count: successCount,
            results
        });
    } catch (e) {
        console.error('[FORCE-INIT] 失敗:', e);
        res.status(500).json({ error: e.message, stack: e.stack });
    }
});

app.post('/api/subcategories/init-home', async (req, res) => {
    try {
        const filePath = path.join(__dirname, 'docs', 'home-subcategory-form-fields.json');
        const raw = fs.readFileSync(filePath, 'utf-8');
        const json = JSON.parse(raw);
        
        if (!json.subcategories || !Array.isArray(json.subcategories)) {
            return res.status(400).json({ error: '檔案格式錯誤' });
        }
        
        let count = 0;
        let errors = [];
        
        for (const sub of json.subcategories) {
            console.log(`更新子分類: ${sub.key}, 欄位數: ${sub.fields.length}`);
            
            const { data, error } = await supabase
                .from('ai_subcategories')
                .update({ form_config: sub.fields })
                .eq('key', sub.key)
                .select();
            
            if (error) {
                console.error(`更新 ${sub.key} 失敗:`, error);
                errors.push(`${sub.key}: ${error.message}`);
            } else if (data && data.length > 0) {
                console.log(`✓ 已更新 ${sub.key}`);
                count++;
            } else {
                console.warn(`⚠ ${sub.key} 不存在於資料庫`);
                errors.push(`${sub.key}: 不存在`);
            }
        }
        
        res.json({ 
            success: true, 
            count, 
            total: json.subcategories.length,
            message: `已初始化 ${count}/${json.subcategories.length} 個居家子分類的必填欄位`,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (e) {
        console.error('初始化失敗:', e);
        res.status(500).json({ error: e.message });
    }
});

// 預覽一鍵匯入的內容（讀取 default-categories.json，不寫入 DB）
app.get('/api/categories/preview-default', (req, res) => {
    try {
        const filePath = path.join(__dirname, 'public', 'config', 'default-categories.json');
        const raw = fs.readFileSync(filePath, 'utf-8');
        const json = JSON.parse(raw);
        const list = Array.isArray(json.categories) ? json.categories : [];
        const summary = list.map(c => ({
            key: c.key,
            name: c.name,
            subCount: Array.isArray(c.sub) ? c.sub.length : 0
        }));
        res.set('Cache-Control', 'no-store');
        res.json({ categories: list, summary, message: '此為 default-categories.json 內容，一鍵匯入會寫入以上項目' });
    } catch (e) {
        res.status(500).json({ error: '讀取預設檔失敗：' + e.message });
    }
});

// 一鍵匯入預設分類（主分類 + 子分類；從 default-categories.json 讀取；保留 DB 已有提示詞不覆寫）
app.post('/api/categories/import-default', async (req, res) => {
    try {
        const filePath = path.join(__dirname, 'public', 'config', 'default-categories.json');
        const raw = fs.readFileSync(filePath, 'utf-8');
        const json = JSON.parse(raw);
        const list = Array.isArray(json.categories) ? json.categories : [];
        if (!list.length) return res.status(400).json({ error: '預設分類清單為空' });

        const keys = list.map(c => c.key).filter(Boolean);
        const { data: existingRows } = await supabase.from('ai_categories').select('key, prompt').in('key', keys);
        const existingByKey = {};
        if (Array.isArray(existingRows)) existingRows.forEach(r => { existingByKey[r.key] = r; });

        const mainPayload = list.map(c => {
            const existing = existingByKey[c.key];
            const prompt = (existing && existing.prompt && String(existing.prompt).trim()) ? existing.prompt : (c.prompt || '');
            return { key: c.key, name: c.name, prompt };
        });
        const { error: mainErr } = await supabase.from('ai_categories').upsert(mainPayload, { onConflict: 'key' });
        if (mainErr) {
            try { fs.writeFileSync(LOCAL_CATEGORIES_PATH, JSON.stringify({ categories: list }, null, 2), 'utf-8'); } catch {}
            res.set('Cache-Control', 'no-store');
            return res.json({ success: false, error: mainErr.message });
        }
        let subCount = 0;
        for (const c of list) {
            const subs = Array.isArray(c.sub) ? c.sub : [];
            for (let i = 0; i < subs.length; i++) {
                const item = subs[i];
                const subKey = (typeof item === 'object' && item != null && item.key != null)
                    ? String(item.key).slice(0, 200)
                    : (c.key + '__' + String(item).replace(/\s+/g, '_').slice(0, 100));
                const name = (typeof item === 'object' && item != null && item.name != null)
                    ? String(item.name)
                    : String(item);
                const { error: subErr } = await supabase.from('ai_subcategories').upsert(
                    { key: subKey, name, category_key: c.key, sort_order: i },
                    { onConflict: 'key' }
                );
                if (!subErr) subCount++;
            }
        }
        try { fs.writeFileSync(LOCAL_CATEGORIES_PATH, JSON.stringify({ categories: list }, null, 2), 'utf-8'); } catch {}
        res.set('Cache-Control', 'no-store');
        return res.json({ success: true, count: list.length, subCount, message: '已匯入；DB 內已有之主分類提示詞已保留未覆寫' });
    } catch (e) {
        res.status(500).json({ error: '匯入預設分類失敗' });
    }
});

// 更新分類（主分類 ai_categories + 子分類 ai_subcategories）
app.put('/api/categories', express.json(), async (req, res) => {
    try {
        const categories = Array.isArray(req.body.categories) ? req.body.categories : [];
        if (!categories.length) return res.status(400).json({ error: '無有效資料' });

        for (let idx = 0; idx < categories.length; idx++) {
            const cat = categories[idx];
            if (!cat.key || !String(cat.key).trim()) {
                console.warn('PUT /api/categories 略過 key 為空的主分類');
                continue;
            }
            // 1. 主分類寫入 ai_categories（含 sort_order）
            const { error: mainErr } = await supabase
                .from('ai_categories')
                .upsert({
                    key: cat.key.trim(),
                    name: (cat.name || '').trim(),
                    prompt: cat.prompt || '',
                    sort_order: cat.sort_order != null ? cat.sort_order : idx
                }, { onConflict: 'key' });

            if (mainErr) {
                console.warn('ai_categories upsert failed:', mainErr.message);
            }

            // 2. 子分類寫入 ai_subcategories（僅當前端有送 sub 陣列且非空時才覆寫；避免 sub 為空時誤刪全部子分類）
            if (cat.sub && Array.isArray(cat.sub) && cat.sub.length > 0) {
                const { data: existingSubs } = await supabase
                    .from('ai_subcategories')
                    .select('key, name, form_config')
                    .eq('category_key', cat.key);
                const existingByKey = {};
                const existingByName = {};
                if (existingSubs && existingSubs.length > 0) {
                    existingSubs.forEach(s => {
                        existingByKey[s.key] = s;
                        existingByName[s.name] = { key: s.key, form_config: s.form_config };
                    });
                    await supabase.from('ai_subcategories').delete().eq('category_key', cat.key);
                }
                const subPayload = cat.sub.map((subName, subIdx) => {
                    const existing = existingByName[subName];
                    const subKey = (existing && existing.key) ? existing.key : (cat.key + '__' + String(subName).replace(/\s+/g, '_').slice(0, 100));
                    const fromFront = cat.sub_configs && cat.sub_configs[subName];
                    const fromDb = existing && existing.form_config;
                    const form_config = fromFront !== undefined && fromFront !== null
                        ? fromFront
                        : (fromDb !== undefined && fromDb !== null ? fromDb : []);
                    return {
                        key: subKey,
                        name: subName,
                        category_key: cat.key,
                        form_config,
                        sort_order: subIdx
                    };
                });
                const { error: subErr } = await supabase.from('ai_subcategories').upsert(subPayload, { onConflict: 'key' });
                if (subErr) console.warn('ai_subcategories upsert failed:', subErr.message);
            }
        }

        res.json({ success: true, message: '分類資料已儲存', count: categories.length });
    } catch (e) {
        console.error('PUT /api/categories 異常:', e);
        res.status(500).json({ error: '儲存失敗：' + e.message });
    }
});

// 除錯：容器內路徑與首頁檔案是否存在（修好 File not found 後可刪或改為僅 NODE_ENV!==production）
app.get('/api/debug-path', (req, res) => {
    const p = path.join(__dirname, 'public');
    const idx = path.join(__dirname, 'public', 'iStudio-1.0.0', 'index.html');
    let list = [];
    try { list = fs.readdirSync(p); } catch (e) { list = [e.message]; }
    res.json({
        __dirname,
        cwd: process.cwd(),
        publicExists: fs.existsSync(p),
        indexExists: fs.existsSync(idx),
        indexPath: idx,
        publicDirContents: list,
    });
});

// 健康檢查（環境與資料庫對應狀態）
app.get('/api/health', async (req, res) => {
    const info = {
        env: {
            SUPABASE_URL: !!process.env.SUPABASE_URL,
            SUPABASE_KEY: !!process.env.SUPABASE_KEY,
            SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
            SUPABASE_DB_URL: !!process.env.SUPABASE_DB_URL
        },
        supabase: { ok: false },
        db: { ok: false },
    };
    try {
        const { data, error } = await supabase.from('ai_categories').select('key').limit(1);
        if (error) {
            info.supabase.error = error.message;
        } else {
            info.supabase.ok = true;
            info.supabase.count = Array.isArray(data) ? data.length : 0;
        }
    } catch (e) {
        info.supabase.error = e.message;
    }
    if (DB_URL) {
        try {
            const pool = new Pool({ connectionString: DB_URL });
            const client = await pool.connect();
            const r = await client.query('select to_regclass(\'public.ai_categories\') as exists, (select count(*) from public.ai_categories) as cnt');
            client.release();
            await pool.end();
            info.db.ok = !!r.rows[0].exists;
            info.db.count = r.rows[0].cnt || 0;
        } catch (e2) {
            info.db.error = e2.message;
        }
    }
    res.set('Cache-Control', 'no-store');
    res.json(info);
});

// 前台用公開設定（導航是否顯示服務媒合等，由 ENV 控制）
app.get('/api/public-config', (req, res) => {
    const enableServiceMatching = process.env.ENABLE_SERVICE_MATCHING !== 'false';
    res.set('Cache-Control', 'public, max-age=60');
    res.json({ enableServiceMatching });
});

// 一鍵匯入預設分類（主分類 + 子分類獨立表）
app.post('/api/categories/seed-defaults', async (req, res) => {
    try {
        const defaultsPath = path.join(__dirname, 'public', 'config', 'ai-categories.defaults.json');
        if (!fs.existsSync(defaultsPath)) {
            return res.status(404).json({ error: '找不到預設分類檔' });
        }
        const raw = JSON.parse(fs.readFileSync(defaultsPath, 'utf-8'));
        const list = raw.categories || [];
        if (!list.length) return res.status(400).json({ error: '預設檔無有效資料' });
        const mainPayload = list.map(c => ({ key: c.key, name: c.name, prompt: c.prompt || '' }));
        const { error: mainErr } = await supabase.from('ai_categories').upsert(mainPayload, { onConflict: 'key' });
        if (mainErr) return res.status(500).json({ error: mainErr.message });
        let subCount = 0;
        for (const c of list) {
            const subs = Array.isArray(c.sub) ? c.sub : [];
            for (let i = 0; i < subs.length; i++) {
                const name = subs[i];
                const subKey = c.key + '__' + String(name).replace(/\s+/g, '_').slice(0, 100);
                const { error: subErr } = await supabase.from('ai_subcategories').upsert(
                    { key: subKey, name, category_key: c.key, sort_order: i },
                    { onConflict: 'key' }
                );
                if (!subErr) subCount++;
            }
        }
        res.json({ success: true, count: list.length, subCount });
    } catch (e) {
        res.status(500).json({ error: '匯入預設分類失敗' });
    }
});

// ===== 客製產品 API =====

const BFL_BASE = 'https://api.bfl.ai';
const BFL_FLUX_PRO = BFL_BASE + '/v1/flux-2-pro';

/** Admin Playground 可用模型 → BFL path */
const BFL_PLAYGROUND_MODELS = {
    'flux-2-max': '/v1/flux-2-max',
    'flux-2-pro': '/v1/flux-2-pro',
    'flux-2-flex': '/v1/flux-2-flex',
    'flux-2-klein-9b': '/v1/flux-2-klein-9b',
    'flux-2-klein-4b': '/v1/flux-2-klein-4b'
};
function getBflPlaygroundEndpoint(model) {
    const path = BFL_PLAYGROUND_MODELS[model] || BFL_PLAYGROUND_MODELS['flux-2-pro'];
    return BFL_BASE + path;
}

/** 共用的 BFL 輪詢取圖：createData 含 polling_url，輪詢到 Ready 後下載 sample 回傳 Buffer */
async function pollBflResult(createData, BFL_API_KEY) {
    const pollingUrl = createData.polling_url;
    if (!pollingUrl) throw new Error('BFL 未回傳 polling_url');
    for (let i = 0; i < 120; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        const pollRes = await fetch(pollingUrl, {
            headers: { 'accept': 'application/json', 'x-key': BFL_API_KEY }
        });
        const pollData = await pollRes.json();
        if (pollData.status === 'Ready' && pollData.result && pollData.result.sample) {
            const imageRes = await fetch(pollData.result.sample);
            return Buffer.from(await imageRes.arrayBuffer());
        }
        if (pollData.status === 'Error' || pollData.status === 'Failed') {
            throw new Error(pollData.message || pollData.error || 'FLUX 生成失敗');
        }
    }
    throw new Error('FLUX 逾時');
}

/** FLUX 2.0 PRO 純文字生圖（Text-to-Image）。seed 可選；outputFormat 可為 'jpeg'|'png'，預設 jpeg */
async function generateImageWithFlux2ProTextToImage(prompt, seed, outputFormat) {
    const BFL_API_KEY = process.env.BFL_API_KEY;
    if (!BFL_API_KEY) return null;
    const fmt = (outputFormat === 'png' || outputFormat === 'jpeg') ? outputFormat : 'jpeg';
    const body = {
        prompt,
        width: 1024,
        height: 1024,
        output_format: fmt,
        safety_tolerance: 2
    };
    if (seed != null && Number.isInteger(Number(seed))) body.seed = Number(seed);
    const createRes = await fetch(BFL_FLUX_PRO, {
        method: 'POST',
        headers: { 'accept': 'application/json', 'Content-Type': 'application/json', 'x-key': BFL_API_KEY },
        body: JSON.stringify(body)
    });
    if (!createRes.ok) {
        const errText = await createRes.text();
        throw new Error(`BFL create: ${createRes.status} ${errText}`);
    }
    const createData = await createRes.json();
    return pollBflResult(createData, BFL_API_KEY);
}

/** FLUX 2.0 PRO 參考圖編輯（Image Editing）。seed 可選；outputFormat 可為 'jpeg'|'png'，預設 jpeg */
async function generateImageWithFlux2Pro(prompt, referenceImages, seed, outputFormat) {
    const BFL_API_KEY = process.env.BFL_API_KEY;
    if (!BFL_API_KEY || !referenceImages || referenceImages.length === 0) return null;
    const fmt = (outputFormat === 'png' || outputFormat === 'jpeg') ? outputFormat : 'jpeg';
    const maxImages = 8;
    const images = referenceImages.slice(0, maxImages).map((img) => {
        if (typeof img === 'string' && img.startsWith('data:')) {
            const m = img.match(/^data:image\/\w+;base64,(.+)$/);
            return m ? m[1] : img;
        }
        return img;
    });
    const body = { prompt, output_format: fmt, width: 1024, height: 1024 };
    if (seed != null && Number.isInteger(Number(seed))) body.seed = Number(seed);
    body.input_image = images[0];
    for (let i = 1; i < images.length; i++) body[`input_image_${i + 1}`] = images[i];
    const createRes = await fetch(BFL_FLUX_PRO, {
        method: 'POST',
        headers: { 'accept': 'application/json', 'Content-Type': 'application/json', 'x-key': BFL_API_KEY },
        body: JSON.stringify(body)
    });
    if (!createRes.ok) {
        const errText = await createRes.text();
        throw new Error(`BFL create: ${createRes.status} ${errText}`);
    }
    const createData = await createRes.json();
    return pollBflResult(createData, BFL_API_KEY);
}

/** 通用 BFL 文生圖（指定 endpoint、解析度），供 Admin Playground 使用；不串任何系統提示詞 */
async function bflPlaygroundTextToImage(endpointUrl, prompt, width, height, seed, outputFormat, BFL_API_KEY) {
    const body = {
        prompt,
        width: Math.min(2048, Math.max(512, Number(width) || 1024)),
        height: Math.min(2048, Math.max(512, Number(height) || 1024)),
        output_format: (outputFormat === 'png' || outputFormat === 'jpeg') ? outputFormat : 'jpeg',
        safety_tolerance: 2
    };
    if (seed != null && Number.isInteger(Number(seed))) body.seed = Number(seed);
    const createRes = await fetch(endpointUrl, {
        method: 'POST',
        headers: { 'accept': 'application/json', 'Content-Type': 'application/json', 'x-key': BFL_API_KEY },
        body: JSON.stringify(body)
    });
    if (!createRes.ok) {
        const errText = await createRes.text();
        throw new Error(`BFL create: ${createRes.status} ${errText}`);
    }
    const createData = await createRes.json();
    return pollBflResult(createData, BFL_API_KEY);
}

/** 通用 BFL 圖生圖（指定 endpoint、解析度），供 Admin Playground 使用；不串任何系統提示詞 */
async function bflPlaygroundImageEdit(endpointUrl, prompt, referenceImages, width, height, seed, outputFormat, BFL_API_KEY) {
    const images = referenceImages.slice(0, 8).map((img) => {
        if (typeof img === 'string' && img.startsWith('data:')) {
            const m = img.match(/^data:image\/\w+;base64,(.+)$/);
            return m ? m[1] : img;
        }
        return img;
    });
    const w = Math.min(2048, Math.max(512, Number(width) || 1024));
    const h = Math.min(2048, Math.max(512, Number(height) || 1024));
    const body = { prompt, output_format: (outputFormat === 'png' || outputFormat === 'jpeg') ? outputFormat : 'jpeg', width: w, height: h, input_image: images[0] };
    if (seed != null && Number.isInteger(Number(seed))) body.seed = Number(seed);
    for (let i = 1; i < images.length; i++) body[`input_image_${i + 1}`] = images[i];
    const createRes = await fetch(endpointUrl, {
        method: 'POST',
        headers: { 'accept': 'application/json', 'Content-Type': 'application/json', 'x-key': BFL_API_KEY },
        body: JSON.stringify(body)
    });
    if (!createRes.ok) {
        const errText = await createRes.text();
        throw new Error(`BFL create: ${createRes.status} ${errText}`);
    }
    const createData = await createRes.json();
    return pollBflResult(createData, BFL_API_KEY);
}

// 依分類 key 陣列取得後端基礎提示詞並與使用者描述組合（後端處理，不暴露給前端）
async function buildPromptFromCategoryKeys(categoryKeys, userPrompt) {
    if (!categoryKeys || !Array.isArray(categoryKeys) || categoryKeys.length === 0)
        return userPrompt;
    const keys = [...new Set(categoryKeys)].filter(Boolean);
    const prompts = [];
    const { data: mains } = await supabase.from('custom_product_categories').select('key, prompt').in('key', keys).eq('is_active', true);
    const mainMap = {};
    (mains || []).forEach(m => { mainMap[m.key] = (m.prompt || '').trim(); });
    const { data: subs } = await supabase.from('custom_product_subcategories').select('key, prompt').in('key', keys).eq('is_active', true);
    const subMap = {};
    (subs || []).forEach(s => { if (!mainMap[s.key]) subMap[s.key] = (s.prompt || '').trim(); });
    keys.forEach(k => {
        const p = mainMap[k] || subMap[k] || '';
        if (p) prompts.push(p);
    });
    const base = prompts.join('\n\n').trim();
    return base ? base + '\n\n' + userPrompt : userPrompt;
}

// 再製分類：從 remake_categories / remake_subcategories 取 prompt（供 /api/generate-product-image?categorySource=remake）
async function buildPromptFromRemakeCategoryKeys(categoryKeys, userPrompt) {
    if (!categoryKeys || !Array.isArray(categoryKeys) || categoryKeys.length === 0)
        return userPrompt;
    const keys = [...new Set(categoryKeys)].filter(Boolean);
    const prompts = [];
    const { data: mains } = await supabase.from('remake_categories').select('key, prompt').in('key', keys).eq('is_active', true);
    const mainMap = {};
    (mains || []).forEach(m => { mainMap[m.key] = (m.prompt || '').trim(); });
    const { data: subs } = await supabase.from('remake_subcategories').select('key, prompt').in('key', keys).eq('is_active', true);
    const subMap = {};
    (subs || []).forEach(s => { if (!mainMap[s.key]) subMap[s.key] = (s.prompt || '').trim(); });
    keys.forEach(k => {
        const p = mainMap[k] || subMap[k] || '';
        if (p) prompts.push(p);
    });
    const base = prompts.join('\n\n').trim();
    return base ? base + '\n\n' + userPrompt : userPrompt;
}

// 實境模擬：通用系統提示詞（後台未設定時使用）
const DEFAULT_SCENE_SIM_SYSTEM_PROMPT = 'Seamlessly place the product into the provided environment or person image. Keep the product clearly visible and well-integrated. Match lighting, shadows, and perspective to the scene. Output a single photorealistic image.';

// 實境模擬：從 payment_config 讀取系統提示詞（供生圖 API 組合用；空則用上方預設）
async function getSceneSimSystemPrompt() {
    const { data: row } = await supabase.from('payment_config').select('value').eq('key', 'scene_sim_system_prompt').maybeSingle();
    const value = (row && row.value != null) ? String(row.value).trim() : '';
    return value || DEFAULT_SCENE_SIM_SYSTEM_PROMPT;
}

/** 將圖片參數轉成 BFL 用的 base64：data:image/xxx;base64,xxx 取後段；http(s) URL 則 fetch 後轉 base64 */
async function resolveImageToBase64(img) {
    if (!img || typeof img !== 'string') return null;
    const s = img.trim();
    if (s.startsWith('data:image/')) {
        const m = s.match(/^data:image\/\w+;base64,(.+)$/);
        return m ? m[1] : null;
    }
    if (s.startsWith('http://') || s.startsWith('https://')) {
        try {
            const resp = await fetch(s, { headers: { 'Accept': 'image/*' } });
            if (!resp.ok) return null;
            const buf = Buffer.from(await resp.arrayBuffer());
            return buf.toString('base64');
        } catch (e) {
            console.warn('resolveImageToBase64 fetch:', e.message);
            return null;
        }
    }
    return null;
}

/** 實境模擬：環境圖 + 產品圖 + 提示詞，送 BFL Flux 2 Pro 圖生圖，回傳 PNG buffer */
async function generateSceneSimulateImage(environmentImageBase64, productImageBase64, userPrompt, seed) {
    const BFL_API_KEY = process.env.BFL_API_KEY;
    if (!BFL_API_KEY || !environmentImageBase64 || !productImageBase64) return null;
    const systemPrompt = await getSceneSimSystemPrompt();
    const prompt = (userPrompt && String(userPrompt).trim())
        ? systemPrompt + '\n\nUser instruction: ' + String(userPrompt).trim()
        : systemPrompt;
    const body = {
        prompt,
        output_format: 'jpeg',
        width: 1024,
        height: 1024,
        input_image: environmentImageBase64,
        input_image_2: productImageBase64
    };
    if (seed != null && Number.isInteger(Number(seed))) body.seed = Number(seed);
    const createRes = await fetch(BFL_FLUX_PRO, {
        method: 'POST',
        headers: { 'accept': 'application/json', 'Content-Type': 'application/json', 'x-key': BFL_API_KEY },
        body: JSON.stringify(body)
    });
    if (!createRes.ok) {
        const errText = await createRes.text();
        throw new Error(`BFL scene-sim: ${createRes.status} ${errText}`);
    }
    const createData = await createRes.json();
    return pollBflResult(createData, BFL_API_KEY);
}

// API: 實境模擬（環境/人物圖 + 產品圖 → 合成圖，不存數位資產）；需登入，成功後扣 points_scene_simulate（預設 20 點）
app.post('/api/scene-simulate', express.json(), async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        let isAdmin = false;
        let currentUser = null;
        if (authHeader) {
            const token = authHeader.replace(/^\s*Bearer\s+/i, '');
            const { data: { user }, error } = await supabase.auth.getUser(token);
            if (!error && user) {
                const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
                isAdmin = profile?.role === 'admin';
                currentUser = user;
            }
        }
        if (!currentUser) {
            return res.status(401).json({ success: false, error: '請先登入後再使用實境模擬' });
        }
        const { environmentImage, productImage, prompt } = req.body;
        if (!environmentImage || typeof environmentImage !== 'string') {
            return res.status(400).json({ success: false, error: '請上傳環境或人物圖片' });
        }
        if (!productImage || typeof productImage !== 'string') {
            return res.status(400).json({ success: false, error: '請選擇產品圖片' });
        }
        const envBase64 = await resolveImageToBase64(environmentImage);
        const productBase64 = await resolveImageToBase64(productImage);
        if (!envBase64) {
            return res.status(400).json({ success: false, error: '環境圖片無法讀取，請重新上傳' });
        }
        if (!productBase64) {
            return res.status(400).json({ success: false, error: '產品圖片無法讀取，請重新選擇' });
        }
        if (!process.env.BFL_API_KEY) {
            return res.status(503).json({ success: false, error: '實境模擬服務暫未設定，請稍後再試' });
        }
        const seed = Math.floor(Math.random() * 2147483647);
        const buffer = await generateSceneSimulateImage(envBase64, productBase64, prompt || '', seed);
        if (!buffer) {
            return res.status(500).json({ success: false, error: '生圖失敗，請稍後再試' });
        }
        const imageData = buffer.toString('base64');
        if (!isAdmin) {
            const pointsToDeduct = await getPointsSceneSimulate();
            if (pointsToDeduct > 0) {
                const { data: credRow } = await supabase.from('user_credits').select('balance, total_spent').eq('user_id', currentUser.id).maybeSingle();
                const balance = (credRow && credRow.balance != null) ? credRow.balance : 0;
                if (balance < pointsToDeduct) {
                    return res.status(402).json({ success: false, error: '點數不足', balance, required: pointsToDeduct });
                }
                const balanceAfter = balance - pointsToDeduct;
                const totalSpent = (credRow ? (credRow.total_spent || 0) : 0) + pointsToDeduct;
                await supabase.from('user_credits').upsert({
                    user_id: currentUser.id,
                    balance: balanceAfter,
                    total_spent: totalSpent,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' });
                await supabase.from('credit_transactions').insert({
                    user_id: currentUser.id,
                    type: 'consumed',
                    amount: -pointsToDeduct,
                    balance_after: balanceAfter,
                    source: 'scene_simulate',
                    description: '實境模擬',
                    metadata: {}
                });
            }
        }
        res.json({
            success: true,
            imageData: `data:image/png;base64,${imageData}`,
            seed
        });
    } catch (error) {
        console.error('實境模擬錯誤:', error);
        res.status(500).json({
            success: false,
            error: error.message || '實境模擬失敗，請稍後再試'
        });
    }
});

// API: 生成產品示意圖（categoryKeys 必填，後端組合基礎提示詞 + 使用者描述）
// categorySource: 'remake' 時使用 remake_categories 的 prompt，否則使用訂製分類
app.post('/api/generate-product-image', express.json(), async (req, res) => {
    try {
        const { prompt, categoryKeys, aspectRatio = '1:1', resolution = '2K', referenceImages, seed, categorySource, output_format } = req.body;
        const outputFormat = (output_format === 'png' || output_format === 'jpeg') ? output_format : 'jpeg';
        if (!prompt) {
            return res.status(400).json({ success: false, error: '請提供產品描述' });
        }
        if (!categoryKeys || !Array.isArray(categoryKeys) || categoryKeys.length === 0) {
            return res.status(400).json({ success: false, error: '請至少選擇一項圖內容分類' });
        }
        const useRemake = (categorySource === 'remake' || categorySource === 'remake_categories');
        const hasRefs = referenceImages && Array.isArray(referenceImages) && referenceImages.length > 0;
        if (useRemake && !hasRefs) {
            return res.status(400).json({ success: false, error: '再製方案必須上傳至少一張參考圖，AI 依圖改裝' });
        }

        // ── 步驟 1：取得使用者資訊，在生圖前先確認點數夠（避免 BFL 費用白花）──
        let currentUser = null;
        let isAdmin = false;
        let pointsToDeduct = 0;
        let currentBalance = 0;
        const authHeader = req.headers.authorization;
        if (authHeader) {
            const token = authHeader.replace('Bearer ', '');
            const { data: { user }, error: authError } = await supabase.auth.getUser(token);
            if (!authError && user) {
                currentUser = user;
                const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
                isAdmin = profile?.role === 'admin';
                if (!isAdmin) {
                    const basePoints = hasRefs ? await getPointsImageToImage() : await getPointsTextToImage();
                    pointsToDeduct = await applyAnnualDiscount(user.id, basePoints);
                    const { data: creditRow } = await supabase
                        .from('user_credits').select('balance').eq('user_id', user.id).maybeSingle();
                    currentBalance = creditRow?.balance ?? 0;
                    if (currentBalance < pointsToDeduct) {
                        return res.status(402).json({
                            success: false,
                            error: `點數不足，本次生圖需要 ${pointsToDeduct} 點，目前餘額 ${currentBalance} 點`,
                            required: pointsToDeduct,
                            balance: currentBalance
                        });
                    }
                }
            }
        }

        const fullPrompt = useRemake
            ? await buildPromptFromRemakeCategoryKeys(categoryKeys, prompt)
            : await buildPromptFromCategoryKeys(categoryKeys, prompt);
        // 使用者未填 seed 時由後端產生隨機 seed，傳給 FLUX 並寫入 DB，方便重現與顯示
        let seedNum = (seed != null && seed !== '' && Number.isInteger(Number(seed))) ? Number(seed) : null;
        if (seedNum == null) seedNum = Math.floor(Math.random() * 2147483647);

        let imageData = null;
        let usedFlux = false;

        // ── 步驟 2：呼叫 BFL 生圖 ──
        if (process.env.BFL_API_KEY) {
            try {
                if (hasRefs) {
                    const buffer = await generateImageWithFlux2Pro(fullPrompt, referenceImages, seedNum, outputFormat);
                    if (buffer) { imageData = buffer.toString('base64'); usedFlux = true; }
                } else {
                    const buffer = await generateImageWithFlux2ProTextToImage(fullPrompt, seedNum, outputFormat);
                    if (buffer) { imageData = buffer.toString('base64'); usedFlux = true; }
                }
            } catch (e) {
                console.warn('FLUX 2.0 pro 失敗:', e.message);
            }
        }

        if (!imageData) {
            return res.status(500).json({
                success: false,
                error: process.env.BFL_API_KEY
                    ? 'FLUX 生圖失敗，請稍後再試或調整描述' + (hasRefs ? '與參考圖' : '')
                    : '未設定 BFL_API_KEY，無法生圖'
            });
        }

        // ── 步驟 3：生圖成功，上傳 Storage ──
        const buffer = Buffer.from(imageData, 'base64');
        const ext = outputFormat === 'png' ? 'png' : 'jpg';
        const mime = outputFormat === 'png' ? 'image/png' : 'image/jpeg';
        let imageUrl = null;
        try {
            const { publicUrl } = await uploadToSupabaseStorage('custom-products', 'generated', { buffer, mimetype: mime, originalname: `generated-${Date.now()}.${ext}` }, { ext, contentType: mime });
            imageUrl = publicUrl;
        } catch (e) {
            console.warn('上傳生成圖至 Storage 失敗:', e.message);
        }
        if (!imageUrl) imageUrl = `data:${mime};base64,${imageData}`;

        // ── 步驟 4：生圖成功後才扣點、寫入 custom_products ──
        if (currentUser) {
            if (!isAdmin && pointsToDeduct > 0) {
                const newBalance = currentBalance - pointsToDeduct;
                await supabase.from('user_credits')
                    .update({ balance: newBalance, updated_at: new Date().toISOString() })
                    .eq('user_id', currentUser.id);
                await supabase.from('credit_transactions').insert({
                    user_id: currentUser.id,
                    type: 'consumed',
                    amount: -pointsToDeduct,
                    balance_after: newBalance,
                    source: hasRefs ? 'image_to_image' : 'text_to_image',
                    description: hasRefs ? `圖生圖（${pointsToDeduct} 點）` : `文生圖（${pointsToDeduct} 點）`
                }).catch(e => console.warn('寫入 credit_transactions 失敗:', e.message));
                console.log('生圖扣點 user=%s points=%d balance_after=%d', currentUser.id, pointsToDeduct, newBalance);
            }

            // 寫入 custom_products
            const title = (prompt && String(prompt).trim()) ? String(prompt).trim().substring(0, 80) + (String(prompt).trim().length > 80 ? '…' : '') : '產品草圖';
            const description = (prompt && String(prompt).trim()) || '（無描述）';
            const generationPromptVal = (prompt && String(prompt).trim()) ? String(prompt).trim() : null;
            const mainCategoryKey = (categoryKeys && categoryKeys[0]) ? String(categoryKeys[0]).trim() || null : null;
            const subCategoryKey = (categoryKeys && categoryKeys.length >= 2 && categoryKeys[1]) ? String(categoryKeys[1]).trim() || null : null;
            const { error: insertErr } = await supabase.from('custom_products').insert({
                owner_id: currentUser.id,
                title, description,
                category: mainCategoryKey,
                subcategory_key: subCategoryKey,
                reference_image_url: null,
                ai_generated_image_url: imageUrl,
                analysis_json: null,
                status: 'draft',
                generation_prompt: generationPromptVal,
                generation_seed: seedNum,
                // 付費會員預設不公開到靈感牆（可自行開放）；免費會員預設公開
                show_on_homepage: !(await hasActivePaidSubscription(currentUser.id))
            }).select('id').single();
            if (insertErr) console.error('生成後寫入 custom_products 失敗:', insertErr.message);
            else console.log('生成後已寫入 custom_products owner_id=%s', currentUser.id);
        }

        res.json({
            success: true,
            imageUrl,
            imageData: `data:${mime};base64,${imageData}`,
            output_format: outputFormat,
            resolution: '1024x1024',
            aspectRatio: '1:1',
            usedFlux,
            seedUsed: seedNum,
            mode: hasRefs ? 'image-to-image' : 'text-to-image'
        });
    } catch (error) {
        console.error('生成圖片錯誤:', error);
        res.status(500).json({
            success: false,
            error: '圖片生成失敗，請檢查描述是否清楚或稍後再試',
            details: error.message
        });
    }
});

// API: Admin Playground 生圖（文生圖／圖生圖；管理員與測試員可用）
app.post('/api/admin/playground-generate', express.json(), async (req, res) => {
    try {
        const adminUser = await requireAdminOrTester(req, res);
        if (!adminUser) return;
        const BFL_API_KEY = process.env.BFL_API_KEY;
        if (!BFL_API_KEY) {
            return res.status(503).json({ success: false, error: '未設定 BFL_API_KEY，無法生圖' });
        }
        const { prompt, referenceImage, referenceImages, model = 'flux-2-pro', width = 1024, height = 1024, seed, output_format } = req.body;
        const rawPrompt = (prompt && String(prompt).trim()) ? String(prompt).trim() : '';
        if (!rawPrompt) {
            return res.status(400).json({ success: false, error: '請輸入描述（prompt）' });
        }
        const outputFormat = (output_format === 'png' || output_format === 'jpeg') ? output_format : 'jpeg';
        const endpointUrl = getBflPlaygroundEndpoint(model);
        const w = Math.min(2048, Math.max(512, Number(width) || 1024));
        const h = Math.min(2048, Math.max(512, Number(height) || 1024));
        let seedNum = (seed != null && seed !== '' && Number.isInteger(Number(seed))) ? Number(seed) : null;
        if (seedNum == null) seedNum = Math.floor(Math.random() * 2147483647);

        let refList = Array.isArray(referenceImages) && referenceImages.length > 0
            ? referenceImages
            : (referenceImage && typeof referenceImage === 'string' && referenceImage.length > 0 ? [referenceImage] : []);
        refList = refList.slice(0, 8).filter(Boolean);

        let buffer;
        if (refList.length > 0) {
            buffer = await bflPlaygroundImageEdit(endpointUrl, rawPrompt, refList, w, h, seedNum, outputFormat, BFL_API_KEY);
        } else {
            buffer = await bflPlaygroundTextToImage(endpointUrl, rawPrompt, w, h, seedNum, outputFormat, BFL_API_KEY);
        }
        if (!buffer) {
            return res.status(500).json({ success: false, error: 'FLUX 生圖失敗' });
        }
        const imageData = buffer.toString('base64');
        const mime = outputFormat === 'png' ? 'image/png' : 'image/jpeg';
        res.json({
            success: true,
            imageData: `data:${mime};base64,${imageData}`,
            output_format: outputFormat,
            width: w,
            height: h,
            seedUsed: seedNum
        });
    } catch (error) {
        console.error('Admin playground 生圖錯誤:', error);
        res.status(500).json({
            success: false,
            error: error.message || '生圖失敗，請稍後再試'
        });
    }
});

// ---------- AI 放大（Stability Fast Upscale） ----------
// 是否為有效付費訂閱（任意付費方案，保留給舊呼叫）
async function hasActivePaidSubscription(userId) {
    if (!userId) return false;
    const now = new Date().toISOString();
    const { data: rows } = await supabase
        .from('user_subscriptions')
        .select('id, subscription_plans(price)')
        .eq('user_id', userId)
        .eq('status', 'active')
        .gt('end_date', now);
    if (!rows || rows.length === 0) return false;
    return rows.some(r => (r.subscription_plans && (r.subscription_plans.price || 0) > 0));
}
// 是否為有效年繳訂閱（duration_months >= 12，用於生圖 6 折）
async function hasAnnualSubscription(userId) {
    if (!userId) return false;
    const now = new Date().toISOString();
    const { data: rows } = await supabase
        .from('user_subscriptions')
        .select('id, subscription_plans(price, duration_months)')
        .eq('user_id', userId)
        .eq('status', 'active')
        .gt('end_date', now);
    if (!rows || rows.length === 0) return false;
    return rows.some(r => (r.subscription_plans && (r.subscription_plans.duration_months || 0) >= 12));
}
// 訂閱會員「我的 AI 編輯區」點數打 6 折（至少 1 點）
async function applyAiEditDiscountForSubscriber(userId, points) {
    if (!userId || points <= 0) return points;
    const isPaid = await hasActivePaidSubscription(userId);
    if (!isPaid) return points;
    return Math.max(1, Math.round(points * 0.6));
}
// 年繳會員點數打 6 折（至少 1 點）
async function applyAnnualDiscount(userId, points) {
    if (!userId || points <= 0) return points;
    const isAnnual = await hasAnnualSubscription(userId);
    if (!isAnnual) return points;
    return Math.max(1, Math.round(points * 0.6));
}

// 讀取 points_text_to_image（文生圖，預設 15）
async function getPointsTextToImage() {
    const { data: rows } = await supabase.from('payment_config').select('value').eq('key', 'points_text_to_image');
    const v = (rows && rows[0]) ? rows[0].value : null;
    return Math.max(0, parseInt(v, 10) || 15);
}
// 讀取 points_image_to_image（圖生圖，預設 20）
async function getPointsImageToImage() {
    const { data: rows } = await supabase.from('payment_config').select('value').eq('key', 'points_image_to_image');
    const v = (rows && rows[0]) ? rows[0].value : null;
    return Math.max(0, parseInt(v, 10) || 20);
}
// 讀取 points_ai_upscale（供扣點用）
async function getPointsAIUpscale() {
    const { data: rows } = await supabase.from('payment_config').select('value').eq('key', 'points_ai_upscale');
    const v = (rows && rows[0]) ? rows[0].value : null;
    return Math.max(0, parseInt(v, 10) || 10);
}

async function getPointsSceneSimulate() {
    const { data: rows } = await supabase.from('payment_config').select('value').eq('key', 'points_scene_simulate');
    const v = (rows && rows[0]) ? rows[0].value : null;
    return Math.max(0, parseInt(v, 10) || 20);
}

// POST /api/upscale-image — 上傳圖片，Stability Fast 4x 放大；管理員不扣點，一般用戶成功後扣 points_ai_upscale
app.post('/api/upscale-image', upload.single('image'), async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        let isAdmin = false;
        let currentUser = null;
        if (authHeader) {
            const token = authHeader.replace(/^\s*Bearer\s+/i, '');
            const { data: { user }, error } = await supabase.auth.getUser(token);
            if (!error && user) {
                const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
                isAdmin = profile?.role === 'admin';
                currentUser = user;
            }
        }
        if (!isAdmin) {
            if (!currentUser) {
                const user = await getCurrentUser(req, res);
                if (!user) return;
                currentUser = user;
            }
        }
        const file = req.file;
        if (!file || !file.buffer) {
            return res.status(400).json({ success: false, error: '請上傳一張圖片' });
        }
        const STABILITY_API_KEY = getStabilityApiKey();
        if (!STABILITY_API_KEY) {
            return res.status(503).json({ success: false, error: '伺服器未設定 STABILITY_API_KEY，無法使用放大功能' });
        }
        const form = new FormData();
        form.append('image', new Blob([file.buffer], { type: file.mimetype || 'image/png' }), file.originalname || 'image.png');
        const stabilityRes = await fetch('https://api.stability.ai/v2beta/stable-image/upscale/fast', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + STABILITY_API_KEY },
            body: form
        });
        if (!stabilityRes.ok) {
            const errText = await stabilityRes.text();
            console.error('Stability upscale error:', stabilityRes.status, errText);
            return res.status(502).json({
                success: false,
                error: '放大服務暫時無法使用，請稍後再試',
                details: stabilityRes.status === 401 ? 'API Key 無效' : errText.slice(0, 200)
            });
        }
        const contentType = stabilityRes.headers.get('content-type') || '';
        let imageBase64;
        if (contentType.includes('application/json')) {
            const json = await stabilityRes.json();
            const artifact = json.artifacts && json.artifacts[0];
            if (artifact && artifact.base64) imageBase64 = artifact.base64;
            else if (json.image) imageBase64 = json.image;
        }
        if (!imageBase64) {
            const buf = Buffer.from(await stabilityRes.arrayBuffer());
            imageBase64 = buf.toString('base64');
        }
        if (!imageBase64) {
            return res.status(502).json({ success: false, error: '無法取得放大結果' });
        }
        if (!isAdmin && currentUser) {
            let pointsToDeduct = await getPointsAIUpscale();
            if (pointsToDeduct > 0) {
                pointsToDeduct = await applyAiEditDiscountForSubscriber(currentUser.id, pointsToDeduct);
                const { data: credRow } = await supabase.from('user_credits').select('balance, total_spent').eq('user_id', currentUser.id).maybeSingle();
                const balance = (credRow && credRow.balance != null) ? credRow.balance : 0;
                if (balance < pointsToDeduct) {
                    return res.status(402).json({ success: false, error: '點數不足', balance, required: pointsToDeduct });
                }
                const balanceAfter = balance - pointsToDeduct;
                const totalSpent = (credRow ? (credRow.total_spent || 0) : 0) + pointsToDeduct;
                await supabase.from('user_credits').upsert({
                    user_id: currentUser.id,
                    balance: balanceAfter,
                    total_spent: totalSpent,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' });
                await supabase.from('credit_transactions').insert({
                    user_id: currentUser.id,
                    type: 'consumed',
                    amount: -pointsToDeduct,
                    balance_after: balanceAfter,
                    source: 'ai_upscale',
                    description: 'AI 圖片放大',
                    metadata: {}
                });
            }
        }
        res.json({
            success: true,
            imageData: 'data:image/png;base64,' + imageBase64
        });
    } catch (e) {
        console.error('POST /api/upscale-image 異常:', e);
        if (!res.headersSent) res.status(500).json({ success: false, error: '放大失敗，請稍後再試', details: e.message });
    }
});

// 讀取 points_ai_sketch（前台 Sketch 扣點，預設 20）
async function getPointsAISketch() {
    const { data: rows } = await supabase.from('payment_config').select('value').eq('key', 'points_ai_sketch');
    const v = (rows && rows[0]) ? rows[0].value : null;
    return Math.max(0, parseInt(v, 10) || 20);
}

// POST /api/sketch-image — Stability Control Sketch：草圖→成圖；管理員不扣點，一般用戶成功後扣 points_ai_sketch（預設 20 點）
app.post('/api/sketch-image', upload.single('image'), async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        let isAdmin = false;
        let currentUser = null;
        if (authHeader) {
            const token = authHeader.replace(/^\s*Bearer\s+/i, '');
            const { data: { user }, error } = await supabase.auth.getUser(token);
            if (!error && user) {
                const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
                isAdmin = profile?.role === 'admin';
                currentUser = user;
            }
        }
        if (!isAdmin) {
            const user = await getCurrentUser(req, res);
            if (!user) return;
            currentUser = user;
        }
        const file = req.file;
        if (!file || !file.buffer) {
            return res.status(400).json({ success: false, error: '請上傳一張草圖' });
        }
        let prompt = (req.body && req.body.prompt && String(req.body.prompt).trim()) || '';
        if (!prompt) {
            return res.status(400).json({ success: false, error: '請填寫描述（prompt）' });
        }
        let negativePrompt = (req.body.negative_prompt && String(req.body.negative_prompt).trim()) || '';
        [prompt, negativePrompt] = await translatePromptAndNegativeToEnglish(prompt, negativePrompt);
        const STABILITY_API_KEY = getStabilityApiKey();
        if (!STABILITY_API_KEY) {
            return res.status(503).json({ success: false, error: '伺服器未設定 STABILITY_API_KEY' });
        }
        const controlStrength = Math.min(1, Math.max(0, parseFloat(req.body.control_strength) || 0.7));
        const seed = parseInt(req.body.seed, 10) || 0;
        const outputFormat = ['jpeg', 'png'].includes(String(req.body.output_format || '').toLowerCase())
            ? String(req.body.output_format).toLowerCase() : 'jpeg';

        const form = new FormData();
        form.append('image', new Blob([file.buffer], { type: file.mimetype || 'image/png' }), file.originalname || 'image.png');
        form.append('prompt', prompt);
        if (negativePrompt) form.append('negative_prompt', negativePrompt);
        form.append('control_strength', String(controlStrength));
        if (seed > 0) form.append('seed', String(seed));
        form.append('output_format', outputFormat);

        const stabilityRes = await fetch('https://api.stability.ai/v2beta/stable-image/control/sketch', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + STABILITY_API_KEY,
                Accept: 'application/json'
            },
            body: form
        });

        if (!stabilityRes.ok) {
            const errText = await stabilityRes.text();
            console.error('Stability sketch error:', stabilityRes.status, errText);
            return res.status(502).json({
                success: false,
                error: '草圖轉圖像服務暫時無法使用，請稍後再試',
                details: stabilityRes.status === 401 ? 'API Key 無效' : errText.slice(0, 200)
            });
        }

        const json = await stabilityRes.json();
        const artifact = json.artifacts && json.artifacts[0];
        const imageBase64 = artifact && artifact.base64 ? artifact.base64 : (json.image || '');
        if (!imageBase64) {
            return res.status(502).json({ success: false, error: '無法取得生成結果' });
        }

        if (!isAdmin && currentUser) {
            let pointsToDeduct = await getPointsAISketch();
            if (pointsToDeduct > 0) {
                pointsToDeduct = await applyAiEditDiscountForSubscriber(currentUser.id, pointsToDeduct);
                const { data: credRow } = await supabase.from('user_credits').select('balance, total_spent').eq('user_id', currentUser.id).maybeSingle();
                const balance = (credRow && credRow.balance != null) ? credRow.balance : 0;
                if (balance < pointsToDeduct) {
                    return res.status(402).json({ success: false, error: '點數不足', balance, required: pointsToDeduct });
                }
                const balanceAfter = balance - pointsToDeduct;
                const totalSpent = (credRow ? (credRow.total_spent || 0) : 0) + pointsToDeduct;
                await supabase.from('user_credits').upsert({
                    user_id: currentUser.id,
                    balance: balanceAfter,
                    total_spent: totalSpent,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' });
                await supabase.from('credit_transactions').insert({
                    user_id: currentUser.id,
                    type: 'consumed',
                    amount: -pointsToDeduct,
                    balance_after: balanceAfter,
                    source: 'ai_sketch',
                    description: '草圖轉圖像',
                    metadata: {}
                });
            }
        }

        const mime = outputFormat === 'jpeg' ? 'image/jpeg' : 'image/png';
        res.json({
            success: true,
            imageData: 'data:' + mime + ';base64,' + imageBase64,
            output_format: outputFormat
        });
    } catch (e) {
        console.error('POST /api/sketch-image 異常:', e);
        if (!res.headersSent) res.status(500).json({ success: false, error: '生成失敗，請稍後再試', details: e.message });
    }
});

// 讀取 points_ai_structure（前台結構轉圖像扣點，預設 20）
async function getPointsAIStructure() {
    const { data: rows } = await supabase.from('payment_config').select('value').eq('key', 'points_ai_structure');
    const v = (rows && rows[0]) ? rows[0].value : null;
    return Math.max(0, parseInt(v, 10) || 20);
}

// POST /api/structure-image — Stability Control Structure：結構→成圖；管理員不扣點，一般用戶成功後扣 points_ai_structure（預設 20 點）
app.post('/api/structure-image', upload.single('image'), async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        let isAdmin = false;
        let currentUser = null;
        if (authHeader) {
            const token = authHeader.replace(/^\s*Bearer\s+/i, '');
            const { data: { user }, error } = await supabase.auth.getUser(token);
            if (!error && user) {
                const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
                isAdmin = profile?.role === 'admin';
                currentUser = user;
            }
        }
        if (!isAdmin) {
            const user = await getCurrentUser(req, res);
            if (!user) return;
            currentUser = user;
        }
        const file = req.file;
        if (!file || !file.buffer) {
            return res.status(400).json({ success: false, error: '請上傳一張圖片' });
        }
        let prompt = (req.body && req.body.prompt && String(req.body.prompt).trim()) || '';
        if (!prompt) {
            return res.status(400).json({ success: false, error: '請填寫描述（prompt）' });
        }
        let negativePrompt = (req.body.negative_prompt && String(req.body.negative_prompt).trim()) || '';
        [prompt, negativePrompt] = await translatePromptAndNegativeToEnglish(prompt, negativePrompt);
        const STABILITY_API_KEY = getStabilityApiKey();
        if (!STABILITY_API_KEY) {
            return res.status(503).json({ success: false, error: '伺服器未設定 STABILITY_API_KEY' });
        }
        const controlStrength = Math.min(1, Math.max(0, parseFloat(req.body.control_strength) || 0.7));
        const seed = parseInt(req.body.seed, 10) || 0;
        const outputFormat = ['jpeg', 'png'].includes(String(req.body.output_format || '').toLowerCase())
            ? String(req.body.output_format).toLowerCase() : 'jpeg';

        const form = new FormData();
        form.append('image', new Blob([file.buffer], { type: file.mimetype || 'image/png' }), file.originalname || 'image.png');
        form.append('prompt', prompt);
        if (negativePrompt) form.append('negative_prompt', negativePrompt);
        form.append('control_strength', String(controlStrength));
        if (seed > 0) form.append('seed', String(seed));
        form.append('output_format', outputFormat);

        const stabilityRes = await fetch('https://api.stability.ai/v2beta/stable-image/control/structure', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + STABILITY_API_KEY,
                Accept: 'application/json'
            },
            body: form
        });

        if (!stabilityRes.ok) {
            const errText = await stabilityRes.text();
            console.error('Stability structure error:', stabilityRes.status, errText);
            return res.status(502).json({
                success: false,
                error: '結構轉圖像服務暫時無法使用，請稍後再試',
                details: stabilityRes.status === 401 ? 'API Key 無效' : errText.slice(0, 200)
            });
        }

        const json = await stabilityRes.json();
        const artifact = json.artifacts && json.artifacts[0];
        const imageBase64 = artifact && artifact.base64 ? artifact.base64 : (json.image || '');
        if (!imageBase64) {
            return res.status(502).json({ success: false, error: '無法取得生成結果' });
        }

        if (!isAdmin && currentUser) {
            let pointsToDeduct = await getPointsAIStructure();
            if (pointsToDeduct > 0) {
                pointsToDeduct = await applyAiEditDiscountForSubscriber(currentUser.id, pointsToDeduct);
                const { data: credRow } = await supabase.from('user_credits').select('balance, total_spent').eq('user_id', currentUser.id).maybeSingle();
                const balance = (credRow && credRow.balance != null) ? credRow.balance : 0;
                if (balance < pointsToDeduct) {
                    return res.status(402).json({ success: false, error: '點數不足', balance, required: pointsToDeduct });
                }
                const balanceAfter = balance - pointsToDeduct;
                const totalSpent = (credRow ? (credRow.total_spent || 0) : 0) + pointsToDeduct;
                await supabase.from('user_credits').upsert({
                    user_id: currentUser.id,
                    balance: balanceAfter,
                    total_spent: totalSpent,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' });
                await supabase.from('credit_transactions').insert({
                    user_id: currentUser.id,
                    type: 'consumed',
                    amount: -pointsToDeduct,
                    balance_after: balanceAfter,
                    source: 'ai_structure',
                    description: '結構轉圖像',
                    metadata: {}
                });
            }
        }

        const mime = outputFormat === 'jpeg' ? 'image/jpeg' : 'image/png';
        res.json({
            success: true,
            imageData: 'data:' + mime + ';base64,' + imageBase64,
            output_format: outputFormat
        });
    } catch (e) {
        console.error('POST /api/structure-image 異常:', e);
        if (!res.headersSent) res.status(500).json({ success: false, error: '生成失敗，請稍後再試', details: e.message });
    }
});

// 讀取 points_ai_style（前台風格引導扣點，預設 20）
async function getPointsAIStyle() {
    const { data: rows } = await supabase.from('payment_config').select('value').eq('key', 'points_ai_style');
    const v = (rows && rows[0]) ? rows[0].value : null;
    return Math.max(0, parseInt(v, 10) || 20);
}

const STYLE_ASPECT_RATIOS = ['1:1', '16:9', '9:16', '21:9', '9:21', '2:3', '3:2', '4:5', '5:4'];

// POST /api/style-image — Stability Control Style：風格引導；管理員不扣點，一般用戶成功後扣 points_ai_style（預設 20 點）
app.post('/api/style-image', upload.single('image'), async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        let isAdmin = false;
        let currentUser = null;
        if (authHeader) {
            const token = authHeader.replace(/^\s*Bearer\s+/i, '');
            const { data: { user }, error } = await supabase.auth.getUser(token);
            if (!error && user) {
                const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
                isAdmin = profile?.role === 'admin';
                currentUser = user;
            }
        }
        if (!isAdmin) {
            const user = await getCurrentUser(req, res);
            if (!user) return;
            currentUser = user;
        }
        const file = req.file;
        if (!file || !file.buffer) {
            return res.status(400).json({ success: false, error: '請上傳一張圖片' });
        }
        let prompt = (req.body && req.body.prompt && String(req.body.prompt).trim()) || '';
        if (!prompt) {
            return res.status(400).json({ success: false, error: '請填寫描述（prompt）' });
        }
        let negativePrompt = (req.body.negative_prompt && String(req.body.negative_prompt).trim()) || '';
        [prompt, negativePrompt] = await translatePromptAndNegativeToEnglish(prompt, negativePrompt);
        const STABILITY_API_KEY = getStabilityApiKey();
        if (!STABILITY_API_KEY) {
            return res.status(503).json({ success: false, error: '伺服器未設定 STABILITY_API_KEY' });
        }
        const fidelity = Math.min(1, Math.max(0, parseFloat(req.body.fidelity) || 0.5));
        const seed = parseInt(req.body.seed, 10) || 0;
        const outputFormat = ['jpeg', 'png'].includes(String(req.body.output_format || '').toLowerCase())
            ? String(req.body.output_format).toLowerCase() : 'jpeg';
        const aspectRatio = (req.body.aspect_ratio && STYLE_ASPECT_RATIOS.includes(String(req.body.aspect_ratio))) ? String(req.body.aspect_ratio) : '1:1';

        const form = new FormData();
        form.append('image', new Blob([file.buffer], { type: file.mimetype || 'image/png' }), file.originalname || 'image.png');
        form.append('prompt', prompt);
        if (negativePrompt) form.append('negative_prompt', negativePrompt);
        form.append('fidelity', String(fidelity));
        form.append('aspect_ratio', aspectRatio);
        if (seed > 0) form.append('seed', String(seed));
        form.append('output_format', outputFormat);

        const stabilityRes = await fetch('https://api.stability.ai/v2beta/stable-image/control/style', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + STABILITY_API_KEY,
                Accept: 'application/json'
            },
            body: form
        });

        if (!stabilityRes.ok) {
            const errText = await stabilityRes.text();
            console.error('Stability style error:', stabilityRes.status, errText);
            return res.status(502).json({
                success: false,
                error: '風格引導服務暫時無法使用，請稍後再試',
                details: stabilityRes.status === 401 ? 'API Key 無效' : errText.slice(0, 200)
            });
        }

        const json = await stabilityRes.json();
        const artifact = json.artifacts && json.artifacts[0];
        const imageBase64 = artifact && artifact.base64 ? artifact.base64 : (json.image || '');
        if (!imageBase64) {
            return res.status(502).json({ success: false, error: '無法取得生成結果' });
        }

        if (!isAdmin && currentUser) {
            let pointsToDeduct = await getPointsAIStyle();
            if (pointsToDeduct > 0) {
                pointsToDeduct = await applyAiEditDiscountForSubscriber(currentUser.id, pointsToDeduct);
                const { data: credRow } = await supabase.from('user_credits').select('balance, total_spent').eq('user_id', currentUser.id).maybeSingle();
                const balance = (credRow && credRow.balance != null) ? credRow.balance : 0;
                if (balance < pointsToDeduct) {
                    return res.status(402).json({ success: false, error: '點數不足', balance, required: pointsToDeduct });
                }
                const balanceAfter = balance - pointsToDeduct;
                const totalSpent = (credRow ? (credRow.total_spent || 0) : 0) + pointsToDeduct;
                await supabase.from('user_credits').upsert({
                    user_id: currentUser.id,
                    balance: balanceAfter,
                    total_spent: totalSpent,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' });
                await supabase.from('credit_transactions').insert({
                    user_id: currentUser.id,
                    type: 'consumed',
                    amount: -pointsToDeduct,
                    balance_after: balanceAfter,
                    source: 'ai_style',
                    description: '風格引導',
                    metadata: {}
                });
            }
        }

        const mime = outputFormat === 'jpeg' ? 'image/jpeg' : 'image/png';
        res.json({
            success: true,
            imageData: 'data:' + mime + ';base64,' + imageBase64,
            output_format: outputFormat
        });
    } catch (e) {
        console.error('POST /api/style-image 異常:', e);
        if (!res.headersSent) res.status(500).json({ success: false, error: '生成失敗，請稍後再試', details: e.message });
    }
});

// 讀取 points_ai_style_transfer（前台風格轉換扣點，預設 30）
async function getPointsAIStyleTransfer() {
    const { data: rows } = await supabase.from('payment_config').select('value').eq('key', 'points_ai_style_transfer');
    const v = (rows && rows[0]) ? rows[0].value : null;
    return Math.max(0, parseInt(v, 10) || 30);
}

// POST /api/style-transfer-image — Stability Control Style Transfer：內容圖+風格圖→成圖；管理員不扣點，一般用戶成功後扣 points_ai_style_transfer（預設 30 點）
app.post('/api/style-transfer-image', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'style_image', maxCount: 1 }]), async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        let isAdmin = false;
        let currentUser = null;
        if (authHeader) {
            const token = authHeader.replace(/^\s*Bearer\s+/i, '');
            const { data: { user }, error } = await supabase.auth.getUser(token);
            if (!error && user) {
                const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
                isAdmin = profile?.role === 'admin';
                currentUser = user;
            }
        }
        if (!isAdmin) {
            const user = await getCurrentUser(req, res);
            if (!user) return;
            currentUser = user;
        }
        const files = req.files || {};
        const contentFile = (files.image && files.image[0]) ? files.image[0] : null;
        const styleFile = (files.style_image && files.style_image[0]) ? files.style_image[0] : null;
        if (!contentFile || !contentFile.buffer) {
            return res.status(400).json({ success: false, error: '請上傳內容圖（image）' });
        }
        if (!styleFile || !styleFile.buffer) {
            return res.status(400).json({ success: false, error: '請上傳風格圖（style_image）' });
        }
        const STABILITY_API_KEY = getStabilityApiKey();
        if (!STABILITY_API_KEY) {
            return res.status(503).json({ success: false, error: '伺服器未設定 STABILITY_API_KEY' });
        }
        const seed = parseInt(req.body.seed, 10) || 0;
        const outputFormat = ['jpeg', 'png'].includes(String(req.body.output_format || '').toLowerCase())
            ? String(req.body.output_format).toLowerCase() : 'jpeg';
        let prompt = (req.body.prompt && String(req.body.prompt).trim()) || '';
        let negativePrompt = (req.body.negative_prompt && String(req.body.negative_prompt).trim()) || '';
        [prompt, negativePrompt] = await translatePromptAndNegativeToEnglish(prompt, negativePrompt);

        const form = new FormData();
        form.append('init_image', new Blob([contentFile.buffer], { type: contentFile.mimetype || 'image/png' }), contentFile.originalname || 'image.png');
        form.append('style_image', new Blob([styleFile.buffer], { type: styleFile.mimetype || 'image/png' }), styleFile.originalname || 'style.png');
        if (prompt) form.append('prompt', prompt);
        if (negativePrompt) form.append('negative_prompt', negativePrompt);
        if (seed > 0) form.append('seed', String(seed));
        form.append('output_format', outputFormat);

        const stabilityRes = await fetch('https://api.stability.ai/v2beta/stable-image/control/style-transfer', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + STABILITY_API_KEY,
                Accept: 'application/json'
            },
            body: form
        });

        if (!stabilityRes.ok) {
            const errText = await stabilityRes.text();
            console.error('Stability style-transfer error:', stabilityRes.status, errText);
            let errMsg = '風格轉換服務暫時無法使用，請稍後再試';
            if (stabilityRes.status === 401) errMsg = 'Stability API Key 無效或已過期，請檢查 stability-key.txt 或 .env';
            else if (stabilityRes.status === 429) errMsg = '請求過於頻繁，請稍後再試';
            else if (stabilityRes.status === 402) errMsg = 'Stability 點數不足，請至 platform.stability.ai 儲值';
            else if (errText && errText.length < 150) errMsg = errText;
            return res.status(502).json({ success: false, error: errMsg, details: errText.slice(0, 200) });
        }

        const json = await stabilityRes.json();
        const artifact = json.artifacts && json.artifacts[0];
        const imageBase64 = artifact && artifact.base64 ? artifact.base64 : (json.image || '');
        if (!imageBase64) {
            return res.status(502).json({ success: false, error: '無法取得生成結果' });
        }

        if (!isAdmin && currentUser) {
            let pointsToDeduct = await getPointsAIStyleTransfer();
            if (pointsToDeduct > 0) {
                pointsToDeduct = await applyAiEditDiscountForSubscriber(currentUser.id, pointsToDeduct);
                const { data: credRow } = await supabase.from('user_credits').select('balance, total_spent').eq('user_id', currentUser.id).maybeSingle();
                const balance = (credRow && credRow.balance != null) ? credRow.balance : 0;
                if (balance < pointsToDeduct) {
                    return res.status(402).json({ success: false, error: '點數不足', balance, required: pointsToDeduct });
                }
                const balanceAfter = balance - pointsToDeduct;
                const totalSpent = (credRow ? (credRow.total_spent || 0) : 0) + pointsToDeduct;
                await supabase.from('user_credits').upsert({
                    user_id: currentUser.id,
                    balance: balanceAfter,
                    total_spent: totalSpent,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' });
                await supabase.from('credit_transactions').insert({
                    user_id: currentUser.id,
                    type: 'consumed',
                    amount: -pointsToDeduct,
                    balance_after: balanceAfter,
                    source: 'ai_style_transfer',
                    description: '風格轉換',
                    metadata: {}
                });
            }
        }

        const mime = outputFormat === 'jpeg' ? 'image/jpeg' : 'image/png';
        res.json({
            success: true,
            imageData: 'data:' + mime + ';base64,' + imageBase64,
            output_format: outputFormat
        });
    } catch (e) {
        console.error('POST /api/style-transfer-image 異常:', e);
        if (!res.headersSent) res.status(500).json({ success: false, error: '生成失敗，請稍後再試', details: e.message });
    }
});

// 讀取 points_ai_erase（前台移除物件扣點，預設 20）
async function getPointsAIErase() {
    const { data: rows } = await supabase.from('payment_config').select('value').eq('key', 'points_ai_erase');
    const v = (rows && rows[0]) ? rows[0].value : null;
    return Math.max(0, parseInt(v, 10) || 20);
}

// POST /api/erase-image — Stability Edit Erase：依 mask 移除物件；管理員不扣點，一般用戶成功後扣 points_ai_erase（預設 20 點）
app.post('/api/erase-image', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'mask', maxCount: 1 }]), async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        let isAdmin = false;
        let currentUser = null;
        if (authHeader) {
            const token = authHeader.replace(/^\s*Bearer\s+/i, '');
            const { data: { user }, error } = await supabase.auth.getUser(token);
            if (!error && user) {
                const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
                isAdmin = profile?.role === 'admin';
                currentUser = user;
            }
        }
        if (!isAdmin) {
            const user = await getCurrentUser(req, res);
            if (!user) return;
            currentUser = user;
        }
        const files = req.files || {};
        const imageFile = (files.image && files.image[0]) ? files.image[0] : null;
        const maskFile = (files.mask && files.mask[0]) ? files.mask[0] : null;
        if (!imageFile || !imageFile.buffer) {
            return res.status(400).json({ success: false, error: '請上傳原圖（image）' });
        }
        if (!maskFile || !maskFile.buffer) {
            return res.status(400).json({ success: false, error: '請上傳遮罩圖（mask），白色區域為要移除的範圍' });
        }
        const STABILITY_API_KEY = getStabilityApiKey();
        if (!STABILITY_API_KEY) {
            return res.status(503).json({ success: false, error: '伺服器未設定 STABILITY_API_KEY' });
        }
        const seed = parseInt(req.body.seed, 10) || 0;
        const outputFormat = ['jpeg', 'png'].includes(String(req.body.output_format || '').toLowerCase())
            ? String(req.body.output_format).toLowerCase() : 'jpeg';

        const form = new FormData();
        form.append('image', new Blob([imageFile.buffer], { type: imageFile.mimetype || 'image/png' }), imageFile.originalname || 'image.png');
        form.append('mask', new Blob([maskFile.buffer], { type: maskFile.mimetype || 'image/png' }), maskFile.originalname || 'mask.png');
        if (seed > 0) form.append('seed', String(seed));
        form.append('output_format', outputFormat);

        const stabilityRes = await fetch('https://api.stability.ai/v2beta/stable-image/edit/erase', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + STABILITY_API_KEY,
                Accept: 'application/json'
            },
            body: form
        });

        if (!stabilityRes.ok) {
            const errText = await stabilityRes.text();
            console.error('Stability erase error:', stabilityRes.status, errText);
            return res.status(502).json({
                success: false,
                error: '移除物件服務暫時無法使用，請稍後再試',
                details: stabilityRes.status === 401 ? 'API Key 無效' : errText.slice(0, 200)
            });
        }

        const json = await stabilityRes.json();
        const artifact = json.artifacts && json.artifacts[0];
        const imageBase64 = artifact && artifact.base64 ? artifact.base64 : (json.image || '');
        if (!imageBase64) {
            return res.status(502).json({ success: false, error: '無法取得生成結果' });
        }

        if (!isAdmin && currentUser) {
            let pointsToDeduct = await getPointsAIErase();
            if (pointsToDeduct > 0) {
                pointsToDeduct = await applyAiEditDiscountForSubscriber(currentUser.id, pointsToDeduct);
                const { data: credRow } = await supabase.from('user_credits').select('balance, total_spent').eq('user_id', currentUser.id).maybeSingle();
                const balance = (credRow && credRow.balance != null) ? credRow.balance : 0;
                if (balance < pointsToDeduct) {
                    return res.status(402).json({ success: false, error: '點數不足', balance, required: pointsToDeduct });
                }
                const balanceAfter = balance - pointsToDeduct;
                const totalSpent = (credRow ? (credRow.total_spent || 0) : 0) + pointsToDeduct;
                await supabase.from('user_credits').upsert({
                    user_id: currentUser.id,
                    balance: balanceAfter,
                    total_spent: totalSpent,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' });
                await supabase.from('credit_transactions').insert({
                    user_id: currentUser.id,
                    type: 'consumed',
                    amount: -pointsToDeduct,
                    balance_after: balanceAfter,
                    source: 'ai_erase',
                    description: '移除物件',
                    metadata: {}
                });
            }
        }

        const mime = outputFormat === 'jpeg' ? 'image/jpeg' : 'image/png';
        res.json({
            success: true,
            imageData: 'data:' + mime + ';base64,' + imageBase64,
            output_format: outputFormat
        });
    } catch (e) {
        console.error('POST /api/erase-image 異常:', e);
        if (!res.headersSent) res.status(500).json({ success: false, error: '生成失敗，請稍後再試', details: e.message });
    }
});

// 讀取 points_ai_inpaint（前台內部補繪扣點，預設 20）
async function getPointsAIInpaint() {
    const { data: rows } = await supabase.from('payment_config').select('value').eq('key', 'points_ai_inpaint').limit(1);
    const v = (rows && rows[0]) ? rows[0].value : null;
    return Math.max(0, parseInt(v, 10) || 20);
}

// 讀取 points_ai_outpaint（外擴繪圖扣點，預設 15）
async function getPointsAIOutpaint() {
    const { data: rows } = await supabase.from('payment_config').select('value').eq('key', 'points_ai_outpaint').limit(1);
    const v = (rows && rows[0]) ? rows[0].value : null;
    return Math.max(0, parseInt(v, 10) || 15);
}

// 讀取 points_ai_remove_bg（圖像去背扣點，預設 15）
async function getPointsAIRemoveBg() {
    const { data: rows } = await supabase.from('payment_config').select('value').eq('key', 'points_ai_remove_bg').limit(1);
    const v = (rows && rows[0]) ? rows[0].value : null;
    return Math.max(0, parseInt(v, 10) || 15);
}

// 讀取 points_ai_replace_bg_relight（置換背景與重打光扣點，預設 30）
async function getPointsAIReplaceBgRelight() {
    const { data: rows } = await supabase.from('payment_config').select('value').eq('key', 'points_ai_replace_bg_relight').limit(1);
    const v = (rows && rows[0]) ? rows[0].value : null;
    return Math.max(0, parseInt(v, 10) || 30);
}

// POST /api/inpaint-image — Stability Edit Inpaint：原圖 + mask + prompt 重繪遮罩區域；管理員不扣點，一般用戶成功後扣 points_ai_inpaint（預設 20 點）
app.post('/api/inpaint-image', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'mask', maxCount: 1 }]), async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        let isAdmin = false;
        let currentUser = null;
        if (authHeader) {
            const token = authHeader.replace(/^\s*Bearer\s+/i, '');
            const { data: { user }, error } = await supabase.auth.getUser(token);
            if (!error && user) {
                const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
                isAdmin = profile?.role === 'admin';
                currentUser = user;
            }
        }
        if (!isAdmin) {
            const user = await getCurrentUser(req, res);
            if (!user) return;
            currentUser = user;
        }
        const files = req.files || {};
        const imageFile = (files.image && files.image[0]) ? files.image[0] : null;
        const maskFile = (files.mask && files.mask[0]) ? files.mask[0] : null;
        if (!imageFile || !imageFile.buffer) {
            return res.status(400).json({ success: false, error: '請上傳原圖（image）' });
        }
        if (!maskFile || !maskFile.buffer) {
            return res.status(400).json({ success: false, error: '請上傳遮罩圖（mask），白色區域為要重繪的範圍' });
        }
        let prompt = (req.body.prompt && String(req.body.prompt).trim()) || '';
        if (!prompt) return res.status(400).json({ success: false, error: '請填寫描述（prompt）' });
        let negativePrompt = (req.body.negative_prompt && String(req.body.negative_prompt).trim()) || '';
        [prompt, negativePrompt] = await translatePromptAndNegativeToEnglish(prompt, negativePrompt);
        const STABILITY_API_KEY = getStabilityApiKey();
        if (!STABILITY_API_KEY) {
            return res.status(503).json({ success: false, error: '伺服器未設定 STABILITY_API_KEY' });
        }
        const seed = parseInt(req.body.seed, 10) || 0;
        const outputFormat = ['jpeg', 'png'].includes(String(req.body.output_format || '').toLowerCase())
            ? String(req.body.output_format).toLowerCase() : 'jpeg';

        const form = new FormData();
        form.append('image', new Blob([imageFile.buffer], { type: imageFile.mimetype || 'image/png' }), imageFile.originalname || 'image.png');
        form.append('mask', new Blob([maskFile.buffer], { type: maskFile.mimetype || 'image/png' }), maskFile.originalname || 'mask.png');
        form.append('prompt', prompt);
        if (negativePrompt) form.append('negative_prompt', negativePrompt);
        if (seed > 0) form.append('seed', String(seed));
        form.append('output_format', outputFormat);

        const stabilityRes = await fetch('https://api.stability.ai/v2beta/stable-image/edit/inpaint', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + STABILITY_API_KEY,
                Accept: 'application/json'
            },
            body: form
        });

        if (!stabilityRes.ok) {
            const errText = await stabilityRes.text();
            console.error('Stability inpaint error:', stabilityRes.status, errText);
            return res.status(502).json({
                success: false,
                error: '內部補繪服務暫時無法使用，請稍後再試',
                details: stabilityRes.status === 401 ? 'API Key 無效' : errText.slice(0, 200)
            });
        }

        const json = await stabilityRes.json();
        const artifact = json.artifacts && json.artifacts[0];
        const imageBase64 = artifact && artifact.base64 ? artifact.base64 : (json.image || '');
        if (!imageBase64) {
            return res.status(502).json({ success: false, error: '無法取得生成結果' });
        }

        if (!isAdmin && currentUser) {
            let pointsToDeduct = await getPointsAIInpaint();
            if (pointsToDeduct > 0) {
                pointsToDeduct = await applyAiEditDiscountForSubscriber(currentUser.id, pointsToDeduct);
                const { data: credRow } = await supabase.from('user_credits').select('balance, total_spent').eq('user_id', currentUser.id).maybeSingle();
                const balance = (credRow && credRow.balance != null) ? credRow.balance : 0;
                if (balance < pointsToDeduct) {
                    return res.status(402).json({ success: false, error: '點數不足', balance, required: pointsToDeduct });
                }
                const balanceAfter = balance - pointsToDeduct;
                const totalSpent = (credRow ? (credRow.total_spent || 0) : 0) + pointsToDeduct;
                await supabase.from('user_credits').upsert({
                    user_id: currentUser.id,
                    balance: balanceAfter,
                    total_spent: totalSpent,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' });
                await supabase.from('credit_transactions').insert({
                    user_id: currentUser.id,
                    type: 'consumed',
                    amount: -pointsToDeduct,
                    balance_after: balanceAfter,
                    source: 'ai_inpaint',
                    description: '內部補繪',
                    metadata: {}
                });
            }
        }

        const mime = outputFormat === 'jpeg' ? 'image/jpeg' : 'image/png';
        res.json({
            success: true,
            imageData: 'data:' + mime + ';base64,' + imageBase64,
            output_format: outputFormat
        });
    } catch (e) {
        console.error('POST /api/inpaint-image 異常:', e);
        if (!res.headersSent) res.status(500).json({ success: false, error: '生成失敗，請稍後再試', details: e.message });
    }
});

// POST /api/outpaint-image — Stability Edit Outpaint：原圖 + 方向擴展（left/right/up/down）+ prompt；管理員不扣點，一般用戶成功後扣 points_ai_outpaint（預設 15 點）
app.post('/api/outpaint-image', upload.single('image'), async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        let isAdmin = false;
        let currentUser = null;
        if (authHeader) {
            const token = authHeader.replace(/^\s*Bearer\s+/i, '');
            const { data: { user }, error } = await supabase.auth.getUser(token);
            if (!error && user) {
                const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
                isAdmin = profile?.role === 'admin';
                currentUser = user;
            }
        }
        if (!isAdmin) {
            const user = await getCurrentUser(req, res);
            if (!user) return;
            currentUser = user;
        }
        const file = req.file;
        if (!file || !file.buffer) {
            return res.status(400).json({ success: false, error: '請上傳原圖（image）' });
        }
        let prompt = (req.body.prompt && String(req.body.prompt).trim()) || '';
        if (!prompt) prompt = 'natural extension of the image, seamless background';
        else prompt = await translatePromptToEnglish(prompt);
        const STABILITY_API_KEY = getStabilityApiKey();
        if (!STABILITY_API_KEY) {
            return res.status(503).json({ success: false, error: '伺服器未設定 STABILITY_API_KEY' });
        }
        const left = Math.max(0, parseInt(req.body.left, 10) || 0);
        const right = Math.max(0, parseInt(req.body.right, 10) || 0);
        const up = Math.max(0, parseInt(req.body.up, 10) || 0);
        const down = Math.max(0, parseInt(req.body.down, 10) || 0);
        if (left + right + up + down === 0) {
            return res.status(400).json({ success: false, error: '請至少設定一個擴展方向（left / right / up / down）的像素值' });
        }
        const creativity = Math.min(1, Math.max(0, parseFloat(req.body.creativity) || 0.5));
        const seed = parseInt(req.body.seed, 10) || 0;
        const outputFormat = ['jpeg', 'png'].includes(String(req.body.output_format || '').toLowerCase())
            ? String(req.body.output_format).toLowerCase() : 'jpeg';

        const form = new FormData();
        form.append('image', new Blob([file.buffer], { type: file.mimetype || 'image/png' }), file.originalname || 'image.png');
        form.append('prompt', prompt);
        form.append('left', String(left));
        form.append('right', String(right));
        form.append('up', String(up));
        form.append('down', String(down));
        form.append('creativity', String(creativity));
        if (seed > 0) form.append('seed', String(seed));
        form.append('output_format', outputFormat);

        const stabilityRes = await fetch('https://api.stability.ai/v2beta/stable-image/edit/outpaint', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + STABILITY_API_KEY,
                Accept: 'application/json'
            },
            body: form
        });

        if (!stabilityRes.ok) {
            const errText = await stabilityRes.text();
            console.error('Stability outpaint error:', stabilityRes.status, errText);
            return res.status(502).json({
                success: false,
                error: '外擴繪圖服務暫時無法使用，請稍後再試',
                details: stabilityRes.status === 401 ? 'API Key 無效' : errText.slice(0, 200)
            });
        }

        const json = await stabilityRes.json();
        const artifact = json.artifacts && json.artifacts[0];
        const imageBase64 = artifact && artifact.base64 ? artifact.base64 : (json.image || '');
        if (!imageBase64) {
            return res.status(502).json({ success: false, error: '無法取得生成結果' });
        }

        if (!isAdmin && currentUser) {
            let pointsToDeduct = await getPointsAIOutpaint();
            if (pointsToDeduct > 0) {
                pointsToDeduct = await applyAiEditDiscountForSubscriber(currentUser.id, pointsToDeduct);
                const { data: credRow } = await supabase.from('user_credits').select('balance, total_spent').eq('user_id', currentUser.id).maybeSingle();
                const balance = (credRow && credRow.balance != null) ? credRow.balance : 0;
                if (balance < pointsToDeduct) {
                    return res.status(402).json({ success: false, error: '點數不足', balance, required: pointsToDeduct });
                }
                const balanceAfter = balance - pointsToDeduct;
                const totalSpent = (credRow ? (credRow.total_spent || 0) : 0) + pointsToDeduct;
                await supabase.from('user_credits').upsert({
                    user_id: currentUser.id,
                    balance: balanceAfter,
                    total_spent: totalSpent,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' });
                await supabase.from('credit_transactions').insert({
                    user_id: currentUser.id,
                    type: 'consumed',
                    amount: -pointsToDeduct,
                    balance_after: balanceAfter,
                    source: 'ai_outpaint',
                    description: '外擴繪圖',
                    metadata: {}
                });
            }
        }

        const mime = outputFormat === 'jpeg' ? 'image/jpeg' : 'image/png';
        res.json({
            success: true,
            imageData: 'data:' + mime + ';base64,' + imageBase64,
            output_format: outputFormat
        });
    } catch (e) {
        console.error('POST /api/outpaint-image 異常:', e);
        if (!res.headersSent) res.status(500).json({ success: false, error: '生成失敗，請稍後再試', details: e.message });
    }
});

// POST /api/remove-background-image — Stability Edit Remove Background：上傳圖片去背，回傳透明背景圖；管理員不扣點，一般用戶成功後扣 points_ai_remove_bg（預設 15 點）
app.post('/api/remove-background-image', upload.single('image'), async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        let isAdmin = false;
        let currentUser = null;
        if (authHeader) {
            const token = authHeader.replace(/^\s*Bearer\s+/i, '');
            const { data: { user }, error } = await supabase.auth.getUser(token);
            if (!error && user) {
                const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
                isAdmin = profile?.role === 'admin';
                currentUser = user;
            }
        }
        if (!isAdmin) {
            const user = await getCurrentUser(req, res);
            if (!user) return;
            currentUser = user;
        }
        const file = req.file;
        if (!file || !file.buffer) {
            return res.status(400).json({ success: false, error: '請上傳原圖（image）' });
        }
        const STABILITY_API_KEY = getStabilityApiKey();
        if (!STABILITY_API_KEY) {
            return res.status(503).json({ success: false, error: '伺服器未設定 STABILITY_API_KEY' });
        }
        const of = req.body && req.body.output_format;
        const outputFormat = ['jpeg', 'png'].includes(String(of || '').toLowerCase()) ? String(of).toLowerCase() : 'jpeg';

        const form = new FormData();
        form.append('image', new Blob([file.buffer], { type: file.mimetype || 'image/png' }), file.originalname || 'image.png');
        form.append('output_format', outputFormat);

        const stabilityRes = await fetch('https://api.stability.ai/v2beta/stable-image/edit/remove-background', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + STABILITY_API_KEY,
                Accept: 'application/json'
            },
            body: form
        });

        if (!stabilityRes.ok) {
            const errText = await stabilityRes.text();
            console.error('Stability remove-background error:', stabilityRes.status, errText);
            return res.status(502).json({
                success: false,
                error: '圖像去背服務暫時無法使用，請稍後再試',
                details: stabilityRes.status === 401 ? 'API Key 無效' : errText.slice(0, 200)
            });
        }

        const json = await stabilityRes.json();
        const artifact = json.artifacts && json.artifacts[0];
        const imageBase64 = artifact && artifact.base64 ? artifact.base64 : (json.image || '');
        if (!imageBase64) {
            return res.status(502).json({ success: false, error: '無法取得生成結果' });
        }

        if (!isAdmin && currentUser) {
            let pointsToDeduct = await getPointsAIRemoveBg();
            if (pointsToDeduct > 0) {
                pointsToDeduct = await applyAiEditDiscountForSubscriber(currentUser.id, pointsToDeduct);
                const { data: credRow } = await supabase.from('user_credits').select('balance, total_spent').eq('user_id', currentUser.id).maybeSingle();
                const balance = (credRow && credRow.balance != null) ? credRow.balance : 0;
                if (balance < pointsToDeduct) {
                    return res.status(402).json({ success: false, error: '點數不足', balance, required: pointsToDeduct });
                }
                const balanceAfter = balance - pointsToDeduct;
                const totalSpent = (credRow ? (credRow.total_spent || 0) : 0) + pointsToDeduct;
                await supabase.from('user_credits').upsert({
                    user_id: currentUser.id,
                    balance: balanceAfter,
                    total_spent: totalSpent,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' });
                await supabase.from('credit_transactions').insert({
                    user_id: currentUser.id,
                    type: 'consumed',
                    amount: -pointsToDeduct,
                    balance_after: balanceAfter,
                    source: 'ai_remove_bg',
                    description: '圖像去背',
                    metadata: {}
                });
            }
        }

        const mime = 'image/png';
        res.json({
            success: true,
            imageData: 'data:' + mime + ';base64,' + imageBase64,
            output_format: outputFormat
        });
    } catch (e) {
        console.error('POST /api/remove-background-image 異常:', e);
        if (!res.headersSent) res.status(500).json({ success: false, error: '生成失敗，請稍後再試', details: e.message });
    }
});

// POST /api/replace-background-relight-image — Stability Edit Replace Background and Relight；管理員不扣點，一般用戶扣 points_ai_replace_bg_relight（預設 30 點）
const replaceBgRelightUpload = upload.fields([
    { name: 'subject_image', maxCount: 1 },
    { name: 'background_reference', maxCount: 1 },
    { name: 'light_reference', maxCount: 1 }
]);
app.post('/api/replace-background-relight-image', replaceBgRelightUpload, async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        let isAdmin = false;
        let currentUser = null;
        if (authHeader) {
            const token = authHeader.replace(/^\s*Bearer\s+/i, '');
            const { data: { user }, error } = await supabase.auth.getUser(token);
            if (!error && user) {
                const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
                isAdmin = profile?.role === 'admin';
                currentUser = user;
            }
        }
        if (!isAdmin) {
            const user = await getCurrentUser(req, res);
            if (!user) return;
            currentUser = user;
        }
        const files = req.files || {};
        const subjectFile = (files.subject_image && files.subject_image[0]) ? files.subject_image[0] : null;
        if (!subjectFile || !subjectFile.buffer) {
            return res.status(400).json({ success: false, error: '請上傳主體圖片（subject_image）' });
        }
        const body = req.body || {};
        const backgroundPrompt = typeof body.background_prompt === 'string' ? body.background_prompt.trim() : '';
        const backgroundRefFile = (files.background_reference && files.background_reference[0]) ? files.background_reference[0] : null;
        if (!backgroundPrompt && !backgroundRefFile) {
            return res.status(400).json({ success: false, error: '請填寫背景描述（background_prompt）或上傳背景參考圖（background_reference）' });
        }
        const STABILITY_API_KEY = getStabilityApiKey();
        if (!STABILITY_API_KEY) {
            return res.status(503).json({ success: false, error: '伺服器未設定 STABILITY_API_KEY' });
        }
        let background_prompt = backgroundPrompt;
        let foreground_prompt = typeof body.foreground_prompt === 'string' ? body.foreground_prompt.trim() : '';
        let negative_prompt = typeof body.negative_prompt === 'string' ? body.negative_prompt.trim() : '';
        if (background_prompt) background_prompt = await translatePromptToEnglish(background_prompt);
        if (foreground_prompt) foreground_prompt = await translatePromptToEnglish(foreground_prompt);
        if (negative_prompt) negative_prompt = await translatePromptToEnglish(negative_prompt);
        const outputFormat = (body.output_format === 'png' || body.output_format === 'jpeg') ? body.output_format : 'jpeg';

        const form = new FormData();
        form.append('subject_image', new Blob([subjectFile.buffer], { type: subjectFile.mimetype || 'image/png' }), subjectFile.originalname || 'subject.png');
        if (background_prompt) form.append('background_prompt', background_prompt);
        if (backgroundRefFile && backgroundRefFile.buffer) {
            form.append('background_reference', new Blob([backgroundRefFile.buffer], { type: backgroundRefFile.mimetype || 'image/png' }), backgroundRefFile.originalname || 'background_ref.png');
        }
        if (foreground_prompt) form.append('foreground_prompt', foreground_prompt);
        if (negative_prompt) form.append('negative_prompt', negative_prompt);
        const preserve = parseFloat(body.preserve_original_subject);
        if (!Number.isNaN(preserve) && preserve >= 0 && preserve <= 1) form.append('preserve_original_subject', String(preserve));
        const depth = parseFloat(body.original_background_depth);
        if (!Number.isNaN(depth) && depth >= 0 && depth <= 1) form.append('original_background_depth', String(depth));
        if (body.keep_original_background === 'true' || body.keep_original_background === true) form.append('keep_original_background', 'true');
        const lightStrength = parseFloat(body.light_source_strength);
        if (!Number.isNaN(lightStrength) && lightStrength >= 0 && lightStrength <= 1) form.append('light_source_strength', String(lightStrength));
        const lightRefFile = (files.light_reference && files.light_reference[0]) ? files.light_reference[0] : null;
        if (lightRefFile && lightRefFile.buffer) {
            form.append('light_reference', new Blob([lightRefFile.buffer], { type: lightRefFile.mimetype || 'image/png' }), lightRefFile.originalname || 'light_ref.png');
        }
        const lightDir = body.light_source_direction;
        if (lightDir && ['none', 'above', 'below', 'left', 'right'].includes(String(lightDir))) form.append('light_source_direction', String(lightDir));
        const seed = parseInt(body.seed, 10);
        if (Number.isInteger(seed)) form.append('seed', String(seed));
        form.append('output_format', outputFormat);

        const stabilityRes = await fetch('https://api.stability.ai/v2beta/stable-image/edit/replace-background-and-relight', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + STABILITY_API_KEY,
                Accept: 'application/json'
            },
            body: form
        });

        if (!stabilityRes.ok) {
            const errText = await stabilityRes.text();
            console.error('Stability replace-background-and-relight error:', stabilityRes.status, errText);
            return res.status(502).json({
                success: false,
                error: '置換背景與重打光服務暫時無法使用，請稍後再試',
                details: stabilityRes.status === 401 ? 'API Key 無效' : errText.slice(0, 200)
            });
        }

        const json = await stabilityRes.json();
        const artifact = json.artifacts && json.artifacts[0];
        const imageBase64 = artifact && artifact.base64 ? artifact.base64 : (json.image || '');
        if (!imageBase64) {
            return res.status(502).json({ success: false, error: '無法取得生成結果' });
        }

        if (!isAdmin && currentUser) {
            let pointsToDeduct = await getPointsAIReplaceBgRelight();
            if (pointsToDeduct > 0) {
                pointsToDeduct = await applyAiEditDiscountForSubscriber(currentUser.id, pointsToDeduct);
                const { data: credRow } = await supabase.from('user_credits').select('balance, total_spent').eq('user_id', currentUser.id).maybeSingle();
                const balance = (credRow && credRow.balance != null) ? credRow.balance : 0;
                if (balance < pointsToDeduct) {
                    return res.status(402).json({ success: false, error: '點數不足', balance, required: pointsToDeduct });
                }
                const balanceAfter = balance - pointsToDeduct;
                const totalSpent = (credRow ? (credRow.total_spent || 0) : 0) + pointsToDeduct;
                await supabase.from('user_credits').upsert({
                    user_id: currentUser.id,
                    balance: balanceAfter,
                    total_spent: totalSpent,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' });
                await supabase.from('credit_transactions').insert({
                    user_id: currentUser.id,
                    type: 'consumed',
                    amount: -pointsToDeduct,
                    balance_after: balanceAfter,
                    source: 'ai_replace_bg_relight',
                    description: '置換背景與重打光',
                    metadata: {}
                });
            }
        }

        const mime = outputFormat === 'png' ? 'image/png' : 'image/jpeg';
        res.json({
            success: true,
            imageData: 'data:' + mime + ';base64,' + imageBase64,
            output_format: outputFormat
        });
    } catch (e) {
        console.error('POST /api/replace-background-relight-image 異常:', e);
        if (!res.headersSent) res.status(500).json({ success: false, error: '生成失敗，請稍後再試', details: e.message });
    }
});

// API: 用 Gemini 閱讀參考圖並產生描述詞（輔助用，不生圖）；依 req.body.lang 回傳中文或英文
app.post('/api/describe-reference-images', express.json(), async (req, res) => {
    try {
        const { images, lang } = req.body;
        if (!images || !Array.isArray(images) || images.length === 0) {
            return res.status(400).json({ success: false, error: '請上傳至少一張參考圖' });
        }
        const parts = [];
        const maxImages = 8;
        for (let i = 0; i < Math.min(images.length, maxImages); i++) {
            const dataUrl = images[i];
            if (typeof dataUrl !== 'string') continue;
            if (dataUrl.startsWith('data:')) {
                // base64 data URL
                const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
                if (!match) continue;
                parts.push({ inlineData: { mimeType: match[1].trim() || 'image/jpeg', data: match[2].trim() } });
            } else if (dataUrl.startsWith('http://') || dataUrl.startsWith('https://')) {
                // 一般 URL（例如 Supabase Storage）：先 fetch 轉 base64
                try {
                    const fetchRes = await fetch(dataUrl);
                    if (!fetchRes.ok) continue;
                    const contentType = fetchRes.headers.get('content-type') || 'image/jpeg';
                    const mimeType = contentType.split(';')[0].trim();
                    const arrayBuf = await fetchRes.arrayBuffer();
                    const base64Data = Buffer.from(arrayBuf).toString('base64');
                    parts.push({ inlineData: { mimeType, data: base64Data } });
                } catch (_) { continue; }
            }
        }
        if (parts.length === 0) {
            return res.status(400).json({ success: false, error: '無法解析圖片格式' });
        }
        const useEnglish = (lang && String(lang).toLowerCase().replace(/-.*$/, '') === 'en');
        const textPrompt = useEnglish
            ? `You are an expert in product design and manufacturing. Based on the following ${parts.length} reference image(s), describe the product's appearance, material, style, structure, or key features in concise English, for use as a prompt for product design sketches. Output only the description text, no title or extra explanation.`
            : `你是產品設計與製造的專家。請根據以下 ${parts.length} 張參考圖，用簡潔的中文描述產品的外觀、材質、風格、結構或關鍵特徵，方便後續作為「產品設計草圖」的提示詞使用。只輸出描述文字，不要標題或額外說明。`;
        const modelName = await getReadModelName();
        const result = await runInGeminiQueue(() => genAI.models.generateContent({
            model: modelName,
            contents: [{ role: 'user', parts: [{ text: textPrompt }, ...parts] }]
        }));
        const text = (result && result.text != null ? String(result.text) : '')?.trim() || '';
        if (!text) {
            return res.status(500).json({ success: false, error: '無法產生描述' });
        }
        res.json({ success: true, description: text });
    } catch (e) {
        console.error('describe-reference-images 錯誤:', e);
        res.status(500).json({
            success: false,
            error: '讀圖產生描述時發生錯誤',
            details: e.message
        });
    }
});

// API: 分析客製產品並媒合廠商
app.post('/api/analyze-custom-product', upload.array('images', 10), async (req, res) => {
    try {
        const { category, category_key, subcategory_key, quantity, description, budgetMin, budgetMax, generatedImage, prompt } = req.body;
        const mainCategoryKey = (category_key != null && String(category_key).trim()) ? String(category_key).trim() : (category != null && String(category).trim()) ? String(category).trim() : null;
        const subCategoryKey = (subcategory_key != null && String(subcategory_key).trim()) ? String(subcategory_key).trim() : null;
        
        // 準備圖片資料
        let imageParts = [];
        
        if (req.files && req.files.length > 0) {
            imageParts = req.files.map(file => ({
                inlineData: {
                    data: (file.buffer || Buffer.from('')).toString('base64'),
                    mimeType: file.mimetype || 'image/jpeg'
                }
            }));
        } else if (generatedImage) {
            // AI 生成的圖片
            imageParts = [{
                inlineData: {
                    data: generatedImage,
                    mimeType: 'image/png'
                }
            }];
        } else {
            return res.status(400).json({ success: false, error: '請提供圖片' });
        }

        // AI 分析提示詞
        const imageCount = imageParts.length;
        const analysisPrompt = `你是專業的產品訂製分析師。請分析${imageCount > 1 ? `以下 ${imageCount} 張` : '以下'}產品圖片，並提供詳細的製作建議。

產品類別：${mainCategoryKey || category}
預計數量：${quantity}
${description ? `需求說明：${description}` : ''}
${prompt ? `設計理念：${prompt}` : ''}

${imageCount > 1 ? `注意：共有 ${imageCount} 張參考圖，請綜合分析所有圖片的特點，找出共同的設計元素和風格。` : ''}

請以 JSON 格式回應：
{
  "productType": "產品具體類型",
  "materials": ["所需材質1", "材質2"],
  "techniques": ["需要的工藝1", "工藝2"],
  "difficulty": "製作難度（簡單/中等/困難）",
  "estimatedDays": "預估製作天數",
  "keyFeatures": ["產品特點1", "特點2"],
  "designStyle": "${imageCount > 1 ? '綜合多張圖片的共同設計風格' : '設計風格'}",
  "recommendations": "製作建議"
}`;

        // 呼叫 AI 分析
        const modelName = await getReadModelName();
        const result = await runInGeminiQueue(() => genAI.models.generateContent({
            model: modelName,
            contents: [{ role: 'user', parts: [{ text: analysisPrompt }, ...imageParts] }]
        }));

        const responseText = (result && result.text != null ? String(result.text) : '') || '';
        let analysis;
        
        try {
            // 嘗試解析 JSON
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : {
                productType: '客製產品',
                materials: ['待確認'],
                techniques: ['手工訂製'],
                difficulty: '中等'
            };
        } catch (e) {
            console.error('解析 AI 回應失敗:', e);
            analysis = {
                productType: '客製產品',
                materials: ['待確認'],
                techniques: ['手工訂製'],
                difficulty: '中等',
                rawResponse: responseText
            };
        }

        // 查詢真實廠商資料
        const manufacturers = await queryManufacturers(mainCategoryKey || category, analysis);

        // 上傳圖片至 Storage，取得 publicUrl 陣列
        const imageUrls = [];
        if (req.files && req.files.length > 0) {
            for (const f of req.files) {
                try {
                    const { publicUrl } = await uploadToSupabaseStorage('custom-products', 'product', f);
                    imageUrls.push(publicUrl);
                } catch (e) {
                    console.warn('上傳至 Storage 失敗:', e.message);
                }
            }
        }
        const projectData = {
            category: mainCategoryKey || category,
            subcategory_key: subCategoryKey || null,
            quantity: parseInt(quantity) || 1,
            description: description || null,
            budget_min: budgetMin ? parseFloat(budgetMin) : null,
            budget_max: budgetMax ? parseFloat(budgetMax) : null,
            ai_analysis: analysis,
            image_urls: imageUrls,
            is_ai_generated: !!generatedImage,
            generation_prompt: prompt || null,
            status: 'published'
        };

        let savedProductId = null;
        try {
            const { data: savedProduct, error: saveError } = await supabase
                .from('custom_products')
                .insert(projectData)
                .select()
                .single();

            if (saveError) {
                console.error('儲存產品失敗:', saveError);
            } else {
                savedProductId = savedProduct.id;
                console.log('產品已儲存:', savedProductId);

                // 儲存媒合記錄
                if (manufacturers.length > 0 && savedProductId) {
                    const matchRecords = manufacturers.map(mfr => ({
                        product_id: savedProductId,
                        manufacturer_id: mfr.id,
                        match_score: mfr.matchScore,
                        match_reasons: {
                            category_match: true,
                            capabilities: mfr.capabilities || []
                        },
                        status: 'pending'
                    }));

                    const { error: matchError } = await supabase
                        .from('product_matches')
                        .insert(matchRecords);

                    if (matchError) {
                        console.error('儲存媒合記錄失敗:', matchError);
                    }
                }
            }
        } catch (e) {
            console.error('資料庫操作失敗:', e);
        }

        res.json({
            success: true,
            analysis,
            manufacturers,
            productId: savedProductId
        });

    } catch (error) {
        console.error('分析產品錯誤:', error);
        res.status(500).json({ success: false, error: error.message || '分析失敗' });
    }
});

// 查詢真實廠商資料
async function queryManufacturers(category, analysis) {
    try {
        // 從資料庫查詢廠商
        const { data: manufacturers, error } = await supabase
            .from('manufacturers')
            .select('*')
            .eq('status', 'active')
            .contains('production_capabilities', [category]);

        if (error) {
            console.error('查詢廠商失敗:', error);
            return generateMockManufacturers(category, analysis);
        }

        if (!manufacturers || manufacturers.length === 0) {
            // 如果沒有特定分類的廠商，查詢通用廠商
            const { data: generalMfrs } = await supabase
                .from('manufacturers')
                .select('*')
                .eq('status', 'active')
                .limit(5);

            manufacturers.push(...(generalMfrs || []));
        }

        // 計算匹配度
        return manufacturers.map(mfr => {
            let matchScore = 70; // 基礎分數

            // 根據能力加分
            if (mfr.production_capabilities) {
                const capabilities = Array.isArray(mfr.production_capabilities) 
                    ? mfr.production_capabilities 
                    : [];
                if (capabilities.includes(category)) matchScore += 15;
            }

            // 根據評分加分
            if (mfr.rating >= 4.5) matchScore += 10;
            if (mfr.rating >= 4.7) matchScore += 5;

            return {
                id: mfr.id,
                name: mfr.name,
                specialty: mfr.specialty,
                experience: mfr.experience,
                rating: mfr.rating,
                location: mfr.location,
                capabilities: mfr.production_capabilities,
                matchScore: Math.min(matchScore, 95)
            };
        }).sort((a, b) => b.matchScore - a.matchScore);

    } catch (e) {
        console.error('查詢廠商異常:', e);
        return generateMockManufacturers(category, analysis);
    }
}

// 模擬廠商推薦（備援）
function generateMockManufacturers(category, analysis) {
    const mockData = {
        furniture: [
            { name: '木工坊訂製', specialty: '實木家具訂製', experience: 15, rating: 4.8, location: '台北市' },
            { name: '現代傢俱工作室', specialty: '現代風格家具', experience: 8, rating: 4.6, location: '新北市' }
        ],
        decoration: [
            { name: '藝術裝飾工坊', specialty: '手工裝飾品', experience: 10, rating: 4.7, location: '台中市' },
            { name: '創意設計室', specialty: '客製化裝飾', experience: 6, rating: 4.5, location: '高雄市' }
        ],
        default: [
            { name: '全能訂製工坊', specialty: '各類產品訂製', experience: 12, rating: 4.6, location: '台北市' },
            { name: '精工製作所', specialty: '精密訂製', experience: 9, rating: 4.4, location: '桃園市' }
        ]
    };

    const manufacturers = mockData[category] || mockData.default;
    
    return manufacturers.map((mfr, idx) => ({
        id: `mfr-${Date.now()}-${idx}`,
        ...mfr,
        matchScore: Math.floor(75 + Math.random() * 20) // 75-95% 匹配度
    }));
}

// ============================================
// 客製產品 API (Custom Products)
// ============================================

// POST /api/custom-products - 儲存客製產品需求
app.post('/api/custom-products', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: '未授權：缺少 token' });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        
        if (authError || !user) {
            console.warn('POST /api/custom-products 401:', authError ? authError.message : 'no user');
            return res.status(401).json({ error: '未授權：token 無效' });
        }

        const { title, description, category, category_key, subcategory_key, reference_image_url, ai_generated_image_url, analysis_json, show_on_homepage, generation_prompt, generation_seed } = req.body;

        if (!title || !description) {
            console.warn('POST /api/custom-products 400: 缺少 title/description');
            return res.status(400).json({ error: '標題與描述為必填欄位' });
        }

        const mainCategoryVal = (category_key != null && String(category_key).trim()) ? String(category_key).trim() : (category != null && String(category).trim()) ? String(category).trim() : null;
        const subCategoryVal = (subcategory_key != null && String(subcategory_key).trim()) ? String(subcategory_key).trim() : null;

        console.log('POST /api/custom-products 儲存中 owner_id=%s title=%s category=%s sub=%s', user.id, (title || '').substring(0, 40), mainCategoryVal, subCategoryVal);

        let finalAnalysisJson = analysis_json && typeof analysis_json === 'object' ? analysis_json : null;
        if (show_on_homepage === true) {
            finalAnalysisJson = Object.assign({}, finalAnalysisJson || {}, { show_on_homepage: true });
        }
        const promptVal = (generation_prompt != null && String(generation_prompt).trim()) ? String(generation_prompt).trim() : null;
        const seedVal = (generation_seed != null && generation_seed !== '' && Number.isInteger(Number(generation_seed))) ? Number(generation_seed) : null;
        const insertPayload = {
            owner_id: user.id,
            title,
            description,
            category: mainCategoryVal,
            subcategory_key: subCategoryVal,
            reference_image_url: reference_image_url || null,
            ai_generated_image_url: ai_generated_image_url || null,
            analysis_json: finalAnalysisJson && Object.keys(finalAnalysisJson).length ? finalAnalysisJson : null,
            status: 'draft',
            generation_prompt: promptVal,
            generation_seed: seedVal,
            show_on_homepage: true
        };
        const { data, error } = await supabase
            .from('custom_products')
            .insert(insertPayload)
            .select()
            .single();

        if (error) {
            console.error('POST /api/custom-products 儲存失敗:', error.message, error);
            return res.status(500).json({ error: error.message });
        }

        console.log('POST /api/custom-products 儲存成功 id=%s owner_id=%s', data.id, user.id);
        res.json({ success: true, product: data });
    } catch (e) {
        console.error('POST /api/custom-products 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// GET /api/custom-products - 取得使用者的客製產品列表
// ?summary=1：只回傳是否有資料（輕量，僅 id），有資料再抓完整列表與圖
app.get('/api/custom-products', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: '未授權：缺少 token' });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        
        if (authError || !user) {
            return res.status(401).json({ error: '未授權：token 無效' });
        }

        const summaryOnly = req.query.summary === '1' || req.query.summary === 'true';
        const selectFields = summaryOnly ? 'id' : '*';

        const { data, error } = await supabase
            .from('custom_products')
            .select(selectFields)
            .eq('owner_id', user.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('查詢客製產品失敗:', error);
            return res.status(500).json({ error: error.message });
        }

        const list = data || [];
        if (summaryOnly) {
            return res.json({ success: true, hasItems: list.length > 0, count: list.length, products: list });
        }
        const ownerDisplay = (user.user_metadata && user.user_metadata.full_name) || user.email || '';
        const ownerEmail = user.email || '';
        const productsWithOwner = list.map(p => ({
            ...p,
            owner_email: ownerEmail,
            owner_display: ownerDisplay
        }));
        res.json({ success: true, products: productsWithOwner });
    } catch (e) {
        console.error('GET /api/custom-products 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// GET /api/custom-products/for-homepage - 首頁媒體牆用（公開，分頁）
// 若尚未執行 migration（無 show_on_homepage 欄位）則回傳空列表，避免首頁顯示「無法載入」
app.get('/api/custom-products/for-homepage', async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 24));
    const offset = (page - 1) * limit;

    try {
        const { data: items, error } = await supabase
            .from('custom_products')
            .select('id, title, category, ai_generated_image_url, reference_image_url, created_at')
            .eq('show_on_homepage', true)
            .not('ai_generated_image_url', 'eq', null)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            console.warn('查詢首頁媒體牆失敗（若尚未執行 migration 請執行 docs/add-custom-products-show-on-homepage.sql）:', error.message);
            res.set('Cache-Control', 'public, max-age=60');
            return res.status(200).json({ items: [], total: 0, page, limit });
        }

        const { count, error: countErr } = await supabase
            .from('custom_products')
            .select('*', { count: 'exact', head: true })
            .eq('show_on_homepage', true)
            .not('ai_generated_image_url', 'eq', null);

        const total = countErr ? (items || []).length : (count ?? 0);
        const list = (items || []).map(p => ({
            id: p.id,
            title: p.title,
            category: p.category,
            image_url: p.ai_generated_image_url || p.reference_image_url,
            created_at: p.created_at
        }));

        res.set('Cache-Control', 'public, max-age=120');
        res.json({ items: list, total, page, limit });
    } catch (e) {
        console.error('GET /api/custom-products/for-homepage 異常:', e);
        res.set('Cache-Control', 'public, max-age=60');
        res.status(200).json({ items: [], total: 0, page, limit });
    }
});

// GET /api/custom-products/for-makers — 訂製需求列表（製作方依分類篩選，供「聯絡訂製者」用）
// Query: category_key（必填）, subcategory_key（選填）, page, per_page
app.get('/api/custom-products/for-makers', async (req, res) => {
    try {
        const authHeader = req.headers.authorization?.replace(/^\s*Bearer\s+/i, '') || req.headers['x-auth-token'];
        if (!authHeader) return res.status(401).json({ error: '請先登入' });
        const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader);
        if (authError || !user) return res.status(401).json({ error: '登入已過期或無效' });

        const category_key = req.query.category_key || req.query.categoryKey;
        const subcategory_key = req.query.subcategory_key || req.query.subcategoryKey;
        const per_page = Math.min(Math.max(parseInt(req.query.per_page, 10) || 12, 1), 50);
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const offset = (page - 1) * per_page;

        if (!category_key) return res.status(400).json({ error: '請提供 category_key' });

        let query = supabase
            .from('custom_products')
            .select('id, title, description, category, subcategory_key, ai_generated_image_url, reference_image_url, owner_id, created_at', { count: 'exact' })
            .not('ai_generated_image_url', 'is', null)
            .eq('category', category_key);

        if (subcategory_key) {
            query = query.or('subcategory_key.eq.' + subcategory_key + ',subcategory_key.is.null');
        }

        const { data: items, error, count } = await query
            .order('created_at', { ascending: false })
            .range(offset, offset + per_page - 1);

        if (error) return res.status(500).json({ error: '查詢失敗' });

        const list = (items || []).map(p => ({
            id: p.id,
            title: p.title,
            description: p.description || '',
            category: p.category,
            subcategory_key: p.subcategory_key || null,
            image_url: p.ai_generated_image_url || p.reference_image_url,
            owner_id: p.owner_id,
            created_at: p.created_at
        }));

        res.json({ items: list, total: count ?? list.length, page, per_page });
    } catch (e) {
        console.error('GET /api/custom-products/for-makers 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// GET /api/media-wall - 首頁媒體牆三類型混合（50% 用戶設計 : 30% 廠商對比 : 20% 資料夾）
// 回傳單一陣列，每筆含 type('user_design'|'comparison'|'collection'), size('1x1'|'2x2'), 與對應欄位
// ?per_page=20&page=1&q=關鍵字&category_key=主分類&subcategory_key=子分類（篩選用戶設計）
app.get('/api/media-wall', async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const perPage = Math.min(50, Math.max(10, parseInt(req.query.per_page, 10) || 20));
    const offset = (page - 1) * perPage;
    const nUser = Math.round(perPage * 0.5);
    const nComparison = Math.round(perPage * 0.3);
    const nCollection = Math.max(0, Math.floor((perPage - nUser - nComparison) / 2)); // 每張資料夾佔 2 格(1x2)
    const searchQ = (req.query.q && String(req.query.q).trim()) || '';
    const filterCategoryKey = (req.query.category_key && String(req.query.category_key).trim()) || '';
    const filterSubcategoryKey = (req.query.subcategory_key && String(req.query.subcategory_key).trim()) || '';

    const out = [];
    const hasCategoryFilter = !!(filterCategoryKey || filterSubcategoryKey);

    try {
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
        let userQuery = supabase
            .from('custom_products')
            .select('id, title, category, subcategory_key, ai_generated_image_url, reference_image_url, created_at, owner_id, analysis_json, generation_prompt, generation_seed, show_on_homepage')
            .not('ai_generated_image_url', 'eq', null)
            .or('show_on_homepage.eq.true,show_on_homepage.is.null');
        if (categoryKeysToMatch && categoryKeysToMatch.length) userQuery = userQuery.in('category', categoryKeysToMatch);
        else if (filterCategoryKey) userQuery = userQuery.eq('category', filterCategoryKey);
        if (filterSubcategoryKey) userQuery = userQuery.eq('subcategory_key', filterSubcategoryKey);
        userQuery = userQuery.order('created_at', { ascending: false }).range(offset, offset + (hasCategoryFilter ? perPage : nUser) - 1);
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
            fallbackQuery = fallbackQuery.order('created_at', { ascending: false }).range(offset, offset + (hasCategoryFilter ? perPage : nUser) - 1);
            const fallback = await fallbackQuery;
            userRows = (fallback.data && fallback.data.length) ? fallback.data : [];
            if (filterSubcategoryKey && userRows.length) userRows = userRows.filter(p => (p.subcategory_key || '') === filterSubcategoryKey);
        }
        if (searchQ && userRows.length) {
            const q = searchQ.toLowerCase();
            userRows = userRows.filter(p => {
                const title = (p.title || '').toLowerCase();
                const prompt = ((p.analysis_json && p.analysis_json.generation_prompt) || p.generation_prompt || '').toString().toLowerCase();
                return title.includes(q) || prompt.includes(q);
            });
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
                out.push({
                    ...p,
                    analysis_json: aj || null,
                    generation_seed: seed != null && seed !== '' ? seed : null,
                    type: 'user_design',
                    size: '1x1',
                    title: p.title || '未命名',
                    image_url: p.ai_generated_image_url || p.reference_image_url,
                    link: '/custom/gallery.html',
                    owner_display: ownerDisplayMap[p.owner_id] || null,
                    category_key: p.category || null,
                    subcategory_key: p.subcategory_key || null
                });
            });
        }

        // 廠商對比：有分類篩選時只回傳該分類的對比圖，無篩選時回傳 show_on_media_wall 的項目（需 category_key 欄位請執行 docs/add-manufacturer-portfolio-category-fields.sql）
        let compRows = [];
        const compSelect = 'id, manufacturer_id, title, image_url, image_url_before, design_highlight, show_on_media_wall, category_key, subcategory_key';
        if (hasCategoryFilter && categoryKeysToMatch && categoryKeysToMatch.length) {
            let compQuery = supabase
                .from('manufacturer_portfolio')
                .select(compSelect)
                .eq('show_on_media_wall', true)
                .in('category_key', categoryKeysToMatch)
                .order('created_at', { ascending: false })
                .range(offset, offset + nComparison - 1);
            if (filterSubcategoryKey) compQuery = compQuery.eq('subcategory_key', filterSubcategoryKey);
            const compRes = await compQuery;
            if (!compRes.error) compRows = compRes.data || [];
            if (compRes.error && compRes.error.code !== '42703') console.warn('GET /api/media-wall 廠商對比（依分類）查詢:', compRes.error.message);
        } else {
            const compRes = await supabase
                .from('manufacturer_portfolio')
                .select(compSelect)
                .eq('show_on_media_wall', true)
                .order('created_at', { ascending: false })
                .range(offset, offset + nComparison - 1);
            if (!compRes.error) compRows = compRes.data || [];
            if (compRes.error && compRes.error.code !== '42703') console.warn('GET /api/media-wall 廠商對比查詢:', compRes.error.message);
            if (compRes.error && /column.*show_on_media_wall|column.*category_key|42703/i.test(compRes.error.message || compRes.error.code)) {
                const fallback = await supabase
                    .from('manufacturer_portfolio')
                    .select('id, manufacturer_id, title, image_url, image_url_before, design_highlight')
                    .order('created_at', { ascending: false })
                    .range(offset, offset + nComparison - 1);
                compRows = fallback.data || [];
            }
        }
        if (compRows && compRows.length) {
            compRows.forEach(p => {
                out.push({
                    type: 'comparison',
                    size: '1x1',
                    id: p.id,
                    manufacturer_id: p.manufacturer_id,
                    title: p.title || '對比範例',
                    image_url: p.image_url || null,
                    image_url_before: p.image_url_before || null,
                    design_highlight: p.design_highlight || null,
                    category_key: p.category_key || null,
                    subcategory_key: p.subcategory_key || null,
                    link: '/custom/gallery.html'
                });
            });
        }
        // 沒有對比圖時不顯示對比（不塞 demo），每種類型都要有分類

        // 資料夾：請先執行 docs/fix-media-collections-for-api.sql（補 title、關 RLS）
        let collRows = [];
        const collLimit = hasCategoryFilter ? Math.min(nCollection * 3, 30) : nCollection;
        if (collLimit > 0) {
            const collRes = await supabase
                .from('media_collections')
                .select('id, title, slug, cover_image_url, description, category_keys')
                .eq('is_active', true)
                .order('sort_order', { ascending: true })
                .order('created_at', { ascending: false })
                .range(offset, offset + collLimit - 1);
            let raw = (collRes.data || []);
            let canFilterByCategory = true;
            if (collRes.error && /column|42703/i.test(String(collRes.error.message || collRes.error.code))) {
                const simple = await supabase.from('media_collections').select('id, title, slug, cover_image_url, description').eq('is_active', true).order('sort_order', { ascending: true }).order('created_at', { ascending: false }).range(offset, offset + collLimit - 1);
                raw = simple.data || [];
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
                    }).slice(0, nCollection);
                }
            } else {
                collRows = raw.slice(0, nCollection);
            }
        }
        collRows.forEach(p => {
            const cover = p.cover_image_url || null;
            const imageUrls = (p.image_urls && Array.isArray(p.image_urls) && p.image_urls.length > 0) ? p.image_urls : (cover ? [cover, cover] : []);
            out.push({
                type: 'collection',
                size: '1x2',
                id: p.id,
                title: p.title || '系列',
                slug: p.slug,
                cover_image_url: cover,
                image_urls: imageUrls,
                description: p.description || null,
                link: p.slug ? '/custom/collection/' + p.slug : '/custom/gallery.html',
                category_keys: (p.category_keys && Array.isArray(p.category_keys)) ? p.category_keys : []
            });
        });

        res.set('Cache-Control', 'public, max-age=120');
        res.json({ items: out, page, per_page: perPage });
    } catch (e) {
        console.error('GET /api/media-wall 異常:', e);
        res.set('Cache-Control', 'public, max-age=60');
        res.status(200).json({ items: [], page, per_page: perPage });
    }
});

// PATCH /api/admin/media-wall-item — 管理員在首頁關閉/開啟個別項目顯示
app.patch('/api/admin/media-wall-item', express.json(), async (req, res) => {
    try {
        const adminUser = await requireAdmin(req, res);
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
        } else if (tid === 'comparison') {
            const { error } = await supabase.from('manufacturer_portfolio').update({ show_on_media_wall: show }).eq('id', id);
            if (error) {
                if (/column.*show_on_media_wall/i.test(error.message)) return res.status(503).json({ error: '請先執行媒體牆說明文件中 manufacturer_portfolio.show_on_media_wall 的 SQL' });
                return res.status(500).json({ error: error.message });
            }
        } else if (tid === 'collection') {
            const { error } = await supabase.from('media_collections').update({ is_active: show }).eq('id', id);
            if (error) return res.status(500).json({ error: error.message });
        } else {
            return res.status(400).json({ error: 'type 須為 user_design、comparison 或 collection' });
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
        const adminUser = await requireAdmin(req, res);
        if (!adminUser) return;
        const type = (req.body && req.body.type) || req.query.type;
        const id = (req.body && req.body.id) || req.query.id;
        if (!type || !id) {
            return res.status(400).json({ error: '請提供 type（user_design|comparison|collection）與 id' });
        }
        const tid = String(type).toLowerCase();
        if (tid === 'user_design') {
            const { error } = await supabase.from('custom_products').delete().eq('id', id);
            if (error) return res.status(500).json({ error: error.message });
            return res.json({ success: true, deleted: true });
        }
        if (tid === 'comparison') {
            const { error } = await supabase.from('manufacturer_portfolio').update({ show_on_media_wall: false }).eq('id', id);
            if (error) return res.status(500).json({ error: error.message });
            return res.json({ success: true, deleted: false, hidden: true });
        }
        if (tid === 'collection') {
            const { error } = await supabase.from('media_collections').update({ is_active: false }).eq('id', id);
            if (error) return res.status(500).json({ error: error.message });
            return res.json({ success: true, deleted: false, hidden: true });
        }
        return res.status(400).json({ error: 'type 須為 user_design、comparison 或 collection' });
    } catch (e) {
        console.error('DELETE /api/admin/media-wall-item 異常:', e);
        if (!res.headersSent) res.status(500).json({ error: '系統錯誤' });
    }
});

// ---------- 靈感牆資料夾編輯（1800 方案專用） ----------
const MEDIA_FOLDER_PLAN_KEY = '1800'; // 方案代碼，具此方案或管理員可編輯 media_collections

async function canEditMediaCollections(userId) {
    if (!userId) return false;
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single();
    if (profile?.role === 'admin' || profile?.role === 'tester') return true;
    const now = new Date().toISOString();
    const { data: rows } = await supabase
        .from('user_subscriptions')
        .select('id, subscription_plans(plan_key)')
        .eq('user_id', userId)
        .eq('status', 'active')
        .gt('end_date', now);
    return (rows || []).some(r => r.subscription_plans?.plan_key === MEDIA_FOLDER_PLAN_KEY);
}

async function requireMediaFolderEditor(req, res) {
    const user = await getCurrentUser(req, res);
    if (!user) return null;
    const allowed = await canEditMediaCollections(user.id);
    if (!allowed) {
        res.status(403).json({ error: '僅 1800 方案或管理員可編輯靈感牆資料夾' });
        return null;
    }
    return user;
}

// GET /api/me/can-edit-media-folders — 是否可編輯靈感牆資料夾（1800 方案或管理員）
app.get('/api/me/can-edit-media-folders', async (req, res) => {
    try {
        const user = await getCurrentUser(req, res);
        if (!user) return;
        const allowed = await canEditMediaCollections(user.id);
        res.json({ allowed });
    } catch (e) {
        console.error('GET /api/me/can-edit-media-folders:', e);
        if (!res.headersSent) res.status(500).json({ error: '系統錯誤' });
    }
});

function normalizeMediaCollectionRow(row) {
    if (!row) return row;
    const out = { ...row };
    if (out.title == null && out.name != null) out.title = out.name;
    return out;
}

// GET /api/media-collections — 列表（需先執行 docs/fix-media-collections-for-api.sql）
app.get('/api/media-collections', async (req, res) => {
    try {
        const editor = await requireMediaFolderEditor(req, res);
        if (!editor) return;
        const { data, error } = await supabase
            .from('media_collections')
            .select('id, title, slug, cover_image_url, description, sort_order, is_active, category_keys, created_at')
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: false });
        if (error) {
            console.error('GET /api/media-collections:', error);
            return res.status(500).json({ error: error.message });
        }
        res.json({ items: (data || []).map(normalizeMediaCollectionRow) });
    } catch (e) {
        console.error('GET /api/media-collections 異常:', e);
        if (!res.headersSent) res.status(500).json({ error: '系統錯誤' });
    }
});

// GET /api/media-collections/:id
app.get('/api/media-collections/:id', async (req, res) => {
    try {
        const editor = await requireMediaFolderEditor(req, res);
        if (!editor) return;
        const { data, error } = await supabase
            .from('media_collections')
            .select('id, title, slug, cover_image_url, description, sort_order, is_active, category_keys, created_at')
            .eq('id', req.params.id)
            .single();
        if (error) {
            if (error.code === 'PGRST116') return res.status(404).json({ error: '找不到該資料夾' });
            return res.status(500).json({ error: error.message });
        }
        res.json(normalizeMediaCollectionRow(data));
    } catch (e) {
        console.error('GET /api/media-collections/:id:', e);
        if (!res.headersSent) res.status(500).json({ error: '系統錯誤' });
    }
});

// PUT /api/media-collections/:id — 更新（僅 1800 方案或管理員）
app.put('/api/media-collections/:id', express.json(), async (req, res) => {
    try {
        const editor = await requireMediaFolderEditor(req, res);
        if (!editor) return;
        const body = req.body || {};
        const updates = {};
        if (body.title !== undefined) updates.title = String(body.title).trim() || null;
        if (body.slug !== undefined) updates.slug = String(body.slug).trim() || null;
        if (body.cover_image_url !== undefined) updates.cover_image_url = body.cover_image_url == null ? null : String(body.cover_image_url).trim();
        if (body.description !== undefined) updates.description = body.description == null ? null : String(body.description).trim();
        if (body.sort_order !== undefined) updates.sort_order = parseInt(body.sort_order, 10);
        if (body.is_active !== undefined) updates.is_active = !!body.is_active;
        if (body.category_keys !== undefined) updates.category_keys = Array.isArray(body.category_keys) ? body.category_keys.filter(Boolean).map(String) : [];
        if (Object.keys(updates).length === 0) return res.status(400).json({ error: '請提供要更新的欄位' });
        let result = await supabase.from('media_collections').update(updates).eq('id', req.params.id).select().single();
        if (result.error && /column.*title|42703/i.test(result.error.message || result.error.code)) {
            if (updates.title !== undefined) {
                updates.name = updates.title;
                delete updates.title;
            }
            result = await supabase.from('media_collections').update(updates).eq('id', req.params.id).select().single();
        }
        const { data, error } = result;
        if (error) {
            if (error.code === '23505') return res.status(400).json({ error: '該 slug 已被使用' });
            return res.status(500).json({ error: error.message });
        }
        res.json(normalizeMediaCollectionRow(data));
    } catch (e) {
        console.error('PUT /api/media-collections/:id:', e);
        if (!res.headersSent) res.status(500).json({ error: '系統錯誤' });
    }
});

// POST /api/media-collections — 新增（僅 1800 方案或管理員）
app.post('/api/media-collections', express.json(), async (req, res) => {
    try {
        const editor = await requireMediaFolderEditor(req, res);
        if (!editor) return;
        const body = req.body || {};
        const titleVal = (body.title && String(body.title).trim()) || '';
        const slug = (body.slug && String(body.slug).trim()) || '';
        if (!titleVal) return res.status(400).json({ error: '請填寫標題' });
        const categoryKeys = Array.isArray(body.category_keys) ? body.category_keys.filter(Boolean).map(String) : [];
        let row = {
            title: titleVal,
            slug: slug || null,
            cover_image_url: body.cover_image_url == null ? null : String(body.cover_image_url).trim(),
            description: body.description == null ? null : String(body.description).trim(),
            sort_order: parseInt(body.sort_order, 10) || 0,
            is_active: body.is_active !== false,
            category_keys: categoryKeys
        };
        let result = await supabase.from('media_collections').insert(row).select().single();
        if (result.error && /column.*title|42703/i.test(result.error.message || result.error.code)) {
            row = {
                name: titleVal,
                slug: row.slug,
                cover_image_url: row.cover_image_url,
                description: row.description,
                sort_order: row.sort_order,
                is_active: row.is_active,
                category_keys: row.category_keys
            };
            result = await supabase.from('media_collections').insert(row).select().single();
        }
        const { data, error } = result;
        if (error) {
            if (error.code === '23505') return res.status(400).json({ error: '該 slug 已被使用' });
            return res.status(500).json({ error: error.message });
        }
        res.status(201).json(normalizeMediaCollectionRow(data));
    } catch (e) {
        console.error('POST /api/media-collections:', e);
        if (!res.headersSent) res.status(500).json({ error: '系統錯誤' });
    }
});

// GET /api/custom-products/:id - 取得單一客製產品詳細資訊
app.get('/api/custom-products/:id', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: '未授權：缺少 token' });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        
        if (authError || !user) {
            return res.status(401).json({ error: '未授權：token 無效' });
        }

        const { data, error } = await supabase
            .from('custom_products')
            .select('*')
            .eq('id', req.params.id)
            .eq('owner_id', user.id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({ error: '產品不存在或無權限' });
            }
            console.error('查詢客製產品失敗:', error);
            return res.status(500).json({ error: error.message });
        }

        const ownerDisplay = (user.user_metadata && user.user_metadata.full_name) || user.email || '';
        const ownerEmail = user.email || '';
        res.json({
            success: true,
            product: {
                ...data,
                owner_email: ownerEmail,
                owner_display: ownerDisplay
            }
        });
    } catch (e) {
        console.error('GET /api/custom-products/:id 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// PATCH /api/custom-products/:id - 更新客製產品（僅基底欄位；show_on_homepage 需先執行 add-custom-products-show-on-homepage.sql）
app.patch('/api/custom-products/:id', express.json(), async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: '未授權：缺少 token' });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            return res.status(401).json({ error: '未授權：token 無效' });
        }

        const { data: product, error: productError } = await supabase
            .from('custom_products')
            .select('id')
            .eq('id', req.params.id)
            .eq('owner_id', user.id)
            .single();

        if (productError || !product) {
            return res.status(404).json({ error: '產品不存在或無權限' });
        }

        const allowed = ['title', 'description', 'category', 'category_key', 'subcategory_key', 'status', 'show_on_homepage'];
        const updates = {};
        for (const key of allowed) {
            if (req.body[key] !== undefined) {
                if (key === 'show_on_homepage') updates[key] = !!req.body[key];
                else if (key === 'category_key') updates.category = req.body[key];
                else if (key === 'subcategory_key') updates.subcategory_key = req.body[key];
                else updates[key] = req.body[key];
            }
        }
        // show_on_homepage：body 可能未被解析，改為同時接受 query（需先執行 add-custom-products-show-on-homepage.sql）
        if (typeof req.query.show_on_homepage !== 'undefined') {
            updates.show_on_homepage = req.query.show_on_homepage === 'true' || req.query.show_on_homepage === '1';
        }
        if (typeof req.body.show_on_homepage !== 'undefined') {
            updates.show_on_homepage = !!req.body.show_on_homepage;
        }
        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: '無可更新欄位' });
        }
        // 只有付費會員才可將圖片設為不公開（show_on_homepage: false）
        if (updates.show_on_homepage === false) {
            const isPaid = await hasActivePaidSubscription(user.id);
            if (!isPaid) {
                return res.status(403).json({ error: '需付費訂閱才能將設計圖設為不公開' });
            }
        }

        const { data, error } = await supabase
            .from('custom_products')
            .update(updates)
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) {
            console.error('更新客製產品失敗:', error);
            const msg = (error.message || '');
            if (/column.*show_on_homepage|show_on_homepage.*does not exist/i.test(msg)) {
                return res.status(503).json({ error: '資料庫尚未新增 show_on_homepage 欄位，請在 Supabase 執行 docs/add-custom-products-show-on-homepage.sql' });
            }
            return res.status(500).json({ error: error.message });
        }
        res.json({ success: true, product: data });
    } catch (e) {
        console.error('PATCH /api/custom-products/:id 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// GET /api/custom-products/:id/manufacturers — 依產品分類取得製作方列表（與找製作方同邏輯，不寫入 DB）
app.get('/api/custom-products/:id/manufacturers', async (req, res) => {
    try {
        const authHeader = req.headers.authorization?.replace(/^\s*Bearer\s+/i, '') || req.headers['x-auth-token'];
        if (!authHeader) return res.status(401).json({ error: '請先登入' });
        const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader);
        if (authError || !user) return res.status(401).json({ error: '登入已過期或無效' });

        const { data: product, error: productError } = await supabase
            .from('custom_products')
            .select('id, category, subcategory_key, owner_id, analysis_json, title, description')
            .eq('id', req.params.id)
            .eq('owner_id', user.id)
            .single();

        if (productError || !product) return res.status(404).json({ error: '產品不存在或無權限' });

        const category = (product.category && String(product.category).trim()) ? String(product.category).trim() : inferProductCategory(product);
        const per_page = Math.min(parseInt(req.query.per_page, 10) || 20, 50);

        let manufacturers = [];
        let fromSub = [];
        let fromMain = [];

        if (category && category !== 'default') {
            const { data: mainList, error: eMain } = await supabase
                .from('manufacturers')
                .select('id, name, description, location, rating, contact_json, capabilities, verified, categories, user_id')
                .eq('is_active', true)
                .contains('categories', [category]);
            if (!eMain && mainList) manufacturers = mainList;
        }
        if (manufacturers.length === 0) {
            const mocks = generateMockManufacturersForCustomProduct(category, product.analysis_json || {});
            return res.json({ manufacturers: mocks, from_match: false });
        }

        const ids = manufacturers.map(m => m.id);
        let portfolioByMfr = {};
        if (ids.length > 0) {
            const { data: portfolios } = await supabase
                .from('manufacturer_portfolio')
                .select('id, manufacturer_id, title, image_url, image_url_before, design_highlight, tags, sort_order')
                .in('manufacturer_id', ids)
                .order('sort_order', { ascending: true });
            (portfolios || []).forEach(p => {
                if (!portfolioByMfr[p.manufacturer_id]) portfolioByMfr[p.manufacturer_id] = [];
                portfolioByMfr[p.manufacturer_id].push({ id: p.id, title: p.title, image_url: p.image_url, image_url_before: p.image_url_before || null, design_highlight: p.design_highlight || null, tags: p.tags || [] });
            });
        }

        const list = manufacturers.slice(0, per_page).map(mfr => ({
            id: mfr.id,
            name: mfr.name,
            specialty: mfr.description || mfr.name,
            rating: mfr.rating,
            location: mfr.location,
            capabilities: mfr.capabilities,
            contact: mfr.contact_json,
            verified: mfr.verified,
            user_id: mfr.user_id || null,
            portfolio: portfolioByMfr[mfr.id] || [],
            matchScore: 100,
            matchReasons: { category_match: true }
        })).sort((a, b) => (b.rating || 0) - (a.rating || 0));

        res.json({ manufacturers: list, from_match: true });
    } catch (e) {
        console.error('GET /api/custom-products/:id/manufacturers 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// POST /api/custom-products/:id/match - 執行廠商媒合
app.post('/api/custom-products/:id/match', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: '未授權：缺少 token' });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        
        if (authError || !user) {
            return res.status(401).json({ error: '未授權：token 無效' });
        }

        // 驗證產品擁有權
        const { data: product, error: productError } = await supabase
            .from('custom_products')
            .select('*')
            .eq('id', req.params.id)
            .eq('owner_id', user.id)
            .single();

        if (productError || !product) {
            return res.status(404).json({ error: '產品不存在或無權限' });
        }

        // 更新產品狀態為 analyzing
        await supabase
            .from('custom_products')
            .update({ status: 'analyzing' })
            .eq('id', req.params.id);

        // 執行媒合邏輯
        const matches = await matchManufacturers(product);

        // 儲存媒合結果（使用 service role 繞過 RLS）
        const matchRecords = matches.map(m => ({
            custom_product_id: product.id,
            manufacturer_id: m.id,
            match_score: m.matchScore,
            match_reasons: m.matchReasons || {},
            status: 'pending'
        }));

        const { error: insertError } = await supabase
            .from('custom_product_matches')
            .insert(matchRecords);

        if (insertError) {
            console.error('儲存媒合結果失敗:', insertError);
        }

        // 更新產品狀態為 matched
        await supabase
            .from('custom_products')
            .update({ status: 'matched' })
            .eq('id', req.params.id);

        res.json({ success: true, matches });
    } catch (e) {
        console.error('POST /api/custom-products/:id/match 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// POST /api/custom-products/:id/contact - 聯繫廠商
app.post('/api/custom-products/:id/contact', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: '未授權：缺少 token' });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        
        if (authError || !user) {
            return res.status(401).json({ error: '未授權：token 無效' });
        }

        const { manufacturer_id } = req.body;
        if (!manufacturer_id) {
            return res.status(400).json({ error: '缺少廠商 ID' });
        }

        // 驗證產品擁有權
        const { data: product, error: productError } = await supabase
            .from('custom_products')
            .select('*')
            .eq('id', req.params.id)
            .eq('owner_id', user.id)
            .single();

        if (productError || !product) {
            return res.status(404).json({ error: '產品不存在或無權限' });
        }

        // 更新媒合記錄狀態為 contacted
        const { error: updateError } = await supabase
            .from('custom_product_matches')
            .update({ status: 'contacted' })
            .eq('custom_product_id', req.params.id)
            .eq('manufacturer_id', manufacturer_id);

        if (updateError) {
            console.error('更新聯繫狀態失敗:', updateError);
            return res.status(500).json({ error: updateError.message });
        }

        // 更新產品狀態
        await supabase
            .from('custom_products')
            .update({ status: 'contacted' })
            .eq('id', req.params.id);

        res.json({ success: true, message: '已記錄聯繫狀態' });
    } catch (e) {
        console.error('POST /api/custom-products/:id/contact 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// 從產品標題／描述／分析推斷分類（未填分類時用，避免西裝出現 3D 列印等）
function inferProductCategory(product) {
    const raw = (product.category || '').toString().trim();
    if (raw) return raw;
    const title = (product.title || '').toString();
    const desc = (product.description || '').toString();
    const analysis = product.analysis_json && typeof product.analysis_json === 'object' ? JSON.stringify(product.analysis_json) : '';
    const text = (title + ' ' + desc + ' ' + analysis).toLowerCase();
    if (/西裝|服飾|服裝|衣服|tshirt|shirt|suit|dress|apparel/.test(text)) return 'apparel';
    if (/家具|傢俱|木工|沙發|furniture/.test(text)) return 'furniture';
    if (/運動|sports/.test(text)) return 'sports_goods';
    return 'default';
}

// 訂製品廠商：分類符合即可瀏覽，不做深度媒合
async function matchManufacturers(product) {
    try {
        const category = inferProductCategory(product);

        let query = supabase
            .from('manufacturers')
            .select('*')
            .eq('is_active', true);

        if (category && category !== 'default') {
            query = query.contains('categories', [category]);
        }

        const { data: manufacturers, error } = await query;

        if (error) {
            console.error('查詢廠商失敗:', error);
            return generateMockManufacturersForCustomProduct(category, product.analysis_json || {});
        }

        if (!manufacturers || manufacturers.length === 0) {
            return generateMockManufacturersForCustomProduct(category, product.analysis_json || {});
        }

        // 分類符合即列入，不計算深度媒合分數；僅依評分排序供瀏覽
        return manufacturers.map(mfr => ({
            id: mfr.id,
            name: mfr.name,
            specialty: mfr.description || mfr.name,
            rating: mfr.rating,
            location: mfr.location,
            capabilities: mfr.capabilities,
            contact: mfr.contact_json,
            matchScore: 100,
            matchReasons: { category_match: true }
        })).sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } catch (e) {
        console.error('媒合廠商異常:', e);
        return generateMockManufacturersForCustomProduct(product.category, product.analysis_json || {});
    }
}

// GET /api/me/profile — 當前登入用戶的 profiles 資料（由後端代查，避免前端直連 Supabase 造成 CORS/502）
app.get('/api/me/profile', async (req, res) => {
    try {
        const authHeader = req.headers.authorization || req.headers['x-auth-token'];
        const token = authHeader && (authHeader.replace(/^\s*Bearer\s+/i, '') || authHeader);
        if (!token) return res.status(401).json({ error: '請先登入' });
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: '登入已過期或無效' });
        const { data: profile, error: profErr } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();
        if (profErr) {
            console.error('GET /api/me/profile:', profErr);
            return res.status(500).json({ error: '查詢失敗' });
        }
        if (profile) return res.json(profile);
        res.json({
            id: user.id,
            email: user.email || '',
            full_name: user.user_metadata?.full_name || '',
            role: user.user_metadata?.role || 'user'
        });
    } catch (e) {
        console.error('GET /api/me/profile 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// GET /api/me/manufacturer — 登入後取得「我的廠商」（同一帳號即為廠商，自動對應一筆廠商資料）
app.get('/api/me/manufacturer', async (req, res) => {
    try {
        const authHeader = req.headers.authorization || req.headers['x-auth-token'];
        const token = authHeader && (authHeader.replace(/^\s*Bearer\s+/i, '') || authHeader);
        if (!token) return res.status(401).json({ error: '請先登入' });
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: '登入已過期或無效' });
        const { data: mfr, error } = await supabase
            .from('manufacturers')
            .select('id, name, description, location, categories, contact_json')
            .eq('user_id', user.id)
            .maybeSingle();
        if (error) {
            console.error('GET /api/me/manufacturer:', error);
            return res.status(500).json({ error: '查詢失敗' });
        }
        if (!mfr) return res.status(404).json({ error: '尚未建立廠商資料', code: 'NO_MANUFACTURER' });
        res.json(mfr);
    } catch (e) {
        console.error('GET /api/me/manufacturer 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// POST /api/me/manufacturer — 登入廠商「建立我的廠商資料」（第一次使用時填寫，不需管理員綁定）
app.post('/api/me/manufacturer', express.json(), async (req, res) => {
    try {
        const authHeader = req.headers.authorization || req.headers['x-auth-token'];
        const token = authHeader && (authHeader.replace(/^\s*Bearer\s+/i, '') || authHeader);
        if (!token) return res.status(401).json({ error: '請先登入' });
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: '登入已過期或無效' });
        const { data: existing } = await supabase.from('manufacturers').select('id').eq('user_id', user.id).maybeSingle();
        if (existing) return res.status(400).json({ error: '您已有廠商資料，請直接管理作品' });
        const body = req.body || {};
        const name = (body.name || '').trim();
        if (!name) return res.status(400).json({ error: '請填寫廠商名稱' });
        const contact_json = body.contact_json || {
            email: body.email || user.email || '',
            phone: body.phone || '',
            line_id: body.line_id || '',
            url: body.url || body.website || ''
        };
        const { data: inserted, error } = await supabase
            .from('manufacturers')
            .insert({
                user_id: user.id,
                name,
                description: (body.description || '').trim() || null,
                location: (body.location || '').trim() || null,
                contact_json
            })
            .select('id, name, description, location, contact_json')
            .single();
        if (error) {
            console.error('POST /api/me/manufacturer:', error);
            return res.status(500).json({ error: '建立失敗' });
        }
        res.status(201).json(inserted);
    } catch (e) {
        console.error('POST /api/me/manufacturer 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// GET /api/manufacturers — 依分類取得廠商清單（訂製品設計者「找製作方」用）
// Query: category（單一分類，舊版相容） 或 category_key + subcategory_key（子分類優先，不足一頁用主分類填滿）
// 當有 category_key 時：先查 subcategory_key 符合的製作方，不足 per_page 時用 category_key 補滿一頁（子分類排前、去重）
app.get('/api/manufacturers', async (req, res) => {
    try {
        const category = req.query.category;
        const category_key = req.query.category_key || req.query.categoryKey;
        const subcategory_key = req.query.subcategory_key || req.query.subcategoryKey;
        const q = (req.query.q || '').trim();
        const per_page = Math.min(Math.max(parseInt(req.query.per_page || req.query.perPage, 10) || 12, 1), 50);
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

        const baseSelect = 'id, name, description, location, rating, contact_json, capabilities, verified, categories, user_id';
        let manufacturers = [];
        let fromSub = [];
        let fromMain = [];

        if (category_key || subcategory_key) {
            if (subcategory_key) {
                const { data: subList, error: eSub } = await supabase
                    .from('manufacturers')
                    .select(baseSelect)
                    .eq('is_active', true)
                    .contains('categories', [subcategory_key]);
                if (!eSub && subList) fromSub = subList;
            }
            const subIds = new Set(fromSub.map(m => m.id));
            if (category_key) {
                const { data: mainList, error: eMain } = await supabase
                    .from('manufacturers')
                    .select(baseSelect)
                    .eq('is_active', true)
                    .contains('categories', [category_key]);
                if (!eMain && mainList) fromMain = mainList.filter(m => !subIds.has(m.id));
            }
            manufacturers = [...fromSub, ...fromMain];
            // 關鍵字過濾
            if (q) {
                const ql = q.toLowerCase();
                manufacturers = manufacturers.filter(m =>
                    (m.name || '').toLowerCase().includes(ql) ||
                    (m.description || '').toLowerCase().includes(ql)
                );
            }
            const start = (page - 1) * per_page;
            manufacturers = manufacturers.slice(start, start + per_page);
        } else if (category && category !== 'default') {
            const { data, error } = await supabase
                .from('manufacturers')
                .select(baseSelect)
                .eq('is_active', true)
                .contains('categories', [category]);
            if (error) {
                console.error('GET /api/manufacturers 查詢失敗:', error);
                return res.status(500).json({ error: '查詢廠商失敗' });
            }
            manufacturers = data || [];
            if (q) {
                const ql = q.toLowerCase();
                manufacturers = manufacturers.filter(m =>
                    (m.name || '').toLowerCase().includes(ql) ||
                    (m.description || '').toLowerCase().includes(ql)
                );
            }
            const start = (page - 1) * per_page;
            manufacturers = manufacturers.slice(start, start + per_page);
        } else {
            let query = supabase
                .from('manufacturers')
                .select(baseSelect)
                .eq('is_active', true)
                .order('rating', { ascending: false });
            if (q) {
                query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`);
            }
            const { data, error } = await query;
            if (error) {
                console.error('GET /api/manufacturers 查詢失敗:', error);
                return res.status(500).json({ error: '查詢廠商失敗' });
            }
            manufacturers = (data || []).slice((page - 1) * per_page, page * per_page);
        }

        const ids = manufacturers.map(m => m.id);
        let portfolioByMfr = {};
        if (ids.length > 0) {
            const { data: portfolios } = await supabase
                .from('manufacturer_portfolio')
                .select('id, manufacturer_id, title, image_url, image_url_before, design_highlight, tags, sort_order')
                .in('manufacturer_id', ids)
                .order('sort_order', { ascending: true });
            (portfolios || []).forEach(p => {
                if (!portfolioByMfr[p.manufacturer_id]) portfolioByMfr[p.manufacturer_id] = [];
                portfolioByMfr[p.manufacturer_id].push({ id: p.id, title: p.title, image_url: p.image_url, image_url_before: p.image_url_before || null, design_highlight: p.design_highlight || null, tags: p.tags || [] });
            });
        }

        const list = manufacturers.map(mfr => ({
            id: mfr.id,
            name: mfr.name,
            specialty: mfr.description || mfr.name,
            rating: mfr.rating,
            location: mfr.location,
            capabilities: mfr.capabilities,
            contact: mfr.contact_json,
            verified: mfr.verified,
            categories: mfr.categories || [],
            user_id: mfr.user_id || null,
            portfolio: portfolioByMfr[mfr.id] || []
        })).sort((a, b) => (b.rating || 0) - (a.rating || 0));

        res.json({ manufacturers: list });
    } catch (e) {
        console.error('GET /api/manufacturers 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// GET /api/manufacturers/:id — 單一廠商詳情（vendor-profile.html 用）
app.get('/api/manufacturers/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { data: mfr, error } = await supabase
            .from('manufacturers')
            .select('id, name, description, location, rating, contact_json, capabilities, verified, categories, user_id')
            .eq('id', id)
            .eq('is_active', true)
            .maybeSingle();
        if (error) return res.status(500).json({ error: '查詢失敗' });
        if (!mfr) return res.status(404).json({ error: '廠商不存在' });

        const { data: portfolio } = await supabase
            .from('manufacturer_portfolio')
            .select('id, title, description, image_url, image_url_before, design_highlight, tags, category_key, subcategory_key, sort_order')
            .eq('manufacturer_id', id)
            .order('sort_order', { ascending: true });

        res.json({
            id: mfr.id,
            name: mfr.name,
            specialty: mfr.description || '',
            rating: mfr.rating,
            location: mfr.location,
            capabilities: mfr.capabilities,
            contact: mfr.contact_json || {},
            verified: mfr.verified,
            categories: mfr.categories || [],
            portfolio: portfolio || []
        });
    } catch (e) {
        console.error('GET /api/manufacturers/:id 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// GET /api/manufacturer-portfolio — 廠商作品圖列表（圖庫找廠商、從圖庫選擇、純文字搜廠商圖）
// Query: manufacturer_id（單一廠商）, category（依廠商分類篩選）, keyword / q（搜尋 title、tags）
app.get('/api/manufacturer-portfolio', async (req, res) => {
    try {
        const { manufacturer_id, category, keyword, q } = req.query;
        const search = keyword || q;

        let portfolioQuery = supabase
            .from('manufacturer_portfolio')
            .select('id, manufacturer_id, title, description, image_url, image_url_before, design_highlight, tags, sort_order, category_key, subcategory_key, created_at');

        if (manufacturer_id) {
            portfolioQuery = portfolioQuery.eq('manufacturer_id', manufacturer_id);
        }

        if (category && category !== 'default') {
            const { data: mfrIds } = await supabase
                .from('manufacturers')
                .select('id')
                .eq('is_active', true)
                .contains('categories', [category]);
            const ids = (mfrIds || []).map(m => m.id);
            if (ids.length === 0) return res.json({ items: [] });
            portfolioQuery = portfolioQuery.in('manufacturer_id', ids);
        }

        portfolioQuery = portfolioQuery.order('sort_order', { ascending: true }).order('created_at', { ascending: false });

        const { data: items, error } = await portfolioQuery;

        if (error) {
            console.error('GET /api/manufacturer-portfolio 失敗:', error);
            return res.status(500).json({ error: '查詢作品圖失敗' });
        }

        let list = items || [];
        if (search && String(search).trim()) {
            const k = String(search).trim().toLowerCase();
            list = list.filter(p => {
                const titleMatch = (p.title || '').toLowerCase().includes(k);
                const tagsMatch = Array.isArray(p.tags) && p.tags.some(t => String(t).toLowerCase().includes(k));
                const highlightMatch = (p.design_highlight || '').toLowerCase().includes(k);
                return titleMatch || tagsMatch || highlightMatch;
            });
        }

        const mfrIds = [...new Set(list.map(p => p.manufacturer_id))];
        let mfrMap = {};
        if (mfrIds.length > 0) {
            const { data: mfrs } = await supabase.from('manufacturers').select('id, name, location, categories, contact_json').in('id', mfrIds);
            (mfrs || []).forEach(m => { mfrMap[m.id] = m; });
        }

        const result = list.map(p => ({
            id: p.id,
            manufacturer_id: p.manufacturer_id,
            manufacturer_name: mfrMap[p.manufacturer_id]?.name || '',
            manufacturer_location: mfrMap[p.manufacturer_id]?.location || '',
            manufacturer_contact: mfrMap[p.manufacturer_id]?.contact_json || null,
            categories: mfrMap[p.manufacturer_id]?.categories || [],
            title: p.title,
            description: p.description,
            image_url: p.image_url,
            image_url_before: p.image_url_before || null,
            design_highlight: p.design_highlight || null,
            tags: p.tags || [],
            sort_order: p.sort_order,
            category_key: p.category_key || null,
            subcategory_key: p.subcategory_key || null
        }));

        if (result.length === 0) {
            console.warn('GET /api/manufacturer-portfolio 回傳 0 筆。若首頁媒體牆有廠商作品，請確認 .env 已設 SUPABASE_SERVICE_ROLE_KEY 並在 Supabase 執行過 docs/seed-manufacturers-and-portfolio.sql');
        }
        res.json({ items: result });
    } catch (e) {
        console.error('GET /api/manufacturer-portfolio 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// POST /api/manufacturers/:id/portfolio — 上傳廠商作品圖（主圖、第二張圖、作品重點）
app.post('/api/manufacturers/:id/portfolio', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'image_before', maxCount: 1 }]), async (req, res) => {
    try {
        const manufacturerId = req.params.id;
        const body = req.body || {};
        const { title, description, design_highlight, tags: tagsParam, image_url: bodyImageUrl, image_url_before: bodyImageUrlBefore, category_key: bodyCategoryKey, subcategory_key: bodySubcategoryKey } = body;
        const tags = Array.isArray(tagsParam) ? tagsParam : (typeof tagsParam === 'string' && tagsParam ? tagsParam.split(/[,，\s]+/).filter(Boolean) : []);
        const categoryKey = (bodyCategoryKey != null && String(bodyCategoryKey).trim()) ? String(bodyCategoryKey).trim() : null;
        const subcategoryKey = (bodySubcategoryKey != null && String(bodySubcategoryKey).trim()) ? String(bodySubcategoryKey).trim() : null;

        const files = req.files || {};
        const mainFile = (files.image && files.image[0]) || null;
        const beforeFile = (files.image_before && files.image_before[0]) || null;

        const { data: mfr } = await supabase.from('manufacturers').select('id').eq('id', manufacturerId).single();
        if (!mfr) return res.status(404).json({ error: '找不到該廠商' });

        if (!mainFile && !bodyImageUrl) {
            return res.status(400).json({ error: '請上傳作品圖片或提供 image_url' });
        }

        let imageUrl = bodyImageUrl;
        if (mainFile) {
            const { publicUrl } = await uploadToSupabaseStorage('custom-products', `manufacturer/${manufacturerId}`, mainFile);
            imageUrl = publicUrl;
        }

        let imageUrlBefore = bodyImageUrlBefore || null;
        if (beforeFile) {
            const { publicUrl } = await uploadToSupabaseStorage('custom-products', `manufacturer/${manufacturerId}`, beforeFile);
            imageUrlBefore = publicUrl;
        }

        const { data: inserted, error } = await supabase
            .from('manufacturer_portfolio')
            .insert({
                manufacturer_id: manufacturerId,
                title: title || null,
                description: description || null,
                design_highlight: design_highlight || null,
                image_url: imageUrl,
                image_url_before: imageUrlBefore,
                tags: tags.length ? tags : [],
                category_key: categoryKey,
                subcategory_key: subcategoryKey
            })
            .select('id, manufacturer_id, title, description, design_highlight, image_url, image_url_before, tags, sort_order, category_key, subcategory_key, created_at')
            .single();

        if (error) {
            console.error('POST /api/manufacturers/:id/portfolio 失敗:', error);
            return res.status(500).json({ error: '新增作品圖失敗' });
        }
        res.status(201).json(inserted);
    } catch (e) {
        console.error('POST /api/manufacturers/:id/portfolio 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// PUT /api/manufacturers/:id/portfolio/:portfolioId — 更新廠商作品（作品重點、主圖／第二張圖）
app.put('/api/manufacturers/:manufacturerId/portfolio/:portfolioId', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'image_before', maxCount: 1 }]), async (req, res) => {
    try {
        const { manufacturerId, portfolioId } = req.params;
        const body = req.body || {};
        const { title, description, design_highlight, tags: tagsParam, image_url: bodyImageUrl, image_url_before: bodyImageUrlBefore, category_key: bodyCategoryKey, subcategory_key: bodySubcategoryKey } = body;
        const tags = Array.isArray(tagsParam) ? tagsParam : (typeof tagsParam === 'string' && tagsParam ? tagsParam.split(/[,，\s]+/).filter(Boolean) : []);

        const files = req.files || {};
        const mainFile = (files.image && files.image[0]) || null;
        const beforeFile = (files.image_before && files.image_before[0]) || null;

        const { data: row } = await supabase.from('manufacturer_portfolio').select('id, image_url, image_url_before').eq('id', portfolioId).eq('manufacturer_id', manufacturerId).single();
        if (!row) return res.status(404).json({ error: '找不到該作品' });

        const updates = {
            updated_at: new Date().toISOString(),
            ...(title !== undefined && { title: title || null }),
            ...(description !== undefined && { description: description || null }),
            ...(design_highlight !== undefined && { design_highlight: design_highlight || null }),
            ...(tags && { tags: tags.length ? tags : [] })
        };
        if (bodyCategoryKey !== undefined) updates.category_key = (bodyCategoryKey != null && String(bodyCategoryKey).trim()) ? String(bodyCategoryKey).trim() : null;
        if (bodySubcategoryKey !== undefined) updates.subcategory_key = (bodySubcategoryKey != null && String(bodySubcategoryKey).trim()) ? String(bodySubcategoryKey).trim() : null;

        if (mainFile) {
            const { publicUrl } = await uploadToSupabaseStorage('custom-products', `manufacturer/${manufacturerId}`, mainFile);
            updates.image_url = publicUrl;
        } else if (bodyImageUrl !== undefined) updates.image_url = bodyImageUrl || row.image_url;

        if (beforeFile) {
            const { publicUrl } = await uploadToSupabaseStorage('custom-products', `manufacturer/${manufacturerId}`, beforeFile);
            updates.image_url_before = publicUrl;
        } else if (bodyImageUrlBefore !== undefined) updates.image_url_before = bodyImageUrlBefore || null;

        const { data: updated, error } = await supabase.from('manufacturer_portfolio').update(updates).eq('id', portfolioId).select('id, manufacturer_id, title, description, design_highlight, image_url, image_url_before, tags, sort_order').single();
        if (error) {
            console.error('PUT /api/manufacturers/:id/portfolio/:portfolioId 失敗:', error);
            return res.status(500).json({ error: '更新失敗' });
        }
        res.json(updated);
    } catch (e) {
        console.error('PUT /api/manufacturers/:id/portfolio/:portfolioId 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// DELETE /api/manufacturers/:manufacturerId/portfolio/:portfolioId — 刪除廠商作品圖
app.delete('/api/manufacturers/:manufacturerId/portfolio/:portfolioId', async (req, res) => {
    try {
        const { manufacturerId, portfolioId } = req.params;
        const { data: row } = await supabase.from('manufacturer_portfolio').select('id').eq('id', portfolioId).eq('manufacturer_id', manufacturerId).single();
        if (!row) return res.status(404).json({ error: '找不到該作品' });
        const { error } = await supabase.from('manufacturer_portfolio').delete().eq('id', portfolioId);
        if (error) {
            console.error('DELETE /api/manufacturers/:id/portfolio/:portfolioId 失敗:', error);
            return res.status(500).json({ error: '刪除失敗' });
        }
        res.status(204).send();
    } catch (e) {
        console.error('DELETE /api/manufacturers/:id/portfolio/:portfolioId 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// ---------- 廠商資料夾（系列）----------
// GET /api/manufacturers/:id/collections — 列出某廠商的資料夾（公開）
app.get('/api/manufacturers/:id/collections', async (req, res) => {
    try {
        const manufacturerId = req.params.id;
        const { data: list, error } = await supabase
            .from('manufacturer_collections')
            .select('id, manufacturer_id, title, slug, cover_image_url, description, sort_order, created_at, category_keys')
            .eq('manufacturer_id', manufacturerId)
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: false });
        if (error) {
            console.error('GET /api/manufacturers/:id/collections 失敗:', error);
            return res.status(500).json({ error: '查詢失敗' });
        }
        res.json({ items: list || [] });
    } catch (e) {
        console.error('GET /api/manufacturers/:id/collections 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// GET /api/manufacturers/:id/collections/:collectionId — 單一資料夾含作品列表（公開）
app.get('/api/manufacturers/:id/collections/:collectionId', async (req, res) => {
    try {
        const { id: manufacturerId, collectionId } = req.params;
        const { data: coll, error: collErr } = await supabase
            .from('manufacturer_collections')
            .select('id, manufacturer_id, title, slug, cover_image_url, description, sort_order, created_at, category_keys')
            .eq('id', collectionId)
            .eq('manufacturer_id', manufacturerId)
            .single();
        if (collErr || !coll) return res.status(404).json({ error: '找不到該資料夾' });

        const { data: items } = await supabase
            .from('manufacturer_collection_items')
            .select('id, portfolio_id, sort_order')
            .eq('collection_id', collectionId)
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: true });
        const portfolioIds = (items || []).map(i => i.portfolio_id).filter(Boolean);
        let portfolios = [];
        if (portfolioIds.length > 0) {
            const { data: rows } = await supabase
                .from('manufacturer_portfolio')
                .select('id, title, image_url, image_url_before, design_highlight, tags')
                .in('id', portfolioIds)
                .eq('manufacturer_id', manufacturerId);
            const byId = {};
            (rows || []).forEach(r => { byId[r.id] = r; });
            const order = (items || []).map(i => i.portfolio_id);
            portfolios = order.map(pid => byId[pid]).filter(Boolean);
        }
        res.json({ ...coll, items: portfolios });
    } catch (e) {
        console.error('GET /api/manufacturers/:id/collections/:collectionId 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// 解析登入者為「我的廠商」ID（用於 /api/me/manufacturer/collections 等）
async function getMeManufacturerId(req, res) {
    const authHeader = req.headers.authorization || req.headers['x-auth-token'];
    const token = authHeader && (authHeader.replace(/^\s*Bearer\s+/i, '') || authHeader);
    if (!token) {
        res.status(401).json({ error: '請先登入' });
        return null;
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
        res.status(401).json({ error: '登入已過期或無效' });
        return null;
    }
    const { data: mfr, error } = await supabase
        .from('manufacturers')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
    if (error || !mfr) {
        res.status(404).json({ error: '尚未建立廠商資料', code: 'NO_MANUFACTURER' });
        return null;
    }
    return mfr.id;
}

// POST /api/me/manufacturer/collections — 建立資料夾（需登入且為廠商）
app.post('/api/me/manufacturer/collections', express.json(), async (req, res) => {
    try {
        const manufacturerId = await getMeManufacturerId(req, res);
        if (!manufacturerId) return;
        const body = req.body || {};
        const title = (body.title || '').trim();
        if (!title) return res.status(400).json({ error: '請填寫資料夾名稱' });
        const categoryKeys = Array.isArray(body.category_keys) ? body.category_keys.filter(k => k != null && String(k).trim()) : null;
        const { data: inserted, error } = await supabase
            .from('manufacturer_collections')
            .insert({
                manufacturer_id: manufacturerId,
                title,
                description: (body.description || '').trim() || null,
                cover_image_url: body.cover_image_url || null,
                sort_order: body.sort_order != null ? body.sort_order : 0,
                ...(categoryKeys && { category_keys: categoryKeys })
            })
            .select('id, manufacturer_id, title, slug, cover_image_url, description, sort_order, created_at, category_keys')
            .single();
        if (error) {
            console.error('POST /api/me/manufacturer/collections 失敗:', error);
            return res.status(500).json({ error: '建立失敗' });
        }
        res.status(201).json(inserted);
    } catch (e) {
        console.error('POST /api/me/manufacturer/collections 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// PUT /api/me/manufacturer/collections/:id — 更新資料夾
app.put('/api/me/manufacturer/collections/:id', express.json(), async (req, res) => {
    try {
        const manufacturerId = await getMeManufacturerId(req, res);
        if (!manufacturerId) return;
        const collectionId = req.params.id;
        const { data: existing } = await supabase
            .from('manufacturer_collections')
            .select('id')
            .eq('id', collectionId)
            .eq('manufacturer_id', manufacturerId)
            .single();
        if (!existing) return res.status(404).json({ error: '找不到該資料夾' });
        const body = req.body || {};
        const updates = {
            updated_at: new Date().toISOString(),
            ...(body.title !== undefined && { title: (body.title || '').trim() || null }),
            ...(body.description !== undefined && { description: (body.description || '').trim() || null }),
            ...(body.cover_image_url !== undefined && { cover_image_url: body.cover_image_url || null }),
            ...(body.sort_order !== undefined && { sort_order: body.sort_order }),
            ...(body.category_keys !== undefined && { category_keys: Array.isArray(body.category_keys) ? body.category_keys.filter(k => k != null && String(k).trim()) : null })
        };
        const { data: updated, error } = await supabase
            .from('manufacturer_collections')
            .update(updates)
            .eq('id', collectionId)
            .select('id, manufacturer_id, title, slug, cover_image_url, description, sort_order, created_at, category_keys')
            .single();
        if (error) {
            console.error('PUT /api/me/manufacturer/collections/:id 失敗:', error);
            return res.status(500).json({ error: '更新失敗' });
        }
        res.json(updated);
    } catch (e) {
        console.error('PUT /api/me/manufacturer/collections/:id 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// DELETE /api/me/manufacturer/collections/:id — 刪除資料夾
app.delete('/api/me/manufacturer/collections/:id', async (req, res) => {
    try {
        const manufacturerId = await getMeManufacturerId(req, res);
        if (!manufacturerId) return;
        const collectionId = req.params.id;
        const { data: existing } = await supabase
            .from('manufacturer_collections')
            .select('id')
            .eq('id', collectionId)
            .eq('manufacturer_id', manufacturerId)
            .single();
        if (!existing) return res.status(404).json({ error: '找不到該資料夾' });
        const { error } = await supabase.from('manufacturer_collections').delete().eq('id', collectionId);
        if (error) {
            console.error('DELETE /api/me/manufacturer/collections/:id 失敗:', error);
            return res.status(500).json({ error: '刪除失敗' });
        }
        res.status(204).send();
    } catch (e) {
        console.error('DELETE /api/me/manufacturer/collections/:id 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// POST /api/me/manufacturer/collections/:id/items — 將作品加入資料夾（body: portfolio_id）
app.post('/api/me/manufacturer/collections/:id/items', express.json(), async (req, res) => {
    try {
        const manufacturerId = await getMeManufacturerId(req, res);
        if (!manufacturerId) return;
        const collectionId = req.params.id;
        const { data: coll } = await supabase
            .from('manufacturer_collections')
            .select('id')
            .eq('id', collectionId)
            .eq('manufacturer_id', manufacturerId)
            .single();
        if (!coll) return res.status(404).json({ error: '找不到該資料夾' });
        const portfolioId = (req.body && req.body.portfolio_id) || req.body?.portfolioId;
        if (!portfolioId) return res.status(400).json({ error: '請提供 portfolio_id' });
        const { data: port } = await supabase
            .from('manufacturer_portfolio')
            .select('id')
            .eq('id', portfolioId)
            .eq('manufacturer_id', manufacturerId)
            .single();
        if (!port) return res.status(404).json({ error: '找不到該作品或非您的作品' });
        const { data: inserted, error } = await supabase
            .from('manufacturer_collection_items')
            .insert({ collection_id: collectionId, portfolio_id: portfolioId })
            .select('id, collection_id, portfolio_id, sort_order')
            .single();
        if (error) {
            if (error.code === '23505') return res.status(400).json({ error: '該作品已在資料夾中' });
            console.error('POST /api/me/manufacturer/collections/:id/items 失敗:', error);
            return res.status(500).json({ error: '加入失敗' });
        }
        res.status(201).json(inserted);
    } catch (e) {
        console.error('POST /api/me/manufacturer/collections/:id/items 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// DELETE /api/me/manufacturer/collections/:id/items/:portfolioId — 從資料夾移除作品
app.delete('/api/me/manufacturer/collections/:id/items/:portfolioId', async (req, res) => {
    try {
        const manufacturerId = await getMeManufacturerId(req, res);
        if (!manufacturerId) return;
        const { id: collectionId, portfolioId } = req.params;
        const { data: coll } = await supabase
            .from('manufacturer_collections')
            .select('id')
            .eq('id', collectionId)
            .eq('manufacturer_id', manufacturerId)
            .single();
        if (!coll) return res.status(404).json({ error: '找不到該資料夾' });
        const { error } = await supabase
            .from('manufacturer_collection_items')
            .delete()
            .eq('collection_id', collectionId)
            .eq('portfolio_id', portfolioId);
        if (error) {
            console.error('DELETE /api/me/manufacturer/collections/:id/items/:portfolioId 失敗:', error);
            return res.status(500).json({ error: '移除失敗' });
        }
        res.status(204).send();
    } catch (e) {
        console.error('DELETE /api/me/manufacturer/collections/:id/items/:portfolioId 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// 訂製品分類多語系欄位對應（?lang= 用）；預留 ja, es, de, fr
const CUSTOM_CAT_LOCALE_COL = { en: 'name_en', ja: 'name_ja', es: 'name_es', de: 'name_de', fr: 'name_fr' };

// GET /api/custom-product-categories — 訂製品廠商分類（含子分類，供前台下拉、廠商編輯用）
// 支援 ?lang=en|ja|es|de|fr：回傳對應 name_xx，無則依序 fallback name_en → name
app.get('/api/custom-product-categories', async (req, res) => {
    try {
        const lang = (req.query.lang || '').toLowerCase().replace(/-.*$/, '');
        const localeCol = CUSTOM_CAT_LOCALE_COL[lang];
        const { data: cats, error } = await supabase
            .from('custom_product_categories')
            .select('id, key, name, prompt, sort_order, is_active')
            .eq('is_active', true)
            .order('sort_order', { ascending: true });

        if (error) {
            console.error('GET /api/custom-product-categories:', error);
            return res.status(500).json({ error: '查詢失敗' });
        }
        const list = cats || [];
        const keys = list.map(c => c.key);
        let subMap = {};
        if (keys.length > 0) {
            const { data: subs } = await supabase
                .from('custom_product_subcategories')
                .select('id, category_key, key, name, prompt, sort_order')
                .in('category_key', keys)
                .eq('is_active', true)
                .order('sort_order', { ascending: true });
            (subs || []).forEach(s => {
                if (!subMap[s.category_key]) subMap[s.category_key] = [];
                subMap[s.category_key].push({ id: s.id, key: s.key, name: s.name, prompt: s.prompt || '', sort_order: s.sort_order });
            });
        }
        if (localeCol && keys.length > 0) {
            const mainCols = (lang === 'en') ? 'key, name_en' : ('key, name_en, ' + localeCol);
            const subCols = (lang === 'en') ? 'category_key, key, name_en' : ('category_key, key, name_en, ' + localeCol);
            const { data: catsLoc, error: errMain } = await supabase.from('custom_product_categories').select(mainCols).in('key', keys);
            const { data: subsLoc, error: errSub } = await supabase.from('custom_product_subcategories').select(subCols).in('category_key', keys);
            const isEn = (lang === 'en');
            if (errMain || errSub) {
                if (isEn) {
                    const { data: catsEn, error: e1 } = await supabase.from('custom_product_categories').select('key, name_en').in('key', keys);
                    const { data: subsEn, error: e2 } = await supabase.from('custom_product_subcategories').select('category_key, key, name_en').in('category_key', keys);
                    if (!e1 && !e2 && catsEn && subsEn) {
                        catsEn.forEach(r => { const c = list.find(x => x.key === r.key); if (c) c.name = (r.name_en != null && r.name_en !== '') ? r.name_en : (r.key || c.name); });
                        Object.keys(subMap).forEach(ck => { subMap[ck] = subMap[ck].map(s => { const r = subsEn.find(x => x.category_key === ck && x.key === s.key); return { ...s, name: (r && r.name_en != null && r.name_en !== '') ? r.name_en : (r && r.key) || s.key || s.name }; }); });
                    }
                }
            } else if (catsLoc && subsLoc) {
                const pick = (r) => (lang !== 'en' && r[localeCol] != null && r[localeCol] !== '') ? r[localeCol] : (r.name_en != null && r.name_en !== '') ? r.name_en : null;
                catsLoc.forEach(r => {
                    const c = list.find(x => x.key === r.key);
                    if (!c) return;
                    const v = pick(r);
                    if (v) c.name = v;
                    else if (isEn) c.name = (r.name_en != null && r.name_en !== '') ? r.name_en : (r.key || c.name);
                });
                const subLocMap = {};
                subsLoc.forEach(r => { const v = pick(r); if (v) subLocMap[r.category_key + ':' + r.key] = v; });
                Object.keys(subMap).forEach(ck => {
                    subMap[ck] = subMap[ck].map(s => {
                        const v = subLocMap[ck + ':' + s.key];
                        if (v) return { ...s, name: v };
                        const r = subsLoc.find(x => x.category_key === ck && x.key === s.key);
                        if (r && r.name_en != null && r.name_en !== '') return { ...s, name: r.name_en };
                        if (isEn && r) return { ...s, name: r.key || s.name };
                        return s;
                    });
                });
            }
        }
        const categories = list.map(c => ({ ...c, prompt: c.prompt || '', subcategories: subMap[c.key] || [] }));
        res.json({ categories });
    } catch (e) {
        console.error('GET /api/custom-product-categories 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// PUT /api/custom-product-categories — 後台更新訂製品廠商分類（需 admin）
app.put('/api/custom-product-categories', express.json(), async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: '未授權' });
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: 'token 無效' });

        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        if (profile?.role !== 'admin') return res.status(403).json({ error: '僅管理員可編輯' });

        const categories = Array.isArray(req.body.categories) ? req.body.categories : [];
        for (const c of categories) {
            if (!c.key) continue;
            await supabase.from('custom_product_categories').upsert({
                key: c.key,
                name: c.name || c.key,
                prompt: c.prompt != null ? String(c.prompt) : '',
                sort_order: c.sort_order != null ? c.sort_order : 0,
                is_active: c.is_active !== false
            }, { onConflict: 'key' });
        }
        res.json({ success: true });
    } catch (e) {
        console.error('PUT /api/custom-product-categories 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// GET /api/admin/custom-product-categories — 列出全部（含停用、含子分類），供後台編輯
app.get('/api/admin/custom-product-categories', async (req, res) => {
    try {
        const user = await requireAdmin(req, res);
        if (!user) return;
        const { data: cats, error } = await supabase
            .from('custom_product_categories')
            .select('id, key, name, prompt, sort_order, is_active, created_at')
            .order('sort_order', { ascending: true })
            .order('key', { ascending: true });
        if (error) {
            console.error('GET /api/admin/custom-product-categories:', error);
            return res.status(500).json({ error: '查詢失敗' });
        }
        const list = (cats || []).map(c => ({ ...c, name_en: '', name_ja: '', name_es: '', name_de: '', name_fr: '' }));
        const keys = list.map(c => c.key);
        let subMap = {};
        if (keys.length > 0) {
            const { data: subs } = await supabase
                .from('custom_product_subcategories')
                .select('id, category_key, key, name, prompt, sort_order, is_active')
                .in('category_key', keys)
                .order('sort_order', { ascending: true });
            (subs || []).forEach(s => {
                if (!subMap[s.category_key]) subMap[s.category_key] = [];
                subMap[s.category_key].push({ id: s.id, key: s.key, name: s.name, name_en: '', name_ja: '', name_es: '', name_de: '', name_fr: '', prompt: s.prompt || '', sort_order: s.sort_order, is_active: s.is_active });
            });
        }
        const { data: catsEn, error: e1 } = await supabase.from('custom_product_categories').select('key, name_en').in('key', keys);
        const { data: subsEn, error: e2 } = await supabase.from('custom_product_subcategories').select('category_key, key, name_en').in('category_key', keys);
        if (!e1 && catsEn) list.forEach(c => { const r = catsEn.find(x => x.key === c.key); if (r && r.name_en != null) c.name_en = r.name_en || ''; });
        if (!e2 && subsEn) Object.keys(subMap).forEach(ck => { subMap[ck].forEach(s => { const r = subsEn.find(x => x.category_key === ck && x.key === s.key); if (r && r.name_en != null) s.name_en = r.name_en || ''; }); });
        const extraLocaleCols = ['name_ja', 'name_es', 'name_de', 'name_fr'];
        for (const col of extraLocaleCols) {
            const { data: mainData, error: em } = await supabase.from('custom_product_categories').select('key, ' + col).in('key', keys);
            const { data: subData, error: es } = await supabase.from('custom_product_subcategories').select('category_key, key, ' + col).in('category_key', keys);
            if (!em && mainData) list.forEach(c => { const r = mainData.find(x => x.key === c.key); if (r && r[col] != null) c[col] = r[col] || ''; });
            if (!es && subData) Object.keys(subMap).forEach(ck => { subMap[ck].forEach(s => { const r = subData.find(x => x.category_key === ck && x.key === s.key); if (r && r[col] != null) s[col] = r[col] || ''; }); });
        }
        const categories = list.map(c => ({ ...c, prompt: c.prompt || '', subcategories: subMap[c.key] || [] }));
        res.json({ categories });
    } catch (e) {
        console.error('GET /api/admin/custom-product-categories 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// POST /api/admin/custom-product-categories — 新增一筆分類
app.post('/api/admin/custom-product-categories', express.json(), async (req, res) => {
    try {
        const user = await requireAdmin(req, res);
        if (!user) return;
        const { key, name, name_en, name_ja, name_es, name_de, name_fr, prompt, sort_order } = req.body || {};
        if (!key || !String(key).trim()) return res.status(400).json({ error: '請填寫 key' });
        const k = String(key).trim().toLowerCase().replace(/\s+/g, '_');
        const payload = {
            key: k,
            name: (name && String(name).trim()) || k,
            prompt: prompt != null ? String(prompt) : '',
            sort_order: sort_order != null ? Number(sort_order) : 0,
            is_active: true
        };
        if (name_en !== undefined) payload.name_en = name_en != null ? String(name_en).trim() : null;
        for (const col of ['name_ja', 'name_es', 'name_de', 'name_fr']) if (req.body[col] !== undefined) payload[col] = req.body[col] != null ? String(req.body[col]).trim() : null;
        let error = (await supabase.from('custom_product_categories').insert(payload)).error;
        if (error && (error.code === '42703' || (error.message && /column.*does not exist|name_en|name_ja/.test(error.message)))) {
            const basePayload = { key: k, name: (name && String(name).trim()) || k, prompt: prompt != null ? String(prompt) : '', sort_order: sort_order != null ? Number(sort_order) : 0, is_active: true };
            error = (await supabase.from('custom_product_categories').insert(basePayload)).error;
        }
        if (error) {
            if (error.code === '23505') return res.status(400).json({ error: '此 key 已存在' });
            console.error('POST /api/admin/custom-product-categories:', error);
            return res.status(500).json({ error: '新增失敗。若需多語系請執行 docs/add-custom-product-categories-multilang.sql' });
        }
        res.status(201).json({ success: true });
    } catch (e) {
        console.error('POST /api/admin/custom-product-categories 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// PUT /api/admin/custom-product-categories/by-id/:id — 依 id 更新（id 為 UUID；key 含 & 或改 key 時用此路徑）
app.put('/api/admin/custom-product-categories/by-id/:id', express.json(), async (req, res) => {
    try {
        const user = await requireAdmin(req, res);
        if (!user) return;
        const id = (req.params.id || '').trim();
        if (!id) return res.status(400).json({ error: '無效的 id' });
        const { key: newKeyRaw, name, name_en, prompt, sort_order, is_active } = req.body || {};
        const newKey = (newKeyRaw != null && String(newKeyRaw).trim()) ? String(newKeyRaw).trim().toLowerCase().replace(/\s+/g, '_') : null;
        const { data: row, error: fetchErr } = await supabase.from('custom_product_categories').select('*').eq('id', id).single();
        if (fetchErr || !row) {
            console.error('PUT by-id fetch:', fetchErr || 'no row', 'id=', id);
            return res.status(400).json({ error: '找不到此分類', details: fetchErr ? fetchErr.message : '查無該 id 的資料' });
        }
        const key = row.key;
        const isRename = newKey && newKey !== key;
        if (!isRename) {
            const updates = {};
            if (name !== undefined) updates.name = String(name).trim() || (newKey || key);
            if (name_en !== undefined) updates.name_en = name_en != null && String(name_en).trim() !== '' ? String(name_en).trim() : null;
            for (const col of ['name_ja', 'name_es', 'name_de', 'name_fr']) if (req.body[col] !== undefined) updates[col] = req.body[col] != null && String(req.body[col]).trim() !== '' ? String(req.body[col]).trim() : null;
            if (prompt !== undefined) updates.prompt = String(prompt);
            if (sort_order !== undefined) updates.sort_order = Number(sort_order);
            if (is_active !== undefined) updates.is_active = !!is_active;
            updates.updated_at = new Date().toISOString();
            const { error } = await supabase.from('custom_product_categories').update(updates).eq('id', id).select('key').maybeSingle();
            if (error) {
                if (error.code === '23505') return res.status(400).json({ error: '此 key 已存在' });
                console.error('PUT by-id custom-product-categories:', error);
                return res.status(500).json({ error: '更新失敗', details: error.message });
            }
        } else {
            const insertRow = { ...row, key: newKey, updated_at: new Date().toISOString() };
            delete insertRow.id;
            if (name !== undefined) insertRow.name = String(name).trim() || newKey;
            if (prompt !== undefined) insertRow.prompt = String(prompt);
            if (sort_order !== undefined) insertRow.sort_order = Number(sort_order);
            if (is_active !== undefined) insertRow.is_active = !!is_active;
            if (row.hasOwnProperty('name_en')) insertRow.name_en = name_en !== undefined ? (name_en != null && String(name_en).trim() !== '' ? String(name_en).trim() : null) : row.name_en;
            for (const col of ['name_ja', 'name_es', 'name_de', 'name_fr']) {
                if (row.hasOwnProperty(col)) insertRow[col] = (req.body && req.body[col] !== undefined) ? (req.body[col] != null && String(req.body[col]).trim() !== '' ? String(req.body[col]).trim() : null) : row[col];
            }
            const { error: insertErr } = await supabase.from('custom_product_categories').insert(insertRow);
            if (insertErr) {
                if (insertErr.code === '23505') return res.status(400).json({ error: '此 key 已存在' });
                return res.status(500).json({ error: '更新失敗', details: insertErr.message });
            }
            const { data: allSub } = await supabase.from('custom_product_subcategories').select('id, category_key');
            const subIds = (allSub || []).filter(s => s.category_key === key).map(s => s.id);
            if (subIds.length > 0) {
                const { error: subErr } = await supabase.from('custom_product_subcategories').update({ category_key: newKey, updated_at: new Date().toISOString() }).in('id', subIds);
                if (subErr) return res.status(500).json({ error: '更新子分類失敗', details: subErr.message });
            }
            const { error: delErr } = await supabase.from('custom_product_categories').delete().eq('id', id);
            if (delErr) return res.status(500).json({ error: '移除舊分類失敗', details: delErr.message });
        }
        res.json({ success: true });
    } catch (e) {
        console.error('PUT by-id custom-product-categories 異常:', e);
        res.status(500).json({ error: '系統錯誤', details: e && e.message });
    }
});

// PUT /api/admin/custom-product-categories/:key — 更新一筆分類（body 可含 key 以修改 key）
// :key 可能含 & 等字元，Supabase 查詢 URL 會壞掉，改為「先 select 全表用 key 找 id，再依 id 更新」
app.put('/api/admin/custom-product-categories/:key', express.json(), async (req, res) => {
    try {
        const user = await requireAdmin(req, res);
        if (!user) return;
        const rawParam = req.params.key || '';
        let key;
        try { key = decodeURIComponent(rawParam).trim(); } catch (_) { key = rawParam.trim(); }
        if (!key) return res.status(400).json({ error: '缺少 key' });
        const { key: newKeyRaw, name, name_en, prompt, sort_order, is_active } = req.body || {};
        const updates = {};
        const newKey = (newKeyRaw != null && String(newKeyRaw).trim()) ? String(newKeyRaw).trim().toLowerCase().replace(/\s+/g, '_') : null;
        const isRename = newKey && newKey !== key;
        // 依 key 解析出主分類列（不把 key 放進 Supabase URL，避免 & 斷開）
        const { data: allMain, error: selectErr } = await supabase.from('custom_product_categories').select('id, key').limit(5000);
        if (selectErr) {
            console.error('PUT /api/admin/custom-product-categories select:', selectErr);
            return res.status(500).json({ error: '查詢分類失敗', details: selectErr.message });
        }
        const list = allMain || [];
        const row = list.find(r => r.key === key);
        if (!row) return res.status(400).json({ error: '找不到此分類（請用編輯鈕從列表開啟再儲存）' });
        if (!isRename) {
            if (name !== undefined) updates.name = String(name).trim() || (newKey || key);
            if (name_en !== undefined) updates.name_en = name_en != null && String(name_en).trim() !== '' ? String(name_en).trim() : null;
            for (const col of ['name_ja', 'name_es', 'name_de', 'name_fr']) if (req.body[col] !== undefined) updates[col] = req.body[col] != null && String(req.body[col]).trim() !== '' ? String(req.body[col]).trim() : null;
            if (prompt !== undefined) updates.prompt = String(prompt);
            if (sort_order !== undefined) updates.sort_order = Number(sort_order);
            if (is_active !== undefined) updates.is_active = !!is_active;
            updates.updated_at = new Date().toISOString();
            let { data: updatedRow, error } = await supabase.from('custom_product_categories').update(updates).eq('id', row.id).select('key').maybeSingle();
            const isColumnMissing = error && (error.code === '42703' || error.code === 'PGRST204' || (error.message && /column.*does not exist|Could not find.*column|schema cache|name_en|name_ja|name_de|name_es|name_fr/.test(error.message)));
            if (error && isColumnMissing) {
                const baseUpdates = { updated_at: updates.updated_at };
                if (name !== undefined) baseUpdates.name = String(name).trim() || key;
                if (prompt !== undefined) baseUpdates.prompt = String(prompt);
                if (sort_order !== undefined) baseUpdates.sort_order = Number(sort_order);
                if (is_active !== undefined) baseUpdates.is_active = !!is_active;
                const fallback = await supabase.from('custom_product_categories').update(baseUpdates).eq('id', row.id).select('key').maybeSingle();
                error = fallback.error;
                updatedRow = fallback.data;
                if (error) {
                    console.error('PUT /api/admin/custom-product-categories:', error);
                    return res.status(500).json({ error: '更新失敗。若需多語系欄位，請在 Supabase 執行 docs/add-custom-product-categories-multilang.sql' });
                }
            }
            if (error) {
                if (error.code === '23505') return res.status(400).json({ error: '此 key 已存在' });
                if (error.code === '23503') return res.status(400).json({ error: '無法更新：尚有子分類引用此主分類', details: error.message });
                console.error('PUT /api/admin/custom-product-categories:', error);
                return res.status(500).json({ error: '更新失敗', details: error.message || error.code });
            }
        } else {
            // 改 key：先取完整列（上面 row 只有 id, key，需再取一筆完整或沿用 allMain 無完整欄位，故再查一次用 id）
            const { data: fullRow, error: fetchErr } = await supabase.from('custom_product_categories').select('*').eq('id', row.id).single();
            if (fetchErr || !fullRow) {
                console.error('PUT /api/admin/custom-product-categories fetch:', fetchErr);
                return res.status(500).json({ error: '查無此分類', details: fetchErr && fetchErr.message });
            }
            const insertRow = { ...fullRow, key: newKey, updated_at: new Date().toISOString() };
            if (name !== undefined) insertRow.name = String(name).trim() || newKey;
            if (prompt !== undefined) insertRow.prompt = String(prompt);
            if (sort_order !== undefined) insertRow.sort_order = Number(sort_order);
            if (is_active !== undefined) insertRow.is_active = !!is_active;
            if (fullRow.hasOwnProperty('name_en')) insertRow.name_en = name_en !== undefined ? (name_en != null && String(name_en).trim() !== '' ? String(name_en).trim() : null) : fullRow.name_en;
            for (const col of ['name_ja', 'name_es', 'name_de', 'name_fr']) {
                if (fullRow.hasOwnProperty(col)) insertRow[col] = (req.body && req.body[col] !== undefined) ? (req.body[col] != null && String(req.body[col]).trim() !== '' ? String(req.body[col]).trim() : null) : fullRow[col];
            }
            const { error: insertErr } = await supabase.from('custom_product_categories').insert(insertRow);
            if (insertErr) {
                if (insertErr.code === '23505') return res.status(400).json({ error: '此 key 已存在' });
                console.error('PUT /api/admin/custom-product-categories insert:', insertErr);
                return res.status(500).json({ error: '更新失敗', details: insertErr.message });
            }
            // 子分類的 category_key 要改成 newKey；不把 key 放 URL，改為先撈出該主分類下的子分類 id 再依 id 更新
            const { data: allSub } = await supabase.from('custom_product_subcategories').select('id, category_key');
            const subIds = (allSub || []).filter(s => s.category_key === key).map(s => s.id);
            if (subIds.length > 0) {
                const { error: subErr } = await supabase.from('custom_product_subcategories').update({ category_key: newKey, updated_at: new Date().toISOString() }).in('id', subIds);
                if (subErr) {
                    console.error('PUT /api/admin/custom-product-categories subcategories:', subErr);
                    return res.status(500).json({ error: '更新子分類失敗', details: subErr.message });
                }
            }
            const { error: delErr } = await supabase.from('custom_product_categories').delete().eq('id', row.id);
            if (delErr) {
                console.error('PUT /api/admin/custom-product-categories delete old:', delErr);
                return res.status(500).json({ error: '移除舊分類失敗', details: delErr.message });
            }
        }
        res.json({ success: true });
    } catch (e) {
        console.error('PUT /api/admin/custom-product-categories 異常:', e);
        res.status(500).json({ error: '系統錯誤', details: e && e.message ? e.message : undefined });
    }
});

// POST /api/admin/custom-product-categories/:key/move-subcategories — 將此主分類下所有子分類移至另一主分類（body: { target_key }）
app.post('/api/admin/custom-product-categories/:key/move-subcategories', express.json(), async (req, res) => {
    try {
        const user = await requireAdmin(req, res);
        if (!user) return;
        let key = req.params.key;
        try { key = decodeURIComponent(key || ''); } catch (_) { key = req.params.key || ''; }
        if (!key) return res.status(400).json({ error: '缺少 key' });
        const targetKey = (req.body && req.body.target_key != null) ? String(req.body.target_key).trim() : '';
        if (!targetKey) return res.status(400).json({ error: '請提供 target_key' });
        if (targetKey === key) return res.status(400).json({ error: '目標主分類不可與來源相同' });
        const { data: allMain } = await supabase.from('custom_product_categories').select('id, key');
        if (!(allMain || []).find(r => r.key === targetKey)) return res.status(400).json({ error: '目標主分類不存在', details: targetKey });
        const { data: allSub } = await supabase.from('custom_product_subcategories').select('id, category_key');
        const subIds = (allSub || []).filter(s => s.category_key === key).map(s => s.id);
        if (subIds.length === 0) { res.json({ success: true, moved: 0 }); return; }
        const { data: updated, error } = await supabase.from('custom_product_subcategories').update({ category_key: targetKey, updated_at: new Date().toISOString() }).in('id', subIds).select('id');
        if (error) {
            console.error('POST move-subcategories:', error);
            return res.status(500).json({ error: '移動失敗', details: error.message });
        }
        res.json({ success: true, moved: (updated || []).length });
    } catch (e) {
        console.error('POST move-subcategories 異常:', e);
        res.status(500).json({ error: '系統錯誤', details: e && e.message ? e.message : undefined });
    }
});

// DELETE /api/admin/custom-product-categories/:key — 停用（預設）或永久刪除（?permanent=1）
app.delete('/api/admin/custom-product-categories/:key', async (req, res) => {
    try {
        const user = await requireAdmin(req, res);
        if (!user) return;
        let key = req.params.key;
        try { key = decodeURIComponent(key || ''); } catch (_) { key = req.params.key || ''; }
        if (!key) return res.status(400).json({ error: '缺少 key' });
        const { data: allMain } = await supabase.from('custom_product_categories').select('id, key');
        const row = (allMain || []).find(r => r.key === key);
        if (!row) return res.status(400).json({ error: '找不到此分類' });
        const permanent = req.query.permanent === '1' || req.query.permanent === 'true';
        if (permanent) {
            const { error } = await supabase.from('custom_product_categories').delete().eq('id', row.id);
            if (error) {
                console.error('DELETE /api/admin/custom-product-categories:', error);
                return res.status(500).json({ error: '刪除失敗' });
            }
        } else {
            const { error } = await supabase.from('custom_product_categories').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', row.id);
            if (error) {
                console.error('DELETE /api/admin/custom-product-categories:', error);
                return res.status(500).json({ error: '停用失敗' });
            }
        }
        res.json({ success: true });
    } catch (e) {
        console.error('DELETE /api/admin/custom-product-categories 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// ——— 訂製品子分類（admin） ———
// POST /api/admin/custom-product-subcategories — 新增子分類
app.post('/api/admin/custom-product-subcategories', express.json(), async (req, res) => {
    try {
        const user = await requireAdmin(req, res);
        if (!user) return;
        const { category_key, key, name, name_en, prompt, sort_order } = req.body || {};
        if (!category_key || !String(category_key).trim()) return res.status(400).json({ error: '請填寫 category_key' });
        if (!key || !String(key).trim()) return res.status(400).json({ error: '請填寫 key' });
        const cKey = String(category_key).trim();
        const k = String(key).trim().toLowerCase().replace(/\s+/g, '_');
        const { data: mainRow } = await supabase.from('custom_product_categories').select('key').eq('key', cKey).maybeSingle();
        if (!mainRow) return res.status(400).json({ error: '主分類不存在', received_key: cKey });
        const payload = {
            category_key: cKey,
            key: k,
            name: (name && String(name).trim()) || k,
            prompt: prompt != null ? String(prompt) : '',
            sort_order: sort_order != null ? Number(sort_order) : 0,
            is_active: true
        };
        if (name_en !== undefined) payload.name_en = name_en != null ? String(name_en).trim() : null;
        for (const col of ['name_ja', 'name_es', 'name_de', 'name_fr']) if (req.body[col] !== undefined) payload[col] = req.body[col] != null ? String(req.body[col]).trim() : null;
        let error = (await supabase.from('custom_product_subcategories').insert(payload)).error;
        if (error && (error.code === '42703' || (error.message && /column.*does not exist|name_en|name_ja/.test(error.message)))) {
            const basePayload = { category_key: cKey, key: k, name: (name && String(name).trim()) || k, prompt: prompt != null ? String(prompt) : '', sort_order: sort_order != null ? Number(sort_order) : 0, is_active: true };
            error = (await supabase.from('custom_product_subcategories').insert(basePayload)).error;
        }
        if (error) {
            if (error.code === '23503') return res.status(400).json({ error: '主分類不存在', received_key: cKey });
            if (error.code === '23505') return res.status(400).json({ error: '此主分類下已存在相同 key 的子分類' });
            console.error('POST /api/admin/custom-product-subcategories:', error);
            return res.status(500).json({ error: '新增失敗' });
        }
        res.status(201).json({ success: true });
    } catch (e) {
        console.error('POST /api/admin/custom-product-subcategories 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// PUT /api/admin/custom-product-subcategories/:category_key/:key — 更新子分類（body 可含 key 以修改 key）
// :category_key/:key 可能含 &，不把 key 放 Supabase URL，改為先 select 全表用 (category_key,key) 找 id 再依 id 更新
app.put('/api/admin/custom-product-subcategories/:category_key/:key', express.json(), async (req, res) => {
    try {
        const user = await requireAdmin(req, res);
        if (!user) return;
        let category_key = req.params.category_key;
        let key = req.params.key;
        try { category_key = decodeURIComponent(category_key || ''); } catch (_) {}
        try { key = decodeURIComponent(key || ''); } catch (_) {}
        if (!category_key || !key) return res.status(400).json({ error: '缺少參數' });
        const { data: allSub } = await supabase.from('custom_product_subcategories').select('id, category_key, key');
        const subRow = (allSub || []).find(s => s.category_key === category_key && s.key === key);
        if (!subRow) return res.status(400).json({ error: '找不到此子分類' });
        const { key: newKeyRaw, name, name_en, prompt, sort_order, is_active } = req.body || {};
        const updates = {};
        const newKey = (newKeyRaw != null && String(newKeyRaw).trim()) ? String(newKeyRaw).trim().toLowerCase().replace(/\s+/g, '_') : null;
        if (newKey && newKey !== key) updates.key = newKey;
        if (name !== undefined) updates.name = String(name).trim() || (newKey || key);
        if (name_en !== undefined) updates.name_en = name_en != null && String(name_en).trim() !== '' ? String(name_en).trim() : null;
        for (const col of ['name_ja', 'name_es', 'name_de', 'name_fr']) if (req.body[col] !== undefined) updates[col] = req.body[col] != null && String(req.body[col]).trim() !== '' ? String(req.body[col]).trim() : null;
        if (prompt !== undefined) updates.prompt = String(prompt);
        if (sort_order !== undefined) {
            const n = Number(sort_order);
            updates.sort_order = Number.isFinite(n) ? n : 0;
        }
        if (is_active !== undefined) updates.is_active = !!is_active;
        updates.updated_at = new Date().toISOString();
        const updatePayload = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
        let { error } = await supabase.from('custom_product_subcategories').update(updatePayload).eq('id', subRow.id);
        const isColumnMissing = error && (
            error.code === '42703' || error.code === 'PGRST204' ||
            (error.message && /column.*does not exist|Could not find.*column|schema cache|name_en|name_ja|name_de|name_es|name_fr/.test(error.message))
        );
        if (error && isColumnMissing) {
            const baseUpdates = { updated_at: updates.updated_at };
            if (updates.key !== undefined) baseUpdates.key = updates.key;
            if (name !== undefined) baseUpdates.name = String(name).trim() || (newKey || key);
            if (prompt !== undefined) baseUpdates.prompt = String(prompt);
            if (sort_order !== undefined) baseUpdates.sort_order = Number.isFinite(Number(sort_order)) ? Number(sort_order) : 0;
            if (is_active !== undefined) baseUpdates.is_active = !!is_active;
            error = (await supabase.from('custom_product_subcategories').update(baseUpdates).eq('id', subRow.id)).error;
            if (error) {
                console.error('PUT /api/admin/custom-product-subcategories fallback:', error);
                return res.status(500).json({ error: '更新失敗：' + (error.message || '若需多語系欄位請執行 docs/add-custom-product-categories-multilang.sql') });
            }
        } else if (error) {
            if (error.code === '23505') return res.status(400).json({ error: '此主分類下已存在相同 key 的子分類' });
            console.error('PUT /api/admin/custom-product-subcategories:', error);
            return res.status(500).json({ error: '更新失敗：' + (error.message || '請查看伺服器日誌') });
        }
        res.json({ success: true });
    } catch (e) {
        console.error('PUT /api/admin/custom-product-subcategories 異常:', e);
        res.status(500).json({ error: '系統錯誤：' + (e && e.message) });
    }
});

// DELETE /api/admin/custom-product-subcategories/:category_key/:key — 停用或永久刪除（?permanent=1）
app.delete('/api/admin/custom-product-subcategories/:category_key/:key', async (req, res) => {
    try {
        const user = await requireAdmin(req, res);
        if (!user) return;
        let category_key = req.params.category_key;
        let key = req.params.key;
        try { category_key = decodeURIComponent(category_key || ''); } catch (_) {}
        try { key = decodeURIComponent(key || ''); } catch (_) {}
        if (!category_key || !key) return res.status(400).json({ error: '缺少參數' });
        const { data: allSub } = await supabase.from('custom_product_subcategories').select('id, category_key, key');
        const subRow = (allSub || []).find(s => s.category_key === category_key && s.key === key);
        if (!subRow) return res.status(400).json({ error: '找不到此子分類' });
        const permanent = req.query.permanent === '1' || req.query.permanent === 'true';
        if (permanent) {
            const { error } = await supabase.from('custom_product_subcategories').delete().eq('id', subRow.id);
            if (error) {
                console.error('DELETE /api/admin/custom-product-subcategories:', error);
                return res.status(500).json({ error: '刪除失敗' });
            }
        } else {
            const { error } = await supabase.from('custom_product_subcategories').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', subRow.id);
            if (error) {
                console.error('DELETE /api/admin/custom-product-subcategories:', error);
                return res.status(500).json({ error: '停用失敗' });
            }
        }
        res.json({ success: true });
    } catch (e) {
        console.error('DELETE /api/admin/custom-product-subcategories 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// ——— 再製分類（改裝現有品服務）：公開 API ———
// GET /api/remake-categories — 再製主分類＋子分類（僅啟用），供前台下拉；支援 ?lang=en|ja|es|de|fr 多語系
const REMake_CAT_LOCALE_COL = { en: 'name_en', ja: 'name_ja', es: 'name_es', de: 'name_de', fr: 'name_fr' };
app.get('/api/remake-categories', async (req, res) => {
    try {
        const lang = (req.query.lang || '').toLowerCase().replace(/-.*$/, '');
        const localeCol = REMake_CAT_LOCALE_COL[lang];
        let list = [];
        let mainRes = await supabase.from('remake_categories').select('id, key, name, name_en, name_ja, name_es, name_de, name_fr, prompt, sort_order, is_active').eq('is_active', true).order('sort_order', { ascending: true });
        if (mainRes.error && (mainRes.error.code === '42703' || (mainRes.error.message && /column.*does not exist|name_en/.test(mainRes.error.message)))) {
            mainRes = await supabase.from('remake_categories').select('id, key, name, prompt, sort_order, is_active').eq('is_active', true).order('sort_order', { ascending: true });
        }
        if (mainRes.error) {
            console.error('GET /api/remake-categories:', mainRes.error);
            return res.status(500).json({ error: '查詢失敗' });
        }
        list = mainRes.data || [];
        const keys = list.map(c => c.key);
        let subMap = {};
        if (keys.length > 0) {
            let subRes = await supabase.from('remake_subcategories').select('id, category_key, key, name, name_en, name_ja, name_es, name_de, name_fr, prompt, sort_order').in('category_key', keys).eq('is_active', true).order('sort_order', { ascending: true });
            if (subRes.error && (subRes.error.code === '42703' || (subRes.error.message && /column.*does not exist|name_en/.test(subRes.error.message)))) {
                subRes = await supabase.from('remake_subcategories').select('id, category_key, key, name, prompt, sort_order').in('category_key', keys).eq('is_active', true).order('sort_order', { ascending: true });
            }
            const subs = subRes.data || [];
            subs.forEach(s => {
                if (!subMap[s.category_key]) subMap[s.category_key] = [];
                let subName = s.name;
                if (s.name_en && lang === 'en') subName = s.name_en;
                else if (localeCol && s[localeCol]) subName = s[localeCol];
                subMap[s.category_key].push({ id: s.id, key: s.key, name: subName, prompt: s.prompt || '', sort_order: s.sort_order });
            });
        }
        if ((lang === 'en' || localeCol) && list.length && (list[0].name_en != null || (localeCol && list[0][localeCol] != null))) {
            list = list.map(c => {
                const displayName = (lang === 'en' && c.name_en) ? c.name_en : (localeCol && c[localeCol]) ? c[localeCol] : c.name;
                return { ...c, name: displayName };
            });
        }
        const categories = list.map(c => ({ ...c, prompt: c.prompt || '', subcategories: subMap[c.key] || [] }));
        res.json({ categories });
    } catch (e) {
        console.error('GET /api/remake-categories 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// ——— 再製分類：後台 API ———
app.get('/api/admin/remake-categories', async (req, res) => {
    try {
        const user = await requireAdmin(req, res);
        if (!user) return;
        let list = [];
        const mainRes = await supabase.from('remake_categories').select('id, key, name, name_en, name_ja, name_es, name_de, name_fr, prompt, sort_order, is_active, created_at').order('sort_order', { ascending: true }).order('key', { ascending: true });
        if (mainRes.error && (mainRes.error.code === '42703' || (mainRes.error.message && /column.*does not exist|name_en/.test(mainRes.error.message)))) {
            const fallback = await supabase.from('remake_categories').select('id, key, name, prompt, sort_order, is_active, created_at').order('sort_order', { ascending: true }).order('key', { ascending: true });
            if (fallback.error) {
                console.error('GET /api/admin/remake-categories:', fallback.error);
                return res.status(500).json({ error: '查詢失敗' });
            }
            list = (fallback.data || []).map(c => ({ ...c, name_en: '', name_ja: '', name_es: '', name_de: '', name_fr: '' }));
        } else if (mainRes.error) {
            console.error('GET /api/admin/remake-categories:', mainRes.error);
            return res.status(500).json({ error: '查詢失敗' });
        } else {
            list = (mainRes.data || []).map(c => ({ ...c, name_en: c.name_en || '', name_ja: c.name_ja || '', name_es: c.name_es || '', name_de: c.name_de || '', name_fr: c.name_fr || '' }));
        }
        const keys = list.map(c => c.key);
        let subMap = {};
        if (keys.length > 0) {
            const subRes = await supabase.from('remake_subcategories').select('id, category_key, key, name, name_en, name_ja, name_es, name_de, name_fr, prompt, sort_order, is_active').in('category_key', keys).order('sort_order', { ascending: true });
            let subs = subRes.data || [];
            if (subRes.error && (subRes.error.code === '42703' || (subRes.error.message && /column.*does not exist|name_en/.test(subRes.error.message)))) {
                const subFallback = await supabase.from('remake_subcategories').select('id, category_key, key, name, prompt, sort_order, is_active').in('category_key', keys).order('sort_order', { ascending: true });
                subs = (subFallback.data || []).map(s => ({ ...s, name_en: '', name_ja: '', name_es: '', name_de: '', name_fr: '' }));
            } else {
                subs = subs.map(s => ({ ...s, name_en: s.name_en || '', name_ja: s.name_ja || '', name_es: s.name_es || '', name_de: s.name_de || '', name_fr: s.name_fr || '' }));
            }
            subs.forEach(s => {
                if (!subMap[s.category_key]) subMap[s.category_key] = [];
                subMap[s.category_key].push({ id: s.id, key: s.key, name: s.name, name_en: s.name_en || '', name_ja: s.name_ja || '', name_es: s.name_es || '', name_de: s.name_de || '', name_fr: s.name_fr || '', prompt: s.prompt || '', sort_order: s.sort_order, is_active: s.is_active });
            });
        }
        const categories = list.map(c => ({ ...c, prompt: c.prompt || '', subcategories: subMap[c.key] || [] }));
        res.json({ categories });
    } catch (e) {
        console.error('GET /api/admin/remake-categories 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

app.post('/api/admin/remake-categories', express.json(), async (req, res) => {
    try {
        const user = await requireAdmin(req, res);
        if (!user) return;
        const { key, name, name_en, name_ja, name_es, name_de, name_fr, prompt, sort_order } = req.body || {};
        if (!key || !String(key).trim()) return res.status(400).json({ error: '請填寫 key' });
        const k = String(key).trim().toLowerCase().replace(/\s+/g, '_');
        const payload = {
            key: k,
            name: (name && String(name).trim()) || k,
            prompt: prompt != null ? String(prompt) : '',
            sort_order: sort_order != null ? Number(sort_order) : 0,
            is_active: true
        };
        if (name_en !== undefined) payload.name_en = name_en != null && String(name_en).trim() !== '' ? String(name_en).trim() : null;
        for (const col of ['name_ja', 'name_es', 'name_de', 'name_fr']) if (req.body[col] !== undefined) payload[col] = req.body[col] != null && String(req.body[col]).trim() !== '' ? String(req.body[col]).trim() : null;
        let error = (await supabase.from('remake_categories').insert(payload)).error;
        if (error && (error.code === '42703' || (error.message && /column.*does not exist|name_en|name_ja/.test(error.message)))) {
            const basePayload = { key: k, name: (name && String(name).trim()) || k, prompt: prompt != null ? String(prompt) : '', sort_order: sort_order != null ? Number(sort_order) : 0, is_active: true };
            error = (await supabase.from('remake_categories').insert(basePayload)).error;
        }
        if (error) {
            if (error.code === '23505') return res.status(400).json({ error: '此 key 已存在' });
            console.error('POST /api/admin/remake-categories:', error);
            return res.status(500).json({ error: '新增失敗。若需多語系請執行 docs/add-remake-categories-multilang.sql' });
        }
        res.status(201).json({ success: true });
    } catch (e) {
        console.error('POST /api/admin/remake-categories 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// :key 可能含 &，不把 key 放 Supabase URL，改為先 select 全表用 key 找 id 再依 id 更新
app.put('/api/admin/remake-categories/:key', express.json(), async (req, res) => {
    try {
        const user = await requireAdmin(req, res);
        if (!user) return;
        let key = req.params.key;
        try { key = decodeURIComponent(key || ''); } catch (_) { key = req.params.key || ''; }
        if (!key) return res.status(400).json({ error: '缺少 key' });
        const { data: allMain } = await supabase.from('remake_categories').select('id, key');
        const row = (allMain || []).find(r => r.key === key);
        if (!row) return res.status(400).json({ error: '找不到此分類' });
        const { key: newKeyRaw, name, name_en, name_ja, name_es, name_de, name_fr, prompt, sort_order, is_active } = req.body || {};
        const newKey = (newKeyRaw != null && String(newKeyRaw).trim()) ? String(newKeyRaw).trim().toLowerCase().replace(/\s+/g, '_') : null;
        const isRename = newKey && newKey !== key;
        if (!isRename) {
            const updates = {};
            if (name !== undefined) updates.name = String(name).trim() || key;
            if (name_en !== undefined) updates.name_en = name_en != null && String(name_en).trim() !== '' ? String(name_en).trim() : null;
            for (const col of ['name_ja', 'name_es', 'name_de', 'name_fr']) if (req.body[col] !== undefined) updates[col] = req.body[col] != null && String(req.body[col]).trim() !== '' ? String(req.body[col]).trim() : null;
            if (prompt !== undefined) updates.prompt = String(prompt);
            if (sort_order !== undefined) updates.sort_order = Number(sort_order);
            if (is_active !== undefined) updates.is_active = !!is_active;
            updates.updated_at = new Date().toISOString();
            let error = (await supabase.from('remake_categories').update(updates).eq('id', row.id)).error;
            const isColumnMissingRemake = error && (error.code === '42703' || error.code === 'PGRST204' || (error.message && /column.*does not exist|Could not find.*column|schema cache|name_en|name_ja|name_de|name_es|name_fr/.test(error.message)));
            if (error && isColumnMissingRemake) {
                const baseUpdates = { updated_at: updates.updated_at };
                if (name !== undefined) baseUpdates.name = String(name).trim() || key;
                if (prompt !== undefined) baseUpdates.prompt = String(prompt);
                if (sort_order !== undefined) baseUpdates.sort_order = Number(sort_order);
                if (is_active !== undefined) baseUpdates.is_active = !!is_active;
                error = (await supabase.from('remake_categories').update(baseUpdates).eq('id', row.id)).error;
                if (error) {
                    console.error('PUT /api/admin/remake-categories:', error);
                    return res.status(500).json({ error: '更新失敗。若需多語系欄位，請在 Supabase 執行 docs/add-remake-categories-multilang.sql' });
                }
            } else if (error) {
                if (error.code === '23505') return res.status(400).json({ error: '此 key 已存在' });
                if (error.code === '23503') return res.status(400).json({ error: '無法更新：尚有子分類引用此主分類', details: error.message });
                console.error('PUT /api/admin/remake-categories:', error);
                return res.status(500).json({ error: '更新失敗', details: error.message || error.code });
            }
        } else {
            const { data: fullRow, error: fetchErr } = await supabase.from('remake_categories').select('*').eq('id', row.id).single();
            if (fetchErr || !fullRow) {
                console.error('PUT /api/admin/remake-categories fetch:', fetchErr);
                return res.status(500).json({ error: '查無此分類', details: fetchErr && fetchErr.message });
            }
            const insertRow = { ...fullRow, key: newKey, updated_at: new Date().toISOString() };
            if (name !== undefined) insertRow.name = String(name).trim() || newKey;
            if (prompt !== undefined) insertRow.prompt = String(prompt);
            if (sort_order !== undefined) insertRow.sort_order = Number(sort_order);
            if (is_active !== undefined) insertRow.is_active = !!is_active;
            if (fullRow.hasOwnProperty('name_en')) insertRow.name_en = name_en !== undefined ? (name_en != null && String(name_en).trim() !== '' ? String(name_en).trim() : null) : fullRow.name_en;
            for (const col of ['name_ja', 'name_es', 'name_de', 'name_fr']) {
                if (fullRow.hasOwnProperty(col)) insertRow[col] = (req.body && req.body[col] !== undefined) ? (req.body[col] != null && String(req.body[col]).trim() !== '' ? String(req.body[col]).trim() : null) : fullRow[col];
            }
            const { error: insertErr } = await supabase.from('remake_categories').insert(insertRow);
            if (insertErr) {
                if (insertErr.code === '23505') return res.status(400).json({ error: '此 key 已存在' });
                console.error('PUT /api/admin/remake-categories insert:', insertErr);
                return res.status(500).json({ error: '更新失敗', details: insertErr.message });
            }
            const { data: allSub } = await supabase.from('remake_subcategories').select('id, category_key');
            const subIds = (allSub || []).filter(s => s.category_key === key).map(s => s.id);
            if (subIds.length > 0) {
                const { error: subErr } = await supabase.from('remake_subcategories').update({ category_key: newKey, updated_at: new Date().toISOString() }).in('id', subIds);
                if (subErr) {
                    console.error('PUT /api/admin/remake-categories subcategories:', subErr);
                    return res.status(500).json({ error: '更新子分類失敗', details: subErr.message });
                }
            }
            const { error: delErr } = await supabase.from('remake_categories').delete().eq('id', row.id);
            if (delErr) {
                console.error('PUT /api/admin/remake-categories delete old:', delErr);
                return res.status(500).json({ error: '移除舊分類失敗', details: delErr.message });
            }
        }
        res.json({ success: true });
    } catch (e) {
        console.error('PUT /api/admin/remake-categories 異常:', e);
        res.status(500).json({ error: '系統錯誤', details: e && e.message ? e.message : undefined });
    }
});

// DELETE /api/admin/remake-categories/:key — 停用或永久刪除（?permanent=1）
app.delete('/api/admin/remake-categories/:key', async (req, res) => {
    try {
        const user = await requireAdmin(req, res);
        if (!user) return;
        let key = req.params.key;
        try { key = decodeURIComponent(key || ''); } catch (_) { key = req.params.key || ''; }
        if (!key) return res.status(400).json({ error: '缺少 key' });
        const { data: allMain } = await supabase.from('remake_categories').select('id, key');
        const row = (allMain || []).find(r => r.key === key);
        if (!row) return res.status(400).json({ error: '找不到此分類' });
        const permanent = req.query.permanent === '1' || req.query.permanent === 'true';
        if (permanent) {
            const { error } = await supabase.from('remake_categories').delete().eq('id', row.id);
            if (error) {
                console.error('DELETE /api/admin/remake-categories:', error);
                return res.status(500).json({ error: '刪除失敗' });
            }
        } else {
            const { error } = await supabase.from('remake_categories').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', row.id);
            if (error) {
                console.error('DELETE /api/admin/remake-categories:', error);
                return res.status(500).json({ error: '停用失敗' });
            }
        }
        res.json({ success: true });
    } catch (e) {
        console.error('DELETE /api/admin/remake-categories 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

app.post('/api/admin/remake-subcategories', express.json(), async (req, res) => {
    try {
        const user = await requireAdmin(req, res);
        if (!user) return;
        const { category_key, key, name, name_en, name_ja, name_es, name_de, name_fr, prompt, sort_order } = req.body || {};
        if (!category_key || !String(category_key).trim()) return res.status(400).json({ error: '請填寫 category_key' });
        if (!key || !String(key).trim()) return res.status(400).json({ error: '請填寫 key' });
        const cKey = String(category_key).trim();
        const k = String(key).trim().toLowerCase().replace(/\s+/g, '_');
        const payload = {
            category_key: cKey,
            key: k,
            name: (name && String(name).trim()) || k,
            prompt: prompt != null ? String(prompt) : '',
            sort_order: sort_order != null ? Number(sort_order) : 0,
            is_active: true
        };
        if (name_en !== undefined) payload.name_en = name_en != null && String(name_en).trim() !== '' ? String(name_en).trim() : null;
        for (const col of ['name_ja', 'name_es', 'name_de', 'name_fr']) if (req.body[col] !== undefined) payload[col] = req.body[col] != null && String(req.body[col]).trim() !== '' ? String(req.body[col]).trim() : null;
        let error = (await supabase.from('remake_subcategories').insert(payload)).error;
        if (error && (error.code === '42703' || (error.message && /column.*does not exist|name_en|name_ja/.test(error.message)))) {
            const basePayload = { category_key: cKey, key: k, name: (name && String(name).trim()) || k, prompt: prompt != null ? String(prompt) : '', sort_order: sort_order != null ? Number(sort_order) : 0, is_active: true };
            error = (await supabase.from('remake_subcategories').insert(basePayload)).error;
        }
        if (error) {
            if (error.code === '23503') return res.status(400).json({ error: '主分類不存在' });
            if (error.code === '23505') return res.status(400).json({ error: '此主分類下已存在相同 key 的子分類' });
            console.error('POST /api/admin/remake-subcategories:', error);
            return res.status(500).json({ error: '新增失敗' });
        }
        res.status(201).json({ success: true });
    } catch (e) {
        console.error('POST /api/admin/remake-subcategories 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

app.put('/api/admin/remake-subcategories/:category_key/:key', express.json(), async (req, res) => {
    try {
        const user = await requireAdmin(req, res);
        if (!user) return;
        let category_key = req.params.category_key;
        let key = req.params.key;
        try { category_key = decodeURIComponent(category_key || ''); } catch (_) {}
        try { key = decodeURIComponent(key || ''); } catch (_) {}
        if (!category_key || !key) return res.status(400).json({ error: '缺少參數' });
        const { data: allSub } = await supabase.from('remake_subcategories').select('id, category_key, key');
        const subRow = (allSub || []).find(s => s.category_key === category_key && s.key === key);
        if (!subRow) return res.status(400).json({ error: '找不到此子分類' });
        const { key: newKey, name, name_en, name_ja, name_es, name_de, name_fr, prompt, sort_order, is_active } = req.body || {};
        const updates = {};
        const keyToWrite = (newKey != null && String(newKey).trim()) ? String(newKey).trim().toLowerCase().replace(/\s+/g, '_') : key;
        if (keyToWrite !== key) {
            if ((allSub || []).some(s => s.category_key === category_key && s.key === keyToWrite)) return res.status(400).json({ error: '此主分類下已存在相同 key' });
            updates.key = keyToWrite;
        }
        if (name !== undefined) updates.name = String(name).trim() || keyToWrite;
        if (name_en !== undefined) updates.name_en = name_en != null && String(name_en).trim() !== '' ? String(name_en).trim() : null;
        for (const col of ['name_ja', 'name_es', 'name_de', 'name_fr']) if (req.body[col] !== undefined) updates[col] = req.body[col] != null && String(req.body[col]).trim() !== '' ? String(req.body[col]).trim() : null;
        if (prompt !== undefined) updates.prompt = String(prompt);
        if (sort_order !== undefined) updates.sort_order = Number(sort_order);
        if (is_active !== undefined) updates.is_active = !!is_active;
        updates.updated_at = new Date().toISOString();
        let error = (await supabase.from('remake_subcategories').update(updates).eq('id', subRow.id)).error;
        const isColumnMissingRemakeSub = error && (error.code === '42703' || error.code === 'PGRST204' || (error.message && /column.*does not exist|Could not find.*column|schema cache|name_en|name_ja|name_de|name_es|name_fr/.test(error.message)));
        if (error && isColumnMissingRemakeSub) {
            const baseUpdates = { updated_at: updates.updated_at };
            if (updates.key) baseUpdates.key = updates.key;
            if (name !== undefined) baseUpdates.name = String(name).trim() || keyToWrite;
            if (prompt !== undefined) baseUpdates.prompt = String(prompt);
            if (sort_order !== undefined) baseUpdates.sort_order = Number(sort_order);
            if (is_active !== undefined) baseUpdates.is_active = !!is_active;
            error = (await supabase.from('remake_subcategories').update(baseUpdates).eq('id', subRow.id)).error;
            if (error) {
                console.error('PUT /api/admin/remake-subcategories:', error);
                return res.status(500).json({ error: '更新失敗。若需多語系欄位，請執行 docs/add-remake-categories-multilang.sql' });
            }
        } else if (error) {
            console.error('PUT /api/admin/remake-subcategories:', error);
            return res.status(500).json({ error: '更新失敗' });
        }
        res.json({ success: true });
    } catch (e) {
        console.error('PUT /api/admin/remake-subcategories 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// DELETE /api/admin/remake-subcategories/:category_key/:key — 停用或永久刪除（?permanent=1）
app.delete('/api/admin/remake-subcategories/:category_key/:key', async (req, res) => {
    try {
        const user = await requireAdmin(req, res);
        if (!user) return;
        let category_key = req.params.category_key;
        let key = req.params.key;
        try { category_key = decodeURIComponent(category_key || ''); } catch (_) {}
        try { key = decodeURIComponent(key || ''); } catch (_) {}
        if (!category_key || !key) return res.status(400).json({ error: '缺少參數' });
        const { data: allSub } = await supabase.from('remake_subcategories').select('id, category_key, key');
        const subRow = (allSub || []).find(s => s.category_key === category_key && s.key === key);
        if (!subRow) return res.status(400).json({ error: '找不到此子分類' });
        const permanent = req.query.permanent === '1' || req.query.permanent === 'true';
        if (permanent) {
            const { error } = await supabase.from('remake_subcategories').delete().eq('id', subRow.id);
            if (error) {
                console.error('DELETE /api/admin/remake-subcategories:', error);
                return res.status(500).json({ error: '刪除失敗' });
            }
        } else {
            const { error } = await supabase.from('remake_subcategories').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', subRow.id);
            if (error) {
                console.error('DELETE /api/admin/remake-subcategories:', error);
                return res.status(500).json({ error: '停用失敗' });
            }
        }
        res.json({ success: true });
    } catch (e) {
        console.error('DELETE /api/admin/remake-subcategories 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// 模擬廠商推薦（客製產品專用）
// 依分類回傳對應的模擬廠商（西裝／服飾不應出現 3D 列印）
function generateMockManufacturersForCustomProduct(category, analysis) {
    const apparelMocks = [
        { id: 'mock-apparel-1', name: '時尚布藝工作室', specialty: '客製化布料與服飾', rating: 4.7, location: '高雄市', capabilities: ['快速打樣', '設計諮詢'], matchScore: 90 },
        { id: 'mock-apparel-2', name: '西裝訂製工坊', specialty: '英式／義式西裝訂製', rating: 4.8, location: '台北市', capabilities: ['西裝訂製', '布料選配'], matchScore: 92 }
    ];
    const furnitureMocks = [
        { id: 'mock-furniture-1', name: '匠心木工坊', specialty: '專注原木家具訂製', rating: 4.8, location: '台北市', capabilities: ['快速打樣', '客製化設計'], matchScore: 92 },
        { id: 'mock-furniture-2', name: '現代傢俱工作室', specialty: '現代風格家具', rating: 4.6, location: '新北市', capabilities: ['家具訂製', '設計優化'], matchScore: 88 }
    ];
    const defaultMocks = [
        { id: 'mock-default-1', name: '全能訂製工坊', specialty: '各類產品訂製', rating: 4.6, location: '台北市', capabilities: ['快速打樣', '設計諮詢'], matchScore: 85 },
        { id: 'mock-default-2', name: '精工製作所', specialty: '精密訂製', rating: 4.4, location: '桃園市', capabilities: ['小量生產', '設計優化'], matchScore: 82 }
    ];

    const cat = (category || '').toLowerCase();
    const isApparel = /apparel|服飾|西裝|衣服|服裝|tshirt|shirt|suit|dress/.test(cat) || (analysis && typeof analysis === 'object' && /西裝|服飾|服裝/.test(JSON.stringify(analysis)));
    const isFurniture = /furniture|家具|傢俱|木工|沙發/.test(cat);
    const list = isApparel ? apparelMocks : (isFurniture ? furnitureMocks : defaultMocks);

    return list.map(mfr => ({
        ...mfr,
        contact: { phone: '02-xxxx-xxxx', email: 'info@example.com' },
        matchReasons: { category_match: true, mock: true }
    }));
}

/**
 * GET /api/projects/:projectId/matched-experts
 * 媒合成功後取得廠商列表含聯絡資料（與預媒合差別：此為實際媒合結果且含聯絡方式）
 */
app.get('/api/projects/:projectId/matched-experts', async (req, res) => {
    try {
        const projectId = req.params.projectId;
        const token = req.headers.authorization?.replace(/^\s*Bearer\s+/i, '') || req.headers['x-auth-token'];
        if (!token) return res.status(401).json({ error: '請先登入' });
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: '登入已過期或無效' });
        const { data: project, error: projErr } = await supabase.from('projects').select('id, owner_id').eq('id', projectId).single();
        if (projErr || !project) return res.status(404).json({ error: '找不到專案' });
        if (project.owner_id !== user.id) return res.status(403).json({ error: '僅專案擁有者可查看媒合廠商' });

        const { data: matches, error: matchErr } = await supabase
            .from('matches')
            .select('id, expert_id, expert_listing_id, match_score, status')
            .eq('project_id', projectId)
            .eq('status', 'active')
            .order('match_score', { ascending: false });
        if (matchErr) return res.status(500).json({ error: '取得媒合記錄失敗' });
        if (!matches || matches.length === 0) return res.json([]);

        const expertIds = [...new Set(matches.map(m => m.expert_id))];
        const listingIds = [...new Set(matches.map(m => m.expert_listing_id).filter(Boolean))];

        let listingsMap = {};
        if (listingIds.length > 0) {
            const { data: listings } = await supabase.from('listings').select('id, title, description, expert_id, tags, images, youtube_urls, media_embeds').in('id', listingIds);
            if (listings) listings.forEach(l => { listingsMap[l.id] = l; });
        }
        let contactMap = {};
        const { data: contacts } = await supabase.from('contact_info').select('user_id, phone, mobile, email, line_id').in('user_id', expertIds);
        if (contacts) contacts.forEach(c => { contactMap[c.user_id] = c; });
        let nameMap = {};
        try {
            const { data: profs } = await supabase.from('profiles').select('id, full_name, raw_user_meta_data').in('id', expertIds);
            if (profs) profs.forEach(p => { nameMap[p.id] = p.full_name || p.raw_user_meta_data?.full_name || null; });
        } catch (_) {}
        let portfolioByExpert = {};
        try {
            const { data: portfolioRows } = await supabase.from('expert_portfolio').select('id, expert_id, title, description, image_url, sort_order').in('expert_id', expertIds).order('sort_order', { ascending: true });
            if (portfolioRows) portfolioRows.forEach(p => { if (!portfolioByExpert[p.expert_id]) portfolioByExpert[p.expert_id] = []; portfolioByExpert[p.expert_id].push(p); });
        } catch (_) {}

        const list = matches.map(m => {
            const listing = m.expert_listing_id ? listingsMap[m.expert_listing_id] : null;
            const contact = contactMap[m.expert_id] || {};
            const displayName = nameMap[m.expert_id] || (listing && listing.title) || '廠商';
            const listingMedia = listing ? {
                images: (listing.images && Array.isArray(listing.images)) ? listing.images : (listing.images ? [listing.images] : []),
                youtube_urls: (listing.youtube_urls && Array.isArray(listing.youtube_urls)) ? listing.youtube_urls : [],
                media_embeds: (listing.media_embeds && Array.isArray(listing.media_embeds)) ? listing.media_embeds : []
            } : { images: [], youtube_urls: [], media_embeds: [] };
            return {
                match_id: m.id,
                expert_id: m.expert_id,
                expert_name: displayName,
                listing_title: listing?.title || '未命名服務',
                listing_description: listing?.description || '',
                listing_tags: (listing?.tags && Array.isArray(listing.tags)) ? listing.tags : [],
                match_score: m.match_score,
                listing_media: listingMedia,
                portfolio: portfolioByExpert[m.expert_id] || [],
                contact: {
                    phone: contact.phone || null,
                    mobile: contact.mobile || null,
                    email: contact.email || null,
                    line_id: contact.line_id || null
                }
            };
        });
        res.json(list);
    } catch (e) {
        console.error('GET matched-experts 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

/**
 * DELETE /api/projects/:projectId/matches/:matchId
 * 刪除單筆媒合記錄（從廠商列表中移除該廠商），僅專案擁有者
 */
app.delete('/api/projects/:projectId/matches/:matchId', async (req, res) => {
    try {
        const { projectId, matchId } = req.params;
        const token = req.headers.authorization?.replace(/^\s*Bearer\s+/i, '') || req.headers['x-auth-token'];
        if (!token) return res.status(401).json({ error: '請先登入' });
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: '登入已過期或無效' });
        const { data: project, error: projErr } = await supabase.from('projects').select('id, owner_id').eq('id', projectId).single();
        if (projErr || !project) return res.status(404).json({ error: '找不到專案' });
        if (project.owner_id !== user.id) return res.status(403).json({ error: '僅專案擁有者可刪除媒合記錄' });

        const { data: match, error: matchErr } = await supabase
            .from('matches')
            .select('id')
            .eq('id', matchId)
            .eq('project_id', projectId)
            .single();
        if (matchErr || !match) return res.status(404).json({ error: '找不到該筆媒合記錄' });

        const { error: delErr } = await supabase
            .from('matches')
            .delete()
            .eq('id', matchId)
            .eq('project_id', projectId);
        if (delErr) return res.status(500).json({ error: '刪除失敗：' + delErr.message });
        res.json({ success: true, message: '已從廠商列表移除' });
    } catch (e) {
        console.error('DELETE match 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

/**
 * 取得或建立「專案 × 專家」的對話串，並回傳訊息列表
 * POST /api/projects/:projectId/conversations
 * body: { expert_id }
 * 僅專案擁有者（client）可呼叫；回傳 { conversation_id, messages }，messages 含 sender_id、body、created_at、is_mine
 */
app.post('/api/projects/:projectId/conversations', express.json(), async (req, res) => {
    try {
        const projectId = req.params.projectId;
        const expertId = req.body?.expert_id;
        if (!projectId || !expertId) return res.status(400).json({ error: '缺少 project_id 或 expert_id' });
        const token = req.headers.authorization?.replace(/^\s*Bearer\s+/i, '') || req.headers['x-auth-token'];
        if (!token) return res.status(401).json({ error: '請先登入' });
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: '登入已過期或無效' });

        const { data: project, error: projErr } = await supabase.from('projects').select('id, owner_id').eq('id', projectId).single();
        if (projErr || !project) return res.status(404).json({ error: '找不到專案' });
        if (project.owner_id !== user.id) return res.status(403).json({ error: '僅專案擁有者可開啟對話' });

        let { data: conv, error: convErr } = await supabase
            .from('conversations')
            .select('id')
            .eq('project_id', projectId)
            .eq('expert_id', expertId)
            .eq('client_id', user.id)
            .maybeSingle();
        if (convErr) return res.status(500).json({ error: '查詢對話失敗', details: convErr.message });
        if (!conv) {
            const { data: inserted, error: insErr } = await supabase
                .from('conversations')
                .insert({ project_id: projectId, client_id: user.id, expert_id: expertId })
                .select('id')
                .single();
            if (insErr) return res.status(500).json({ error: '建立對話失敗', details: insErr.message });
            conv = inserted;
        }
        const { data: messages, error: msgErr } = await supabase
            .from('messages')
            .select('id, sender_id, body, created_at')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: true });
        if (msgErr) return res.status(500).json({ error: '讀取訊息失敗', details: msgErr.message });
        const list = (messages || []).map(m => ({
            id: m.id,
            sender_id: m.sender_id,
            body: m.body,
            created_at: m.created_at,
            is_mine: m.sender_id === user.id
        }));
        return res.json({ conversation_id: conv.id, messages: list });
    } catch (e) {
        console.error('POST conversations 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

/**
 * 專家端：取得或建立與該專案發案者的對話（專家可主動開啟對話）
 * POST /api/projects/:projectId/conversations/for-expert
 * 僅該專案之媒合專家可呼叫；回傳 { conversation_id, messages }
 */
app.post('/api/projects/:projectId/conversations/for-expert', express.json(), async (req, res) => {
    try {
        const projectId = req.params.projectId;
        const token = req.headers.authorization?.replace(/^\s*Bearer\s+/i, '') || req.headers['x-auth-token'];
        if (!token) return res.status(401).json({ error: '請先登入' });
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: '登入已過期或無效' });

        const { data: project, error: projErr } = await supabase.from('projects').select('id, owner_id').eq('id', projectId).single();
        if (projErr || !project) return res.status(404).json({ error: '找不到專案' });
        const { data: match } = await supabase.from('matches').select('id').eq('project_id', projectId).eq('expert_id', user.id).eq('status', 'active').maybeSingle();
        if (!match) return res.status(403).json({ error: '僅媒合成功的專家可與發案者對話' });

        let { data: conv, error: convErr } = await supabase
            .from('conversations')
            .select('id')
            .eq('project_id', projectId)
            .eq('client_id', project.owner_id)
            .eq('expert_id', user.id)
            .maybeSingle();
        if (convErr) return res.status(500).json({ error: '查詢對話失敗', details: convErr.message });
        if (!conv) {
            const { data: inserted, error: insErr } = await supabase
                .from('conversations')
                .insert({ project_id: projectId, client_id: project.owner_id, expert_id: user.id })
                .select('id')
                .single();
            if (insErr) return res.status(500).json({ error: '建立對話失敗', details: insErr.message });
            conv = inserted;
        }
        const { data: messages, error: msgErr } = await supabase
            .from('messages')
            .select('id, sender_id, body, created_at')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: true });
        if (msgErr) return res.status(500).json({ error: '讀取訊息失敗', details: msgErr.message });
        const list = (messages || []).map(m => ({
            id: m.id,
            sender_id: m.sender_id,
            body: m.body,
            created_at: m.created_at,
            is_mine: m.sender_id === user.id
        }));
        return res.json({ conversation_id: conv.id, messages: list });
    } catch (e) {
        console.error('POST conversations/for-expert 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

/**
 * GET /api/conversations/:conversationId/messages
 * 僅對話參與者（client 或 expert）可讀
 */
app.get('/api/conversations/:conversationId/messages', async (req, res) => {
    try {
        const { conversationId } = req.params;
        const token = req.headers.authorization?.replace(/^\s*Bearer\s+/i, '') || req.headers['x-auth-token'];
        if (!token) return res.status(401).json({ error: '請先登入' });
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: '登入已過期或無效' });

        const { data: conv, error: convErr } = await supabase
            .from('conversations')
            .select('id, client_id, expert_id')
            .eq('id', conversationId)
            .single();
        if (convErr || !conv) return res.status(404).json({ error: '找不到對話' });
        if (conv.client_id !== user.id && conv.expert_id !== user.id) return res.status(403).json({ error: '僅參與者可查看訊息' });

        const { data: messages, error: msgErr } = await supabase
            .from('messages')
            .select('id, sender_id, body, created_at')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true });
        if (msgErr) return res.status(500).json({ error: '讀取訊息失敗', details: msgErr.message });
        const list = (messages || []).map(m => ({
            id: m.id,
            sender_id: m.sender_id,
            body: m.body,
            created_at: m.created_at,
            is_mine: m.sender_id === user.id
        }));
        return res.json({ messages: list });
    } catch (e) {
        console.error('GET messages 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

/**
 * POST /api/conversations/:conversationId/messages
 * body: { body }
 * 僅對話參與者可發送
 */
app.post('/api/conversations/:conversationId/messages', express.json(), async (req, res) => {
    try {
        const { conversationId } = req.params;
        const body = (req.body?.body || '').toString().trim();
        if (!body) return res.status(400).json({ error: '訊息內容不可為空' });
        const token = req.headers.authorization?.replace(/^\s*Bearer\s+/i, '') || req.headers['x-auth-token'];
        if (!token) return res.status(401).json({ error: '請先登入' });
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: '登入已過期或無效' });

        const { data: conv, error: convErr } = await supabase
            .from('conversations')
            .select('id, client_id, expert_id')
            .eq('id', conversationId)
            .single();
        if (convErr || !conv) return res.status(404).json({ error: '找不到對話' });
        if (conv.client_id !== user.id && conv.expert_id !== user.id) return res.status(403).json({ error: '僅參與者可發送訊息' });

        const { data: msg, error: insErr } = await supabase
            .from('messages')
            .insert({ conversation_id: conversationId, sender_id: user.id, body })
            .select('id, sender_id, body, created_at')
            .single();
        if (insErr) return res.status(500).json({ error: '發送失敗', details: insErr.message });
        return res.status(201).json({
            message: {
                id: msg.id,
                sender_id: msg.sender_id,
                body: msg.body,
                created_at: msg.created_at,
                is_mine: true
            }
        });
    } catch (e) {
        console.error('POST message 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// ——— 聯絡清單（訂製者/製作方 對話用） ———
function getAuthUser(req) {
    const token = req.headers.authorization?.replace(/^\s*Bearer\s+/i, '') || req.headers['x-auth-token'];
    return token ? supabase.auth.getUser(token).then(({ data: { user }, error }) => (error ? null : user)) : Promise.resolve(null);
}

app.get('/api/contact-list', async (req, res) => {
    try {
        const user = await getAuthUser(req);
        if (!user) return res.status(401).json({ error: '請先登入' });
        const { data: rows, error } = await supabase.from('contact_list').select('saved_user_id, created_at').eq('user_id', user.id).order('created_at', { ascending: false });
        if (error) return res.status(500).json({ error: '讀取聯絡清單失敗' });
        const ids = (rows || []).map(r => r.saved_user_id).filter(Boolean);
        let display = {};
        if (ids.length > 0) {
            const { data: profiles } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', ids);
            (profiles || []).forEach(p => { display[p.id] = { full_name: p.full_name, avatar_url: p.avatar_url }; });
        }
        const list = (rows || []).map(r => ({ saved_user_id: r.saved_user_id, created_at: r.created_at, display: display[r.saved_user_id] || {} }));
        res.json({ contacts: list });
    } catch (e) {
        console.error('GET /api/contact-list:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

app.post('/api/contact-list', express.json(), async (req, res) => {
    try {
        const user = await getAuthUser(req);
        if (!user) return res.status(401).json({ error: '請先登入' });
        const otherId = req.body?.user_id || req.body?.saved_user_id;
        if (!otherId) return res.status(400).json({ error: '請提供 user_id' });
        if (otherId === user.id) return res.status(400).json({ error: '無法將自己加入聯絡清單' });
        const { error: err } = await supabase.from('contact_list').upsert({ user_id: user.id, saved_user_id: otherId }, { onConflict: 'user_id,saved_user_id' });
        if (err) return res.status(500).json({ error: '加入失敗' });
        res.status(201).json({ success: true });
    } catch (e) {
        console.error('POST /api/contact-list:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

app.delete('/api/contact-list/:userId', async (req, res) => {
    try {
        const user = await getAuthUser(req);
        if (!user) return res.status(401).json({ error: '請先登入' });
        const { error } = await supabase.from('contact_list').delete().eq('user_id', user.id).eq('saved_user_id', req.params.userId);
        if (error) return res.status(500).json({ error: '移除失敗' });
        res.json({ success: true });
    } catch (e) {
        console.error('DELETE /api/contact-list:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// ——— 直接對話（1:1，訂製者-製作方） ———
app.get('/api/direct-conversations', async (req, res) => {
    try {
        const user = await getAuthUser(req);
        if (!user) return res.status(401).json({ error: '請先登入' });
        const { data: convos, error } = await supabase.from('direct_conversations').select('id, user_a_id, user_b_id, updated_at').or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`).order('updated_at', { ascending: false });
        if (error) return res.status(500).json({ error: '讀取對話列表失敗' });
        const list = (convos || []).map(c => {
            const otherId = c.user_a_id === user.id ? c.user_b_id : c.user_a_id;
            return { id: c.id, other_user_id: otherId, updated_at: c.updated_at };
        });
        const otherIds = list.map(l => l.other_user_id);
        let display = {};
        if (otherIds.length > 0) {
            const { data: profiles } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', otherIds);
            (profiles || []).forEach(p => { display[p.id] = { full_name: p.full_name, avatar_url: p.avatar_url }; });
            const convIds = list.map(l => l.id);
            const { data: allMsgs } = await supabase.from('direct_messages').select('conversation_id, body, created_at').in('conversation_id', convIds);
            const byConv = {};
            (allMsgs || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).forEach(m => { if (!byConv[m.conversation_id]) byConv[m.conversation_id] = m; });
            list.forEach(l => { l.last_message = byConv[l.id] ? { body: byConv[l.id].body, created_at: byConv[l.id].created_at } : null; l.display = display[l.other_user_id] || {}; });
        } else list.forEach(l => { l.last_message = null; l.display = {}; });
        res.json({ conversations: list });
    } catch (e) {
        console.error('GET /api/direct-conversations:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

app.post('/api/direct-conversations', express.json(), async (req, res) => {
    try {
        const user = await getAuthUser(req);
        if (!user) return res.status(401).json({ error: '請先登入' });
        const otherId = req.body?.other_user_id || req.body?.user_id;
        if (!otherId) return res.status(400).json({ error: '請提供 other_user_id' });
        if (otherId === user.id) return res.status(400).json({ error: '無法與自己對話' });
        const [idA, idB] = [user.id, otherId].sort();
        let { data: conv, error: findErr } = await supabase.from('direct_conversations').select('id').eq('user_a_id', idA).eq('user_b_id', idB).maybeSingle();
        if (findErr) return res.status(500).json({ error: '查詢對話失敗' });
        if (!conv) {
            const { data: inserted, error: insErr } = await supabase.from('direct_conversations').insert({ user_a_id: idA, user_b_id: idB }).select('id').single();
            if (insErr) return res.status(500).json({ error: '建立對話失敗' });
            conv = inserted;
        }
        const { data: messages, error: msgErr } = await supabase.from('direct_messages').select('id, sender_id, body, created_at').eq('conversation_id', conv.id).order('created_at', { ascending: true });
        if (msgErr) return res.status(500).json({ error: '讀取訊息失敗' });
        const msgList = (messages || []).map(m => ({ id: m.id, sender_id: m.sender_id, body: m.body, created_at: m.created_at, is_mine: m.sender_id === user.id }));
        res.json({ conversation_id: conv.id, messages: msgList });
    } catch (e) {
        console.error('POST /api/direct-conversations:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

app.get('/api/direct-conversations/:conversationId/messages', async (req, res) => {
    try {
        const user = await getAuthUser(req);
        if (!user) return res.status(401).json({ error: '請先登入' });
        const { conversationId } = req.params;
        const { data: conv, error: cErr } = await supabase.from('direct_conversations').select('id, user_a_id, user_b_id').eq('id', conversationId).single();
        if (cErr || !conv) return res.status(404).json({ error: '找不到對話' });
        if (conv.user_a_id !== user.id && conv.user_b_id !== user.id) return res.status(403).json({ error: '僅參與者可查看' });
        const { data: messages, error: mErr } = await supabase.from('direct_messages').select('id, sender_id, body, created_at').eq('conversation_id', conversationId).order('created_at', { ascending: true });
        if (mErr) return res.status(500).json({ error: '讀取訊息失敗' });
        const list = (messages || []).map(m => ({ id: m.id, sender_id: m.sender_id, body: m.body, created_at: m.created_at, is_mine: m.sender_id === user.id }));
        res.json({ messages: list });
    } catch (e) {
        console.error('GET /api/direct-conversations/:id/messages:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

app.post('/api/direct-conversations/:conversationId/messages', express.json(), async (req, res) => {
    try {
        const user = await getAuthUser(req);
        if (!user) return res.status(401).json({ error: '請先登入' });
        const body = (req.body?.body || '').toString().trim();
        if (!body) return res.status(400).json({ error: '訊息內容不可為空' });
        const { conversationId } = req.params;
        const { data: conv, error: cErr } = await supabase.from('direct_conversations').select('id').eq('id', conversationId).single();
        if (cErr || !conv) return res.status(404).json({ error: '找不到對話' });
        const { data: convFull } = await supabase.from('direct_conversations').select('user_a_id, user_b_id').eq('id', conversationId).single();
        if (convFull && convFull.user_a_id !== user.id && convFull.user_b_id !== user.id) return res.status(403).json({ error: '僅參與者可發送' });
        const { data: msg, error: insErr } = await supabase.from('direct_messages').insert({ conversation_id: conversationId, sender_id: user.id, body }).select('id, sender_id, body, created_at').single();
        if (insErr) return res.status(500).json({ error: '發送失敗' });
        res.status(201).json({ message: { id: msg.id, sender_id: msg.sender_id, body: msg.body, created_at: msg.created_at, is_mine: true } });
    } catch (e) {
        console.error('POST /api/direct-conversations/:id/messages:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

/**
 * POST /api/projects/:projectId/sync-items
 * 將「我的專案」描述中的項目寫入 project_items 表（後端以 service role 寫入，繞過 RLS）
 * 僅允許專案擁有者操作。
 */
app.post('/api/projects/:projectId/sync-items', express.json(), async (req, res) => {
    try {
        const projectId = req.params.projectId;
        const { items } = req.body;
        if (!projectId || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: '缺少 projectId 或 items 陣列' });
        }

        let token = req.headers.authorization?.replace(/^\s*Bearer\s+/i, '') || req.headers['x-auth-token'];
        if (!token) {
            return res.status(401).json({ error: '請先登入' });
        }
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            return res.status(401).json({ error: '登入已過期或無效，請重新登入' });
        }

        const { data: project, error: projErr } = await supabase
            .from('projects')
            .select('id, owner_id')
            .eq('id', projectId)
            .single();
        if (projErr || !project) {
            return res.status(404).json({ error: '找不到專案' });
        }
        if (project.owner_id !== user.id) {
            return res.status(403).json({ error: '僅專案擁有者可以同步項目' });
        }

        // subcategory 有 FK 至 ai_subcategories(key)，只接受有效 key 或 null
        let validSubcategoryKeys = [];
        try {
            const { data: keys } = await supabase.from('ai_subcategories').select('key');
            if (keys && keys.length) validSubcategoryKeys = keys.map((r) => r.key);
        } catch (_) {}

        const norm = (s) => (s || '').toString().trim();
        const buildRow = (it) => {
            const rawSub = it.subcategory ?? null;
            const subcategory = (rawSub && validSubcategoryKeys.includes(rawSub)) ? rawSub : null;
            const tags = Array.isArray(it.tags) ? it.tags : [];
            return {
                project_id: projectId,
                item_name: it.item_name || '未命名',
                item_description: it.item_description ?? null,
                category_name: it.category_name ?? null,
                subcategory,
                quantity: it.quantity ?? null,
                unit: it.unit ?? null,
                budget_min: it.budget_min ?? null,
                budget_max: it.budget_max ?? null,
                requirements: tags.length ? { tags } : {},
                status: 'draft'
            };
        };

        // 取得既有 project_items，依「名稱＋說明」對應，有則更新、無則新增（可被我的專案儲存時自動同步呼叫）
        const { data: existingRows, error: fetchErr } = await supabase
            .from('project_items')
            .select('id, item_name, item_description')
            .eq('project_id', projectId);
        if (fetchErr) {
            console.error('sync-items fetch existing error:', fetchErr);
            return res.status(500).json({ error: '讀取既有項目失敗' });
        }
        const existingList = existingRows || [];
        const usedIds = new Set();

        const toUpdate = [];
        const toInsert = [];
        for (const it of items) {
            const name = norm(it.item_name || '未命名');
            const desc = norm(it.item_description ?? it.spec ?? '');
            const matched = existingList.find(
                (r) => !usedIds.has(r.id) && norm(r.item_name) === name && norm(r.item_description) === desc
            );
            const row = buildRow(it);
            if (matched) {
                usedIds.add(matched.id);
                toUpdate.push({ id: matched.id, row });
            } else {
                toInsert.push(row);
            }
        }

        let updatedCount = 0;
        for (const { id, row } of toUpdate) {
            const { error: upErr } = await supabase
                .from('project_items')
                .update({
                    item_name: row.item_name,
                    item_description: row.item_description,
                    category_name: row.category_name,
                    subcategory: row.subcategory,
                    quantity: row.quantity,
                    unit: row.unit,
                    budget_min: row.budget_min,
                    budget_max: row.budget_max,
                    requirements: row.requirements
                    // 不更新 status，保留已發包等狀態
                })
                .eq('id', id);
            if (!upErr) updatedCount++;
        }

        let inserted = [];
        if (toInsert.length > 0) {
            const { data: ins, error: insertError } = await supabase
                .from('project_items')
                .insert(toInsert)
                .select('id, item_name, item_description, category_name, subcategory, quantity, unit, budget_min, budget_max, requirements, status');
            if (insertError) {
                const msg = insertError.message || '';
                const isSchemaError = /total_items|published_items|column.*does not exist|subcategory|quantity|unit/i.test(msg);
                console.error('sync-items insert error:', insertError.code || '', msg, insertError.details || '');
                return res.status(500).json({
                    error: '同步暫時無法使用，請稍後再試或聯絡管理員。',
                    code: isSchemaError ? 'SCHEMA_FIX_NEEDED' : 'INSERT_FAILED'
                });
            }
            inserted = ins || [];
        }
        res.json({
            success: true,
            count: updatedCount + inserted.length,
            updated: updatedCount,
            inserted: inserted.length,
            ids: toUpdate.map((u) => u.id).concat(inserted.map((r) => r.id)),
            items: inserted
        });
    } catch (e) {
        console.error('POST /api/projects/:projectId/sync-items 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

/**
 * PATCH /api/projects/:projectId/items/:itemId
 * 更新單一 project_item 欄位（後端寫入，繞過 RLS），僅專案擁有者
 */
app.patch('/api/projects/:projectId/items/:itemId', express.json(), async (req, res) => {
    try {
        const projectId = req.params.projectId;
        const itemId = req.params.itemId;
        const body = req.body || {};
        const { field, value, updates: bodyUpdates, requirements: bodyRequirements } = body;
        const bodyTags = body.tags; // 相容：僅送 tags 陣列時也接受
        const allowed = ['item_name', 'item_description', 'quantity', 'unit', 'budget_min', 'budget_max'];
        let updates = {};
        if (bodyUpdates && typeof bodyUpdates === 'object') {
            for (const k of allowed) {
                if (bodyUpdates[k] !== undefined) {
                    let v = bodyUpdates[k];
                    if (k === 'quantity') v = (v === '' || v === null || v === undefined) ? null : parseFloat(v);
                    else if (k === 'budget_min' || k === 'budget_max') v = (v === '' || v === null || v === undefined) ? null : parseInt(v, 10);
                    else if (v === '') v = null;
                    updates[k] = v;
                }
            }
        } else if (field && allowed.includes(field)) {
            let v = value;
            if (field === 'quantity') v = (v === '' || v === null || v === undefined) ? null : parseFloat(v);
            else if (field === 'budget_min' || field === 'budget_max') v = (v === '' || v === null || v === undefined) ? null : parseInt(v, 10);
            else if (v === '') v = null;
            updates[field] = v;
        }
        // 支援直接更新 requirements（如標籤）：body.requirements.tags 或 body.tags
        if (bodyRequirements !== undefined || bodyTags !== undefined) {
            const tagsFromReq = bodyRequirements && typeof bodyRequirements === 'object' && Array.isArray(bodyRequirements.tags)
                ? bodyRequirements.tags
                : Array.isArray(bodyTags) ? bodyTags : (bodyRequirements && Array.isArray(bodyRequirements) ? bodyRequirements : []);
            updates.requirements = { tags: (tagsFromReq || []).filter(t => t != null && String(t).trim()) };
        }
        if (!projectId || !itemId) {
            return res.status(400).json({ error: '缺少專案或項目 ID（請確認網址含專案 id）' });
        }
        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: '請提供要更新的欄位（如 field/value、updates 或 requirements/tags）' });
        }
        const token = req.headers.authorization?.replace(/^\s*Bearer\s+/i, '') || req.headers['x-auth-token'];
        if (!token) {
            return res.status(401).json({ error: '請先登入' });
        }
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            return res.status(401).json({ error: '登入已過期或無效' });
        }
        const { data: project, error: projErr } = await supabase
            .from('projects')
            .select('id, owner_id')
            .eq('id', projectId)
            .single();
        if (projErr || !project || project.owner_id !== user.id) {
            return res.status(403).json({ error: '無權限修改此專案項目' });
        }
        const { error: updateErr } = await supabase
            .from('project_items')
            .update(updates)
            .eq('id', itemId)
            .eq('project_id', projectId);
        if (updateErr) {
            console.error('PATCH project item error:', updateErr);
            return res.status(500).json({ error: '儲存失敗：' + updateErr.message });
        }
        res.json({ success: true });
    } catch (e) {
        console.error('PATCH /api/projects/:projectId/items/:itemId 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// 更新專案項目（用於儲存 AI 辨識結果）
app.post('/api/projects/update-items', async (req, res) => {
    try {
        const { project_id, items } = req.body;
        if (!project_id || !items) {
            return res.status(400).json({ error: '缺少參數' });
        }

        // 取得目前專案資料以保留其他資訊
        // 確保查詢能正確處理可能的權限問題或空值
        const { data: currentProject, error: fetchError } = await supabase
            .from('projects')
            .select('description')
            .eq('id', project_id)
            .maybeSingle(); // 使用 maybeSingle 避免 0 rows 報錯

        if (fetchError) {
            console.error('Fetch project error:', fetchError);
            return res.status(500).json({ error: '無法取得專案: ' + fetchError.message });
        }
        
        if (!currentProject) {
             return res.status(404).json({ error: '找不到專案，可能已被刪除或無權限' });
        }

        let currentDescription = {};
        try {
            currentDescription = JSON.parse(currentProject.description || '{}');
        } catch(e) {}

        const newDescription = {
            ...currentDescription,
            items: items
        };

        // 更新時保持 is_draft 狀態（除非發佈）
        const { error: updateError } = await supabase
            .from('projects')
            .update({ description: JSON.stringify(newDescription), status: 'draft' }) 
            .eq('id', project_id);

        if (updateError) {
            console.error('Update items error:', updateError);
            return res.status(500).json({ error: updateError.message });
        }

        res.json({ success: true });
    } catch (e) {
        console.error('API Error:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// AI 生成 Tags（提示詞明確要求不准重複欄內已有標籤）
app.post('/api/ai-tags/generate', async (req, res) => {
    try {
        const { item_name, category, existing_tags: rawExisting } = req.body;
        if (!item_name) return res.status(400).json({ error: '缺少工項名稱' });

        const existingTags = Array.isArray(rawExisting) ? rawExisting.map(t => (t || '').toString().trim()).filter(Boolean) : [];

        // TODO: 檢查並扣除點數 (目前模擬)
        // const userId = req.user.id;
        // await deductCredits(userId, 5); 

        const noRepeatInstruction = existingTags.length > 0
            ? `\n【重要】以下標籤欄內已存在，嚴禁重複輸出，只可生成「不在以下列表」的新標籤。已存在標籤：${JSON.stringify(existingTags)}。請只回傳「全新、不與上述任一重複」的標籤 JSON 陣列。\n`
            : '';

        const prompt = `
你是一個建築工程與室內設計專家。
請針對工項「${item_name}」生成 3-5 個同義詞或關聯標籤 (Tags)，用於資料庫媒合與搜尋。
分類情境：${category || '一般工程'}
${noRepeatInstruction}
請直接回傳 JSON 陣列，例如：["木工", "隔間", "裝潢"]
不要回傳任何其他文字。
`;

        const modelName = await getReadModelName();
        const result = await runInGeminiQueue(() => genAI.models.generateContent({
            model: modelName,
            contents: [{ role: 'user', parts: [{ text: prompt }] }]
        }));
        const text = (result && result.text != null ? String(result.text) : '') || '';
        
        let tags = [];
        try {
            // 嘗試解析 JSON Array
            const match = text.match(/\[.*\]/s);
            if (match) {
                tags = JSON.parse(match[0]);
            } else {
                // 如果沒有 JSON，嘗試用逗號分隔
                tags = text.split(/[,，\n]/).map(t => t.trim()).filter(t => t);
            }
        } catch (e) {
            console.error('Parse tags error:', e);
            tags = [item_name]; // fallback
        }

        res.json({ success: true, tags: tags.slice(0, 5) });
    } catch (e) {
        console.error('Generate Tags Error:', e);
        res.status(500).json({ error: 'AI 生成失敗' });
    }
});

// 快速創建測試專案（不調用 AI）
app.post('/api/quick-create-project', async (req, res) => {
    try {
        let token = (req.headers.authorization || '').replace(/^\s*Bearer\s+/i, '') || req.headers['x-auth-token'];
        if (!token) {
            return res.status(401).json({ error: '未提供 token' });
        }
        
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            return res.status(401).json({ error: '用戶驗證失敗' });
        }
        
        const { data, error } = await supabase
            .from('projects')
            .insert({ 
                title: req.body.title || '測試專案',
                category: req.body.category || 'home',
                status: 'draft',
                owner_id: user.id,
                subcategory: req.body.subcategory || [],
                description: JSON.stringify({ 
                    test: true,
                    items: req.body.items || []
                })
            })
            .select()
            .single();
        
        if (error) {
            return res.status(500).json({ error: error.message, details: error });
        }
        
        res.json({ success: true, project_id: data.id, project: data });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 測試：檢查用戶認證和專案創建
app.post('/api/test-create-project', async (req, res) => {
    try {
        let token = (req.headers.authorization || '').replace(/^\s*Bearer\s+/i, '') || req.headers['x-auth-token'];
        
        const result = {
            step1_has_token: !!token,
            step2_user_id: null,
            step3_project_created: false,
            step4_project_id: null,
            errors: []
        };
        
        if (!token) {
            result.errors.push('未收到 authorization token');
            return res.json(result);
        }
        
        // 步驟2：驗證 token
        try {
            const { data: { user }, error: authError } = await supabase.auth.getUser(token);
            if (authError) {
                result.errors.push('auth.getUser 失敗: ' + authError.message);
                return res.json(result);
            }
            if (!user) {
                result.errors.push('auth.getUser 返回空用戶');
                return res.json(result);
            }
            result.step2_user_id = user.id;
        } catch (e) {
            result.errors.push('auth 例外: ' + e.message);
            return res.json(result);
        }
        
        // 步驟3：嘗試創建測試專案
        try {
            const { data, error } = await supabase
                .from('projects')
                .insert({
                    owner_id: result.step2_user_id,
                    title: '測試專案-' + new Date().toISOString(),
                    description: JSON.stringify({ test: true }),
                    status: 'draft',
                    category: 'home'
                })
                .select('id')
                .single();
            
            if (error) {
                result.errors.push('創建專案失敗: ' + error.message);
                return res.json(result);
            }
            
            result.step3_project_created = true;
            result.step4_project_id = data.id;
        } catch (e) {
            result.errors.push('創建專案例外: ' + e.message);
        }
        
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ==================== Phase 1.8 廠商端媒合專案 API ====================

/**
 * 取得當前專家「可媒合專案」列表（至少有一筆已發包 project_item 的專案；不暴露預算）
 * GET /api/match/vendor/projects
 */
app.get('/api/match/vendor/projects', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace(/^\s*Bearer\s+/i, '') || req.headers['x-auth-token'];
        if (!token) return res.status(401).json({ error: '請先登入' });
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: '登入已過期或無效' });
        const expertId = user.id;

        // 從「已存在的報價」讀取：有任一提案即顯示可媒合專案（不限定 status='active'，避免已有報價還被要求新增）
        const { data: expertListings } = await supabase
            .from('listings')
            .select('id, category, subcategory, status')
            .eq('expert_id', expertId);
        if (!expertListings || expertListings.length === 0) {
            return res.json({ projects: [], message: '請先新增至少一筆報價項目' });
        }
        const expertCategories = [...new Set((expertListings || []).map(l => l.category).filter(Boolean))];

        const { data: publishedItems } = await supabase
            .from('project_items')
            .select('project_id')
            .eq('status', 'published');
        if (!publishedItems || publishedItems.length === 0) {
            return res.json({ projects: [], message: '目前沒有已發包的專案可媒合' });
        }
        const projectIds = [...new Set(publishedItems.map(p => p.project_id))];

        const { data: projects } = await supabase
            .from('projects')
            .select('id, title, project_location, owner_id, description')
            .in('id', projectIds);
        if (!projects || projects.length === 0) return res.json({ projects: [] });

        const { data: existingMatches } = await supabase
            .from('matches')
            .select('id, project_id, match_score')
            .eq('expert_id', expertId)
            .in('project_id', projectIds);
        const matchByProject = {};
        (existingMatches || []).forEach(m => { matchByProject[m.project_id] = m; });

        const { data: itemsByProject } = await supabase
            .from('project_items')
            .select('project_id, item_name, category_name, subcategory, requirements')
            .eq('status', 'published')
            .in('project_id', projectIds);
        const itemCount = {};
        const tagsByProject = {};
        (itemsByProject || []).forEach(i => {
            itemCount[i.project_id] = (itemCount[i.project_id] || 0) + 1;
            const tags = (i.requirements && i.requirements.tags) || [];
            if (!tagsByProject[i.project_id]) tagsByProject[i.project_id] = [];
            tagsByProject[i.project_id].push(...tags);
        });
        Object.keys(tagsByProject).forEach(pid => {
            tagsByProject[pid] = [...new Set(tagsByProject[pid])].slice(0, 10);
        });

        const list = projects.map(p => {
            const match = matchByProject[p.id];
            return {
                id: p.id,
                title: p.title || '未命名專案',
                project_location: p.project_location || [],
                items_count: itemCount[p.id] || 0,
                tags_summary: tagsByProject[p.id] || [],
                already_matched: !!match,
                match_id: match ? match.id : null,
                match_score: match ? match.match_score : null,
                client_id: p.owner_id
            };
        });
        res.json({ projects: list });
    } catch (e) {
        console.error('GET /api/match/vendor/projects:', e);
        res.status(500).json({ error: e.message });
    }
});

/**
 * 專家端預媒合：查詢單一專案自己是否符合，以及預估分數與原因
 * POST /api/match/vendor/preview-project
 * body: { project_id }
 */
app.post('/api/match/vendor/preview-project', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace(/^\s*Bearer\s+/i, '') || req.headers['x-auth-token'];
        if (!token) return res.status(401).json({ error: '請先登入' });
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: '登入已過期或無效' });
        const { project_id } = req.body || {};
        if (!project_id) return res.status(400).json({ error: '請提供 project_id' });

        const { data: project } = await supabase.from('projects').select('id, owner_id, project_location').eq('id', project_id).single();
        if (!project) return res.status(404).json({ error: '找不到專案' });

        const { data: rows } = await supabase
            .from('project_items')
            .select('id, project_id, item_name, item_description, category_name, subcategory, quantity, unit, budget_min, budget_max, requirements')
            .eq('project_id', project_id)
            .eq('status', 'published');
        if (!rows || rows.length === 0) return res.json({ match: false, message: '此專案尚無已發包項目' });

        const { data: expertListings } = await supabase
            .from('listings')
            .select('id, expert_id, title, category, subcategory, description, price_min, price_max, price_tiers, unit, tags, service_location, is_remote')
            .eq('expert_id', user.id)
            .eq('status', 'active');
        if (!expertListings || expertListings.length === 0) {
            return res.json({ match: false, message: '您尚無有效報價項目' });
        }

        let categoryNameToKey = {};
        try {
            const { data: catRows } = await supabase.from('ai_categories').select('key, name');
            if (catRows && catRows.length) {
                catRows.forEach(r => {
                    if (r.key) categoryNameToKey[r.key] = r.key;
                    if (r.name) categoryNameToKey[r.name] = r.key;
                });
            }
        } catch (_) {}

        const projectLocation = Array.isArray(project.project_location) ? project.project_location : [];
        const bestByListing = {};
        for (const item of rows) {
            const categoryKeyForQuery = (item.category_name && categoryNameToKey[item.category_name]) ? categoryNameToKey[item.category_name] : (item.category_name || null);
            let query = supabase.from('listings').select('id, expert_id, title, category, subcategory, description, price_min, price_max, price_tiers, unit, tags, service_location, is_remote').eq('status', 'active').eq('expert_id', user.id);
            if (categoryKeyForQuery) query = query.eq('category', categoryKeyForQuery);
            const { data: listings } = await query;
            if (!listings || listings.length === 0) continue;
            const locationFiltered = listings.filter(l => {
                if (!projectLocation || projectLocation.length === 0) return true;
                if (l.is_remote) return true;
                if (l.service_location && l.service_location.length > 0) {
                    return projectLocation.some(loc => l.service_location.includes(loc) || l.service_location.includes('全台灣'));
                }
                return true;
            });
            const itemTags = (item.requirements && Array.isArray(item.requirements.tags)) ? item.requirements.tags : [];
            const tagFiltered = itemTags.length > 0 ? locationFiltered.filter(l => tagsOverlapNormalized(itemTags, l.tags || [])) : locationFiltered;
            const quantity = (item.quantity != null && item.quantity > 0) ? Number(item.quantity) : 1;
            for (const listing of tagFiltered) {
                let score = 0;
                const reasons = [];
                if (listing.is_remote) reasons.push('✓ 可遠端服務');
                else if (projectLocation && projectLocation.length > 0 && listing.service_location) {
                    const matched = projectLocation.filter(loc => listing.service_location.includes(loc) || listing.service_location.includes('全台灣'));
                    if (matched.length > 0) reasons.push(`✓ 服務區域: ${matched.join('、')}`);
                }
                if (categoryKeyForQuery && listing.category === categoryKeyForQuery) { score += 10; reasons.push('✓ 主分類匹配'); }
                if (item.subcategory && listing.subcategory === item.subcategory) { score += 10; reasons.push('✓ 子分類匹配'); }
                const resolved = resolveUnitPriceForQuantity(listing, quantity);
                const useUnitPricing = Boolean(item.unit && item.quantity != null && item.quantity > 0);
                if (item.budget_min != null && item.budget_max != null && resolved.unit_price_min != null && resolved.unit_price_max != null) {
                    let expertAvgTotal, expertAvgUnitPrice;
                    if (useUnitPricing) {
                        const expertTotalMin = resolved.unit_price_min * quantity;
                        const expertTotalMax = resolved.unit_price_max * quantity;
                        expertAvgTotal = (expertTotalMin + expertTotalMax) / 2;
                        expertAvgUnitPrice = (resolved.unit_price_min + resolved.unit_price_max) / 2;
                    } else {
                        expertAvgTotal = (resolved.unit_price_min + resolved.unit_price_max) / 2;
                        expertAvgUnitPrice = expertAvgTotal;
                    }
                    if (expertAvgTotal >= item.budget_min && expertAvgTotal <= item.budget_max) {
                        let marketUnitPrice = null;
                        if (item.subcategory) {
                            try {
                                const { data: priceData } = await supabase.from('market_prices').select('market_price').eq('subcategory', item.subcategory).is('tag_filter', null).maybeSingle();
                                if (priceData) marketUnitPrice = priceData.market_price;
                            } catch (_) {}
                        }
                        if (marketUnitPrice && marketUnitPrice > 0) {
                            const deviation = Math.abs(expertAvgUnitPrice - marketUnitPrice) / marketUnitPrice;
                            const priceScore = Math.round(40 * Math.max(0, 1 - deviation));
                            score += priceScore;
                            reasons.push(`價格合理度 ${priceScore}/40`);
                        } else {
                            const overlapMin = Math.max(item.budget_min, resolved.unit_price_min * (useUnitPricing ? quantity : 1));
                            const overlapMax = Math.min(item.budget_max, resolved.unit_price_max * (useUnitPricing ? quantity : 1));
                            if (overlapMax >= overlapMin) {
                                const overlapRange = overlapMax - overlapMin;
                                const itemRange = item.budget_max - item.budget_min;
                                const overlapRatio = itemRange > 0 ? overlapRange / itemRange : 1;
                                score += Math.round(overlapRatio * 40);
                                reasons.push('價格區間重疊');
                            }
                        }
                    }
                }
                const itemTagsForScore = (item.requirements && Array.isArray(item.requirements.tags)) ? item.requirements.tags : [];
                const itemText = `${item.item_name} ${item.item_description || ''}`.toLowerCase();
                let matchedKeywords = [];
                if (listing.tags && listing.tags.length > 0) {
                    for (const tag of listing.tags) {
                        const tagLower = (tag || '').toLowerCase();
                        if (tagLower && itemText.includes(tagLower)) matchedKeywords.push(tag);
                    }
                    for (const lt of listing.tags) {
                        const ltNorm = normalizeTagForMatch(lt);
                        if (!ltNorm) continue;
                        if (itemTagsForScore.some(t => normalizeTagForMatch(t) === ltNorm) && !matchedKeywords.some(m => normalizeTagForMatch(m) === ltNorm)) matchedKeywords.push(lt);
                    }
                    if (itemTags.length > 0 && matchedKeywords.length === 0) {
                        const overlap = listing.tags.filter(lt => itemTags.some(t => normalizeTagForMatch(t) === normalizeTagForMatch(lt)));
                        if (overlap.length > 0) matchedKeywords = overlap;
                    }
                }
                if (matchedKeywords.length > 0) {
                    const totalItems = rows.length;
                    const denominator = totalItems * 1.5;
                    const scorePerTag = 40 / denominator;
                    const keywordScore = Math.min(40, Math.round(matchedKeywords.length * scorePerTag));
                    score += keywordScore;
                    reasons.push(`關鍵字/標籤: ${matchedKeywords.slice(0, 3).join('、')}`);
                }
                if (score >= 30 && (!bestByListing[listing.id] || score > bestByListing[listing.id].score)) {
                    bestByListing[listing.id] = { listing, score, reasons, item_name: item.item_name };
                }
            }
        }
        const best = Object.values(bestByListing).sort((a, b) => b.score - a.score)[0];
        if (!best) {
            return res.json({ match: false, message: '目前您的報價項目與此專案工項尚無符合條件的匹配（分數門檻 30）' });
        }
        res.json({
            match: true,
            score: best.score,
            reasons: best.reasons,
            listing_id: best.listing.id,
            listing_title: best.listing.title,
            item_name: best.item_name
        });
    } catch (e) {
        console.error('POST /api/match/vendor/preview-project:', e);
        res.status(500).json({ error: e.message });
    }
});

/**
 * 專家端預媒合摘要：與發案端一樣「一次試算」— 用我的報價對所有已發包專案試算，回傳符合專案數（不需選專案）
 * GET /api/match/vendor/preview-summary
 */
app.get('/api/match/vendor/preview-summary', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace(/^\s*Bearer\s+/i, '') || req.headers['x-auth-token'];
        if (!token) return res.status(401).json({ error: '請先登入' });
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: '登入已過期或無效' });

        const { data: expertListings } = await supabase
            .from('listings')
            .select('id, expert_id, title, category, subcategory, price_min, price_max, price_tiers, unit, tags, service_location, is_remote')
            .eq('expert_id', user.id)
            .eq('status', 'active');
        if (!expertListings || expertListings.length === 0) {
            return res.json({ total_projects: 0, matched_projects: 0, message: '您尚無有效報價項目，請先新增報價' });
        }

        const { data: publishedItems } = await supabase
            .from('project_items')
            .select('project_id')
            .eq('status', 'published');
        if (!publishedItems || publishedItems.length === 0) {
            return res.json({ total_projects: 0, matched_projects: 0, message: '目前沒有已發包的專案' });
        }
        const projectIds = [...new Set(publishedItems.map(p => p.project_id))].slice(0, 50);
        const totalProjects = projectIds.length;

        const { data: projects } = await supabase.from('projects').select('id, project_location').in('id', projectIds);
        const projectMap = {};
        (projects || []).forEach(p => { projectMap[p.id] = p; });

        const { data: allItems } = await supabase
            .from('project_items')
            .select('id, project_id, item_name, category_name, subcategory, quantity, unit, budget_min, budget_max, requirements')
            .eq('status', 'published')
            .in('project_id', projectIds);
        const itemsByProject = {};
        (allItems || []).forEach(i => {
            if (!itemsByProject[i.project_id]) itemsByProject[i.project_id] = [];
            itemsByProject[i.project_id].push(i);
        });

        let categoryNameToKey = {};
        try {
            const { data: catRows } = await supabase.from('ai_categories').select('key, name');
            if (catRows && catRows.length) catRows.forEach(r => { if (r.key) categoryNameToKey[r.key] = r.key; if (r.name) categoryNameToKey[r.name] = r.key; });
        } catch (_) {}

        let matched = 0;
        for (const pid of projectIds) {
            const project = projectMap[pid];
            const rows = itemsByProject[pid] || [];
            if (!project || rows.length === 0) continue;
            const projectLocation = Array.isArray(project.project_location) ? project.project_location : [];
            const bestByListing = {};
            for (const item of rows) {
                const categoryKey = (item.category_name && categoryNameToKey[item.category_name]) ? categoryNameToKey[item.category_name] : (item.category_name || null);
                let list = expertListings;
                if (categoryKey) list = list.filter(l => l.category === categoryKey);
                const locationFiltered = list.filter(l => {
                    if (!projectLocation || projectLocation.length === 0) return true;
                    if (l.is_remote) return true;
                    if (l.service_location && l.service_location.length > 0) return projectLocation.some(loc => l.service_location.includes(loc) || l.service_location.includes('全台灣'));
                    return true;
                });
                const itemTags = (item.requirements && Array.isArray(item.requirements.tags)) ? item.requirements.tags : [];
                const tagFiltered = itemTags.length > 0 ? locationFiltered.filter(l => tagsOverlapNormalized(itemTags, l.tags || [])) : locationFiltered;
                const quantity = (item.quantity != null && item.quantity > 0) ? Number(item.quantity) : 1;
                for (const listing of tagFiltered) {
                    let score = 0;
                    if (categoryKey && listing.category === categoryKey) score += 10;
                    if (item.subcategory && listing.subcategory === item.subcategory) score += 10;
                    const resolved = resolveUnitPriceForQuantity(listing, quantity);
                    const useUnitPricing = Boolean(item.unit && item.quantity != null && item.quantity > 0);
                    if (item.budget_min != null && item.budget_max != null && resolved.unit_price_min != null && resolved.unit_price_max != null) {
                        const expertAvgTotal = useUnitPricing ? (resolved.unit_price_min * quantity + resolved.unit_price_max * quantity) / 2 : (resolved.unit_price_min + resolved.unit_price_max) / 2;
                        if (expertAvgTotal >= item.budget_min && expertAvgTotal <= item.budget_max) {
                            const overlapMin = Math.max(item.budget_min, (resolved.unit_price_min || 0) * (useUnitPricing ? quantity : 1));
                            const overlapMax = Math.min(item.budget_max, (resolved.unit_price_max || 0) * (useUnitPricing ? quantity : 1));
                            if (overlapMax >= overlapMin && (item.budget_max - item.budget_min) > 0)
                                score += Math.round(40 * (overlapMax - overlapMin) / (item.budget_max - item.budget_min));
                            else score += 40;
                        }
                    }
                    const itemTagsForScore = (item.requirements && Array.isArray(item.requirements.tags)) ? item.requirements.tags : [];
                    const itemText = `${item.item_name} ${item.item_description || ''}`.toLowerCase();
                    let matchedKw = 0;
                    if (listing.tags && listing.tags.length > 0) {
                        for (const lt of listing.tags) {
                            const ln = normalizeTagForMatch(lt);
                            if (ln && itemTagsForScore.some(t => normalizeTagForMatch(t) === ln)) matchedKw++;
                        }
                        if (matchedKw > 0) score += Math.min(40, matchedKw * 15);
                    }
                    if (score >= 30 && (!bestByListing[listing.id] || score > bestByListing[listing.id].score))
                        bestByListing[listing.id] = { score };
                }
            }
            const best = Object.values(bestByListing).sort((a, b) => b.score - a.score)[0];
            if (best && best.score >= 30) matched++;
        }
        res.json({
            total_projects: totalProjects,
            matched_projects: matched,
            message: totalProjects === 0 ? '目前沒有已發包的專案' : `目前有 ${totalProjects} 個已發包專案，其中 ${matched} 個與您的報價相符`
        });
    } catch (e) {
        console.error('GET /api/match/vendor/preview-summary:', e);
        res.status(500).json({ error: e.message });
    }
});

/**
 * 專家端申請媒合：對單一專案執行媒合邏輯，通過則寫入 matches（一筆專案擇一最佳 listing）
 * POST /api/match/vendor/apply
 * body: { project_id, listing_id? }
 */
app.post('/api/match/vendor/apply', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace(/^\s*Bearer\s+/i, '') || req.headers['x-auth-token'];
        if (!token) return res.status(401).json({ error: '請先登入' });
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: '登入已過期或無效' });
        const { project_id, listing_id } = req.body || {};
        if (!project_id) return res.status(400).json({ error: '請提供 project_id' });

        const { data: project } = await supabase.from('projects').select('id, owner_id, project_location').eq('id', project_id).single();
        if (!project) return res.status(404).json({ error: '找不到專案' });

        const { data: rows } = await supabase
            .from('project_items')
            .select('id, project_id, item_name, item_description, category_name, subcategory, quantity, unit, budget_min, budget_max, requirements')
            .eq('project_id', project_id)
            .eq('status', 'published');
        if (!rows || rows.length === 0) return res.status(400).json({ error: '此專案尚無已發包項目' });

        const { data: expertListingsData } = await supabase
            .from('listings')
            .select('id, expert_id, title, category, subcategory, description, price_min, price_max, price_tiers, unit, tags, service_location, is_remote')
            .eq('expert_id', user.id)
            .eq('status', 'active');
        const expertListings = (expertListingsData || []).filter(l => !listing_id || l.id === listing_id);
        if (expertListings.length === 0) return res.status(400).json({ error: '找不到指定的報價項目或您尚無有效報價' });

        let categoryNameToKey = {};
        try {
            const { data: catRows } = await supabase.from('ai_categories').select('key, name');
            if (catRows && catRows.length) {
                catRows.forEach(r => { if (r.key) categoryNameToKey[r.key] = r.key; if (r.name) categoryNameToKey[r.name] = r.key; });
            }
        } catch (_) {}
        const projectLocation = Array.isArray(project.project_location) ? project.project_location : [];
        const bestByListing = {};
        for (const item of rows) {
            const categoryKeyForQuery = (item.category_name && categoryNameToKey[item.category_name]) ? categoryNameToKey[item.category_name] : (item.category_name || null);
            let list = expertListings;
            if (categoryKeyForQuery) list = list.filter(l => l.category === categoryKeyForQuery);
            const locationFiltered = list.filter(l => {
                if (!projectLocation || projectLocation.length === 0) return true;
                if (l.is_remote) return true;
                if (l.service_location && l.service_location.length > 0) return projectLocation.some(loc => l.service_location.includes(loc) || l.service_location.includes('全台灣'));
                return true;
            });
            const itemTags = (item.requirements && Array.isArray(item.requirements.tags)) ? item.requirements.tags : [];
            const tagFiltered = itemTags.length > 0 ? locationFiltered.filter(l => tagsOverlapNormalized(itemTags, l.tags || [])) : locationFiltered;
            const quantity = (item.quantity != null && item.quantity > 0) ? Number(item.quantity) : 1;
            for (const listing of tagFiltered) {
                let score = 0;
                const reasons = [];
                if (listing.is_remote) reasons.push('✓ 可遠端服務');
                else if (projectLocation && projectLocation.length > 0 && listing.service_location) {
                    const matched = projectLocation.filter(loc => listing.service_location.includes(loc) || listing.service_location.includes('全台灣'));
                    if (matched.length > 0) reasons.push(`✓ 服務區域: ${matched.join('、')}`);
                }
                if (categoryKeyForQuery && listing.category === categoryKeyForQuery) { score += 10; reasons.push('✓ 主分類匹配'); }
                if (item.subcategory && listing.subcategory === item.subcategory) { score += 10; reasons.push('✓ 子分類匹配'); }
                const resolved = resolveUnitPriceForQuantity(listing, quantity);
                const useUnitPricing = Boolean(item.unit && item.quantity != null && item.quantity > 0);
                if (item.budget_min != null && item.budget_max != null && resolved.unit_price_min != null && resolved.unit_price_max != null) {
                    let expertAvgTotal, expertAvgUnitPrice;
                    if (useUnitPricing) {
                        expertAvgTotal = (resolved.unit_price_min * quantity + resolved.unit_price_max * quantity) / 2;
                        expertAvgUnitPrice = (resolved.unit_price_min + resolved.unit_price_max) / 2;
                    } else {
                        expertAvgTotal = (resolved.unit_price_min + resolved.unit_price_max) / 2;
                        expertAvgUnitPrice = expertAvgTotal;
                    }
                    if (expertAvgTotal >= item.budget_min && expertAvgTotal <= item.budget_max) {
                        let marketUnitPrice = null;
                        if (item.subcategory) {
                            try {
                                const { data: priceData } = await supabase.from('market_prices').select('market_price').eq('subcategory', item.subcategory).is('tag_filter', null).maybeSingle();
                                if (priceData) marketUnitPrice = priceData.market_price;
                            } catch (_) {}
                        }
                        if (marketUnitPrice && marketUnitPrice > 0) {
                            const deviation = Math.abs(expertAvgUnitPrice - marketUnitPrice) / marketUnitPrice;
                            score += Math.round(40 * Math.max(0, 1 - deviation));
                        } else {
                            const overlapMin = Math.max(item.budget_min, resolved.unit_price_min * (useUnitPricing ? quantity : 1));
                            const overlapMax = Math.min(item.budget_max, resolved.unit_price_max * (useUnitPricing ? quantity : 1));
                            if (overlapMax >= overlapMin) {
                                const overlapRange = overlapMax - overlapMin;
                                const itemRange = item.budget_max - item.budget_min;
                                score += Math.round((itemRange > 0 ? overlapRange / itemRange : 1) * 40);
                            }
                        }
                    }
                }
                const itemTagsForScore = (item.requirements && Array.isArray(item.requirements.tags)) ? item.requirements.tags : [];
                const itemText = `${item.item_name} ${item.item_description || ''}`.toLowerCase();
                let matchedKeywords = [];
                if (listing.tags && listing.tags.length > 0) {
                    for (const tag of listing.tags) { if ((tag || '').toLowerCase() && itemText.includes((tag || '').toLowerCase())) matchedKeywords.push(tag); }
                    for (const lt of listing.tags) {
                        const ltNorm = normalizeTagForMatch(lt);
                        if (ltNorm && itemTagsForScore.some(t => normalizeTagForMatch(t) === ltNorm) && !matchedKeywords.some(m => normalizeTagForMatch(m) === ltNorm)) matchedKeywords.push(lt);
                    }
                    if (itemTags.length > 0 && matchedKeywords.length === 0) {
                        const overlap = listing.tags.filter(lt => itemTags.some(t => normalizeTagForMatch(t) === normalizeTagForMatch(lt)));
                        if (overlap.length > 0) matchedKeywords = overlap;
                    }
                }
                if (matchedKeywords.length > 0) {
                    const totalItems = rows.length;
                    const keywordScore = Math.min(40, Math.round(matchedKeywords.length * (40 / (totalItems * 1.5))));
                    score += keywordScore;
                }
                if (score >= 30 && (!bestByListing[listing.id] || score > bestByListing[listing.id].score)) {
                    bestByListing[listing.id] = { listing, score, reasons, item_id: item.id, item_name: item.item_name };
                }
            }
        }
        const best = Object.values(bestByListing).sort((a, b) => b.score - a.score)[0];
        if (!best) return res.status(400).json({ error: '目前您的報價與此專案工項未達媒合門檻（30 分）' });

        const { data: existing } = await supabase.from('matches').select('id').eq('project_id', project_id).eq('expert_listing_id', best.listing.id).maybeSingle();
        if (existing) return res.json({ success: true, already_matched: true, message: '您已媒合過此專案' });

        const { error: insertErr } = await supabase.from('matches').insert({
            project_id,
            expert_listing_id: best.listing.id,
            expert_id: user.id,
            client_id: project.owner_id,
            match_score: best.score,
            match_reasons: { item_id: best.item_id, item_name: best.item_name, reasons: best.reasons },
            status: 'active'
        });
        if (insertErr) return res.status(500).json({ error: '寫入媒合記錄失敗：' + insertErr.message });
        res.json({ success: true, message: '媒合成功', match_score: best.score });
    } catch (e) {
        console.error('POST /api/match/vendor/apply:', e);
        res.status(500).json({ error: e.message });
    }
});

/**
 * 專家端：取得「我媒合到的專案」列表（供 matched-projects 使用）
 * GET /api/match/vendor/my-matches
 */
app.get('/api/match/vendor/my-matches', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace(/^\s*Bearer\s+/i, '') || req.headers['x-auth-token'];
        if (!token) return res.status(401).json({ error: '請先登入' });
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: '登入已過期或無效' });

        const { data: matches } = await supabase
            .from('matches')
            .select('id, project_id, expert_listing_id, match_score, status, created_at')
            .eq('expert_id', user.id)
            .eq('status', 'active')
            .order('created_at', { ascending: false });
        if (!matches || matches.length === 0) return res.json({ matches: [] });

        const projectIds = [...new Set(matches.map(m => m.project_id))];
        const { data: projects } = await supabase.from('projects').select('id, title, project_location, owner_id').in('id', projectIds);
        const projectMap = {};
        (projects || []).forEach(p => { projectMap[p.id] = p; });

        const clientIds = [...new Set((projects || []).map(p => p.owner_id).filter(Boolean))];
        let contactMap = {};
        if (clientIds.length > 0) {
            const { data: contacts } = await supabase.from('contact_info').select('user_id, phone, mobile, email, line_id').in('user_id', clientIds);
            if (contacts) contacts.forEach(c => { contactMap[c.user_id] = c; });
        }
        let nameMap = {};
        try {
            const { data: profs } = await supabase.from('profiles').select('id, full_name, raw_user_meta_data').in('id', clientIds);
            if (profs) profs.forEach(p => { nameMap[p.id] = p.full_name || p.raw_user_meta_data?.full_name || null; });
        } catch (_) {}

        const listingIds = matches.map(m => m.expert_listing_id).filter(Boolean);
        let listingsMap = {};
        if (listingIds.length > 0) {
            const { data: listings } = await supabase.from('listings').select('id, title').in('id', listingIds);
            if (listings) listings.forEach(l => { listingsMap[l.id] = l; });
        }

        const list = matches.map(m => {
            const proj = projectMap[m.project_id];
            const client = proj ? contactMap[proj.owner_id] : null;
            const listing = listingsMap[m.expert_listing_id];
            return {
                match_id: m.id,
                project_id: m.project_id,
                project_title: proj ? (proj.title || '未命名專案') : '',
                project_location: proj ? (proj.project_location || []) : [],
                match_score: m.match_score,
                status: m.status,
                created_at: m.created_at,
                listing_title: listing ? listing.title : '',
                client_id: proj ? proj.owner_id : null,
                client_name: proj ? (nameMap[proj.owner_id] || null) : null,
                contact: proj && client ? { phone: client.phone || null, mobile: client.mobile || null, email: client.email || null, line_id: client.line_id || null } : null
            };
        });
        res.json({ matches: list });
    } catch (e) {
        console.error('GET /api/match/vendor/my-matches:', e);
        res.status(500).json({ error: e.message });
    }
});

// ==================== 專家公開自介（發包廠商／訪客查看） ====================
/**
 * GET /api/expert/public-profile?expert_id= — 取得專家公開自介（聯絡方式依可見設定）
 */
app.get('/api/expert/public-profile', async (req, res) => {
    try {
        const expertId = req.query.expert_id;
        if (!expertId) return res.status(400).json({ error: '缺少 expert_id' });

        let fullName = '專家', avatarUrl = null, bio = '';
        try {
            const { data: profile } = await supabase.from('profiles').select('id, full_name, avatar_url, raw_user_meta_data').eq('id', expertId).maybeSingle();
            if (profile) {
                fullName = profile.full_name || profile.raw_user_meta_data?.full_name || '專家';
                avatarUrl = profile.avatar_url || profile.raw_user_meta_data?.avatar_url || null;
                bio = profile.raw_user_meta_data?.bio || '';
            }
        } catch (_) {}

        let contact = {};
        let contactRow = null;
        try {
            const { data } = await supabase.from('contact_info').select('*').eq('user_id', expertId).maybeSingle();
            contactRow = data;
        } catch (_) {}
        if (contactRow) {
            if (!fullName || fullName === '專家') fullName = contactRow.company_name || fullName;
            if (bio && !contactRow.bio) {} else if (contactRow.bio) bio = contactRow.bio;
            const vis = (key) => contactRow[key] !== false && contactRow[key] !== undefined;
            if (vis('phone_visible') && contactRow.phone) contact.phone = contactRow.phone;
            if (vis('mobile_visible') && contactRow.mobile) contact.mobile = contactRow.mobile;
            if (vis('email_visible') && contactRow.email) contact.email = contactRow.email;
            if (vis('line_visible') && contactRow.line_id) contact.line_id = contactRow.line_id;
            if (vis('wechat_visible') && contactRow.wechat_id) contact.wechat_id = contactRow.wechat_id;
            if (vis('website_visible') && contactRow.website_url) contact.website_url = contactRow.website_url;
            if (vis('portfolio_visible') && contactRow.portfolio_url) contact.portfolio_url = contactRow.portfolio_url;
            if (contactRow.company_name) contact.company_name = contactRow.company_name;
            if (contactRow.company_address) contact.company_address = contactRow.company_address;
            if (contactRow.bio) contact.bio = contactRow.bio;
            if (Object.keys(contact).length === 0 && (contactRow.phone || contactRow.mobile || contactRow.email || contactRow.line_id)) {
                if (contactRow.phone) contact.phone = contactRow.phone;
                if (contactRow.mobile) contact.mobile = contactRow.mobile;
                if (contactRow.email) contact.email = contactRow.email;
                if (contactRow.line_id) contact.line_id = contactRow.line_id;
            }
        }

        let portfolio = [];
        try {
            const { data: port } = await supabase.from('expert_portfolio').select('id, title, description, image_url, sort_order').eq('expert_id', expertId).order('sort_order', { ascending: true });
            portfolio = port || [];
        } catch (_) {}
        res.json({
            expert_id: expertId,
            full_name: fullName,
            avatar_url: avatarUrl,
            bio: contact.bio || bio || '',
            contact,
            portfolio
        });
    } catch (e) {
        console.error('GET /api/expert/public-profile:', e);
        res.status(500).json({ error: (e && e.message) || '系統錯誤' });
    }
});

// ==================== 承包商／專家作品集 API ====================
/**
 * GET /api/expert/portfolio — 取得作品集（?expert_id= 可查他人，無則查當前登入者）
 */
app.get('/api/expert/portfolio', async (req, res) => {
    try {
        const expertId = req.query.expert_id;
        const token = req.headers.authorization?.replace(/^\s*Bearer\s+/i, '') || req.headers['x-auth-token'];
        let targetId = expertId;
        if (!targetId && token) {
            const { data: { user } } = await supabase.auth.getUser(token);
            if (user) targetId = user.id;
        }
        if (!targetId) return res.json({ items: [] });
        const { data, error } = await supabase
            .from('expert_portfolio')
            .select('id, expert_id, title, description, image_url, sort_order, created_at')
            .eq('expert_id', targetId)
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: false });
        if (error) return res.status(500).json({ error: error.message });
        res.json({ items: data || [] });
    } catch (e) {
        console.error('GET /api/expert/portfolio:', e);
        res.status(500).json({ error: e.message });
    }
});

/**
 * 報價健檢：與同分類同單位之同業報價比較分布位置，不建議降價，建議以作品證明價值
 * GET /api/expert/quote-health-check
 */
function percentile(sortedArr, p) {
    if (!sortedArr || sortedArr.length === 0) return null;
    const n = sortedArr.length;
    const idx = Math.min(Math.floor((n - 1) * p), n - 1);
    return sortedArr[idx];
}
app.get('/api/expert/quote-health-check', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace(/^\s*Bearer\s+/i, '') || req.headers['x-auth-token'];
        if (!token) return res.status(401).json({ error: '請先登入' });
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: '登入已過期或無效' });

        const { data: myListings, error: myErr } = await supabase
            .from('listings')
            .select('id, title, category, unit, price_min, price_max')
            .eq('expert_id', user.id)
            .eq('status', 'active');
        if (myErr) return res.status(500).json({ error: myErr.message });
        if (!myListings || myListings.length === 0) {
            return res.json({ items: [], message: '您尚無有效報價項目，無法進行健檢' });
        }

        const items = [];
        for (const listing of myListings) {
            const category = listing.category || '';
            const unit = (listing.unit || '').trim() || null;
            const myMid = (listing.price_min != null && listing.price_max != null)
                ? (Number(listing.price_min) + Number(listing.price_max)) / 2
                : (listing.price_min != null ? Number(listing.price_min) : listing.price_max != null ? Number(listing.price_max) : null);
            if (myMid == null || !category) {
                items.push({
                    listing_id: listing.id,
                    title: listing.title,
                    category,
                    unit,
                    band: null,
                    message: '此報價缺少分類或價格，無法比較',
                    suggestion: '可透過作品集與案例讓客戶了解您的服務價值。',
                    peer_count: 0
                });
                continue;
            }

            let peerQuery = supabase
                .from('listings')
                .select('price_min, price_max')
                .eq('category', category)
                .eq('status', 'active')
                .neq('expert_id', user.id);
            if (unit) peerQuery = peerQuery.eq('unit', unit);
            const { data: peers, error: peerErr } = await peerQuery;
            if (peerErr || !peers || peers.length < 3) {
                items.push({
                    listing_id: listing.id,
                    title: listing.title,
                    category,
                    unit,
                    band: null,
                    message: '同分類、同單位的同業報價數量不足，尚無足夠資料可比較。',
                    suggestion: '可透過作品集與案例讓客戶了解您的服務價值。',
                    peer_count: peers ? peers.length : 0
                });
                continue;
            }

            const peerPrices = peers
                .map(p => {
                    const a = p.price_min != null ? Number(p.price_min) : null;
                    const b = p.price_max != null ? Number(p.price_max) : null;
                    if (a != null && b != null) return (a + b) / 2;
                    if (a != null) return a;
                    if (b != null) return b;
                    return null;
                })
                .filter(v => v != null && !Number.isNaN(v));
            if (peerPrices.length < 3) {
                items.push({
                    listing_id: listing.id,
                    title: listing.title,
                    category,
                    unit,
                    band: null,
                    message: '同業報價資料不足，尚無足夠資料可比較。',
                    suggestion: '可透過作品集與案例讓客戶了解您的服務價值。',
                    peer_count: peerPrices.length
                });
                continue;
            }

            peerPrices.sort((a, b) => a - b);
            const p25 = percentile(peerPrices, 0.25);
            const p50 = percentile(peerPrices, 0.5);
            const p75 = percentile(peerPrices, 0.75);
            let band, message, suggestion;
            if (myMid > p75) {
                band = '前段';
                message = '您的報價落在同分類報價的 **前段**（高於約 75% 同業）。';
                suggestion = '可透過 **作品集與案例** 說明服務差異與品質，吸引重視成果的客戶。';
            } else if (myMid < p25) {
                band = '後段';
                message = '您的報價落在同分類報價的 **後段**。';
                suggestion = '建立口碑與案例後，可適度在報價中反映您的價值；**上傳作品** 有助客戶理解您的服務水準。';
            } else {
                band = '中段';
                message = '您的報價落在同分類報價的 **中段**，與多數同業區間相近。';
                suggestion = '可透過 **完整作品與經歷** 讓客戶更容易辨識您的優勢。';
            }
            items.push({
                listing_id: listing.id,
                title: listing.title,
                category,
                unit,
                my_price: Math.round(myMid),
                band,
                message,
                suggestion,
                peer_count: peerPrices.length,
                p25: Math.round(p25),
                p50: Math.round(p50),
                p75: Math.round(p75)
            });
        }

        res.json({ items, message: '報價健檢不與同業競價，建議以作品與服務證明爭取客戶。' });
    } catch (e) {
        console.error('GET /api/expert/quote-health-check:', e);
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /api/expert/portfolio — 新增作品（僅當前登入專家）
 */
app.post('/api/expert/portfolio', express.json(), async (req, res) => {
    try {
        const token = req.headers.authorization?.replace(/^\s*Bearer\s+/i, '') || req.headers['x-auth-token'];
        if (!token) return res.status(401).json({ error: '請先登入' });
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: '登入已過期或無效' });
        const { title, description, image_url, sort_order } = req.body || {};
        if (!title || !title.trim()) return res.status(400).json({ error: '請填寫作品標題' });
        const { data, error } = await supabase
            .from('expert_portfolio')
            .insert({
                expert_id: user.id,
                title: (title || '').trim(),
                description: description ? String(description).trim() : null,
                image_url: image_url ? String(image_url).trim() : null,
                sort_order: sort_order != null ? Number(sort_order) : 0
            })
            .select()
            .single();
        if (error) return res.status(500).json({ error: error.message });
        res.status(201).json(data);
    } catch (e) {
        console.error('POST /api/expert/portfolio:', e);
        res.status(500).json({ error: e.message });
    }
});

/**
 * PUT /api/expert/portfolio/:id — 更新作品（僅本人）
 */
app.put('/api/expert/portfolio/:id', express.json(), async (req, res) => {
    try {
        const token = req.headers.authorization?.replace(/^\s*Bearer\s+/i, '') || req.headers['x-auth-token'];
        if (!token) return res.status(401).json({ error: '請先登入' });
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: '登入已過期或無效' });
        const { id } = req.params;
        const { title, description, image_url, sort_order } = req.body || {};
        const { data: row, error: fetchErr } = await supabase
            .from('expert_portfolio')
            .select('id, expert_id')
            .eq('id', id)
            .single();
        if (fetchErr || !row || row.expert_id !== user.id) return res.status(404).json({ error: '找不到作品或無權限' });
        const updates = {};
        if (title !== undefined) updates.title = String(title).trim();
        if (description !== undefined) updates.description = description ? String(description).trim() : null;
        if (image_url !== undefined) updates.image_url = image_url ? String(image_url).trim() : null;
        if (sort_order !== undefined) updates.sort_order = Number(sort_order);
        updates.updated_at = new Date().toISOString();
        const { data, error } = await supabase.from('expert_portfolio').update(updates).eq('id', id).select().single();
        if (error) return res.status(500).json({ error: error.message });
        res.json(data);
    } catch (e) {
        console.error('PUT /api/expert/portfolio:', e);
        res.status(500).json({ error: e.message });
    }
});

/**
 * DELETE /api/expert/portfolio/:id — 刪除作品（僅本人）
 */
app.delete('/api/expert/portfolio/:id', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace(/^\s*Bearer\s+/i, '') || req.headers['x-auth-token'];
        if (!token) return res.status(401).json({ error: '請先登入' });
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: '登入已過期或無效' });
        const { id } = req.params;
        const { data: row, error: fetchErr } = await supabase
            .from('expert_portfolio')
            .select('id, expert_id')
            .eq('id', id)
            .single();
        if (fetchErr || !row || row.expert_id !== user.id) return res.status(404).json({ error: '找不到作品或無權限' });
        const { error: delErr } = await supabase.from('expert_portfolio').delete().eq('id', id);
        if (delErr) return res.status(500).json({ error: delErr.message });
        res.json({ success: true });
    } catch (e) {
        console.error('DELETE /api/expert/portfolio:', e);
        res.status(500).json({ error: e.message });
    }
});

// ==================== 預媒合 API ====================
/**
 * 預媒合測試：根據預算範圍，顯示符合的專家百分比
 * POST /api/match/preview
 */
app.post('/api/match/preview', async (req, res) => {
    try {
        const { project_id, category, subcategory, budget_min, budget_max, quantity, unit, tags: bodyTags } = req.body;
        
        // 驗證必要參數
        if (!budget_min || !budget_max) {
            return res.status(400).json({ error: '請提供完整的預算範圍' });
        }
        
        if (budget_min > budget_max) {
            return res.status(400).json({ error: '最低預算不能大於最高預算' });
        }
        
        const qty = (quantity != null && quantity > 0) ? Number(quantity) : 1;
        const useUnitMode = Boolean(unit && quantity != null && quantity > 0);
        
        console.log('🔍 預媒合測試 (V2.0):', { category, subcategory, budget_min, budget_max, quantity: qty, unit: unit || '(無)' });
        
        // 分類名稱→key（與 run-split 一致，listings 存的是 key）
        let categoryKeyForQuery = category;
        try {
            const { data: catRows } = await supabase.from('ai_categories').select('key, name');
            if (catRows && catRows.length) {
                const nameToKey = {};
                catRows.forEach(r => { if (r.key) nameToKey[r.key] = r.key; if (r.name) nameToKey[r.name] = r.key; });
                if (nameToKey[category]) categoryKeyForQuery = nameToKey[category];
            }
        } catch (_) {}
        
        // ==================== 階段 1：查詢該分類的專家數量與市場價格 (V2.0) ====================
        
        // 查詢該分類的專家（含 unit、price_tiers、tags 以支援單價×數量、階梯定價與標籤篩選）
        const { data: listings, error: listingsError } = await supabase
            .from('listings')
            .select('price_min, price_max, price_tiers, unit, tags')
            .eq('category', categoryKeyForQuery)
            .eq('status', 'active');
        
        const totalInCategory = listings ? listings.length : 0; // 該分類總專家數（未篩單位／標籤）
        
        // 彙整「同分類專家」的標籤（出現次數），供發案方參考以利修正工項標籤
        const expertTagsInCategory = [];
        if (listings && listings.length > 0) {
            const tagCount = {};
            listings.forEach(l => {
                (l.tags || []).filter(t => t && String(t).trim()).forEach(t => {
                    const tag = String(t).trim();
                    tagCount[tag] = (tagCount[tag] || 0) + 1;
                });
            });
            expertTagsInCategory.push(...Object.entries(tagCount)
                .map(([tag, count]) => ({ tag, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 35));
        }
        
        // ==================== 階段 2：篩出符合標籤的專家（單位僅供對照／參考，不用來過濾） ====================
        let candidateListings = listings && listings.length > 0 ? [...listings] : [];
        const requestTags = Array.isArray(bodyTags) && bodyTags.length > 0 ? bodyTags : null;
        if (requestTags && requestTags.length > 0 && candidateListings.length > 0) {
            candidateListings = candidateListings.filter(l => tagsOverlapNormalized(requestTags, l.tags || []));
        }
        
        let totalExperts = candidateListings.length; // 符合標籤的專家數（單位不參與篩選）
        let avgMarketPrice = 0;
        
        // 市場估算價「只來自實際符合條件的專家」：有歷史資料才顯示，不猜測
        if (candidateListings.length > 0) {
            // 優先從市場價格表讀取（須為該子分類之歷史資料）
            if (subcategory) {
                try {
                    const { data: marketPriceData } = await supabase
                        .from('market_prices')
                        .select('market_price')
                        .eq('subcategory', subcategory)
                        .is('tag_filter', null)
                        .maybeSingle();
                    
                    if (marketPriceData && marketPriceData.market_price) {
                        avgMarketPrice = marketPriceData.market_price;
                        console.log(`📊 市場價格 (來自市場價格表): 子分類=${subcategory}, 市場價=${avgMarketPrice}`);
                    }
                } catch (e) {
                    console.error('查詢市場價格表失敗:', e);
                }
            }
            // 若無市場價格表，用「符合條件的專家」底價計算（排除離群值 + 25%）
            if (!avgMarketPrice) {
                const prices = candidateListings
                    .map(l => (useUnitMode && qty ? (() => { const r = resolveUnitPriceForQuantity(l, qty); return (r.unit_price_min + r.unit_price_max) / 2; })() : (l.price_min || 0)))
                    .filter(p => p > 0);
                if (prices.length >= 10) {
                    const sorted = prices.sort((a, b) => a - b);
                    const startIdx = Math.floor(sorted.length * 0.05);
                    const endIdx = Math.ceil(sorted.length * 0.95);
                    const slice = sorted.slice(startIdx, endIdx);
                    avgMarketPrice = Math.round((slice.reduce((s, p) => s + p, 0) / slice.length) * 1.25);
                } else if (prices.length > 0) {
                    const avg = prices.reduce((s, p) => s + p, 0) / prices.length;
                    avgMarketPrice = Math.round(avg * 1.25);
                }
                if (avgMarketPrice) console.log(`📊 市場價格 (符合條件專家計算): ${candidateListings.length} 位, 市場價=${avgMarketPrice}`);
            }
        }
        // 無符合條件的專家時不猜測、不顯示任何市場價
        
        // ==================== 階段 3：判斷預算是否合理（僅在有市場價時） ====================
        const marketTotal = useUnitMode ? avgMarketPrice * qty : avgMarketPrice;
        const budgetRatio = marketTotal > 0 ? budget_min / marketTotal : 1;
        let budgetStatus = 'normal';
        if (marketTotal > 0) {
            if (budgetRatio < 0.8) budgetStatus = 'low';
            else if (budgetRatio > 1.2) budgetStatus = 'high';
        }
        console.log(`💰 預算分析: 客戶總預算=${budget_min}~${budget_max}, 符合條件專家=${totalExperts}, 市場${useUnitMode ? `單價×${qty}=總價` : '估算'}=${Math.round(marketTotal)}, 狀態=${budgetStatus}`);
        
        // ==================== 階段 4：計算「報價落在預算區間內」的專家人數 ====================
        let matchedExperts = 0;
        if (candidateListings.length > 0) {
            if (useUnitMode) {
                matchedExperts = candidateListings.filter(l => {
                    const resolved = resolveUnitPriceForQuantity(l, qty);
                    const expertAvgUnit = (resolved.unit_price_min + resolved.unit_price_max) / 2;
                    const expertAvgTotal = expertAvgUnit * qty;
                    return expertAvgTotal >= budget_min && expertAvgTotal <= budget_max;
                }).length;
            } else {
                matchedExperts = candidateListings.filter(l => {
                    return (l.price_min || 0) <= budget_max && (l.price_max || Infinity) >= budget_min;
                }).length;
            }
            console.log(`✅ 真實媒合結果: 符合單位/條件 ${totalExperts} 位 → 報價在預算區間內 ${matchedExperts} 位`);
        }
        // 無符合條件的專家時 matchedExperts 維持 0，不猜測
        
        // ==================== 階段 5：計算百分比和預期回應數 ====================
        
        // 計算百分比
        const matchPercentage = totalExperts > 0 
            ? Math.round((matchedExperts / totalExperts) * 100)
            : 0;
        
        // 預期回應數量（通常是符合專家的 25-45%）
        const minResponses = Math.max(1, Math.floor(matchedExperts * 0.25));
        const maxResponses = Math.max(minResponses, Math.ceil(matchedExperts * 0.45));
        const estimatedResponses = matchedExperts > 0 
            ? `${minResponses}-${maxResponses} 位專家`
            : '0 位專家';
        
        // 當符合條件的專家為 0 時，不回傳市場價（避免顯示來自別處的數字造成混淆）
        const displayMarketPrice = totalExperts > 0 ? avgMarketPrice : 0; // 沒有人符合時不顯示「市場估算成交價」
        
        // 返回結果（含同類專家常用標籤，供發案方參考修正；單位僅供對照，不參與篩選）
        res.json({
            success: true,
            total_experts: totalExperts, // 符合標籤的專家數（單位不篩選）
            total_in_category: totalInCategory, // 該分類總專家數，供顯示用
            matched_experts: matchedExperts, // 報價落在您預算區間內的專家人數
            match_percentage: matchPercentage,
            estimated_responses: estimatedResponses,
            budget_status: budgetStatus,
            avg_market_price: displayMarketPrice, // 僅在「有符合條件的專家」時才回傳，否則為 0
            no_experts_for_unit: false, // 單位不再用於過濾，保留欄位相容
            experts_tag_match_only: totalExperts, // 與 total_experts 一致（單位不篩選）
            units_used_by_tag_matched: (candidateListings || []).length > 0 ? [...new Set((candidateListings || []).map(l => (l.unit || '').toString().trim()).filter(Boolean))] : [], // 供參考：符合專家的單位
            is_real_data: listings && listings.length > 0,
            use_unit_pricing: useUnitMode,
            message: `您的預算範圍符合 ${matchPercentage}% 的專家`,
            note: useUnitMode
                ? '💡 已依「數量×單位」計算：專家單價×您的數量＝專家總價，再與您的總預算比對'
                : '💡 提示：市場價格基於專家底價並排除離群值，加成25%估算實際成交價',
            expert_tags_in_category: expertTagsInCategory // [{ tag, count }, ...] 同分類專家常用標籤，供發案方修正工項標籤
        });
        
    } catch (error) {
        console.error('❌ 預媒合測試失敗:', error);
        res.status(500).json({ error: '預媒合測試失敗', details: error.message });
    }
});

/**
 * POST /api/match/run-split
 * 發包 API：執行真正的媒合，將選中的 project_items 與專家 listings 進行媒合
 * 並寫入 matches 表
 */
app.post('/api/match/run-split', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace(/^\s*Bearer\s+/i, '') || req.headers['x-auth-token'];
        if (!token) return res.status(401).json({ error: '請先登入後再送出媒合' });
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: '登入已過期或無效' });

        const { project_id: clientProjectId, item_ids, owner_id: bodyOwnerId, project_location: bodyProjectLocation } = req.body;
        
        if (!Array.isArray(item_ids) || item_ids.length === 0) {
            return res.status(400).json({ error: '請提供至少一個 item_id' });
        }
        
        console.log('🚀 開始執行媒合:', { project_id: clientProjectId, item_ids });
        
        // ==================== 步驟 1：依 item_ids 取得專案項目（草稿與已發包皆可勾選重新發包） ====================
        const { data: rows, error: itemsError } = await supabase
            .from('project_items')
            .select('id, project_id, item_name, item_description, category_name, subcategory, quantity, unit, budget_min, budget_max, requirements')
            .in('id', item_ids);
        
        if (itemsError) {
            console.error('❌ 查詢專案項目失敗:', itemsError);
            return res.status(500).json({ error: '查詢專案項目失敗', details: itemsError.message });
        }
        
        if (!rows || rows.length === 0) {
            return res.status(404).json({ error: '找不到可發包的項目（請確認已勾選要發包的項目）' });
        }
        
        const project_id = rows[0].project_id;
        const sameProject = rows.every(r => r.project_id === project_id);
        if (!sameProject) {
            return res.status(400).json({ error: '所選項目必須屬於同一專案' });
        }
        
        // 與預媒合一致：專案資料由前端帶上（前端已用登入者身份讀過），後端不查 projects 就不會「找不到專案」
        let clientId = bodyOwnerId;
        let projectLocation = Array.isArray(bodyProjectLocation) ? bodyProjectLocation : [];
        if (!clientId) {
            const { data: proj, error: projErr } = await supabase
                .from('projects')
                .select('owner_id, project_location')
                .eq('id', project_id)
                .single();
            if (projErr || !proj) {
                console.error('❌ 查詢專案失敗（請由專案詳情頁點「送出媒合」，會自動帶入專案資料）:', projErr?.message || projErr);
                return res.status(404).json({ error: '找不到專案' });
            }
            clientId = proj.owner_id;
            projectLocation = proj.project_location || [];
        }
        if (clientId !== user.id) {
            return res.status(403).json({ error: '只能對自己的專案送出媒合' });
        }
        const projectItems = rows;
        console.log(`📦 找到 ${projectItems.length} 個待發包項目，專案 ID: ${project_id}`);
        
        // 分類名稱→key 對照（listings 存的是 key，project 可能存 key 或中文名）
        let categoryNameToKey = {};
        try {
            const { data: catRows } = await supabase.from('ai_categories').select('key, name');
            if (catRows && catRows.length) {
                catRows.forEach(r => {
                    if (r.key) categoryNameToKey[r.key] = r.key;
                    if (r.name) categoryNameToKey[r.name] = r.key;
                });
            }
        } catch (_) {}
        
        // ==================== 步驟 3：逐項媒合（累積後依 project_id + expert_listing_id 去重再寫入，避免違反 UNIQUE） ====================
        
        const matchAccumulator = new Map(); // key: `${project_id}|${expert_listing_id}`, value: { project_id, expert_listing_id, expert_id, client_id, match_score, match_reasons, status }
        const matchResults = [];
        
        for (const item of projectItems) {
            const categoryKeyForQuery = (item.category_name && categoryNameToKey[item.category_name])
                ? categoryNameToKey[item.category_name]
                : (item.category_name || null);
            console.log(`\n🔍 媒合項目: ${item.item_name} (分類: ${item.category_name} → 查詢 key: ${categoryKeyForQuery})`);
            
            // 3.1 搜尋符合的專家 listings（用 key 查詢，listings.category 存的是 key）
            let query = supabase
                .from('listings')
                .select(`
                    id,
                    expert_id,
                    title,
                    category,
                    subcategory,
                    description,
                    price_min,
                    price_max,
                    price_tiers,
                    unit,
                    tags,
                    service_location,
                    is_remote
                `)
                .eq('status', 'active');
            
            if (categoryKeyForQuery) {
                query = query.eq('category', categoryKeyForQuery);
            }
            
            const { data: listings, error: listingsError } = await query;
            
            if (listingsError) {
                console.error(`❌ 查詢專家失敗 (${item.item_name}):`, listingsError);
                continue;
            }
            
            if (!listings || listings.length === 0) {
                console.log(`⚠️  該分類無專家: ${categoryKeyForQuery || item.category_name}`);
                matchResults.push({
                    item_id: item.id,
                    item_name: item.item_name,
                    matched_count: 0,
                    message: '該分類目前無專家'
                });
                continue;
            }
            
            console.log(`找到 ${listings.length} 位專家，開始過濾地點並計算媒合分數...`);
            
            // 3.2 【過濾條件】地點匹配 - 必須符合才能進入媒合
            const locationFilteredListings = listings.filter(listing => {
                // 如果專案沒有指定地點，則不過濾
                if (!projectLocation || projectLocation.length === 0) {
                    return true;
                }
                
                // 如果專家可遠端服務，直接通過
                if (listing.is_remote) {
                    return true;
                }
                
                // 如果專家有服務區域資料
                if (listing.service_location && listing.service_location.length > 0) {
                    // 檢查是否有交集
                    const hasMatch = projectLocation.some(loc => 
                        listing.service_location.includes(loc) || 
                        listing.service_location.includes('全台灣')
                    );
                    return hasMatch;
                }
                
                // 沒有服務區域資料的專家，保守起見不過濾（可能是舊資料）
                return true;
            });
            
            console.log(`📍 地點過濾後: ${locationFilteredListings.length}/${listings.length} 位專家`);
            
            if (locationFilteredListings.length === 0) {
                matchResults.push({
                    item_id: item.id,
                    item_name: item.item_name,
                    matched_count: 0,
                    message: '該地區無專家服務'
                });
                continue;
            }
            
            // 單位僅供對照／參考，不用來過濾；直接以地點過濾後的列表進行標籤篩選
            // 標籤：刪除「工程」「課程」等通用尾字後兩邊相同即算相符，再過濾
            const itemTags = (item.requirements && Array.isArray(item.requirements.tags)) ? item.requirements.tags : [];
            let tagFilteredListings = locationFilteredListings;
            if (itemTags.length > 0) {
                tagFilteredListings = locationFilteredListings.filter(listing => tagsOverlapNormalized(itemTags, listing.tags || []));
                console.log(`🏷️ 標籤對齊（去尾字後相同即相符）: 工項 ${itemTags.length} 個 → ${tagFilteredListings.length}/${locationFilteredListings.length} 位專家`);
                if (tagFilteredListings.length === 0) {
                    matchResults.push({
                        item_id: item.id,
                        item_name: item.item_name,
                        matched_count: 0,
                        message: `無標籤相符的專家（工項標籤：${itemTags.slice(0, 5).join('、')}${itemTags.length > 5 ? '…' : ''}）；單位僅供參考，未參與篩選`
                    });
                    continue;
                }
            }
            
            // 3.3 計算每個 listing 的媒合分數（總分 100）- V2.0 演算法（單價×客戶數量＝專家總價）；單位供報價對照用
            const quantity = (item.quantity != null && item.quantity > 0) ? Number(item.quantity) : 1;
            const useUnitPricing = Boolean(item.unit && item.quantity != null && item.quantity > 0);
            
            const scoredListings = await Promise.all(tagFilteredListings.map(async listing => {
                let score = 0;
                const reasons = [];
                
                // 記錄地點匹配方式（不計分）
                if (listing.is_remote) {
                    reasons.push('✓ 可遠端服務');
                } else if (projectLocation && projectLocation.length > 0 && listing.service_location) {
                    const matchedLocations = projectLocation.filter(loc => 
                        listing.service_location.includes(loc) || 
                        listing.service_location.includes('全台灣')
                    );
                    if (matchedLocations.length > 0) {
                        reasons.push(`✓ 服務區域: ${matchedLocations.join('、')}`);
                    }
                }
                
                // 【評分項目 1】主分類匹配 (10分)（用解析後的 key 比對）
                if (categoryKeyForQuery && listing.category) {
                    if (categoryKeyForQuery === listing.category) {
                        score += 10;
                        reasons.push('✓ 主分類匹配');
                    }
                }
                
                // 【評分項目 2】子分類匹配 (10分)
                if (item.subcategory && listing.subcategory) {
                    if (item.subcategory === listing.subcategory) {
                        score += 10;
                        reasons.push('✓ 子分類匹配');
                    }
                }
                
                // 【評分項目 3】價格合理度 (40分)
                // 正確邏輯：發包數量給媒合用，用來乘「專家的單價」得到專家總價，再與客戶總預算比對
                // 承包商可設 price_tiers：不同數量區間對應不同單價區間，依客戶數量取對應階梯
                const resolved = resolveUnitPriceForQuantity(listing, quantity);
                if (item.budget_min != null && item.budget_max != null && resolved.unit_price_min != null && resolved.unit_price_max != null) {
                    let expertAvgTotal;   // 專家總價（均）
                    let expertAvgUnitPrice; // 專家單價（均），用於與市場單價比較
                    
                    if (useUnitPricing) {
                        // 專家單價（可能來自 price_tiers 或 price_min/max）× 客戶數量 = 專家總價
                        const expertTotalMin = resolved.unit_price_min * quantity;
                        const expertTotalMax = resolved.unit_price_max * quantity;
                        expertAvgTotal = (expertTotalMin + expertTotalMax) / 2;
                        expertAvgUnitPrice = (resolved.unit_price_min + resolved.unit_price_max) / 2;
                    } else {
                        expertAvgTotal = (resolved.unit_price_min + resolved.unit_price_max) / 2;
                        expertAvgUnitPrice = expertAvgTotal;
                    }
                    
                    // 價格過濾：專家總價（均）必須在客戶總預算範圍內
                    if (expertAvgTotal >= item.budget_min && expertAvgTotal <= item.budget_max) {
                        // 市場價格表存的是「市場單價」
                        let marketUnitPrice = null;
                        
                        if (item.subcategory) {
                            try {
                                const { data: rule } = await supabase
                                    .from('price_calculation_rules')
                                    .select('enable_tag_split, split_tags')
                                    .eq('subcategory', item.subcategory)
                                    .maybeSingle();
                                
                                if (rule?.enable_tag_split && rule.split_tags && listing.tags) {
                                    const matchedTag = listing.tags.find(t => rule.split_tags.includes(t));
                                    if (matchedTag) {
                                        const { data: priceData } = await supabase
                                            .from('market_prices')
                                            .select('market_price')
                                            .eq('subcategory', item.subcategory)
                                            .contains('tag_filter', [matchedTag])
                                            .maybeSingle();
                                        if (priceData) marketUnitPrice = priceData.market_price;
                                    }
                                }
                                if (!marketUnitPrice) {
                                    const { data: priceData } = await supabase
                                        .from('market_prices')
                                        .select('market_price')
                                        .eq('subcategory', item.subcategory)
                                        .is('tag_filter', null)
                                        .maybeSingle();
                                    if (priceData) marketUnitPrice = priceData.market_price;
                                }
                            } catch (e) {
                                console.error('查詢市場價失敗:', e);
                            }
                        }
                        
                        // 價格評分：以「專家單價」與「市場單價」偏差計算
                        if (marketUnitPrice && marketUnitPrice > 0) {
                            const deviation = Math.abs(expertAvgUnitPrice - marketUnitPrice) / marketUnitPrice;
                            const priceScore = Math.round(40 * Math.max(0, 1 - deviation));
                            score += priceScore;
                            reasons.push(`價格合理度 ${priceScore}/40 (偏差 ${Math.round(deviation * 100)}%)`);
                        } else {
                            const overlapMin = Math.max(item.budget_min, resolved.unit_price_min * (useUnitPricing ? quantity : 1));
                            const overlapMax = Math.min(item.budget_max, resolved.unit_price_max * (useUnitPricing ? quantity : 1));
                            if (overlapMax >= overlapMin) {
                                const overlapRange = overlapMax - overlapMin;
                                const itemRange = item.budget_max - item.budget_min;
                                const overlapRatio = itemRange > 0 ? overlapRange / itemRange : 1;
                                const priceScore = Math.round(overlapRatio * 40);
                                score += priceScore;
                                reasons.push(`價格區間重疊 ${Math.round(overlapRatio * 100)}%`);
                            }
                        }
                    }
                }
                
                // 【評分項目 4】關鍵字／標籤相關度 (40分)：工項說明含專家 tag、或工項 tags 與專家 tags 去尾字後相同即計入
                // 註：大量 37 分 = 主分類10 + 子分類10 + 價格約17（預算區間重疊率約42%）+ 關鍵字0；多因工項未填標籤或標籤未對上
                const itemTagsForScore = (item.requirements && Array.isArray(item.requirements.tags)) ? item.requirements.tags : [];
                const itemText = `${item.item_name} ${item.item_description || ''}`.toLowerCase();
                let matchedKeywords = [];
                if (listing.tags && listing.tags.length > 0) {
                    for (const tag of listing.tags) {
                        const tagLower = (tag || '').toLowerCase();
                        if (tagLower && itemText.includes(tagLower)) matchedKeywords.push(tag);
                    }
                    for (const lt of listing.tags) {
                        const ltNorm = normalizeTagForMatch(lt);
                        if (!ltNorm) continue;
                        const hasMatch = itemTagsForScore.some(t => normalizeTagForMatch(t) === ltNorm);
                        if (hasMatch && !matchedKeywords.some(m => normalizeTagForMatch(m) === ltNorm)) matchedKeywords.push(lt);
                    }
                    // 已通過標籤篩選表示工項有標籤且與此專家有交集，若上面未計入（例如正規化差異）則再依篩選邏輯補一次
                    if (itemTags.length > 0 && matchedKeywords.length === 0) {
                        const overlap = listing.tags.filter(lt => itemTags.some(t => normalizeTagForMatch(t) === normalizeTagForMatch(lt)));
                        if (overlap.length > 0) matchedKeywords = overlap;
                    }
                }
                if (matchedKeywords.length > 0) {
                    const totalProjectItems = projectItems.length;
                    const denominator = totalProjectItems * 1.5;
                    const scorePerTag = 40 / denominator;
                    const keywordScore = Math.min(40, Math.round(matchedKeywords.length * scorePerTag));
                    score += keywordScore;
                    reasons.push(`關鍵字/標籤匹配: ${matchedKeywords.slice(0, 3).join('、')} (${matchedKeywords.length}個)`);
                }
                
                return {
                    listing,
                    score,
                    reasons
                };
            }));
            
            // 3.4 篩選分數 >= 30 的專家（至少有基本匹配度：主/子分類匹配 + 部分價格/關鍵字）
            const qualifiedListings = scoredListings.filter(s => s.score >= 30);
            
            console.log(`✅ 符合條件的專家 (V2.0 演算法): ${qualifiedListings.length}/${tagFilteredListings.length}`);
            
            if (qualifiedListings.length === 0) {
                matchResults.push({
                    item_id: item.id,
                    item_name: item.item_name,
                    matched_count: 0,
                    message: '沒有符合條件的專家（分數 < 30，建議調整預算或需求）'
                });
                continue;
            }
            
            // 3.5 累積媒合記錄（同一專案+同一 listing 只保留一筆，取最高分）
            let itemMatchedCount = 0;
            for (const s of qualifiedListings) {
                const key = `${project_id}|${s.listing.id}`;
                const existing = matchAccumulator.get(key);
                const record = {
                    project_id: project_id,
                    expert_listing_id: s.listing.id,
                    expert_id: s.listing.expert_id,
                    client_id: clientId,
                    match_score: s.score,
                    match_reasons: {
                        item_id: item.id,
                        item_name: item.item_name,
                        reasons: s.reasons
                    },
                    status: 'active'
                };
                if (!existing || s.score > existing.match_score) {
                    matchAccumulator.set(key, record);
                }
                itemMatchedCount++;
            }
            
            matchResults.push({
                item_id: item.id,
                item_name: item.item_name,
                matched_count: itemMatchedCount,
                top_matches: qualifiedListings.slice(0, 5).map(s => ({
                    expert_id: s.listing.expert_id,
                    listing_title: s.listing.title,
                    score: s.score,
                    reasons: s.reasons
                }))
            });
            console.log(`✅ 本項目符合 ${itemMatchedCount} 位專家（已累積，稍後統一寫入）`);
        }
        
        // 3.6 一次寫入 matches 表（去重後每組 project_id + expert_listing_id 一筆）
        const matchRecords = Array.from(matchAccumulator.values()).map(r => ({
            project_id: r.project_id,
            expert_listing_id: r.expert_listing_id,
            expert_id: r.expert_id,
            client_id: r.client_id,
            match_score: r.match_score,
            match_reasons: r.match_reasons,
            status: r.status
        }));
        let totalMatches = 0;
        if (matchRecords.length > 0) {
            const { data: insertedMatches, error: matchError } = await supabase
                .from('matches')
                .upsert(matchRecords, { onConflict: 'project_id,expert_listing_id' })
                .select();
            if (matchError) {
                console.error('❌ 寫入媒合記錄失敗:', matchError);
                return res.status(500).json({ error: '寫入媒合記錄失敗', details: matchError.message });
            }
            totalMatches = (insertedMatches || []).length;
            console.log(`✅ 已寫入 ${totalMatches} 筆媒合記錄（專案–專家去重後）`);
        }
        
        // ==================== 步驟 4：更新項目狀態為「已發包」 ====================
        
        const { error: updateError } = await supabase
            .from('project_items')
            .update({ 
                status: 'published',
                published_at: new Date().toISOString()
            })
            .in('id', item_ids);
        
        if (updateError) {
            console.error('❌ 更新項目狀態失敗:', updateError);
        }
        
        // ==================== 步驟 5：返回結果 ====================
        
        console.log(`\n🎉 媒合完成！共建立 ${totalMatches} 筆媒合記錄`);
        
        res.json({
            success: true,
            total_items: projectItems.length,
            total_matches: totalMatches,
            results: matchResults,
            message: `已成功發包 ${projectItems.length} 個項目，媒合到 ${totalMatches} 位專家`,
            next_steps: [
                '媒合引擎已分析每個項目需求',
                '已搜尋符合的專家並計算媒合分數',
                '專家將在通知中看到您的專案',
                '您可以在專案詳情頁查看媒合結果'
            ]
        });
        
    } catch (error) {
        console.error('❌ 發包媒合失敗:', error);
        res.status(500).json({ 
            error: '發包媒合失敗', 
            details: error.message 
        });
    }
});

bootstrapCategories().finally(() => {
    Promise.all([
        ensureAiCategoriesTableAndSeed()
    ])
        .then(() => {
            setTimeout(() => {
                const PORT = process.env.PORT || 3000;
                app.listen(PORT, () => {
                console.log('Server running on port', PORT);
                const hasStability = !!getStabilityApiKey();
                console.log('STABILITY_API_KEY loaded:', hasStability ? 'yes' : 'no (erase/upscale/控制區 會回 503)');
                if (process.env.GEMINI_API_KEY) console.log('Gemini 翻譯模型: 後台可設，預設', GEMINI_MODEL_TRANSLATION_DEFAULT, '| 讀圖/分析:', GEMINI_MODEL_READ_DEFAULT);
                if (!hasStability) {
                    const stabilityKeys = Object.keys(process.env).filter(k => k.toUpperCase().includes('STABILITY'));
                    console.log('.env 需包含 STABILITY_API_KEY 或 STABILITY_AI_API_KEY。目前含 STABILITY 的變數:', stabilityKeys.length ? stabilityKeys.join(', ') : '(無)');
                    console.log('.env 路徑:', envPath, '存在:', require('fs').existsSync(envPath));
                    console.log('stability-key.txt 會讀取:', path.join(__dirname, 'stability-key.txt'));
                    console.log('>>> 解法：1) 建立 stability-key.txt（只放一行 sk- 開頭金鑰） 2) 或執行: node server.js --stability-key=您的金鑰 <<<');
                }
            });
            }, 500);
        })
        .catch(() => {
            const PORT = process.env.PORT || 3000;
            app.listen(PORT, () => {
                console.log('Server running on port', PORT);
                const hasStability = !!getStabilityApiKey();
                console.log('STABILITY_API_KEY loaded:', hasStability ? 'yes' : 'no (erase/upscale/控制區 會回 503)');
                if (process.env.GEMINI_API_KEY) console.log('Gemini 翻譯模型: 後台可設，預設', GEMINI_MODEL_TRANSLATION_DEFAULT, '| 讀圖/分析:', GEMINI_MODEL_READ_DEFAULT);
                if (!hasStability) {
                    const stabilityKeys = Object.keys(process.env).filter(k => k.toUpperCase().includes('STABILITY'));
                    console.log('.env 需包含 STABILITY_API_KEY 或 STABILITY_AI_API_KEY。目前含 STABILITY 的變數:', stabilityKeys.length ? stabilityKeys.join(', ') : '(無)');
                    console.log('.env 路徑:', envPath, '存在:', require('fs').existsSync(envPath));
                    console.log('stability-key.txt 會讀取:', path.join(__dirname, 'stability-key.txt'));
                    console.log('>>> 解法：1) 建立 stability-key.txt（只放一行 sk- 開頭金鑰） 2) 或執行: node server.js --stability-key=您的金鑰 <<<');
                }
            });
        });
});
