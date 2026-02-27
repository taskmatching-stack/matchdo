require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
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
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

app.use(express.static('public'));
app.use('/uploads', express.static(uploadDir));

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

// 取得 AI 分類（供前台載入）
app.get('/api/categories', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('ai_categories')
            .select('key, name, prompt, subcategories');
        if (error) return res.status(500).json({ error: error.message });
        const categories = (data || []).map(row => ({
            key: row.key,
            name: row.name,
            prompt: row.prompt || '',
            sub: Array.isArray(row.subcategories) ? row.subcategories : []
        }));
        res.json({ categories });
    } catch (e) {
        res.status(500).json({ error: '載入分類失敗' });
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
        if (error) return res.status(500).json({ error: error.message });
        res.json({ success: true, count: data ? data.length : payload.length });
    } catch (e) {
        res.status(500).json({ error: '更新分類失敗' });
    }
});

app.listen(3000, () => console.log('Server running on port 3000'));
