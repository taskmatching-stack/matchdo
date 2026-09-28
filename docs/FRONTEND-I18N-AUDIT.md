# 前台全站英文 UI 稽核（非上傳區單點）

**兩條管線（勿混為一談）：**

| 管線 | 解決什麼 | 做法 |
|------|----------|------|
| **UI 多語系** | 按鈕、標籤、說明、控制台文案 | `public/js/i18n.js` + `public/locales/en.json` + 頁面 `data-i18n` / JS `tr()` |
| **內容多語系** | 廠商名、素材標題、官方字典 | DB `*_en`、API `?lang=en`、後台填英文或批次 AI |

「批次 AI 補英文」**只**補內容欄位，**不會**掃描或翻譯 HTML 介面。

## 自動掃描

```bash
node scripts/audit-frontend-i18n.js
```

輸出：未載入 `i18n.js` 的頁面、載入但 `data-i18n` 過少的頁面。

## 分區清單（工作狀態）

狀態：**OK** = 英文切換後主流程可讀；**部分** = 有 i18n 但 JS toast／表單／Modal 仍中文；**缺** = 幾乎全中文 UI。

### A. 全站殼層

| 區塊 | 檔案 | 狀態 | 備註 |
|------|------|------|------|
| 導覽／登入 | `public/js/site-header.js` | 部分 | `t()` + fallback；依 locale 載入 |
| 頁尾 | `public/partials/footer.html` | 部分 | |
| 語系檔 | `public/locales/en.json` | 持續補 | 缺鍵會顯示中文 fallback |

**手機版：** 與桌面共用 `i18n.js`（`?lang=en`／cookie），**沒有**獨立 mobile locale。導覽抽屜、`data-i18n` 與 `applyPage()` 同套；設計頁手機分類 Bottom Sheet 需 JS 同步（`syncCatSheetChromeI18n`）。商攝在手機會開 `/promo-camera-app`，該頁亦載入同一套 locale。

### B. 訂製者／設計工具

| 頁面 | 狀態 | 備註 |
|------|------|------|
| `custom-product.html` | 部分 | 大量 `data-i18n`；`formatMaterialComboAddon` 等 JS 持續補 |
| `client/my-custom-products.html` | OK（UI） | 靜態 `data-i18n` + 各 Tab 卡片／收藏／toast JS；API 標籤／保留期 label 仍為內容 |
| `client/find-makers.html` | OK | `findMakers.*` + 列表 JS |
| `client/custom-product-detail.html` | OK（UI） | `customProductDetail.*`；分類名等 API 內容仍原語 |
| `client/print-asset.html` | OK | `printAsset.*` 靜態 + 提示詞預覽／存庫 JS |
| `client/material-dual-color.html` | OK（UI） | `materialCombo.*`；色標由 `syncModeUi` 更新 |
| `client/promo-camera.html` / `promo-camera-app.html` | 部分 | L3 凍結區慎改 |
| `product-tree.html` | 部分 | 持續補篩選／PDF |
| `design-direction/*` | 部分 | |
| `remake/*` | 缺／部分 | |
| `embed/simulator.html` | 部分 | |

### C. 公開目錄／廠商首頁（SEO）

| 頁面 | 狀態 | 備註 |
|------|------|------|
| SSR 版型列表 `/official-templates/`、`/vendor-styles/` 等 | 部分 | `browse-page-i18n.js`、cookie `lang` |
| `vendor-profile.html` | 部分 | UI `vendor.*` + JS `vpTr`；內容靠 `name_en` |
| `vendors.html` | 部分 | `vendors.*` + 列表 JS `tr()` |
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
| `custom/gallery.html` | 部分 | 篩選／Modal 接 `gallery.*` + `i18n.getLang` |
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
| 首頁 `iStudio-1.0.0/index.html` | 部分 |

### G. 刻意不做 UI i18n

- `/admin/*` — 後台維持中文
- 舊版 `client/demands.html`（根目錄）— 非主要入口

## 與 i18n 並行、但**排在本輪英文化之後**的產品待辦

- 訂閱優惠是否「終身」vs「僅本訂閱期」：見 `docs/PROGRESS-pricing-campaigns.md` §待辦 A。
- 年付牌價 ×10 vs 後台可設年付：見同檔 §待辦 B。
- 廠商服務地區／列表篩選與排序：尚未開規劃檔（使用者 2026-09-29 備忘）。

## Agent 必守（避免再說「全站好了」）

1. 改任一 `public/client/*.html` 或公開工具頁前：跑 `node scripts/audit-frontend-i18n.js`，確認該檔是否在 **缺 i18n** 或 **highRisk** 列表。
2. 新 UI 字串：**同 PR** 加 `en.json` / `zh-TW.json` 鍵，禁止只改中文 HTML。
3. 回覆使用者時區分 **UI** vs **DB 內容**，勿把「批次補 title_en」稱為全站掃描。

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
- 2026-09-29：數位資產收藏 Tab、媒合／完成 confirm、情境圖媒體牆切換（本機待 push）。
- 2026-09-29：`client/find-makers.html`、`client/custom-product-detail.html` 全頁 UI + 動態 JS（`findMakers.*`、`customProductDetail.*`）（`9e9e030`）。
- 2026-09-29：`print-asset.html` 剩餘 JS／meta；`material-dual-color` 存庫失敗提示與 a11y；設計頁材料組合摘要 `customProduct.materialCombo*`。
