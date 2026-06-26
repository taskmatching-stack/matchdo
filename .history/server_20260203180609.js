require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });
const { createClient } = require('@supabase/supabase-js');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });



const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

app.use(express.static('public'));

app.post('/api/analyze', upload.single('designImage'), async (req, res) => {
    try {
        const imageBuffer = req.file.buffer;
        const base64Image = imageBuffer.toString('base64');
        const prompt = "你是一個專業的工程估算師。請分析這張設計圖，列出所有需要的施工項目。請嚴格輸出為 JSON 格式，包含: item_name (項目), spec (規格描述), quantity (數量), unit (單位: 坪/才/式/公尺)。請標準化項目名稱，例如統一使用 '超耐磨地板', '系統櫃', '油漆'。";
        const result = await model.generateContent({
            contents: [
                {
                    role: "user",
                    parts: [
                        { text: prompt },
                        { inlineData: { mimeType: "image/jpeg", data: base64Image } }
                    ]
                }
            ]
        });
        const response = await result.response;
        let aiResult;
        try {
            aiResult = JSON.parse(response.text());
        } catch (e) {
            return res.status(500).json({ error: 'AI 回傳格式錯誤', raw: response.text() });
        }
        const items = aiResult.items;
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
                finalQuote.push({ ...item, matched_price: "未找到報價", subtotal: 0 });
            }
        }
        res.json({ success: true, total: totalEstimate, details: finalQuote });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: '系統忙碌中，請稍後再試' });
    }
});

app.listen(3000, () => console.log('Server running on port 3000'));
