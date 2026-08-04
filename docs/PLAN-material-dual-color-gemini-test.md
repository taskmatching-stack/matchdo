# 材料組合：Gemini Nano Banana 測試規劃（先不改 code）

> 狀態：**規劃中／未實作**  
> 目的：FLUX 材料組合效果不滿意 → 改用 Gemini 生圖測一輪；可還原至現行 FLUX 版。

官方參考：[Gemini image generation（Nano Banana）](https://ai.google.dev/gemini-api/docs/image-generation)  
定價：[Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)  
頻率：[Gemini API rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)

---

## 1. 現行版本釘選（還原用）

| 項目 | 值 |
|------|-----|
| **還原 commit（必記）** | `6d15ef8`（完整 `6d15ef8ff506dc27e3edf3a9a56b6100aa2e0521`） |
| 訊息 | `fix(materials): make catalog expand toggle match primary button color` |
| 遠端 | `origin/main` @ 上記錄當下與 `6d15ef8` 對齊 |
| 行為基準 | Step2 仍走 **BFL FLUX.2 pro**（`optimizeMaterialDualColorWithFlux`） |
| 產品／prompt 文件 | `docs/PLAN-material-dual-color-compose.md`（75／25、印花圖樣／印花色實測） |

### 還原方式（日後）

```bash
# 僅還原材料組合相關檔（實作後依實際改動檔清單微調）
git checkout 6d15ef8 -- server.js public/client/material-dual-color.html docs/PLAN-material-dual-color-compose.md
```

或整段 `git revert` 測試期 commits。建議實作前再打 annotated tag：`material-combo-flux-baseline-6d15ef8`（實作當下執行即可）。

---

## 2. 模型分工（測試定案）

| 情境 | 模型 ID | Nano Banana 名稱 | 為何 |
|------|---------|------------------|------|
| **僅色卡**（無印花） | `gemini-3.1-flash-lite-image` | Nano Banana 2 Lite | 官方：最快／最便宜；**不**優化多參考圖；單張色卡夠用；僅支援 **1K** |
| **色卡 + 印花**（一張） | `gemini-3.1-flash-image` | Nano Banana 2 | 官方：多參考圖較穩；適合 2 張輸入 |

不變：

- Step1 色卡 canvas（75%／25%）仍前端組  
- 印花擇一區、`print_kind`（圖樣／色）語意先沿用  
- 扣點 key 暫維持 `points_material_dual_color_flux`（測試期可不改名；定案後再考慮改顯示文案）

---

## 3. API／輸入輸出契約（實作必守）

### 3.1 輸入圖

使用者指定格式（與官方 Interactions 文件一致）：

```js
{
  type: "image",
  mime_type: "image/png",
  data: base64Image  // 純 base64，無 data: 前綴
}
```

- 無印花：`[ text prompt, image色卡 ]`  
- 有印花：`[ text prompt, image色卡, image印花 ]`  
- 色卡／印花進模型前仍建議走現有 `resolveImageToBase64`（或 buffer→base64），勿再發明第二套抓圖。

### 3.2 只要圖、不要文字

- 設定只回圖：例如 `responseModalities: ['Image']`（專案材料 optimize 已用此法）  
  或 Interactions 的 `response_format: { type: "image", ... }`  
- **禁止**依賴模型回的說明文字當結果；解析失敗＝生成失敗。

### 3.3 輸出規格（建議測試預設）

| 項目 | 建議 |
|------|------|
| 比例 | `1:1`（對齊色卡 1024²） |
| 解析度 | **1K**（Lite 僅 1K；Flash 也先 1K 方便比對成本） |
| MIME | `image/png` 或 jpeg 與現有上傳管線對齊 |

### 3.4 SDK 選型（實作時二選一，先寫進 PR）

| 路徑 | 說明 |
|------|------|
| **A（建議優先）** | 沿用本站已有 `genAI.models.generateContent` + `inlineData` + `responseModalities: ['Image']`（見 `optimizeVendorAssetMaterialWithGemini`）— 改 model id、多一張 inline 圖即可 |
| **B** | 官方文件的 `interactions.create` + `type: "image"` — 與文件一字不差，但本站目前較少用，需多測 SDK／金鑰 |

測試期以 **能出圖、可還原** 為先；定案後再統一 API 風格。

### 3.5 Prompt

- 先**原樣沿用**現行中文短句（含 75%／25%、印花圖樣／印花色）  
- 勿在測試期加反向詞  
- 若 Gemini 比例／印花仍差，再另開 prompt 微調需求（與本次模型切換分開）

---

## 4. 實作範圍（待你說「開始寫」才動）

最小 diff 建議：

1. `optimizeMaterialDualColorWithFlux` 旁新增 `optimizeMaterialDualColorWithGemini`（或同函式內依開關分支）  
2. 無印花 → Lite；有印花 → Flash  
3. `POST .../material-dual-color-flux` 仍同一入口（前端可不改）；response 可加 `engine: 'gemini'|'flux'`、`model` 方便對照  
4. 環境／後台可選：`MATERIAL_DUAL_COLOR_ENGINE=gemini|flux`（預設測試期 `gemini`，還原設 `flux`）  
5. **不動**：材料單色 optimize、設計頁生圖、FLUX 其他管線  
6. bump `__MATCHDO_DUAL_COLOR_BUILD`  
7. 更新本文件狀態 →「測試中」

---

## 5. 成本（官方 Paid Standard，USD）

來源：[ai.google.dev/gemini-api/docs/pricing](https://ai.google.dev/gemini-api/docs/pricing)（查閱時點：規劃文件撰寫日）

### `gemini-3.1-flash-lite-image`（僅色卡）

| | Free | Paid |
|--|------|------|
| Input | 不可用 | $0.25 / 1M tokens（text/image/video） |
| Output 圖 | 不可用 | $30 / 1M image tokens ≈ **$0.0336／張 1K**（1120 tokens） |
| Output 文字／thinking | 不可用 | $1.50 / 1M（我們應設只回圖，理論上接近 0） |

另計：輸入色卡約 **1120 image tokens／張**（Cloud 文件常見寫法）→ 輸入成本極低（約千分之幾美元級）。

**粗估單次（無印花、1K）：≈ $0.03～0.04／張**（主因輸出圖）

### `gemini-3.1-flash-image`（色卡+印花）

| | Free | Paid |
|--|------|------|
| Input | 不可用 | $0.50 / 1M tokens（text/image） |
| Output 圖 | 不可用 | $60 / 1M image tokens ≈ **$0.067／張 1K**；$0.101／2K；$0.151／4K |
| Output 文字／thinking | 不可用 | $3 / 1M |

輸入：色卡 + 印花 ≈ 2×1120 image tokens + 短中文。

**粗估單次（有印花、1K）：≈ $0.07／張量級**（主因輸出；輸入可忽略）

### 與現況對照

- 本站材料組合目前扣點仍是 `points_material_dual_color_flux`（預設 5 點）— **點數≠美元**；Gemini 測試期仍可先扣同一點數。  
- 兩款 **Free Tier 均「Not available」** → 需 **已綁 billing 的 GEMINI_API_KEY**。

Batch 價約半價；材料組合即時互動不建議先走 Batch。

---

## 6. 頻率／花費上限（Tier 1 定案）

前提：站上已有 **`GEMINI_API_KEY`**（Paid；兩款 Nano Banana 圖模 **無 Free Tier**）。

官方（[rate-limits](https://ai.google.dev/gemini-api/docs/rate-limits)）：

- RPM／TPM／**IPM** 依專案顯示，**沒有**全球固定表 → 以 **AI Studio → Projects → Rate limits** 為準  
- Tier 升降：Tier1＝已綁 billing；Tier2＝累計付 ≥$100 + 首付後 3 天；Tier3＝≥$1000 + 30 天  
- **Tier 1 另有 10 分鐘滾動消費上限 ≈ $10／10min**（常比 RPM 先撞到）

### 6.1 成本換算（1K 輸出）

| 模型 | 約美元／張 | Tier1 $10／10min 理論上限 |
|------|------------|---------------------------|
| Lite（無印花） | ~$0.034 | ~290 張／10min（理論；實際會先撞 IPM） |
| Flash（有印花） | ~$0.067 | ~149 張／10min（理論） |

### 6.2 本站「軟上限」（實作時 env，預設偏保守）

目標：先撞**我們的上限**，少撞 Google 429／花超 $10／10min。

| env（建議名） | Tier1 建議預設 | 作用 |
|---------------|----------------|------|
| `GEMINI_IMAGE_CONCURRENCY` | `1` | 同時只跑 1 張生圖（沿用／強化 queue） |
| `GEMINI_IMAGE_MIN_INTERVAL_MS` | `8000`（約 7～8 張／分） | 兩次生圖最短間隔 |
| `GEMINI_IMAGE_MAX_PER_MIN` | `6` | 滑動 60 秒內最多 N 張 |
| `GEMINI_IMAGE_MAX_PER_10MIN` | `80` | 對齊 <$10／10min（80×$0.067≈$5.4，留緩衝） |
| `GEMINI_IMAGE_MAX_PER_DAY` | `200` | 日上限，防測到爆 |
| （可選）`MATERIAL_DUAL_COLOR_ENGINE` | `gemini`／`flux` | 測完可切回 FLUX |

超限回應：HTTP **429**，body 含 `retry_after_sec`；前端「請稍後再試」。  
Google 回 429：指數退避（最多 3 次）後同錯給使用者。

範圍：材料組合 Gemini 生圖（及之後若共用 `runInGeminiImageQueue`）；**勿**把標籤／翻譯文字 Gemini 也鎖進同一 IPM 日額（可分開或只限 image modalities）。

### 6.3 你在 Tier1 該怎麼調整（操作）

1. **AI Studio** 打開該 API key 所屬專案 → **Rate limits**  
   - 記下 `gemini-3.1-flash-lite-image`、`gemini-3.1-flash-image` 的 **RPM／IPM**  
   - 若 IPM &lt; 6：把 `GEMINI_IMAGE_MAX_PER_MIN` 調成 **IPM−1**（至少 1）  
2. **測圖節奏**：手動連點不要超過每分鐘 6 次；一次測完等 10～15 秒  
3. **快撞 $10／10min**：暫時停測或把 `GEMINI_IMAGE_MAX_PER_10MIN` 降到 `40`  
4. **要更大額度（升 Tier2）**：該專案累計付費滿 **$100**，且距第一次成功付款滿 **3 天** → 自動升階（到 AI Studio Projects 看目前 Tier）  
5. **不要**靠多開 API key 加額度（官方是專案／帳號額度，多 key 通常不疊加）  
6. Cloud Run／主機 env 設上表變數後 **redeploy** 才生效  

### 6.4 專案實測（使用者 AI Studio · Tier 1）

| 模型 | RPM | TPM（input） | RPD |
|------|-----|--------------|-----|
| Nano Banana 2（`gemini-3.1-flash-image`） | **100** | **200K** | **1K（1000）** |
| Nano Banana 2 Lite（`gemini-3.1-flash-lite-image`） | **150** | **100K** | **1K（1000）** |

表上「0 / N」＝目前用量／上限。此專案畫面**未列 IPM**；生圖次數主要受 **RPM + RPD** 與下方 **花費滾動上限** 約束。

對本站軟上限的意義：

- 每分鐘 6 張遠低於 RPM 100／150 → **夠用、偏保守**  
- 每天 200 張遠低於 RPD 1000 → 可依測試需要調高，但建議 ≤ **800／日** 留緩衝  
- 真正要小心的仍是 Tier1 **$10／10min**（見 §6.5）

### 6.5 Tier 1／Tier 2 上限差在哪

官方 [rate-limits](https://ai.google.dev/gemini-api/docs/rate-limits)（花費滾動窗 + 升階條件）：

| | **Tier 1**（你現在） | **Tier 2** |
|--|----------------------|------------|
| 怎麼取得 | 專案已綁有效 billing | 累計付費 ≥ **$100**，且距**第一次成功付款**滿 **3 天**（通常自動升） |
| **10 分鐘滾動消費上限** | **$10／10min** | **$200／10min** |
| Billing tier cap（帳務上限概念） | 約 **$250** | 約 **$2,000** |
| RPM／TPM／RPD | **看 AI Studio 該專案該模型**（你已查到上表） | 升階後常會提高；**以升階後 AI Studio 為準**，不要假設等於現在 ×20 |

換算提醒（1K 圖、約略）：

- Tier1 $10／10min ÷ ~$0.067（Flash）≈ **~150 張／10min** 才會撞花費牆（RPM 100 通常更先或一起壓）  
- Tier2 $200／10min 在花費面上寬很多；若 RPD 仍是 1K，**日額 1000 張**仍可能是日天花板  

**升 Tier2 你要做的：** 繼續用付費 key 正常打（或儲值），累計滿 $100 且滿 3 天 → 到 AI Studio **Projects** 看 Tier 是否變 2 → 再截一次 RPM／RPD 更新本表。  
不要靠多開 API key 加額度。

---

## 7. 驗收清單（你測）

| # | 案例 | 預期模型 | 看什麼 |
|---|------|----------|--------|
| 1 | 無印花 尼龍／皮革 | Lite | 比例是否接近 75／25；材質是否合理 |
| 2 | 主區＋印花圖樣 | Flash | 圖樣原色是否較穩；比例 |
| 3 | 主區＋印花色 | Flash | 與圖樣模式差異是否仍可接受 |
| 4 | 關 Gemini／切回 flux | FLUX @ `6d15ef8` 行為 | 還原路徑可用 |

---

## 8. 風險／已知限制

- Lite：**不**適合多參考；有印花時**不要**誤用 Lite  
- SynthID 浮水印：官方所有生圖都有  
- Interactions vs generateContent：選錯 SDK 會多繞路  
- 切 Gemini 後 FLUX seed／PUP 參數不再適用  
- 勿順便改材料單色 `gemini-2.5-flash-image` 管線

---

## 9. 已拍板／待拍板

**已確認**

- 站內有 `GEMINI_API_KEY`（Paid）  
- Tier **1** → 採 §6.2 保守軟上限；以 AI Studio IPM 微調 `GEMINI_IMAGE_MAX_PER_MIN`  
- FLUX 還原釘：`6d15ef8`

**待你說「開始寫」再實作**

1. 預設引擎：`gemini` 全開材料組合，或 env 開關？  
2. API：`generateContent`（建議）還是 `interactions`？  
3. 是否打 git tag `material-combo-flux-baseline-6d15ef8`？
