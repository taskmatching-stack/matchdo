# 進度紀錄：材料 FLUX 保真 ＋ 後台 AI／FLUX 模型設定

> **新對話請先讀本檔**（材料 AI 優化、FLUX 模型後台、Gemini 標籤分工）。  
> 複製貼上：「請讀 `docs/PROGRESS-material-flux-ai-settings.md` 接續。」

**最後更新：** 2026-07-10  
**頁面：** [`/client/manufacturer-materials.html`](../public/client/manufacturer-materials.html)（僅 `public/client/`）  
**後台：** [`/admin/ai-settings.html`](../public/admin/ai-settings.html)

**一句話：** 材料 AI 優化 = **BFL FLUX** img2img（中文兩句 prompt、`material_surface_type` 必填）；Gemini 只跑 **標籤**（`material_tagging_prompt`）；**不提供上傳 AI 放大**。

---

## 〇、新對話快速索引

| 要看什麼 | 章節 |
|----------|------|
| 已完成什麼 | §一 |
| 維護注意／勿改壞 | §二 |
| 現行管線圖 | §三 |
| 必守政策／禁止事項 | §四 |
| 關鍵檔案與函式 | §五 |
| 部署與驗收 | §六 |
| 相關 commit | §七 |

**並讀：** `docs/flux-and-gemini-prompt-policy.md`、`.cursor/rules/material-flux-prompt-lock.mdc`、`.cursor/rules/flux-gemini-prompt-policy.mdc`、`docs/admin-ai-settings-models.md`  
**素材頁 UI／多角度（非材料單圖）：** `docs/PROGRESS-vendor-asset-gallery-edit.md`  
**全站交接入口：** `docs/session-handoff-2026-06-03.md`

---

## 一、已完成

### 1.1 政策與架構文件

| 項目 | 說明 |
|------|------|
| `docs/flux-and-gemini-prompt-policy.md` | 禁止檔名／`material_key` 查表送 FLUX；§2.1 對齊 **FLUX** 材料 optimize（2026-07-10） |
| `.cursor/rules/material-flux-prompt-lock.mdc` | 材料 FLUX 中文 prompt **鎖定**（含產品圖第二句） |
| `.cursor/rules/flux-gemini-prompt-policy.mdc` | Cursor 強制規則 |

### 1.2 材料 FLUX optimize 管線（`server.js` — **現行**）

| 步驟 | 實作 |
|------|------|
| 解析度 | `prepareVendorMaterialFluxImage` — 最長邊 ≤1024、等比；AVIF 先轉 JPEG |
| Prompt | `buildVendorAssetMaterialFluxOptimizePrompt(materialSurfaceType)` — **中文兩句**（見下） |
| 生圖 | `optimizeVendorAssetImageWithFlux` 材料分支 → `bfl_flux_model_vendor_material`（預設 `flux-2-pro`） |
| 輸出 | **1024×1024**；`skipPromptTranslation: true` |
| Seed | `VENDOR_MATERIAL_FLUX_SEED` = `3647440197`（固定） |

**現行 prompt（鎖定，勿擅自改語意）：**

```text
保持顏色並優化此{材質}材質光影。若參考圖含產品、服裝或物件外型，去除版型、縫線、標籤與背景，整張滿版呈現此{材質}材質色卡質感。
```

| 參考圖類型 | 預期行為（**健康功能，勿當 bug 修掉**） |
|------------|----------------------------------------|
| 純色／滿版材質 | 依「AI 重繪材質類型」生成該材質滿版質感 |
| 產品／服裝／物件照 | 第二句：去版型，整張滿版材質色卡（2026-07-10 驗收通過） |

### 1.3 Gemini 材料標籤（與 FLUX optimize **分線**）

- `material_tagging_prompt` → `image_semantics_json`、設計頁 `buildMaterialTexturePromptAppendix`
- **`material_flux_edit_prompt` / `resolveMaterialFluxEditPrompt`**：程式仍存在，**未接上**材料 optimize 現行路徑
- **`optimizeVendorAssetMaterialWithGemini`**：死碼，**勿當現行**

### 1.4 產品 AI 重繪（prototype／part — 與材料分線）

`buildVendorAssetProductOptimizePrompt`（2026-07-10）：底色、棚拍光影、人台各 **獨立 segment**；不寫地面接觸陰影。見 `docs/flux-and-gemini-prompt-policy.md` §2.3。

### 1.5 後台 FLUX 模型設定

| 項目 | 狀態 |
|------|------|
| `GET`／`PATCH` `/api/admin/ai-config` | 含四個 `bfl_flux_model_*` 鍵 |
| `BFL_FLUX_MODEL_CONFIG` | 四槽程式預設 **`flux-2-pro`** |
| `public/admin/ai-settings.html` | 四個 FLUX 欄位為 **文字 input**（手填新型號） |
| `docs/admin-ai-settings-models.md` | 鍵對照與手填說明 |

### 1.6 編輯區圖庫操作後 metadata 保留

見 `docs/PROGRESS-vendor-asset-gallery-edit.md` §九（`57d5d11`）：重繪／放大／上傳／刪圖後 **訂製程度、MOQ、分類、目錄** 等不再被 UI 清空。

### 1.7 相關 commit（`main`）

| Commit | 內容 |
|--------|------|
| `b803ad9` | 材料 FLUX：產品圖第二句（滿版色卡）；build `material-product-swatch-hint-20260710g` |
| `ae9d923` | 產品重繪：底色／光影／人台 segment 拆分 |
| `57d5d11` | 圖庫 API 全欄位 + 編輯窗 `afterEditGalleryMutation` |
| `df11f8c` | AVIF 原圖轉 JPEG 再上傳 |
| `90b0711` | FLUX／Gemini 政策文件 |
| `46897d0` | 後台四槽 FLUX |

---

## 二、維護注意（勿改壞）

### 材料 FLUX

- **勿**把純色→依材質類型生質感當 bug 修掉（使用者明確確認為預期）。
- **勿**未經同意改 `material-flux-prompt-lock.mdc` 中文句、SEED、1024²。
- **勿**把 `material_tagging_prompt` JSON 或 `material_flux_edit_prompt` 英文句接回 optimize 主路徑（除非使用者明確要求重做管線）。
- **勿**檔名 regex、`material_key` 查表送 FLUX。

### 產品重繪

- **勿**擅自加角度鎖定、負面人台句、把底色規則併入人台句。
- 改 `buildVendorAssetProductOptimizePrompt` 前須對照使用者驗收紀錄（`ae9d923`）。

### UI

- `AI 重繪材質類型 *` 維持必填；文案註明原圖也會給 Gemini 標籤用。
- 廠商材料頁只改 `public/client/manufacturer-materials.html`；Bootstrap **5.0.0** — 單一 Modal 實例。

### DB 舊值

若後台曾存 `bfl_flux_model_vendor_material=flux-2-max`，須手動改回 `flux-2-pro` 再儲存。

---

## 三、現行管線圖

### 材料 AI 優化（`asset_kind = material`）

```
原圖
  → prepareVendorMaterialFluxImage
  → buildVendorAssetMaterialFluxOptimizePrompt(material_surface_type)
  → bfl_flux_model_vendor_material · 1024×1024 · seed 3647440197
  → optimizeVendorAssetImageWithFlux
```

### 材料標籤（上傳時／設計頁，不進 optimize）

```
原圖 → Gemini material_tagging_prompt → image_semantics_json
設計頁生圖 → buildMaterialTexturePromptAppendix（讀 DB JSON）
```

### 產品 AI 重繪（prototype／part）

```
原圖 → buildVendorAssetProductOptimizePrompt(name, backgroundColor, useDisplayStand)
     → bfl_flux_model_vendor_product（預設 flux-2-pro）
```

---

## 四、必守政策（摘要）

完整見 `docs/flux-and-gemini-prompt-policy.md`。

1. 材質特徵進 **設計頁生圖**：**原圖** + **Gemini JSON** 或 DB prompt — 禁止程式查表發明表面形容。
2. **材料 FLUX optimize**：中文兩句 + `material_surface_type`；**不**送 `material_tagging_prompt` JSON。
3. **產品重繪**與材料 **分線**。
4. 廠商材料頁只改 `public/client/manufacturer-materials.html`。

---

## 五、關鍵檔案與函式

| 檔案 | 用途 |
|------|------|
| `server.js` | `buildVendorAssetMaterialFluxOptimizePrompt`、`optimizeVendorAssetImageWithFlux`、`buildVendorAssetProductOptimizePrompt`、`BFL_FLUX_MODEL_CONFIG` |
| `lib/resize-upload-image.js` | `prepareVendorMaterialFluxImage` |
| `lib/visual-semantics.js` | `material_tagging_prompt`、`analyzeImageSemantics` |
| `public/admin/ai-settings.html` | Gemini 三槽 + FLUX 四槽 |
| `public/client/manufacturer-materials.html` | 材料上傳／AI 優化 UI；`buildMaterialFluxPromptPreview` |
| `.cursor/rules/material-flux-prompt-lock.mdc` | prompt 鎖定 |

### `payment_config` FLUX 鍵

| 鍵 | 用途 | 程式預設 |
|----|------|----------|
| `bfl_flux_model_generate` | 設計頁生圖 | `flux-2-pro` |
| `bfl_flux_model_vendor_product` | 原型／零件重繪 | `flux-2-pro` |
| `bfl_flux_model_vendor_material` | 材料 AI 優化 | `flux-2-pro` |
| `bfl_flux_model_scene_pattern` | 實境／圖樣 | `flux-2-pro` |

### 未接上線（僅供考古）

| 符號 | 說明 |
|------|------|
| `resolveMaterialFluxEditPrompt` | Gemini 產英文編輯句；**未**進 optimize |
| `buildVendorAssetMaterialOptimizePrompt` | 英文 BFL 外殼；**未**進 optimize |
| `optimizeVendorAssetMaterialWithGemini` | Gemini Image；**從未呼叫** |

---

## 六、部署與驗收

### 部署

**只貼** [`deploy-matchdo-push-and-deploy.md`](deploy-matchdo-push-and-deploy.md) **§3.1 整行**（含 `grep --line-buffered -v -E 'Regional Access Boundary|taskmatchlng'`）。

### 驗收清單

| # | 操作 | 通過條件 |
|---|------|----------|
| 1 | `/admin/ai-settings.html` | FLUX 四欄為文字輸入 |
| 2 | 材料上傳 → AI 優化（純色 + 材質類型） | 滿版該材質質感 |
| 3 | 材料 tab 產品照 + 材質類型 | 滿版色卡質感（無版型） |
| 4 | 產品 tab AI 重繪 | 底色／人台／光影符合 UI；無角度鎖死感 |
| 5 | 編輯 → 圖庫重繪後 | 訂製程度、MOQ 等欄位仍保留 |
| 6 | 頁面 build | `window.__MATCHDO_MATERIALS_BUILD` ≥ `material-product-swatch-hint-20260710g` |

---

## 七、變更紀錄

| 日期 | 說明 |
|------|------|
| 2026-07-10 | 文件對齊 FLUX 材料管線；產品圖色卡第二句；產品重繪 segment；圖庫 metadata 保留 |
| 2026-07-09 | AVIF 原圖轉 JPEG；材料欄位必填文案 |
| 2026-06-18 | 曾短暫改 Gemini Image optimize（已廢；現行 FLUX） |
| 2026-06-05 | 初版：政策、後台手填 FLUX |

---

（若再改材料 FLUX prompt 或後台模型 UI，請同 PR 更新本檔與 `material-flux-prompt-lock.mdc`。）
