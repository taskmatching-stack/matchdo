# 網站 URL × SEO × 體感 — 整體調整規劃

**建立**：2026-08-01  
**狀態**：執行中（分 Phase 逐步上線，每 Phase 可獨立 deploy）  
**相關**：`architecture-and-seo-principles.md`、`SEO-PROGRESS.md`、`url-redirect-map.md`、`routes/sitemap.js`

---

## 背景（為什麼像拼裝車）

MatchDO 分多期疊加：iStudio 模板、`/remake` 改名、製造商頁搬 `/client/`、工具短網址、UGC 改 `/inspiration/*`、B 線供應商。結果：

1. **HTTP 301/302 多** — 舊書籤相容（必要，使用者從選單進通常碰不到）
2. **同一工具多 URL** — 例：攝影模擬 `/promo-camera` vs 設計頁 `?tab=promo-camera` + iframe
3. **業務跳轉** — 未登入、缺 query 參數（使用者體感差）
4. **文件與 sitemap 曾 drift** — 已開始 reconciliation

本規劃：**不刪 301**（避免 404／GSC 混亂），改收斂**站內入口**、**sitemap**、**embed 收錄**、**文件**。

---

## Phase 總覽

| Phase | 內容 | 風險 | 狀態 |
|-------|------|------|------|
| **1** | Sitemap 對齊實站 | 低 | ✅ 程式＋文件（待 deploy） |
| **2** | `?embed=design` → `noindex` | 低 | ✅ |
| **3** | 站外連結統一正式 URL | 低 | ✅ header → `/promo-camera` |
| **4** | 文件＋redirect 對照表 | 無 | ✅ |
| **5** | 設計頁 tab／iframe 行為 | — | **保留**（使用者已接受同格 UI，不拆） |
| **6** | 長期 URL 規則統一 | 高 | 📋 待 A5r／另開 PR |

**不在本規劃動手**（除非另開需求）：

- 拆掉設計頁攝影模擬 iframe 改全頁 SPA
- 刪除 `server.js` 舊路徑 301
- `sitemap-inspiration` 移除 material/part（靈感 URL 仍合法公開頁）
- 大改 `/client/*` 目錄結構

---

## Phase 1 — Sitemap reconciliation

### 已完成（`routes/sitemap.js` + 文件）

| 項目 | 作法 |
|------|------|
| `product-tree.html` 殼頁 | 列入 `sitemap-pages` |
| 公開 prototype 看可搭配 | `sitemap-vendors` 動態 `?prototype_asset_id=`（上限 200，`is_public=true`） |
| 產業供應商目錄 | `sitemap-vendors` 動態 `?supplier_id=`（active，上限 100） |
| 裸 `/client/industry-supplier-catalog.html` | **不列**（會 redirect） |
| `/official-templates/` 重複 | 自 `sitemap-categories` 移除，只留 pages |
| 設計頁 `?tab=promo-camera` | **不列**（獨立 `/promo-camera` 為正式 SEO 入口） |
| 首頁 `layout_type` 變體 | **刻意不列**（crawl budget；文件已更正） |

### 部署後抽查

```bash
curl -s "https://matchdo.cc/sitemap-vendors.xml" | grep -E 'product-tree|industry-supplier-catalog' | head
curl -s "https://matchdo.cc/sitemap-pages.xml" | grep product-tree
```

---

## Phase 2 — Embed 不重複收錄

**問題**：設計頁 iframe 載入 `/promo-camera?embed=design`，與 `/promo-camera` 內容相近，可能 duplicate。

**作法**（最小 diff）：

- `public/client/promo-camera.html`、`promo-camera-app.html`：若 `embed=design`，將 `<meta robots>` 改為 `noindex, follow`
- 獨立開啟 `/promo-camera` 仍 `index, follow` + canonical `/promo-camera`

**不變**：iframe 載入邏輯、`pc-embed-design` CSS、設計頁 tab URL。

---

## Phase 3 — 站內連結收斂（體感）

**原則**：

| 情境 | 應連到的 URL |
|------|----------------|
| 全站選單「攝影模擬」 | `/promo-camera`（正式工具入口） |
| 設計頁分頁 tab（行銷影像流程內） | 維持 `?tab=promo-camera` + iframe（不改成跳離設計頁） |
| 設計頁內「攝影模擬 →」文字連結 | 維持 tab（同流程上下文） |

**已改**：`public/js/site-header.js` 兩處 dropdown → `/promo-camera`

**後續可選**（Phase 3b，未做）：稽核全 repo `href=` 是否仍指舊 `/remake`、`manufacturer-*.html` 根路徑。

---

## Phase 4 — 文件

| 檔案 | 用途 |
|------|------|
| `docs/url-redirect-map.md` | 所有 server 301/302 對照（維護用） |
| `docs/sitemap.md` | 人工頁面目錄 + 指向 `routes/sitemap.js` |
| `docs/SEO-PROGRESS.md` | 收錄政策摘要 |
| 本檔 | 總規劃與 Phase 勾選 |

---

## Phase 5 — 保留不動（健康行為）

依 `.cursor/rules/minimal-change-healthy-code.mdc`：

- 設計頁攝影模擬 **iframe 同格**預覽
- 圖庫原圖／新圖同格、上傳勾選邏輯
- Modal 單例、Bootstrap 5.0 API

---

## Phase 6 — 長期（未排程）

- 統一 URL 命名空間（`/tools/`、`/workspace/`、`/inspiration/`）
- `industry-supplier-catalog` 缺參數時改靜態 landing，少 client redirect
- A5r：拆 inspiration 路由
- 語意化 slug URL（見 `SEO-PROGRESS.md` ②）

---

## 待使用者手動（非程式）

| 項目 | 檔案 |
|------|------|
| 攝影模擬「保留人物」DB prompt | `docs/patch-promo-camera-subject-preservation.sql` |
| 攝影參數 keep reference angle | `docs/patch-promo-camera-keep-reference-angle.sql` |

Supabase → Run without RLS。

---

## 修訂紀錄

| 日期 | 說明 |
|------|------|
| 2026-08-01 | 初版：Phase 1～4 執行計畫；embed noindex；header 連結收斂 |
