# 客製產品 IA 調整（2026-08-01）

> **狀態**：已實作（第一版）  
> **原則**：產品設計維持 top-level 核心入口；去掉轉運頁；tab 分組。

---

## 1. 頂部選單「客製產品 ▾」（4 項）

| 順序 | 項目 | URL |
|------|------|-----|
| 1 | **產品設計** | `/custom-product.html` |
| 2 | 圖庫找廠商 | `/custom/gallery.html` |
| 3 | **行銷影像** | `/custom-product.html?tab=promo-image` |
| 4 | 我的數位資產 | `/client/my-custom-products.html` |

**移除獨立選單項**（仍保留頁面／深連結）：

- ~~廠商版型訂製~~ → 產品設計頁 tab「廠商版型」
- ~~找製作方~~ → 數位資產設計卡／圖庫 modal 的 CTA

**「客製產品」文字連結**：點擊 → `/custom-product.html`（不再進 `/custom/` landing）。

實作：`public/js/site-header.js`

---

## 2. `/custom/` 轉址

| 使用者 | 導向 |
|--------|------|
| 已登入（有 session） | `/custom-product.html` |
| 未登入 | `/custom/gallery.html` |

保留 SEO meta／canonical；`<noscript>` fallback → 圖庫。

實作：`public/custom/index.html`（client-side redirect）

---

## 3. 圖庫 hero 雙 CTA

`/custom/gallery.html` 頂部：

- **建立產品設計**（主色）→ `/custom-product.html`
- **瀏覽作品** → `#galleryFilters`

---

## 4. 產品設計頁 tab 分組

| 設計 | 行銷影像 |
|------|----------|
| 產品設計 · 廠商版型 · 圖樣提取 · 寫實化 · 實境模擬 | 情境圖 · 攝影模擬 |

預設 tab 仍為「產品設計」。跨組切 tab 時 `showBootstrapTab` 會清掉另一組的 `.active`。

實作：`public/custom-product.html`、`public/js/custom-product.js`

---

## 5. 日後 backlog（未做）

- [ ] 我的數位資產：情境圖 tab 與行銷影像頁交叉連結整理
- [ ] 我的最愛併入圖庫收藏夾
- [ ] `/custom/` 改 server-side redirect（若需更快、無閃爍）
- [ ] GA 事件：量測 `/custom/` 轉址後各入口 CTR

---

## 6. 修訂紀錄

| 日期 | 說明 |
|------|------|
| 2026-08-01 | 初版：4 項選單、/custom 轉址、圖庫 hero、tab 分組 |
