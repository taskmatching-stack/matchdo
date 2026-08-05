# 設計頁 7 個 TAB → 獨立網址（執行清單）

> **驗收**：設計頁點 7 個 TAB，位址列必須變成下表 path（不是 `custom-product.html?tab=`）。

## 目標對照

| TAB | 點下去位址列 |
|-----|----------------|
| 設計稿 | `/custom-product.html` |
| 廠商版型 | `/vendor-styles/…` |
| 官方版型（殼內切換） | `/official-templates/…` |
| 圖樣提取 | `/pattern-extract/` |
| 寫實化 | `/design-to-physical/` |
| 實境模擬 | `/scene-sim/` |
| 情境圖 | `/promo-image/` |
| 商攝導演 | `/promo-camera` 或 `/promo-camera-app` |

## 本輪已改檔

| 檔案 | 內容 |
|------|------|
| `server.js` | 4 工具 path serve 殼；舊 `?tab=` 301 |
| `public/custom-product.html` | TAB 改 `<a href>` 獨立 path |
| `public/js/custom-product.js` | path 偵測、導向、href 同步（`?v=151`） |
| `routes/sitemap.js` | 加入 4 path |
| `public/js/site-header.js` | 選單對齊獨立 path |
| `docs/url-redirect-map.md` | 登記 301 |

## 不動

`/promo-camera`、`/promo-camera-app` 頁內容、L3／L4 Store。

## 進度

| 項目 | 狀態 |
|------|------|
| TAB → 獨立 href | ✅ 程式已改（待部署後實機點驗） |
| 4 工具 path 200 | ✅ 路由已掛（殼＝custom-product 面板） |
| 舊 ?tab= 301 | ✅ |
| sitemap／選單 | ✅ |
| `/promo-camera-app` 內容 | 不動 |
