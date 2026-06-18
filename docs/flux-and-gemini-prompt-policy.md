# FLUX／Gemini 提示詞政策 — 嚴禁查表式硬編碼

**更新**：2026-06-05  
**狀態**：**強制**（所有新功能、修 bug、AI 相關 PR 必守）  
**相關**：`lib/visual-semantics.js`、`server.js`（`composeGeneratePromptWithReferences`、`buildVendorAssetMaterialOptimizePrompt`）、`docs/vendor-asset-material-swatch-plan.md`、`docs/custom-product-subcategory-prompt-guide.md`

---

## 1. 一句話

**材質／紋理／色彩特徵只能來自：原圖 + Gemini 讀圖，或後台 DB／Admin 可編輯的提示詞。**  
**禁止**在程式裡用 `material_key`、檔名、標題 regex、枚舉查表去「發明」要送給 FLUX 的表面形容。

查表式硬編碼提示詞 = **垃圾**；曾因此毀掉設計頁生圖與材料優化，**不得再犯**。

---

## 2. 正確管線（唯一允許的動態內容來源）

### 2.1 材料 — 兩條 Gemini 管線（不可混用）

**A. 材料 AI 優化（廠商素材庫重繪）— 對齊 BFL 單圖編輯**

依 [BFL Single-Reference Editing](https://docs.bfl.ml/guides/prompting_editing_single_reference.md)：prompt 須**明確寫要改什麼、什麼必須不變**；`input_image` + prompt 送 `POST /v1/flux-2-pro`。

```
原圖（input_image）
  + 標題／檔名／分類（僅 Gemini 補充）
        ↓
  Gemini — material_flux_edit_prompt → 僅英文編輯句（2～4 句，非 JSON、非生圖）
        ↓
  buildVendorAssetMaterialOptimizePrompt() — BFL 單圖編輯外殼 + 上列英文句
        ↓
  FLUX.2 [pro] input_image 編輯
```

| 步驟 | 檔案／函式 |
|------|------------|
| Gemini 產編輯句 | `analyzeMaterialFluxEditPrompt`（`material_flux_edit_prompt`） |
| 取編輯句 | `resolveMaterialFluxEditPrompt` |
| 組 FLUX prompt | `buildVendorAssetMaterialOptimizePrompt` |
| 原型／零件對照 | `buildVendorAssetProductOptimizePrompt`（固定英文，不經 Gemini） |

**B. 材料標籤／設計頁附錄（搜尋、篩選、生圖參考說明）**

```
原圖 → Gemini material_tagging_prompt → image_semantics_json
設計頁：buildMaterialTexturePromptAppendix（讀 DB JSON）
```

**`material_tagging_prompt` 的 JSON 不送材料 FLUX optimize**（避免 FLUX 把標籤當「生成規格」）。

**沒有 Gemini 編輯句就不送材料 FLUX**（503）。

### 2.2 訂製設計頁生圖 `POST /api/generate-product-image`

| 段落 | 允許來源 | 禁止 |
|------|----------|------|
| 產品類型基礎句 | DB `custom_product_categories` / `subcategories`.`prompt` | 程式內寫死品類英文長文 |
| 設計風向 | DB `remake_categories` / `subcategories`.`prompt` | 同上 |
| 使用者描述 | 前端 `composeUserPromptForGenerate()` | — |
| 參考圖角色 | `buildFluxReferenceImageRoleMapAppendix`（依 `asset_kind` **角色**，非材質種類） | 依檔名猜 leather/wood |
| 原型製造限制 | DB `customization_levels`、`min_order_quantity` + 使用者已勾選能力 | 猜測未勾選項 |
| 表面工藝 | DB `manufacturer_taxonomy` → `visual_hint` | 固定工藝英文表 |
| **材料表面** | **`image_semantics_json`（Gemini）** | **檔名／material_key 查表** |

組裝入口：`composeGeneratePromptWithReferences`（`server.js`）。

### 2.3 數位原型「產品重繪」（非材料）

- `buildVendorAssetProductOptimizePrompt`：產品棚拍清理（保留本體、換背景）。
- 與材料管線**分線**；材料 optimize **不得**呼叫 `normalizeVendorOptimizeBackground`。

### 2.4 其他獨立功能（可有自己的系統提示詞）

| 功能 | 預設位置 | 須可後台改 |
|------|----------|------------|
| 圖樣提取 | `DEFAULT_PATTERN_EXTRACT_*` | `payment_config` |
| 實境模擬 | `DEFAULT_SCENE_SIM_SYSTEM_PROMPT` | `payment_config` |
| Gemini 讀圖 | `DEFAULT_PROMPTS.material_tagging_prompt` 等 | `payment_config` |

預設句可存在程式，但須 **Admin／payment_config 可覆寫**；且不得用 regex 從檔名覆寫材質內容。

---

## 3. 嚴禁清單（查表式硬編碼 — 禁止再出現）

以下模式 **一律禁止** 用於組裝送給 FLUX／Gemini 的**材質／紋理／表面**提示：

| 禁止模式 | 說明 | 已刪除範例（勿復活） |
|----------|------|----------------------|
| 檔名／標題 regex → 材質句 | `if (/leather/.test(filename))` 再 append FLUX | `inferMaterialKeyFromHints`、`inferOptionalMaterialContextHints` |
| `material_key` → 固定英文尺度句 | `wood`→「grain density…」查表 | `materialTextureScaleRuleForKey` |
| 紋理族 regex 後處理 | 程式判斷荔枝紋 vs 細粒面再刪詞 | `MATERIAL_PATTERN_FAMILY_RULES`、`collapseConflictingMaterialPatterns` |
| 從標題推斷送 FLUX 的紋理 | 標題只准進 **Gemini 補充** | `materialOptimizeTextureDirective` |
| 擅自改 FLUX 輸出比例 | 未經產品／後台設定 | `fluxOutputSizeFromImageBuffer` 跟原圖 aspect |

**矛盾或錯誤形容** → 改 **`material_tagging_prompt`**（Gemini 自洽規則＋**忠實記錄、禁止發揮**），**不是**在後端加第二套規則表。

---

## 4. 允許的「固定句」與「查表」邊界

### 4.1 允許：與材質無關的固定英文

- FLUX **通用** img2img 底稿（例如：enhance input_image、only clarity/lighting/noise）。
- **材料 optimize 底稿**：須明訂 `input_image` 像素為唯一權威、禁止替換紋理族／色相等（`buildVendorAssetMaterialOptimizePrompt`）；此為保真規則，**不是** material_key 查表。
- 參考圖 **角色** 說明（原型＝造型、材料＝表面、配件＝五金）— 不列舉具體皮種／布種。
- 產品重繪的棚拍／去背規則（原型專用）。

### 4.2 允許：DB／使用者資料驅動（非程式猜測）

- 分類 `prompt` 欄位（後台維護）。
- 使用者勾選的 `customization_levels`、工藝 `visual_hint`。
- `image_semantics_json` 全文轉寫。

### 4.3 允許：篩選／UI 用枚舉（**不進 FLUX prompt**）

- `material_key`、`color_key` 用於**列表篩選、標籤顯示**（`vendorMaterialKeyLabel` 等）。
- `deriveColorKeyFromSemantics` 僅寫入篩選欄位，**不** append 生圖 prompt。
- `inferProductCategory` 僅用於廠商媒合，**不**用於生圖。

### 4.4 允許：Gemini 標籤清理（非發明材質）

- `sanitizeMaterialSemantics`：去掉球體／3D 展示載體等**非表面**標籤。
- **不得**改寫 `patterns`／`materials` 語意為另一種材質。

---

## 5. 輸出尺寸與比例

- 廠商材料 FLUX optimize、設計頁 `generateImageWithFlux2Pro`：**1024×1024**（與前端 `aspectRatio: '1:1'` 一致）。
- **禁止**工程師擅自依原圖 aspect 改 BFL `width`/`height`，除非產品規格或 `payment_config` 明訂。

---

## 6. 缺口與待補（非硬編碼解法）

| 缺口 | 正確做法 | 禁止做法 |
|------|----------|----------|
| 舊素材無 `image_semantics_json` | 上傳／生圖前跑 Gemini；或批次補標 | 檔名猜皮革 |
| 設計頁本機上傳材料圖 | 即時 Gemini 讀圖再組附錄 | 固定「布料」句 |
| 尺度／微距 | 使用者描述 + 日後 DB 欄位（如 `texture_scale_hint`）由**人填** | regex 從檔名判 macro |

---

## 7. Code review 勾選（改 `server.js` / `visual-semantics.js` / 生圖相關時）

- [ ] 新增提示詞內容是否來自 **DB 或 Gemini JSON**？
- [ ] 是否出現 **regex 從檔名／title 推材質** 再送 FLUX？
- [ ] 是否出現 **`material_key` / 枚舉 map → 英文表面句**？
- [ ] 材料 FLUX 是否在 **無 `image_semantics_json`** 時仍靜默執行？
- [ ] 是否擅自改 **1024×1024** 或其它未文件化輸出尺寸？
- [ ] 矛盾形容是否在 **Gemini prompt** 用自洽規則處理，而非後端第二套分類？

---

## 8. 程式錨點（現行，2026-06-05）

| 項目 | 位置 |
|------|------|
| 政策本檔 | `docs/flux-and-gemini-prompt-policy.md` |
| Gemini 材料讀圖 | `lib/visual-semantics.js` — `material_tagging_prompt`、`analyzeImageSemantics` |
| JSON → FLUX 句 | `buildMaterialFluxFidelityLine` |
| 材料 optimize | `buildVendorAssetMaterialOptimizePrompt`、`resolveMaterialFluxEditPrompt` |
| 材料標籤 JSON | `material_tagging_prompt`、`analyzeImageSemantics` |
| 設計頁組 prompt | `composeGeneratePromptWithReferences`、`buildMaterialTexturePromptAppendix` |
| 分類 prompt 指南 | `docs/custom-product-subcategory-prompt-guide.md` |
| 材料色卡產品規格 | `docs/vendor-asset-material-swatch-plan.md`（已對齊本政策） |

---

## 9. 修訂紀錄

| 日期 | 說明 |
|------|------|
| 2026-06-05 | 初版：禁止查表式硬編碼；記錄正確 Gemini→FLUX 管線；標記已刪函式 |
