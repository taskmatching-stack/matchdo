# 材料雙色卡（Step1 色卡 + Step2 FLUX 材質）

## 流程

### Step 1 — 純前端 canvas（不扣點）

- 1024×1024，上方 **2/3 主色**、下方 **1/3 配色**
- 兩個 HEX 輸入即可
- 輸出：扁平雙色色卡（無縫線、無灰底、無第三色）

### Step 2 — 分區材質化 + 程式合成（成功後扣點）

- **不再**把整張 2/3–1/3 雙色卡丟給 FLUX 一次 img2img（模型常漂成上下各半）
- 正確流程：
  1. 主色／配色各做一張 1024 滿版純色
  2. 各自用 **`buildVendorAssetMaterialFluxOptimizePrompt`**（與材料 AI 重繪同一句）做材質化
  3. **sharp 硬合成**：上 `floor(1024×2/3)`、下其餘 1/3
- 分界處（選填）：在接縫疊約 3% 高的材質細帶（不改變 2/3–1/3 面積）
- 輸出：1024×1024；點數仍為一次 `points_material_dual_color_flux`（內部可跑 2～3 次 BFL）

## 點數

| 行為 | payment_config key | 預設 | 管理區 |
|------|-------------------|------|--------|
| Step1 色卡 canvas | — | 0 | — |
| Step2 分區材質＋合成 | `points_material_dual_color_flux` | **5** | `/admin/membership.html` → 點數規則 → **材料雙色卡** |

- 後端：`getPointsMaterialDualColorFlux()`（`server.js`）
- 前台讀價：`GET /api/me/vendor-assets/upload-pricing` → `points_dual_color_flux`
- 實作 API 時：**FLUX 成功後**才 `deductUserCredits`；失敗不扣

## FLUX prompt（各區獨立，沿用材料重繪句）

每區送：

```
保持顏色並優化此{材質}材質光影。若參考圖含產品、服裝或物件外型，去除版型、縫線、標籤與背景，整張滿版呈現此{材質}材質色卡質感。
```

版面**不**靠 prompt 約束，由 `optimizeMaterialDualColorWithFlux` 程式合成鎖定。

### Builder 規則

- `{主色區材質}`、`{配色區材質}`：trim 後必填；空則 API 400
- `{分界處描述}`：有值才跑細帶材質化
- **版面鎖定**：程式 `topH = floor(1024 * 2 / 3)`，禁止再依賴單次全圖 FLUX
- 輸出尺寸固定 **1024×1024**

### 建議函式簽名

```js
async function optimizeMaterialDualColorWithFlux(fileBuffer, mainMaterial, accentMaterial, stitchMaterial, colorHex) {
  // 分區材料 FLUX + sharp 合成上 2/3、下 1/3
}
```

## 待實作（程式）

- [x] `public/client/material-dual-color.html` + 素材庫入口
- [x] `POST /api/me/vendor-assets/material-dual-color-flux`
- [x] 分區材質化 + 硬合成鎖定 2/3–1/3（修 FLUX 漂成 1/2–1/2）
- [x] 生成結果一鍵「加入材料待傳清單」（同格原圖色卡＋FLUX 新圖，預設只上傳新圖）

## 參考

- `public/js/material-cover-grid-compose.js` — canvas 1024 合成模式
- `docs/flux-and-gemini-prompt-policy.md`
- `.cursor/rules/material-flux-prompt-lock.mdc`
