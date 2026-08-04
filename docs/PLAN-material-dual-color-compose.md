# 材料雙色卡（Step1 色卡 + Step2 FLUX 材質）

## 流程

### Step 1 — 純前端 canvas（不扣點）

- 1024×1024，上方 **2/3 主色**、下方 **1/3 配色**
- 兩個 HEX 輸入即可
- 輸出：**PNG** 雙色色卡（避免 JPEG 模糊分界；無縫線、無灰底、無第三色）

### Step 2 — 對齊 BFL 官網 playground（成功後扣點）

官網實測可正確保留 2/3–1/3 的條件（勿自行加長 prompt）：

| 項目 | 值 |
|------|-----|
| Model | FLUX.2 [pro]（`bfl_flux_model_vendor_material`） |
| Prompt | **中文短句**（見下），`skipPromptTranslation: true` |
| 參考圖 | Step1 色卡整張（`input_image`） |
| Seed | `3647440197`（`VENDOR_MATERIAL_FLUX_SEED`） |
| Safety | `2` |
| Disable PUP | **`disable_pup: true`**（必設；否則短中文會被自動擴寫） |
| 輸出 | 1024×1024 |

**禁止的汙染（曾導致比例漂移／與官網不一致）：**

- ❌ 把中文翻成英文再送 BFL
- ❌ 在官網短句外加「嚴格版面／禁止 1/2／只轉換紋理」等長句
- ❌ 附加攝影參數／系統附錄
- ❌ 把雙色卡拆成兩次材料優化再硬合成（偏離官網管線；僅作實驗用，現行不採用）
- ❌ 未設 `disable_pup: true`（FLUX.2 [pro]/[max] **預設會 prompt upsampling**；舊欄位 `prompt_upsampling:false` 對 pro **無效**，短中文會被改寫成長描述）
- ❌ 另傳「對照 echo 圖」給使用者（上方色卡預覽已足夠）

## 點數

| 行為 | payment_config key | 預設 | 管理區 |
|------|-------------------|------|--------|
| Step1 色卡 canvas | — | 0 | — |
| Step2 FLUX 材質生成 | `points_material_dual_color_flux` | **5** | `/admin/membership.html` |

## FLUX prompt（與官網成功案例同一模板）

```
依原圖上方色塊改為{主色區材質}材質，下方色塊改為{配色區材質}材質，解析度1024x1024，不需要文字
```

有分界處時：

```
依原圖上方色塊改為{主色區材質}材質，下方色塊改為{配色區材質}材質，分界處改為{分界處描述}，解析度1024x1024，不需要文字
```

## 參考

- BFL playground 實測截圖（中文短句 + 2/3–1/3 色卡 → 比例正確）
- `.cursor/rules/material-flux-prompt-lock.mdc`（材料單色優化另案；雙色卡用本文件模板）
