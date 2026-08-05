# Server 內部跳轉對照表

**維護**：改 `server.js` 路由或新增公開 URL 時同步更新。  
**政策**：301 = 永久（SEO 合併）；302 = 暫時。舊 URL **保留**，勿刪除非確定無外部連結。

**實作位置**：`server.js`（約 L5073–5203、L9143、L9236）

---

## 首頁與模板遺留

| 來源 | 目標 | 碼 |
|------|------|-----|
| `/index.html` | `/` | 301 |
| `/iStudio-1.0.0`、`/iStudio-1.0.0/`、`/iStudio-1.0.0/index.html` | `/` | 302 |
| `/iStudio-1.0.0/custom-product.html` | `/custom-product.html` | 302 |
| `/iStudio-1.0.0/client/my-custom-products.html` | `/client/my-custom-products.html` | 302 |
| `/iStudio-1.0.0/client/custom-product-detail.html` | `/client/custom-product-detail.html`（保留 query） | 302 |

---

## 製造商後台（根目錄 → `/client/`）

| 來源 | 目標 | 碼 |
|------|------|-----|
| `/manufacturer-dashboard.html` | `/client/manufacturer-dashboard.html` | 302 |
| `/manufacturer-materials.html` | `/client/manufacturer-materials.html` | 302 |
| `/manufacturer-portfolio.html` | `/client/manufacturer-portfolio.html` | 302 |
| `/manufacturer-inquiries.html` | `/client/manufacturer-inquiries.html` | 302 |

---

## 官方版型（訪客 SEO 入口）

| 來源 | 條件 | 目標 | 碼 |
|------|------|------|-----|
| `/client/manufacturer-materials.html` | `official_platform=1` 且非 `manage=1` | `/official-templates/`（保留 category／subcategory query） | 301 |
| `/official-templates`、`/official-templates/` | — | **真列表 SSR**（不再 301 進設計頁） | 200 |
| `/vendor-styles`、`/vendor-styles/` | — | **真列表 SSR**（廠商公開 prototype；不含官方平台池） | 200 |
| `/browse-styles.html` | — | `/vendor-styles/`（保留 category／subcategory query） | 301 |

---

## 攝影模擬（短網址）

| 來源 | 目標 | 碼 |
|------|------|-----|
| `/client/promo-camera.html` | `/promo-camera` | 301 |
| `/client/promo-camera-app.html` | `/promo-camera-app` | 301 |

**正式入口**：`/promo-camera`、`/promo-camera-app`（sitemap-pages）

---

## 設計風向（舊再製路徑）

| 來源 | 目標 | 碼 |
|------|------|-----|
| `/remake`、`/remake/`、`/remake/index.html` | `/design-direction/` | 301 |
| `/remake-product.html` | `/design-direction/analysis.html` | 301 |

---

## 產品關聯樹

| 來源 | 目標 | 碼 |
|------|------|-----|
| `/product-tree/:uuid` | `/product-tree.html?prototype_asset_id=:uuid` | 301 |

---

## 其他

| 來源 | 目標 | 碼 |
|------|------|-----|
| `/embed/simulator`（等，見 server） | `/embed/preview-simulator.html` | 301 |
| `/custom`（無尾斜線） | `/custom/` | 302 |

---

## 前端跳轉（非 HTTP 301，體感明顯）

| 頁面 | 條件 | 行為 |
|------|------|------|
| `/client/industry-supplier-catalog.html` | 無 `supplier_id` | → `/client/industry-suppliers.html` |
| 同上 | 未登入 | → `login.html` |
| 多數 `/client/*` 工作區 | 未登入 | → 登入頁 |

---

## 站內應使用的正式連結（新程式勿指舊 URL）

| 功能 | 正式 URL |
|------|----------|
| 攝影模擬（全站選單） | `/promo-camera` |
| 設計頁內流程 tab | `/custom-product.html?tab=…` |
| 管理員官方版型上傳 | `/client/manufacturer-materials.html?official_platform=1&manage=1`（**須 manage=1**） |
| 設計風向首頁 | `/design-direction/` |
| 廠商後台 | `/client/manufacturer-*.html` |
| UGC 分享／SEO | `/inspiration/{type}/{id}` |
| 看可搭配 | `/product-tree.html?prototype_asset_id=` |

---

## 修訂紀錄

| 日期 | 說明 |
|------|------|
| 2026-08-01 | 初版；配合 `site-url-seo-reconciliation-plan.md` |
