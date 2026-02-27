# 價格與單位邏輯設計文檔

更新日期：2026-02-06  
狀態：架構設計中

---

## 🎯 **核心問題**

目前系統的價格邏輯不完整：
- ❌ `listings.price_min/max` 不清楚是單價還是總價
- ❌ `project_items` 缺少 `quantity` 和 `unit` 欄位
- ❌ 媒合時無法正確比對「單價 × 數量」

---

## ✅ **正確的邏輯架構**

### **發包商（Client）提供**

```
項目：室內設計
├─ 數量：30
├─ 單位：坪
├─ 總預算：$70,000 - $90,000
└─ 推算單價範圍：$2,333 - $3,000 / 坪
```

### **承包商（Expert）提供**

```
服務：室內設計
├─ 單價：$2,500 - $3,500
├─ 單位：坪
└─ 說明：包含平面圖、3D圖、現場監工
```

### **媒合計算**

```javascript
// 1. 檢查單位是否一致
if (listing.unit !== item.unit) {
    return { match: false, reason: '單位不符' };
}

// 2. 計算承包商的總價（根據發包商的數量）
const expertTotalMin = listing.price_min * item.quantity;
const expertTotalMax = listing.price_max * item.quantity;

// 範例：
// $2,500/坪 × 30坪 = $75,000
// $3,500/坪 × 30坪 = $105,000

// 3. 對比發包商的預算範圍
const clientBudgetMin = item.budget_min;  // $70,000
const clientBudgetMax = item.budget_max;  // $90,000

// 4. 價格過濾：承包商均價必須在預算內
const expertAvgTotal = (expertTotalMin + expertTotalMax) / 2;
// $75,000 + $105,000 / 2 = $90,000

if (expertAvgTotal < clientBudgetMin || expertAvgTotal > clientBudgetMax) {
    return { match: false, reason: '價格超出預算' };
}

// 5. 計算價格合理度分數（使用市場單價）
const marketUnitPrice = getMarketPrice(item.subcategory);  // $2,800/坪
const marketTotalPrice = marketUnitPrice * item.quantity;  // $84,000

const expertAvgUnitPrice = (listing.price_min + listing.price_max) / 2;  // $3,000/坪
const deviation = Math.abs(expertAvgUnitPrice - marketUnitPrice) / marketUnitPrice;
// |$3,000 - $2,800| / $2,800 = 7.1%

const priceScore = Math.round(40 * Math.max(0, 1 - deviation));
// 40 × (1 - 0.071) = 37 分
```

---

## 📊 **資料表結構調整**

### **1. project_items 表（發包商）**

#### **需要新增的欄位**

```sql
ALTER TABLE public.project_items 
ADD COLUMN IF NOT EXISTS quantity DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS unit TEXT;

COMMENT ON COLUMN public.project_items.quantity IS '數量（例：30、5、100）';
COMMENT ON COLUMN public.project_items.unit IS '單位（例：坪、組、公尺、m²、次）';
```

#### **完整資料結構**

```sql
project_items {
    id UUID,
    project_id UUID,
    item_name TEXT,                 -- 項目名稱
    item_description TEXT,          -- 項目說明
    category_name TEXT,             -- 主分類
    subcategory TEXT,               -- 子分類
    
    -- 數量與單位
    quantity DECIMAL(10, 2),        -- 數量（例：30）
    unit TEXT,                      -- 單位（例：坪）
    
    -- 總預算
    budget_min INTEGER,             -- 總預算下限（例：$70,000）
    budget_max INTEGER,             -- 總預算上限（例：$90,000）
    
    status TEXT,
    ...
}
```

#### **資料範例**

```json
{
  "id": "item-001",
  "item_name": "室內設計",
  "item_description": "30坪客廳+餐廳+廚房，現代簡約風格",
  "category_name": "home",
  "subcategory": "home__interior_design",
  "quantity": 30,
  "unit": "坪",
  "budget_min": 70000,
  "budget_max": 90000
}
```

**推算**：
- 客戶心中的單價範圍：$2,333 - $3,000 / 坪

---

### **2. listings 表（承包商）**

#### **現有欄位定義**

```sql
listings {
    id UUID,
    expert_id UUID,
    title TEXT,
    category TEXT,
    subcategory TEXT,
    description TEXT,
    
    -- 價格與單位（需明確定義）
    price_min INTEGER,      -- 單價下限（$2,500 / 坪）
    price_max INTEGER,      -- 單價上限（$3,500 / 坪）
    unit TEXT,              -- 單位（坪）
    
    tags TEXT[],
    status TEXT,
    ...
}
```

#### **明確定義**

```sql
COMMENT ON COLUMN public.listings.price_min IS '單價下限（每單位價格，例：$2,500/坪）';
COMMENT ON COLUMN public.listings.price_max IS '單價上限（每單位價格，例：$3,500/坪）';
COMMENT ON COLUMN public.listings.unit IS '計價單位（坪、組、公尺、m²、次等）';
```

#### **資料範例**

```json
{
  "id": "listing-001",
  "expert_id": "expert-123",
  "title": "現代風格室內設計",
  "category": "home",
  "subcategory": "home__interior_design",
  "price_min": 2500,      // $2,500 / 坪
  "price_max": 3500,      // $3,500 / 坪
  "unit": "坪",
  "description": "包含平面圖、3D圖、現場監工",
  "tags": ["室內設計", "現代風格", "小坪數"]
}
```

#### **階梯定價（price_tiers）— 不同數量對應不同單價區間**

承包商可自訂多組「數量區間 × 單價區間」；數量、單價皆可自訂。若填寫 `price_tiers`，媒合時會依發包商的**數量**落入哪一階，取該階的單價計算總價。

**欄位**：`listings.price_tiers`（JSONB，可為 null）

**格式**：陣列，每筆一階，依 `quantity_min` 由小到大排序。

| 欄位 | 說明 |
|------|------|
| `quantity_min` | 數量下限（含） |
| `quantity_max` | 數量上限（含）；**null 表示「以上」** |
| `unit_price_min` | 該區間單價下限 |
| `unit_price_max` | 該區間單價上限 |

**範例**：系統櫃，依組數不同單價

```json
"price_tiers": [
  { "quantity_min": 1,  "quantity_max": 10,  "unit_price_min": 8000,  "unit_price_max": 12000 },
  { "quantity_min": 11, "quantity_max": 30,  "unit_price_min": 7000,  "unit_price_max": 10000 },
  { "quantity_min": 31, "quantity_max": null, "unit_price_min": 6000,  "unit_price_max": 9000 }
]
```

- 發包 5 組 → 取第一階：$8,000–$12,000/組 → 總價約 $40,000–$60,000  
- 發包 20 組 → 取第二階：$7,000–$10,000/組 → 總價約 $140,000–$200,000  
- 發包 50 組 → 取第三階（31 以上）：$6,000–$9,000/組 → 總價約 $300,000–$450,000  

**邏輯**：

- 若 `price_tiers` 為 null 或空陣列，則使用 `price_min`、`price_max`、`unit` 作為單一區間（所有數量同一單價）。
- 媒合時：依發包項目的 `quantity` 找到涵蓋該數量的階梯，取該階的 `unit_price_min`、`unit_price_max`，再乘以發包數量得到專家總價，與發包總預算比對。

---

### **3. market_prices 表（市場價）**

#### **定義**

```sql
market_prices {
    subcategory TEXT,
    market_price DECIMAL,   -- 市場單價（$2,800 / 坪）
    ...
}

COMMENT ON COLUMN public.market_prices.market_price IS '市場單價（每單位價格，排除離群值後的均值 × 1.25）';
```

#### **資料範例**

```json
{
  "subcategory": "home__interior_design",
  "market_price": 2800,    // $2,800 / 坪
  "sample_count": 45
}
```

**計算方式**：
```sql
-- 從所有 listings 的 price_min（單價）計算
SELECT ROUND(AVG(price_min) * 1.25, 0) as market_price
FROM listings
WHERE subcategory = 'home__interior_design'
  AND status = 'active'
  AND price_min > 0
```

---

## 🔢 **完整媒合邏輯（含單位）**

```javascript
async function matchExpertToItem(listing, item) {
    // ==================== 步驟 1：單位檢查 ====================
    
    if (listing.unit !== item.unit) {
        return {
            match: false,
            reason: `單位不符（客戶：${item.unit}，專家：${listing.unit}）`,
            score: 0
        };
    }
    
    // ==================== 步驟 2：計算總價 ====================
    
    // 承包商的總價（根據客戶數量）
    const expertTotalMin = listing.price_min * item.quantity;
    const expertTotalMax = listing.price_max * item.quantity;
    const expertAvgTotal = (expertTotalMin + expertTotalMax) / 2;
    
    // 承包商的平均單價
    const expertAvgUnitPrice = (listing.price_min + listing.price_max) / 2;
    
    // 範例：
    // price_min: 2500, price_max: 3500
    // quantity: 30
    // expertTotalMin: $75,000
    // expertTotalMax: $105,000
    // expertAvgTotal: $90,000
    // expertAvgUnitPrice: $3,000/坪
    
    // ==================== 步驟 3：價格過濾 ====================
    
    // 承包商均價必須在客戶預算範圍內
    if (expertAvgTotal < item.budget_min || expertAvgTotal > item.budget_max) {
        return {
            match: false,
            reason: `總價超出預算（專家：$${expertAvgTotal}，預算：$${item.budget_min}-${item.budget_max}）`,
            score: 0
        };
    }
    
    // ==================== 步驟 4：評分 ====================
    
    let score = 0;
    const reasons = [];
    
    // 4.1 主分類匹配（10分）
    if (listing.category === item.category_name) {
        score += 10;
        reasons.push('✓ 主分類匹配');
    }
    
    // 4.2 子分類匹配（10分）
    if (listing.subcategory === item.subcategory) {
        score += 10;
        reasons.push('✓ 子分類匹配');
    }
    
    // 4.3 價格合理度（40分）- 使用市場單價
    const { data: marketData } = await supabase
        .from('market_prices')
        .select('market_price')
        .eq('subcategory', item.subcategory)
        .is('tag_filter', null)
        .single();
    
    if (marketData && marketData.market_price) {
        const marketUnitPrice = marketData.market_price;  // 市場單價
        
        // 計算偏差率（用單價比較）
        const deviation = Math.abs(expertAvgUnitPrice - marketUnitPrice) / marketUnitPrice;
        const priceScore = Math.round(40 * Math.max(0, 1 - deviation));
        
        score += priceScore;
        reasons.push(
            `價格合理度 ${priceScore}/40分`,
            `   → 專家單價：$${expertAvgUnitPrice}/${item.unit}`,
            `   → 市場單價：$${marketUnitPrice}/${item.unit}`,
            `   → 偏差：${Math.round(deviation * 100)}%`
        );
    }
    
    // 4.4 關鍵字相關度（40分）
    // ... 原有邏輯
    
    return {
        match: true,
        score: score,
        reasons: reasons,
        price_info: {
            expert_unit_price: expertAvgUnitPrice,
            expert_total_price: expertAvgTotal,
            market_unit_price: marketData?.market_price,
            client_budget: [item.budget_min, item.budget_max],
            unit: item.unit
        }
    };
}
```

---

## 📋 **需要執行的調整**

### **SQL 腳本 1：project_items 表新增欄位**

```sql
-- 檔案：docs/add-project-items-quantity-unit.sql

ALTER TABLE public.project_items 
ADD COLUMN IF NOT EXISTS quantity DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS unit TEXT;

-- 索引
CREATE INDEX IF NOT EXISTS idx_project_items_unit ON public.project_items(unit);

-- 註解
COMMENT ON COLUMN public.project_items.quantity IS '數量（例：30、5、100.5）';
COMMENT ON COLUMN public.project_items.unit IS '單位（例：坪、組、公尺、m²、次、式）';
COMMENT ON COLUMN public.project_items.budget_min IS '總預算下限（quantity × 單價下限）';
COMMENT ON COLUMN public.project_items.budget_max IS '總預算上限（quantity × 單價上限）';

-- 驗證
SELECT 
    '✅ project_items 已新增 quantity 和 unit 欄位' as message,
    COUNT(*) as total_items,
    COUNT(quantity) as items_with_quantity,
    COUNT(unit) as items_with_unit
FROM public.project_items;
```

---

### **SQL 腳本 2：listings 表明確定義**

```sql
-- 檔案：docs/clarify-listings-pricing.sql

-- 添加註解，明確定義
COMMENT ON COLUMN public.listings.price_min IS '單價下限（每單位價格，例：$2,500/坪、$8,000/組）';
COMMENT ON COLUMN public.listings.price_max IS '單價上限（每單位價格，例：$3,500/坪、$12,000/組）';
COMMENT ON COLUMN public.listings.unit IS '計價單位（坪、組、公尺、m²、次、式等）';

-- 驗證現有數據（檢查是否需要數據遷移）
SELECT 
    category,
    subcategory,
    unit,
    MIN(price_min) as min_price,
    MAX(price_max) as max_price,
    COUNT(*) as count
FROM public.listings
WHERE status = 'active'
GROUP BY category, subcategory, unit
ORDER BY category, subcategory;

-- 如果發現數據不一致（有些是總價，有些是單價），需要人工檢查並修正
```

---

### **SQL 腳本 3：market_prices 表明確定義**

```sql
-- 檔案：docs/clarify-market-prices.sql

-- 添加註解，明確定義
COMMENT ON COLUMN public.market_prices.market_price IS '市場單價（每單位價格，排除離群值後的 price_min 均值 × 1.25）';

-- 驗證計算邏輯
SELECT 
    subcategory,
    market_price,
    sample_count,
    '註：此價格為單價（/坪、/組等），非總價' as note
FROM public.market_prices
WHERE subcategory LIKE 'home%'
LIMIT 5;
```

---

## 🔄 **數據遷移策略**

### **檢查現有 listings 數據**

```sql
-- 檢查：price_min/max 是否合理（用於判斷是單價還是總價）

-- 室內設計類（通常用「坪」計價）
SELECT 
    title,
    unit,
    price_min,
    price_max,
    CASE 
        WHEN unit = '坪' AND price_min > 10000 THEN '⚠️ 可能是總價'
        WHEN unit = '坪' AND price_min < 10000 THEN '✓ 可能是單價'
        ELSE '?'
    END as price_type_guess
FROM listings
WHERE subcategory = 'home__interior_design'
AND status = 'active';

-- 系統櫃（通常用「組」計價）
SELECT 
    title,
    unit,
    price_min,
    price_max,
    CASE 
        WHEN unit = '組' AND price_min > 30000 THEN '⚠️ 可能是總價'
        WHEN unit = '組' AND price_min < 30000 THEN '✓ 可能是單價'
        ELSE '?'
    END as price_type_guess
FROM listings
WHERE subcategory = 'home__system_cabinet'
AND status = 'active';
```

### **如果發現混亂**

```sql
-- 方案：重新初始化測試數據
-- 1. 清除現有測試數據
-- 2. 修改 generate-test-data-100experts.js，確保 price_min/max 都是單價
-- 3. 重新生成測試數據
```

---

## 📱 **前端表單調整**

### **1. 發包商：項目表單（首頁）**

```html
<!-- 項目明細表單 -->
<div class="project-item-form">
  <label>項目名稱：
    <input type="text" name="item_name" value="室內設計" readonly>
  </label>
  
  <!-- 新增：數量和單位 -->
  <div class="quantity-unit-group">
    <label>數量：
      <input type="number" name="quantity" value="30" step="0.1" required>
    </label>
    <label>單位：
      <select name="unit" required>
        <option value="坪">坪</option>
        <option value="組">組</option>
        <option value="公尺">公尺</option>
        <option value="m²">m²</option>
        <option value="次">次</option>
        <option value="式">式</option>
      </select>
    </label>
  </div>
  
  <label>總預算：
    <div class="budget-range">
      <input type="number" name="budget_min" placeholder="70000">
      <span>~</span>
      <input type="number" name="budget_max" placeholder="90000">
    </div>
  </label>
  
  <!-- 即時計算：單價範圍 -->
  <div class="unit-price-hint">
    <span>💡 推算單價範圍：</span>
    <strong>$<span id="unitPriceMin">2333</span> - $<span id="unitPriceMax">3000</span> / 坪</strong>
  </div>
  
  <script>
    // 即時計算單價
    function updateUnitPrice() {
        const quantity = parseFloat($('[name="quantity"]').val()) || 1;
        const budgetMin = parseFloat($('[name="budget_min"]').val()) || 0;
        const budgetMax = parseFloat($('[name="budget_max"]').val()) || 0;
        
        const unitPriceMin = Math.round(budgetMin / quantity);
        const unitPriceMax = Math.round(budgetMax / quantity);
        
        $('#unitPriceMin').text(unitPriceMin.toLocaleString());
        $('#unitPriceMax').text(unitPriceMax.toLocaleString());
    }
    
    $('[name="quantity"], [name="budget_min"], [name="budget_max"]').on('input', updateUnitPrice);
  </script>
</div>
```

---

### **2. 承包商：報價表單（listing-form.html）**

```html
<!-- 報價表單 -->
<div class="listing-form">
  <label>服務名稱：
    <input type="text" name="title" placeholder="現代風格室內設計">
  </label>
  
  <label>計價單位：
    <select name="unit" required>
      <option value="坪">坪</option>
      <option value="組">組</option>
      <option value="公尺">公尺</option>
      <option value="m²">平方公尺</option>
      <option value="次">次</option>
      <option value="式">式</option>
    </select>
  </label>
  
  <label>單價範圍：
    <div class="price-range">
      <input type="number" name="price_min" placeholder="2500">
      <span>~</span>
      <input type="number" name="price_max" placeholder="3500">
      <span>元 / <span class="unit-label">坪</span></span>
    </div>
  </label>
  
  <!-- 範例計算 -->
  <div class="price-example">
    <span>💡 範例：</span>
    <span>30坪 × $<span id="exampleUnitPrice">3000</span>/坪 = $<span id="exampleTotal">90,000</span></span>
  </div>
  
  <div class="alert alert-info">
    <strong>重要</strong>：請填寫「單價」，系統會根據客戶的數量自動計算總價。
    例如：室內設計填「$2,500-3,500 / 坪」，而不是填固定總價。
  </div>
  
  <script>
    // 單位改變時更新標籤
    $('[name="unit"]').change(function() {
        $('.unit-label').text($(this).val());
    });
    
    // 即時計算範例
    $('[name="price_min"], [name="price_max"]').on('input', function() {
        const avgPrice = (parseFloat($('[name="price_min"]').val()) + 
                         parseFloat($('[name="price_max"]').val())) / 2;
        const exampleQty = 30;
        $('#exampleUnitPrice').text(Math.round(avgPrice).toLocaleString());
        $('#exampleTotal').text(Math.round(avgPrice * exampleQty).toLocaleString());
    });
  </script>
</div>
```

---

## 🎯 **總結**

### **明確定義**

| 資料表 | 欄位 | 定義 | 範例 |
|-------|------|------|------|
| **project_items** | quantity | 數量 | 30 |
| | unit | 單位 | 坪 |
| | budget_min/max | **總預算** | $70k-90k |
| **listings** | price_min/max | **單價** | $2.5k-3.5k/坪 |
| | unit | 單位 | 坪 |
| **market_prices** | market_price | **市場單價** | $2.8k/坪 |

### **媒合計算**

```
1. 檢查單位一致
2. 計算：專家單價 × 客戶數量 = 專家總價
3. 對比：專家總價 vs 客戶總預算
4. 評分：專家單價 vs 市場單價（偏差率）
```

---

## 📝 **下一步**

1. 建立 SQL 腳本（新增 quantity 和 unit 欄位）
2. 更新文檔註解（明確定義價格是單價）
3. 檢查現有測試數據（是否需要重新生成）
4. 更新 server.js 的媒合邏輯（加入單位檢查）

**這樣的邏輯是否正確？確認後我就開始建立 SQL 腳本！** 🎯
