# 進度：設計圖轉實體（Design → Physical）

**最後更新：** 2026-07-11  
**狀態：** 已實作（待部署驗收）  
**點數：** 固定 **20 點／次**（`points_design_to_physical`，預設 20）

## 一句話

獨立 FLUX img2img：將平面設計圖／圖樣轉成寫實實體產品照。  
Prompt（鎖定）：`將圖樣轉為實體寫實產品，圖樣、結構和顏色要完全一致`

## 與現有功能分線

| 功能 | 用途 |
|------|------|
| 產品 AI 重繪 | 已是產品照 → 換底／去雜物 |
| 材料 FLUX | 滿版材質色卡 |
| **設計圖轉實體** | 圖樣 → 寫實成品 |

**禁止**併入 `buildVendorAssetProductOptimizePrompt`、材料 prompt、或設計頁 `composeGeneratePromptWithReferences`。

## 後端

| 項目 | 位置 |
|------|------|
| Prompt／SEED | `DESIGN_TO_PHYSICAL_PROMPT`、`DESIGN_TO_PHYSICAL_SEED` |
| 執行 | `runDesignToPhysicalFlux` |
| 設計區 API | `POST /api/design-to-physical` |
| 廠商預覽 | `POST /api/me/vendor-assets/preview-design-to-physical` |
| 圖庫追加 | `POST /api/me/vendor-assets/:id/gallery-images/design-to-physical` |
| 模型 | 暫用 `bfl_flux_model_vendor_product`（1024²，`skipPromptTranslation`） |
| `ai_derived` | `design_to_physical` |

## 前端

| 入口 | 說明 |
|------|------|
| 設計區 Tab「設計圖轉實體」 | `custom-product.html` + `custom-product.js`；本機／數位資產選圖；下載；可加入數位原型參考 |
| 廠商素材庫 | 僅 **prototype／part**；待傳／編輯待傳「轉實體」；圖庫「轉實體」直接追加 |
| Build | `__MATCHDO_MATERIALS_BUILD=design-to-physical-20260711a` |

## 驗收

1. 設計區 Tab → 上傳設計圖 → 出寫實圖 → -20 點  
2. 結果可下載、可加入數位原型參考  
3. 廠商原型／配件待傳「轉實體」→ 同格新圖 → 勾選上傳  
4. 編輯圖庫「轉實體」→ 追加新圖、原圖保留、metadata 不丟  
5. 材料 tab **無**轉實體按鈕  
