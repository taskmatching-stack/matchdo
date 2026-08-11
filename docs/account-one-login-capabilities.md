# 同一帳號・能力與選單規範（必讀）

更新：2026-08-11  
狀態：**產品定案** — 修改選單、`/api/me/capabilities`、B 線／素材上傳前請先讀本文。

---

## 1. 帳號模型（禁止再搞錯）

| 原則 | 說明 |
|------|------|
| **同一登入帳號** | 不區分「訂製者帳號／製造商帳號／供應商帳號」，**沒有角色切換**。 |
| **①②③ 只是選單分區** | ① 訂製／設計、② 製造商、③ 產業供應商 — 僅幫助找功能，**不是權限角色**。 |
| **禁止依角色隱藏選單** | 登入後「我的功能」內 **①②③ 全部連結必須常駐顯示**。不得因未綁 `manufacturers`、未綁 `industry_suppliers`、`capabilities.nav.*` 等而 **隱藏** 任一工作入口。 |
| **頁內才做限制** | 資格不足時在 **頁面或 API** 顯示說明／403，不要把入口從選單拿掉。 |

過去多次錯誤：把 B 線放進 ③、用 `show_supplier_zone`／`isIndustrySupplier` 藏選單、用「三種角色」文案暗示要換身分 — **一律禁止**。

---

## 2. 全站僅兩項業務限制（其餘勿自創）

除下列兩項外，**不得**再新增「依角色／綁定隱藏功能」類規則（除非產品另開規格並更新本檔）。

### 限制 A：免費帳號不可上傳產品與素材

| 項目 | 內容 |
|------|------|
| **適用** | 免費會員：`profiles.member_level` 為「一般」，且無有效付費訂閱（`user_subscriptions` 方案價>0） |
| **禁止** | 上傳 **素材**（`vendor_assets`：數位版型／材料參考等）、上傳 **產業供應商目錄品項**（`supplier_catalog_items`） |
| **不屬此限** | 展示案例（`manufacturer_portfolio`）仍可上傳，以便解鎖限制 B；訂製者設計圖、點數消費等依各功能既有規則 |
| **例外** | **管理員**、**測試員**（`profiles.role` 為 `admin`／`tester`）不受限 |
| **API** | `can_upload_products_and_assets`（`GET /api/me/capabilities`）；上傳 API 應回 403 與明確文案 |
| **會員降級** | 付費→免費時可將已上架素材標記下架（`syncMembershipCatalogVisibility`），與「禁止新上傳」並存 |

### 限制 B：無「展示中」案例不可導入供應商產品

| 項目 | 內容 |
|------|------|
| **適用** | 製造商從 B 線 **瀏覽／匯入** 產業供應商目錄 |
| **條件** | 至少 **1 件啟用中（公開展示）** 的 `manufacturer_portfolio` |
| **例外** | **管理員**、**測試員** 不受作品門檻 |
| **API** | `can_import_supplier_catalog`（`GET /api/me/capabilities`）；`getMeManufacturerB2BAccess(..., requirePortfolio: true)` |
| **種子廠商** | `vendor_source = 'seed'` 仍不得導入（平台代管，與本限制無關） |

---

## 3. `GET /api/me/capabilities` 用途

| 欄位 | 用途 | 禁止用途 |
|------|------|----------|
| `can_upload_products_and_assets` | 頁面停用上傳按鈕、API 403 | ❌ 隱藏選單 |
| `can_import_supplier_catalog` | 匯入按鈕、B 線 API 門檻 | ❌ 隱藏「產業供應商目錄」選單 |
| `has_manufacturer` / `is_industry_supplier` | 頁面預填、公開連結 URL | ❌ 隱藏 ②③ 區塊 |
| `industry_supplier_id` / `manufacturer_id` | 「我的公開首頁」連結 | ❌ 隱藏上架頁 |
| `nav.*` | **已廢止用於選單顯示**；`show_all_workspace_menus: true` 表示選單全開 | ❌ `site-header.js` 不得再讀 `nav` 藏連結 |

---

## 4. 選單結構（`public/js/site-header.js` · 2026-08）

登入後「我的功能」**①②③ 全部常駐**；頂部另有 **客製產品 ▾**、**設計風向 ▾**（與我的功能分工，避免重複）。

### 客製產品 ▾（`lib/nav-cp-menu-html.js` 單一來源）

| 分區 | 連結 |
|------|------|
| 主入口 | `/custom-product.html`（選單文案：**設計稿**） |
| 以結構 | `/vendor-styles/`、`/official-templates/` |
| 以風格 | `/client/material-dual-color.html`、`/client/print-asset.html` |
| 行銷影像 | `/promo-image/`、`/promo-camera` |
| 輔助工具 | `/pattern-extract/`、`/design-to-physical/`、`/scene-sim/` |
| 資產 | `/client/my-custom-products.html`、`/custom/gallery.html` |

### 設計風向 ▾

`/remake/`、`/design-direction/analysis.html`、`/client/my-custom-products.html?view=design-direction`、`/client/find-makers.html`、`/custom/gallery.html`

### 我的功能 ▾

**① 訂製／設計** — `/client/dashboard.html`、數位資產、對話、點數、AI 編輯區、材料組合、印花  

**② 製造商** — 廠商控制台、廠商公開首頁（`#nav-my-vendor-home`）、展示案例、數位版型  
→ 子區 **上游採購（B 線）**：產業供應商目錄、已匯入上游品項  
→ 訂製需求（`/client/demands.html`）、聯絡方式  

**③ 產業供應商** — 上架數位產品庫、製造商引用紀錄、供應商公開首頁（`#nav-my-supplier-home`）

### 頭像 ▾

首頁、帳號資訊、我的點數、**商攝導演**（`/promo-camera`）、聯絡設定、登出（管理員另有後台項）

頂部「客製產品」「設計風向」與本規範無衝突；**勿**用 capabilities 隱藏 ①②③ 任一項。

---

## 5. 相關檔案

| 檔案 | 說明 |
|------|------|
| `public/js/site-header.js` | 我的功能選單（勿加 `d-none`／capabilities 條件藏連結） |
| `server.js` | `GET /api/me/capabilities`、`getMeManufacturerB2BAccess`、上傳／匯入 API |
| `docs/三角色架構與AB線說明.md` | 資料線 A／B；帳號原則見 §1 |
| `.cursor/rules/account-one-login-capabilities.mdc` | AI 必守規則 |

---

## 6. 變更紀錄

| 日期 | 說明 |
|------|------|
| 2026-08-11 | 選單對照 `nav-cp-menu-html.js`：客製產品分區（設計稿 IA）、商攝 Store 獨立發行說明 |
| 2026-06-01 | 定案：同一帳號、選單全顯示；僅兩項業務限制；廢止 `nav.*` 控制選單顯示 |
