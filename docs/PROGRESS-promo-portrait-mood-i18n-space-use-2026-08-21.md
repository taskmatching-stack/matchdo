# 交接：商攝人像氛圍／英文化／空間用途後台（2026-08-21）

**接續請先讀本檔。已完成項目勿重做。**  
相關隔離規則仍有效：`.cursor/rules/promo-camera-app-isolation.mdc`（Store L4 勿改線上 PWA 殼）。

---

## 目前 git／部署狀態

| 項目 | 狀態 |
|------|------|
| 遠端 `main`（英文化＋空間用途程式內建英文） | `9d71c6a` 已 push |
| **本交接 commit**（空間用途後台＋前端 fallback） | 見下方 push 後 hash |
| Cloud Run 正式站 | **未必已部署**；部署指令見文末 |
| 本機 | 需重啟 `npm start` 才吃到最新 `server.js` |

---

## 已完成（勿重做）

### A. 人像・清晰／氛圍

- **清晰** = Gemini；**氛圍** = FLUX（模型名不露前台）
- 氛圍短提示詞（BFL 官網實測）：`改為在{場景名}，人物姿勢依情境調整` + camera block + no-text  
  - **不送**主題／場景長文 `scene_prompt`／composition（長詞會換臉）
  - 證件正式主題 `portrait_formal_id`：姿勢改「姿勢維持參考圖」（氛圍已藏主題 UI，此路徑實務上少用）
- 氛圍：**隱藏主題 UI**、不送 `theme_key`、不強制選主題
- 氛圍預設解析度 **1MP**；清晰維持既有
- 氛圍標籤：**橘黃 BETA 徽章**（與空間攝影 tab 同格式）
- FLUX：`prompt_upsampling: true`、`safety_tolerance: 2`、邊長上限 1024（API 尺寸，不寫進 prompt）
- 預設生成風格：**清晰**
- 臨時除錯：`/promo-camera?prompt_debug=1`（黃色預覽按鈕，不扣點）— **非產品常駐功能**

### B. 商攝前台英文化（大幅補強）

- `public/locales/zh-TW.json` / `en.json`：大量 `promoCamera.*` 鍵
- `promo-camera.html` / `promo-camera-app.html`：模式列、空間／人像區塊、`data-i18n`
- `index.js` / `spec-summary-ui.js`：歡迎語、生成鈕、點數文案、摘要列等走 `t()`
- **空間用途下拉**：API 依 `lang`；前端另有 `SPACE_USE_LABEL_EN` 對照，避免舊行程 `name_en` 仍是中文

### C. 空間用途後台（本交接重點）

| 項目 | 路徑／說明 |
|------|------------|
| 後台頁 | `/admin/promo-space-use-types.html` |
| 選單 | 分類與內容 → **商攝・空間用途**（`sidebar.html`） |
| Migration | `docs/add-promo-space-use-types.sql`；維護 id=`promo-space-use-types` |
| Admin API | `GET/POST /api/admin/promo-space-use-types`，`PATCH .../:key` |
| 前台讀取 | `loadPromoSpaceUseTypesForApi(lang)`（表空／未建 → fallback 程式內建） |
| 多語 | `name` + `name_en`（必填英文給前台）＋ ja/es/de/fr 選填；`layout_label`／`layout_label_en` 選填 |

**使用者須執行一次 migration**（否則後台 503、前台仍用程式 fallback）：

1. 後台「資料庫維護」執行 `promo-space-use-types`，或  
2. 手動跑 `docs/add-promo-space-use-types.sql`

---

## 明確「不是」／勿再找後台

| 誤以為 | 實際 |
|--------|------|
| 空間用途以前在「情境圖主題／場景」 | **否**；主題／場景是另一套 |
| 空間用途在「商攝導演參數」 | **否**；那是相機參數 |
| 改完後台即可不用 deploy | **否**；後台頁＋API 要上線；DB migration 另做 |

---

## 關鍵檔案

```
lib/promo-space-gemini.js          # SPACE_USE_TYPES 內建 fallback＋label_en
lib/admin-migrations.js            # promo-space-use-types
docs/add-promo-space-use-types.sql
public/admin/promo-space-use-types.html
public/admin/partials/sidebar.html
server.js                          # loadPromoSpaceUseTypesForApi、admin CRUD
public/js/promo-camera/index.js    # 氛圍藏主題、1MP、EN fallback
public/js/promo-camera/spec-summary-ui.js
public/client/promo-camera.html
public/client/promo-camera-app.html
public/css/promo-camera.css        # .pc-beta-badge
public/locales/en.json / zh-TW.json
```

人像 FLUX 組裝：`buildPromoPortraitFluxPrompt`（`server.js`）。

---

## 已知限制／未做（可接續）

1. **正式站部署**：push 後仍須 Cloud Shell deploy（見下）。
2. **Migration 尚未保證已在正式／本機 DB 執行** — 新視窗先確認後台頁能列出 7 筆 seed。
3. `layout_label` 寫入 DB 後，**生圖 prompt 多數仍走程式內建** `getSpaceUseLayoutLabel`；若要提示詞也跟後台走，需另開（讀 DB／cache）。
4. 新增後台 key 後，**區域意圖（zone intents）** 仍可能 fallback 住家那套；客製 zone 未做後台。
5. 商攝仍有零星錯誤／toast 中文硬編碼；主題／場景名靠 API `lang`＋DB `name_en`（後台「情境圖主題／場景」填）。
6. Store／L3 PWA 隔離：**勿為 Store 改** `promo-camera-app.html` 殼；本次英文化／空間用途屬共用產品，已改 shared 檔。

---

## 新視窗建議第一步

1. 確認本交接 commit 已在 `origin/main`。
2. 執行 migration `promo-space-use-types`。
3. 開 `/admin/promo-space-use-types.html` 確認列表＋英文欄。
4. 本機重啟 Node → `/promo-camera?lang=en` → Space → Space use 應為英文。
5. 若要上線：deploy（下方指令）。

---

## 部署（Cloud Shell・必用靜音版）

```bash
gcloud config set account taskmatching@gmail.com
gcloud config set project matchdo
```

```bash
cd ~/matchdo && git fetch origin main && git reset --hard origin/main && ( gcloud run deploy matchdo --source . --region=asia-northeast1 --allow-unauthenticated --clear-base-image && gcloud run services update-traffic matchdo --region=asia-northeast1 --to-latest ) 2>&1 | grep --line-buffered -v -E 'Regional Access Boundary|taskmatchlng'
```

（成功以 `Done.` 為準。）

---

## 近期相關 commit（方便對照）

- `9d71c6a` — 商攝英文化＋空間用途程式內建英文  
- `39dbb48` — 氛圍 BETA 橘黃徽章  
- `7abad6b` — 氛圍標 Beta  
- `5a267d6` — 氛圍預設 1MP；人物姿勢依情境調整  
- `dc8ba5a` — 氛圍隱藏主題  
- 更早：mood 短 prompt、upsampling、清晰預設、`prompt_debug` 等  

Agent transcript（本段對話）：`5282d644-d841-4058-8a10-088f53c77cf5`
