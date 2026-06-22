# 廠商 UGC 英文欄位（i18n-en）— 工作進度與測試手冊（2026-06-21）

> 原則：**英文存資料庫 `*_en` 欄**，讀取時 `?lang=en` 切換；**不做即時翻譯**。  
> Gemini 僅在廠商後台「生成英文」時寫入 DB（展示文案，與 FLUX／材料語意管線無關）。

---

## 點數政策（必守）

**廠商 UGC 英文為網站基礎功能，全程不扣點。**

| 行為 | 是否扣點 |
|------|----------|
| `GET …?lang=en` 讀取英文欄 | 否 |
| `POST /api/me/manufacturer/generate-i18n-en`（含 `scope=all`） | **否** |
| `PATCH /api/me/manufacturer` 手動寫入 `*_en` | 否 |

與站內訊息翻譯（`POST /api/direct-messages/:msgId/translate`，扣 1 點）**分開**；日後擴充本功能時亦不得改為扣點，除非產品另開決策並改文件。

---

## 產品目標（已定案）

1. 廠商自己填的中文（名稱、簡介、素材標題、作品、自訂分類）在英文訪客切語系時可顯示英文版。
2. 英文可由 **AI 批次生成** 或 **手動編輯** 寫入 DB。
3. 公開頁 `vendor-profile.html` 已有 `hreflang=en`；內容須與 `?lang=en` 一致（非只翻 UI 外殼）。

---

## 已推送到 `origin/main` 的 commit

| Commit | 說明 |
|--------|------|
| `13da814` | SQL migration 檔、`*_en` 欄位、`GET ?lang=en` 讀取、控制台簡介英文生成 |
| `edcc0ab` | 批次生成：素材／作品／分類、`scope=all`、`catalog-groups` 支援 `lang=en` |

**Migration 檔（須手動在 Supabase 執行）：** `docs/add-vendor-content-i18n-en.sql`

---

## 資料庫欄位

| 表 | 新增欄位 |
|----|----------|
| `manufacturers` | `name_en`, `description_en`, `i18n_en_generated_at`, `i18n_en_source_hash` |
| `vendor_assets` | `title_en`, `description_en` |
| `manufacturer_portfolio` | `title_en`, `description_en`, `design_highlight_en` |
| `vendor_catalog_groups` | `name_en` |

**不翻譯、不存 en：** `contact_json`、地址、Email、URL、社群連結、圖片。

---

## API 摘要

### 讀取（公開，帶 `?lang=en`）

| 端點 | 行為 |
|------|------|
| `GET /api/manufacturers/:id?lang=en` | `name` / `specialty` 優先 `*_en`，無則 fallback 中文；`portfolio[]` 標題／描述／設計亮點同理 |
| `GET /api/vendor-assets?manufacturer_id=…&for_profile=1&lang=en` | 素材 `title` / `description`、列表內 `manufacturer_name` |
| `GET /api/manufacturers/:id/catalog-groups?lang=en` | 自訂分類 `name`、pill `label` |

回傳同時保留 `name_zh` / `name_en` 等對照欄（方便除錯）；前端公開頁主要用已切換後的 `name`、`title`。

**未執行 migration：** 英文欄位相關寫入 API 回 `503`，提示執行 SQL。

### 寫入（登入廠商）

| 端點 | 行為 |
|------|------|
| `PATCH /api/me/manufacturer` | 可傳 `name_en`、`description_en`（手動） |
| `POST /api/me/manufacturer/generate-i18n-en` | Gemini 生成並寫入 DB |

**`generate-i18n-en` body：**

```json
{
  "scope": "profile",
  "overwrite": false
}
```

| `scope` | 翻譯對象 |
|---------|----------|
| `profile`（預設） | 廠商 `name`、`description` |
| `assets` | 該廠商全部 `vendor_assets` |
| `portfolio` | 該廠商全部 `manufacturer_portfolio` |
| `catalog_groups` | 該廠商全部 `vendor_catalog_groups` |
| `all` | 以上全部 |

| `overwrite` | 行為 |
|-------------|------|
| `false`（預設） | 只處理**尚無任何英文欄**且中文非空的項目 |
| `true` | 覆寫已有英文 |

- 每批最多 **15 筆** 送 Gemini（`runInGeminiQueue`）。
- 模型：`getTranslationModelName()`（後台 `gemini_model`）。
- **不扣點**（平台基礎功能；實作未呼叫 `user_credits` / `credits/consume`）。
- `scope=profile` 且已有英文且 `overwrite=false` → `409`。

---

## 前端入口

| 頁面 | 說明 |
|------|------|
| `public/client/manufacturer-dashboard.html` | 手風琴「**英文版（公開頁 lang=en）**」：手動編輯、**AI 生成簡介英文**、**AI 生成全部英文**、預覽英文公開頁 |
| `public/vendor-profile.html` | `?lang=en` 或站內 `i18n.getLang()` 為 en 時，API 帶 `lang=en`（含素材庫、catalog-groups） |

**尚未做：** 素材庫／作品單筆編輯頁的英文欄位 UI；儲存中文後自動排程翻譯；種子廠商 admin 批次回填腳本。

---

## 部署與上線檢查

1. **Supabase：** 執行 `docs/add-vendor-content-i18n-en.sql`（只需一次）。
2. **程式：** `git fetch` + `reset --hard origin/main`（目前含 `edcc0ab`）後 Cloud Run 部署（見 `docs/deploy-matchdo-push-and-deploy.md`）。
3. **環境：** `GEMINI_API_KEY` 已設（與其他 Gemini 功能共用）。

---

## 建議測試清單（使用者自測）

### 前置

- [ ] SQL migration 已執行
- [ ] 已部署 `edcc0ab` 或更新
- [ ] 測試廠商已有中文：`manufacturers.name`、`description`；至少 1 筆素材有 `title`；可選作品、自訂分類

### 控制台

- [ ] 登入 → **製造商控制台** → 展開「英文版」
- [ ] **AI 生成簡介英文** → 欄位出現英文 → **儲存英文**
- [ ] **AI 生成全部英文** → 訊息顯示素材／作品／分類筆數
- [ ] **預覽英文公開頁** → URL 含 `&lang=en`

### 公開頁

- [ ] `vendor-profile.html?id={廠商UUID}&lang=en`：頁首名稱、簡介為英文
- [ ] 同頁「素材庫」卡片標題為英文（需該素材已有 `title_en`）
- [ ] 自訂分類 pill 為英文（需 `name_en`）
- [ ] 作品集區塊標題為英文（需 `title_en`）
- [ ] 無英文欄時仍顯示中文（fallback），頁面不應 500

### API 抽查（可選）

```bash
# 英文廠商詳情
curl -s "https://matchdo.cc/api/manufacturers/{UUID}?lang=en" | jq '.name,.specialty,.lang'

# 英文素材（需 manufacturer_id）
curl -s "https://matchdo.cc/api/vendor-assets?manufacturer_id={UUID}&for_profile=1&lang=en" | jq '.items[0].title'
```

### 迴歸

- [ ] 不帶 `lang` 或 `lang=zh` 時仍顯示中文
- [ ] 種子廠商若禁止自助寫入，生成 API 應維持既有 403 行為

---

## 已知限制／後續可做

1. **聯絡資訊頁**（`profile/contact-info.html`）的 `company_name`／`bio` 與 `manufacturers.description` **未自動同步**；公開頁簡介以 `manufacturers.description` 為準。
2. **`location`（縣市）** 未翻譯；服務地區仍用 `AreaCodes` 的 `en` 標籤。
3. **`capability_custom_labels`** 自填工藝文案未納入本階段。
4. **中文變更後** 僅靠 `i18n_en_source_hash` 記錄廠商層；尚未在 UI 提示「英文可能過期」。
5. **單筆素材／作品** 後台尚無英文編輯欄；需靠「生成全部」或之後補 UI。

---

## 相關檔案

| 檔案 | 用途 |
|------|------|
| `docs/add-vendor-content-i18n-en.sql` | DB migration |
| `server.js` | `pickVendorLocalizedText`、`generate-i18n-en`、讀取端 `lang` |
| `public/client/manufacturer-dashboard.html` | 廠商後台英文 UI |
| `public/vendor-profile.html` | 公開頁 `lang` 參數 |

---

## 狀態：**Phase 1 + Phase 2 已完成（待你測試驗收）**

- ✅ DB 設計 + migration 檔  
- ✅ 讀取 `?lang=en`（廠商、素材、作品、catalog-groups）  
- ✅ 手動 PATCH 英文  
- ✅ Gemini 生成（profile / assets / portfolio / catalog_groups / all）  
- ⏳ 單筆編輯 UI、儲存後自動翻譯、過期提示 — **未做**

測試通過後若要補「素材上傳後自動補英文」或 admin 批次腳本，可開新對話引用本檔。
