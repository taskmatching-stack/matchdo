# 後台 AI 模型設定（`/admin/ai-settings.html`）

更新日期：2026-08-06

---

## 1. 管理頁位置與權限

| 項目 | 說明 |
|------|------|
| **頁面** | [`/admin/ai-settings.html`](../public/admin/ai-settings.html)（側欄「AI 設定」） |
| **權限** | 僅**管理員**（`requireAdmin`）可讀寫 |
| **模型 API** | `GET`／`PATCH` [`/api/admin/ai-config`](../server.js) |
| **語意提示詞 API** | `GET`／`PATCH` [`/api/admin/semantics-prompts`](../server.js) |
| **儲存位置** | Supabase `payment_config` 表，鍵名見下表 |

本頁涵蓋 **重繪引擎切換**、**Gemini**（翻譯／讀圖／標籤／材料優化／材料組合 Lite・Flash）與 **FLUX** 多槽。

---

## 1.1 重繪引擎切換（`*_engine`）

| 後台欄位 | `payment_config.key` | 環境變數備援 | 影響範圍 |
|----------|----------------------|--------------|----------|
| 數位原型／零件／材料 AI 重繪 | `vendor_asset_optimize_engine` | `VENDOR_ASSET_OPTIMIZE_ENGINE` | 官方／廠商／供應商「AI 重繪」 |
| 材料組合生圖 | `material_dual_color_engine` | `MATERIAL_DUAL_COLOR_ENGINE` | `material-dual-color` |
| 印花資產 AI 重繪 | `print_asset_engine` | `PRINT_ASSET_ENGINE` | 印花資產重繪 |
| 圖樣提取 | `pattern_extract_engine` | `PATTERN_EXTRACT_ENGINE` | `/pattern-extract/` |
| 空間平視（對照 ISO） | `promo_space_eye_level_engine` | `PROMO_SPACE_EYE_LEVEL_ENGINE` | `/promo-camera` 空間 `eye_level`；備援 FLUX.2 [max] |

可選值：`auto`（Gemini 優先，滿額／429 → FLUX）、`gemini`（僅 Gemini）、`flux`（僅 FLUX）。  
**優先序**：DB 已存值 → 環境變數 → 預設 `auto`。儲存後立即生效。

---

## 2. Gemini 與 FLUX 模型

### 2.1 FLUX 生圖模型（`bfl_flux_model_*`）

| 後台欄位 | `payment_config.key` | 程式預設 | 用途 |
|----------|----------------------|----------|------|
| 訂製設計頁生圖 | `bfl_flux_model_generate` | `flux-2-pro` | `POST /api/generate-product-image` |
| 廠商產品 AI 重繪 | `bfl_flux_model_vendor_product` | `flux-2-pro` | 數位原型／零件白底重繪（含備援／強制 FLUX） |
| 廠商材料／材料組合 FLUX | `bfl_flux_model_vendor_material` | `flux-2-pro` | 材料重繪與材料組合備援／強制 FLUX |
| 實境模擬／圖樣提取 | `bfl_flux_model_scene_pattern` | `flux-2-pro` | 實境合成、圖樣提取 |
| 寫實化 | `bfl_flux_model_design_to_physical` | `flux-2-pro` | 設計頁／廠商寫實化（獨立槽） |
| 空間平視（對照 ISO）備援 | `bfl_flux_model_promo_space_eye_level` | **`flux-2-max`** | 商攝導演平視備援／強制 FLUX |

可選 model id 與 Playground 相同（`flux-2-pro`、`flux-2-max` 等），亦支援**後台手填**新型號（`flux-2-*` → `POST /v1/{id}`），無需改程式或下拉枚舉。

### 2.2 Gemini 模型（分開設定、互不覆寫）

後台「Gemini 模型設定」卡片內欄位：

| 後台欄位 | `payment_config.key` | 程式讀取 | 用途摘要 |
|----------|----------------------|----------|----------|
| Gemini 翻譯模型 | `gemini_model` | `getTranslationModelName()` | 生圖前將中文 prompt 翻成英文等輕量文字任務 |
| Gemini 讀圖／分析模型 | `gemini_model_read` | `getReadModelName()` | 客製產品分析、參考圖描述、首頁工項 AI 識別等**一般讀圖／結構化分析** |
| Gemini 標籤用讀圖模型 | `gemini_model_tagging` | `getTaggingModelName()` | 訂製**生成圖**與**廠商數位原型**自動標籤 |
| Gemini 材料／版型 AI 重繪 | `gemini_model_material_optimize` | `getMaterialOptimizeModelName()` | 廠商／官方／供應商材料與數位原型／版型 img2img |
| **材料組合・Lite** | `gemini_model_material_combo_lite` | `getMaterialComboLiteModelName()` | 材料組合**僅色卡**生圖（Nano Banana Lite） |
| **材料組合・Flash** | `gemini_model_material_combo_flash` | `getMaterialComboFlashModelName()` | 材料組合**色卡＋印花**生圖（Nano Banana Flash） |
| **印花 AI 重繪** | `gemini_model_print_asset` | `getPrintAssetOptimizeModelName()` | 印花資產 AI 重繪（預設 Lite；滿額可 FLUX） |
| **空間攝影・ISO 空間地圖** | `gemini_model_promo_space_layout` | `getPromoSpaceLayoutModelName()` | `/promo-camera` 空間 `layout_plan` |
| **空間攝影・平視（對照 ISO）** | `gemini_model_promo_space_eye_level` | `getPromoSpaceEyeLevelModelName()` | `/promo-camera` 空間 `eye_level` |
| **人像攝影** | `gemini_model_promo_portrait` | `getPromoPortraitModelName()` | `/promo-camera` 人像 tab；引擎 `promo_portrait_engine` |

**商攝・空間解析度（程式，非 DB 鍵）**：前台 `space_resolution_tier: 2k|4k` → 後端 `config.imageConfig.imageSize: "2K"|"4K"`（[官方 image generation](https://ai.google.dev/gemini-api/docs/image-generation)；**K 须大写**）。不足时 sharp 补至 ≥2048／4096。

**商攝・空間點數（`/admin/membership.html` → 點數規則，非本頁）**：

| `payment_config.key` | 預設 | 說明 |
|----------------------|------|------|
| `points_promo_space_layout_gemini` | 30 | ISO 2K 點／張 |
| `points_promo_space_layout_gemini_4k` | 50 | ISO 4K 點／張 |
| `points_promo_space_eye_level_gemini` | 30 | 平視 2K 點／張 |
| `points_promo_space_eye_level_gemini_4k` | 50 | 平視 4K 點／張 |

Seed：`docs/add-promo-space-gemini-config.sql`。空間平視 FLUX 備援：`docs/add-promo-space-eye-level-flux-backup.sql`（`promo_space_eye_level_engine`、`bfl_flux_model_promo_space_eye_level`）。

**環境變數覆寫（可選）**：`GEMINI_MODEL`、`GEMINI_MODEL_READ`、`GEMINI_MODEL_TAGGING`、`GEMINI_MODEL_MATERIAL_OPTIMIZE`、`GEMINI_MODEL_MATERIAL_COMBO_LITE`、`GEMINI_MODEL_MATERIAL_COMBO_FLASH`、`GEMINI_MODEL_PRINT_ASSET`。

**程式內建預設（尚未在後台儲存前）**：

| 鍵 | 預設 model ID |
|----|----------------|
| `gemini_model` | `gemini-2.5-flash-lite` |
| `gemini_model_read` | `gemini-3-flash-preview` |
| `gemini_model_tagging` | `gemini-3.1-flash-lite` |
| `gemini_model_material_optimize` | `gemini-3.1-flash-lite-image` |
| `gemini_model_material_combo_lite` | `gemini-3.1-flash-lite-image` |
| `gemini_model_material_combo_flash` | `gemini-3.1-flash-image` |
| `gemini_model_print_asset` | `gemini-3.1-flash-lite-image` |
| `gemini_model_promo_space_layout` | `gemini-3-pro-image` |
| `gemini_model_promo_space_eye_level` | `gemini-3-pro-image` |
| `gemini_model_promo_portrait` | `gemini-3-pro-image` |
| `promo_portrait_engine` | `gemini`（可 `auto`／`flux`） |

材料組合詳見 `docs/PLAN-material-dual-color-gemini-test.md`。  
點數（與其他 AI 相同）：`/admin/membership.html` →「點數規則」→ `points_material_dual_color_flux`、`points_print_asset_flux`。  
FLUX 並行排隊與 Gemini 生圖軟上限見 `docs/PLAN-flux-bfl-queue-and-vendor-gemini-redraw.md`。

---

## 3. 暫定建議模型（營運目標）

> **狀態**：以下為文件暫定方針；**尚未**改程式預設常數。上線後請在後台按「儲存模型設定」寫入 DB，或於 Cloud Run 設定對應環境變數。

| 槽位 | 暫定 model ID | 理由 |
|------|----------------|------|
| 翻譯 | `gemini-2.5-flash-lite` | 高頻、低延遲、成本低；維持現狀 |
| **讀圖／分析** | **`gemini-3.1-pro-preview`** | 複雜 JSON、多步推理、工具／結構化輸出品質較佳（見 §4） |
| 標籤用讀圖 | `gemini-3.1-flash-lite` | 大量上傳／生圖後標籤；成本與速度優先，維持 lite |

### 3.1 後台操作步驟

1. 以管理員登入 → 開啟 `/admin/ai-settings.html`。
2. **Gemini 讀圖／分析模型** 填入：`gemini-3.1-pro-preview`。
3. 翻譯、標籤欄位維持上表 ID（或確認與現況一致）。
4. 按 **儲存模型設定**；畫面提示應顯示三組模型名稱，且 hint 出現「已從資料庫載入：讀圖分析」等。
5. 冒煙：`POST /api/analyze-custom-product`、首頁 `POST /api/ai-detect`（若啟用）、參考圖 `POST /api/describe-reference-images`；確認無 404／模型不存在錯誤。

### 3.2 使用 `gemini_model_read` 的主要 API（對照）

| API | 說明 |
|-----|------|
| `POST /api/ai-detect` | 首頁服務媒合工項識別（圖＋文字 → JSON） |
| `POST /api/analyze-custom-product` | 訂製產品分析（材質、工藝、難度等 JSON） |
| `POST /api/describe-reference-images` | 參考圖 → 設計用描述文字 |
| 工項同義標籤生成等 | 依 `server.js` 內 `getReadModelName()` 呼叫點 |

**標籤管線**（廠商素材、生圖後分維標籤）一律走 `getTaggingModelName()`，**不受** `gemini-3.1-pro-preview` 影響，除非另改「標籤用讀圖」欄位。

---

## 4. Gemini 3.1 Pro（預先發布版）— 規格摘要

**產品名稱**：Gemini 3.1 Pro（預先發布版）／Gemini 3.1 Pro 預先發布版  

**定位**：在 Gemini 3 Pro 系列上提升效能與穩定性；加強思考能力、權杖效率，以及更貼近事實、一致的體驗。適合軟體工程、需精確工具呼叫、多步驟代理式工作流程。

**官方文件**：[Gemini 3 開發人員指南](https://ai.google.dev/gemini-api/docs/gemini-3)（能力與限制以 Google 最新說明為準）

### 4.1 模型代碼與版本

| 項目 | 值 |
|------|-----|
| **建議後台填入** | `gemini-3.1-pro-preview` |
| **版本模式** | Preview |
| **另可選版本** | `gemini-3.1-pro-preview-customtools`（自訂工具情境；本專案暫不預設） |
| **最新更新** | 2026 年 2 月（Google 模型卡） |
| **知識截點** | 2025 年 1 月 |

### 4.2 輸入／輸出與權杖

| 項目 | 說明 |
|------|------|
| **輸入** | 文字、圖片、影片、音訊、PDF |
| **輸出** | 文字（**不支援**圖像生成） |
| **輸入權杖上限** | 1,048,576 |
| **輸出權杖上限** | 65,536 |

### 4.3 功能支援（模型卡摘要）

| 功能 | 支援 |
|------|------|
| 結構化輸出 | ✅ |
| 思考型（Thinking） | ✅ |
| 函式呼叫 | ✅ |
| 程式碼執行 | ✅ |
| 快取 | ✅ |
| 批次 API | ✅ |
| Flex 推論 | ✅ |
| 優先推論 | ✅ |
| 搜尋基準／URL 內容 | ✅ |
| Google 地圖建立基準 | ✅ |
| 檔案搜尋 | ✅（僅 AI Studio） |
| 語音生成 | ❌ |
| 圖像生成 | ❌ |
| Live API | ❌ |

### 4.4 與本專案槽位對應

| 適合 | 不建議預設用於 |
|------|----------------|
| `gemini_model_read`：複雜 JSON 分析、多圖綜合描述、工項結構化輸出 | `gemini_model_tagging`：高 QPS 標籤（成本高、延遲大） |
| 日後設計風向「意圖分析」、AI 顧問深度報告（若走同一讀圖槽） | `gemini_model`：單純 prompt 翻譯（overkill） |
| | 產品主圖生圖（需圖像模型或 FLUX，非本模型） |

---

## 5. 同頁其他設定（非模型 ID）

| 區塊 | 儲存鍵／API | 說明 |
|------|-------------|------|
| 設計頁・AI 生成圖讀圖 | `generated_image_semantics_prompt` | 生圖後標籤 JSON；走 **標籤模型** + 此 prompt |
| 廠商・數位原型讀圖 | `prototype_tagging_prompt` | 廠商上傳素材標籤 |
| 進階：僅文字提示詞 | `prompt_semantics_prompt` | 提示詞語意解析 |
| 實境模擬／圖樣提取 | 各獨立 admin API | 系統提示詞送 **Flux**，非 Gemini 模型欄 |

種子提示詞（可選）：`docs/seed-semantics-prompts.sql`。

---

## 6. 成本、延遲與回退

| 風險 | 建議 |
|------|------|
| Pro Preview 延遲／單次成本高於 Flash | 僅用於 `gemini_model_read`；標籤維持 `gemini-3.1-flash-lite` |
| 模型 404 或區域未開通 | 後台改回 `gemini-3-flash-preview` 或 `gemini-2.0-flash`；見 `server.js` 註解 |
| Preview 行為變更 | 鎖定 model ID 於 `payment_config`，升級前在 staging 跑一輪 §3.1 冒煙 |

---

## 7. 相關文件

| 文件 | 說明 |
|------|------|
| `docs/matchdo-todo.md` §6 | 視覺語意庫、三管線與模型分工 |
| `docs/首頁AI識別流程.md` | 首頁工項識別與 `gemini_model_read` |
| `docs/custom-products-db-columns.md` | `ai_tags_by_dimension`、血緣欄位 |
| `docs/design-direction-ai-advisor-plan.md` | 日後顧問可能共用讀圖／分析模型 |

---

## 8. 變更紀錄

| 日期 | 說明 |
|------|------|
| 2026-05-26 | 初版：後台三槽說明；暫定 `gemini_model_read` → `gemini-3.1-pro-preview`；附 Gemini 3.1 Pro Preview 模型卡摘要 |
