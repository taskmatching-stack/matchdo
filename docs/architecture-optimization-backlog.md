# 架構優化執行清單（邊界清晰 · 漸進式）

更新日期：2026-05-26  
狀態：**Step 0 已完成（程式稽核 2026-05-26）**；Step 1 起待執行  
原則：依 **`docs/STABLE-BASELINE.md`** — 加法優先、小步提交、**不更動首頁靈感牆核心**（篩選、卡片、lightbox 互動邏輯）。

---

## 一、為什麼做（四根支柱）

| # | 支柱 | 要解決的問題 |
|---|------|----------------|
| 1 | **後端模組化** | `server.js` 萬行級、路由與業務混在一起，改一處易踩全域 |
| 2 | **URL／檔案／公開狀態單一模型** | `show_on_homepage`、`visibility`、雙 URL（inspiration vs detail）各說各話 |
| 3 | **可索引頁分類** | 新 UGC 應走已驗證的 `/inspiration/:type/:id` SSR，避免又多一套空殼 CSR 頁 |
| 4 | **Capabilities 驅動三區 IA** | 訂製／製造商／產業供應商並存，選單與 API 需單一真相 |

**不採用**：全站 Next.js、微服務拆分、一次大重構。

---

## 二、風險與緩解（執行前必讀）

| 風險等級 | 何時發生 | 緩解 |
|----------|----------|------|
| **低** | 一次只動一項；先更新本檔對照表；拆路由時只搬運不改邏輯 | 每步部署後跑「冒煙清單」（§七） |
| **中** | 同 PR 改 URL + sitemap + DB 欄位 + 選單 | 拆成多個 commit／PR |
| **高** | 刪舊 URL 無 301；改靈感牆核心；`visibility` migration 未跑就改 sitemap | 禁止；GSC 提交維持 **`docs/SEO-PROGRESS.md`** 暫緩 |

### 2.1 各支柱專屬風險

**① 拆 `server.js`**

- 路由順序錯誤（例如動態路由被 `express.static` 蓋掉）→ 拆出檔案後在 `server.js` **明確註冊順序**，靈感牆／vendor SSR **仍在 static 之前**。
- 漏 `require` 共用依賴（`supabase`、`BASE_URL`）→ 第一刀只拆 **sitemap**（§六 Step 1）。

**② 公開狀態**

- 雙 URL 重複索引 → 政策：**可索引 canonical = `/inspiration/...`**（§四）。
- `sitemap-products.xml` 查 `visibility='public'` 但欄位／寫入未齊 → Step 4 前先做 migration 與寫入對照。

**③ 可索引頁**

- 草稿被收錄 → 僅 `show_on_homepage === true`（且排除測試帳）進 `sitemap-inspiration.xml`。
- **禁止**為此改首頁卡片點擊／lightbox 行為（基線）。

**④ Capabilities**

- 選單漏連結 → **只加區塊、不刪既有 href**；`industry_supplier` 未就緒前恆 `false`。

---

## 三、建議執行順序（明天起可照做）

> **逐步操作（勾選、驗證、commit、部署）**：👉 **`docs/architecture-optimization-runbook.md`**

| 階段 | 內容 | 程式改動 | 預估 |
|------|------|----------|------|
| **Step 0** | 對照表定稿、程式稽核、判斷結論（§四、§4.5） | ✅ 2026-05-26 | — |
| **Step 1** | 拆 `routes/sitemap.js`（搬運不改邏輯） | 小 | 第 1 天上午 |
| **Step 2** | 暫停 `sitemap-products` 索引 + `SEO-PROGRESS.md` | 小 | 第 1 天下午 |
| **Step 3** | 擴充 `GET /api/me/capabilities` + 選單「只加不減」 | 小 | 第 2 天 |
| **Step 4** | `visibility` migration（若需要）+ canonical | 中 | 第 3～4 天（可選） |
| **Step 5** | 續拆 `routes/inspiration.js`、`routes/media-wall.js`… | 中 | 持續 |

**不要**在 Step 0～2 完成前做 Step 4 的大規模資料批次更新。

---

## 四、URL／檔案／靜態掛載對照表（單一真相）

> Express 掛載順序（摘要）：特殊路由（`/inspiration`、`vendor-profile?id`）→ `static('public')` → `static('client')` 根目錄 → …  
> **同一 URL 若 `public/client` 與根目錄 `client` 皆有檔名，以 `public` 先匹配者為準。**

### 4.1 靜態目錄與掛載順序（稽核確認）

`server.js` 關鍵順序（簡化）：

1. `GET /inspiration/:type/:id`（SSR）  
2. `GET /vendor-profile.html?id=`（動態 meta）  
3. `GET /custom/gallery.html`（可選動態）  
4. 各 `GET /sitemap*.xml`、`/robots.txt`  
5. `express.static('public')` → URL = `public/` 下相對路徑  
6. `express.static('client')` 掛在 **`/client`** → URL = 根目錄 **`client/`** 下檔案  

| URL 前綴 | 實際讀取目錄 | 備註 |
|----------|--------------|------|
| `/`、`/custom-product.html` 等 | `public/` | 首頁本體在 `public/iStudio-1.0.0/index.html` |
| `/client/manufacturer-*.html` 等 | **`public/client/`**（優先） | 與根目錄 `client/` 同名時 **public 先贏** |
| `/client/my-custom-products.html`、`custom-product-detail.html` 等 | 根目錄 **`client/`** | **僅**在 `public/client/` 無同名檔時由此提供 |
| `/admin/*` | 多為 `public/admin/`（同上規則） | 另有 `static('admin')` 後備 |

### 4.1b `/client/` 檔案分流表（Step 0 稽核）

| 檔案 | 正式編輯位置 | 說明 |
|------|--------------|------|
| `manufacturer-portfolio.html` | **`public/client/`** | `.cursor/rules/manufacturer-portfolio.mdc` |
| `manufacturer-dashboard.html` | **`public/client/`** | 同上 |
| `manufacturer-materials.html` | **`public/client/`** | 同上 |
| `manufacturer-inquiries.html` | **`public/client/`** | 同上 |
| `supplier-portal.html` | **`public/client/`** | 供應商入口（規劃中擴充） |
| `my-custom-products.html` | 根目錄 **`client/`** | 勿只改 `public/client` |
| `custom-product-detail.html` | 根目錄 **`client/`** | 無 SSR；見 §4.5 |
| `dashboard.html`、`demands.html` 等 | 根目錄 **`client/`** | 訂製／發案者後台 |

**新功能預設**：可索引頁 → **server 動態 HTML**；表單／工具 → **`public/`**；製造商後台 → **`public/client/`**。

### 4.2 主要對外 URL（執行時維護此表）

| 對外 URL | 實體來源 | SSR／動態 meta | 進 sitemap | 公開／收錄條件（現況） | 目標政策 |
|----------|----------|----------------|------------|----------------------|----------|
| `/` | `public/iStudio-1.0.0/index.html` | 靜態 meta；牆內容 JS | `sitemap-pages` | 公開 | 不動核心 |
| `/inspiration/user_design/:id` | **`server.js` L1194+ 動態 HTML** | ✅ keywords、OG、CreativeWork | `sitemap-inspiration` | 見 §4.3（含 `null` 舊列） | **UGC 可索引唯一推薦 URL** |
| `/inspiration/comparison\|series\|collection/:id` | 同上 | ✅ | `sitemap-inspiration` | 廠商作品／系列／資料夾 | 同上 |
| `/client/custom-product-detail.html?id=` | 根目錄 **`client/custom-product-detail.html`** | ❌ 通用 title | ~~sitemap-products~~ **已自索引移除**（2026-05-26） | 登入後找廠 | **canonical → inspiration**（Step 4） |
| `/custom-product.html` | `public/custom-product.html` | 靜態 meta | `sitemap-pages` | 工具頁 | 不當 per-design 索引 |
| `/vendor-profile.html?id=` | `public/vendor-profile.html` | ✅ 有 id 時 server 注入 | `sitemap-vendors` | `manufacturers.is_active` | 維持 |
| `/custom/gallery.html` | `public/custom/gallery.html` | 靜態 | `sitemap-pages` | 公開 | 維持 |
| `/vendors.html` | `public/vendors.html` | 靜態 | 手動／pages | 公開 | 維持 |

### 4.3 公開狀態欄位（現況 vs 目標）

| 欄位／概念 | 用途（現況） | 缺口 | 目標（Step 2～4） |
|------------|--------------|------|------------------|
| `custom_products.show_on_homepage` | 媒體牆 API、`sitemap-inspiration` | 寫入規則不一致（見下） | 定義為 **「靈感牆＋可收錄」** |
| `custom_products.visibility` | **僅** `sitemap-products.xml` 查 `public` | **repo 內無 migration SQL**；`POST` 未寫入 | **建議廢止 products sitemap 或 Step 4 才補欄** |
| `manufacturer_portfolio.show_on_media_wall` | 牆上廠商作品、sitemap | — | 維持 |
| 免費／付費與公開 | 見 §4.5 | 與行銷文案「150 點換公開」需對齊 | Step 2 定案 |

**`show_on_homepage` 寫入規則（程式實際行為，2026-05-26）：**

| 路徑 | 行為 |
|------|------|
| `POST /api/generate-product-image` 自動 insert | 免費訂閱 → `true`；**付費訂閱 → `false`** |
| `POST /api/custom-products` 手動儲存 | **一律 `show_on_homepage: true`**（`server.js` insertPayload） |
| `PATCH /api/custom-products/:id` | 可改；設為 `false` 時需**付費會員** |
| `GET /api/media-wall` | `show_on_homepage = true` **或 `null`**（舊資料也會上牆） |
| `sitemap-inspiration`（user_design） | 同媒體牆：`true` **或 `null`**，最多 50 筆 |
| `GET /api/media-wall-item`（獨立 URL） | **不檢查** `show_on_homepage`；有圖即可開（知道 id 就能看） |

**建議目標狀態機（規劃，實作時再定欄位名）：**

```text
draft →（付費或預設）→ wall_visible（show_on_homepage）
                    → indexable（進 sitemap-inspiration，SSR URL 固定）
```

不必一次新增三欄；可先 **行為上** 只用 `show_on_homepage` + `/inspiration/` 達成 indexable。

### 4.4 可索引頁決策（Step 2 定案用）

| 頁型 | 範例 | 處理方式 |
|------|------|----------|
| **A. 可索引內容頁** | `/inspiration/*` | Server 組 HTML；分享／sitemap 只用此 URL |
| **B. 工具／表單頁** | `custom-product.html`、登入 | 靜態 meta 即可，不 per-item |
| **C. 半套 CSR 詳情** | `custom-product-detail?id=` | **不再新增**；舊鏈 301 或 canonical 到 A（Step 4） |

---

## 4.5 Step 0 判斷結論（2026-05-26 程式稽核）

以下為 Step 0 產出：**明天 Step 1～2 可直接照此執行**，無需再猜檔案位置。

### 總體判斷

| 支柱 | 是否值得做 | Step 0 結論 |
|------|------------|-------------|
| ① 拆 `server.js` | **是** | 風險低；第一刀 sitemap 與靈感牆 SSR 無耦合，適合明天開始 |
| ② URL／公開狀態 | **是，且應先做政策再寫碼** | 現況**有明顯不一致**（見下）；不先統一會越改越亂 |
| ③ 可索引頁 = `/inspiration/` | **是** | 已實作 SSR；應**停止擴張** `sitemap-products` / detail 頁 SEO |
| ④ Capabilities 三區 | **是，可 Step 3** | API 已有雛形；與 B 線／供應商頁無衝突 |

**整體風險**：若依 Step 1→2→3 順序、**不改靈感牆互動**，屬 **低～中**；最大坑是 **`visibility` 與雙 URL**，Step 2 用「文件＋小改 sitemap」即可避開，不必等 Step 4。

### 必須知道的五個事實（稽核）

1. **`visibility` 欄位**：程式只在 `sitemap-products.xml` 使用；**專案內無 `add-custom-products-visibility.sql`**。雲端若未手動加欄，該 sitemap **恆為空或查詢失敗** → **不應再當主要索引管道**。  
2. **可索引 UGC 請只用** `/inspiration/user_design/{uuid}`：已有 meta／tags／canonical；分享連結亦應以此為準（首頁卡片已支援）。  
3. **`/client/custom-product-detail.html`**：根目錄 `client/`、**無** description／OG／canonical；**不適合**當 SEO 落地頁。  
4. **`show_on_homepage` 語意混亂**：手動儲存永遠 true、自動生圖才看付費；sitemap 又包含 `null` 舊列 → Step 2 應**寫死政策**，Step 4 再考慮是否收斂 `null`。  
5. **廠商頁改 `public/client/`**：根目錄 `client/manufacturer-portfolio.html` 若被改到，**線上不會變**（public 優先）。

### Step 2 建議定案（可直接採用）

| 決策 | 建議 |
|------|------|
| **對外可索引 URL** | 僅 **`/inspiration/{type}/{id}`** |
| **`sitemap-products.xml`** | **暫停收錄新 URL**（或自索引移除 products 子 sitemap，保留檔案以免舊連結 404） |
| **`custom-product-detail`** | 保留給**登入後找廠**；SEO 不投資；日後可加 `<link rel="canonical" href="/inspiration/...">`（Step 4） |
| **`show_on_homepage`** | 對外說明 =「出現在靈感牆且可被 sitemap 收錄」；`null` 舊資料 Step 2 **先不動 DB**，sitemap 維持現查詢 |
| **獨立 URL 未上牆仍可開** | Step 2 **僅記錄**；是否在 `media-wall-item` 擋 `show_on_homepage=false` 列為 Step 4／安全議題 |

### 明天建議動作

| 優先 | 動作 |
|------|------|
| **1** | **Step 1**：拆 `routes/sitemap.js`（§五） |
| **2** | **Step 2（小）**：`sitemap.xml` 索引暫時註解 `sitemap-products` 或加註解「待 visibility」；更新 `SEO-PROGRESS.md` 一句政策 |
| 可選 | 不必等 Step 4 才做 Step 1 |

### 暫不建議明天做

- 全面搬移 `client/` → `public/client/`（易漏檔、與規則衝突）  
- 新增 `visibility` migration 並批次改資料（留 Step 4）  
- 改首頁 lightbox／卡片篩選邏輯（違反 STABLE-BASELINE）  
- 提交 Google Search Console（`SEO-PROGRESS.md` 仍建議內容穩定後）

---

## 五、後端模組化路線圖（Step 1 起）

### 5.1 目標結構（漸進達成，非一次到位）

```text
server.js                 # listen、global middleware、掛載 routes
routes/
  sitemap.js              # Step 1：/sitemap*.xml、robots 若在同區
  inspiration.js          # Step 5：GET /inspiration/:type/:id
  media-wall.js           # GET /api/media-wall、media-wall-item
  vendor-pages.js         # vendor-profile 動態 OG
  custom-products.js      # 訂製 CRUD、enrich 觸發（後續）
lib/                      # 已有 visual-semantics、lineage…
```

### 5.2 Step 1 具體做法（第一個 commit）

1. 新增 `routes/sitemap.js`，匯出 `function registerSitemapRoutes(app, deps)`。
2. 從 `server.js` **原樣剪下**（約 L1415～1620 一帶）：`SITEMAP_PAGES`、`escapeXml`、各 `app.get('/sitemap-…')`。
3. `deps` 至少含：`supabase`、`BASE_URL`（或 `getBaseUrl(req)`）。
4. `server.js` 在 **`express.static('public')` 之前** 呼叫 `registerSitemapRoutes(app, deps)`。
5. 驗證：`/sitemap.xml`、`/sitemap-inspiration.xml`、首頁仍正常。

**禁止 Step 1**：改 sitemap 查詢條件、改首頁、改生圖 API。

### 5.3 後續拆分優先順序

1. `inspiration.js`（與 SEO SSR 同區，邊界清）
2. `vendor-pages.js`（動態 OG）
3. `media-wall.js`（API 多但與牆相關，改動需謹慎）
4. `admin/*`、`payments/*` 依觸及頻率再拆

---

## 六、Capabilities 三區 IA（Step 3）

### 6.1 現況

- 已有 **`GET /api/me/capabilities`**（`server.js`）：偏 **製造商** + B 線 `can_import_supplier_catalog`。
- 前台 **`manufacturer-materials.html`** 已呼叫；**全站 header 三區** 尚未完全由此驅動。

### 6.2 Step 3 最小擴充（建議 JSON）

在現有回傳**加法**欄位（不破壞既有 key）：

```json
{
  "has_manufacturer": true,
  "can_import_supplier_catalog": false,
  "zones": {
    "design": true,
    "manufacturer": true,
    "industry_supplier": false
  },
  "nav": {
    "show_supplier_zone": false,
    "show_industry_catalog": false
  }
}
```

- `industry_supplier`：待 B 線 + `industry_suppliers.user_id` 就緒再改 true。
- `site-header.js`：僅控制**區塊標題／折疊**，**不刪除**任何現有連結。

### 6.3 對照文件

- 會員 IA 細項：**`docs/matchdo-todo.md` §5**
- 三角色說明：**`docs/三角色架構與AB線說明.md`**

---

## 七、每步部署後冒煙清單

- [ ] `/` 靈感牆載入、篩選、點卡片開 lightbox
- [ ] 任一作品 `/inspiration/user_design/{id}` 有 title、description、圖、canonical
- [ ] `/sitemap.xml` 五子 sitemap 可開（Step 2 後無 products）
- [ ] `/custom-product.html` 登入後可生圖、儲存
- [ ] `/client/manufacturer-portfolio.html`（**public/client**）上傳展示案例
- [ ] `/vendor-profile.html?id={uuid}` 有動態 title
- [ ] Cloud Run 部署指令見 **`.cursor/rules/deployment.mdc`**

---

## 八、與其他規劃的關係

| 文件 | 關係 |
|------|------|
| `docs/STABLE-BASELINE.md` | 不可破壞的穩定原則 |
| `docs/SEO-PROGRESS.md`、`docs/SEO-PLAN.md` | SSR、sitemap、GSC 暫緩 |
| `docs/supplier-reverse-intent-discovery-plan.md` | 新供應商功能掛在 capabilities ③ 區 |
| `docs/design-analysis-material-backtrace.md` | 語意／引用；不阻塞本 backlog Step 0～3 |
| `docs/matchdo-todo.md` | 總待辦；本檔為架構專線 |
| **`docs/architecture-optimization-runbook.md`** | **逐步執行手冊**（明天照勾選做） |

---

## 九、執行勾選（自行更新日期）

| Step | 內容 | 完成日 | 備註 |
|------|------|--------|------|
| 0 | 對照表 + 程式稽核 + §4.5 判斷 | 2026-05-26 | |
| 1 | `routes/sitemap.js` 上線 | 2026-05-26 | |
| 2 | 索引政策／products sitemap 決策 | 2026-05-26 | 已自 `/sitemap.xml` 移除 products |
| 3 | capabilities + header 加法 | 2026-05-26 | zones/nav；③ 區暫隱 |
| 4 | visibility 與 canonical 對齊 | | |
| 5 | 續拆 inspiration / media-wall | | |

---

## 十、修訂紀錄

| 日期 | 說明 |
|------|------|
| 2026-05-26 | 初版：四支柱、風險、Step 0～5、URL 對照表、capabilities 最小 JSON、冒煙清單 |
| 2026-05-26 | **Step 0 完成**：`/client` 分流表、`show_on_homepage` 實際規則、`visibility` 缺口、§4.5 判斷與 Step 2 定案建議 |
| 2026-05-26 | **Step 2 完成**：`/sitemap.xml` 不再索引 `sitemap-products`；`SEO-PROGRESS.md`、`sitemap.md` 政策更新 |
| 2026-05-26 | **Step 3 完成**：`GET /api/me/capabilities` 加 `zones`／`nav`；header 依 `show_supplier_zone` 隱藏 ③ 區 |
