# FLUX 並行排隊 × 版型／材料 Gemini Lite 重繪

> 更新日期：2026-08-05  
> 狀態：**已實作**

## 1. FLUX／BFL 全站並行上限（排隊）

官方約 **24 active tasks**；本站預設並行 **20**（留緩衝）。達上限時**排隊等待**，不直接對使用者丟 429。

| 項目 | 值 |
|------|-----|
| 實作 | `runInBflQueue`（`server.js`） |
| 預設並行 | `20` |
| env | `BFL_MAX_CONCURRENT`（1～24） |

涵蓋入口（create＋poll 整段佔用一槽）：

- `generateImageWithFlux2Pro`／`generateImageWithFlux2ProTextToImage`
- `bflPlaygroundImageEdit`／`bflPlaygroundTextToImage`
- `generateSceneSimulateImage`／`generatePatternExtractImage`

→ 設計頁生圖、寫實化、情境圖、商攝、實境、圖樣、廠商／供應商重繪 FLUX fallback、材料組合／印花 FLUX fallback 皆受控。

## 2. 官方／廠商／供應商 AI 重繪 → Gemini Lite

| 項目 | 說明 |
|------|------|
| Model | 預設 `gemini-3.1-flash-lite-image`（後台 `gemini_model_material_optimize`） |
| 入口 | `optimizeVendorAssetImage`（材料＋數位原型／版型） |
| 佇列 | `runInGeminiImageQueue`（與標籤／翻譯隔離） |
| 軟上限 | 與材料組合／印花**共用**（`MATERIAL_DUAL_COLOR_GEMINI_*`／`GEMINI_IMAGE_*`） |
| Fallback | 軟上限或 API 429 → 既有 FLUX（再進 `runInBflQueue`） |
| env | `VENDOR_ASSET_OPTIMIZE_ENGINE=auto\|gemini\|flux`（預設 auto） |

涵蓋：`maybeOptimizeVendorAssetMulterFile`、preview redraw、gallery redraw、PUT 重繪、供應商 catalog 管線、官方版型庫（同一 API＋official header）。

## 3. 與「點數 10」無關

本文件只管 API 頻率／並行；扣點仍見 `/admin/membership.html`。
