# 市場價格管理系統 - 安裝與使用

## 📋 執行順序

### 第 1 步：建立資料表
在 Supabase SQL Editor 執行：
```bash
docs/create-market-price-system.sql
```

**建立的資料表：**
- ✅ `market_prices` - 市場價格表
- ✅ `price_calculation_rules` - 計算規則表
- ✅ `price_trends` - 價格趨勢表
- ✅ `matching_config` - 媒合評分設定表

---

### 第 2 步：建立計算函數
在 Supabase SQL Editor 執行：
```bash
docs/market-price-calculation-functions.sql
```

**建立的函數：**
- ✅ `calculate_market_price_default(subcategory)` - 計算預設市場價
- ✅ `calculate_market_price_with_tag(subcategory, tag)` - 計算特定 tag 的市場價
- ✅ `update_market_price_for_subcategory(subcategory)` - 更新單一子分類
- ✅ `update_all_market_prices()` - 批次更新所有子分類

---

## 🎯 快速測試

### 1. 初始化市場價格（首次執行）
```sql
-- 批次更新所有子分類的市場價
SELECT update_all_market_prices();
```

**預期結果：**
```
🎉 批次更新完成！共處理 81 個子分類
✅ home__interior_design：已更新 1 筆市場價記錄
✅ home__carpentry：已更新 1 筆市場價記錄
...
```

---

### 2. 查看市場價格
```sql
SELECT 
    subcategory,
    CASE 
        WHEN tag_filter IS NULL THEN '預設'
        ELSE array_to_string(tag_filter, ', ')
    END as tag,
    market_price,
    sample_count,
    last_updated_at
FROM public.market_prices
ORDER BY subcategory, tag_filter NULLS FIRST;
```

**預期結果：**
```
subcategory              | tag    | market_price | sample_count | last_updated_at
-------------------------|--------|--------------|--------------|------------------
home__interior_design    | 預設   | 75000        | 12           | 2026-02-06 10:30
home__carpentry          | 預設   | 25000        | 8            | 2026-02-06 10:30
...
```

---

## 🔧 管理員操作

### 啟用 Tags 細分（針對特定子分類）

**情境：** 管理員發現「室內設計」類別中，「豪宅」的價位明顯高於一般住宅

**操作：**
```sql
-- 1. 新增計算規則
INSERT INTO public.price_calculation_rules (
    subcategory,
    enable_tag_split,
    split_tags,
    min_sample_size
) VALUES (
    'home__interior_design',
    true,
    ARRAY['豪宅', '現代風格', '日式風格', '小坪數'],
    5  -- 至少 5 個樣本才細分
)
ON CONFLICT (subcategory) 
DO UPDATE SET
    enable_tag_split = EXCLUDED.enable_tag_split,
    split_tags = EXCLUDED.split_tags,
    min_sample_size = EXCLUDED.min_sample_size,
    updated_at = NOW();

-- 2. 重新計算該子分類的市場價
SELECT update_market_price_for_subcategory('home__interior_design');
```

**結果：**
```
✅ home__interior_design：已更新 5 筆市場價記錄
   - 預設（全體）
   - 豪宅
   - 現代風格
   - 日式風格
   - 小坪數（如果樣本 >= 5）
```

---

### 查看價格趨勢（近 30 天）
```sql
SELECT 
    subcategory,
    CASE 
        WHEN tag_filter IS NULL THEN '預設'
        ELSE array_to_string(tag_filter, ', ')
    END as tag,
    market_price,
    sample_count,
    recorded_at::DATE as date
FROM public.price_trends
WHERE subcategory = 'home__interior_design'
  AND recorded_at >= NOW() - INTERVAL '30 days'
ORDER BY recorded_at DESC;
```

---

## 📊 媒合演算法如何使用市場價？

### 在 `server.js` 中查詢市場價

```javascript
// 1. 查詢計算規則
const { data: rule } = await supabase
    .from('price_calculation_rules')
    .select('enable_tag_split, split_tags')
    .eq('subcategory', item.subcategory)
    .single();

let marketPrice;

// 2. 如果啟用 tags 細分，且專家有符合的 tag
if (rule?.enable_tag_split && rule.split_tags) {
    const matchedTag = listing.tags.find(t => rule.split_tags.includes(t));
    
    if (matchedTag) {
        const { data } = await supabase
            .from('market_prices')
            .select('market_price')
            .eq('subcategory', item.subcategory)
            .contains('tag_filter', [matchedTag])
            .single();
        
        if (data) marketPrice = data.market_price;
    }
}

// 3. 否則使用預設市場價
if (!marketPrice) {
    const { data } = await supabase
        .from('market_prices')
        .select('market_price')
        .eq('subcategory', item.subcategory)
        .is('tag_filter', null)
        .single();
    
    marketPrice = data?.market_price;
}

// 4. 計算價格評分
if (marketPrice) {
    const expertAvgPrice = (listing.price_min + listing.price_max) / 2;
    const deviation = Math.abs(expertAvgPrice - marketPrice) / marketPrice;
    const priceScore = Math.round(40 * Math.max(0, 1 - deviation));
}
```

---

## ⏰ 定期自動更新

### 方式 1：Supabase Cron（推薦）

```sql
-- 每天凌晨 3:00 自動更新
SELECT cron.schedule(
    'update-market-prices',
    '0 3 * * *',
    $$ SELECT update_all_market_prices(); $$
);

-- 查看排程狀態
SELECT * FROM cron.job;

-- 取消排程
SELECT cron.unschedule('update-market-prices');
```

---

### 方式 2：API 手動觸發

**建立 API 端點** (`/api/admin/update-market-prices`)：

```javascript
// server.js
app.post('/api/admin/update-market-prices', async (req, res) => {
    try {
        // 驗證管理員權限
        const user = await verifyAdmin(req);
        
        // 執行更新
        const { data, error } = await supabase.rpc('update_all_market_prices', {
            admin_user_id: user.id
        });
        
        if (error) throw error;
        
        res.json({ success: true, message: data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
```

---

## 🚨 常見問題

### Q1：為什麼要預先計算市場價？
**A**：即時運算市場價需要掃描大量 listings，當資料量大時會拖慢媒合速度。預先計算並儲存，媒合時只需查表，速度快 100 倍。

---

### Q2：多久更新一次市場價？
**A**：建議每天更新一次（凌晨 3:00）。如果有大量新專家加入，可由管理員手動觸發更新。

---

### Q3：如何判斷是否需要啟用 tags 細分？
**A**：在後台查看該子分類的價格分佈，如果發現某些 tags 的價位明顯高於或低於平均值，就可以啟用細分。

---

### Q4：樣本數不足怎麼辦？
**A**：`min_sample_size` 預設為 5。如果某個 tag 的樣本數 < 5，系統會自動使用預設市場價，不會細分。

---

## 📝 後續開發

- [ ] 後台介面：市場價格管理頁面 (`admin/market-prices.html`)
- [ ] 後台介面：媒合評分設定頁面 (`admin/matching-config.html`)
- [ ] API 端點：`POST /api/admin/update-market-prices`
- [ ] 更新 `server.js` 的媒合演算法（使用市場價格表）
- [ ] 價格趨勢圖表（Chart.js）

---

## ✅ 總結

- **效能優化**：媒合時查表（毫秒級），不即時運算
- **彈性管理**：管理員可針對特定子分類啟用 tags 細分
- **數據驅動**：價格趨勢可視化，輔助決策
- **可擴充性**：未來可加入地區、經驗年資等維度

**現在可以執行這兩個 SQL 腳本，建立市場價格管理系統！** 🚀
