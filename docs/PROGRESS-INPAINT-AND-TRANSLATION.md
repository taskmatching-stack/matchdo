# 進度紀錄：內部補繪 (Inpaint) 與翻譯／文件

**最後更新：** 2026-02-25  
**狀態：** 已完成。前台內部補繪「開始生成」已接線；後台 AI 工具已加入內部補繪。

---

## 一、已完成項目

### 1. 文件 (docs/ai-edit-area-plan.md)
- 新增 **「〇、Prompt 翻譯（Gemini）」**：說明所有送 Stability 的 prompt 會先經 Gemini 翻譯；對話介面或未來送 prompt 的介面都應在後端先翻譯。
- 功能清單已更新：Erase 20 點 ✅、**Inpaint 20 點 ✅**，並標註「已有 API，前台/後台入口同編輯區」。

### 2. 後端 (server.js)
- **點數設定**
  - `GET/PATCH /api/admin/points-config` 已包含 `points_ai_inpaint`（預設 20）。
  - `getPointsAIInpaint()` 已實作（讀取 `payment_config.points_ai_inpaint`，預設 20）。
- **POST /api/inpaint-image**
  - 路徑：`upload.fields([{ name: 'image', maxCount: 1 }, { name: 'mask', maxCount: 1 }])`，body：`prompt`, `negative_prompt`, `seed`, `output_format`。
  - 使用 `translatePromptAndNegativeToEnglish(prompt, negativePrompt)` 翻譯後再送 Stability。
  - 呼叫 `https://api.stability.ai/v2beta/stable-image/edit/inpaint`，成功後依 `getPointsAIInpaint()` 扣點（管理員不扣），回傳 `imageData`、`output_format`。
  - 錯誤處理：502、402 點數不足、500。

### 3. 後台會員／點數 (public/admin/membership.html)
- 點數規則表單已含 **「內部補繪」** 欄位：`points_ai_inpaint`，說明「點/次（編輯類，原圖+遮罩+prompt，預設 20）」。

### 4. 前台 AI 編輯區 (client/ai-edit.html) — 已完成
- 左側工具列已有 **「內部補繪」**（`data-tool="inpaint"`）。
- **settingsInpaint** 區塊：原圖上傳、遮罩畫布、prompt／negative_prompt、seed、output_format、**開始生成按鈕** 已接線。
- 已實作：`inpaintUpdateButton`、`inpaintClearMask`、`inpaintInitMaskPaint`、`inpaintGetMaskBlob`、`inpaintSetupDrawing`、`setInpaintImageFile`，以及 `btnInpaint` 點擊呼叫 `POST /api/inpaint-image`，402 導向 /credits.html，成功顯示「內部補繪 生成結果」、下載 `matchdo-inpaint.{output_format}`。

### 5. 後台 AI 工具 (public/admin/ai-tools.html) — 已完成
- 工具列已新增 **「內部補繪」**（`data-tool="inpaint"`）。
- 已新增 **settingsInpaint** 區塊：原圖上傳、遮罩畫布、prompt、negative_prompt、seed、output_format、開始生成按鈕。
- 工具切換與 reset 已含 inpaint；開始生成送 `POST /api/inpaint-image`，管理員不扣點，結果下載為 `admin-inpaint.{output_format}`。

---

## 二、待完成項目（可選）

### 1. （可選）GET /api/points-info
- 若前台需要顯示「內部補繪 20 點」等字樣且依後端設定，可讓 `GET /api/points-info` 一併回傳 `points_ai_inpaint`（目前該 API 主要回傳 `points_listing_per_category`）。非必須，若點數說明寫死 20 點也可先不做。

---

## 三、關鍵檔案與符號一覽

| 項目 | 位置 |
|------|------|
| Inpaint API | `server.js`：`POST /api/inpaint-image`（約 3825–3934 行） |
| 點數讀取 | `server.js`：`getPointsAIInpaint()`（約 3817–3822 行） |
| 點數 key | `payment_config.points_ai_inpaint`，預設 20 |
| 翻譯 | `translatePromptAndNegativeToEnglish` 已在 inpaint 路由內呼叫 |
| 前台 Inpaint UI | `client/ai-edit.html`：`#settingsInpaint`、`#btnInpaint`、inpaint* 變數（約 188–244、854–875、1459–1466 行） |
| 前台 Erase 參考 | `client/ai-edit.html`：`btnErase`、`eraseGetMaskBlob`、`eraseUpdateButton`、erase 上傳與畫布初始化（約 1367–1430、876–925） |
| 後台點數表單 | `public/admin/membership.html`：`points_ai_inpaint` 欄位（約 328 行） |
| 後台 AI 工具 | `public/admin/ai-tools.html`：已含 inpaint 工具、settingsInpaint、fetch `/api/inpaint-image` |
| 文件 | `docs/ai-edit-area-plan.md`：〇 翻譯、二 功能清單 Inpaint ✅ |

---

## 四、Stability API 參考
- Inpaint：`POST https://api.stability.ai/v2beta/stable-image/edit/inpaint`
- Body（multipart）：`image`、`mask`、`prompt`、選填 `negative_prompt`、`seed`、`output_format`（如 jpeg/png/webp）
- 文件：https://platform.stability.ai/docs/api-reference#tag/Edit/paths/~1v2beta~1stable-image~1edit~1inpaint/post

---

（前台與後台 Inpaint 接線已完成；可選項目見「二、待完成項目（可選）」。）
