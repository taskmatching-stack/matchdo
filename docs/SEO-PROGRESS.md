# SEO 實作進度摘要

> **更新日期**：2026-02-25  
> **網域**：https://matchdo.cc  
> **完整規劃**：`docs/SEO-PLAN.md`  
> **推送／部署步驟**：見下方「四、部署流程」

---

## 一、已完成項目

### ✅ Phase SEO-1：Meta 標籤（全部完成）

所有主要頁面均已加入：`meta description`、Open Graph、Twitter Card、canonical、hreflang

| 頁面檔案 | description | OG | Twitter | canonical | hreflang |
|---------|:-----------:|:--:|:-------:|:---------:|:--------:|
| `public/iStudio-1.0.0/index.html` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `public/custom/index.html` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `public/custom-product.html` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `public/remake/index.html` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `public/subscription-plans.html` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `public/vendors.html` | ✅ | ✅ | ✅ | ✅ | ✅ |

### ✅ Phase SEO-2：Canonical + Hreflang（隨 Phase SEO-1 完成）

### ✅ Phase SEO-3：JSON-LD 結構化資料（全部完成）

| 頁面 | Schema 類型 |
|------|------------|
| 首頁 | `Organization` + `WebSite`（含 SearchAction 站內搜尋框） |
| `custom/index.html` | `WebPage` + `SearchAction` |
| `custom-product.html` | `WebPage` |
| `remake/index.html` | `WebPage` |
| `subscription-plans.html` | `Product` + `Offer` |
| `vendors.html` | `CollectionPage` |

### ✅ 新頁面：`/vendors.html` 廠商列表頁（已新增）

- 依產品主分類 + 子分類標籤過濾（與首頁相同風格）
- 關鍵字搜尋（廠商名稱 / 專長）
- 廠商卡片（封面圖、名稱、專長、評分、地點、能力標籤、認證 badge）
- 載入更多（每次 12 筆）
- `server.js /api/manufacturers` 已擴充 `q` 關鍵字搜尋參數

### ✅ 圖片資源（路徑與清單已整理，尚未推上 GitHub）

所有圖片應放在 `public/img/`，請記得 **commit 並 push**（步驟見「四、部署流程」）：

| 檔名 | 用途 |
|------|------|
| `og-home.jpg` | 首頁 OG 圖 |
| `og-custom.jpg` | 客製產品頁 OG 圖 |
| `og-design.jpg` | 產品設計頁 OG 圖 |
| `og-remake.jpg` | 再製方案頁 OG 圖 |
| `og-plans.jpg` | 訂閱方案頁 OG 圖 |
| `og-vendors.jpg` | 廠商列表頁 OG 圖 |
| `matchdo-logo.png` | 橫式 Logo（Match+DO）|
| `logo-schema.png` | Google 結構化資料用 Logo |
| `matchdo.png` | 備用 Logo |
| `favicon.ico` | 瀏覽器分頁圖示 |

**OG 圖片路徑**：所有 HTML 統一使用 `/img/og-*.jpg`（已修正舊的 `/images/` 錯誤路徑）

---

## 二、待完成項目

### ❌ 將 `public/img/` 圖片推上 GitHub

本機已放好 OG 圖、Logo、favicon 等檔案後，請依「四、部署流程」執行：

```bash
git add public/img/
git commit -m "加入 OG 圖、Logo、favicon 至 public/img"
git push origin main
```

### ❌ Phase SEO-4：Core Web Vitals（尚未實作）

| 項目 | 說明 |
|------|------|
| 首頁媒體牆圖片加 `loading="lazy"` | `public/iStudio-1.0.0/index.html` JS 動態產生圖片時補上 |
| 非關鍵 JS 加 `defer` | jQuery、Bootstrap 等評估後加入 |
| 新增 `/sitemap-products.xml` | 動態產生已公開的 custom_products 詳情頁 URL |

### ❌ Navbar Logo 圖片化（選擇性）

目前 navbar 品牌名稱是純文字 `<h2>MatchDO 合做</h2>`（在 `public/js/site-header.js` 第 15 行）。

若要改成顯示 `matchdo-logo.png` 圖片，需修改 `site-header.js`：

```javascript
// 目前（第 15 行）
'<a href="' + brandUrl + '" class="navbar-brand ..."><h2 class="m-0 text-primary">' + t('nav.brand') + '</h2></a>'

// 改為
'<a href="' + brandUrl + '" class="navbar-brand ..."><img src="/img/matchdo-logo.png" alt="MatchDO 合做" style="height:36px;width:auto;"></a>'
```

### ❌ Favicon Apple Touch Icon（選擇性）

尚未加入 `apple-touch-icon`（手機加入主畫面書籤圖示），建議補在各頁面 `<head>`：

```html
<link rel="apple-touch-icon" href="/img/apple-touch-icon.png">
```

需製作 `180×180px` PNG 圖檔放至 `public/img/apple-touch-icon.png`

### ❌ `vendor-profile.html` 廠商詳情頁（尚未建立）

- 目前 `/vendor-profile.html?id=xxx` 點進去會 404
- 需新建此頁顯示廠商詳情：名稱、介紹、聯絡方式、作品集
- 相關 API 已有：`GET /api/manufacturers` 可加 `?id=xxx`（需確認後端支援單筆查詢）
- SEO 需動態注入 `LocalBusiness` JSON-LD（見 `docs/SEO-PLAN.md`）

### ❌ Google Search Console 提交 Sitemap

部署後需執行：
1. 前往 https://search.google.com/search-console
2. 資源已驗證（matchdo.cc）
3. 左側「Sitemap」→ 新增 `https://matchdo.cc/sitemap.xml`

### ❌ 資料庫搜尋效能索引（選擇性，廠商數量多時再做）

```sql
-- Supabase SQL Editor 執行
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

### 步驟 1：本機推上 GitHub（在 VS Code 終端機執行）

每次改完程式碼，在本機專案目錄執行：

```bash
git add .
git commit -m "說明這次改了什麼"
git push origin main
```

### 步驟 2：Cloud Run 更新（在 Google Cloud Shell 執行）

> Cloud Shell 網址：https://shell.cloud.google.com/

```bash
cd ~/matchdo && git pull origin main && gcloud run deploy matchdo --source . --region=asia-northeast1 --allow-unauthenticated --clear-base-image
```

> **說明**：
> - `cd ~/matchdo`：進入 Cloud Shell 裡的專案目錄
> - `git pull origin main`：從 GitHub 拉最新程式碼
> - `gcloud run deploy ...`：重新建置並部署到 Cloud Run
> - 部署約 3–5 分鐘，完成後網站自動更新

### ⚡ 若已設定 Cloud Build 自動觸發（push 即部署）

如果 GCP Cloud Build 觸發條件已設好，**只需執行步驟 1** push 到 GitHub，Cloud Run 會自動部署，不需手動跑步驟 2。

確認方式：GCP Console → Cloud Build → 觸發條件，若有 `main` 分支的觸發條件即代表已設好。

---

## 五、圖片路徑規範（重要，勿混淆）

| 用途 | 正確路徑 | 說明 |
|------|---------|------|
| OG 圖片 | `/img/og-*.jpg` | 放在 `public/img/` |
| Logo | `/img/matchdo-logo.png` | 放在 `public/img/` |
| Favicon | `/img/favicon.ico` | 放在 `public/img/` |
| 分類預設圖 | `/img/categories/default-project.svg` | 放在 `public/img/categories/` |

> ⚠️ 舊路徑 `/images/` 和 `/iStudio-1.0.0/img/`（非 categories）皆已廢棄，不要再用。
