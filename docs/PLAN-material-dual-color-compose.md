# 材料雙色卡（Step1 色卡 + Step2 FLUX 材質）

## 流程

### Step 1 — 純前端 canvas（不扣點）

- 1024×1024，上方 **2/3 主色**、下方 **1/3 配色**
- 兩個 HEX 輸入即可
- 輸出：扁平雙色色卡（無縫線、無灰底、無第三色）

### Step 2 — FLUX img2img（成功後扣點）

- 參考圖：Step 1 色卡
- 使用者填寫：
  - **主色區材質**（必填）
  - **配色區材質**（必填）
  - **分界處**（選填；空白則 prompt 不帶此段；使用者自由描述，prompt 不寫死「縫線」等字）
- **顏色不必再填**：FLUX prompt **不寫 HEX／色名**，只要求 **依參考色卡保留上下色塊與 2/3–1/3 分界**；實際色相由 Step1 色卡 img 決定
- 輸出：1024×1024，沿用 `bfl_flux_model_vendor_material`、`skipPromptTranslation: true`

## 點數

| 行為 | payment_config key | 預設 | 管理區 |
|------|-------------------|------|--------|
| Step1 色卡 canvas | — | 0 | — |
| Step2 FLUX 材質生成 | `points_material_dual_color_flux` | **5** | `/admin/membership.html` → 點數規則 → **材料雙色卡** |

- 後端：`getPointsMaterialDualColorFlux()`（`server.js`）
- 前台讀價：`GET /api/me/vendor-assets/upload-pricing` → `points_dual_color_flux`
- 實作 API 時：**FLUX 成功後**才 `deductUserCredits`；失敗不扣

## FLUX prompt（中文 Gemini 寫法，新 builder，勿改 `buildVendorAssetMaterialFluxOptimizePrompt`）

送 FLUX 時 **`skipPromptTranslation: true`**（與既有材料 optimize 相同，中文直送 BFL）。

**顏色不在 prompt 重複填**；色相由 Step1 色卡參考圖決定，prompt 只描述「上下色塊改為何種材質」。

### 基本句（無縫線）

```
依原圖上方色塊改為{主色區材質}材質，下方色塊改為{配色區材質}材質，解析度1024x1024，不需要文字
```

範例（使用者填「編織布」「粒面皮革」）：

```
依原圖上方色塊改為編織布材質，下方色塊改為粒面皮革材質，解析度1024x1024，不需要文字
```

### 有填「分界處」選填欄時追加

在兩段材質句與解析度之間插入（**空白則整段省略**；使用者字串原樣嵌入，**不**在模板寫死「縫線」）：

```
依原圖上方色塊改為{主色區材質}材質，下方色塊改為{配色區材質}材質，分界處改為{分界處描述}，解析度1024x1024，不需要文字
```

範例（使用者填「同色明線車縫」）：

```
依原圖上方色塊改為編織布材質，下方色塊改為粒面皮革材質，分界處改為同色明線車縫，解析度1024x1024，不需要文字
```

### Builder 規則

- `{主色區材質}`、`{配色區材質}`：trim 後必填；空則 API 400
- `{分界處描述}`（參數 `stitchMaterial`）：trim 後有值才插入「分界處改為…」句
- 使用者字串**原樣嵌入**，不加 HEX、色名、regex 推斷
- 輸出尺寸仍由後端 FLUX 參數固定 **1024×1024**（prompt 內文與參數一致）

### 建議函式簽名

```js
function buildMaterialDualColorFluxPrompt(mainMaterial, accentMaterial, stitchMaterial) {
  // 回傳上述中文單段 prompt
}
```

## 待實作（程式）

- [x] `public/client/material-dual-color.html` + 素材庫入口
- [x] `POST /api/me/vendor-assets/material-dual-color-flux`
- [x] `buildMaterialDualColorFluxPrompt(...)` — `server.js`（中文 Gemini 句型）
- [x] 成功扣點、前台按鈕顯示「消耗 N 點」

## 參考

- `public/js/material-cover-grid-compose.js` — canvas 1024 合成模式
- `docs/flux-and-gemini-prompt-policy.md`
- `.cursor/rules/material-flux-prompt-lock.mdc`
