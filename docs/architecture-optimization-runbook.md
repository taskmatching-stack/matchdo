# 架構優化 · 逐步執行手冊（Runbook）

更新日期：2026-05-26  
**用途**：明天起**一天一步**（或半天一步），照勾選框做即可。  
**背景與判斷**：`docs/architecture-optimization-backlog.md`（Step 0 已完成）  
**原則**：`docs/STABLE-BASELINE.md` — 不改首頁靈感牆核心；每步部署後跑冒煙（§六）。

---

## 總覽：建議排程

| 天次 | Step | 目標 | 預估 | 可單獨 commit |
|------|------|------|------|----------------|
| **第 1 天上午** | **1** | 拆 `routes/sitemap.js`（只搬運） | 2～4 h | ✅ `refactor: extract sitemap routes` |
| **第 1 天下午** | **2** | 索引政策文件 + 暫停 products 索引 | 1～2 h | ✅ `chore(seo): pause products sitemap index` |
| **第 2 天** | **3** | 擴充 capabilities + header 加法 | 4～6 h | ✅ `feat: extend me/capabilities zones` |
| **第 3～4 天** | **4** | visibility／canonical（**可選**，需求定案後） | 1～2 天 | 拆多 commit |
| **持續** | **5** | 拆 inspiration / media-wall | 依觸及範圍 | 每檔一 commit |

**與其他工作的關係**：本 runbook 可與 `matchdo-todo.md` 的 SQL／部署／E2E **並行**；若當天只做架構，仍建議 **push → Cloud Shell 部署 → 冒煙** 再收工。

---

## 執行前（每次開工前 5 分鐘）

- [ ] `git pull`（或確認在乾淨分支）
- [ ] 本機可跑：`node server.js`（或專案慣用啟動方式）
- [ ] 記住：**廠商頁改 `public/client/`**；訂製列表／detail 改根目錄 **`client/`**
- [ ] 部署只用 **Google Cloud Shell**（見 `.cursor/rules/deployment.mdc`）

---

## Step 1：拆 `routes/sitemap.js`（第 1 天上午）

### 1.1 目標

把 `server.js` **L1415～L1626**（`SITEMAP_PAGES` 至 `robots.txt`）搬到 `routes/sitemap.js`，**邏輯零改動**。

### 1.2 建立檔案

**新增** `routes/sitemap.js`：

```javascript
'use strict';

/**
 * Sitemap 與 robots.txt（由 server.js 掛載，須在 express.static 之前）
 */
function registerSitemapRoutes(app, deps) {
    const { supabase, BASE_URL } = deps;
    // 從 server.js L1417～L1626 原樣貼上：
    // - const SITEMAP_PAGES = [...]
    // - function escapeXml(s) { ... }
    // - app.get('/sitemap.xml', ...)
    // - app.get('/sitemap-pages.xml', ...)
    // - ... 至 app.get('/robots.txt', ...)
}

module.exports = { registerSitemapRoutes };
```

### 1.3 修改 `server.js`

1. 檔案頂部（其他 `require` 旁）加入：

   ```javascript
   const { registerSitemapRoutes } = require('./routes/sitemap');
   ```

2. **刪除** L1415～L1626 整段（sitemap + robots）。

3. 在**刪除位置**（仍須在 `express.static` 之前，約 L3858 前）加入：

   ```javascript
   registerSitemapRoutes(app, { supabase, BASE_URL });
   ```

   > `BASE_URL` 若專案用函式取得，改傳入與現況相同變數即可。

### 1.4 禁止事項（Step 1）

- ❌ 改 sitemap 查詢條件、URL 格式、筆數上限  
- ❌ 改首頁、靈感牆 API、生圖 API  
- ❌ 順手做 Step 2（products 索引）— **分開 commit**

### 1.5 本機驗證

```text
GET http://localhost:PORT/sitemap.xml          → 200，含 6 個子 sitemap loc
GET http://localhost:PORT/sitemap-pages.xml    → 200，有多筆 <url>
GET http://localhost:PORT/sitemap-inspiration.xml → 200（可為空 urlset）
GET http://localhost:PORT/robots.txt           → 200，含 Sitemap: .../sitemap.xml
GET http://localhost:PORT/                     → 首頁正常
```

### 1.6 冒煙（部署後）

見本檔 **§六**；至少勾：sitemap 三條 + 首頁 + `/inspiration/user_design/{已知id}`。

### 1.7 完成標準

- [ ] `routes/sitemap.js` 存在，`server.js` 無重複 sitemap 路由  
- [ ] 線上 `/sitemap.xml` 與拆前 XML 結構一致（子 sitemap 數量仍為 6）  
- [ ] `architecture-optimization-backlog.md` §九 Step 1 填完成日  

### 1.8 建議 commit message

```text
refactor: extract sitemap and robots routes to routes/sitemap.js
```

---

## Step 2：索引政策 + 暫停 products（第 1 天下午）

### 2.1 目標

落實 Step 0 定案：**可索引 UGC 只用 `/inspiration/...`**；**不再透過 sitemap 索引** `custom-product-detail`。

### 2.2 程式修改（二選一，建議 A）

**A. 從索引移除 products（建議）**

檔案：`routes/sitemap.js`（Step 1 後）內 `app.get('/sitemap.xml', ...)` 的 `entries` 陣列：

- **註解或刪除** 這一行（勿刪 `app.get('/sitemap-products.xml')` 路由本身，避免舊連結 404）：

  ```javascript
  // '<sitemap><loc>' + escapeXml(base + '/sitemap-products.xml') + '</loc>...',
  ```

- 在陣列上方加註：

  ```javascript
  // 2026-05-26：暫不列入索引；custom_products.visibility 未齊，SEO 以 sitemap-inspiration 為準。
  ```

**B. 保留索引但清空 products（不建議）**  
維持 `sitemap.xml` 條目，`sitemap-products.xml` 恆回傳空 `<urlset>` — 搜尋引擎仍會定期抓空檔，不如 A。

### 2.3 文件修改

| 檔案 | 動作 |
|------|------|
| `docs/SEO-PROGRESS.md` | 在「Sitemap 調整」表加一列：**2026-05-26** 起 `sitemap-products` **不列入** `/sitemap.xml` 索引；UGC 以 `sitemap-inspiration` + `/inspiration/*` 為準 |
| `docs/architecture-optimization-backlog.md` | §4.2 `sitemap-products` 列標「已暫停索引」 |
| `docs/matchdo-todo.md`（可選） | 「接下來執行進度」加一句：架構 Step 2 已完成 |

**政策一句（可貼進 SEO-PROGRESS）：**

> 客製作品對外可索引 URL 為 `https://matchdo.cc/inspiration/user_design/{id}`；`/client/custom-product-detail.html` 僅供登入後找廠，不納入 sitemap 索引。

### 2.4 本機驗證

```text
GET /sitemap.xml              → 僅 5 個 <sitemap>（無 products）或註解說明
GET /sitemap-products.xml     → 仍 200（舊書籤不壞）
GET /sitemap-inspiration.xml  → 仍含 /inspiration/user_design/...
```

### 2.5 禁止事項（Step 2）

- ❌ 新增 `visibility` migration  
- ❌ 改 `POST /api/custom-products` 的 `show_on_homepage`  
- ❌ 提交 Google Search Console  

### 2.6 完成標準

- [ ] `/sitemap.xml` 不再列出 `sitemap-products.xml`  
- [ ] `SEO-PROGRESS.md` 已記錄政策  
- [ ] backlog §九 Step 2 填完成日  

### 2.7 建議 commit message

```text
chore(seo): remove products sitemap from index; document inspiration canonical
```

---

## Step 3：Capabilities 三區（第 2 天）

### 3.1 目標

`GET /api/me/capabilities` **加法**欄位；`public/js/site-header.js` **只加不減**連結／區塊標示。

### 3.2 API 修改

檔案：`server.js`（約 L10878，`GET /api/me/capabilities`）

在現有 `res.json({ ... })` **保留所有既有 key**，新增：

```javascript
zones: {
    design: true,  // 凡已登入皆可視為訂製／設計區（或依 role 細化）
    manufacturer: hasManufacturer,
    industry_supplier: false  // B 線就緒前固定 false
},
nav: {
    show_supplier_zone: false,
    show_industry_catalog: canImport  // 或維持僅 materials 頁判斷
}
```

**注意**：`manufacturer-materials.html` 若已讀 `can_import_supplier_catalog`，不可改 key 名稱。

### 3.3 前端修改

檔案：`public/js/site-header.js`

1. 登入後 fetch `/api/me/capabilities`（若已有則擴充解析）。  
2. 依 `zones` / `nav` **顯示或摺疊**區塊標題（例如「製造商」「產業供應」）。  
3. **禁止**刪除現有 `<a href="...">`。  
4. `industry_supplier === false` 時不顯示供應商專區入口（或顯示「即將推出」— 與產品決策一致即可）。

### 3.4 驗證

| 帳號類型 | 預期 |
|----------|------|
| 未登入 | capabilities 401；header 維持現狀 |
| 一般訂製會員 | `zones.design: true`，`manufacturer: false` |
| 製造商 | `manufacturer: true`；材料庫連結仍在 |
| 有作品且非 seed | `can_import_supplier_catalog` 與現況一致 |

頁面抽查：`/`、`/client/dashboard.html`、`public/client/manufacturer-portfolio.html`。

### 3.5 完成標準

- [ ] API 回傳含 `zones`、`nav`，舊欄位不變  
- [ ] 製造商後台選單無遺失連結  
- [ ] backlog §九 Step 3 填完成日  

### 3.6 建議 commit message

```text
feat: extend /api/me/capabilities with zones; header additive nav
```

---

## Step 4：visibility 與 canonical（第 3～4 天，可選）

**前置**：產品確認是否還需要 `visibility` 欄位，或全面改用 `show_on_homepage` + `/inspiration/`。

### 4.1 若決定「廢止 visibility」

1. 文件標記 `sitemap-products` 為 legacy。  
2. （可選）`custom-product-detail.html` `<head>` 加：

   ```html
   <link rel="canonical" id="cp-canonical" href="">
   ```

   JS 依 `?id=` 設為 `/inspiration/user_design/{id}`（無圖則不加）。  
3. **不**做 DB migration。

### 4.2 若決定「補齊 visibility」

1. 新增 `docs/add-custom-products-visibility.sql`（`visibility text default 'private'` 等）。  
2. Supabase 執行 SQL。  
3. 對齊寫入：`POST /api/custom-products`、`PATCH`、生圖自動 insert。  
4. 若要恢復 products sitemap：URL 改指 `/inspiration/...` **或** 維持 detail 但加 canonical（與 Step 0 政策衝突，需產品表決）。

### 4.3 可選：`media-wall-item` 閘門

若需「未上牆不可分享」：在 `GET /api/media-wall-item` 對 `user_design` 檢查 `show_on_homepage === false` → 404。  
**會改變現況**（目前知道 id 即可開），實作前與產品確認。

### 4.4 完成標準

- [ ] 政策與程式／DB 一致  
- [ ] 冒煙含分享連結與付費隱藏作品情境  

---

## Step 5：續拆路由（持續，每檔一 PR）

| 順序 | 新檔 | 從 `server.js` 搬運區段（約） | 掛載時機 |
|------|------|------------------------------|----------|
| 5a | `routes/inspiration.js` | `GET /inspiration/:type/:id`（~L1194+） | **必須**在 `static('public')` 之前 |
| 5b | `routes/vendor-pages.js` | `vendor-profile.html?id=` 動態 meta（~L3813+） | 同上 |
| 5c | `routes/media-wall.js` | `/api/media-wall`、`/api/media-wall-item` | 改動前跑完整牆冒煙 |

每步重複 Step 1 流程：`registerXxxRoutes(app, deps)` + 本機 sitemap／inspiration／首頁驗證。

---

## 六、每步部署後冒煙清單（複製勾選）

```text
[ ] https://matchdo.cc/ — 靈感牆載入、篩選、點卡片 lightbox
[ ] https://matchdo.cc/inspiration/user_design/{一筆已知 id} — title、description、圖、canonical
[ ] https://matchdo.cc/sitemap.xml — 子 sitemap 數量正確（Step 2 後為 5）
[ ] https://matchdo.cc/sitemap-inspiration.xml — 含 inspiration URL
[ ] https://matchdo.cc/custom-product.html — 登入後可生圖／儲存
[ ] https://matchdo.cc/client/manufacturer-portfolio.html — 廠商作品頁（public/client）
[ ] https://matchdo.cc/vendor-profile.html?id={uuid} — 動態 title
```

**部署指令**（Cloud Shell）：

```bash
cd ~/matchdo && git fetch origin main && git reset --hard origin/main && gcloud run deploy matchdo --source . --region=asia-northeast1 --allow-unauthenticated --clear-base-image
```

---

## 七、回滾

| 狀況 | 作法 |
|------|------|
| Step 1 線上 sitemap 異常 | `git revert` 該 commit → 再部署 |
| Step 2 需恢復 products 索引 | 還原 `sitemap.xml` 的 `entries` 那一行 |
| Step 3 header 亂掉 | revert 前端 commit；API 新欄位可留（向後相容） |

---

## 八、執行勾選總表

| Step | 內容 | 完成日 | commit / PR |
|------|------|--------|-------------|
| 0 | 稽核與判斷 | 2026-05-26 | — |
| 1 | `routes/sitemap.js` | 2026-05-26 | |
| 2 | 暫停 products 索引 + SEO 文件 | 2026-05-26 | |
| 3 | capabilities + header | 2026-05-26 | |
| 4 | visibility／canonical | | |
| 5 | inspiration / media-wall 拆分 | | |

---

## 九、相關文件

| 文件 | 用途 |
|------|------|
| `docs/architecture-optimization-backlog.md` | 為什麼做、URL 對照表、風險 |
| `docs/STABLE-BASELINE.md` | 不可破壞範圍 |
| `docs/SEO-PROGRESS.md` | GSC 暫緩、sitemap 歷史 |
| `docs/matchdo-todo.md` | SQL／E2E 主線 |
| `.cursor/rules/manufacturer-portfolio.mdc` | 廠商頁路徑 |

---

## 修訂紀錄

| 日期 | 說明 |
|------|------|
| 2026-05-26 | 初版：Step 1～5 逐步指令、驗證、commit、部署、回滾 |
