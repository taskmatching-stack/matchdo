# 預算偏高/偏低計算邏輯

## ⚠️ 核心問題：廠商報價上限通常虛高

**問題**：廠商的報價上限經常寫得很高（例如：10萬～100萬），導致：
- 用 `AVG((price_min + price_max) / 2)` 計算會嚴重失真
- 平均值會是 55 萬，完全不準確

**解決方案**：使用更可靠的市場價格指標

---

## 💡 計算方式建議

### 方法 1A：使用「實際成交價估算」（最推薦）⭐⭐⭐

廠商的實際成交價通常在**底價 + 20~30%**之間：

```javascript
// 1. 計算「實際成交價」= price_min * 1.25
SELECT AVG(price_min * 1.25) as avg_market_price
FROM listings
WHERE category = '居家'
  AND status = 'active';

// 或者排除離群值後再計算
SELECT AVG(price_min * 1.25) as avg_market_price
FROM (
    SELECT price_min 
    FROM listings
    WHERE category = '居家' AND status = 'active'
      AND price_min BETWEEN 
          (SELECT PERCENTILE_CONT(0.05) WITHIN GROUP (ORDER BY price_min) FROM listings WHERE category = '居家')
          AND
          (SELECT PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY price_min) FROM listings WHERE category = '居家')
) AS filtered;

// 優點：
// - 更接近真實成交價（底價通常是談判起點）
// - 排除了極端值（最低5%和最高5%）
// - 兼顧廠商利潤空間和客戶預算

// 缺點：
// - 需要更複雜的 SQL 查詢
// - 1.25 倍數需要根據產業調整
```

### 方法 1B：使用「四分位距過濾」（IQR Method）⭐⭐

統計學標準方法，自動排除離群值：

```javascript
// PostgreSQL 使用四分位距過濾離群值
WITH stats AS (
    SELECT 
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY price_min) as q1,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY price_min) as q3
    FROM listings
    WHERE category = '居家' AND status = 'active'
),
bounds AS (
    SELECT 
        q1,
        q3,
        q3 - q1 as iqr,
        q1 - 1.5 * (q3 - q1) as lower_bound,
        q3 + 1.5 * (q3 - q1) as upper_bound
    FROM stats
)
SELECT AVG(price_min * 1.25) as avg_market_price
FROM listings, bounds
WHERE category = '居家' 
  AND status = 'active'
  AND price_min BETWEEN lower_bound AND upper_bound;

// 優點：
// - 統計學標準方法，科學嚴謹
// - 自動適應數據分布
// - 有效排除極端異常值

// 缺點：
// - SQL 查詢較複雜
// - 需要足夠數據量（建議至少20筆）
```

### 方法 1C：簡化版「百分位過濾 + 底價加成」⭐⭐

排除極端5%後，用底價+25%計算：

```javascript
// 簡化版：排除前後5%的極端值
WITH filtered AS (
    SELECT price_min
    FROM listings
    WHERE category = '居家' AND status = 'active'
      AND price_min >= (
          SELECT PERCENTILE_CONT(0.05) WITHIN GROUP (ORDER BY price_min) 
          FROM listings WHERE category = '居家' AND status = 'active'
      )
      AND price_min <= (
          SELECT PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY price_min)
          FROM listings WHERE category = '居家' AND status = 'active'
      )
)
SELECT AVG(price_min * 1.25) as avg_market_price
FROM filtered;

// 或更簡單的 JavaScript 實現：
const validPrices = listings
    .map(l => l.price_min)
    .sort((a, b) => a - b);

// 排除前後5%
const startIdx = Math.floor(validPrices.length * 0.05);
const endIdx = Math.ceil(validPrices.length * 0.95);
const filteredPrices = validPrices.slice(startIdx, endIdx);

// 計算平均並加成25%
const avgMarketPrice = filteredPrices.reduce((sum, p) => sum + p * 1.25, 0) / filteredPrices.length;

// 優點：
// - 邏輯清晰，易於理解
// - JavaScript 實現簡單
// - 排除極端值，加成合理

// 缺點：
// - 固定5%可能不適合所有情況
// - 1.25倍數需要根據產業調整
```

### 方法 1D：使用「中位數」⭐

中位數天然抗離群值：

```javascript
// PostgreSQL 中位數查詢
SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_min * 1.25) as median_price
FROM listings
WHERE category = '居家' AND status = 'active';

// 優點：
// - 不受極端值影響（天然抗離群值）
// - 統計上更穩健
// - 查詢簡單

// 缺點：
// - 可能不如平均數準確（如果數據分布正常）
```

---

### 💡 推薦方案：方法 1A 或 1C

**生產環境推薦使用「方法 1C」**：
1. 排除前後 5% 的極端值
2. 使用 `price_min * 1.25` 估算實際成交價
3. 計算平均值

**理由**：
- ✅ 科學合理：排除離群值
- ✅ 接近真實：底價+25%更接近實際成交價
- ✅ 實現簡單：JavaScript 代碼不複雜
- ✅ 效能好：不需要複雜的子查詢

---

### 🎯 不同產業的加成倍數建議

| 分類 | 加成倍數 | 說明 |
|-----|---------|------|
| 設計類 | 1.2 (20%) | 設計費用較透明 |
| 居家裝潢 | 1.25-1.3 (25-30%) | 材料+工錢，議價空間較大 |
| 技術服務 | 1.15-1.2 (15-20%) | 專業服務，價格較固定 |
| 清潔服務 | 1.1-1.15 (10-15%) | 標準化服務，價格透明 |

---

### 舊方法 1A（不推薦）：直接使用最低價格平均

```javascript
// ❌ 過於保守：沒有考慮實際成交價通常高於底價
SELECT AVG(price_min) as avg_market_price
FROM listings
WHERE category = '居家'
  AND status = 'active';

// 優點：
// - price_min 通常是廠商的真實底線，較為可靠
// - 不受虛高上限影響
// - 計算簡單

// 缺點：
// - 過於保守（偏低）
// - 實際成交價通常高於底價 20-30%
```

### 方法 1B：使用「中位數」而非「平均數」

中位數不受極端值影響：

```javascript
// PostgreSQL 中位數查詢
SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_min) as median_price
FROM listings
WHERE category = '居家' AND status = 'active';

// 優點：
// - 不受極端值（超高價或超低價）影響
// - 更能代表「典型」市場價格
// - 統計上更穩健

// 缺點：
// - 語法較複雜
// - 計算成本較高
```

### 方法 1C：過濾異常值後再計算平均

排除明顯不合理的高價：

```javascript
// 排除前 10% 的高價，避免虛高報價干擾
SELECT AVG(price_min) as avg_market_price
FROM (
    SELECT price_min 
    FROM listings
    WHERE category = '居家' AND status = 'active'
    ORDER BY price_min
    LIMIT (SELECT COUNT(*) * 0.9 FROM listings WHERE category = '居家')
) AS filtered;

// 或使用 PostgreSQL 百分位數過濾
SELECT AVG(price_min) as avg_market_price
FROM listings
WHERE category = '居家' 
  AND status = 'active'
  AND price_min <= (
      SELECT PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY price_min)
      FROM listings WHERE category = '居家' AND status = 'active'
  );

// 優點：
// - 過濾掉明顯的異常值
// - 平均值更貼近真實市場

// 缺點：
// - 查詢較複雜
// - 需要足夠數據量（至少 10+ 筆）
```

---

### 方法 1（舊版 - 不推薦）：使用價格區間平均

```javascript
// ❌ 不推薦：廠商上限通常虛高，會嚴重失真
SELECT AVG((price_min + price_max) / 2) as avg_price
FROM listings
WHERE category = '居家'
  AND status = 'active';

// 2. 計算用戶預算與市場均價的比率
const budgetRatio = userBudget / avgMarketPrice;

// 3. 判斷預算狀態
if (budgetRatio < 0.8) {
    status = 'low';      // 偏低：低於市場均價 20% 以上
    message = '預算偏低，建議提高以獲得更多回應';
} else if (budgetRatio > 1.2) {
    status = 'high';     // 偏高：高於市場均價 20% 以上
    message = '預算充足，預期獲得較多專家回應';
} else {
    status = 'normal';   // 正常：在市場均價 ±20% 範圍內
    message = '預算合理，符合市場行情';
}
```

**優點**：
- 客觀、有數據支撐
- 可以告訴用戶「您的預算比市場均價低 30%」
- 隨市場變化自動調整

**缺點**：
- 需要累積足夠的專家報價數據
- 新分類可能沒有足夠數據

---

### 方法 2：基於符合專家數量百分比

```javascript
// 1. 查詢符合預算的專家數量
const matchPercentage = (matchedExperts / totalExperts) * 100;

// 2. 根據符合百分比判斷
if (matchPercentage < 30) {
    status = 'low';      // 符合率 <30%：預算偏低
    message = '符合的專家較少（<30%），建議提高預算';
} else if (matchPercentage < 60) {
    status = 'normal';   // 符合率 30-60%：預算正常
    message = '符合的專家適中（30-60%）';
} else {
    status = 'high';     // 符合率 >60%：預算充足
    message = '符合的專家較多（>60%），預算充足';
}
```

**優點**：
- 簡單直觀
- 不需要市場平均價格數據
- 符合率直接反映預算競爭力

**缺點**：
- 無法告訴用戶具體偏高/偏低多少
- 只能說「符合專家多或少」

---

### 方法 3：混合模式（最佳方案）

```javascript
// 1. 先查詢市場平均價格
const avgMarketPrice = await getAvgMarketPrice(category, subcategory);

if (avgMarketPrice > 0) {
    // 有數據：使用方法 1（市場均價比較）
    const budgetRatio = userBudget / avgMarketPrice;
    
    if (budgetRatio < 0.8) {
        status = 'low';
        percentDiff = Math.round((1 - budgetRatio) * 100); // 低於幾 %
        message = `預算比市場均價低約 ${percentDiff}%，建議提高`;
    } else if (budgetRatio > 1.2) {
        status = 'high';
        percentDiff = Math.round((budgetRatio - 1) * 100); // 高於幾 %
        message = `預算比市場均價高約 ${percentDiff}%，預期獲得較多回應`;
    } else {
        status = 'normal';
        message = `預算在市場均價範圍內（±20%）`;
    }
} else {
    // 無數據：使用方法 2（符合率判斷）
    const matchPercentage = (matchedExperts / totalExperts) * 100;
    
    if (matchPercentage < 30) {
        status = 'low';
        message = `僅 ${matchPercentage}% 專家符合，建議提高預算`;
    } else if (matchPercentage < 60) {
        status = 'normal';
        message = `約 ${matchPercentage}% 專家符合，預算合理`;
    } else {
        status = 'high';
        message = `${matchPercentage}% 專家符合，預算充足`;
    }
}
```

**優點**：
- 有數據時使用精確的市場比較
- 無數據時退化為符合率判斷
- 兼顧準確性和可用性

---

## 📊 視覺化呈現建議

### 預算合理度顯示

```
┌─────────────────────────────────────┐
│  預算合理度：65%                     │
│  ████████████████░░░░░░░            │
│                                      │
│  ✅ 預算在市場均價範圍內             │
│  💰 市場平均：約 80,000 元           │
│  📊 您的預算：100,000 元（+25%）     │
└─────────────────────────────────────┘
```

### 狀態顏色

| 預算狀態 | 符合率 | 顏色 | 圖示 | 建議 |
|---------|--------|------|------|------|
| 偏低 | <30% | 🔴 紅色 | ⚠️ | 建議提高預算 20-30% |
| 正常 | 30-60% | 🟡 黃色 | ℹ️ | 預算合理 |
| 充足 | >60% | 🟢 綠色 | ✅ | 預算充足，預期獲得較多回應 |

---

## 🎯 實現優先級

**階段 1**（當前）：
- ✅ 使用模擬數據 + 固定市場均價
- ✅ 提供基本的偏高/偏低判斷

**階段 2**（有專家數據後）：
- [ ] 從 expert_listings 查詢真實專家數量
- [ ] 計算真實的市場平均價格
- [ ] 精確的價格區間重疊判斷

**階段 3**（優化）：
- [ ] 按地區、經驗分層統計均價
- [ ] 顯示價格分布圖表
- [ ] 提供更細緻的建議（例如：「提高 15% 可增加 20 位專家」）

---

## 💬 用戶友善提示語

**預算偏低時**：
```
⚠️ 您的預算比市場均價低約 30%

符合的專家較少（僅 15%），可能較難獲得回應。

建議：
- 將預算提高至 120,000 元（+20%）可增加符合專家至 40%
- 或縮小專案範圍以符合現有預算
```

**預算正常時**：
```
✅ 您的預算在市場行情範圍內

符合約 50% 的專家，預期可獲得 8-12 位專家回應。

建議：維持現有預算即可
```

**預算偏高時**：
```
💎 您的預算比市場均價高約 35%

符合 85% 的專家，預期獲得 15-20 位專家積極回應。

提示：充足的預算有助於吸引更多優質專家
```
