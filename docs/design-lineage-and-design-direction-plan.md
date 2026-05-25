# 訂製生圖資料血緣 × 再製改設計風向（規劃）

更新：2026-05-20  
主待辦同步：`docs/matchdo-todo.md`「規劃：資料血緣」「規劃：再製→設計風向」

---

## 一、問題與目標

### 1.1 現況（已有）

| 資料 | 欄位／機制 |
|------|------------|
| 訂製生圖列 | `custom_products`：`owner_id`、`category`／`subcategory_key`、`generation_prompt`、`reference_sources`（JSONB） |
| 語意／標籤 | `ai_tags`、`image_semantics_json`、`prompt_semantics_json`（需 `add-custom-products-semantics.sql`）；儲存後 `enrichCustomProductSemantics()` 非同步寫入 |
| 事件表 | `visual_semantics_events`（`source_type=custom_product`） |
| 素材 | `vendor_assets.manufacturer_id` → `manufacturers.user_id` |

### 1.2 缺口

- **無法在查詢時一眼排除「廠商用自己帳號生圖、且引用自己素材」**，與真實訂製者行為混在一起，不利流行趨勢／意圖分析。
- **再製方案**與訂製並列，但產品方向要改為 **設計風向（設計意圖分析）**，需整線重定位。

### 1.3 目標

1. 每筆生圖儲存時**自動判定**生圖帳號 vs 引用素材所屬廠商帳號是否相同，**寫入可查欄位**（分析、報表、靈感牆統計可 `WHERE` 過濾）。
2. 保留既有 tags／分類；語意事件表同步帶血緣旗標。
3. 再製線改為設計風向線（意圖分析為主，非「改裝分類」語意）。

---

## 二、資料血緣：建議作法

### 2.1 判定規則（後端單一真相，不信任前端）

儲存 `POST /api/custom-products`（與自動儲存路徑）時，以 JWT 的 `user.id` 為 **生圖帳號** `generator_user_id`：

```
generator_manufacturer_id = manufacturers.id WHERE user_id = generator_user_id LIMIT 1

對 reference_sources 每一項（有 manufacturer_id）：
  查 manufacturers.user_id → manufacturer_user_id
  若 manufacturer_user_id === generator_user_id → 該項 is_same_account_as_generator = true

has_self_vendor_reference = 任一引用項 is_same_account_as_generator

is_vendor_self_serve =
  generator_manufacturer_id IS NOT NULL
  AND has_self_vendor_reference
```

| 情境 | `is_vendor_self_serve` | 分析建議 |
|------|------------------------|----------|
| 一般訂製者，引用 A 廠素材 | false | 保留 |
| 廠商帳號，引用**自己**素材（素材庫） | true | 排除或另桶統計 |
| 廠商帳號，引用**他人**素材 | false | 保留（跨廠參考） |
| 廠商帳號，僅上傳參考圖、未選素材庫 | **false** | 保留（不當廠商自產） |
| 非廠商、無引用 | false | 保留 |

**前端**：不顯示、不提示血緣狀態（避免廠商用其他帳號規避）；`GET/POST` 回傳已 strip 內部欄位。

**設計圖分維標籤**（2026-05-20 已實作）：`ai_tags_by_dimension` — style, material, color, structure, features, patterns, craftsmanship, form, mood, use_case, category。見 `add-custom-products-semantics-taxonomy.sql`、`lib/visual-semantics.js` v3。

### 2.2 建議 schema（`docs/add-custom-products-data-lineage.sql` 待新增）

```sql
ALTER TABLE public.custom_products
  ADD COLUMN IF NOT EXISTS generator_manufacturer_id uuid REFERENCES public.manufacturers(id),
  ADD COLUMN IF NOT EXISTS has_self_vendor_reference boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_vendor_self_serve boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_lineage_json jsonb DEFAULT NULL;

COMMENT ON COLUMN public.custom_products.is_vendor_self_serve IS
  '生圖者為廠商且（引用自己素材或未引用他人素材）；分析訂製者意圖時建議排除';

CREATE INDEX IF NOT EXISTS idx_custom_products_vendor_self_serve
  ON public.custom_products (is_vendor_self_serve) WHERE is_vendor_self_serve = true;
```

**`data_lineage_json` 範例**（便於除錯與擴充）：

```json
{
  "generator_user_id": "uuid",
  "generator_manufacturer_id": "uuid|null",
  "computed_at": "2026-05-20T12:00:00Z",
  "reference_flags": [
    {
      "vendor_asset_id": "uuid",
      "manufacturer_id": "uuid",
      "manufacturer_user_id": "uuid",
      "is_same_account_as_generator": true
    }
  ]
}
```

**`reference_sources` 每項**（寫入時由後端補齊，前端可只送既有欄位）：

- 新增：`manufacturer_user_id`、`is_same_account_as_generator`

### 2.3 程式改動點

| 順序 | 項目 |
|------|------|
| 1 | 新增 SQL migration |
| 2 | `server.js`：`computeCustomProductLineage(userId, referenceSources)` → 併入 insertPayload |
| 3 | `enrichCustomProductSemantics` / `recordVisualSemanticsEvent` 帶 `is_vendor_self_serve`、`generator_manufacturer_id`（事件表可加欄或放 `semantics_json._lineage`） |
| 4 | `GET /api/media-wall`、首頁統計、後台報表：可選參數 `exclude_vendor_self_serve=true`（預設對外趨勢為 true） |
| 5 | 一次性 backfill：`owner_id` + `reference_sources` + `manufacturers` JOIN 更新舊列 |
| 6 | 文件：`custom-products-db-columns.md`、我的數位資產詳情可顯示「廠商自產」標籤（僅本人可見，可選） |

### 2.4 分析查詢範例

```sql
-- 訂製者意圖／標籤趨勢（排除廠商自產）
SELECT unnest(ai_tags) AS tag, count(*)
FROM custom_products
WHERE is_vendor_self_serve IS NOT TRUE
  AND ai_tags IS NOT NULL
GROUP BY 1;
```

---

## 三、再製方案 → 設計風向（設計意圖分析）

### 3.1 產品定位

| 現況 | 目標 |
|------|------|
| 再製方案：改裝分類 + 必傳參考圖 + `categorySource: 'remake'` | **設計風向**：從圖＋描述做 **設計意圖／風格方向** 分析，輸出結構化意圖（可再接生圖） |
| 後台 `remake_categories` | 改為 **設計風向分類**（或併入訂製分類的「意圖維度」，二擇一，見下） |
| 路徑 `/remake/`、`remake-product.html` | 過渡期保留 URL + 301／文案改「設計風向」；長期可 `/design-direction/` |

### 3.2 技術選項（待你拍板）

**方案 A（建議）：同一 `custom_products` 表，加產品線欄位**

- `product_line`：`custom` | `design_direction`（舊資料 `remake` 遷移為 `design_direction`）
- 分類：新表 `design_direction_categories` 或 **沿用** `remake_categories` 僅改名＋改 prompt 語意（少 migration）
- API：`categorySource: 'design_direction'`，`buildPromptFromDesignDirectionKeys()`

**方案 B：獨立意圖分析表**

- `design_intent_analyses`（圖、文字、結構化 JSON、owner_id）
- 生圖仍寫 `custom_products`，FK 指向分析列  
- 適合「只分析不生圖」流程，實作量較大

### 3.3 實作階段（寫入待辦）

| 階段 | 內容 |
|------|------|
| **D0 規格** | 確認方案 A/B、導覽文案、是否保留「再製」字樣 |
| **D1 資料** | `product_line` migration；`remake` → `design_direction` 資料修正 |
| **D2 後台** | 再製分類管理改「設計風向」；prompt 模板改意圖分析用語 |
| **D3 API** | `analyze-design-intent`（或擴充 `analyze-custom-product`）；生圖 API 支援 `design_direction` |
| **D4 前端** | `remake-product.js` → 設計風向 UI（分析結果區塊、標籤展示）；`/remake/` 首頁文案 |
| **D5 媒體牆／列表** | 篩選 `product_line`；靈感牆是否單獨比例（可沿用舊「再製比例」規劃） |
| **D6 多語系／SEO** | nav、locales、sitemap 路徑 |

### 3.4 與資料血緣的關係

設計風向線若仍會生圖並寫入 `custom_products`，**同樣套用 §2 血緣判定**；`product_line='design_direction'` 與 `is_vendor_self_serve` 可交叉篩選（例如：只看非廠商自產的設計風向樣本）。

---

## 四、設計者國家／地區（規劃）

### 4.1 現況：能拿到什麼、不能當什麼

| 來源 | 現有欄位 | 可否代表「設計者」地區 |
|------|----------|------------------------|
| **圖庫地區篩選** | `manufacturer_location`（廠商接單地） | ❌ 是**廠商**地區，不是下單設計者 |
| **`users.location`** | 自由文字 | △ 若有填可解析，多數訂製者可能空白 |
| **`manufacturers.location`** | 廠商資料 | △ 僅當帳號同時是廠商；且是**接單**地，非設計者居住地 |
| **`service_areas` 樹** | `code`（TW、US-CA、TW-TPE…） | ✅ 最適合當**標準地理維度**（已有三層國家／州／城市） |
| **前台 `lang`** | zh-TW / en（localStorage／URL） | △ 僅**語系偏好**，≠ 國家（在台也用 en） |
| **`contact_info.company_address`** | 自由文字 | △ 可離線解析國家，不穩定 |
| **電話國碼** | `users.phone`、contact | △ +886 等可推 TW，常未填 |

結論：**可以區分，但需新增「設計者地區」專用欄位＋解析規則**；不要只靠語系或廠商 location。

### 4.2 已採用策略（2026-05-20：**僅 IP**，不強制填寫）

儲存 `custom_products` 時，`resolveDesignerRegionFromRequest(req)` 寫入**快照**：

1. **CDN 標頭**：`CF-IPCountry`、`X-AppEngine-Country`、`CloudFront-Viewer-Country` 等  
2. **後備**：`geoip-lite` 解析 `X-Forwarded-For` 第一跳（Cloud Run 直連時常用）  
3. 無法推斷 → `designer_region_source=unknown`  
4. 另記 `designer_ui_locale`（請求 body 的 `ui_locale`／`lang`），**不作國家**

**不實作**：強制表單、使用者宣告地區（除非你日後改需求）。

| 欄位（建議加在 `custom_products`） | 型別 | 說明 |
|-----------------------------------|------|------|
| `designer_country_code` | text | 國家根節點，對齊 `service_areas`（如 `TW`、`US`、`GB`） |
| `designer_region_codes` | text[] | 可多選城市／州（如 `TW-TPE`、`US-CA`） |
| `designer_region_source` | text | `user_declared` \| `vendor_profile` \| `locale_hint` \| `ip` \| `unknown` |
| `designer_ui_locale` | text | 儲存當下 `lang`（分析用，不作國家） |

**使用者主檔（建議加在 `public.users` 或新表 `user_region_preferences`）**：

| 欄位 | 說明 |
|------|------|
| `region_country_code` | 必填或首次生圖前引導選：國家 |
| `region_codes` | 選填：城市／州（與圖庫 `service_areas` 同 code） |

UI：重用圖庫／廠商後台已有的 **service_areas 選擇器**（`GET /api/service-areas`），放在「個人設定」或首次儲存設計圖前輕量詢問（可跳過 → `unknown`）。

### 4.3 與血緣、分維標籤的交叉分析

```sql
-- 例：台灣訂製者（排除廠商自產）的風格標籤分布
SELECT unnest(ai_tags_by_dimension->'style') AS tag, count(*)
FROM custom_products
WHERE designer_country_code = 'TW'
  AND is_vendor_self_serve IS NOT TRUE
  AND ai_tags_by_dimension IS NOT NULL
GROUP BY 1;
```

- **不要**在前台顯示「你的地區已記錄」或血緣狀態（與 `is_vendor_self_serve` 相同，避免規避）。
- API 回傳設計列表時 **strip** `designer_*` 內部分析欄位（僅後台／SQL 報表可見）。

### 4.4 實作階段（待辦）

| 階段 | 內容 |
|------|------|
| **R0** | 規格：是否強制填地區、是否啟用 IP、GDPR／隱私文案 |
| **R1** | SQL：`users.region_*` + `custom_products.designer_*` migration |
| **R2** | `resolveDesignerRegion()` + 寫入 POST 儲存／自動儲存 |
| **R3** | 個人設定頁或 `/api/me/region` PATCH（宣告式來源） |
| **R4** | 舊資料 backfill：users.location 字串對照 `service_areas` |
| **R5** | 後台報表／媒體牆趨勢依 `designer_country_code` 聚合 |

### 4.5 不建議單獨依賴的方式

- 僅用 **UI 語系** 當國家（在台華人、海外華人都可能用 zh-TW）。
- 用 **引用素材的廠商國家** 當設計者國家（那是供應鏈地區，不是需求方）。
- 要求設計者填**精確地址**（隱私負擔大；國家＋可選城市即可）。

---

## 五、依賴與順序建議

1. **先** 資料血緣 SQL + `POST /api/custom-products`（影響小、立刻改善分析）
2. **並行規格** 設計風向 D0（文案、表結構）
3. **設計者地區 R0–R1** 可與血緣同一支 API 擴充（皆為儲存時後端快照）
4. **再** 設計風向 D1–D6（改動面大，與全站 E2E 錯開排程）

---

## 六、相關檔案

- `server.js`：`POST /api/custom-products`、`enrichCustomProductSemantics`、`POST /api/generate-product-image`
- `public/js/custom-product.js`（`reference_sources`）
- `public/js/remake-product.js`、`public/remake-product.html`
- `docs/add-custom-products-reference-sources.sql`
- `docs/add-custom-products-semantics.sql`
- `docs/matchdo-todo.md` §6 視覺語意庫
