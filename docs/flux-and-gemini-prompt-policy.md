# FLUX／Gemini 提示詞政策 — 嚴禁查表式硬編碼

**更新**：2026-07-10  
**狀態**：**強制**（所有新功能、修 bug、AI 相關 PR 必守）  
**相關**：`lib/visual-semantics.js`、`server.js`（`composeGeneratePromptWithReferences`、`buildVendorAssetMaterialFluxOptimizePrompt`、`buildVendorAssetProductOptimizePrompt`）、`docs/vendor-asset-material-swatch-plan.md`、`docs/custom-product-subcategory-prompt-guide.md`、`.cursor/rules/material-flux-prompt-lock.mdc`

---

## 1. 一句話

**材質／紋理／色彩特徵只能來自：原圖 + Gemini 讀圖，或後台 DB／Admin 可編輯的提示詞。**  
**禁止**在程式裡用 `material_key`、檔名、標題 regex、枚舉查表去「發明」要送給 FLUX 的表面形容。

查表式硬編碼提示詞 = **垃圾**；曾因此毀掉設計頁生圖與材料優化，**不得再犯**。

---

## 2. 正確管線（唯一允許的動態內容來源）

### 2.1 材料 — 兩條管線（不可混用）

**A. 材料 AI 重繪（廠商素材庫 `asset_kind = material`）— Gemini 優先 → FLUX 備援**

```
原圖 → prepareVendorMaterialFluxImage（最長邊>1024 時縮小，不放大）
        ↓
  buildVendorAssetMaterialFluxOptimizePrompt(material_surface_type)  // 可空
        ↓
  optimizeVendorAssetImage → Gemini Lite（1024×1024）→ 滿額／429 則 FLUX
        ↓
  bfl_flux_model_vendor_material · 1024×1024 · seed 3647440197
```

| 步驟 | 檔案／函式 |
|------|------------|
| 解析度準備 | `lib/resize-upload-image.js` → `prepareVendorMaterialFluxImage` |
| 組 prompt | `buildVendorAssetMaterialFluxOptimizePrompt`（**英文 swatch**；`skipPromptTranslation: true`） |
| 生圖 | `optimizeVendorAssetImage` / `optimizeVendorAssetImageWithFlux` |
| 鎖定規則 | `.cursor/rules/material-flux-prompt-lock.mdc` |

**現行 prompt（2026-08-08）：** 滿版材質色卡 1024×1024；**維持圖中該材質原色與質感**（含反光、透明）；去除產品外型；不含文字、Logo、印花。`material_surface_type` **建議填寫**（填了較精準；不強制，怕填錯可留空由 AI 從圖判斷）。

**禁止**把 `material_tagging_prompt` 的 **JSON 標籤**送進材料 optimize prompt。  
**legacy 勿當現行**：`resolveMaterialFluxEditPrompt`／`buildVendorAssetMaterialOptimizePrompt`（英文 BFL 編輯句外殼）。

**B. 材料標籤／設計頁附錄（Gemini 文字讀圖）**

```
原圖 → Gemini material_tagging_prompt → image_semantics_json
設計頁：buildMaterialTexturePromptAppendix（讀 DB JSON）
```

**`material_tagging_prompt` 的 JSON 不送材料 FLUX optimize**（與 A 分線；上傳時可並行跑標籤與重繪）。

### 2.2 訂製設計頁生圖 `POST /api/generate-product-image`

| 段落 | 允許來源 | 禁止 |
|------|----------|------|
| 產品類型基礎句 | DB `custom_product_categories` / `subcategories`.`prompt` | 程式內寫死品類英文長文 |
| 設計風向 | DB `remake_categories` / `subcategories`.`prompt` | 同上 |
| 使用者描述 | 前端 `composeUserPromptForGenerate()` | — |
| 參考圖角色 | `buildFluxReferenceFactsAppendix`（依 `asset_kind` + `pattern_intent` **角色**，非材質種類） | 依檔名猜 leather/wood；**Logo 專用 lockup 長文** |
| 原圖印刷／風格 | **`docs/custom-product-reference-pattern-prompt-policy.md`**（通用 surface graphic） | 窄化為 Logo／wordmark 專用 block |
| 原型製造限制 | DB `customization_levels`、`min_order_quantity` + 使用者已勾選能力 | 猜測未勾選項 |
| 表面工藝 | DB `manufacturer_taxonomy` → `visual_hint` | 固定工藝英文表 |
| **材料表面** | **`image_semantics_json`（Gemini）** | **檔名／material_key 查表** |

組裝入口：`composeGeneratePromptWithReferences`（`server.js`）。

### 2.3 數位原型「產品重繪」（非材料）

- `buildVendorAssetProductOptimizePrompt`：產品棚拍（保本體、換背景）；**獨立 segment**（2026-07-10）：
  - 保色／去雜物（固定）
  - `vendorOptimizeBackgroundSegment` — 使用者選底色 + backdrop 清潔度（**不寫**地面接觸陰影）
  - `VENDOR_OPTIMIZE_PRODUCT_STUDIO_LIGHTING_LINE` — 自然棚拍光影（不鎖地面）
  - `vendorOptimizeDisplayStandSegment` — 勾選 `use_display_stand` 時一句
  - `optimize_product_name`／標題 — 僅輔助識別（`translateOptimizeProductNameForFlux` 只翻譯名稱）
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
- **材料 optimize**：`buildVendorAssetMaterialFluxOptimizePrompt`（中文兩句；鎖定見 `.cursor/rules/material-flux-prompt-lock.mdc`）；**不是** `material_key` 查表。
- 參考圖 **角色** 說明（原型＝造型、材料＝表面、配件＝五金、**原圖印刷＝surface graphic 原樣套印**、**風格參考＝inspired only**）— 不列舉具體皮種／布種；**不得**寫成 Logo-only。
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
- [ ] 原圖印刷是否用 **通用 surface graphic** 句，而非 Logo lockup 專用文？（見 `docs/custom-product-reference-pattern-prompt-policy.md`）
- [ ] 是否出現 **regex 從檔名／title 推材質** 再送 FLUX？
- [ ] 是否出現 **`material_key` / 枚舉 map → 英文表面句**？
- [ ] 材料 **設計頁生圖** 是否在 **無 `image_semantics_json`** 時仍靜默 append 材質附錄？（optimize 路徑不要求 JSON）
- [ ] 是否擅自改 **1024×1024** 或其它未文件化輸出尺寸？
- [ ] 矛盾形容是否在 **Gemini prompt** 用自洽規則處理，而非後端第二套分類？
- [ ] 是否在 `server.js` 追加 **Split-view 1～4／四格視角劇本**（含「四格不得相同角度」等）？→ **禁止**，見 `docs/custom-product-subcategory-prompt-guide.md` §7

---

## 8. 程式錨點（現行，2026-07-10）

| 項目 | 位置 |
|------|------|
| 政策本檔 | `docs/flux-and-gemini-prompt-policy.md` |
| 材料 FLUX prompt 鎖 | `.cursor/rules/material-flux-prompt-lock.mdc` |
| Gemini 材料讀圖 | `lib/visual-semantics.js` — `material_tagging_prompt`、`analyzeImageSemantics` |
| 設計頁 JSON → FLUX 句 | `buildMaterialFluxFidelityLine` |
| **材料 optimize（現行）** | `buildVendorAssetMaterialFluxOptimizePrompt`、`optimizeVendorAssetImageWithFlux` |
| 材料標籤 JSON | `material_tagging_prompt`、`analyzeImageSemantics` |
| 產品重繪 | `buildVendorAssetProductOptimizePrompt` |
| 設計頁組 prompt | `composeGeneratePromptWithReferences`、`buildFluxReferenceFactsAppendix` |
| **原圖印刷／風格 Tab 政策** | **`docs/custom-product-reference-pattern-prompt-policy.md`** |
| 分類 prompt 指南 | `docs/custom-product-subcategory-prompt-guide.md` |
| 材料色卡產品規格 | `docs/vendor-asset-material-swatch-plan.md` |
| **未接上線（勿當現行）** | `resolveMaterialFluxEditPrompt`、`buildVendorAssetMaterialOptimizePrompt`、`optimizeVendorAssetMaterialWithGemini` |

---

## 9. 修訂紀錄

| 日期 | 說明 |
|------|------|
| 2026-07-10 | §2.1 改回 **FLUX** 材料 optimize；產品重繪 segment 拆分；錨點表對齊 `buildVendorAssetMaterialFluxOptimizePrompt` |
| 2026-06-18 | 連結 `custom-product-reference-pattern-prompt-policy.md`；原圖印刷通用性 |
| 2026-06-05 | 初版：禁止查表式硬編碼；記錄正確 Gemini→FLUX 管線；標記已刪函式 |
