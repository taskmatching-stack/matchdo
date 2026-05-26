# 設計風向分析 — 可用時間與語意欄位（紀錄用）

更新：2026-05-21  
用途：日後做 **風向分析／趨勢報表** 時，從哪張表、哪個欄位取「時間軸」與「分析內容」。  
現況：設計風向與客製產品 **共用 `custom_products`**；尚無獨立 `design_intent_analyses` 表、尚無 `product_line` 正式區分（規劃見 `docs/design-lineage-and-design-direction-plan.md` §3）。

---

## 1. 主表：`custom_products`

每筆「我的設計」儲存後一列（含 `/custom-product.html` 與 `/remake-product.html` 儲存結果）。

### 1.1 時間欄位（風向分析可直接用）

| 欄位 | 型別 | 語意 | 建議用途 |
|------|------|------|----------|
| **`created_at`** | `timestamptz` | 首次寫入 DB（使用者按儲存） | **主時間軸**：依日／週／月聚合作品量、風向樣本數 |
| **`updated_at`** | `timestamptz` | 最後更新（編輯、狀態、開放搜尋等） | 活躍度、二次修改；不等於「重新分析」 |
| **`semantics_generated_at`** | `timestamptz` | AI 語意／分維標籤寫入完成時刻 | **分析完成時間**；通常略晚於 `created_at`（生圖後背景 job） |

**沒有**專用欄位：`design_time`、`designed_at`、`analysis_started_at`。  
「只在頁面生圖、尚未儲存」**不會**進表。

Migration：`semantics_generated_at` 需執行 `docs/add-custom-products-semantics.sql`（建議一併跑 `add-custom-products-semantics-taxonomy.sql`）。

### 1.2 分析內容欄位（非時間，但風向分析必備）

| 欄位 | 說明 |
|------|------|
| `category` / `subcategory_key` | 主／子分類 key（設計風向目前仍走 `remake_categories` 對應的 key） |
| `generation_prompt` | 使用者描述（有 migration 時為獨立欄；否則可能在 `analysis_json`） |
| `ai_tags` | 合併標籤陣列 |
| `ai_tags_by_dimension` | 分維 JSON：`style`, `material`, `color`, `structure`, … |
| `prompt_semantics_json` | 提示詞語意 |
| `image_semantics_json` | 生成圖語意 |
| `analysis_json` | 其它 JSON；舊註解內 `production_time` 為**預估製作工期**，勿當設計時間 |

### 1.3 地區／血緣（內部分析用，API 已 strip 不給一般前端）

執行 `docs/add-custom-products-designer-region.sql`、`add-custom-products-data-lineage.sql` 後才有。

| 欄位 | 說明 |
|------|------|
| `designer_country_code` | 儲存當下由 IP 推斷之 ISO2（如 TW） |
| `designer_region_codes` | 區域代碼陣列（目前多為空或國家級） |
| `designer_ui_locale` | 儲存當下介面語系 |
| `is_vendor_self_serve` | 廠商自引素材生圖（**勿對外展示**；分析時可排除） |
| `product_line` | **規劃中** `custom` \| `design_direction`；上線前可用 `categorySource=remake` 路徑或日後 migration 區分 |

程式：`lib/custom-product-lineage.js` → `stripInternalCustomProductFields()` 會移除血緣／地區欄位再回傳前台；**後台／報表應直接查 Supabase**。

---

## 2. 事件表：`visual_semantics_events`（細粒度時間軸）

每次 Gemini 語意解析一筆；`server.js` → `recordVisualSemanticsEvent()`。

| 欄位 | 說明 |
|------|------|
| `created_at` | **該次解析**發生時間 |
| `source_type` | 如 `custom_product` |
| `source_id` | 對應 `custom_products.id` |
| `semantics_kind` | 如 `generated_image`、`prompt` |
| `ai_tags`、`semantics_json` | 當次解析結果快照 |

Migration：`docs/add-visual-semantics-events.sql`

**與 `semantics_generated_at` 差異**：產品表上為「最後一次整包標籤更新時間」；事件表可區分「先解析圖、再解析 prompt」兩筆時間（若兩者都有）。

---

## 3. API 與前台

| 用途 | 端點 | 時間欄位 |
|------|------|----------|
| 列表（我的設計） | `GET /api/custom-products` | 回傳 `created_at`、`updated_at`；有欄位則含 `semantics_generated_at` |
| 單筆 | `GET /api/custom-products/:id` | 同上 |
| 前台列表 UI | `client/my-custom-products.html` | **僅顯示** `created_at` 日期（未顯示分析完成時間） |

語意寫入：`enrichCustomProductSemantics()`（生圖／儲存後觸發）→ 更新 `semantics_generated_at` + 寫 `visual_semantics_events`。

---

## 4. 風向分析建議查詢（範例）

### 4.1 依建立日統計樣本數

```sql
SELECT date_trunc('day', created_at AT TIME ZONE 'Asia/Taipei') AS day,
       COUNT(*) AS n
FROM custom_products
WHERE created_at >= now() - interval '90 days'
GROUP BY 1
ORDER BY 1;
```

### 4.2 有語意標籤、且分析已完成

```sql
SELECT id, created_at, semantics_generated_at,
       ai_tags_by_dimension->>'style' AS style_dim
FROM custom_products
WHERE semantics_generated_at IS NOT NULL
  AND ai_tags_by_dimension IS NOT NULL;
```

### 4.3 分析延遲（儲存 → 語意完成）

```sql
SELECT id,
       created_at,
       semantics_generated_at,
       semantics_generated_at - created_at AS analysis_lag
FROM custom_products
WHERE semantics_generated_at IS NOT NULL
ORDER BY analysis_lag DESC
LIMIT 100;
```

### 4.4 依國家聚合（需 designer-region migration）

```sql
SELECT designer_country_code, COUNT(*) AS n
FROM custom_products
WHERE designer_country_code IS NOT NULL
GROUP BY 1
ORDER BY n DESC;
```

### 4.5 事件級時間軸（單一作品）

```sql
SELECT created_at, semantics_kind, ai_tags
FROM visual_semantics_events
WHERE source_type = 'custom_product'
  AND source_id = '00000000-0000-0000-0000-000000000000'::uuid
ORDER BY created_at;
```

---

## 5. 上線風向分析前檢查清單

- [ ] Supabase 已執行：`add-custom-products-semantics.sql`、`add-custom-products-semantics-taxonomy.sql`
- [ ] （可選）`add-visual-semantics-events.sql`、`add-custom-products-designer-region.sql`、`add-custom-products-data-lineage.sql`
- [ ] （規劃）`product_line` migration，區分 `custom` vs `design_direction`
- [ ] 報表排除測試帳號／`is_vendor_self_serve = true`（若要看「一般訂製者」風向）

---

## 6. 相關文件

| 文件 | 內容 |
|------|------|
| `docs/custom-products-db-columns.md` | 全欄位清單 |
| `docs/design-lineage-and-design-direction-plan.md` | 設計風向產品線、血緣、D0–D7 |
| `docs/design-signals-tiered-access-plan.md` | **待開發**：Design Signals 付費牆、聚合表、DS-0～DS-7 |
| `docs/membership-tiers-and-points-plan.md` | 0／300／900／1800 方案對照 |
| `docs/matchdo-todo.md` | 「規劃：再製→設計風向」與 Design Signals 待辦 |

---

**備註**：文案已改「設計風向」，資料仍寫 `custom_products` + `remake_categories`；風向分析在 `product_line` 上線前，需以分類 key、入口路徑或日後 backfill 區分產品線。
