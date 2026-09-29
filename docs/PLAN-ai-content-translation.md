# AI 內容翻譯（雙向、可選目標語）— 盤點與待辦

> **本檔性質：產品／工程待辦清單（盤點），不是「繼續往下執行」的預設開工單。**

## 使用者定案（2026-09-29）

- 使用者要求：**檢查站內 AI 翻譯現況，並寫進待辦**（含雙向、可選目標語等構想）。
- **未要求** Agent 在未點名時接續實作本檔 T/U/D 項。
- **Agent 必守**：`繼續往下執行及推送` 預設接 **主線待辦**（見 `docs/FRONTEND-I18N-AUDIT.md` P1/P2、部署 migration、非翻譯 UX）；**勿**再主動加翻譯 API／選單／B 線 i18n 除非使用者當次明說要做翻譯。
- 2026-09-29 晚間曾誤實作若干項（對話目標語、控制台英文過期提示、B 線 catalog `title_en` 等）— 程式已 push，**後續以本檔記錄為準，預設凍結擴充**。

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
| U1 | 素材單筆 EN **手動**編輯 UI | 有 EN 欄／AI 補英文；官方批次有 | 確認所有 asset_kind 表單一致；缺則補欄位 |
| U2 | **雙向／多語** 內容欄 | 僅 `*_en` 一軸 | 產品定案：加 `title_ja`… 或「生成到使用者選擇語系」通用 API |
| U3 | 供應商 B 線 `supplier_catalog_items` | 進行中：`add-supplier-catalog-i18n-en.sql` + `GET …/supplier-catalog-items?lang=` | 待補：上架後台 EN 欄、`generate-i18n-en` |
| U4 | 訂製需求／詢價 `demands`、專案描述 | 無 AI 翻譯 | 視媒合流程加「翻譯給對方看」（可扣點） |
| U5 | `capability_custom_labels`、聯絡頁 `bio` | 未納入 vendor i18n | 見 `PROGRESS-vendor-content-i18n-en.md` 限制 |
| U6 | 英文過期提示 | ✅ `GET /api/me/manufacturer` → `i18n_en_stale`；控制台橫幅 | 素材／作品層 hash 仍待補 |

### P3 — 平台字典與其他

| # | 項目 | 現況 | 建議 |
|---|------|------|------|
| D1 | 官方分類／攝影參數組等 | 後台 `name_en` 手填 + 部分 migration | 延續 `admin-content-multilang` checklist |
| D2 | 我的配色／平台配色 | `name_en`／`note_en` | ✅ 已支援讀取 |
| D3 | 即時翻譯 widget | 無全站共用元件 | 抽 `translateTargetSelect` 供對話、詢價、評論（若有）共用 |
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
| `docs/points-deduction-plan.md` | 翻譯扣點（文件曾寫「尚未實作」，對話已實作，可更新） |

---

## 狀態

- **T1–T2（對話）**：已實作（見 `git log` 含 `lib/message-translate-langs.js`）。
- **U1–U6、D1–D4**：待產品排期；以本檔為 AI 翻譯主 backlog。
