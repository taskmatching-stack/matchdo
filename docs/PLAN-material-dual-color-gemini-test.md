# 材料組合：Gemini Nano Banana 測試（Gemini 優先 → 滿額 FLUX → 自動切回）

> 狀態：**結構已定（Tier1 運行中）**  
> 結論：Gemini 生圖結構穩定，維持 **Gemini 優先 → 滿額／429 → FLUX → 額度恢復自動回 Gemini**。  
> 目前帳號為 **Tier1**；需累積足夠付費用量後才能升 **Tier2**，屆時再調高本頁軟上限。  
> FLUX 還原釘／tag：`6d15ef8`／`material-combo-flux-baseline-6d15ef8`  
> 預設：`MATERIAL_DUAL_COLOR_ENGINE=auto`（未設＝auto）。

官方參考：[Gemini image generation](https://ai.google.dev/gemini-api/docs/image-generation) · [pricing](https://ai.google.dev/gemini-api/docs/pricing) · [rate-limits](https://ai.google.dev/gemini-api/docs/rate-limits)

---

## 1. 現行版本釘選（還原用）

| 項目 | 值 |
|------|-----|
| **還原 commit** | `6d15ef8` |
| **git tag** | `material-combo-flux-baseline-6d15ef8` |
| 行為 | Step2 全走 BFL FLUX（改 Gemini 前） |

```bash
git checkout material-combo-flux-baseline-6d15ef8 -- server.js public/client/material-dual-color.html
# 或 MATERIAL_DUAL_COLOR_ENGINE=flux 僅強制 FLUX、不改 code
```

---

## 2. 模型分工

| 情境 | 預設 model | 後台鍵 |
|------|------------|--------|
| 僅色卡 | `gemini-3.1-flash-lite-image` | `gemini_model_material_combo_lite` |
| 色卡 + 印花 | `gemini-3.1-flash-image` | `gemini_model_material_combo_flash` |
| 滿額／429 | FLUX.2 pro（原管線） | （FLUX 槽，非本頁） |

可於 `/admin/ai-settings.html` 手填更換；未寫入 DB 前用程式預設。見 `docs/admin-ai-settings-models.md` §2.2。

API：`generateContent` + `inlineData` + `responseModalities: ['Image']`（只要圖）。

---

## 3. 引擎開關

| `MATERIAL_DUAL_COLOR_ENGINE` | 行為 |
|------------------------------|------|
| `auto`（預設） | Gemini → 滿額／429 則 FLUX → 之後自動回 Gemini |
| `gemini` | 只用 Gemini；軟上限直接 429（不 fallback） |
| `flux` | 只用 FLUX |

回應欄位：`engine`、`model`、`fallback`、`fallback_reason`。

---

## 4. 軟上限 env（僅材料組合生圖）

**範圍：** 計／擋 `optimizeMaterialDualColorWithGemini` **與** `optimizePrintAssetWithGemini`（共用軟上限與生圖佇列）。  
**不影響：** 標籤、翻譯、語意、材料單色 AI optimize、其他 `runInGeminiQueue` 呼叫。

| env（建議） | 舊名（仍相容） | 預設 |
|-------------|----------------|------|
| `MATERIAL_DUAL_COLOR_GEMINI_MIN_INTERVAL_MS` | `GEMINI_IMAGE_MIN_INTERVAL_MS` | `8000` |
| `MATERIAL_DUAL_COLOR_GEMINI_MAX_PER_MIN` | `GEMINI_IMAGE_MAX_PER_MIN` | `6` |
| `MATERIAL_DUAL_COLOR_GEMINI_MAX_PER_10MIN` | `GEMINI_IMAGE_MAX_PER_10MIN` | `80` |
| `MATERIAL_DUAL_COLOR_GEMINI_MAX_PER_DAY` | `GEMINI_IMAGE_MAX_PER_DAY` | `200` |

（記憶體計數，程序重啟歸零。）

---

## 5. 成本（Paid Standard，約略）

| 模型 | 約／張 1K |
|------|-----------|
| Lite | ~$0.034 |
| Flash | ~$0.067 |

皆無 Free Tier。Batch 約半價；即時互動不走 Batch。

---

## 6. 目前結論與升級節奏

| 階段 | 狀態 | 做法 |
|------|------|------|
| **結構** | 已定 | 模型分工、auto／fallback、佇列隔離、僅生圖軟上限 — 不再改架構 |
| **Tier1** | 現行 | 軟上限維持保守預設（見 §4），避免撞官方 429／$10／10min |
| **累積用量** | 進行中 | 正常使用材料組合生圖，累計付費額度；**勿為升級而刻意狂打**（仍受軟上限＋FLUX fallback） |
| **Tier2** | 未到 | 達官方門檻後，再**調高** §4 的 Cloud Run env（不必改 code） |

### 6.1 Tier1 官方額度（AI Studio 實測）

| 模型 | RPM | TPM | RPD |
|------|-----|-----|-----|
| Flash | 100 | 200K | 1000 |
| Lite | 150 | 100K | 1000 |

RPM／TPM／RPD **同時生效**，任一觸發 429。另盯 Tier1 **$10／10min**。  
Pro 的「RPM~300」參考表**不要**套到 Flash／Lite。

### 6.2 升 Tier2 條件（Google 官方，以當下文件為準）

- 累計付費約 **≥ $100**，且首筆付款後約 **3 天**  
- 升後花費窗約 **$200／10min**（遠高於 Tier1 的 $10／10min）  
- 實際 RPM／TPM／RPD 以 AI Studio → Rate limits 為準

### 6.3 升到 Tier2 後要做什麼

1. 在 AI Studio 確認已顯示 **Tier 2**。  
2. 於 Cloud Run 調高（建議仍低於官方額度，留緩衝）：

| env | Tier1 預設（現行） | Tier2 建議起點（可再調） |
|-----|-------------------|--------------------------|
| `MATERIAL_DUAL_COLOR_GEMINI_MIN_INTERVAL_MS` | `8000` | `3000`～`4000` |
| `MATERIAL_DUAL_COLOR_GEMINI_MAX_PER_MIN` | `6` | `20`～`40` |
| `MATERIAL_DUAL_COLOR_GEMINI_MAX_PER_10MIN` | `80` | `300`～`500` |
| `MATERIAL_DUAL_COLOR_GEMINI_MAX_PER_DAY` | `200` | `800`～`1500`（勿超過該模型 RPD） |

3. 部署後用 Network 看：高峰仍應偶發 `fallback=true`（FLUX），不應整段全是 429。  
4. **仍只調材料組合生圖 env**；不要動其他 Gemini（標籤／翻譯等）。

---

## 7. 驗收（結構已過）

1. 無印花 → `engine=gemini`、`model=gemini-3.1-flash-lite-image`  
2. 有印花 → Flash model  
3. 連續猛點觸發軟上限 → `engine=flux`、`fallback=true`  
4. 等待間隔後再生成 → 自動回 Gemini  
5. 其他 Gemini（標籤等）不受材料組合軟上限／生圖佇列影響  
6. build：`material-combo-gemini-image-quota-isolated-20260805`

---

## 8. 禁止

- 有印花誤用 Lite  
- 反向詞污染 prompt  
- 順便改材料單色 optimize／其他 FLUX 管線  
- 把材料組合生圖軟上限套到其他 Gemini 用途  
- Tier1 期間為「衝升級」拿掉軟上限或設成接近官方滿額  
