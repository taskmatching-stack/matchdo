# 商攝・空間模式（layout_plan / eye_level）進度 handoff

> **給新對話接續用** — 2026-08-11  
> **規格母本：** [`PLAN-promo-camera-shoot-modes.md`](PLAN-promo-camera-shoot-modes.md)（§3 空間、§10.4 UI、§10.5 eye_level API）  
> **隔離規則：** `.cursor/rules/promo-camera-app-isolation.mdc`（L3b 凍結；共用檔可修三入口 bug）

---

## 0. 本機狀態（接續前先確認）

| 項目 | 狀態 |
|------|------|
| **eye_level prompt** | 主訴求句固定：`***{視角}***，***捨棄原圖視角***，…{區}***商業攝影圖***`；**可附加** `鏡頭與曝光：…`（官網加鏡頭OK）。禁止刪 ***／捨棄原圖視角。 |
| **解析度 1024 根因（官網）** | Gemini 圖**預設 1K＝1024×1024**；須 `imageConfig.imageSize: "2K"`（**K 大寫**）。未生效＝1024。見 [image-generation](https://ai.google.dev/gemini-api/docs/image-generation)。本機另以 sharp 強制 ≥2048。 |
| **送出鈕修法** | ① click 先同步 textarea→`userPrompt` 再 `canGenerate`；② guided 批次後端不再強制要視角文案 |
| **平視可測** | 可 **上傳 ISO 地圖**（不依賴資產庫已有 layout） |
| **尚需瀏覽器** | checklist #2～#4；Node 須已載入本輪 `server.js` |

**本機重啟指令（PowerShell）：**

```powershell
$conn = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object -First 1
if ($conn) { Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue; Start-Sleep -Seconds 2 }
cd "d:\AI建站\ai-matching"
node server.js
```

若 API 回 501 或行為像舊版 → **幾乎一定是 Node 沒重啟**，不是前端快取。

---

## 1. 功能總覽（P0a + P1 部分）

### 1.1 空間兩種輸出

| `space_output_type` | 引擎 | 參考圖 | 點數 key |
|---------------------|------|--------|----------|
| `layout_plan` | Gemini Pro（`gemini_model_promo_space_layout`） | 平面配置圖 + 選填風格圖／產品圖 | `points_promo_space_layout_gemini` / `_4k` |
| `eye_level` | Gemini Pro（`gemini_model_promo_space_eye_level`） | **ISO 空間地圖**（`layout_generation_id` 或 URL） | `points_promo_space_eye_level_gemini` / `_4k` |

### 1.2 eye_level 兩種模式

| 模式 | 觸發 | API 行為 |
|------|------|----------|
| **explicit（明確視角）** | 不勾區域 + 填 `user_prompt`（例：站在門口看沙發） | 單張；`buildPromoSpaceEyeLevelExplicitGeminiPrompt` |
| **guided（區域套圖）** | 勾選 `shot_intent_keys[]`（客廳、主臥…） | 批次 N 張；`handlePromoCameraSpaceEyeLevelBatchGenerate` 迴圈 |

**尚未實作：** `eye_level_compare_sets[]`（多 layout × 同組區域對比）、後台 DB `promo_space_zone_intents` CRUD、Flash Lite  per-zone 視角擴寫（人像套圖那套）。

---

## 2. 本輪已修關鍵 bug（必讀）

### 2.1 平視「角度完全沒變」— 根因與修法

**根因：** 前端預設 `camera.shooting_angle = keep_reference`，英文 fragment 為 *do not reshoot from a different angle*。  
`layout_plan` 早已在 `buildPromoSpaceLayoutCameraBlock` 剔除 `shooting_angle`；**eye_level 漏了**，導致 Gemini 鎖死 ISO 45° 視角。

**修法（`server.js`）：** `buildPromoSpaceEyeLevelCameraBlock` 現在也 `delete shooting_angle`、`delete subject_preservation`，只送鏡頭／曝光。

### 2.2 Prompt 對齊官網實測有效句

使用者在 [Google AI Studio / Gemini 官網] 實測成功句：

```text
利用這個地圖幫我生成***站在門口看沙發的視角***，捨棄原圖視角，室內設計用的客廳商業攝影圖，不需要任何文字
```

**已寫入 `lib/promo-space-gemini.js`：**

- 共用常數 `EYE_LEVEL_DISCARD_ORIGINAL_VIEW`：
  ```text
  ***捨棄原圖視角***，完全不要沿用參考圖的 ISO、45 度、俯視、鳥瞰或任何原圖拍攝角度與構圖
  ```
- explicit：`幫我生成***{viewpoint}***` + 上述 + `輸出必須是全新平視構圖，不得複製或微調原圖視角`
- guided：`幫我生成***{zoneLabel}的人眼平視視角***` + 同上

### 2.3 layout_plan 俯視／鎖角

**根因：** `shooting_angle: keep_reference` 也會鎖 layout。  
**修法：** `buildPromoSpaceLayoutCameraBlock` 剔除 angle；prompt 用 `***45度ISO視角…***` 強調（見 `buildPromoSpaceLayoutPlanGeminiPrompt`）。

### 2.4 輸出仍 1024×1024

**根因：** Gemini SDK 常忽略 `imageConfig.imageSize: '2K'`；前端曾預設 1024。

**修法（`lib/promo-space-gemini.js`）：**

- `resolveSpaceOutputDimensions()` — 依 `aspect_ratio` + `space_resolution_tier`（2k/4k）算目標像素，**不信任** client 1024
- `ensurePromoSpaceOutputDimensions()` — sharp lanczos3 **一律** resize 至目標
- API 回 `output_width` / `output_height`（實際像素）
- options API：`space_ratio_presets_2k`、`space_ratio_presets_4k`

**2K 1:1 = 2048×2048**（最長邊 2048；4K 最長邊 4096）。

---

## 3. 關鍵檔案對照

| 檔案 | 職責 |
|------|------|
| `lib/promo-space-gemini.js` | prompt 組裝、尺寸表、zone intents 內建字典、`ensurePromoSpaceOutputDimensions` |
| `server.js` | `handlePromoCameraSpaceGenerate`、`handlePromoCameraSpaceEyeLevelGenerate`、`handlePromoCameraSpaceEyeLevelBatchGenerate`、`generatePromoSpaceEyeLevelImageWithGemini`、camera block 過濾 |
| `public/js/promo-camera/state.js` | `spaceOutputType`、`spaceZoneIntentKeys`、generate payload（guided / explicit） |
| `public/js/promo-camera/index.js` | 區域勾選 UI、點數預覽、對照圖標籤 |
| `public/client/promo-camera.html` | 空間模式 UI（含 eye_level 區域勾選） |
| `docs/add-promo-space-gemini-config.sql` | `payment_config`：model 名、點數（含 4K） |
| `lib/admin-migrations.js` | migration id `promo-space-gemini-config` |
| `public/admin/ai-settings.html` | 後台 Gemini 模型／點數設定 UI |

**Build 標記（部署確認用）：**  
`window.__MATCHDO_PROMO_CAMERA_BUILD = 'promo-camera-space-res-20260811'`

---

## 4. API 速查

### 4.1 POST `/api/promo-camera/generate`

**layout_plan：**

```json
{
  "shoot_mode": "space",
  "space_output_type": "layout_plan",
  "floor_plan": "...",
  "space_style_source": "prompt",
  "user_prompt": "莫蘭迪配色",
  "space_use_type": "residential",
  "space_resolution_tier": "2k",
  "aspect_ratio": "1:1"
}
```

**eye_level explicit：**

```json
{
  "shoot_mode": "space",
  "space_output_type": "eye_level",
  "layout_generation_id": "uuid",
  "user_prompt": "站在門口看沙發",
  "space_use_type": "residential",
  "space_resolution_tier": "2k",
  "aspect_ratio": "1:1",
  "camera": { "lens": "35mm_standard" }
}
```

**eye_level guided 批次：**

```json
{
  "shoot_mode": "space",
  "space_output_type": "eye_level",
  "view_mode": "guided",
  "layout_generation_id": "uuid",
  "shot_intent_keys": ["living", "master_bedroom"],
  "space_use_type": "residential"
}
```

回應批次：`{ batch: true, results: [...] }`；單張：`imageData` / `image_url` + `final_prompt` + `output_width` / `output_height`。

### 4.2 GET `/api/promo-camera/options`

含 `zone_intents_by_type`（7 種 `space_use_type` 的區域 checklist）、`space_ratio_presets_2k` / `_4k`。

---

## 5. 測試 checklist（接續者必跑）

| # | 案例 | 預期 |
|---|------|------|
| 1 | layout_plan 2K 1:1 | 輸出 ≥2048 長邊；45° ISO 非正俯視 |
| 2 | eye_level + `站在門口看沙發` | **右圖與左 ISO 構圖明顯不同**；人眼平視 |
| 3 | 檢查 `final_prompt` | 含 `***捨棄原圖視角***`；**不含** `keep the same camera angle` |
| 4 | 勾 3 區域批次 | 扣 3× 點數；`results.length === 3`；每張 prompt 區域不同 |
| 5 | 重啟 Node 後再測 | 避免 501 stub 或舊 handler |

**若角度仍不變：** 先看 Network → generate 回應的 `final_prompt` 與 request body 的 `camera.shooting_angle` 是否仍被送出（後端應已過濾）。

---

## 6. 待做 backlog（依 PLAN §10.5.3）

| 優先 | 項目 |
|------|------|
| P1 | `eye_level_compare_sets[]` — 多 layout × 同組 zone 對比 |
| P1 | SQL + 後台 CRUD：`promo_space_zone_intents`（目前用 `SPACE_ZONE_INTENTS` 內建 fallback） |
| P2 | Flash Lite 為每 zone 擴寫具體站位句（若 guided 模板仍不足） |
| P2 | `promo-camera-app.html` / `app-shell.js` 同步（僅必要時；L3b 凍結） |
| 部署 | commit → push `main` → Cloud Shell 部署（見 `.cursor/rules/deployment.mdc` §3.1 整行 grep） |
| DB | 線上跑 `docs/add-promo-space-gemini-config.sql`（若 migration 未執行） |

---

## 7. 與人像套圖的差異（使用者曾問）

| | 人像 batch | 空間 eye_level guided |
|---|-----------|------------------------|
| 引擎 | FLUX | Gemini Pro |
| 多張觸發 | `output_count` | `shot_intent_keys[]` |
| 變因 | **Flash Lite** 產 N 條英文 brief | **內建 zone `intent_brief`** + Pro 讀地圖判站位 |
| Flash Lite | ✅ 有 | ❌ **未接** |

若使用者要「人像同款 Flash Lite 擴寫」，需新開功能，非現有 guided 路徑。

---

## 8. 隔離提醒（改檔前必讀）

- **可改（三入口共用 bug）：** `promo-camera.html`、`index.js`、`state.js`、`api.js`、`promo-camera.css`
- **L3b 凍結（非必要勿改）：** `promo-camera-app.html`、`app-shell.js`
- **Store 實驗：** 只改 `apps/matchdo-promo-camera/`

---

## 9. 相關 commit / 文件

- 規劃：`docs/PLAN-promo-camera-shoot-modes.md`
- SQL：`docs/add-promo-space-gemini-config.sql`、`docs/add-promo-shoot-modes.sql`
- Store handoff（另一條線）：`docs/PROGRESS-promo-camera-app-store.md`
- 後台模型說明：`docs/admin-ai-settings-models.md`

**接續開發建議第一句：**

> 請先讀 `docs/PROGRESS-promo-camera-space-eye-level.md`，確認本機 Node 已重啟，再繼續 eye_level 測試或 backlog。
