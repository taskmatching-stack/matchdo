# SEO 實作進度摘要

> **更新日期**：2026-03-01  
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
| `public/custom/gallery.html` | ❌ 僅基本 desc | ❌ | ❌ | ❌ | ❌ |
| `public/vendor-profile.html` | ❌ 無 | ❌ | ❌ | ❌ | ❌ |

### ✅ Phase SEO-2：Canonical + Hreflang（隨 Phase SEO-1 完成）

### ✅ Sitemap 調整（2026-03-01 完成）

| 調整項目 | 說明 |
|---------|------|
| 移除殼頁 | 從 `SITEMAP_PAGES` 移除無實際內容的 iStudio 範本頁：`service`、`feature`、`project`、`testimonial`、`team` |
| 新增 `sitemap-collections.xml` | 動態查詢 `media_collections`（`is_active=true`），自動收錄所有作品系列頁 `/custom/collection.html?slug=XXX` |
| sitemap 索引更新 | `/sitemap.xml` 已加入第四個子 sitemap `sitemap-collections.xml` |

**目前四個子 sitemap 更新機制：**

| Sitemap | 來源 | 更新方式 |
|---------|------|---------|
| `sitemap-pages.xml` | `SITEMAP_PAGES` 陣列（`server.js`） | 新增靜態頁需手動補 |
| `sitemap-vendors.xml` | `manufacturers` 表（`is_active=true`） | ✅ 自動 |
| `sitemap-products.xml` | `custom_products` 表（`visibility='public'`） | ✅ 自動 |
| `sitemap-collections.xml` | `media_collections` 表（`is_active=true`） | ✅ 自動 |

### ✅ Phase SEO-3：JSON-LD 結構化資料（主要頁面完成）

| 頁面 | Schema 類型 |
|------|------------|
| 首頁 | `Organization` + `WebSite`（含 SearchAction 站內搜尋框） |
| `custom/index.html` | `WebPage` + `SearchAction` |
| `custom-product.html` | `WebPage` |
| `remake/index.html` | `WebPage` |
| `subscription-plans.html` | `Product` + `Offer` |
| `vendors.html` | `CollectionPage` |
| `vendor-profile.html` | ❌ 待加 `LocalBusiness` |
| `custom/gallery.html` | ❌ 待加 `CollectionPage` |

### ✅ 新頁面：`/vendors.html` 廠商列表頁（已新增）

### ✅ 新頁面：`/vendor-profile.html` 廠商詳情頁（已建立，待補 SEO）

- 動態顯示廠商名稱、介紹、聯絡方式、作品集
- 站內聯絡廠商按鈕（有 user_id 才顯示）
- **SEO meta / JSON-LD 尚未加入**

### ✅ 新頁面：`/custom/gallery.html` 圖庫找廠商（已建立，待補 SEO）

- 分類從 `custom_product_categories` 資料庫動態載入（含子分類）
- 地區依時區 / 語系智慧排序（從 `service_areas` API 載入）
- 多語系支援（`?lang=en` 切換中英文）
- **SEO meta / JSON-LD 尚未加入**

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

### ❌ 優先 4：Google Search Console 提交 Sitemap

部署後需執行：
1. 前往 https://search.google.com/search-console
2. 資源已驗證（matchdo.cc）
3. 左側「Sitemap」→ 新增 `https://matchdo.cc/sitemap.xml`

### ✅ 選擇性：Favicon Apple Touch Icon（2026-03-01 完成）

`public/img/apple-touch-icon.png` 已存在；首頁已補上完整 favicon 組合：

```html
<link rel="icon" href="/img/favicon.ico">
<link rel="icon" type="image/png" sizes="32x32" href="/img/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/img/favicon-16x16.png">
<link rel="apple-touch-icon" href="/img/apple-touch-icon.png">
```

其餘主要頁面（`gallery.html`、`vendor-profile.html`、`vendors.html` 等）已含 `apple-touch-icon` 連結。

### ❌ 選擇性：資料庫搜尋效能索引（待人工在 Supabase 執行）

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_manufacturers_name ON public.manufacturers(name);
CREATE INDEX IF NOT EXISTS idx_manufacturers_name_desc_trgm
    ON public.manufacturers USING GIN ((name || ' ' || coalesce(description,'')) gin_trgm_ops);
```

---

## 三、驗證工具

| 工具 | 用途 | 網址 |
|------|------|------|
| Google Rich Results Test | 驗證 JSON-LD | https://search.google.com/test/rich-results |
| Facebook Sharing Debugger | 驗證 OG 圖片 | https://developers.facebook.com/tools/debug/ |
| PageSpeed Insights | Core Web Vitals | https://pagespeed.web.dev/ |
| Google Search Console | 提交 Sitemap | https://search.google.com/search-console |

---

## 四、部署流程

### 步驟 1：本機推上 GitHub

```bash
git add .
git commit -m "說明這次改了什麼"
git push origin main
```

### 步驟 2：Cloud Run 更新（Google Cloud Shell）

```bash
cd ~/matchdo && git pull origin main && gcloud run deploy matchdo --source . --region=asia-northeast1 --allow-unauthenticated --clear-base-image
```

---

## 五、圖片路徑規範

| 用途 | 正確路徑 |
|------|---------|
| OG 圖片 | `/img/og-*.jpg` |
| Logo | `/img/matchdo-logo.png` |
| Favicon | `/img/favicon.ico` |
| 分類預設圖 | `/img/categories/default-project.svg` |

> ⚠️ 舊路徑 `/images/` 和 `/iStudio-1.0.0/img/`（非 categories）皆已廢棄，不要再用。
