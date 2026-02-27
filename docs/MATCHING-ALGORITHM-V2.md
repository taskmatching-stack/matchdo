# MatchDO 媒合演算法 V2.0

更新日期：2026-02-06  
狀態：已實作（含單價×數量、階梯定價）

---

## 📐 單價×數量與單位對應（媒合前必讀）

### 角色與欄位

| 角色 | 提供欄位 | 說明 |
|------|----------|------|
| **發包商** | 數量 `quantity`、單位 `unit`、總預算 `budget_min` / `budget_max` | 總預算為「總價」，不是單價 |
| **承包商** | 單價 `price_min` / `price_max` 或階梯 `price_tiers`、單位 `unit` | 報價為「每單位價格」 |

### 媒合計算邏輯

1. **單位一致**：`listing.unit === item.unit` 才進入媒合，否則排除。
2. **依發包數量取承包商單價**：  
   - 若承包商有 `price_tiers`，依發包商的 **數量** 落入哪一階，取該階的 `unit_price_min` / `unit_price_max`。  
   - 若無階梯，使用 `listing.price_min` / `listing.price_max`。
3. **承包商總價**：`專家單價 × 發包商數量`（用發包商的數量乘專家的單價，不是乘自己的總價）。
4. **過濾**：承包商總價（均）須落在發包商總預算 `[budget_min, budget_max]` 內。
5. **價格評分**：以「專家單價」與「市場單價」（`market_prices.market_price` 為單價）的偏差計算 40 分。

詳細表結構與階梯格式見：`docs/PRICING-UNIT-LOGIC.md`、`docs/add-listing-price-tiers.sql`。

---

## 📊 評分系統（總分 100）

### 評分三大維度

| 維度 | 預設比例 | 說明 |
|------|---------|------|
| 主分類匹配 | 10% | 確保大方向正確 |
| 子分類匹配 | 10% | 確保專業對口 |
| 價格合理度 | 40% | 師傅價格接近市場價 |
| 關鍵字相關度 | 40% | Tags 匹配需求描述 |

**⚙️ 比例可調整**：後台管理介面可針對不同領域調整四項比例（因應價差大的產業）

---

## 1️⃣ 主分類匹配（10分）

### 邏輯
```javascript
IF listing.category == project_item.category_name
  → 10 分
ELSE
  → 0 分
```

### 資料來源
- `listings.category` (TEXT) - 主分類 key（home, video, web, app, ai, marketing, design）
- `project_items.category_name` (TEXT) - 主分類 key

### 目的
- 確保大方向正確（居家不會媒合到網站開發）
- 允許跨子分類承接（設計師可以接裝潢）

---

## 2️⃣ 子分類匹配（10分）

### 邏輯
```javascript
IF listing.subcategory == project_item.subcategory
  → 10 分
ELSE
  → 0 分
```

### 資料來源
- `listings.subcategory` (TEXT) - 對應 `ai_subcategories.key`
- `project_items.subcategory` (TEXT) - 對應 `ai_subcategories.key`

### 前置條件
需執行 SQL 腳本：
- `docs/add-listing-subcategory.sql`
- `docs/add-project-items-subcategory.sql`

### 目的
- 提供專精度加分
- 避免分類不精準導致亂媒合

---

## 3️⃣ 價格合理度（40分）

### 步驟A：單位過濾（硬性條件）

**條件**：`listing.unit === item.unit`（單位一致才媒合；無單位時不依單位過濾）。

### 步驟B：依發包數量取得承包商單價（支援階梯定價）

**邏輯**：
```javascript
// 依「發包商數量」從承包商的 price_tiers 或 price_min/max 取得單價
resolved = resolveUnitPriceForQuantity(listing, item.quantity);
// resolved = { unit_price_min, unit_price_max }
```

- 若 `listing.price_tiers` 存在且有多階：依 `item.quantity` 落入的區間取該階的 `unit_price_min`、`unit_price_max`。
- 否則使用 `listing.price_min`、`listing.price_max`。

### 步驟C：價格過濾（硬性條件）

**計算承包商總價**（用發包數量 × 承包商單價）：
```javascript
expertTotalMin = resolved.unit_price_min * item.quantity;
expertTotalMax = resolved.unit_price_max * item.quantity;
expertAvgTotal = (expertTotalMin + expertTotalMax) / 2;
```

**過濾條件**：
```javascript
IF expertAvgTotal < item.budget_min OR expertAvgTotal > item.budget_max
  → 排除，不進入媒合
```

**說明**：發包商的 `budget_min` / `budget_max` 為總預算；承包商總價必須落在該範圍內。

---

### 步驟D：價格評分（查表，不即時運算）⭐

**說明**：`market_prices.market_price` 為**市場單價**（每單位）。與「專家單價」比較偏差後給 0～40 分。

**查詢市場價格表**：
```javascript
// 1. 先查詢是否啟用 tags 細分
const rule = await supabase
    .from('price_calculation_rules')
    .select('enable_tag_split, split_tags')
    .eq('subcategory', item.subcategory)
    .single();

let marketPrice;

// 2. 如果啟用 tags 細分，且專家有符合的 tag
if (rule?.enable_tag_split && rule.split_tags) {
    const matchedTag = listing.tags.find(t => rule.split_tags.includes(t));
    
    if (matchedTag) {
        // 查詢細分的市場價
        const { data } = await supabase
            .from('market_prices')
            .select('market_price')
            .eq('subcategory', item.subcategory)
            .contains('tag_filter', [matchedTag])
            .single();
        
        if (data) marketPrice = data.market_price;
    }
}

// 3. 否則使用預設的子分類市場價
if (!marketPrice) {
    const { data } = await supabase
        .from('market_prices')
        .select('market_price')
        .eq('subcategory', item.subcategory)
        .is('tag_filter', null)
        .single();
    
    marketPrice = data?.market_price;
}
```

**評分公式**（專家單價 vs 市場單價）：
```javascript
expertAvgUnitPrice = (resolved.unit_price_min + resolved.unit_price_max) / 2;
const deviation = Math.abs(expertAvgUnitPrice - marketPrice) / marketPrice;

// 偏差越小 = 分數越高
const priceScore = Math.round(40 * Math.max(0, 1 - deviation));

// 例如：
// 偏差 0%   → 40 分（完美符合市場價）
// 偏差 10%  → 36 分
// 偏差 25%  → 30 分
// 偏差 50%  → 20 分
// 偏差 100% → 0 分
```

**目的**：
- ✅ 即時媒合速度快（查表，不運算）
- ✅ 鼓勵合理報價（接近市場行情）
- ✅ 懲罰虛高報價（偏離市場太多）
- ✅ 也懲罰削價競爭（太低可能品質有問題）

---

### 步驟E：市場價格的計算與更新 ⭐ 新架構

**由管理員定期更新，寫入 `market_prices` 表**

#### 預設計算邏輯（按子分類）

```sql
-- SQL 函數：計算單一子分類的市場價
CREATE OR REPLACE FUNCTION calculate_market_price(target_subcategory TEXT)
RETURNS DECIMAL AS $$
DECLARE
    market_price DECIMAL;
BEGIN
    WITH prices AS (
        SELECT price_min
        FROM listings
        WHERE subcategory = target_subcategory
          AND status = 'active'
          AND price_min > 0
        ORDER BY price_min
    ),
    filtered AS (
        -- 排除前後 5% 離群值
        SELECT price_min,
               ROW_NUMBER() OVER () as rn,
               COUNT(*) OVER () as total
        FROM prices
    ),
    valid_prices AS (
        SELECT price_min
        FROM filtered
        WHERE rn > (total * 0.05)
          AND rn <= (total * 0.95)
    )
    SELECT ROUND(AVG(price_min) * 1.25, 0)
    INTO market_price
    FROM valid_prices;
    
    RETURN market_price;
END;
$$ LANGUAGE plpgsql;
```

#### Tags 細分計算（管理員啟用時）

```sql
-- 查詢指定 subcategory + tag 組合的市場價
CREATE OR REPLACE FUNCTION calculate_market_price_with_tag(
    target_subcategory TEXT,
    target_tag TEXT
)
RETURNS DECIMAL AS $$
DECLARE
    market_price DECIMAL;
BEGIN
    WITH prices AS (
        SELECT price_min
        FROM listings
        WHERE subcategory = target_subcategory
          AND target_tag = ANY(tags)  -- 包含該 tag
          AND status = 'active'
          AND price_min > 0
        ORDER BY price_min
    ),
    -- 後續邏輯同上...
    
    RETURN market_price;
END;
$$ LANGUAGE plpgsql;
```

---

---

## 4️⃣ 關鍵字相關度（40分）

### 計算方式

**分母計算**：
```javascript
// 該專案的總工項數（所有 project_items）
const totalProjectItems = await supabase
    .from('project_items')
    .select('id')
    .eq('project_id', project_id);

const denominator = totalProjectItems.length × 1.5;
const scorePerTag = 40 / denominator;
```

**匹配邏輯**（兩者皆計分，去重）：
1. **需求文字**：工項名稱＋描述 `itemText` 是否包含專家某個 tag。
2. **工項標籤**：`project_items.requirements.tags` 與專家 `listing.tags` 有交集的 tag 亦計入（與 my-projects／同步寫入的 TAGS 對齊）。

```javascript
const itemTags = item.requirements?.tags || [];
const itemText = `${item.item_name} ${item.item_description}`.toLowerCase();
const matchedKeywords = [];
for (const tag of listing.tags) {
    if (itemText.includes((tag||'').toLowerCase())) matchedKeywords.push(tag);
}
for (const t of itemTags) {
    if (listing.tags.some(lt => (lt||'').toLowerCase() === (t||'').toLowerCase()) && !matchedKeywords.includes(t))
        matchedKeywords.push(t);
}
const keywordScore = Math.min(40, Math.round(matchedKeywords.length * scorePerTag));
```

### 實際效果

**單項發包（1個工項）**：
- 分母 = 1 × 1.5 = 1.5
- 每個 tag = 26.67 分
- 匹配 2 個 tags → 53.33 分 → **上限 40 分**
- **結果**：容易滿分 ✅

**多項發包（6個工項）**：
- 分母 = 6 × 1.5 = 9
- 每個 tag = 4.44 分
- 匹配 9 個 tags 才滿分
- **結果**：統包需要高度相關才能高分 ✅

---

## ⚖️ 平衡性總評

### 發包商（客戶）角度 ✅

| 保護機制 | 評分 | 說明 |
|---------|------|------|
| 預算控制 | ⭐⭐⭐⭐⭐ | 價格過濾確保不超預算 |
| 品質保障 | ⭐⭐⭐⭐ | 市場價參考避免過低報價 |
| 專業對口 | ⭐⭐⭐⭐⭐ | 子分類+關鍵字雙重確認 |
| 選擇多元 | ⭐⭐⭐ | 可能過濾掉部分優質選項 |

---

### 承包商（專家）角度 ✅

| 保護機制 | 評分 | 說明 |
|---------|------|------|
| 報價彈性 | ⭐⭐⭐⭐ | 用均價不用上限，保留空間 |
| 公平競爭 | ⭐⭐⭐⭐⭐ | 單項vs統包自動平衡 |
| 合理回報 | ⭐⭐⭐⭐ | 接近市場價得高分 |
| 接案機會 | ⭐⭐⭐⭐ | Tags多有優勢但不絕對 |

---

## 💾 資料表設計

### 1. **市場價格表**（預先計算，快速查詢）

```sql
CREATE TABLE public.market_prices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subcategory TEXT NOT NULL,              -- 子分類 key
    tag_filter TEXT[],                      -- 標籤過濾（選填，用於細分）
    market_price DECIMAL(10,2) NOT NULL,    -- 市場價（底價均值 × 1.25）
    avg_price_min DECIMAL(10,2),            -- 平均底價
    avg_price_max DECIMAL(10,2),            -- 平均上限價
    median_price DECIMAL(10,2),             -- 中位數價格
    sample_count INT,                       -- 樣本數量
    last_updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID,
    UNIQUE(subcategory, tag_filter)         -- 子分類 + tags 組合唯一
);
```

**重要**：`market_price` 為**市場單價**（每單位），與 `listings.price_min/max`、`price_tiers[].unit_price_min/max` 同為單價，供價格評分使用。

**資料範例：**
```javascript
// 預設：只用子分類（單位：坪時，即 元/坪）
{ subcategory: 'home__interior_design', tag_filter: null, market_price: 2800, sample_count: 45 }

// 管理員啟用 tags 細分後
{ subcategory: 'home__interior_design', tag_filter: ['現代風格'], market_price: 3200, sample_count: 12 }
```

---

### 2. **價格計算規則表**（管理員控制）

```sql
CREATE TABLE public.price_calculation_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subcategory TEXT NOT NULL UNIQUE,       -- 子分類
    enable_tag_split BOOLEAN DEFAULT false, -- 是否啟用 tag 細分
    split_tags TEXT[],                      -- 要細分的 tags
    min_sample_size INT DEFAULT 5,          -- 最小樣本數（少於此數不細分）
    auto_update_enabled BOOLEAN DEFAULT true,     -- 是否自動更新
    auto_update_frequency TEXT DEFAULT 'daily',   -- daily/weekly/monthly
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**說明**：
- 管理員發現「室內設計中，豪宅的價位明顯高於一般住宅」
- 到後台啟用：`enable_tag_split = true, split_tags = ['豪宅', '現代風格', '日式風格']`
- 系統會分別計算這些 tags 的市場價

---

### 3. **價格趨勢記錄表**（歷史追蹤）

```sql
CREATE TABLE public.price_trends (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subcategory TEXT NOT NULL,
    tag_filter TEXT[],
    market_price DECIMAL(10,2),
    sample_count INT,
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    INDEX idx_trends_subcategory_date (subcategory, recorded_at DESC)
);
```

**用途**：
- 記錄每次更新的歷史
- 後台可顯示價格趨勢圖表
- 分析市場變化

---

## 🔧 需要實作的功能

### 1. 市場價格自動計算（SQL Function）

**函數**：`update_market_prices()`
- 掃描所有子分類
- 計算市場價（排除離群值，底價 × 1.25）
- 寫入 `market_prices` 表
- 記錄到 `price_trends` 表

---

### 2. 後台管理介面

#### **介面 A：市場價格管理** (`admin/market-prices.html`)

**功能**：
- 查看所有子分類的市場價
- 手動觸發更新（全部 / 單一子分類）
- 啟用/停用 tags 細分
- 設定細分的 tags 清單
- 查看價格趨勢圖表

#### **介面 B：媒合評分設定** (`admin/matching-config.html`)

**功能**：
- 針對每個「子分類」設定評分比例：
  - 主分類匹配比例（預設 10%）
  - 子分類匹配比例（預設 10%）
  - 價格合理度比例（預設 40%）
  - 關鍵字相關度比例（預設 40%）
- 設定價格過濾寬容度（預設 0%，可調整到 ±20%）

**資料表**：
```sql
CREATE TABLE matching_config (
    subcategory TEXT PRIMARY KEY,
    category_weight DECIMAL(3,2) DEFAULT 0.10,
    subcategory_weight DECIMAL(3,2) DEFAULT 0.10,
    price_weight DECIMAL(3,2) DEFAULT 0.40,
    keyword_weight DECIMAL(3,2) DEFAULT 0.40,
    price_tolerance DECIMAL(3,2) DEFAULT 0.00,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 3. 表單提醒文字

**專家報價表單** (`expert/listing-form.html`)：

在「價格上限」欄位下方加入提醒：
```html
<div class="alert alert-warning mt-2">
    <i class="fas fa-exclamation-triangle me-2"></i>
    <strong>提醒</strong>：報價上限不要填過高，會影響媒合分數。
    建議填寫「實際可能成交的最高價」，而非「天花板價格」。
</div>
```

---

### 3. 預媒合建議功能（媒合分數分佈）⭐ 新增

**客戶專案詳情頁** (`client/project-detail.html`)：

在預媒合結果中新增「**媒合分數分佈圖**」：

```
📊 媒合分數分佈

您目前的預算：$50,000 - $80,000
媒合到的專家分數分佈：

80-100分（高度匹配）   ▓▓░░░░░░░░  2 位 (10%)
60-79分（良好匹配）    ▓▓▓▓░░░░░░  4 位 (20%)
40-59分（基本匹配）    ▓▓▓▓▓▓░░░░  6 位 (30%)
20-39分（低度匹配）    ▓▓▓▓▓▓▓▓░░  8 位 (40%)

💡 建議：調整預算至 $60,000 - $100,000
   → 可增加 5 位高品質專家（80分以上）
   → 整體匹配度提升至 65%
```

**說明**：
- 讓發包商清楚看到「調高一點預算，能得到更好的選擇」
- 不強迫調整，但提供數據參考
- 在許可範圍內引導合理預算

---

## 🔄 市場價格更新機制

### 更新方式

#### **方式 1：定期自動更新**（Supabase Cron）
```sql
SELECT cron.schedule(
    'update-market-prices',
    '0 3 * * *',  -- 每天凌晨 3:00
    $$ SELECT update_market_prices(); $$
);
```

#### **方式 2：手動更新**（管理員操作）
- API：`POST /api/admin/update-market-prices`
- 後台介面點擊「立即更新」按鈕
- 可選擇更新全部或單一子分類

---

### 更新流程

1. **掃描所有子分類**
2. **計算市場價**（排除離群值，底價均值 × 1.25）
3. **寫入 `market_prices` 表**
4. **記錄到 `price_trends` 表**（保留歷史）
5. **通知管理員**（更新完成）

---

## 📈 後台功能預覽

### 市場價格管理頁面

```
┌──────────────────────────────────────────────┐
│ 📊 市場價格管理                               │
├──────────────────────────────────────────────┤
│                                              │
│ 子分類：[室內設計 ▼]                         │
│                                              │
│ 📍 預設市場價（全體）                         │
│    當前：$75,000                             │
│    樣本：45 位專家                           │
│    更新：2026-02-06 03:00                    │
│                                              │
│ ☑ 啟用 Tags 細分計算                         │
│                                              │
│ 📍 細分市場價                                │
│ ┌────────────────────────────────────┐      │
│ │ Tag         市場價      樣本   [更新] │      │
│ ├────────────────────────────────────┤      │
│ │ 現代風格    $85,000    12位   [✓]   │      │
│ │ 日式風格    $70,000     8位   [✓]   │      │
│ │ 豪宅        $150,000    5位   [✓]   │      │
│ │ 小坪數      ⚠️ 樣本不足（僅3位）     │      │
│ └────────────────────────────────────┘      │
│                                              │
│ [+ 新增細分 Tag] [立即更新全部] [查看趨勢]   │
│                                              │
│ 📈 價格趨勢（近 6 個月）                      │
│ $85k ┤     ╱╲                                │
│ $80k ┤    ╱  ╲                               │
│ $75k ┤───╱    ╲──                            │
│ $70k ┤           ╲                           │
│      └─────────────────                      │
│       01  02  03  04  05  06                 │
└──────────────────────────────────────────────┘
```

---

## 🎯 總結

這個架構的優勢：
- ✅ **效能優化**：媒合時查表（毫秒級），不即時運算
- ✅ **彈性調整**：管理員可針對特定子分類啟用 tags 細分
- ✅ **數據驅動**：價格趨勢可視化，輔助決策
- ✅ **可擴充性**：未來可加入更多維度（地區、經驗年資等）

**架構完整，既兼顧效能，又保留管理彈性！**

---

## 📎 相關文件

| 文件 | 說明 |
|------|------|
| `docs/PRICING-UNIT-LOGIC.md` | 單價×數量、總預算定義；發包/承包商欄位與媒合流程 |
| `docs/add-listing-price-tiers.sql` | 階梯定價 `price_tiers` 欄位格式與範例 |
| `docs/FORM-SQL-AND-UI-SUMMARY.md` | 發包商／承包商表單與 SQL 對應摘要 |
| `docs/HOW-TO-TEST-AND-NEXT.md` | 測試步驟與接下來要做什麼 |
| `docs/matchdo-todo.md` | 整體進度與待辦清單 |
