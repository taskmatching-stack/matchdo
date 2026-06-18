# 進度紀錄：材料 FLUX 保真 ＋ 後台 AI／FLUX 模型設定

> **新對話請先讀本檔**（材料 AI 優化、FLUX 模型後台、Gemini 標籤分工）。  
> 複製貼上：「請讀 `docs/PROGRESS-material-flux-ai-settings.md` 接續。」

**最後更新：** 2026-06-18  
**頁面：** [`/client/manufacturer-materials.html`](../public/client/manufacturer-materials.html)（僅 `public/client/`）  
**後台：** [`/admin/ai-settings.html`](../public/admin/ai-settings.html)

**一句話：** 材料 = **gemini-2.5-flash-image** img2img（固定中文 prompt）；**不提供上傳 AI 放大**；後台手填 `gemini_model_material_optimize`。

---

## 〇、新對話快速索引

| 要看什麼 | 章節 |
|----------|------|
| 已完成什麼 | §一 |
| **尚未解決（主問題）** | **§二** |
| 本機未 push 變更 | §三 |
| 現行管線圖 | §四 |
| 必守政策／禁止事項 | §五 |
| 關鍵檔案與函式 | §六 |
| 部署與驗收 | §七 |
| 相關 commit | §八 |

**並讀：** `docs/flux-and-gemini-prompt-policy.md`、`.cursor/rules/flux-gemini-prompt-policy.mdc`、`docs/admin-ai-settings-models.md`  
**素材頁 UI／多角度（非材料單圖）：** `docs/PROGRESS-vendor-asset-gallery-edit.md`  
**全站交接入口：** `docs/session-handoff-2026-06-03.md`

---

## 一、已完成

### 1.1 政策與架構文件

| 項目 | 說明 |
|------|------|
| `docs/flux-and-gemini-prompt-policy.md` | 禁止檔名／`material_key` 查表送 FLUX；材料標籤 JSON 不進 optimize prompt |
| `.cursor/rules/flux-gemini-prompt-policy.mdc` | Cursor 強制規則 |

### 1.2 材料 FLUX optimize 管線（`server.js`）

| 步驟 | 實作 |
|------|------|
| 解析度 | `prepareVendorMaterialFluxImage`（`lib/resize-upload-image.js`）— 最短邊 ≥256、最長邊 ≤1024、等比 |
| Prompt | `buildVendorAssetMaterialGeminiOptimizePrompt(w,h)` — 中文「維持材質質感與顏色…」 |
| 生圖模型 | **`gemini-2.5-flash-image`**（`optimizeVendorAssetMaterialWithGemini`） |
| 輸出尺寸 | 與準備後原圖同寬高（非強制 1024²） |
| 產品重繪 | `buildVendorAssetProductOptimizePrompt` — **使用者確認效果尚可，勿改** |

### 1.3 Gemini 材料標籤（與 FLUX optimize 分線）

- `material_tagging_prompt` → `image_semantics_json`、設計頁 `buildMaterialTexturePromptAppendix`
- `material_flux_edit_prompt` → `resolveMaterialFluxEditPrompt` → **材料 optimize 使用**（讀準備後原圖，產 BFL 單圖編輯句）

### 1.4 後台 FLUX 模型設定（本機已改，**待 commit／push**）

| 項目 | 狀態 |
|------|------|
| `GET`／`PATCH` `/api/admin/ai-config` | 含四個 `bfl_flux_model_*` 鍵 |
| `BFL_FLUX_MODEL_CONFIG` | 四槽程式預設皆 **`flux-2-pro`**（非 max） |
| 手填驗證 | `isPlausibleBflFluxModelId`（`flux-2-*`）；未知 id → `POST /v1/{id}` |
| `public/admin/ai-settings.html` | 四個 FLUX 欄位改 **文字 input**（與 Gemini 相同），移除下拉選單 |
| `docs/admin-ai-settings-models.md` | 材料預設改 pro；註明手填新型號 |

**使用者要求（已落實）：** 模型跟 Gemini 一樣用填的；下拉無法應對日後新型號；**不要把四槽預設全改成 max**（成本高）。

### 1.5 已 push 的相關 commit（`main` 上較早部分）

| Commit | 內容 |
|--------|------|
| `90b0711` | FLUX／Gemini 政策文件 |
| `2d5f403` | 恢復材料強保真 img2img 底稿 |
| `33ca4d1` | Gemini `material_flux_edit_prompt`（後來 optimize 不再用此路） |
| `45b7927` | min 256、固定保真句、曾硬編碼 max |
| `46897d0` | 後台四槽 FLUX（當時 UI 為**下拉**） |

---

## 二、尚未解決（主問題 — 新對話優先）

### P0 — 材料 AI 優化輸出仍不像「同一材質」

**現象（使用者測試）：** 即使 prompt 寫明 preserve grain／do not retexture，FLUX 輸出仍像**不同材質**（例：荔枝紋皮革 → 細顆砂岩／噪點感），非「原圖清晰度提升」。

**2026-06-18 本對話改動（待實測）：**

- 恢復 `material_flux_edit_prompt` 管線：Gemini 讀**準備後**原圖（與 FLUX 同一像素）產英文編輯句
- `buildVendorAssetMaterialOptimizePrompt(editPrompt)` 改回 BFL 單圖編輯外殼（非固定長文、非 JSON 標籤）
- seed 改以準備後 buffer 計算（同輸入尺寸較一致）

**已試過仍不滿意（先前）：**

- 去掉 Gemini 材質名進 FLUX prompt（固定英文句）
- `prepareVendorMaterialFluxImage` min 256、同比例輸出
- 曾試 `flux-2-max`（使用者反對全站預設 max；可**僅材料槽**手動改 max 再測）

**若仍不過，待探索：**

1. **單槽手動 max**：後台只把 `bfl_flux_model_vendor_material` 改 `flux-2-max`
2. **BFL flex 參數**：`guidance`／`steps`（僅 flex 模型 API 暴露）
3. **原圖品質**：極小圖放大到 256 是否引入偽紋理

**明確勿做（除非使用者改口）：**

- 檔名 regex、`material_key` 查表送 FLUX
- 把 JSON 標籤當材料 optimize 主 prompt
- 改 `buildVendorAssetProductOptimizePrompt`（產品重繪）
- 四槽預設全改 `flux-2-max`

### P1 — 本機變更尚未 commit／push／部署

見 §三。含材料 Gemini 編輯句恢復 + 後台 FLUX 手填模型。

### P2 — ~~政策文件小落差~~（2026-06-18 已更新 `docs/flux-and-gemini-prompt-policy.md` §2.1）

### P3 — DB 若已存舊值

若先前在後台存過 `bfl_flux_model_vendor_material=flux-2-max`，載入後台會顯示 max；要改回 pro 須**手動改欄位**再「儲存 FLUX 模型」。

---

## 三、本機未 commit 變更（2026-06-18）

```
 M docs/admin-ai-settings-models.md
 M docs/flux-and-gemini-prompt-policy.md
 M docs/PROGRESS-material-flux-ai-settings.md
 M public/admin/ai-settings.html
 M server.js
```

| 檔案 | 摘要 |
|------|------|
| `server.js` | 恢復 `resolveMaterialFluxEditPrompt`；Gemini 讀準備後原圖；四槽預設 pro + 手填驗證 |
| `public/admin/ai-settings.html` | FLUX 下拉 → 文字 input；儲存 fallback 全 pro |
| `docs/admin-ai-settings-models.md` | 預設與手填說明 |
| `docs/flux-and-gemini-prompt-policy.md` | §2.1 對齊 Gemini 編輯句管線 |

**下一步：** 使用者若要上線 → `git commit` + `git push` → Cloud Shell 部署。

---

## 四、現行管線圖

### 材料 AI 優化（`asset_kind = material`）

```
原圖
  → prepareVendorMaterialFluxImage（min 256, max 長邊 1024, 等比）
  → buildVendorAssetMaterialGeminiOptimizePrompt(w, h)
  → gemini-2.5-flash-image（inlineData 參考圖 + responseModalities IMAGE）
  → 輸出 JPEG（同準備後寬高）
```

### 材料標籤（上傳時／設計頁，不進 optimize）

```
原圖 → Gemini material_tagging_prompt → image_semantics_json
設計頁生圖 → buildMaterialTexturePromptAppendix（讀 DB JSON）
```

### 產品 AI 重繪（prototype／part — 勿與材料混）

```
原圖 → buildVendorAssetProductOptimizePrompt(title, backgroundColor)
     → bfl_flux_model_vendor_product（預設 flux-2-pro）
```

---

## 五、必守政策（摘要）

完整見 `docs/flux-and-gemini-prompt-policy.md`。

1. 材質特徵只能來自：**原圖** + **Gemini 讀圖（標籤／附錄）** 或 **後台可編輯 prompt** — 禁止程式查表發明表面形容。
2. **材料 FLUX optimize**：Gemini 編輯句（讀圖）+ BFL 外殼；**不**把 `material_tagging_prompt` JSON 送進 FLUX。
3. **產品重繪**：`buildVendorAssetProductOptimizePrompt` 維持現狀。
4. 廠商材料頁只改 `public/client/manufacturer-materials.html`。

---

## 六、關鍵檔案與函式

| 檔案 | 用途 |
|------|------|
| `server.js` | `resolveMaterialFluxEditPrompt`、`buildVendorAssetMaterialOptimizePrompt`、`optimizeVendorAssetImageWithFlux`、`BFL_FLUX_MODEL_CONFIG`、`/api/admin/ai-config` |
| `lib/resize-upload-image.js` | `prepareVendorMaterialFluxImage` |
| `lib/visual-semantics.js` | `material_tagging_prompt`、`analyzeMaterialFluxEditPrompt` |
| `public/admin/ai-settings.html` | Gemini 三槽 + FLUX 四槽（皆文字 input） |
| `public/client/manufacturer-materials.html` | 材料上傳／AI 優化 UI |
| `docs/admin-ai-settings-models.md` | 後台模型鍵對照表 |

### `payment_config` FLUX 鍵

| 鍵 | 用途 | 程式預設 |
|----|------|----------|
| `bfl_flux_model_generate` | 設計頁生圖 | `flux-2-pro` |
| `bfl_flux_model_vendor_product` | 原型／零件重繪 | `flux-2-pro` |
| `bfl_flux_model_vendor_material` | 材料 AI 優化 | `flux-2-pro` |
| `bfl_flux_model_scene_pattern` | 實境／圖樣 | `flux-2-pro` |

### 材料 prompt（現行）

```javascript
// server.js — buildVendorAssetMaterialOptimizePrompt(materialFluxEditPrompt)
// materialFluxEditPrompt 來自 Gemini material_flux_edit_prompt（讀準備後原圖）
'Single-reference edit of input_image.'
+ editPrompt  // 例：Keep the warm tan pebbled leather at same grain scale and colors. Only improve sharpness...
+ 'Keep everything not mentioned above exactly unchanged.'
+ 'Do not generate a new texture or substitute a different material swatch.'
```

---

## 七、部署與驗收

### 部署（唯一正確 — Google Cloud Shell）

```bash
cd ~/matchdo && git fetch origin main && git reset --hard origin/main && gcloud run deploy matchdo --source . --region=asia-northeast1 --allow-unauthenticated --clear-base-image
```

### 驗收清單

| # | 操作 | 通過條件 |
|---|------|----------|
| 1 | `/admin/ai-settings.html` | FLUX 四欄為**文字輸入**；placeholder `flux-2-pro` |
| 2 | 儲存 FLUX 模型 | PATCH 成功；可填 `flux-2-pro-preview` 等新型號 |
| 3 | 材料上傳 → AI 優化 | 有出圖；Console／API 無 500 |
| 4 | **保真（主問題）** | 輸出材質／紋理與原圖一致 — **目前仍未通過** |
| 5 | 產品重繪 | 行為與部署前一致（未改 product prompt） |

---

## 八、變更紀錄

| 日期 | 說明 |
|------|------|
| 2026-06-18 | 材料 optimize 改 **gemini-2.5-flash-image**（使用者實測保真較穩）；FLUX 材料路徑停用 |
| 2026-06-18 | 恢復 Gemini material_flux_edit_prompt 管線（後續又改 Gemini 生圖） |
| 2026-06-05 | 初版：材料 FLUX 管線、後台手填模型、未解決保真問題、本機未 push 清單 |
| 2026-06-05 | 使用者要求：下拉改手填；預設勿全 max |

---

（若再改材料 FLUX 或後台模型 UI，請同 PR 更新本檔 §二、§三、§八。）
