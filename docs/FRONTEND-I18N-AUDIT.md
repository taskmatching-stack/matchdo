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

### B. 訂製者／設計工具

| 頁面 | 狀態 | 備註 |
|------|------|------|
| `custom-product.html` | 部分 | 大量 `data-i18n`；子模組 JS 需逐項 |
| `client/my-custom-products.html` | 部分 | |
| `client/print-asset.html` | 部分 | |
| `client/material-dual-color.html` | 部分 | |
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
| `client/vendor-prototype-insights.html` | **缺** | 待掛 i18n |
| `client/embed-design-records.html` | **缺** | 待掛 i18n |
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
| `subscription-plans.html`, `credits.html` | 部分 |
| `login.html`, `register.html` | **缺** |
| `help/index.html`, `about.html`, `contact.html` | 部分 |
| 首頁 `iStudio-1.0.0/index.html` | 部分 |

### G. 刻意不做 UI i18n

- `/admin/*` — 後台維持中文
- 舊版 `client/demands.html`（根目錄）— 非主要入口

## Agent 必守（避免再說「全站好了」）

1. 改任一 `public/client/*.html` 或公開工具頁前：跑 `node scripts/audit-frontend-i18n.js`，確認該檔是否在 **缺 i18n** 或 **highRisk** 列表。
2. 新 UI 字串：**同 PR** 加 `en.json` / `zh-TW.json` 鍵，禁止只改中文 HTML。
3. 回覆使用者時區分 **UI** vs **DB 內容**，勿把「批次補 title_en」稱為全站掃描。

## 進度 log

- 2026-09-29：建立本檔 + `scripts/audit-frontend-i18n.js`；素材上傳／供應商上架 UI 補強；廠商控制台 `mfrDash`；Embed 紀錄／設計洞察／登入頁 `authPage`。
