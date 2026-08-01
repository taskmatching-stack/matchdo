# 架構優化 × SEO × B 線 — 執行原則（必讀）

**更新**：2026-07-30（SEO：`/client/*` 改 blocklist；工具頁可 index）  
**狀態**：Step 0～4 **有效**；Step 5 **已還原**（進度停在 **A5r 待做**，不是 A5 完成）  
**相關**：`docs/architecture-optimization-backlog.md`、`docs/SEO-PLAN.md`、`docs/SEO-PROGRESS.md`、`docs/account-one-login-capabilities.md`、`docs/matchdo-todo.md` §6

---

## 1. 代號對照（避免再搞混）

| 你說的 | 實際指 | 現況（2026-06-01） |
|--------|--------|-------------------|
| **A1** | 架構 **Step 1**：拆 `routes/sitemap.js` | ✅ 已上線，**仍有效** |
| **A2** | 架構 **Step 2**：sitemap 索引政策（廢 products 索引） | ✅ 已上線，**仍有效** |
| **A3** | 架構 **Step 3**：`capabilities` + 選單 | ✅ 已上線；**選單規則以 `account-one-login-capabilities.md` 為準**（全開，不用 `show_supplier_zone` 藏） |
| **A4** | 架構 **Step 4**：detail `noindex` + canonical → `/inspiration/` | ✅ 已上線，**仍有效** |
| **A5** | 架構 **Step 5**：拆 `inspiration`／`media-wall` 路由 | ❌ **曾部署全站 500，已還原** — **勿當作已完成** |
| **A5r** | **重做 Step 5** | ⏳ **待排**；部署前必跑 `node --check server.js` 與 `node -e "require('./server.js')"` |

> `matchdo-todo.md` 裡另有舊稿「Phase A：Supabase／vercel」— 那是**部署準備**，與上表 **架構 Step 1～5** 不同脈絡。

### 1.1 A1～A4 要不要「從頭重做」？

**不必整段推翻**，但建議做一次 **對照整理（reconciliation）**，不是 A1 重寫：

| 仍成立（勿動核心） | B 線／近期改動後需對齊 |
|--------------------|-------------------------|
| 僅 `/inspiration/*` 當 UGC 可索引 URL | **`/client/*` 不再整包 noindex**；僅 blocklist 擋個人後台（見 §2.1、§3） |
| `routes/sitemap.js` 單一模組 | 公開工具頁（AI 編輯、攝影模擬、設計頁 tab 等）可進 `sitemap-pages` |
| detail `noindex` + canonical | 匯入供應商品項 → `vendor_assets`，`tags_source: import` |
| 選單 **①②③ 常駐** | 廢止 `nav.show_supplier_zone` 藏選單（見 account 規範） |

**結論**：主線 SEO／URL 政策沒白做；缺的是 **文件同步 + B 線頁型歸類 + 語意欄位 migration**，不是回到 Step 0 全部重來。

### 1.2 常見誤解：「A1～A4 不是拆了很多 server.js？」

**沒有。** 目前 repo 實際狀態（2026-06-01）：

| 檔案 | 約略行數 | 內容 |
|------|----------|------|
| `server.js` | ~17,600 | **絕大多數** `app.get/post/...`、B 線、素材庫、生圖、金流、admin… |
| `routes/sitemap.js` | ~226 | **僅 A1（Step 1）** 搬出的 `/sitemap*.xml`、`robots.txt` |
| `routes/inspiration.js` 等 | **不存在** | A5 曾拆出，**全站 500 後已刪除還原** |

| 步驟 | 實際改動性質 | 是否把 API 搬出 `server.js` |
|------|----------------|------------------------------|
| **A1** | 拆 sitemap 模組 | ✅ 只有 sitemap |
| **A2** | 索引政策（products 不進 `/sitemap.xml`） | 改 `routes/sitemap.js` + 文件 |
| **A3** | `capabilities` + 選單 | 在 `server.js` **加幾十行** + `site-header.js` |
| **A4** | detail `noindex`/canonical | 主要在 **`client/custom-product-detail.html`** + sitemap 邏輯 |
| **A5** | 拆 inspiration／media-wall | ❌ 已還原，**等 A5r** |

因此：**後續 B 線、供應商 AI、素材 MOQ 等仍寫在 `server.js` 是預期行為**，不是違反 A1～A4——因為 A1～A4 **從未要求**「新功能禁止寫 server.js」。

**之後怎麼寫才對（在 A5r／A6 完成前）**

| 新功能類型 | 現階段放哪 | 完成後可遷到哪 |
|------------|------------|----------------|
| 新 sitemap 子檔、robots 規則 | `routes/sitemap.js` | 維持 |
| 產業供應商、素材庫、capabilities | `server.js`（與現況一致） | 可選 `routes/industry-supplier.js`（**未建**，需另開 PR） |
| 訂製產品 CRUD、生圖 | `server.js` | **A6** `routes/custom-products.js` |
| 靈感牆 API、inspiration SSR | `server.js` | **A5r** |
| 共用純函式（語意、上傳） | `lib/*.js`（已有 `visual-semantics.js` 等） | 可抽，不強制 |

**禁止**：在未做 A5r 冒煙前，再拆一大塊路由上線（會重演 A5 全站 500）。  
**鼓勵**：新 domain 若一次新增 **>300 行** 且邊界清楚，可 **先** 建 `routes/xxx.js` + `registerXxxRoutes(app, deps)`，但須同一 PR 內 `require('./server.js')` 通過。

---

## 2. 新功能必過的四道關（加法清單）

開工前自問；任一題答「否」先補文件再寫碼。

### 2.1 檔案與 URL（`architecture-optimization-backlog` §4）

| 頁型 | 路徑範例 | SEO／收錄 |
|------|----------|-----------|
| **A 可索引內容** | `/inspiration/{type}/{id}` | SSR + `sitemap-inspiration` |
| **B 公開工具** | `/custom-product.html`、`/vendors.html`、`/promo-camera`、`/client/ai-edit.html` | `index, follow` + `sitemap-pages`（設計頁各 tab 用 `?tab=`） |
| **C 半套 CSR 詳情** | `/client/custom-product-detail.html?id=` | **noindex**；canonical → A |
| **D 個人後台** | `/client/manufacturer-dashboard.html`、`my-custom-products.html`、`messages.html` 等 | **noindex**（blocklist）；**不進 sitemap** |
| **D′ 已廢功能** | `/client/my-projects.html`、`demands.html` 等 | **noindex**；檔案保留以免舊連結 404 |
| **E 廠商公開首頁** | **`/vendor-profile.html?id=`** | **`index, follow`**；動態 OG + 預填可見正文 + `sitemap-vendors` |

**`/client/*` noindex 實作（2026-07-30 起）**：`server.js` 的 `CLIENT_NOINDEX_EXACT` **blocklist** + HTML meta；**禁止**再寫「整包 `/client/*` noindex」。需要點數 ≠ 隱私，工具／說明頁可 index。

**可 index 的 `/client/` 範例（非 exhaustive）**：`ai-edit.html`、`ai-upscale.html`、`supplier-portal.html`、`industry-supplier-catalog.html`、`industry-supplier-dashboard.html`、`vendor-prototype-insights.html`、`promo-camera.html`（正式短網址 `/promo-camera`）。

- 可索引新內容 → **先做 server 動態 HTML**，禁止再新增「只有 `?id=` 的 CSR 詳情」當 SEO 落地頁。
- 製造商後台 HTML → 編 **`public/client/`**（見 `.cursor/rules/manufacturer-portfolio.mdc`）。
- **禁止**未更新 §4.2 URL 對照表就上新公開 URL。

### 2.2 視覺語意（`matchdo-todo.md` §6）

| 資料 | 上架時 |
|------|--------|
| `vendor_assets` | P1 讀圖 → `ai_tags` + `image_semantics_json`；可選 FLUX 重繪；`visual_semantics_events.source_type = vendor_asset` |
| `supplier_catalog_items` | **同一套** P1／扣點；欄位 `docs/add-supplier-catalog-ai-fields.sql`；`source_type = catalog_item` |
| 製造商 **匯入** B 線 | 複製 `ai_tags`／語意至 `vendor_assets`；`tags_source: import`；**匯入當下不另跑 Gemini**（產品已定） |

**FLUX／Gemini 提示詞**：嚴禁查表式硬編碼（檔名 regex、`material_key`→固定表面句等）。唯一規格見 **`docs/flux-and-gemini-prompt-policy.md`**。

### 2.3 帳號與選單（`account-one-login-capabilities.md`）

- **禁止**用 `capabilities.nav.*`、`show_supplier_zone`、未綁定身分 **隱藏** ①②③ 連結。
- 僅兩項業務門檻：**免費不可上架素材／供應商品項**；**無公開作品不可匯入 B 線**（admin/tester 例外）。

### 2.4 部署安全（A5 教訓）

- 拆出的 route 檔 **必須** `const express = require('express')`（若用 `express.json()`）。
- 合併前：`node --check server.js`、`node -e "require('./server.js')"`。
- **禁止**在未冒煙時部署拆路由 PR。

---

## 3. B 線與 SEO 的關係（2026-07-30 修正）

| 頁面 | 性質 | SEO 做法 |
|------|------|----------|
| `supplier-catalog-manage.html` | ③ 供應商上架工作區 | **D**：noindex |
| `industry-suppliers.html`、`my-supplier-references.html` | ② 製造商瀏覽／匯入清單 | **D**：noindex |
| `industry-supplier-dashboard.html`、`industry-supplier-catalog.html` | ② 供應商說明／目錄（需點數操作，無個資） | **B**：**index**；catalog `?supplier_id=` → **`sitemap-vendors.xml`**（2026-08-01） |
| `supplier-portal.html` | B 線說明 | **B**：**index** |
| **`/vendor-profile.html?id=`** | **廠商公開首頁**（訪客可瀏覽） | **E**：**index**；**不可**與 `/client/manufacturer-dashboard.html`（後台）混淆 |

**現階段**：B 線 SEO 除公開頁外，語意資料仍服務站內搜尋／風向／匯入；**勿**再將 `industry-supplier-catalog` 等工具頁一律標為 D。

---

## 4. SQL migration 原則

| 類型 | 範例 | 執行方式 |
|------|------|----------|
| 結構 | `add-industry-supplier-catalog.sql`、`add-supplier-catalog-ai-fields.sql` | Supabase → **Run without RLS** |
| 帳號綁定 | `bind-industry-supplier-account.sql` | **選用**；正常用網站「建立公司」 |

見 `docs/sql-scripts-conventions.md`。

---

## 5. 文件維護義務（防再 drift）

改下列程式時，**同一 PR** 至少更新一項文件：

| 改動 | 更新 |
|------|------|
| 新公開 URL、sitemap | `SEO-PROGRESS.md`、`architecture-optimization-backlog` §4.2、`site-url-seo-reconciliation-plan.md` |
| 新增／變更 301 | `url-redirect-map.md` |
| B 線 API／頁面 | `matchdo-todo.md` 近期完成、`三角色架構與AB線說明.md` |
| 選單／capabilities | `account-one-login-capabilities.md` |
| FLUX／Gemini 提示詞、材料 optimize、設計頁生圖 | **`docs/flux-and-gemini-prompt-policy.md`** |
| 拆 `server.js` | backlog §九、§十一.5；**未完成勿勾 Step 5** |

---

## 6. 建議你現在的執行順序

1. **整理確認**（非重寫 A1～A4）：對照本檔 §1.1 表格，跑 §7 冒煙。  
2. **Supabase**：B 線 catalog + `add-supplier-catalog-ai-fields.sql`（若尚未跑）。  
3. **部署** `main`（Cloud Shell，見 deployment rule）。  
4. **產品冒煙**：製造商 `manufacturer-materials` 與 ③ `supplier-catalog-manage` 各上傳一筆（含 AI 標籤）。  
5. **A5r**：另開 PR，只做路由拆分 + §2.4 檢查，不夾 B 線功能。

---

## 7. 部署後冒煙（最低限度）

- [ ] `https://matchdo.cc/` 200（非 500）  
- [ ] `/sitemap.xml` 含 5 子 sitemap、**不含** products 索引  
- [ ] `/inspiration/user_design/{已知 id}` 有 title／description  
- [ ] 登入後 ①②③ 選單全可見  
- [ ] `supplier-catalog-manage` 上傳扣點與 AI 標籤成功  
- [ ] `node -e "require('./server.js')"` 本地通過（A5r 前必做）

---

## 8. 修訂紀錄

| 日期 | 說明 |
|------|------|
| 2026-08-01 | Sitemap reconciliation：`sitemap-vendors` 加 product-tree／supplier catalog；移除 categories 重複 `official-templates`；文件對齊 layout_type 政策 |
