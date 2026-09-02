# 材料組合：Gemini Nano Banana 測試（Gemini 優先 → 滿額 FLUX → 自動切回）

> 狀態：**結構已定；軟上限已改為 Tier2 程式預設（2026-09-03）**  
> 結論：Gemini 生圖結構穩定，維持 **Gemini 優先 → 滿額／429 → FLUX → 額度恢復自動回 Gemini**。  
> 生圖佇列改為 **最多 8 路並行**（不再串行）。頻率按「同一分鐘多人點生成」設，不用單張耗時反推峰值。  
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

## 4. 軟上限 env（Gemini 生圖共用）

**範圍：** 全站 Gemini **生圖**共用同一組計數與 `runInGeminiImageQueue`（材料組合、印花、圖樣提取、廠商材料／版型重繪、商攝空間 ISO／平視、人像清晰等）。  
**不影響：** 標籤、翻譯、語意、其他 `runInGeminiQueue` 文字／讀圖。

| env（建議） | 舊名（仍相容） | **現行預設（T2）** |
|-------------|----------------|-------------------|
| `GEMINI_IMAGE_MAX_CONCURRENT` | — | `8`（上限 16） |
| `MATERIAL_DUAL_COLOR_GEMINI_MIN_INTERVAL_MS` | `GEMINI_IMAGE_MIN_INTERVAL_MS` | `0`（不靠間隔限速） |
| `MATERIAL_DUAL_COLOR_GEMINI_MAX_PER_MIN` | `GEMINI_IMAGE_MAX_PER_MIN` | `70` |
| `MATERIAL_DUAL_COLOR_GEMINI_MAX_PER_10MIN` | `GEMINI_IMAGE_MAX_PER_10MIN` | `700`（官方 T2 **$200／10min**，按 Pro 4K 官方價略留緩衝） |
| `MATERIAL_DUAL_COLOR_GEMINI_MAX_PER_DAY` | `GEMINI_IMAGE_MAX_PER_DAY` | `0`（不限；官方 T2 RPD 無上限） |

（記憶體計數，程序重啟歸零。Cloud Run 若仍寫著舊 T1 env，會蓋掉程式預設，須刪除或改成上表。）

---

## 5. 成本（Nano Banana Pro 官方價）

付費層級，每 100 萬個權杖（美元）。本站 10 分鐘牆用 **圖片輸出** 最貴列來估，不拿 Lite／Banana 2 當最窄路徑。

| 項目 | 官方 |
|------|------|
| 輸入（文字／圖片） | $2.00／百萬 token，約 **$0.0011／張輸入圖** |
| 輸出・文字與思考 | $12.00／百萬 token |
| 輸出・圖片 | $120.00／百萬 token |
| 輸出・**1K／2K 圖** | **$0.134／張** |
| 輸出・**4K 圖** | **$0.24／張** |

輸入相對輸出幾乎可忽略（4 張參考圖 ≈ $0.0044）。思考權杖無法事先數準，10 分鐘張數略低於「純 4K 輸出滿額」。  
官方 T2 滾動 **$200／10 分鐘**（[rate-limits §Tier 2](https://ai.google.dev/gemini-api/docs/rate-limits?hl=zh-tw#tier-2)），與 RPM 同時生效。

---

## 6. 目前結論與升級節奏

| 階段 | 狀態 | 做法 |
|------|------|------|
| **結構** | 已定 | 模型分工、auto／fallback、佇列隔離、生圖軟上限 |
| **Tier1 舊預設** | 已取代 | 8 秒間隔／6／分／80／10 分／200／日／串行 |
| **Tier2** | **現行程式預設** | 見 §4、§6.3；部署後生效 |

### 6.1 官方額度（生圖模型，2026-09 營運表）

共用軟上限必須以最窄的模型為準。本站有 **Nano Banana Pro**（空間 ISO／平視、人像清晰），不能只照 Banana 2 拉滿。

| 模型 | 暱稱 | T1 RPM | T1 RPD | T2 RPM | T2 RPD |
|------|------|--------|--------|--------|--------|
| `gemini-3.1-flash-lite-image` | Nano Banana 2 Lite | 300–500 | 無上限 | 1000–2000 | 無上限 |
| `gemini-3.1-flash-image` | Nano Banana 2 | 100–300 | 無上限 | 500–1000 | 無上限 |
| `gemini-3-pro-image` | Nano Banana Pro | 50–100 | 無上限 | **300–500** | 無上限 |

RPM／RPD **同時生效**。另有花費窗（官方表）：T1 **$10／10min**，T2／T3 **$200／10min**。  
這筆錢比 Pro 的 T2 RPM（300–500）更緊：

| 假設 10 分鐘內全是該價（僅計圖片輸出） | $200 最多幾張 |
|----------------------------------------|---------------|
| 全 Pro **4K**（$0.24） | **約 833** ← 支出牆最窄 |
| 全 Pro **2K**（$0.134） | 約 1492 |
| 4K + 4 張輸入圖（+$0.0044） | 約 818 |

### 6.2 升 Tier2 條件（Google 官方，以當下文件為準）

- 累計付費約 **≥ $100**，且首筆付款後約 **3 天**  
- 升後花費窗約 **$200／10min**  
- 實際數字以 AI Studio → Rate limits 為準；確認已顯示 **Tier 2** 再改 env

### 6.3 Tier2 軟上限（已寫進程式預設）

**為什麼不能用「Pro 單張 10 秒 → 串行只有 6 RPM」來設上限：**  
那是單一請求的延遲，不是容量。同一分鐘若有 50 人點生成，串行會變成約 50 人排隊（Pro 可能排到數分鐘）。限速要回答的是「這一分鐘允許幾張進官方 API」，並行要回答的是「同時能跑幾張」，兩件事先分開設。

尖峰假設：**同一分鐘 50 人各生 1 張**（50 RPM）。Pro 若約 10 秒／張，同時在飛的大約 `50 × 10/60 ≈ 8` 路。

| 項目 | 值 | 為什麼 |
|------|----|--------|
| 並行 `GEMINI_IMAGE_MAX_CONCURRENT` | **8** | 吃得下約 50 人／分的 Pro 在飛量；Lite／Banana 2 更快，8 路理論吞吐更高，由每分鐘上限擋住 |
| 最短間隔 | **0** | 不再用間隔當 RPM 閘；否則 2 秒間隔會把 50 人硬生生拉成 30 RPM |
| 每分鐘 | **70** | 對齊 10 分鐘 700；仍遠低於 Pro T2 RPM 300 |
| 每 10 分鐘 | **700** | 官方 **$200／10min**、官方 4K **$0.24** → 滿額 833 張。700 ≈ 輸出 $168，加參考圖輸入仍約 $171，略留思考權杖／誤差 |
| 每天 | **不限（0）** | 官方 T2 **沒有**每日上限；不另加日牆 |

仍遠低於官方 T2 RPM。超軟上限 → FLUX fallback，不是把第 51 人丟進無限等待。

Cloud Run 若曾寫入舊 T1 env，部署後仍會蓋掉新預設。清掉或改成與 §4 相同：

```bash
gcloud run services update matchdo --region=asia-northeast1 \
  --update-env-vars=GEMINI_IMAGE_MAX_CONCURRENT=8,MATERIAL_DUAL_COLOR_GEMINI_MIN_INTERVAL_MS=0,MATERIAL_DUAL_COLOR_GEMINI_MAX_PER_MIN=70,MATERIAL_DUAL_COLOR_GEMINI_MAX_PER_10MIN=700,MATERIAL_DUAL_COLOR_GEMINI_MAX_PER_DAY=0
```

### 6.4 不要做（T2）

- 不要把共用上限拉到 Banana 2 的 500 RPM（會先打爆 Pro）。  
- 不要把 10 分鐘張數拉過 **833**（全 Pro 4K 就會先撞官方 **$200／10min**，比 RPM 先爆）。  
- 不要動標籤／翻譯那條 `runInGeminiQueue`。

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
- 把生圖軟上限套到標籤／翻譯（`runInGeminiQueue`）  
- 未確認 AI Studio 已近／已是 Tier 2 就把並行或每分鐘拉近官方滿額  
