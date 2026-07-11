# 進度：寫實化（Photorealize）

**最後更新：** 2026-07-11  
**狀態：** 已實作（對外名稱：寫實化）  
**點數：** 固定 **20 點／次**（`points_design_to_physical`，預設 20；後台「會員／點數規則」可調）

## 一句話

將**產品圖稿／示意圖**寫實化（FLUX img2img）。  
Prompt（鎖定）：`將圖樣轉為實體寫實產品，圖樣、結構和顏色要完全一致`

## 扣點統計（管理後台）

- 寫入 `credit_transactions`：`source=design_to_physical`，`description=寫實化`
- 後台「扣點統計」依 description 彙總；「點數規則」顯示名稱為「寫實化」
- 三入口（設計區／廠商預覽／圖庫追加）皆用同一 description

## 與現有功能分線

| 功能 | 用途 |
|------|------|
| 產品 AI 重繪 | 已是產品照 → 換底／去雜物 |
| 材料 FLUX | 滿版材質色卡 |
| **寫實化** | 產品圖稿／示意圖 → 寫實成品照 |

**禁止**併入 `buildVendorAssetProductOptimizePrompt`、材料 prompt、或設計頁 `composeGeneratePromptWithReferences`。

## 後端（內部鍵名仍為 design_to_physical）

| 項目 | 位置 |
|------|------|
| Prompt／SEED | 固定保真底稿 + 使用者自訂補充；SEED `3647440197`；端點 **`/v1/flux-2-pro-preview`**（與 BFL 官網同款，不走 `flux-2-pro`）；小圖 Lanczos 放大；`safety_tolerance=2` |
| 執行 | `runDesignToPhysicalFlux` |
| 設計區 API | `POST /api/design-to-physical` |
| 廠商預覽 | `POST /api/me/vendor-assets/preview-design-to-physical` |
| 圖庫追加 | `POST /api/me/vendor-assets/:id/gallery-images/design-to-physical` |
| 模型 | 暫用 `bfl_flux_model_vendor_product`（1024²，`skipPromptTranslation`） |
| `ai_derived` | `design_to_physical` |

## 前端

| 入口 | 說明 |
|------|------|
| 設計區 Tab「寫實化」 | 本機／數位資產選圖；下載；可加入數位原型參考 |
| 廠商素材庫 | 僅 **prototype／part**；按鈕文案「寫實化」 |
| Build | `__MATCHDO_MATERIALS_BUILD=photorealize-rename-20260711c` |
| i18n | zh：寫實化；en：Photorealize |

## 驗收

1. 設計區 Tab 名稱為「寫實化」，說明含「產品圖稿／示意圖」  
2. 廠商原型／配件按鈕為「寫實化」  
3. 扣點統計／點數規則顯示「寫實化」  
4. 材料 tab **無**此按鈕  
