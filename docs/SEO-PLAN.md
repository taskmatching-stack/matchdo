# MATCHDO SEO 優化計畫

> **建立日期**：2026-02-25  
> **狀態**：Phase SEO-1 實作中  
> **網域**：https://matchdo.cc

---

## 零、實作策略說明

### 兩階段策略

**第一階段（現在）— 硬編碼寫死**：直接把 meta 標籤寫進各 HTML 檔案。優點是改動最小、生效最快，且對社群爬蟲（Facebook、LINE、Twitter）完全有效。大部分頁面的 SEO 設定幾個月才需要調整一次，這個方式完全夠用。

**第二階段（未來，視需求）— 管理後台介面**：若未來有行銷人員需要自行調整 SEO 文案或換 OG 封面圖，再建立後台管理介面。技術上需要：
1. Supabase 新增 `seo_settings` 資料表
2. 將 `res.sendFile` 改為「讀取 HTML → 注入 meta → 回傳」的伺服器端渲染模式
3. 後台新增 SEO 管理頁

### 為何不能用 JavaScript 動態設定 OG 標籤？

| 讀取者 | 執行 JS？ | 影響項目 |
|--------|----------|---------|
| Google 爬蟲 | ✅ 會（但有延遲） | meta description、JSON-LD |
| 社群爬蟲（FB、LINE、Twitter） | ❌ 完全不執行 | og:title、og:description、og:image |

Open Graph 標籤**必須在伺服器回傳的原始 HTML 中**就存在，JS 動態插入對社群分享無效。

---

## 一、現況評估摘要

### ✅ 已有的 SEO 基礎

| 項目 | 說明 |
|------|------|
| Sitemap | `/sitemap.xml`（索引）、`/sitemap-pages.xml`（靜態頁）、`/sitemap-vendors.xml`（動態廠商頁） |
| robots.txt | 已設定，禁止爬 `/admin/`、`/api/`、`/payment/` |
| 基本 `<title>` | 各頁面有獨立標題 |
| `viewport` meta | 所有頁面已有 |
| CDN | jsDelivr、Cloudflare CDN、Google Fonts |
| URL 結構 | 語意化、無特殊字元 |

### ❌ 缺漏項目（依影響程度排序）

| 優先級 | 項目 | 影響範圍 |
|--------|------|---------|
| 🔴 高 | `meta description` 為空 | 首頁、產品設計頁 |
| 🔴 高 | Open Graph 標籤完全缺失 | 所有頁面 |
| 🟡 中 | `canonical` 標籤 | 所有頁面（多語系重複內容） |
| 🟡 中 | `hreflang` 標籤 | 所有中英文頁面 |
| 🟡 中 | JSON-LD 結構化資料 | 首頁、廠商頁、產品頁 |
| 🟢 低 | 圖片 `loading="lazy"` | 首頁媒體牆 |
| 🟢 低 | JS `defer`/`async` | 多個頁面 |
| 🟢 低 | Twitter Card 標籤 | 所有頁面 |

---

## 二、實作計畫

---

### Phase SEO-1：Meta 標籤補齊（🔴 最高優先）

**目標**：補齊所有主要頁面的 description 與 Open Graph 標籤。

#### 各頁面規劃

| 頁面檔案 | title（現有） | description（待補） | og:image | 狀態 |
|---------|--------------|-------------------|---------|------|
| `public/iStudio-1.0.0/index.html` | MATCHDO - 合做 | AI 輔助客製產品設計，媒合優質廠商，一站式從設計到生產。 | /images/og-home.jpg | ✅ 已完成 |
| `public/custom/index.html` | 客製產品 - MatchDO | 從圖庫找廠商、上傳設計圖或文字搜尋，媒合訂製廠商。（已有，需加 OG） | /images/og-custom.jpg | ✅ 已完成 |
| `public/custom-product.html` | 產品設計 - MATCHDO | 使用 AI 輔助設計客製產品，選擇材質、尺寸，直接送廠商生產。 | /images/og-design.jpg | ✅ 已完成 |
| `public/remake/index.html` | 再製／改裝現有品 - MatchDO | 上傳現有品圖片，AI 依再製分類改裝設計，媒合改製廠商一站式生產。 | /images/og-remake.jpg | ✅ 已完成 |
| `public/subscription-plans.html` | 方案與定價 - MATCHDO | 查看 MatchDO 免費與付費方案，選擇最適合您的訂閱計劃。 | /images/og-plans.jpg | ✅ 已完成 |

> `vendors.html` 與 `vendor-profile.html` 為動態路由，OG 標籤由 JavaScript 動態注入（Google 可讀到），社群分享待第二階段後台實作後再處理。

#### 標準 Open Graph 模板（需加入每個頁面 `<head>`）

```html
<!-- SEO Meta Description -->
<meta name="description" content="【各頁面獨立描述，150-160 字元以內】">

<!-- Open Graph -->
<meta property="og:type" content="website">
<meta property="og:site_name" content="MATCHDO 合做">
<meta property="og:title" content="【頁面標題】">
<meta property="og:description" content="【同 description】">
<meta property="og:image" content="https://matchdo.cc/images/【og-image.jpg】">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="https://matchdo.cc/【路徑】">
<meta property="og:locale" content="zh_TW">
<meta property="og:locale:alternate" content="en_US">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="【頁面標題】">
<meta name="twitter:description" content="【同 description】">
<meta name="twitter:image" content="https://matchdo.cc/images/【og-image.jpg】">
```

> **OG 圖片規格**：建議 1200×630px，JPG 格式，檔案 < 300KB。
> 需為每個主要頁面製作對應的 OG 封面圖，放在 `public/images/` 目錄。

---

### Phase SEO-2：Canonical + Hreflang（🟡 中優先）

**目標**：告知搜尋引擎多語系頁面的正確版本，避免重複內容扣分。

#### 問題說明

目前多語系透過 `?lang=en` 參數切換，搜尋引擎可能將中英文版視為重複內容。

#### 實作方式

每個頁面加入 `<head>`：

```html
<!-- Canonical（指向不帶 lang 參數的版本為主） -->
<link rel="canonical" href="https://matchdo.cc/【路徑】">

<!-- Hreflang（讓 Google 知道語系對應） -->
<link rel="alternate" hreflang="zh-TW" href="https://matchdo.cc/【路徑】">
<link rel="alternate" hreflang="en" href="https://matchdo.cc/【路徑】?lang=en">
<link rel="alternate" hreflang="x-default" href="https://matchdo.cc/【路徑】">
```

#### 或使用 JavaScript 動態設定（因有 i18n 系統）

```javascript
// 在 i18n 初始化後動態設置
function setSEOHreflang(pagePath) {
  const baseUrl = 'https://matchdo.cc';
  const head = document.head;

  const links = [
    { hreflang: 'zh-TW', href: `${baseUrl}${pagePath}` },
    { hreflang: 'en',    href: `${baseUrl}${pagePath}?lang=en` },
    { hreflang: 'x-default', href: `${baseUrl}${pagePath}` }
  ];

  links.forEach(({ hreflang, href }) => {
    const link = document.createElement('link');
    link.rel = 'alternate';
    link.setAttribute('hreflang', hreflang);
    link.href = href;
    head.appendChild(link);
  });
}
```

---

### Phase SEO-3：JSON-LD 結構化資料（🟡 中優先）

**目標**：讓 Google 顯示豐富摘要（Rich Snippet），提升搜尋排名與點擊率。

#### 3-1. 首頁：Organization

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "MATCHDO 合做",
  "alternateName": "MatchDO",
  "url": "https://matchdo.cc",
  "logo": {
    "@type": "ImageObject",
    "url": "https://matchdo.cc/images/logo.png"
  },
  "description": "AI 輔助客製產品設計平台，媒合優質廠商，一站式從設計到生產。",
  "foundingDate": "2025",
  "areaServed": "TW",
  "availableLanguage": ["Chinese", "English"],
  "contactPoint": {
    "@type": "ContactPoint",
    "contactType": "customer service",
    "availableLanguage": ["Chinese", "English"]
  }
}
</script>
```

#### 3-2. 首頁：WebSite（啟用搜尋框）

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "MATCHDO 合做",
  "url": "https://matchdo.cc",
  "potentialAction": {
    "@type": "SearchAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": "https://matchdo.cc/custom/gallery.html?search={search_term_string}"
    },
    "query-input": "required name=search_term_string"
  }
}
</script>
```

#### 3-3. 廠商詳情頁：LocalBusiness（動態產生）

需在 `vendor-profile.html` 的 JS 中，於廠商資料載入後動態插入：

```javascript
function injectVendorSchema(vendor) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": vendor.company_name,
    "description": vendor.description,
    "image": vendor.logo_url,
    "url": `https://matchdo.cc/vendor-profile.html?id=${vendor.id}`,
    "areaServed": vendor.location || "TW",
    "knowsAbout": vendor.categories?.join(', ')
  };

  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(schema);
  document.head.appendChild(script);
}
```

#### 3-4. 訂閱方案頁：PriceSpecification / Offer

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "MATCHDO 付費方案",
  "brand": {
    "@type": "Brand",
    "name": "MATCHDO"
  },
  "offers": [
    {
      "@type": "Offer",
      "name": "月訂閱",
      "priceCurrency": "TWD",
      "availability": "https://schema.org/InStock"
    },
    {
      "@type": "Offer",
      "name": "年訂閱",
      "priceCurrency": "TWD",
      "availability": "https://schema.org/InStock"
    }
  ]
}
</script>
```

---

### Phase SEO-4：Core Web Vitals 優化（🟢 低優先）

#### 4-1. 圖片 Lazy Loading

需修改：`public/iStudio-1.0.0/index.html` 媒體牆圖片動態產生邏輯

```javascript
// 現有程式碼中，動態建立 <img> 時加上 loading="lazy"
const img = document.createElement('img');
img.loading = 'lazy';
img.src = item.image_url;
```

#### 4-2. JavaScript defer

評估以下可加 `defer` 的 script（不影響首屏渲染）：

| Script | 目前 | 建議 |
|--------|------|------|
| jQuery | `<script src="...jquery...">` | 加 `defer` |
| Bootstrap JS | `<script src="...bootstrap...">` | 加 `defer` |
| 分析腳本（GA 等） | 視情況 | 加 `async` |
| 自訂業務邏輯 | 在 `</body>` 前 | 維持（已在尾部） |

> ⚠️ **注意**：加 `defer` 前需確認 JS 之間的依賴順序，jQuery 加 defer 後，依賴 jQuery 的腳本也需 defer，且順序要在後。

#### 4-3. Sitemap 擴充（補足動態內容）

目前 `/sitemap-pages.xml` 未包含：
- 產品詳情頁（`/custom-product-detail.html?id=xxx`）— 建議新增 `/sitemap-products.xml`

在 `server.js` 新增路由：
```javascript
app.get('/sitemap-products.xml', async (req, res) => {
  // 查詢所有 show_on_homepage=true 的 custom_products
  // 產生 XML 格式
});
```

---

## 三、OG 圖片製作清單

需製作以下 1200×630px 的社群分享封面圖，放至 `public/images/`：

| 檔名 | 用於頁面 | 內容建議 |
|------|---------|---------|
| `og-home.jpg` | 首頁 | MATCHDO Logo + 標語 + 平台截圖 |
| `og-custom.jpg` | 客製產品首頁 | 客製流程示意圖 |
| `og-design.jpg` | 產品設計頁 | AI 設計介面截圖 |
| `og-remake.jpg` | 再製方案 | 舊品 → AI 再製流程示意 |
| `og-vendors.jpg` | 廠商列表 | 廠商合作示意 |
| `og-plans.jpg` | 訂閱方案 | 方案比較表截圖 |

---

## 四、實作順序與 Checklist

### Phase SEO-1：Meta 標籤補齊
- [ ] 製作 OG 圖片（5 張，先用簡單版即可，放 `public/images/`）
- [x] `public/iStudio-1.0.0/index.html`：補 description + OG 標籤
- [x] `public/custom/index.html`：補 OG 標籤（description 已有）
- [x] `public/custom-product.html`：補 description + OG 標籤
- [x] `public/remake/index.html`：補 description + OG 標籤
- [x] `public/subscription-plans.html`：補 description + OG 標籤
- [ ] `vendor-profile.html` OG 標籤（待第二階段，需 SSR）

### Phase SEO-2：Canonical + Hreflang
- [x] `public/iStudio-1.0.0/index.html`：加入 canonical + hreflang（含英文版 `?lang=en`）
- [x] `public/custom/index.html`：加入 canonical + hreflang
- [x] `public/custom-product.html`：加入 canonical + hreflang
- [x] `public/remake/index.html`：加入 canonical + hreflang
- [x] `public/subscription-plans.html`：加入 canonical + hreflang

### Phase SEO-3：JSON-LD 結構化資料
- [x] 首頁加入 Organization + WebSite（含站內搜尋框 SearchAction）schema
- [x] `public/custom/index.html` 加入 WebPage + SearchAction schema
- [x] `public/custom-product.html` 加入 WebPage schema
- [x] `public/remake/index.html` 加入 WebPage schema
- [x] `public/subscription-plans.html` 加入 Product/Offer schema
- [ ] `vendor-profile.html` 動態注入 LocalBusiness schema（待 JS 實作）

### Phase SEO-4：Core Web Vitals 優化
- [ ] 首頁媒體牆圖片加 `loading="lazy"`
- [ ] 評估並加入 `defer` 至非關鍵 JS
- [ ] 新增 `/sitemap-products.xml` 動態路由

---

## 五、驗證工具

實作後請用以下工具驗證：

| 工具 | 用途 | 網址 |
|------|------|------|
| Google Search Console | 提交 Sitemap、監控索引狀態 | https://search.google.com/search-console |
| Google Rich Results Test | 驗證 JSON-LD 結構化資料 | https://search.google.com/test/rich-results |
| Facebook Sharing Debugger | 驗證 OG 標籤 | https://developers.facebook.com/tools/debug/ |
| PageSpeed Insights | 測量 Core Web Vitals | https://pagespeed.web.dev/ |
| Ahrefs / Semrush | SEO 整體健康度（付費） | — |

---

> **下一步**：從 Phase SEO-1（Meta 標籤）開始實作。  
> 實作完成後請更新本文件中的 Checklist。
