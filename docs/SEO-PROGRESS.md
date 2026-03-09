# SEO 實作進度摘要

> **更新日期**：2026-03-05  
> **網域**：https://matchdo.cc  
> **完整規劃**：`docs/SEO-PLAN.md`  
> **推送／部署步驟**：見下方「四、部署流程」

---

## 一、已完成項目

### ✅ Phase SEO-1：Meta 標籤（主要頁面完成）

所有主要頁面均已加入：`meta description`、Open Graph、Twitter Card、canonical、hreflang

| 頁面檔案 | description | OG | Twitter | canonical | hreflang |
|---------|:-----------:|:--:|:-------:|:---------:|:--------:|
| `public/iStudio-1.0.0/index.html` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `public/custom/index.html` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `public/custom-product.html` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `public/remake/index.html` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `public/subscription-plans.html` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `public/vendors.html` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `public/custom/gallery.html` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `public/vendor-profile.html` | ✅（動態由 JS 更新） | ✅ | ✅ | ✅ | ✅ |

### ✅ Phase SEO-2：Canonical + Hreflang（隨 Phase SEO-1 完成）

### ✅ Sitemap 調整（2026-03-01 完成；2026-03-04 首頁篩選 URL）

| 調整項目 | 說明 |
|---------|------|
| 移除殼頁 | 從 `SITEMAP_PAGES` 移除無實際內容的 iStudio 範本頁：`service`、`feature`、`project`、`testimonial`、`team` |
| 新增 `sitemap-collections.xml` | 動態查詢 `media_collections`（`is_active=true`），自動收錄所有作品系列頁 `/custom/collection.html?slug=XXX` |
| sitemap 索引更新 | `/sitemap.xml` 現含六個子 sitemap：pages、categories、vendors、products、collections、**inspiration**（靈感牆獨立 URL） |
| **首頁篩選 URL（2026-03-04）** | 首頁網址狀態可**疊加**：`layout_type`、`category_key`、`subcategory_key`、`q`、`lang`。Sitemap 收錄主要 landing，不列所有組合。 |
| **首頁四種「類型」** | **全部**＝`/`；**設計圖／對照圖／系列圖**＝`/?layout_type=user_design|comparison|collection`（共 4 筆在 `sitemap-pages.xml`） |
| **中英文** | `sitemap-pages.xml` 另加 4 筆：`/?lang=en`、`/?layout_type=user_design&lang=en`、`/?layout_type=comparison&lang=en`、`/?layout_type=collection&lang=en`，與頁面 hreflang 對應 |
| **分類** | 動態 `sitemap-categories.xml`：從 `ai_categories` 查主分類，產出 `/?category_key=xxx`（與 layout_type／lang 可疊加，sitemap 只列主分類 landing） |
| **Canonical** | 首頁有篩選參數時 canonical 為目前完整網址；無參數時為 `https://matchdo.cc/`（見 `index.html` 內 `#mw-canonical`） |

**目前六個子 sitemap 更新機制：**

| Sitemap | 來源 | 更新方式 |
|---------|------|---------|
| `sitemap-pages.xml` | `SITEMAP_PAGES` 陣列（`server.js`） | 新增靜態頁或首頁篩選 URL 需手動補 |
| `sitemap-categories.xml` | `ai_categories` 表（主分類 key） | ✅ 自動 |
| `sitemap-vendors.xml` | `manufacturers` 表（`is_active=true`） | ✅ 自動 |
| `sitemap-products.xml` | `custom_products` 表（`visibility='public'`） | ✅ 自動 |
| `sitemap-collections.xml` | `media_collections` 表（`is_active=true`） | ✅ 自動 |
| `sitemap-inspiration.xml` | 靈感牆項目（user_design / comparison / series / collection） | ✅ 自動（2026-03-05） |

### ✅ Phase SEO-3：JSON-LD 結構化資料（主要頁面完成）

| 頁面 | Schema 類型 |
|------|------------|
| 首頁 | `Organization` + `WebSite`（含 SearchAction 站內搜尋框） |
| `custom/index.html` | `WebPage` + `SearchAction` |
| `custom-product.html` | `WebPage` |
| `remake/index.html` | `WebPage` |
| `subscription-plans.html` | `Product` + `Offer` |
| `vendors.html` | `CollectionPage` |
| `vendor-profile.html` | ✅ `LocalBusiness`（動態） |
| `custom/gallery.html` | ✅ `CollectionPage` |

### ✅ 新頁面：`/vendors.html` 廠商列表頁（已新增）

### ✅ 新頁面：`/vendor-profile.html` 廠商詳情頁（SEO 已補，見優先 1）

- 動態顯示廠商名稱、介紹、聯絡方式、作品集；meta／OG／LocalBusiness 由 JS 依廠商資料更新。

### ✅ 新頁面：`/custom/gallery.html` 圖庫找廠商（SEO 已補，見優先 2）

- 分類從 `custom_product_categories` 資料庫動態載入（含子分類）；meta／OG／CollectionPage 已完成。

### ✅ Navbar 全面整治（2026-03-01 完成）

| 項目 | 狀態 |
|------|------|
| Logo 圖片化（`matchdo-logo.png`） | ✅ |
| 桌機版 Logo 置中 | ✅ |
| 全站 Bootstrap JS / 字型統一注入 | ✅ |
| IIFE 渲染移除，消除跳動 + i18n 錯誤 key | ✅ |
| `localStorage` 快取用戶名字/頭像 | ✅ |

### ✅ 服務地區系統 v2（2026-03-01 完成）

| 項目 | 說明 |
|------|------|
| **DB schema** | `service_areas` 三層結構 |
| **Admin UI** | `admin/service-areas.html` 完整 CRUD |
| **前台選擇器 v2** | 台灣分組 + 海外國家，多語系 |
| **圖庫地區篩選** | `gallery.html` 依時區/語系優先排序 |

### ✅ 圖片資源

| 檔名 | 用途 |
|------|------|
| `og-home.jpg` | 首頁 OG 圖 |
| `og-custom.jpg` | 客製產品頁 OG 圖 |
| `og-design.jpg` | 產品設計頁 OG 圖 |
| `og-remake.jpg` | 再製方案頁 OG 圖 |
| `og-plans.jpg` | 訂閱方案頁 OG 圖 |
| `og-vendors.jpg` | 廠商列表頁 OG 圖 |

### ✅ Google 網站行為分析（GA4）（2026-03-05）

| 項目 | 說明 |
|------|------|
| **前台載入** | `public/js/ga4-loader.js` 從 `GET /api/config/ga4` 取得衡量 ID，有值則動態注入 gtag 並送 page_view |
| **涵蓋範圍** | 首頁、產品設計、訂閱方案、廠商列表、客製產品等主要頁面直接掛載；其餘使用共用導覽的頁面由 `site-header.js` 動態注入，全站覆蓋 |
| **後台設定** | 後台「網站設定」→「GA4 衡量 ID」填寫 `G-XXXXXXXXXX` 並儲存後即生效；無需改 HTML |
| **文件** | `docs/user-manual.md` 已新增「Google 網站行為分析（GA4）」說明 |

### ✅ 聯絡信箱統一為 support@matchdo.cc（2026-03-05）

頁腳 partial、`site-footer.js` fallback、首頁 Organization JSON-LD 的 `contactPoint`、about／contact／feature／service 等對外頁面聯絡信箱與「Contact Us」連結均已改為 **support@matchdo.cc**。

---

## 二、待完成項目（優先順序）

### ✅ 優先 1：`vendor-profile.html` 補 SEO 標籤（2026-03-01 完成）

- `meta description`（動態：廠商名稱 + 專長） ✅
- Open Graph / Twitter Card（動態：廠商封面圖） ✅
- canonical ✅
- hreflang ✅
- **`LocalBusiness` JSON-LD**（名稱、地址、電話、網址、圖片）✅

### ✅ 優先 2：`custom/gallery.html` 補 SEO 標籤（2026-03-01 完成）

- `meta description`（完整描述） ✅
- Open Graph / Twitter Card ✅
- canonical ✅
- hreflang ✅
- **`CollectionPage` JSON-LD** ✅

### ✅ 優先 3：Phase SEO-4：Core Web Vitals（2026-03-01 完成）

| 項目 | 說明 | 狀態 |
|------|------|------|
| 首頁媒體牆圖片加 `loading="lazy"` | 全部動態產生的 `<img>` 均補上 | ✅ |
| 非關鍵 JS 加 `defer` | script 已置於 `<body>` 尾端，位置本身等效 defer | ✅ |
| 新增 `/sitemap-products.xml` | 動態回傳 `visibility='public'` 的 custom_products 詳情頁 URL | ✅ |
| sitemap.xml 索引更新 | 已將 `sitemap-products.xml` 加入 sitemap 索引 | ✅ |

### ✅ 社群分享與廠商社群帳號（2026-03-01 完成）

| 項目 | 說明 |
|------|------|
| **Lightbox 分享按鈕** | 首頁媒體牆 lightbox 新增「分享▼」下拉（FB / IG / Threads / X / LINE / Pinterest / 複製連結），收藏+分享並排於左側 |
| **分享按鈕 i18n** | 所有分享文字加入 `data-i18n`，英文頁（`?lang=en`）自動切換至英文標籤（Share / Save to Pinterest / Copy link…） |
| **廠商個人社群帳號** | 廠商控制台新增「社群帳號」卡片（FB/IG/Threads/X/LINE/官網），可直接編輯並儲存至 `manufacturers.contact_json` |
| **後端 PATCH API** | `PATCH /api/me/manufacturer` 新增，廠商可更新 `contact_json`（含社群連結），`vendor-profile.html` 即時顯示 |
| **後台平台帳號設定** | `admin/site-settings.html` 新增平台官方社群帳號管理（FB/IG/Threads/X/LINE/YouTube/Pinterest） |
| **contact_info 欄位** | `docs/add-threads-twitter-to-contact-info.sql`：為 `contact_info` 資料表補 `threads_url`、`twitter_url` 欄位（需在 Supabase 執行） |

### ⏸ 優先 4：Google Search Console 提交 Sitemap（暫緩）

> **暫緩原因**：站上仍有大量測試 / 假資料，現在提交會讓 Google 抓到無效內容，等正式內容充實後再執行。

待執行（真實內容上線後）：
1. 前往 https://search.google.com/search-console
2. 資源已驗證（matchdo.cc）
3. 左側「Sitemap」→ 新增 `https://matchdo.cc/sitemap.xml`

### ✅ BreadcrumbList、vendor-profile 動態 OG、GA4 事件、次要頁 meta（2026-03-05 已完成）

| 項目 | 說明 |
|------|------|
| **BreadcrumbList JSON-LD** | 已加至：首頁／客製產品、產品設計、圖庫找廠商、廠商列表、廠商詳情、再製方案、再製設計、方案與定價。 |
| **vendor-profile 動態 OG** | `GET /vendor-profile.html?id=xxx` 由 server.js 依廠商 ID 查 DB，輸出動態 title／description／og:image（logo 或首張作品圖）、canonical／hreflang；無 id 時仍走靜態檔。 |
| **GA4 自訂事件** | 已加：`contact_vendor`（廠商頁／列表／圖庫 modal／系列頁）、`subscribe_plan_click`、`design_generate_click`、`remake_generate_click`。 |
| **次要頁面 meta** | collection.html、remake-product.html、login、register、no-access、404 已補 description／canonical；remake-product 與 collection 另補 OG／Twitter。 |

### 仍可優化項目（建議優先順序，2026-03-05）

| 優先 | 項目 | 說明 |
|------|------|------|
| **1** | **Google Search Console 提交 Sitemap** | 等正式內容充實後執行（見上方 ⏸ 優先 4）；提交後可查看索引狀態、搜尋成效。 |
| **2** | **英文頁 meta 文案** | 目前 `description`、`og:title`、`og:description` 多為中文；若希望英文搜尋也有對應摘要，可為 `?lang=en` 或英文版頁面提供英文 meta（或由後台／i18n 動態輸出）。 |

#### 獨立 URL 三項技術細節評估（最小幅修改可行性）

以下三點為「獨立 URL 發揮 100% 功力」的常見建議，評估是否能在**最小幅修改**下完成：

| 項目 | 現況 | 最小幅可行？ | 說明 |
|------|------|:------------:|------|
| **① 動態 OG** | 已實作。`/inspiration/:type/:id` 依 `media-wall-item` API 回傳的 `item` 動態輸出 **og:title**（目前為 `{item.title} - MATCHDO 靈感牆`）、**og:description**、**og:image**（該張圖，Supabase 圖已走 proxy）。分享到 FB/LINE 會顯示該作品標題與縮圖，非統一 Logo。 | ✅ 已達標 | 若希望標題格式改為「MatchDO｜{分類或提示詞}」可再微調字串，屬一行級修改。 |
| **② 語意化網址** | 目前為 `/inspiration/user_design/123`、`/inspiration/comparison/456`（type + id）。目標為 `/design/bespoke-oxford-shoes-9527` 這類「分類英文＋id」。 | ❌ 非最小幅 | 需：新路徑規則（如 `/design/:slug-:id` 或 `/design/:slug`）、slug 來源（從 category_key／title 產生或 DB 存 slug）、舊網址 301 重導、前端所有連結與分享改新網址、sitemap 改輸出新網址。且「分類英文」需有穩定欄位或對照表。 |
| **③ Canonical ＋ Sitemap** | **Canonical**：獨立頁 HTML 目前有 og:url，但**沒有** `<link rel="canonical">`。補上即可。**Sitemap**：已有 `sitemap-inspiration.xml` 收錄約 150 筆獨立 URL（user_design / comparison / series / collection）。 | ③a 可／③b 不可 | **③a Canonical**：在 `/inspiration/:type/:id` 輸出的 HTML 加一行 `<link rel="canonical" href="${pageUrl}">` 即完成，**最小幅**。**③b 「再設計點擊最多優先進 sitemap」**：需先有「每張圖被點擊再設計」的計數（目前無此埋點或表），再依計數排序／篩選 sitemap 清單，**非最小幅**。 |

**結論（最小幅可做）**  
- ① 已滿足；若要標題格式微調可順手做。  
- ② 語意化網址需架構與資料調整，不建議列為「最小幅」。  
- ③ **③a 加 canonical** 已於 2026-03-05 完成（`/inspiration/:type/:id` 輸出的 HTML 已含 `<link rel="canonical" href="${pageUrl}">`）；③b 等有再設計點擊資料後再排入實作。

**其餘待做（已紀錄）**  
- **① 標題格式**：可選將 og:title 改為「MatchDO｜{標題或分類}」格式（一行級）。  
- **② 語意化網址**：中長期，如 `/design/bespoke-oxford-shoes-9527`，需新路徑、slug 來源、301、前端與 sitemap 全面改。  
- **③b Sitemap 高品質優先**：需「再設計點擊」埋點與儲存，再依計數排序／篩選 sitemap 收錄。

#### 次要頁面 meta 檢查結果（2026-03-05，已補齊）

| 頁面 | description | OG | canonical | 備註 |
|------|:-----------:|:--:|:---------:|------|
| `public/custom/collection.html` | ✅ | ✅ | ✅ | 已補靜態描述與 OG |
| `public/remake-product.html` | ✅ | ✅ | ✅ | 已補 keywords、description、OG、canonical、hreflang、BreadcrumbList |
| `public/remake/index.html` | ✅ | ✅ | ✅ | 已完整 |
| `public/login.html` | ✅ | — | ✅ | 已補 description、canonical |
| `public/register.html` | ✅ | — | ✅ | 同上 |
| `public/no-access.html` | ✅ | — | ✅ | 同上 |
| `public/404.html`、`iStudio-1.0.0/404.html` | ✅ | — | — | 已補 title、description |

### ✅ 選擇性：Favicon Apple Touch Icon（2026-03-01 完成）

`public/img/apple-touch-icon.png` 已存在；首頁已補上完整 favicon 組合：

```html
<link rel="icon" href="/img/favicon.ico">
<link rel="icon" type="image/png" sizes="32x32" href="/img/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/img/favicon-16x16.png">
<link rel="apple-touch-icon" href="/img/apple-touch-icon.png">
```

其餘主要頁面（`gallery.html`、`vendor-profile.html`、`vendors.html` 等）已含 `apple-touch-icon` 連結。

### ✅ 選擇性：資料庫搜尋效能索引（2026-03-01 已在 Supabase 執行）

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_manufacturers_name ON public.manufacturers(name);
CREATE INDEX IF NOT EXISTS idx_manufacturers_name_desc_trgm
    ON public.manufacturers USING GIN ((name || ' ' || coalesce(description,'')) gin_trgm_ops);
```

---

## 三、靈感牆卡片與 SEO（分析摘要，2026-03-05）

### 3.1 現況：卡片內容是否被搜尋引擎識別？

**結論：目前靈感牆每個卡片的「描述／提示詞」幾乎沒有被用在可被搜尋引擎有效識別的語意結構上。**

| 項目 | 現況 | 對 SEO 的影響 |
|------|------|----------------|
| **卡片 HTML 來源** | 由 JS 動態產生（`renderOne()` + `/api/media-wall`），**初始 HTML 為空**（`#media-wall-grid` 內僅註解） | 爬蟲需執行 JS 才看得到內容；有延遲與預算風險，且非語意化結構 |
| **標題 (title)** | 僅放在 `<div class="card-title-overlay">` 內，**非 `<h2>`／`<h3>` 或 `<article>`** | 搜尋引擎較難將標題視為「內容標題」層級 |
| **提示詞／描述 (prompt)** | 只存在 `data-item` 的 JSON 裡（如 `generation_prompt`），**畫面上卡片沒有顯示**；lightbox 打開後才有「提示詞」欄位 | 未以可見、語意化文字出現在 DOM，不利索引與關聯 |
| **圖片 alt** | 所有卡片內 `<img>` 皆為 **`alt=""`**（空） | 圖片無法以「描述該作品」的 alt 被理解，也影響無障礙與圖片搜尋 |
| **卡片連結** | `<a href="#">`，**沒有每個作品專屬的 URL**（點擊開 lightbox） | 無法為「單一作品」建立獨立搜尋結果或 canonical URL |
| **結構化資料** | 首頁有 Organization + WebSite；**沒有 ItemList／ImageGallery 或每張卡片的 CreativeWork** | 搜尋引擎無法以「作品列表＋每則標題／描述」的結構化方式理解靈感牆 |

因此：**卡片上的「描述」並沒有被轉成可被搜尋引擎善用的語意內容**（沒有語意標籤、沒有 alt、沒有 per-item 結構化資料、也沒有獨立 URL）。

### 3.2 建議優化方向（規劃；完成狀態見 3.4、3.5）

#### A. 語意 HTML 與可見文字（優先）

- **卡片標題**：將 overlay 內標題改為 **`<h2>` 或 `<h3>`**（或外層包 `<article>`），並視情況加 `itemprop="name"` 或對應 schema 屬性，讓爬蟲明確識別「這是作品標題」。
- **提示詞／描述**：在卡片上提供**簡短可見描述**（例如前 80 字 + 「…」），放在 `<p>` 或 `<span>` 內（可預設摺疊或僅在 hover 顯示），**不要只放在 data-item**。這樣 DOM 內就有可索引的「作品描述」文字。
- **圖片 alt**：每張卡片主圖的 **`alt`** 用 **title + 簡短描述**（或至少 title），例如：`alt="作品：{title}，{prompt 前 50 字}…"`，讓圖片搜尋與無障礙都能對應到內容。

#### B. 結構化資料（JSON-LD）

- 在首頁（或靈感牆區塊）加入 **ItemList**：列出當前頁顯示的作品，每項含 `name`（title）、`description`（prompt 或簡述）、`image`、`url`（若未來有獨立 URL）。
- 或為每張卡片輸出 **CreativeWork**（或 ImageObject）：`name`、`description`、`image`，讓 Google 能理解「這是一組創作作品＋每則的標題與描述」。

#### C. 獨立 URL（中長期）

- 若希望「單一作品」能出現在搜尋結果，可為每個作品提供**可爬取的 URL**，例如：`/inspiration/{id}` 或 `/?item=xxx`，並在該 URL 的頁面（或 SSR 片段）輸出對應的 **meta description、og:title、og:description、og:image** 與 **CreativeWork** schema。  
- 目前卡片點擊只開 lightbox、無換 URL，搜尋引擎無法為「這張卡」建立獨立索引。

#### D. 與現有 SEO 文件的對應

- **SEO-PLAN.md**：Phase SEO-3 已有 JSON-LD 規劃；可在此基礎上**補「首頁靈感牆 ItemList／CreativeWork」**一項。
- **SEO-PROGRESS.md**：本節（三、靈感牆卡片與 SEO）可作為後續實作時的檢查清單；實作完成後再於「一、已完成項目」或「二、待完成」中更新狀態。

### 3.3 小結

| 優化項 | 難度 | 效益 | 備註 |
|--------|------|------|------|
| 圖片 `alt` 用 title／描述 | 低 | 高 | 立即改善圖片與無障礙 |
| 卡片標題改為 `<h2>`／`<article>` | 低 | 中 | 語意明確 |
| 卡片上顯示簡短描述（可見文字） | 中 | 高 | 描述才真正進入索引 |
| 首頁 ItemList / CreativeWork JSON-LD | 中 | 高 | 需與 API 資料對應 |
| 每張卡片獨立 URL + meta + schema | 高 | 很高 | 需路由與後端或 SSR |

**目前卡片描述確實未應用到 SEO；以上順序可作為實作優先順序參考。**

### 3.4 已實作項目（2026-03-05）

| 項目 | 說明 |
|------|------|
| 語意標籤 | 每張卡片外層改為 `<article class="card">`，標題改為 `<h2>` 包在 `.card-title-overlay` 內，樣式不變 |
| 圖片 alt | 所有卡片主圖／對照圖／系列圖均填入描述性 `alt`（標題 + 簡短描述，最多約 150 字元） |
| 可見描述（供爬蟲） | 每張卡片在 DOM 內加入 `<span class="media-wall-seo-desc">`，內容為「描述：」+ 簡短描述，以 CSS 視覺隱藏（不影響版面） |
| JSON-LD ItemList | 首頁靈感牆首次載入後，動態注入 `script#media-wall-itemlist-ld`，內容為 schema.org **ItemList**，每筆為 **ListItem** + **CreativeWork**（name、description、image），最多 50 筆 |

以上改動均不影響現有版面與操作（點擊、收藏、篩選、lightbox 等維持不變）。

### 3.5 完成度與接下來要做什麼

| 建議優化方向 | 狀態 | 說明 |
|--------------|------|------|
| **語意 HTML**：`<h2>`／`<article>` | ✅ 已完成 | 見 3.4 |
| **圖片 alt**：title + 簡短描述 | ✅ 已完成 | 見 3.4 |
| **卡片上描述**：不要只放在 data-item | ✅ 已做（DOM 隱藏） | 以 `media-wall-seo-desc` 視覺隱藏 span 提供可索引描述；若要做「畫面上可見」的簡短描述（如 hover 或摺疊），可再補 |
| **JSON-LD**：ItemList／CreativeWork | ✅ 已完成 | 見 3.4 |
| **獨立 URL**：如 `/inspiration/:type/:id` | ✅ 已完成（2026-03-05） | 見 3.6 |

**接下來要做的事**（可選）：~~若需讓「單一作品」進 sitemap~~ → **✅ 已完成**：已動態產出 `sitemap-inspiration.xml`，並加入 sitemap 索引（見上方「一、已完成項目」Sitemap 表）。

### 3.6 獨立 URL 實作摘要（2026-03-05）

| 項目 | 說明 |
|------|------|
| **URL 格式** | `/inspiration/:type/:id`（type＝user_design、comparison、series、collection） |
| **後端** | `GET /inspiration/:type/:id` 回傳 HTML，含 meta、og:*、CreativeWork JSON-LD；body 內導向 `/?item=type-id` |
| **API** | `GET /api/media-wall-item/:type/:id` 回傳單一作品 |
| **前端** | 卡片 `href="/inspiration/type/id"`；點擊開 lightbox；首頁 `?item=type-id` 時 fetch 並開 lightbox，replaceState 清參數 |
| **社群分享** | lightbox 分享 URL 改為該作品獨立 URL |

（以下為原規劃說明，獨立 URL 已實作完成，保留供參考。）

- **獨立 URL（中長期）**（已完成）：為每張作品提供可爬取的 URL（例如 `/inspiration/{id}` 或 `/?item=xxx`），並在該頁輸出：
  - **Meta**：`description`、`og:title`、`og:description`、`og:image`、`og:url`
  - **Schema**：單一作品的 **CreativeWork** JSON-LD  
  這樣搜尋引擎與**社群分享**才能對應到「這一張作品」。
- **社群分享是否該用獨立 URL？**  
  **建議要。** 有獨立 URL 後，分享連結應指向該作品頁（例如 `https://matchdo.cc/inspiration/123`），該頁的 OG 標籤才會是「這張作品的標題、描述、圖片」，在 FB／LINE／Twitter 上顯示正確預覽。目前卡片點擊只開 lightbox、不換網址，分享整頁只會是首頁的 OG，無法「分享單一作品」。實作獨立 URL 時，一併讓「分享這張」按鈕（若有）帶出該作品頁的 URL 即可。

---

## 四、驗證工具

| 工具 | 用途 | 網址 |
|------|------|------|
| Google Rich Results Test | 驗證 JSON-LD | https://search.google.com/test/rich-results |
| Facebook Sharing Debugger | 驗證 OG 圖片 | https://developers.facebook.com/tools/debug/ |
| PageSpeed Insights | Core Web Vitals | https://pagespeed.web.dev/ |
| Google Search Console | 提交 Sitemap | https://search.google.com/search-console |

---

## 五、部署流程

### 步驟 1：本機推上 GitHub

```bash
git add .
git commit -m "說明這次改了什麼"
git push origin main
```

### 步驟 2：Cloud Run 更新（Google Cloud Shell）

- 後端已改為**啟動即 listen PORT**（避免 Cloud Run 啟動逾時）；首頁篩選（設計圖／對照圖／系列圖）與網址狀態綁定已上線。
- 在 **Google Cloud Shell** 執行（見 `.cursor/rules/deployment.mdc`）：

```bash
cd ~/matchdo && git fetch origin main && git reset --hard origin/main && gcloud run deploy matchdo --source . --region=asia-northeast1 --allow-unauthenticated --clear-base-image
```

---

## 六、圖片路徑規範

| 用途 | 正確路徑 |
|------|---------|
| OG 圖片 | `/img/og-*.jpg` |
| Logo | `/img/matchdo-logo.png` |
| Favicon | `/img/favicon.ico` |
| 分類預設圖 | `/img/categories/default-project.svg` |

> ⚠️ 舊路徑 `/images/` 和 `/iStudio-1.0.0/img/`（非 categories）皆已廢棄，不要再用。
