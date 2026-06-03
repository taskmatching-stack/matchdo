# 廠商產品關聯樹 — 圖形化介面規劃

> **狀態**：規劃稿（決策已確認，尚未實作 UI）  
> **資料基礎**：既有 `vendor_asset_prototype_links`（主產品 ↔ 材料／配件，一層、多對多）  
> **不在此版**：材料下再掛配件的子樹（需另建主產品）

---

## 已確認決策（2026-06）

| # | 決策 |
|---|------|
| **1. 入口** | **獨立頁**（不併入 `manufacturer-materials.html` Tab）。<br>• **a. 廠商匯入／上傳產品後**（素材庫流程）可提供進入此頁的連結。<br>• **b. 設計頁**（`custom-product.html`）亦可進入此獨立頁（見下方模式）。 |
| **2. 多對多怎麼畫** | **以「每個主產品」為單位**各畫一棵樹；同一材料若連到 A、B，在 A 的樹與 B 的樹各出現一次（不畫跨產品共用節點）。 |
| **3. 缺漏檢查** | **僅供廠商快速自查**（提示清單），不強制、不擋上傳、不與訂製範圍規則綁死。 |
| **4. 設計端 Phase 1** | **暫不定**內嵌 chip／小樹；先只做「可從設計頁連到獨立頁」，實際訂製者要看什麼互動等看到廠商版後再議。 |

**路徑（雙軌，見 §八）**：

| 用途 | 正式網址 |
|------|----------|
| 廠商編輯 | `/client/vendor-product-link-tree.html` |
| 訂製者／對外分享（guide） | `/product-tree.html?prototype_asset_id={uuid}`（Phase 1） |

---

## 八、獨立網址與 SEO

### 8.1 為何要兩套 URL

與 `docs/SEO-PROGRESS.md` 一致：**`/client/*` 為登入工作區 → `noindex`，不進 sitemap**；  
訂製者從設計頁進入、或未來分享「這款主產品可搭配哪些材／配」需要 **根目錄公開 URL**，才能做 canonical、OG 與選擇性收錄。

| 頁面 | 路徑 | robots | sitemap |
|------|------|--------|---------|
| 廠商關聯工作台 | `/client/vendor-product-link-tree.html` | **noindex, follow** | 不列入 |
| 產品關聯導覽（guide） | `/product-tree.html?prototype_asset_id=` | 見下 | Phase 2 動態 |

共用同一支 `vendor-product-link-tree.js`，以 `mode=vendor|guide`（或依 pathname 預設）切換能力。

### 8.2 Phase 1 公開網址（穩定、可分享）

**主 URL（canonical）**

```text
https://matchdo.cc/product-tree.html?prototype_asset_id={uuid}
```

**選用別名（實作時二擇一，須在 `express.static` 之前註冊）**

```text
GET /product-tree/{uuid}  → 301 至上方 query URL（最簡）
或
GET /product-tree/{uuid}  → 同頁渲染，canonical 仍指 query 版（過渡期）
```

查詢參數（guide）：

| 參數 | 說明 |
|------|------|
| `prototype_asset_id` | 主產品 `vendor_assets.id`（必填） |
| `lang` | `en`（hreflang 對應，與全站一致） |
| `return_to` | 返回設計頁 URL（encode；僅 guide UI 顯示按鈕，不寫入 canonical） |

**廠商編輯 URL**

```text
https://matchdo.cc/client/vendor-product-link-tree.html
https://matchdo.cc/client/vendor-product-link-tree.html?prototype_asset_id={uuid}&highlight={linked_or_new_asset_id}
```

設計頁入口用 **公開** `product-tree.html?...`；素材庫入口用 **client** 路徑。

### 8.3 Meta／OG／canonical（對齊 `vendor-profile.html`）

對 `GET /product-tree.html`（有 `prototype_asset_id` 時），在 `server.js` 做**動態 HTML meta 注入**（爬蟲與分享預覽）：

| 欄位 | 來源 |
|------|------|
| `<title>` | `{主產品標題} · 可搭配材料／配件｜{廠商名}｜MATCHDO 合做` |
| `meta description` | 主產品說明前 120 字 +「查看此數位原型的材料與配件關聯」 |
| `og:image` | 主產品封面 `image_url`（可走既有 `/api/proxy-image`） |
| `og:url` / `canonical` | 僅含 `prototype_asset_id`（**不含** `return_to`） |
| `hreflang` | `zh-TW` / `en`（`?lang=en`） |

靜態殼檔 `public/product-tree.html` 內放**預設** title／description；無 `prototype_asset_id` 時：

- 標題：產品關聯導覽｜MATCHDO 合做  
- **robots: noindex**（避免空參數被收錄成重複頁）

### 8.4 收錄策略（robots）

| 條件 | robots |
|------|--------|
| 無 `prototype_asset_id` | `noindex, follow` |
| 有 id，但主產品非 `is_public` 或廠商未公開 | `noindex, follow`（仍可供登入廠商預覽時改為顯示提示） |
| 有 id，且主產品對外可見 | `index, follow` |

廠商 **client** 頁一律：

```html
<meta name="robots" content="noindex, follow">
```

### 8.5 Sitemap（Phase 2，非 MVP 必須）

新增 **`/sitemap-product-trees.xml`**（動態），條件建議：

- `vendor_assets.asset_kind = prototype`
- `is_public = true`
- 至少 1 筆 `vendor_asset_prototype_links`
- `<loc>` = `https://matchdo.cc/product-tree.html?prototype_asset_id={id}`
- `changefreq=weekly`，`priority=0.5`（低於廠商頁、設計頁）

並在 `/sitemap.xml` 索引加入該子 sitemap。  
**Phase 1** 可不送 sitemap，但 canonical／OG 仍應先做好，方便手動分享。

### 8.6 語意化 slug（Phase 2+，與廠商 slug 協同）

待 `manufacturers.slug`／主產品 slug 就緒後（參考 `docs/vendor-profile-slug-plan.md`），可升級為：

```text
https://matchdo.cc/product-tree/{manufacturer_slug}/{product_slug}
```

- 舊 `?prototype_asset_id=` **永久 301** 至新址  
- sitemap／設計頁／素材庫連結改輸出新 URL  
- 本頁 canonical／og:url 跟隨 slug 版  

主產品若尚無 slug，繼續 fallback query URL。

### 8.7 結構化資料（Phase 2 可選）

公開 guide 頁可加 JSON-LD **`Product`**（主產品）+ **`isRelatedTo`** 指向材料／配件（各一筆 `Product` 或 `ImageObject`），強化「這款可搭配哪些」語意；需確認 Google 對客製 B2B 頁容忍度，非 MVP。

### 8.8 實作檢查清單（SEO）

- [ ] `public/product-tree.html` 靜態殼：預設 meta、hreflang 占位、`id="canonicalTag"`  
- [ ] `server.js`：`GET /product-tree.html` 動態 OG（仿 `vendor-profile.html`）  
- [ ] `public/client/vendor-product-link-tree.html`：`robots noindex`  
- [ ] `custom-product.html` 連結用 **公開** URL + `return_to`  
- [ ] `manufacturer-materials.html` 連結用 **client** URL  
- [ ] `docs/SEO-PROGRESS.md` 補一列 product-tree 政策  
- [ ] Phase 2：`sitemap-product-trees.xml`、可選 `/product-tree/:id` 301  

---

## 目標

| 對象 | 目標 |
|------|------|
| **廠商** | 獨立頁上圖形化維護／檢查「主產品 ↔ 材／配」；發現孤兒、空白關聯。 |
| **訂製者（設計頁）** | 經獨立頁查看與已選主產品相關的結構（Phase 1 以導覽為主，細節後定）。 |

## 核心概念：兩層星狀樹（每主產品一棵）

```
  （主產品 A 的畫布）                （主產品 B 的畫布）
        [主產品 A]                        [主產品 B]
       /    |    \                      /    \
  [M1] [M2] [P1]                  [M1] [P3]
```

- 資料仍多對多；**畫面**依選中的主產品只顯示「這顆根」底下的連線。
- **「我的素材分類」** 僅篩選／著色，不當樹父子。

---

## 一、獨立頁：產品關聯樹工作台

### 1.1 頁面模式與網址

| 模式 | 誰用 | **獨立網址** | 能力 |
|------|------|--------------|------|
| **vendor** | 登入廠商 | `/client/vendor-product-link-tree.html`（**noindex**） | 拖曳連結、解除、排序、快速檢查 |
| **guide** | 訂製者／分享 | `/product-tree.html?prototype_asset_id=`（**可 index**，見 §8） | Phase 1：**唯讀**樹 + 返回設計頁 |

查詢參數：

- `prototype_asset_id` — 預選主產品（必填才顯示樹）
- `return_to` — 僅 guide：返回設計頁（不進 canonical）
- `lang` — 中英文（hreflang）

### 1.2 版面（桌面）

- **左**：主產品清單（縮圖、標題、MOQ；可選顯示「有／無關聯」小圓點）
- **中**：以**目前主產品**為根的圖（卡片樹／放射狀）
- **右**：快速檢查（純提示）+ 可拖入的未關聯素材池（僅 vendor 模式）

```text
┌─────────────┬──────────────────────────┬─────────────┐
│ 主產品列表   │   [目前主產品 A 的樹]     │ 快速檢查     │
│ ・A ●       │      材料M1  配件P1       │ ・尚未關聯材 │
│ ・B ○       │         ╲  │  ╱          │ ・孤兒 3 筆  │
│             │      [主產品 A]           │ [素材池]     │
└─────────────┴──────────────────────────┴─────────────┘
```

### 1.3 互動（vendor 模式）

| 操作 | 行為 |
|------|------|
| 點左欄主產品 | 切換畫布（只顯示該主產品底下的材／配） |
| 拖曳素材池 → 中央根 | 建立 link |
| 子節點移除 | 解除與**目前主產品**的 link（不刪素材本體） |
| 子節點排序 | 更新 `sort_order`（設計端推薦順序） |
| 雙擊節點 | 開啟既有素材編輯（可選新分頁） |

### 1.4 快速檢查（僅提示，不強制）

針對**目前選中主產品**，右側可顯示例如：

- 尚無任何材／配關聯
- 同廠仍有 N 筆材料／配件未掛到任何主產品（孤兒，可一鍵掛到目前主產品）

**不做**：依 `customization_levels` 自動判斷「一定要幾筆材料」、不擋發布、不影響設計頁 ⚠️ 邏輯。

### 1.5 入口串接

**a. 廠商素材庫（`manufacturer-materials.html`）**

- 頂部或上傳成功 toast 加：「前往產品關聯圖」→ 獨立頁（可帶 `?highlight=<新素材 id>` 方便拖入）。
- 主產品上傳完成後可建議：「下一步：為此主產品關聯材料／配件」。

**b. 設計頁（`custom-product.html`）**

- 已鎖定廠商數位原型時：「查看此產品的關聯圖」→ **公開**  
  `/product-tree.html?prototype_asset_id=…&return_to=…`（利於 SEO／分享；見 §8）
- Phase 1 為唯讀 guide；是否要在 guide 內「選為參考」留待後續決定。

---

## 二、訂製者端（設計頁）— 暫緩內嵌

以下保留為 **Phase 2+ 候選**，不在 Phase 1 承諾：

- 參考圖區塊內 chip 列、可摺疊小樹、定製精靈
- 與現有分頁／素材庫的深整合

現行已上線能力仍保留：素材庫「廠商推薦」排序、關聯說明列、⚠️ 規則（無關聯→訂製範圍）。

---

## 三、API（規劃）

| 端點 | 用途 |
|------|------|
| `GET /api/me/vendor-product-link-tree` | 廠商：全廠 prototypes、links、assets、orphans、checks（提示用） |
| `GET /api/vendor-assets/:id/link-tree` | guide／公開頁：單一主產品子樹（僅 `is_public` 主產品） |
| `PUT /api/me/vendor-assets/:prototypeId/prototype-links` | 可從現有 PUT 拆出，供畫布整批儲存 |
| `PATCH /api/me/vendor-assets/:prototypeId/prototype-links/reorder` | 僅 `sort_order` |
| 既有 `GET …/prototype-link-summary` | 設計頁輕量提示，與樹頁並存 |

`checks` 僅 `severity: "info"`，無 `error` 阻擋類。

---

## 四、技術選型

Phase 1 建議 **卡片樹 + CSS 連線**（每主產品一棵，實作快、行動版可折疊為列表）。主產品數 >30 再評估 cytoscape。

---

## 五、實作分期（依決策調整）

### Phase 1 — 獨立頁 + 雙入口 + 基礎 SEO

- [ ] `public/client/vendor-product-link-tree.html`（vendor，noindex）
- [ ] `public/product-tree.html`（guide 殼）+ `server.js` 動態 OG／canonical
- [ ] `public/js/vendor-product-link-tree.js`（共用）
- [ ] `GET /api/me/vendor-product-link-tree`、`GET /api/vendor-assets/:id/link-tree`
- [ ] vendor：拖曳連結、快速檢查、孤兒池
- [ ] 素材庫 → **client** URL；設計頁 → **公開** `product-tree.html`
- [ ] **不做**設計頁內嵌 chip／小樹

### Phase 2

- [ ] 子節點排序、guide 互動（若需要）
- [ ] `sitemap-product-trees.xml` + `/sitemap.xml` 索引
- [ ] 可選 `GET /product-tree/:uuid` → 301 至 canonical query URL
- [ ] 語意化 slug URL（協同廠商 slug 計畫）

### Phase 3

- [ ] 匯出 BOM（CSV）、可選定製精靈

---

## 六、與現有功能

| 現有 | 關聯樹上線後 |
|------|----------------|
| 編輯彈窗／上傳表單勾選 | 保留；與獨立頁寫同一表 |
| 設計端素材庫推薦 | 不變 |
| 設計端 ⚠️ | 不變（無關聯→訂製範圍；有關聯→不警告） |

---

## 七、檔案與導覽（實作時）

| 檔案 | 說明 |
|------|------|
| `public/client/vendor-product-link-tree.html` | 廠商編輯（noindex） |
| `public/product-tree.html` | 公開 guide 殼（SEO meta 占位） |
| `public/js/vendor-product-link-tree.js` | 畫布、拖曳、模式切換 |
| `server.js` | `GET /product-tree.html` 動態 OG |
| `routes/sitemap.js` | Phase 2：`sitemap-product-trees.xml` |
| `docs/vendor-asset-prototype-links.md` | 資料與 API（已存在） |

確認無誤後，下一階段從 **Phase 1 獨立頁 + API** 開始寫程式。
