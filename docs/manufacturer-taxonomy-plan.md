# 廠商分類：四維度架構 — 規劃（第三版）

**狀態**：**MT-1 v3 種子已整理**；MT-3 表單與後台管理**待重做**（舊 commit `8f600b8`～`ab3a939` 程式視為作廢，勿參考）  
**更新**：2026-06-10  
**種子 SQL**：`docs/add-manufacturer-taxonomy.sql`（與本檔對齊的唯一詞彙來源）

**相關**：

- `docs/custom-product-categories` — ① 商品分類（已有後台）
- `docs/vendor-asset-prototype-moq-customization-notes.md` — MOQ／訂製程度（已上線，不動）
- `docs/account-one-login-capabilities.md` — 選單常駐原則

---

## 0. 底線

| 原則 | 說明 |
|------|------|
| **四維度平行** | 商品／工藝／生產模式／材料 — **不混在同一棵樹** |
| **工藝三層** | 大類 → 細類 → 標籤；前兩層只負責**導覽**，不限制只能選一項 |
| **工藝複選** | 同一筆可勾**多個**平台工藝標籤；可換細類繼續加選，已選清單常駐顯示 |
| **廠商可新增** | 清單沒有時可**自填工藝**（其他／備填），與平台標籤並存；**不是**只能選一項 |
| **生產模式獨立** | 工業量產／職人手作等 — **單選**；「工業製造」「職人工藝」為 AI 族，不當工藝大類 |
| **手工在工藝標籤裡** | 如「手工皮件」「手工金工」— 在皮革、珠寶底下；**不是**生產模式 |
| **詞彙維護** | 平台種子 + **管理後台**可增修；廠商自填先顯示，管理員可升格為正式標籤 |
| **表單 UI** | 三層 `select` 連動 + 標籤按鈕**複選** +「新增其他工藝」；**禁止**舊版搜尋 picker |
| **部署不變** | `.cursor/rules/deployment.mdc` 一行 Cloud Shell |

---

## 1. 四個維度

```text
① 商品分類     custom_product_categories     主分類 → 子分類（尋找主軸）
② 工藝分類     taxonomy capability           大類 → 細類 → 標籤（**複選**）+ 廠商自填（其他）
③ 生產模式     taxonomy production_type      單選（與工藝分開）
④ 材料         taxonomy material             選填（獨立）
```

**知識圖譜**：

```text
商品 → 需要哪些工藝 → 需要哪些材料 → 哪些工廠／作品 → 篩生產模式 + MOQ
```

**兩類載體**（同一套 key）：

| 載體 | 表 | 頁面 |
|------|-----|------|
| 數位原型／零件 | `vendor_assets` + `vendor_asset_taxonomy_links` | `manufacturer-materials.html` |
| 廠商作品 | `manufacturer_portfolio` + `portfolio_taxonomy_links` | `manufacturer-portfolio.html` |

---

## 2. 維度一：商品分類（已有）

- 後台：`public/admin/custom-categories.html`
- API：`/api/custom-product-categories`、`/api/admin/custom-product-categories`
- 有 **提示詞**（AI 設計用）— 工藝後台**不要**複製此欄位

---

## 3. 維度二：工藝分類（Capability）

### 3.1 三層語意（導覽用，不鎖單選）

| depth | 名稱 | 廠商操作 | 儲存 |
|-------|------|----------|------|
| 0 | **工藝大類** | 第一個 `<select>`，用來縮小下面清單 | 不存 |
| 1 | **工藝細類** | 第二個 `<select>`（連動大類） | 不存 |
| 2 | **工藝標籤** | 按鈕**複選**；可換大類／細類繼續勾，**已選清單不會被清掉** | `vendor_asset_taxonomy_links` 等多筆 |

**重點**：三層連動 ≠ 只能填一項。一筆原型／作品可同時有「燙金 + CNC銑削 + 平車 + …」任意多個標籤。

### 3.1.1 廠商自填工藝（其他）

平台清單沒有時，廠商不必卡住：

| 方式 | UI | 儲存（規劃） |
|------|-----|----------------|
| **勾平台標籤** | 三層導覽下複選 | `capability_keys[]` → link 表 |
| **自填其他** | 「新增其他工藝」輸入框，可**連續新增多筆** | `capability_custom_labels[]`（新欄位，text[] 或 JSON） |
| **升格**（後台） | 管理員把常見自填詞併入 `taxonomy_nodes` | 日後可選做 |

自填詞**立即**在該筆素材／作品上顯示 chip；是否進全站標準詞彙由管理員決定，不要求廠商等審核才能上架。

### 3.2 十五工藝大類（定案）

完整清單以 `add-manufacturer-taxonomy.sql` 為準。大類與 AI 推薦標籤：

| # | 大類顯示名 | key |
|---|------------|-----|
| 1 | 印刷工藝 | `cap.printing` |
| 2 | 紡織與車縫 | `cap.textile` |
| 3 | 皮革工藝 | `cap.leather` |
| 4 | 木工工藝 | `cap.wood` |
| 5 | 金屬加工 | `cap.metal` |
| 6 | 塑膠加工 | `cap.plastics` |
| 7 | 矽膠與橡膠 | `cap.silicone_rubber` |
| 8 | 珠寶與金工 | `cap.jewelry` |
| 9 | 模型與裝飾品 | `cap.modeling` |
| 10 | 3D製造 | `cap.3d` |
| 11 | 雷射加工 | `cap.laser` |
| 12 | 玻璃與陶瓷 | `cap.glass_ceramic` |
| 13 | 包裝工藝 | `cap.packaging` |
| 14 | 鐘錶微型工藝 | `cap.horology` |
| 15 | 交通與戶外改裝 | `cap.automotive_outdoor` |

約 **152** 個工藝標籤（depth=2）為**起點種子**；管理後台可增修，廠商亦可自填補缺。

**手工彩繪**（成品表面手繪，通用、不拆球鞋／安全帽等品類標籤）：`cap.printing.hand_paint.hand_paint` — 路徑 **印刷工藝 → 手工彩繪**；見 `docs/add-taxonomy-hand-paint.sql`。

### 3.3 廠商表單 UI（MT-3）

```text
[生產模式 ▼]  單選

[工藝 ▼] [移除]     ← 第一列
[工藝 ▼] [移除]     ← 按「+ 新增工藝」多一列，每列選一項

[+ 新增工藝]

其他工藝（自填）
[________] [移除]
[+ 新增其他工藝]
```

每加一項就多一行表單；無大類連動、無標籤牆。

- 平台標籤：`GET /api/taxonomy?dimension=capability`
- 送出：`capability_keys`（JSON 陣列，**多個**）+ `capability_custom_labels`（JSON 陣列，**多個**自填）
- **禁止**：舊版 `vendor-asset-taxonomy-picker.js` 單一搜尋框

### 3.4 後台管理（MT-2b，待做）

- 新頁：`public/admin/taxonomy-capabilities.html`（比照 `custom-categories.html`）
- API：`/api/admin/taxonomy-nodes` CRUD（`dimension=capability`）
- 欄位：key、顯示名、所屬大類／細類、排序、啟用 — **無提示詞**
- 可檢視廠商常見自填詞，一鍵升格為正式 `taxonomy_nodes`（二期可簡化為手動新增）

---

## 4. 維度三：生產模式（Production Type）

**獨立於工藝樹。** 描述「這一筆」接單型態，不是整間廠標籤。

| key | 顯示名 | AI 族 | 特徵（`moq_hint_json`） |
|-----|--------|-------|---------------------------|
| `prod.mass` | 工業量產 | 工業製造 | 大量生產、設備導向、穩定 MOQ |
| `prod.small_batch` | 小量生產 | 工業製造 | 小量生產 |
| `prod.artisan` | 職人手作 | 職人工藝 | 少量、技術導向、個人品牌 |
| `prod.bespoke` | 單件客製 | 職人工藝 | MOQ 通常 1 |

與 `min_order_quantity` **並存**：模式＝語意；MOQ＝實際件數。

**儲存**：`vendor_assets.production_type_key`、`manufacturer_portfolio.production_type_key`（單選欄位，不進 link 表）。

**媒合範例**：

```text
原木桌 + 木工標籤 + 職人手作 + MOQ=1
餐廳桌 500 張 + 木工標籤 + 工業量產 + MOQ>100
```

---

## 5. 維度四：材料（Material）

- 種子在 SQL；大類 → 細項（depth 0/1）
- 廠商表單**選填**；`material_key` 粗分欄位短期保留
- 後台可擴充（同 §3.4）

---

## 6. 資料模型

### 6.1 `taxonomy_nodes`

| 欄位 | 說明 |
|------|------|
| `key` | 主鍵 |
| `dimension` | `production_type` \| `material` \| `capability` |
| `parent_key` | 父節點 |
| `depth` | 工藝：0 大類 / 1 細類 / 2 標籤 |
| `name_zh` | 顯示名 |
| `aliases` | 搜尋同義（非提示詞） |
| `moq_hint_json` | 生產模式用（含 `family`、`traits`、`examples`） |
| `is_active` | 下架舊詞彙用 |

### 6.2 連結表與自填欄位

- `vendor_asset_taxonomy_links` — 平台工藝標籤 key，**一筆素材多列**（複選）
- `portfolio_taxonomy_links` — 作品同上
- `vendor_assets.capability_custom_labels` — `text[]` 或 `jsonb`，廠商自填工藝（MT-3 前需 migration）
- `manufacturer_portfolio.capability_custom_labels` — 對稱欄位

---

## 7. API

| 方法 | 路徑 | 狀態 |
|------|------|------|
| GET | `/api/taxonomy?dimension=` | MT-2 已有 |
| GET | `/api/taxonomy/search` | 可保留給後台搜尋；**廠商表單不用** |
| CRUD | `/api/admin/taxonomy-nodes` | **待做** |
| POST/PUT | vendor-assets、portfolio | 已接受 `production_type_key`、`capability_keys` |

---

## 8. 實作分期（重排）

| 期別 | 內容 | 狀態 |
|------|------|------|
| **MT-1 v3** | `add-manufacturer-taxonomy.sql` 對齊你確認的 15 大類 | ✅ 本檔 |
| **MT-2** | 讀取 API | 已有，需驗證 v3 種子 |
| **MT-2b** | 後台工藝 CRUD（無提示詞） | 待做 |
| **MT-3a** | 原型表單：select 三級 + 生產模式 | 待重做（丟棄 picker） |
| **MT-3b** | 作品表單：同上 | 待做 |
| **MT-4** | 列表 chips | 待做 |
| **MT-5** | 設計者篩選 | 待做 |

### 作廢不沿用

- commit `8f600b8`～`ab3a939` 的 `vendor-asset-taxonomy-picker.js` 與動態搜尋 UI
- 規劃第二版 §5.1 的 `cap.surface`／`cap.assembly`／`cap.electronics`／`cap.other` 大類

---

## 9. 下一步

1. 你在 Supabase **重跑** `docs/add-manufacturer-taxonomy.sql`（v3）
2. 驗證：`GET /api/taxonomy?dimension=capability` 回 15 大類 + 細類 + 標籤
3. 再開 MT-2b（後台）→ MT-3a／3b（表單，主分類模式）

---

*第三版定案 — 詞彙以 SQL 為唯一來源；頁面與後台尚未接上屬正常，下一步 MT-2b／MT-3。*
