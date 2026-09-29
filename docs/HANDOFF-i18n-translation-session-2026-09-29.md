# 交接：i18n／AI 內容翻譯（2026-09-29）

> **給新對話的第一句建議：**  
> 「請先讀 `docs/HANDOFF-i18n-translation-session-2026-09-29.md`，再依 `docs/PLAN-ai-content-translation.md` 與 `docs/FRONTEND-I18N-AUDIT.md` 繼續執行並推送。」

---

## 1. 倉庫與線上基準

| 項目 | 值 |
|------|-----|
| 路徑 | `D:/AI建站/ai-matching` |
| 分支 | `main`（與 `origin/main` 同步時以 `git log -1` 為準） |
| **本輪最後 push** | `f208d9e` — `docs: points plan lists message and demand translate as live` |
| 前一輪重點 commit | `bbaba8c` 自填工藝 EN 僅編輯彈窗；`17df2a0` U5；`1d5d038` UI 去雜訊 |

**部署：** 使用者自行 Cloud Shell；Agent 只提供 `docs/deploy-matchdo-push-and-deploy.md` **§3.1 整行**（含 `grep -v -E 'Regional Access Boundary|taskmatchlng'`）。**先 push 再給 deploy 指令。**

---

## 2. 使用者定案（必守，勿再犯）

1. **「寫進文件」＝要交付**，不是只聊天；**「繼續執行」＝照文件順序實作 + commit/push**（使用者明說要推送時才 push）。
2. **UI 勿堆雜訊：** 不要加 `lang=en` 提示、migration 名稱、扣點長文、過期筆數、stale hash 橫幅等到產品 UI。
3. **英文「過期／stale」功能已取消**（`U6`、hash migration 勿當產品需求）；`docs/add-vendor-asset-portfolio-i18n-en-hash.sql` **不要跑**。
4. **廠商 UGC 英文（`generate-i18n-en`、`*_en` 讀取）不扣點**；與訊息翻譯（1 點）分開 → `docs/PROGRESS-vendor-content-i18n-en.md`。
5. **最小改動**：只改使用者要求範圍；素材庫圖庫 AI 同格預覽等已驗證行為勿拆（見 `.cursor/rules/minimal-change-healthy-code.mdc`）。
6. **SEO**：勿把列表／目錄塞進 `custom-product.html?tab=`（`.cursor/rules/seo-no-stuff-design-page.mdc`）。
7. **Commit**：使用者未明說「commit/push」時不要擅自提交。

---

## 3. 本輪已完成（程式 + 文件）

### AI 翻譯／內容多語（`PLAN-ai-content-translation.md`）

| ID | 狀態 | 摘要 |
|----|------|------|
| T1–T3 | ✅ | 對話 `target_lang`、`messages.html`、`lib/message-translate-langs.js`；同目標語 cache 不扣點、換目標語可重翻 |
| T4 | 不規劃 | 圖片訊息 OCR 翻譯 |
| U1 | ✅ | 素材上傳 `title_en`／`description_en`（三種 asset_kind） |
| U3 | ✅ | B 線 catalog EN + `generate-i18n-en` |
| U4 | ✅ | `demands.html` 翻譯鈕 + `POST /api/custom-products/:id/translate-for-view`（1 點，不寫 DB） |
| U5 | ✅ | `capability_custom_labels_en`；**僅**素材庫 **編輯彈窗**「其他工藝」旁「選填」英文；`contact_info.bio`／`bio_en` |
| U6 | 已取消 | stale 橫幅／hash 已從產品移除 |
| D3 | ✅ | `public/js/translate-target-select.js`（對話）；demands 目標語跟 UI locale |

### UI 清理（`1d5d038`）

- 控制台 stale／meta、demands 多一排翻譯目標選單、素材／portfolio 冗長 EN placeholder 等已移除。

### 工藝區說明（使用者曾問「工藝在哪」）

- **位置：** `public/client/manufacturer-materials.html` → 數位原型／零件 → 摺疊 **「訂製與工藝」**。
- **既有（非 U5）：** 生產模式、三層工藝下拉（大類→細類→標籤）、「其他工藝」自填。
- **U5 只加：** 編輯彈窗內自填工藝的英文框；上傳表單仍只有中文自填。
- 頁面版本：`window.__MATCHDO_MATERIALS_BUILD = 'materials-u5-cap-en-edit-only-20260929'`。

### 前台 UI i18n

- 主線 B1～F、D2、D3 素材庫等已結案 → `docs/FRONTEND-I18N-AUDIT.md`「UI i18n 結案日」`d12d5b4`。
- **B4 設計風向**、**/admin UI i18n** 不在主線結案範圍。

---

## 4. Supabase migration（使用者手動執行）

Agent **不會**自動上線 SQL；請在 Supabase SQL Editor 依序確認：

| migration id（admin 白名單） | 檔案 | 用途 |
|------------------------------|------|------|
| （基礎） | `docs/add-vendor-content-i18n-en.sql` | 廠商 `*_en` 主欄 |
| `supplier-catalog-i18n-en` | `docs/add-supplier-catalog-i18n-en.sql` | B 線 catalog EN |
| `vendor-capability-custom-labels-i18n-en` | `docs/add-vendor-capability-custom-labels-i18n-en.sql` | 自填工藝 EN、`contact_info.bio`／`bio_en` |
| **勿跑** | `docs/add-vendor-asset-portfolio-i18n-en-hash.sql` | 已取消產品 |

登記：`lib/admin-migrations.js`。

---

## 5. 建議下一輪做什麼（優先順序）

1. **確認 migration** 是否已在線上庫執行（未跑則 EN 寫入可能 42703／503）。
2. **`PLAN-ai-content-translation.md` 剩餘**
   - **U2**：多語軸（`title_ja`…）→ **需產品定案**，勿擅自開工。
   - **D1**：官方字典／攝影參數組等 → `admin-content-multilang` checklist。
   - **D4**：admin 訊息監看是否要翻譯 → 先查現況再開。
3. **U5 可選補強（小）**：`manufacturer-portfolio.html` 自填工藝 EN 編輯 UI（後端 `mapPortfolioItemForLocale` 已支援讀取）。
4. **`FRONTEND-I18N-AUDIT.md` P1/P2 結案後項**：訂閱／SEO 等多在 `PROGRESS-*.md`；與翻譯計畫並列時以兩份 PLAN 表為準。
5. **勿預設**：再塞設計頁 SEO tab、U6 stale、上傳表單雙語工藝欄、UI 上顯示 migration 名稱。

---

## 6. 關鍵檔案索引

| 主題 | 檔案 |
|------|------|
| 翻譯待辦主檔 | `docs/PLAN-ai-content-translation.md` |
| 前台 i18n 主檔 | `docs/FRONTEND-I18N-AUDIT.md` |
| 廠商 `*_en` 政策／API | `docs/PROGRESS-vendor-content-i18n-en.md` |
| 扣點（對話／demands） | `docs/points-deduction-plan.md` |
| 訊息翻譯 | `server.js`（`POST …/translate`）、`client/messages.html`、`lib/message-translate-langs.js` |
| 訂製需求翻譯 | `public/client/demands.html`、`POST …/translate-for-view` |
| 廠商英文生成 | `server.js` `generate-i18n-en` 系列 |
| 自填工藝寫入 | `lib/manufacturer-taxonomy.js` `applyVendorAssetTaxonomyWrites` |
| 讀取 `lang=en` 陣列 | `server.js` `pickLocalizedStringArray`、`vendorCapabilityCustomLabelsForLang` |
| 聯絡 bio | `public/profile/contact-info.html` |
| 部署 | `docs/deploy-matchdo-push-and-deploy.md` §3.1 |

---

## 7. 其他 workspace 狀態（2026-09-29）

- **未追蹤、通常不 commit：** `tmp/`、`.cursor/rules/embed-demo-google-site.mdc`、`scripts/push-supabase-pat-to-cloudrun.ps1`（除非使用者要求）。
- **`server.js` 修改慣例：** 部署前 `node --check server.js`。
- **廠商作品頁：** 只改 `public/client/manufacturer-portfolio.html`（非根目錄 `client/`）。
- **上一對話 transcript（查細節用）：**  
  `C:\Users\User\.cursor\projects\d-AI-ai-matching\agent-transcripts\716bda84-de26-4f3f-b80d-31387811c16d\716bda84-de26-4f3f-b80d-31387811c16d.jsonl`

---

## 8. 本交接檔維護

- 新對話完成一批 push 後，可更新 §1 commit hash 或另開 `HANDOFF-…-YYYY-MM-DD.md`，避免本檔無限膨脹。
