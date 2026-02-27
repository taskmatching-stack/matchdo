require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });
const imageGenModel = genAI.getGenerativeModel({ model: 'gemini-3-pro-image-preview' });
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

// 中間件設置
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static(uploadDir));
// 提供 client 和 expert 目錄的靜態服務
app.use('/client', express.static(path.join(__dirname, 'client')));
app.use('/expert', express.static(path.join(__dirname, 'expert')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));
// 提供 js 和 config 目錄的靜態服務
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/config', express.static(path.join(__dirname, 'config')));

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
        
        // 從資料庫讀取對應分類的提示詞
        let categoryPrompt = "你是一個專業的工程估算師。請分析這張設計圖，列出所有需要的施工項目。請嚴格輸出為 JSON 陣列，每個元素包含: item_name (項目), spec (規格描述), quantity (數量), unit (單位: 坪/才/式/公尺)。請標準化項目名稱，例如統一使用 '超耐磨地板', '系統櫃', '油漆'。";
        
        if (req.body.category) {
            try {
                const { data, error } = await supabase
                    .from('ai_categories')
                    .select('prompt')
                    .eq('key', req.body.category)
                    .limit(1);
                if (!error && data && data[0] && data[0].prompt) {
                    categoryPrompt = data[0].prompt;
                    // 替換提示詞中的 {subcategory} 變數
                    if (req.body.subcategory) {
                        categoryPrompt = categoryPrompt.replace(/\{subcategory\}/g, req.body.subcategory);
                    }
                }
            } catch (e) {
                console.warn('無法讀取分類提示詞:', e.message);
            }
        }
        
        const prompt = req.body.prompt || categoryPrompt;
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
        let project_id = null;
        try {
            const { data: projectInserted, error: insertError } = await supabase
              .from('projects')
              .insert({ 
                  title, 
                  description: JSON.stringify({ prompt, files: filesInfo }), 
                  status: 'draft' 
              })
              .select('id')
              .limit(1);
            if (!insertError && projectInserted && projectInserted[0]) {
                project_id = projectInserted[0].id;
            } else if (insertError) {
                console.warn('Failed to auto-create project:', insertError.message);
            }
        } catch (e) {
            console.warn('Failed to auto-create project:', e.message);
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
                    return res.json({ categories, via: 'db-direct' });
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
        res.json({ categories, via: 'postgrest' });
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
        
        // 優先嘗試 Supabase REST API
        const { data, error } = await supabase
            .from('ai_categories')
            .upsert(payload, { onConflict: 'key' })
            .select();
        
        if (!error && data && data.length > 0) {
            // 成功寫入資料庫，同步寫本地鏡像備援
            try { fs.writeFileSync(LOCAL_CATEGORIES_PATH, JSON.stringify({ categories: list }, null, 2), 'utf-8'); } catch {}
            res.set('Cache-Control', 'no-store');
            return res.json({ success: true, count: data.length, via: 'postgrest', message: '已成功匯入資料庫' });
        }
        
        // PostgREST 失敗，嘗試直連 PostgreSQL
        if (DB_URL) {
            try {
                const pool = new Pool({ connectionString: DB_URL });
                const client = await pool.connect();
                for (const c of list) {
                    await client.query(
                      'insert into public.ai_categories(key, name, prompt, subcategories) values($1, $2, $3, $4) on conflict (key) do update set name=excluded.name, prompt=excluded.prompt, subcategories=excluded.subcategories, updated_at=now()',
                      [c.key, c.name, c.prompt || '', JSON.stringify(Array.isArray(c.sub) ? c.sub : [])]
                    );
                }
                client.release();
                await pool.end();
                // 成功寫入資料庫，同步寫本地鏡像
                try { fs.writeFileSync(LOCAL_CATEGORIES_PATH, JSON.stringify({ categories: list }, null, 2), 'utf-8'); } catch {}
                res.set('Cache-Control', 'no-store');
                return res.json({ success: true, count: list.length, via: 'db-direct', message: '已成功匯入資料庫（直連）' });
            } catch (e2) {
                // 資料庫完全失敗，只能用本地檔案
                console.error('資料庫匯入失敗:', error?.message, e2.message);
                try { fs.writeFileSync(LOCAL_CATEGORIES_PATH, JSON.stringify({ categories: list }, null, 2), 'utf-8'); } catch {}
                res.set('Cache-Control', 'no-store');
                return res.json({ 
                    success: false, 
                    count: list.length, 
                    via: 'local-only', 
                    error: '資料庫連線失敗，請使用 SQL Editor 手動匯入',
                    details: `PostgREST: ${error?.message || 'unknown'} | Direct: ${e2.message}` 
                });
            }
        }
        
        // 無直連選項，匯入失敗
        console.error('資料庫匯入失敗:', error?.message);
        try { fs.writeFileSync(LOCAL_CATEGORIES_PATH, JSON.stringify({ categories: list }, null, 2), 'utf-8'); } catch {}
        res.set('Cache-Control', 'no-store');
        return res.json({ 
            success: false, 
            count: list.length, 
            via: 'local-only', 
            error: '資料庫連線失敗，請使用 SQL Editor 手動匯入',
            details: error?.message || 'unknown'
        });
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

// ===== 客製產品 API =====

// API: 生成產品示意圖（使用 Gemini 3 Pro Image Preview）
app.post('/api/generate-product-image', express.json(), async (req, res) => {
    try {
        const { prompt, aspectRatio = '1:1', resolution = '2K' } = req.body;
        if (!prompt) {
            return res.status(400).json({ success: false, error: '請提供產品描述' });
        }

        // 增強 prompt，加入產品設計專業引導
        const enhancedPrompt = `Create a professional product design visualization: ${prompt}. 
Style: Clean, modern product photography with soft studio lighting. 
Quality: High-resolution, sharp focus on key details, suitable for manufacturing reference.`;

        // 使用 Gemini 3 Pro Image Preview 生成高品質圖片
        const imageGenModel = genAI.getGenerativeModel({ model: 'gemini-3-pro-image-preview' });
        const result = await imageGenModel.generateContent({
            contents: [{ text: enhancedPrompt }],
            generationConfig: {
                responseModalities: ['IMAGE'],
                imageConfig: {
                    aspectRatio: aspectRatio,
                    imageSize: resolution
                }
            }
        });
        
        const response = await result.response;
        
        // 從回應中提取圖片資料
        let imageData = null;
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData && part.inlineData.mimeType && part.inlineData.mimeType.startsWith('image/')) {
                imageData = part.inlineData.data;
                break;
            }
        }
        
        if (!imageData) {
            return res.status(500).json({ success: false, error: 'AI 未返回圖片資料' });
        }

        // 儲存圖片到本地
        const filename = `generated-${Date.now()}.png`;
        const filepath = path.join(uploadDir, filename);
        const buffer = Buffer.from(imageData, 'base64');
        fs.writeFileSync(filepath, buffer);

        res.json({
            success: true,
            imageUrl: `/uploads/${filename}`,
            imageData: `data:image/png;base64,${imageData}`,
            resolution,
            aspectRatio
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

// API: 分析客製產品並媒合廠商
app.post('/api/analyze-custom-product', upload.array('images', 10), async (req, res) => {
    try {
        const { category, quantity, description, budgetMin, budgetMax, generatedImage, prompt } = req.body;
        
        // 準備圖片資料
        let imageParts = [];
        
        if (req.files && req.files.length > 0) {
            // 上傳的圖片
            imageParts = req.files.map(file => ({
                inlineData: {
                    data: fs.readFileSync(file.path).toString('base64'),
                    mimeType: file.mimetype
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

產品類別：${category}
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
        const result = await model.generateContent([
            analysisPrompt,
            ...imageParts
        ]);

        const responseText = result.response.text();
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
        const manufacturers = await queryManufacturers(category, analysis);

        // 儲存分析結果到資料庫
        const imageUrls = req.files ? req.files.map(f => `/uploads/${f.filename}`) : [];
        const projectData = {
            category,
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
            return res.status(401).json({ error: '未授權：token 無效' });
        }

        const { title, description, category, reference_image_url, ai_generated_image_url, analysis_json } = req.body;

        if (!title || !description) {
            return res.status(400).json({ error: '標題與描述為必填欄位' });
        }

        const { data, error } = await supabase
            .from('custom_products')
            .insert({
                owner_id: user.id,
                title,
                description,
                category: category || null,
                reference_image_url: reference_image_url || null,
                ai_generated_image_url: ai_generated_image_url || null,
                analysis_json: analysis_json || null,
                status: 'draft'
            })
            .select()
            .single();

        if (error) {
            console.error('儲存客製產品失敗:', error);
            return res.status(500).json({ error: error.message });
        }

        res.json({ success: true, product: data });
    } catch (e) {
        console.error('POST /api/custom-products 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
    }
});

// GET /api/custom-products - 取得使用者的客製產品列表
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

        const { data, error } = await supabase
            .from('custom_products')
            .select('*')
            .eq('owner_id', user.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('查詢客製產品失敗:', error);
            return res.status(500).json({ error: error.message });
        }

        res.json({ success: true, products: data || [] });
    } catch (e) {
        console.error('GET /api/custom-products 異常:', e);
        res.status(500).json({ error: '系統錯誤' });
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

        res.json({ success: true, product: data });
    } catch (e) {
        console.error('GET /api/custom-products/:id 異常:', e);
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

// 媒合廠商邏輯（內部函數）
async function matchManufacturers(product) {
    try {
        const category = product.category || 'default';
        const analysis = product.analysis_json || {};

        // 從資料庫查詢符合條件的廠商
        let query = supabase
            .from('manufacturers')
            .select('*')
            .eq('is_active', true);

        // 如果有分類，篩選包含該分類的廠商
        if (category && category !== 'default') {
            query = query.contains('categories', [category]);
        }

        const { data: manufacturers, error } = await query;

        if (error) {
            console.error('查詢廠商失敗:', error);
            return generateMockManufacturersForCustomProduct(category, analysis);
        }

        if (!manufacturers || manufacturers.length === 0) {
            return generateMockManufacturersForCustomProduct(category, analysis);
        }

        // 計算媒合分數
        return manufacturers.map(mfr => {
            let matchScore = 50; // 基礎分數

            // 分類匹配 (+30分)
            if (mfr.categories && mfr.categories.includes(category)) {
                matchScore += 30;
            }

            // 評分加成 (+0~15分)
            if (mfr.rating) {
                matchScore += Math.floor(mfr.rating * 3);
            }

            // 驗證廠商加成 (+5分)
            if (mfr.verified) {
                matchScore += 5;
            }

            return {
                id: mfr.id,
                name: mfr.name,
                specialty: mfr.description,
                rating: mfr.rating,
                location: mfr.location,
                capabilities: mfr.capabilities,
                contact: mfr.contact_json,
                matchScore: Math.min(matchScore, 95),
                matchReasons: {
                    category_match: mfr.categories && mfr.categories.includes(category),
                    verified: mfr.verified,
                    rating: mfr.rating
                }
            };
        }).sort((a, b) => b.matchScore - a.matchScore);

    } catch (e) {
        console.error('媒合廠商異常:', e);
        return generateMockManufacturersForCustomProduct(product.category, product.analysis_json);
    }
}

// 模擬廠商推薦（客製產品專用）
function generateMockManufacturersForCustomProduct(category, analysis) {
    const mockData = [
        { id: 'mock-1', name: '匠心木工坊', specialty: '專注原木家具訂製', rating: 4.8, location: '台北市', capabilities: ['快速打樣', '客製化設計'], matchScore: 92 },
        { id: 'mock-2', name: '創意金屬工藝', specialty: '精密金屬加工', rating: 4.6, location: '台中市', capabilities: ['精密加工', '藝術品訂製'], matchScore: 88 },
        { id: 'mock-3', name: '時尚布藝工作室', specialty: '客製化布料產品', rating: 4.7, location: '高雄市', capabilities: ['快速打樣', '設計諮詢'], matchScore: 85 },
        { id: 'mock-4', name: '3D 列印創客空間', specialty: '快速原型製作', rating: 4.9, location: '新北市', capabilities: ['快速打樣', '設計優化'], matchScore: 90 }
    ];

    return mockData.map(mfr => ({
        ...mfr,
        contact: { phone: '02-xxxx-xxxx', email: 'info@example.com' },
        matchReasons: { category_match: true, mock: true }
    }));
}

// 更新專案項目（用於儲存 AI 辨識結果）
app.post('/api/projects/update-items', async (req, res) => {
    try {
        const { project_id, items } = req.body;
        if (!project_id || !items) {
            return res.status(400).json({ error: '缺少參數' });
        }

        // 取得目前專案資料以保留其他資訊
        const { data: currentProject, error: fetchError } = await supabase
            .from('projects')
            .select('description')
            .eq('id', project_id)
            .single();

        if (fetchError) {
            console.error('Fetch project error:', fetchError);
            return res.status(500).json({ error: '無法取得專案' });
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

// AI 生成 Tags
app.post('/api/ai-tags/generate', async (req, res) => {
    try {
        const { item_name, category } = req.body;
        if (!item_name) return res.status(400).json({ error: '缺少工項名稱' });

        // TODO: 檢查並扣除點數 (目前模擬)
        // const userId = req.user.id;
        // await deductCredits(userId, 5); 

        const prompt = `
你是一個建築工程與室內設計專家。
請針對工項「${item_name}」生成 3-5 個同義詞或關聯標籤 (Tags)，用於資料庫媒合與搜尋。
分類情境：${category || '一般工程'}
請直接回傳 JSON 陣列，例如：["木工", "隔間", "裝潢"]
不要回傳任何其他文字。
`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        
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
