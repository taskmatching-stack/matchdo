# 進度：寫實化（Photorealize）

**最後更新：** 2026-07-12  
**狀態：** 已實作（對外名稱：寫實化）  
**點數：** 固定 **20 點／次**（`points_design_to_physical`，預設 20；後台「會員／點數規則」可調）

## 一句話

將**產品圖稿／示意圖**寫實化（FLUX img2img）。  
Prompt（鎖定）：`將圖樣轉為實體寫實產品，圖樣、結構和顏色要完全一致。若原圖有尺寸標註，須嚴格顯示原標註之尺寸數字與單位，不得新增、刪除或改寫任何尺寸`

## 品質提醒（必讀）

**本機原稿重傳後再寫實化，通常比對「已上架圖」再跑效果好。**

| 路徑 | 送進 FLUX 的圖 | 品質 |
|------|----------------|------|
| **待傳／本機上傳後立刻寫實化** | 瀏覽器原檔直送（`preview-design-to-physical`，不做 `normalizeVendorUploadFile`） | 較佳 |
| **編輯已上架圖庫寫實化** | 先抓 Storage URL（上傳時可能已縮至 ≤1024、JPEG q88） | 易偏色、細節較軟 |
| **對已寫實化結果再寫實化** | 二次改寫 | 通常更差，勿疊跑 |

實務建議：保留電腦上的圖稿原稿；若已上架圖寫實化不理想，**用原稿重新加入待傳清單再按寫實化**，不要只對庫內壓縮圖反覆重跑。

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
| Prompt／SEED | 固定保真底稿 + 使用者自訂補充（不自動帶產品名）；SEED `3647440197`；模型由後台 `bfl_flux_model_design_to_physical` 設定（預設 `flux-2-pro`）；原圖直送；`safety_tolerance=2` |
| 執行 | `runDesignToPhysicalFlux` |
| 設計區 API | `POST /api/design-to-physical` |
| 廠商預覽 | `POST /api/me/vendor-assets/preview-design-to-physical` |
| 圖庫追加 | `POST /api/me/vendor-assets/:id/gallery-images/design-to-physical` |
| 模型 | 後台 `bfl_flux_model_design_to_physical`（預設 `flux-2-pro`；獨立槽，勿併入產品重繪） |
| `ai_derived` | `design_to_physical` |

## 前端

| 入口 | 說明 |
|------|------|
| 設計區 Tab「寫實化」 | 本機／數位資產選圖；下載；可加入數位原型參考 |
| 廠商素材庫 | 僅 **prototype／part**；按鈕文案「寫實化」 |
| i18n | zh：寫實化；en：Photorealize；品質提醒見 `designToPhysicalHint`／確認框 |

## 驗收

1. 設計區 Tab 名稱為「寫實化」，說明含「產品圖稿／示意圖」  
2. 廠商原型／配件按鈕為「寫實化」  
3. 扣點統計／點數規則顯示「寫實化」  
4. 材料 tab **無**此按鈕  
5. 文件／文案有提醒：重傳本機原稿再寫實化通常較佳  
