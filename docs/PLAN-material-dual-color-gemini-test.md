# 材料組合：Gemini Nano Banana 測試（Gemini 優先 → 滿額 FLUX → 自動切回）

> 狀態：**測試中（已實作）**  
> FLUX 還原釘／tag：`6d15ef8`／`material-combo-flux-baseline-6d15ef8`  
> 預設：`MATERIAL_DUAL_COLOR_ENGINE=auto`（未設＝auto）→ **Gemini 優先**；軟上限或 API 429 → **FLUX**；額度恢復後下一張自動回 Gemini。

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

| 情境 | 模型 |
|------|------|
| 僅色卡 | `gemini-3.1-flash-lite-image` |
| 色卡 + 印花 | `gemini-3.1-flash-image` |
| 滿額／429 | FLUX.2 pro（原管線） |

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

## 4. 軟上限 env（Tier1 建議）

| env | 預設 |
|-----|------|
| `GEMINI_IMAGE_MIN_INTERVAL_MS` | `8000` |
| `GEMINI_IMAGE_MAX_PER_MIN` | `6` |
| `GEMINI_IMAGE_MAX_PER_10MIN` | `80` |
| `GEMINI_IMAGE_MAX_PER_DAY` | `200` |

（記憶體計數，程序重啟歸零。僅材料組合 Gemini 生圖。）

---

## 5. 成本（Paid Standard，約略）

| 模型 | 約／張 1K |
|------|-----------|
| Lite | ~$0.034 |
| Flash | ~$0.067 |

皆無 Free Tier。Batch 約半價；即時互動不走 Batch。

---

## 6. Tier1 實測（AI Studio）

| 模型 | RPM | TPM | RPD |
|------|-----|-----|-----|
| Flash | 100 | 200K | 1000 |
| Lite | 150 | 100K | 1000 |

RPM／TPM／RPD **同時生效**，任一觸發 429。另盯 Tier1 **$10／10min**。  
Tier2：累計付 ≥$100 + 首付後 3 天 → 花費窗 **$200／10min**。  
Pro 的「RPM~300」參考表**不要**套到 Flash／Lite。

---

## 7. 驗收

1. 無印花 → `engine=gemini`、`model=gemini-3.1-flash-lite-image`  
2. 有印花 → Flash model  
3. 連續猛點觸發軟上限 → `engine=flux`、`fallback=true`  
4. 等待間隔後再生成 → 自動回 Gemini  
5. build：`material-combo-gemini-prefer-flux-fallback-20260805`

---

## 8. 禁止

- 有印花誤用 Lite  
- 反向詞污染 prompt  
- 順便改材料單色 optimize／其他 FLUX 管線  
