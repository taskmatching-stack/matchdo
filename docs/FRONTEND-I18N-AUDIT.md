# 前台全站英文 UI 稽核（非上傳區單點）

**兩條管線（勿混為一談）：**

| 管線 | 解決什麼 | 做法 |
|------|----------|------|
| **UI 多語系** | 按鈕、標籤、說明、控制台文案 | `public/js/i18n.js` + `public/locales/en.json` + 頁面 `data-i18n` / JS `tr()` |
| **內容多語系** | 廠商名、素材標題、官方字典 | DB `*_en`、API `?lang=en`、後台填英文或批次 AI |

「批次 AI 補英文」**只**補內容欄位，**不會**掃描或翻譯 HTML 介面。

### 繁中頁 vs 英文頁（必守，勿再犯）

| 表面 | 預設文案 | 英文怎麼來 |
|------|----------|------------|
| **繁中頁**（無 `?lang=en`、或 `lang=zh-TW`） | HTML 內文與 **`zh-TW.json` 一律繁體中文** | 不套用 `en.json` |
| **英文頁**（`?lang=en` 或選單 EN） | 仍可用 HTML 繁中當 **未載入前的 fallback** | **`en.json` 必須完整英文**；`applyPage()` / `t()` 覆寫 |

**禁止：**

- ❌ 為了「做 i18n」把 HTML 預設改成英文（會讓未載入 locale 時像英文站）
- ❌ 在 **`zh-TW.json` 寫英文 UI 字**（`applyPage` 會把繁中頁蓋成英文——曾發生於 `pageTitleEn`、`sizeMode` 等）
- ❌ 只改 `en.json` 卻以為繁中頁也會變英文（繁中頁只讀 `zh-TW.json`）

**正確節奏：** 同一個 `data-i18n` 鍵 → `zh-TW.json` 繁中 + `en.json` 英文；驗收時 **分開開** `?lang=zh-TW` 與 `?lang=en` 各走一輪。

**工作定義「英文頁 OK」：** 在 **`?lang=en`** 下主流程無殘留中文 UI（不含 API 回傳的廠商自填內容）。

## 自動掃描

```bash
node scripts/audit-frontend-i18n.js
node scripts/audit-locale-mix.js
```

`audit-locale-mix.js`：掃 `zh-TW.json` 像英文 UI 的值、en/zh 缺鍵（**本輪已補** `category.*` 繁中、`supplierManage.*` 英文）。

輸出：未載入 `i18n.js` 的頁面、載入但 `data-i18n` 過少的頁面。

## 分區清單（工作狀態）

狀態：**OK** = 英文切換後主流程可讀；**部分** = 有 i18n 但 JS toast／表單／Modal 仍中文；**缺** = 幾乎全中文 UI。

### A. 全站殼層

| 區塊 | 檔案 | 狀態 | 備註 |
|------|------|------|------|
| 導覽／登入 | `public/js/site-header.js` | 部分 | `t()` + fallback；依 locale 載入 |
| 頁尾 | `public/partials/footer.html` | OK（主連結） | `data-i18n` + `footer.*`／`nav.*`；`site-footer.js` 改為 `applyPage`（2026-09-29） |
| 語系檔 | `public/locales/en.json` | 持續補 | 缺鍵會顯示中文 fallback |

**手機版：** 與桌面共用 `i18n.js`（`?lang=en`／cookie），**沒有**獨立 mobile locale。導覽抽屜、`data-i18n` 與 `applyPage()` 同套；設計頁手機分類 Bottom Sheet 需 JS 同步（`syncCatSheetChromeI18n`）。商攝在手機會開 `/promo-camera-app`，該頁亦載入同一套 locale。

### B. 訂製者／設計工具

| 頁面 | 狀態 | 備註 |
|------|------|------|
| `custom-product.html` | 部分 | 大量 `data-i18n`；`formatMaterialComboAddon` 等 JS 持續補 |
| `client/my-custom-products.html` | OK（UI） | 小卡 `col-xl-2`；主按鈕「詳情／履歷」+「更多」收描述／標籤；`zh-TW`／`en` 分檔，勿互塞 |
| `client/find-makers.html` | OK | `findMakers.*` + 列表 JS |
| `client/custom-product-detail.html` | OK（UI） | `customProductDetail.*`；分類名等 API 內容仍原語 |
| `client/print-asset.html` | OK | `printAsset.*` 靜態 + 提示詞預覽／存庫 JS |
| `client/material-dual-color.html` | OK（UI） | `materialCombo.*`；色標由 `syncModeUi` 更新 |
| `client/promo-camera.html` / `promo-camera-app.html` | 部分 | L3 凍結區慎改 |
| `product-tree.html` | OK（UI） | 靜態 `data-i18n` + OG／Twitter meta 依 `lang`；`vendor-product-link-tree.js` 已 `tr()` |
| `design-direction/*` | **凍結（測試中）** | 舊 `/remake` 改殼；**分析內容尚未建立**；中英混用可接受至正式上線前。**勿**再排 i18n 批次改 `remake-product.js` |
| `remake/*` | 僅 301 | → `/design-direction/` |
| `embed/simulator.html` | 部分 | |

### C. 公開目錄／廠商首頁（SEO）

| 頁面 | 狀態 | 備註 |
|------|------|------|
| SSR 版型列表 `/official-templates/`、`/vendor-styles/` 等 | 部分 | `browse-page-i18n.js`、cookie `lang` |
| `vendor-profile.html` | 部分 | `vpTr`、服務地區 `profileContentLang` + `i18n:applied` 重繪（2026-09-29） |
| `vendors.html` | 部分 | `vendors.*`、地區篩選、`applyVendorsPageMeta`（2026-09-29） |
| `inspiration/*` SSR | 內容 | `title_en` |

### D. 廠商工作區（① 製造商）

| 頁面 | 狀態 | 備註 |
|------|------|------|
| `client/manufacturer-dashboard.html` | 部分 | 手風琴內文 2026-09-29 補 `mfrDash.*` |
| `client/manufacturer-materials.html` | 部分 | 2026-09-29 大幅補 UI |
| `client/manufacturer-portfolio.html` | 部分 | |
| `client/vendor-product-link-tree.html` | 部分 | |
| `client/vendor-prototype-insights.html` | 部分 | 已有 `protoInsights.*` |
| `client/embed-design-records.html` | 部分 | 已有 `embedRecords.*` |
| `client/manufacturer-inquiries.html` | OK | legacy 轉 contact-info；`mfrInquiries.*` |
| `no-access.html` | OK | `noAccess.*` |
| `embed/preview-simulator.html` | OK | `embedPreview.*` |
| `custom/index.html` | OK | `customIndex.*`（轉址頁） |
| `custom/gallery.html` | OK（UI） | 篩選／Modal／動態卡 `gallery.*` + `i18n.getLang`（2026-09-29） |
| `custom/collection.html` | OK | `customCollection.*` |
| `design-direction/analysis.html` | 部分 | `remakeProduct.*` + 設計稿 modal |
| `client/my-supplier-references.html` | 部分 | |
| `client/industry-suppliers.html` | 部分 | |

### E. 供應商工作區（③ B 線）

| 頁面 | 狀態 | 備註 |
|------|------|------|
| `client/industry-supplier-dashboard.html` | OK／部分 | 有 `supplierDash.*` |
| `client/supplier-catalog-manage.html` | 部分 | 2026-09-29 分類收合 + i18n |
| `client/supplier-portal.html` | 部分 | |
| `client/industry-supplier-catalog.html` | 部分 | 公開目錄 |

### F. 帳號／付費／靜態

| 頁面 | 狀態 |
|------|------|
| `profile/account.html`, `contact-info.html` | 部分 |
| `subscription-plans.html` | 部分 |
| `credits.html` | OK | `credits.*` 靜態 + 訂閱／寬限期 JS（2026-09-29） |
| `custom-product.js` | 部分 | 設計頁 HTML 多已 `data-i18n`；JS 持續補 `tr()` |
| `login.html`, `register.html`, `reset-password.html` | OK | `authPage.*` |
| `help/index.html`, `about.html`, `contact.html` | 部分 |
| `folder-edit.html` | OK | `folderEdit.*`（2026-09-29） |
| 首頁 `iStudio-1.0.0/index.html` | OK（主流程） | 媒體牆 API+`homeT`；lightbox 聯絡／分享 toast／對照滑桿（2026-09-29） |

### G. 刻意不做 UI i18n

- `/admin/*` — 後台維持中文
- 舊版 `client/demands.html`（根目錄）— 非主要入口

## 使用者定案（2026-09-29）— UI i18n **完整收斂**後才開後續工

**不要**再用「主流程可讀就先停」；前台 **UI 多語系**依下方 **結案定義** 掃完，才進行本節 P1/P2 產品待辦（訂閱、SEO、服務地區、內容 `*_en` 等）。

### UI i18n 結案定義（Agent 照此勾選，勿自創「下一批」小題）

| # | 條件 |
|---|------|
| 1 | `node scripts/audit-locale-mix.js`：`en`／`zh-TW` **缺鍵為 0**（維持） |
| 2 | `docs/FRONTEND-I18N-AUDIT.md` **狀態表** A、D1、D2、D3、E、F、殼層 A 全部 **✅**（B4 設計風向 **排除**，見下） |
| 3 | 各區塊在 **`?lang=en`** 下：按鈕、標籤、toast、confirm、Modal、動態 JS 拼字 **無殘留中文 UI**（API／廠商自填內容、後台 `/admin/` **不計**） |
| 4 | 新字串仍遵守：同 PR 補 `zh-TW.json` + `en.json`；動態區塊有 locale 切換重繪（`applyPage`／`customProductOnLocaleReady` 等） |

**刻意不納入本輪 UI i18n 結案：** B4 `/design-direction/`（測試中凍結）、`/admin/*`、**DB 內容多語系**（`title_en` 等 → 見下方 P2 與 `docs/PROGRESS-vendor-content-i18n-en.md`）。

### 固定執行順序（掃完才結案；可一 PR 多檔，但順序勿跳）

1. **D2** — `custom-product.html` + `custom-product.js`（含各 Tab 動態字串、locale 重繪、圖樣提取等殘留）
2. **D1** — `vendor-profile.html`、`vendors.html`（含 JSON-LD／meta EN）
3. **D3** — `manufacturer-dashboard`、`manufacturer-materials`、`manufacturer-portfolio`、`vendor-product-link-tree`、`embed-design-records`、`vendor-prototype-insights`、`my-supplier-references`、`industry-suppliers` 等表內「部分」
4. **E** — `industry-supplier-dashboard`、`supplier-catalog-manage`、`supplier-portal`、`industry-supplier-catalog`
5. **F** — `profile/*`、`subscription-plans.html`、`help`／`about`／`contact`、SSR browse（`official-templates`／`vendor-styles` 等）殘留
6. **殼層 A** — `site-header.js` 殘留、設計頁手機 sheet（與 D2 重疊部分在 D2 收）
7. **B3 收尾** — 首頁 meta／JSON-LD 英文（與 `docs/SEO-PROGRESS.md` 對齊，可與 D1 同輪）

結案後在狀態表加一行 **「UI i18n 結案日」** commit hash，並在回覆使用者時明確寫：**可開 P1 訂閱優惠等待辦**。

---

## 與 i18n 並行、但**排在本輪英文化之後**的產品待辦

（**UI i18n 結案後**再開工；勿與 D2～F 收尾混在同一 PR。）

| 優先 | 項目 | 文件／位置 |
|------|------|------------|
| P1 | 訂閱優惠「終身」vs「僅本訂閱期」 | `docs/PROGRESS-pricing-campaigns.md` §待辦 A |
| P1 | 年付牌價 ×10 vs 後台可設年付 | 同檔 §待辦 B |
| P2 | 廠商服務地區／列表篩選與排序（規劃檔待寫） | 使用者 2026-09-29 備忘 |
| P2 | SEO：首頁 meta／JSON-LD 英文、D1 廠商列表麵包屑 | `docs/SEO-PROGRESS.md`、`docs/SEO-AUDIT-PLAN-2026-08-06.md` |
| P2 | DB 內容 `*_en` 批次補齊（廠商／素材／官方字典） | 後台 + `admin-content-multilang` 規則；**≠** UI i18n |
| P3 | 設計風向 `/design-direction/` 產品化（**現 B4 凍結**） | 上線前再開 i18n／分析內容 |
| P3 | `manufacturer-materials` 等大表單 UX（非純翻譯） | D3 之後單獨需求 |

## Agent 必守（避免再說「全站好了」）

1. 改任一 `public/client/*.html` 或公開工具頁前：跑 `node scripts/audit-frontend-i18n.js`，確認該檔是否在 **缺 i18n** 或 **highRisk** 列表。
2. 新 UI 字串：**同 PR** 加 `en.json` / `zh-TW.json` 鍵，禁止只改中文 HTML。
3. 回覆使用者時區分 **UI** vs **DB 內容**，勿把「批次補 title_en」稱為全站掃描。
4. **設計風向（`/design-direction/`、`remake-product.js`）— 勿當 i18n 主線**  
   - 導覽已標 **測試中**；頁面由舊再製路徑改來，**產品／分析流程尚未建完**，中英對齊成本高、效益低。  
   - **禁止**為「全站英文化」連續改 `remake-product.js` 或大掃 `remakeProduct.*`（除非使用者明確要求此功能上線並做 EN）。  
   - 主戰場：**設計稿** `custom-product.html`、`my-custom-products`、首頁媒體牆、廠商公開頁、控制台。

## 進度 log

- 2026-09-29：建立本檔 + `scripts/audit-frontend-i18n.js`；素材上傳／供應商上架 UI 補強；廠商控制台 `mfrDash`；Embed 紀錄／設計洞察／登入頁 `authPage`。
- 2026-09-29：`folder-edit.html` 掛 i18n；素材「可執行工藝」區塊 `baseModels.executableCrafts*`；作品頁種子橫幅／載入錯誤 EN。
- 2026-09-29：`no-access`、`embed/preview-simulator`、`custom/index`、legacy `manufacturer-inquiries`（轉址保留 `lang`）。
- 2026-09-29：`custom/gallery` 語系與 `gallery.*` 鍵；`custom/collection`；`design-direction/analysis` 表單與 modal。
- 2026-09-29：`vendors.html` 地區大區標籤 `vendors.areaGroup.*`；`industry-supplier-catalog` 登入提示。
- 2026-09-29：`credits.html` 訂閱管理／寬限期／legacy 訂閱 URL 模式；`custom-product.js` 儲存／刪除／實境模擬 alert 一批（`53cadc6`）。
- 2026-09-29：`custom-product.js` 材料組合刪除 confirm、色卡／配件選用、參考圖移除 aria-label（`e069481`）。
- 2026-09-29：`my-custom-products.html` 設計風向 view、`uiTf`、材料組合／印花／情境圖刪除與描述編輯 EN（`03878f8`）。
- 2026-09-29：設計頁手機分類 Bottom Sheet i18n；數位資產情境圖／印花空狀態／設計卡引用與標籤 EN（`25afac1`）。
- 2026-09-29：數位資產收藏 Tab、媒合／完成 confirm、情境圖媒體牆切換（`9e9e030`）。
- 2026-09-29：`client/find-makers.html`、`client/custom-product-detail.html` 全頁 UI + 動態 JS（`findMakers.*`、`customProductDetail.*`）（`9e9e030`）。
- 2026-09-29：`print-asset.html` 剩餘 JS／meta；`material-dual-color` 存庫失敗提示與 a11y；設計頁材料組合摘要 `customProduct.materialCombo*`（`8279834`）。
- 2026-09-29：設計頁 `refSlotsFull` 占位符、資產庫 Tab 標籤；`product-tree.html` SEO meta EN（`dbfc6a2`）。
- 2026-09-29：**修混用** — 媒體牆繁中標題 API、`zh-TW.json` 誤英（sizeMode、myProjects 等）；數位資產小卡「更多」選單（`691eed9`）。
- 2026-09-29：首頁篩選 chip／分類列 `home.*`；設計風向 alert `remakeProduct.alert*`（`7a915a0` 起）。
- 2026-09-29：`custom/gallery.html` 完成批次 C；首頁 lightbox／收藏／類型 badge `home.*`。
- 2026-09-29：`vendor-profile` 服務地區、`vendors` meta；`remake-product.js` 參考圖 UI／趨勢摘要。
- 2026-09-29：**B4 凍結**（設計風向測試中）；首頁 B3 lightbox 聯絡／分享 toast 收尾。
- 2026-09-29：殼層 A 頁尾 `footer.*`／`nav.help`；`partials/footer.html` 全面 `data-i18n`；資產庫 `myCustomProducts.loading` 統一「載入中…」。
- 2026-09-29：**D2** 設計稿 `custom-product.js` alert／confirm／圖樣提取取消與點數文案；補 `officialStylesEmpty`、`vendorStyleBrowsePickHint*`、`promoImageEnvAdminHint` 等 locale；`LOCALE_CACHE_V` `20260929-d2-alerts`。
- 2026-09-29：**D2** browse／廠商 picker／promo／歷史區塊：`t()||` → `tr()` 大批；資產 picker tab、`promoImageMpCapHint` `{mp}`；`20260929-d2-browse-promo`。
- 2026-09-29：**D2** 實境模擬 HTML aria／placeholder；scene-sim JS 結果與點數；歷史區 `tr()`；`20260929-d2-scene-history`。
- 2026-09-29：**D2** 設計頁 `custom-product.html` head meta／OG／Twitter `data-i18n-meta-*`；`i18n.js` `data-i18n-meta-content`。
- 2026-09-29：**D2** JSON-LD WebPage／BreadcrumbList 依 `?lang=` 更新；規格摘要 `title`、歷史載入 `tr()`；`20260929-d2-design-ld`。
- 2026-09-29：**D2** 設計稿 JS：數位資產 tab／modal／caption `tr()`；`refSourcesTitleCount`；`20260929-d2-gallery-js`。
- 2026-09-29：**D2** 廠商素材 picker 服務區「全國」suffix、locale 切換重繪；`20260929-d2-vendor-picker`。
- 2026-09-29：**D2** 參考槽總數 pill `refIntentTotalPill`；locale 切換重跑 `__renderIntentSlots`；`20260929-d2-ref-slots`。
- 2026-09-29：**D2** 參考槽 tablist `refIntentTabsAria`；`untitledDesign`；`20260929-d2-untitled-ref`。
- 2026-09-29：**D2** 歷史小卡標題／提示詞分離 caption；`galleryCardSeedSuffix`；分類 sheet locale 重繪；`20260929-d2-gallery-title`。
- 2026-09-29：**D2** 生圖按鈕／預覽 alt；情境圖參考 thumb；locale 重繪 promo options；`20260929-d2-generate-promo`。
- 2026-09-29：**D2** 寫實化 Tab 按鈕／錯誤文案；生圖／寫實化點數 hint（`GET /api/points-info`＋參考圖 tier）；`20260929-d2-d2p-points`。
- 2026-09-29：**D2** 實境模擬／圖樣提取 Tab：按鈕 loading、結果 locale 重繪、點數 hint（`points_scene_simulate`）；`20260929-d2-pattern-scene`。
- 2026-09-29：**D2** 廠商 browse 卡訂製程度 `customizationLevelLabel`；picker／browse locale 重繪（服務區、分頁、材料組合 addon）；`20260929-d2-vendor-browse`。
- 2026-09-29：**D2** 歷史牆／past modal／生圖成功預覽 locale 重繪；`product_title_en`；`20260929-d2-gallery-modal`。
- 2026-09-29：**D1** 廠商列表／詳情 meta＋JSON-LD 隨 `i18n` 刷新（`dbc6b19`）。
- 2026-09-29：**D3** 素材庫 AI 重繪／放大 confirm 與編輯圖庫 hint `tr()`；關聯圖／embed 紀錄／作品 title；`20260929-d3-mfr-workspace`。
- 2026-09-29：**D3 結案** 素材庫動態 toast／embed／情境圖 Tab／關聯分類提示；`i18n:applied` → `applyMaterialsPageI18n`；`20260929-d3-closure`。

## 本輪批次到哪裡（給接手的狀態表）

| 批次 | 範圍 | 狀態 |
|------|------|------|
| **B1** | 訂製者工具：`find-makers`、`custom-product-detail`、`print-asset`、`material-dual-color`、設計頁 JS 摘要 | ✅ 已 push（`9e9e030`～`dbfc6a2`） |
| **B2** | 數位資甶庫 UI + 卡片版面 + 收藏 Tab | ✅ 已 push（含 `691eed9` 更多選單） |
| **B3** | 首頁媒體牆：**內容語系**（API）+ **UI**（chip／分類／對照／lightbox／收藏／分享） | ✅ 主流程（2026-09-29）；剩餘：首頁 meta／JSON-LD 英文（低優先） |
| **B4** | `design-direction` / `remake-product.js` | ⛔ **凍結**（測試中、內容未建完；勿再排批次。已 push 的少量 `remakeProduct.alert*` 保留即可） |
| **C** | `custom/gallery.html` 動態 UI | ✅ `gallery.*` + `apiBilingualLabel`（2026-09-29） |
| **D1** | `vendor-profile` + `vendors.html` 公開列表 | ✅ meta／JSON-LD／麵包屑隨 `i18n` 刷新（2026-09-29） |
| **D2** | 設計稿 `custom-product.html` + `custom-product.js` 殘留 JS | ✅ **結案**（2026-09-29 掃尾）；後續僅遇 bug／新 UI 再補鍵 |
| **F（片段）** | `subscription-plans.html` 載入文案 | ✅ `pricing.loading`（`e8cd00a`） |
| **D3** | 廠商工作區（dashboard／materials／portfolio 等） | ✅ 素材庫 toast／embed／情境圖／關聯提示 `tr()` + locale 重繪（2026-09-29） |
| **E** | 供應商 B 線（catalog-manage、portal…） | ⏳ 約 1 批 |
| **F** | 帳號／方案／help 靜態、SSR 版型 browse | ⏳ 約 1～2 批 |
| **殼層 A** | `site-header`／footer 殘留、設計頁手機 sheet | 🔄 footer 主流程 OK；header 殘留與 D2 sheet 下一批 |

### 離 UI i18n 結案還差什麼？（2026-09-29，依使用者定案「完整收斂」）

不含 **B4**、**/admin**、**DB `*_en`（→ 結案後 P2）**：

| 區塊 | 狀態 |
|------|------|
| B1、B2、C、credits、登入、首頁媒體牆主流程 | ✅ |
| **D2** | ✅ 結案（2026-09-29） |
| **E、F、殼層 A、B3 meta** | ⏳ 依上方固定順序 4～7 |
| locale 鍵同步 | ✅ `audit-locale-mix` 缺鍵 0 |

**結案後才開：** 下表 P1/P2（訂閱牌價、SEO、服務地區、內容英文批次等）。

### 本輪已掃「混用」的頁面（不只首頁）

| 頁／檔 | 檢查結果 |
|--------|----------|
| `public/client/my-custom-products.html` | `uiT` 第三參數為 EN fallback（正確）；版面與語系分開 |
| `client/find-makers.html`、`custom-product-detail.html` | 無 `isEn` 硬編；靠 locale 鍵 |
| `print-asset.html`、`material-dual-color.html` | 無 `isEn`；修正 HTML fallback 勿寫英文 |
| `public/js/custom-product.js` | 廠商 picker 雙語欄位用 `vendorPickerIsEn`（內容語意，非 UI 混塞） |
| `public/js/remake-product.js` | **凍結** — 測試中功能；全站 i18n **不掃**（除非使用者指定此功能上線） |
| `public/iStudio-1.0.0/index.html` | 媒體牆 API + `homeT`；仍有 badge／lightbox 硬編碼 |
| `public/locales/*.json` | `audit-locale-mix.js`；缺鍵已補 category／supplierManage |

## 已知混用／風險（2026-09-29 盤點）

| 類型 | 現況 | 處理方式 |
|------|------|----------|
| **`zh-TW.json` 寫英文 UI** | 已修一批（`sizeMode`、`myProjects.sectionTitle`、`pageTitleEn` 等改回繁中） | 新鍵必雙檔；勿再抄 `en.json` 進繁中檔 |
| **鍵名 `*En` 但用在 `data-i18n`** | 如 `printAsset.pageTitleEn` — 繁中檔值已是中文副標，英文檔才是英文 | 可接受；驗收看 `?lang=` 勿只看鍵名 |
| **JS `isEn ?` 硬編兩套字** | 首頁已改 `homeT()`；`remake-product.js` 若有殘留 | **設計風向凍結**，不為此檔開工；其餘主線頁改 `tr()` |
| **媒體牆卡片 title** | API `pickMediaWallLocalizedTitle` 繁中不再 fallback 英文預設 | ✅ `691eed9` |
| **DB 內容英文、UI 中文** | 正常（內容管線）；不是 bug | 用 API `lang` 或後台 `*_en` |
