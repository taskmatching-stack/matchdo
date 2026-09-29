# AI 內容翻譯（雙向、可選目標語）— 盤點與待辦

> **本檔性質：** AI 內容翻譯的**盤點 + 待辦順序**；與 `docs/FRONTEND-I18N-AUDIT.md` 的 P1→P2→P3 一起，作為「繼續往下執行及推送」的依據。

## 使用者定案（2026-09-29）

1. **「補寫進文件」本身就是要求**：先完成站內 AI 翻譯現況檢查，並把缺口與優先級**寫進本檔**（含雙向、可選目標語、扣點說明等）。這一步是明確交付，不是「只聊天不做事」。
2. **「繼續往下執行及推送」**：依 **已寫進文件的待辦順序** 實作並 push（`FRONTEND-I18N-AUDIT.md` 主線表 + 本檔 T/U/D）。**不需要**使用者每一輪再重複說「現在可以做翻譯了」——順序在文件裡，照表做即可。
3. **Agent 先前誤會（勿再犯）**：把「寫進待辦」誤當成「只寫不做」；或把「繼續執行」誤當成「可以無文件地一直加翻譯」。正確是：**先登錄待辦 → 再按表順序開工**。
4. **已 push 的程式**（對話目標語、B 線 catalog `?lang=`、訂製需求翻譯等）視為待辦表中已開工項的進度；未完成項仍按下方 T/U/D 往下做。

### 建議執行順序（與主線並列時）

| 順序 | 來源 | 內容 |
|------|------|------|
| 1 | `FRONTEND-I18N-AUDIT.md` | P1/P2 剩餘（migration 提醒、素材 EN 表單一致性等） |
| 2 | 本檔 **U1→U3→…** | 廠商／B 線內容多語（非 UI locale） |
| 3 | 本檔 **T*** | 對話翻譯（T4 暫不規劃 OCR） |

---

> **盤點說明**：站內「把使用者文字翻成另一語言寫入 DB 或顯示」與 **UI 多語系** `locales/*.json` 分開。  
> 構想（非承諾實作）：重要上傳／對話可支援可選目標語；生圖 prompt 翻譯仍為 **→ 英文** 專用管線。

---

## 已具備（2026-09-29）

| 區域 | 能力 | 目標語 | 扣點 | 備註 |
|------|------|--------|------|------|
| **站內對話** | `POST /api/direct-messages/:msgId/translate` + `GET /api/translation/target-languages` | ✅ 可選 `target_lang`（11 語）+ `messages.html` 選單 | 1 點／則（admin/tester 免） | 僅文字；圖片訊息無 OCR 翻譯 |
| **廠商簡介** | `POST /api/me/manufacturer/generate-i18n-en` | 固定 **→ en** 寫 `name_en`／`description_en` | 否 | 控制台批次 `scope=all` |
| **素材庫** | 上傳後自動／編輯「AI 補英文」、`POST …/vendor-assets/:id/generate-i18n-en` | **→ en** → `title_en`／`description_en` | 否 | 後台可手動填 EN 欄 |
| **B 線目錄上架** | `supplier-catalog-manage` EN 欄、`POST …/industry-supplier/catalog-items/:id/generate-i18n-en` | **→ en** | 否 | 對稱素材庫 |
| **作品集** | Modal 英文欄、`POST …/portfolio/:id/generate-i18n-en` | **→ en** | 否 | |
| **自訂分類** | `generate-i18n-en` scope `catalog_groups` | **→ en** → `name_en` | 否 | |
| **官方版型庫** | `POST /api/admin/official-platform/generate-i18n-en` | **→ en** | 否 | admin |
| **操作介紹** | `POST /api/admin/help-guides/translate` | **→ en**（圖說文字，不翻 URL） | 否 | admin |
| **前台讀取** | `GET …?lang=en`（廠商、素材、作品、列表等） | 顯示已存 `*_en` | 否 | 非即時翻譯 |
| **生圖／FLUX** | `translatePromptToEnglish*`、`ENABLE_PROMPT_TRANSLATION` | **→ en** 送模型 | 否 | 與 UGC 翻譯分開 |

---

## 缺口（待辦，依優先）

### P1 — 對話與溝通

| # | 項目 | 現況 | 建議 |
|---|------|------|------|
| T1 | 訊息翻譯目標語選單 | 原僅中↔英自動 | ✅ API `target_lang` + `messages.html` 選單 + `GET /api/translation/target-languages` |
| T2 | 訊息頁 UI i18n | 翻譯按鈕／toast | ✅ `messages.translate*` locale（選單標籤仍靠 API label） |
| T3 | 換目標語重新翻譯 | 同則訊息 cache 以 `message_id+user_id` 一筆 | 不同 `target_lang` 應允許重翻並扣點（已於 T1 API） |
| T4 | 圖片訊息「翻譯」 | **暫不規劃**（見下） | 純圖片泡泡不顯示翻譯鈕；有文字才翻譯 |

**T4 說明（避免誤解）：** 對話可傳 **相片**（實拍、截圖、包裝標籤等），與站內 **AI 生圖** 無關。現行翻譯 API 只處理 `body` 文字；若要做「從相片讀字再翻譯」才需要 **OCR／Vision**（例如使用者傳 LINE 截圖、外文標籤照）。MatchDO 常見用法是傳產品照＋**文字說明**，或只傳設計稿（多半無可翻字串），**產品上不必預設做 OCR**；若日後有「只傳截圖要翻譯」需求再開 T4 並定扣點。

### P2 — 廠商／訂製 UGC（DB 多語）

| # | 項目 | 現況 | 建議 |
|---|------|------|------|
| U1 | 素材單筆 EN **手動**編輯 UI | ✅ 三種 asset_kind 上傳含 `title_en`／`description_en`（`materials-u1-desc-en-upload-20260929`） | — |
| U2 | **雙向／多語** 內容欄 | 僅 `*_en` 一軸 | 產品定案：加 `title_ja`… 或「生成到使用者選擇語系」通用 API |
| U3 | 供應商 B 線 `supplier_catalog_items` | ✅ `GET …/supplier-catalog-items?lang=`；上架後台 EN 欄 + `POST …/catalog-items/:id/generate-i18n-en` + 上傳自動補英文 | migration `supplier-catalog-i18n-en` 仍須在 Supabase 執行 |
| U4 | 訂製需求／詢價 `demands`、專案描述 | ✅ `demands.html`「翻譯」+ `POST …/custom-products/:id/translate-for-view`（1 點，不寫 DB） | `manufacturer-inquiries.html` 已改導向聯絡設定，非現行入口 |
| U5 | `capability_custom_labels`、聯絡頁 `bio` | ✅ 自填工藝 `*_en`（素材／作品 **編輯**彈窗「其他工藝」+ 選填英文）、`contact_info.bio`／`bio_en`；migration `vendor-capability-custom-labels-i18n-en` | 新增作品表單仍無工藝欄 |
| U6 | 英文過期提示 | **已取消**（初期展示用，正式產品不做） | — |

### P3 — 平台字典與其他

| # | 項目 | 現況 | 建議 |
|---|------|------|------|
| D1 | 官方分類／攝影參數組等 | 後台 `name_en` 手填 + 部分 migration | 延續 `admin-content-multilang` checklist |
| D2 | 我的配色／平台配色 | `name_en`／`note_en` | ✅ 已支援讀取 |
| D3 | 即時翻譯 widget | ✅ `public/js/translate-target-select.js`（`messages.html`）；訂製需求僅按鈕、目標語跟 UI | 其他頁面按需掛載 |
| D4 | 管理員訊息監看翻譯 | 未查 | 若 admin 看對話需翻譯，另開 |

---

## 非目標（本計畫不混）

- **UI 字串** → `public/locales/*.json`（見 `FRONTEND-I18N-AUDIT.md`）。
- **FLUX／材料語意** → `docs/flux-and-gemini-prompt-policy.md`（禁止查表硬編；非 UGC 翻譯）。
- **設計風向 B4** → 凍結。

---

## API 契約（訊息翻譯）

```http
GET /api/translation/target-languages?lang=en
→ { items: [ { code: "zh-TW", label: "Traditional Chinese" }, ... ], default: "en" }

POST /api/direct-messages/:msgId/translate
Body: { "target_lang": "ja" }   // 可省略：依 UI locale 推斷，再 fallback 舊中↔英
```

---

## 相關檔案

| 檔案 | 用途 |
|------|------|
| `lib/message-translate-langs.js` | 允許目標語清單 |
| `client/messages.html` | 對話 UI + 目標語選單 |
| `server.js` | translate 端點、vendor `generate-i18n-en` |
| `docs/PROGRESS-vendor-content-i18n-en.md` | 廠商 `*_en` 進度 |
| `docs/points-deduction-plan.md` | 翻譯扣點（對話／訂製需求翻譯已實作） |

---

## 狀態

- **T1–T2（對話）**：已實作（見 `git log` 含 `lib/message-translate-langs.js`）。
- **U1、U3–U5、T1–T3**：已實作（見 `git log`）；**U2** 多語軸待產品定案；**D1、D4** 仍待排期。
