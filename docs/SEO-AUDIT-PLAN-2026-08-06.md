# 全站 SEO 稽核與規劃（2026-08-06）

> **基準版本（記住／凍結）**：git `8281e3a`（`8281e3a4545df38238eab7f7ea88ea537691f684`）  
> **狀態**：規劃定案中 — **禁止**再把列表／目錄塞進設計頁  
> **觸發**：使用者明確指出「多次 SEO 卻把功能塞進設計頁」；要求全站檢查規劃，**不要第六次**重演  
> **必守規則**：`.cursor/rules/seo-no-stuff-design-page.mdc`

---

## 0. 一句話結論

站上**功能不少**，但**可索引的獨立頁偏少**；大量入口被做成 `custom-product.html?tab=…`，sitemap 看起來很多、人與爬蟲實際都在**同一殼頁**打轉。下一輪 SEO 的主軸是 **拆出目錄／列表獨立 URL**，不是再幫設計頁加 tab。

---

## 1. 基準線（8281e3a 當下已完成、可保留）

| 項目 | 狀態 | 備註 |
|------|------|------|
| UGC 單件 `/inspiration/{type}/{id}` SSR | ✅ 主線 | 繼續強化，勿改回 CSR detail 當 SEO |
| `/client/*` noindex blocklist | ✅ | 後台維持 noindex |
| 公開工具去硬登入牆 | ✅（8281e3a） | 材料組合／印花／AI 編輯／放大等；**操作仍要登入** |
| 材料組合首屏 | ✅（d64d215） | 不擋 UI |
| 商攝 `/promo-camera` 獨立短網址 | ✅ | 設計頁 iframe 可保留為工具入口，**勿當唯一 SEO** |
| Meta／OG／sitemap 基礎建設 | ✅ 有骨架 | 問題在「假頁／塞殼」，不是完全沒做 |

---

## 2. 設計頁現況（問題核心）

**檔案**：`public/custom-product.html` + `public/js/custom-product.js`

| 現有 tab／模式 | Query | 性質 | SEO 現況 | 應有歸屬 |
|----------------|-------|------|----------|----------|
| 產品設計／設計稿 | （預設）`product-design` | **工具** | 可 index 工具頁 | **留在設計頁** |
| 廠商版型 | `?tab=vendor-styles` | **瀏覽目錄** | sitemap 當頁 | **拆獨立列表** |
| 官方版型 | `?tab=vendor-styles&browse=official` | **瀏覽目錄** | sitemap + `/official-templates/` **301 進此** | **拆真 `/official-templates/`** |
| 場景模擬 | `?tab=scene-sim` | 工具 | sitemap 假多頁 | 可暫留工具；**sitemap 勿當主題站** |
| 行銷影像 | `?tab=promo-image` | 工具 | 同上 | 同上 |
| 設計轉實物 | `?tab=design-to-physical` | 工具 | 同上 | 同上 |
| 圖樣擷取 | `?tab=pattern-extract` | 工具 | 同上 | 同上 |
| 商攝（iframe） | `?tab=promo-camera` | 工具嵌入 | 正式 SEO 應是 `/promo-camera` | 深鏈即可 |

**伺服器現況（必須改掉的行為）**  
`server.js`：`/official-templates/` → **301** → 設計頁官方 tab；無 `manage=1` 的官方後台 URL 也 301 進設計頁。

→ 這就是「沒幾頁」的主因之一：**目錄沒有自己的 URL**。

---

## 3. 全站地圖稽核（按頁型）

### 3.1 做得對（維持）

| URL 型 | 角色 |
|--------|------|
| `/`、`/custom/`、`/design-direction/`、`/vendors.html`、`/help/`… | 主題／說明 landing |
| `/inspiration/...` | **內容量主戰場** |
| `/vendor-profile.html?id=` | 廠商公開首頁 |
| `/promo-camera`、材料組合、印花、ai-edit… | 獨立**工具**（非目錄） |
| 後台 `/client/manufacturer-*` 等 | noindex（正確） |

### 3.2 有問題（本輪要處理）

| 問題 | 現況 | 正確方向 |
|------|------|----------|
| 官方版型無真列表 | 301 進設計頁 | `/official-templates/` **真頁**（列表＋鏈到 inspiration／「去設計」） |
| 廠商版型公開瀏覽 | 設計頁 tab | 獨立列表（path 待定，見 Phase B） |
| sitemap 堆 `?tab=` | `SITEMAP_PAGES` + categories 動態 tab URL | 改指**獨立 path**；逐步淘汰 tab 假頁 |
| 分類 landing 掛在設計頁 | `sitemap-categories` → `custom-product.html?tab=vendor-styles&category_key=` | 改掛獨立版型目錄＋分類 |
| 設計頁過重 | 一生圖＋多瀏覽＋多工具 tab | 設計頁瘦身：預設只做設計稿 |

### 3.3 不要動（避免第六次亂拆）

| 項目 | 原因 |
|------|------|
| 個人後台改 index | 隱私／無價值 |
| 把後台 `manufacturer-materials` 當官方公開列表 | 那是管理 UI |
| 未冒煙就大拆 `server.js` 路由（A5 教訓） | 全站 500 |
| 首頁 `#media-wall` 前塞 SEO 文案塊 | 已禁止（見 SEO-PROGRESS） |

---

## 4. 分期執行（順序固定，勿跳著塞）

### Phase A — 官方版型獨立列表（**第一優先**）

**目標**：`/official-templates/` 不再 301 進設計頁；成為可讀、可收錄的**列表頁**。

建議交付：

1. **真頁**：SSR 或伺服器產出 HTML 列表（標題、縮圖、連到 `/inspiration/{type}/{id}`；公開且上架者）。
2. CTA：「用此版型做設計」→ `custom-product.html` 深鏈（帶 asset／官方參數）— **工具入口**，不是列表本體。
3. **取消** `/official-templates/` → 設計頁的 301（改為直接 serve 列表）。
4. Sitemap：`/official-templates/` 保留；**移除或降權** `custom-product.html?tab=vendor-styles&browse=official` 作為「官方唯一落地」。
5. 分類：官方分類 landing 掛在 `/official-templates/?category_key=`（或 `/official-templates/{cat}/`），**不要**再寫回設計頁 tab。
6. 設計頁：可暫留「官方」切換供已登入工作流，但 **SEO／選單「瀏覽官方版型」指向獨立頁**。

**完成定義**：未登入 curl／瀏覽器開 `/official-templates/` 看得到列表文字與連結；View-Source 或首屏 HTML 有內容（非空白殼等 JS）。

### Phase B — 廠商版型公開瀏覽獨立化

**目標**：`?tab=vendor-styles` 不再當公開目錄 SEO 主體。

建議：

- 新 path 例：`/vendor-styles/` 或 `/templates/`（定案時寫死一組，避免再漂）。
- 列表鏈 inspiration；「去設計」深鏈設計頁。
- `sitemap-categories` 改產新 path。
- 設計頁 vendor-styles tab：改為「工作中挑選」或 redirect／橫幅導向公開列表（產品再定）。

### Phase C — 設計頁瘦身＋sitemap 清掃

1. Sitemap **停止**把每個工具 tab 當獨立高權重頁（scene-sim／promo-image…）；工具改列**一個**設計頁 + 各**獨立工具 URL**（已有則用已有）。
2. 選單：「廠商版型訂製／官方版型」→ 獨立列表，不是設計頁 tab。
3. 文件：更新 `SEO-PROGRESS.md`、`url-redirect-map.md`、`architecture-and-seo-principles.md` §2.1。

### Phase D — 內容與技術債（並行、不擋 A）

| 項目 | 說明 |
|------|------|
| inspiration 覆蓋率 | 公開官方／廠商資產是否都有 inspiration URL、進 sitemap |
| 登入牆複檢 | 可 index 頁是否又藏 UI（8281e3a 後勿回潮） |
| GSC | 部署 A 後用「網址檢查」驗 `/official-templates/` |
| A5r | 與本 SEO 拆頁無關；勿綁在同一 PR 大拆 server |

---

## 5. 明確「不要做」清單（防第六次）

1. ❌ 再新增 `custom-product.html?tab=xxx` 進 `SITEMAP_PAGES` 充數  
2. ❌ 把材料組合／印花／洞察「嵌回」設計頁當唯一入口  
3. ❌ 官方列表做成 SPA 空殼、整頁等 JS 才出卡（等於沒修 SEO）  
4. ❌ 未更新本檔就改 301／sitemap  
5. ❌ 一次 PR 拆完所有 tab + 大重構 custom-product.js（易炸；**先 A 再 B**）

---

## 6. 建議實作順序（給下一個對話）

```
1) Phase A：/official-templates/ 真列表（SSR／server HTML）
2) 改 301、sitemap、選單連結
3) 部署 → GSC 抽查
4) Phase B：廠商版型公開列表
5) Phase C：設計頁瘦身 + 清 tab sitemap
```

**本檔更新義務**：每完成一 Phase，在下方打勾並寫 commit hash。

| Phase | 狀態 | Commit |
|-------|------|--------|
| 基準 8281e3a 記錄 | ✅ | `8281e3a` |
| 規則 seo-no-stuff-design-page | ✅ | `763d473` |
| Phase A 官方真列表 | ✅ 實作 | （本輪）`/official-templates/` SSR；sitemap 改指此 path；設計頁未改 UI |
| 首頁 crawl 連結 | ✅ | `/` HTML 尾端 visually-hidden `/inspiration/*` |
| 首頁首屏 SSR | ✅ | 網格內 SSR 卡片（標題／說明／Tags＋inspiration href）；lightbox UX 不變；`/?category_key=` 強化 title／canonical |
| Phase B 廠商版型列表 | ⏳ | |
| Phase C 設計頁瘦身 | ⏳ | sitemap 已清掉設計頁 `?tab=`（前置） |

---

## 7. 相關檔案索引

| 檔案 | 用途 |
|------|------|
| `.cursor/rules/seo-no-stuff-design-page.mdc` | Agent 必守 |
| `docs/SEO-PROGRESS.md` | 歷史進度（本輪起以本稽核為準修正方向） |
| `docs/SEO-PLAN.md` | 舊總規劃 |
| `docs/architecture-and-seo-principles.md` | 頁型 A～E |
| `docs/site-url-seo-reconciliation-plan.md` | URL／301 對帳 |
| `routes/sitemap.js` | sitemap |
| `server.js`（official-templates 301 段） | Phase A 必改 |
| `public/custom-product.html` / `js/custom-product.js` | 瘦身對象，非再塞對象 |
