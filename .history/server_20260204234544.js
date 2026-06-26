require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });
const { createClient } = require('@supabase/supabase-js');

const app = express();
// 準備上傳目錄（本機保存檔案）
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname || '.jpg');
        const name = `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`;
        cb(null, name);
    }
});
const upload = multer({ storage });
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const supabase = createClient(process.env.SUPABASE_URL, SUPABASE_KEY);
const DB_URL = process.env.SUPABASE_DB_URL;
const LOCAL_CATEGORIES_PATH = path.join(__dirname, 'public', 'config', 'ai-categories.local.json');

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

app.use(express.static('public'));
app.use('/uploads', express.static(uploadDir));

// 啟動時若分類為空，從預設 JSON 引導一次
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
                    const payload = (raw.categories || []).map(c => ({
                        key: c.key,
                        name: c.name,
                        prompt: c.prompt || '',
                        subcategories: Array.isArray(c.sub) ? c.sub : []
                    }));
                    if (payload.length) {
                        const { error: upErr } = await supabase
                            .from('ai_categories')
                            .upsert(payload);
                        if (upErr) {
                            console.warn('匯入預設分類失敗：', upErr.message);
                        } else {
                            console.log(`已從預設檔匯入 ${payload.length} 筆 AI 分類`);
                        }
                    }
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
        if (!files.length) return res.status(400).json({ error: '請至少上傳一張設計圖' });
        const firstPath = files[0].path;
        const imageBuffer = fs.readFileSync(firstPath);
        const base64Image = imageBuffer.toString('base64');
        const prompt = req.body.prompt || "你是一個專業的工程估算師。請分析這張設計圖，列出所有需要的施工項目。請嚴格輸出為 JSON 陣列，每個元素包含: item_name (項目), spec (規格描述), quantity (數量), unit (單位: 坪/才/式/公尺)。請標準化項目名稱，例如統一使用 '超耐磨地板', '系統櫃', '油漆'。";
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
        // 建立專案記錄（保留上傳檔與表單摘要）
        let tags = [];
        try {
          if (req.body.subcategories) tags = JSON.parse(req.body.subcategories);
        } catch {}
        const filesInfo = files.map(f => ({ filename: path.basename(f.path), url: `/uploads/${path.basename(f.path)}` }));
        const title = req.body.category ? `專案-${req.body.category}` : '專案-未分類';
        const { data: projectInserted } = await supabase
          .from('projects')
          .insert({ title, description: JSON.stringify({ prompt, files: filesInfo }), tags, status: 'open' })
          .select('id')
          .limit(1);
        const project_id = projectInserted && projectInserted[0] ? projectInserted[0].id : null;
        const result = await model.generateContent({
            contents: [
                {
                    role: "user",
                    parts: [
                        { text: customPrompt },
                        { inlineData: { mimeType: "image/jpeg", data: base64Image } }
                    ]
                }
            ]
        });
        const response = await result.response;
        let items = [];
        try {
            // 支援 AI 回傳陣列或物件
            const text = response.text();
            if (text.trim().startsWith('[')) {
                items = JSON.parse(text);
            } else {
                const aiResult = JSON.parse(text);
                items = aiResult.items || [];
            }
        } catch (e) {
            // 嘗試用正則抓取 JSON 區塊
            const match = response.text().match(/\[.*\]/s);
            if (match) {
                try {
                    items = JSON.parse(match[0]);
                } catch (e2) {
                    return res.status(500).json({ error: 'AI 回傳格式錯誤', raw: response.text(), prompt: customPrompt });
                }
            } else {
                return res.status(500).json({ error: 'AI 回傳格式錯誤', raw: response.text(), prompt: customPrompt });
            }
        }
        res.json({ success: true, project_id, items });
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
        const firstPath = files[0].path;
        const imageBuffer = fs.readFileSync(firstPath);
        const base64Image = imageBuffer.toString('base64');
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
        const result = await model.generateContent({
            contents: [
                {
                    role: "user",
                    parts: [
                        { text: customPrompt },
                        { inlineData: { mimeType: "image/jpeg", data: base64Image } }
                    ]
                }
            ]
        });
        const response = await result.response;
        let aiResult;
        let items = [];
        try {
            aiResult = JSON.parse(response.text());
            items = aiResult.items || [];
        } catch (e) {
            // 嘗試用正則抓取 JSON 區塊
            const match = response.text().match(/\{[\s\S]*\}/);
            if (match) {
                try {
                    aiResult = JSON.parse(match[0]);
                    items = aiResult.items || [];
                } catch (e2) {
                    return res.status(500).json({ error: 'AI 回傳格式錯誤', raw: response.text(), prompt: customPrompt });
                }
            } else {
                return res.status(500).json({ error: 'AI 回傳格式錯誤', raw: response.text(), prompt: customPrompt });
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

// 取得 AI 分類（供前台載入）
app.get('/api/categories', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('ai_categories')
            .select('key, name, prompt, subcategories');
        if (error) {
            // 若 Supabase PostgREST schema 尚未刷新，改用直連查詢回傳，避免使用者等待
            if (DB_URL && /schema cache/i.test(error.message)) {
                try {
                    const pool = new Pool({ connectionString: DB_URL });
                    const client = await pool.connect();
                    const r = await client.query('select key, name, prompt, subcategories from public.ai_categories');
                    client.release();
                    await pool.end();
                    const categories = (r.rows || []).map(row => ({
                        key: row.key,
                        name: row.name,
                        prompt: row.prompt || '',
                        sub: Array.isArray(row.subcategories) ? row.subcategories : (row.subcategories ? row.subcategories : [])
                    }));
                    res.set('Cache-Control', 'no-store');
                    return res.json({ categories });
                } catch (e2) {
                    // 後援：讀取本地檔
                    if (fs.existsSync(LOCAL_CATEGORIES_PATH)) {
                        try {
                            const raw = fs.readFileSync(LOCAL_CATEGORIES_PATH, 'utf-8');
                            const json = JSON.parse(raw);
                            const list = Array.isArray(json.categories) ? json.categories : [];
                            res.set('Cache-Control', 'no-store');
                            return res.json({ categories: list, via: 'local-fallback' });
                        } catch {}
                    }
                    return res.status(500).json({ error: error.message });
                }
            }
            // 非 schema cache，也嘗試回傳本地檔
            if (fs.existsSync(LOCAL_CATEGORIES_PATH)) {
                try {
                    const raw = fs.readFileSync(LOCAL_CATEGORIES_PATH, 'utf-8');
                    const json = JSON.parse(raw);
                    const list = Array.isArray(json.categories) ? json.categories : [];
                    res.set('Cache-Control', 'no-store');
                    return res.json({ categories: list, via: 'local-fallback' });
                } catch {}
            }
            return res.status(500).json({ error: error.message });
        }
        const categories = (data || []).map(row => ({
            key: row.key,
            name: row.name,
            prompt: row.prompt || '',
            sub: Array.isArray(row.subcategories) ? row.subcategories : []
        }));
        // 防止快取，確保前台同步最新分類與提示詞
        res.set('Cache-Control', 'no-store');
        res.json({ categories });
    } catch (e) {
        // 最後防線：讀本地檔
        try {
            if (fs.existsSync(LOCAL_CATEGORIES_PATH)) {
                const raw = fs.readFileSync(LOCAL_CATEGORIES_PATH, 'utf-8');
                const json = JSON.parse(raw);
                const list = Array.isArray(json.categories) ? json.categories : [];
                res.set('Cache-Control', 'no-store');
                return res.json({ categories: list, via: 'local-fallback' });
            }
        } catch {}
        res.status(500).json({ error: '載入分類失敗' });
    }
});

// 一鍵匯入預設分類（從 public/config/default-categories.json 讀取並 upsert）
app.post('/api/categories/import-default', async (req, res) => {
    try {
        const filePath = path.join(__dirname, 'public', 'config', 'default-categories.json');
        const raw = fs.readFileSync(filePath, 'utf-8');
        const json = JSON.parse(raw);
        const list = Array.isArray(json.categories) ? json.categories : [];
        if (!list.length) return res.status(400).json({ error: '預設分類清單為空' });
        const payload = list.map(c => ({
            key: c.key,
            name: c.name,
            prompt: c.prompt || '',
            subcategories: Array.isArray(c.sub) ? c.sub : []
        }));
        // 先無條件寫入本地鏡像，確保後台與前台可立即看到資料
        try { fs.writeFileSync(LOCAL_CATEGORIES_PATH, JSON.stringify({ categories: list }, null, 2), 'utf-8'); } catch {}
        const { data, error } = await supabase
            .from('ai_categories')
            .upsert(payload);
        if (error) {
            // 後援：若 PostgREST 報錯（例如 schema cache 或 RLS），改走直連 DB
            if (DB_URL) {
                try {
                    const pool = new Pool({ connectionString: DB_URL });
                    const client = await pool.connect();
                    for (const c of list) {
                        await client.query(
                          'insert into public.ai_categories(key, name, prompt, subcategories) values($1, $2, $3, $4) on conflict (key) do update set name=excluded.name, prompt=excluded.prompt, subcategories=excluded.subcategories',
                          [c.key, c.name, c.prompt || '', JSON.stringify(Array.isArray(c.sub) ? c.sub : [])]
                        );
                    }
                    client.release();
                    await pool.end();
                    res.set('Cache-Control', 'no-store');
                    return res.json({ success: true, count: list.length, via: 'db-direct' });
                } catch (e2) {
                    // DB 也失敗，仍以本地鏡像作為成功匯入，讓後台可立即看到
                    res.set('Cache-Control', 'no-store');
                    return res.json({ success: true, count: list.length, via: 'local-only', warn: `${error.message} | direct-db: ${e2.message}` });
                }
            }
            // 無 DB_URL，直接以本地鏡像作為成功匯入
            res.set('Cache-Control', 'no-store');
            return res.json({ success: true, count: list.length, via: 'local-only', warn: error.message });
        }
        res.set('Cache-Control', 'no-store');
        res.json({ success: true, count: data ? data.length : payload.length, via: 'postgrest' });
    } catch (e) {
        res.status(500).json({ error: '匯入預設分類失敗' });
    }
});
// 更新 AI 分類（後台用，簡易版：整批 upsert）
app.put('/api/categories', express.json(), async (req, res) => {
    try {
        const categories = Array.isArray(req.body.categories) ? req.body.categories : [];
        if (!categories.length) return res.status(400).json({ error: '無有效資料' });
        const payload = categories.map(c => ({
            key: c.key,
            name: c.name,
            prompt: c.prompt || '',
            subcategories: Array.isArray(c.sub) ? c.sub : []
        }));
        const { data, error } = await supabase
            .from('ai_categories')
            .upsert(payload);
        // 同步寫入本地檔（即使 DB 失敗也寫入，確保前台可讀）
        try {
            fs.writeFileSync(LOCAL_CATEGORIES_PATH, JSON.stringify({ categories }, null, 2), 'utf-8');
        } catch {}
        if (error) {
            return res.json({ success: true, count: categories.length, warn: error.message, via: 'local-only' });
        }
        res.json({ success: true, count: data ? data.length : payload.length, via: 'postgrest+local' });
    } catch (e) {
        res.status(500).json({ error: '更新分類失敗' });
    }
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
// 一鍵匯入預設分類（需要時可手動呼叫）
app.post('/api/categories/seed-defaults', async (req, res) => {
    try {
        const defaultsPath = path.join(__dirname, 'public', 'config', 'ai-categories.defaults.json');
        if (!fs.existsSync(defaultsPath)) {
            return res.status(404).json({ error: '找不到預設分類檔' });
        }
        const raw = JSON.parse(fs.readFileSync(defaultsPath, 'utf-8'));
        const payload = (raw.categories || []).map(c => ({
            key: c.key,
            name: c.name,
            prompt: c.prompt || '',
            subcategories: Array.isArray(c.sub) ? c.sub : []
        }));
        if (!payload.length) return res.status(400).json({ error: '預設檔無有效資料' });
        const { data, error } = await supabase
            .from('ai_categories')
            .upsert(payload);
        if (error) return res.status(500).json({ error: error.message });
        res.json({ success: true, count: data ? data.length : payload.length });
    } catch (e) {
        res.status(500).json({ error: '匯入預設分類失敗' });
    }
});

bootstrapCategories().finally(() => {
    ensureAiCategoriesTableAndSeed()
        .then(() => {
            // 等待 Supabase PostgREST 刷新 schema（保守延遲）
            setTimeout(() => {
                app.listen(3000, () => console.log('Server running on port 3000'));
            }, 500);
        })
        .catch(() => {
            app.listen(3000, () => console.log('Server running on port 3000'));
        });
});
