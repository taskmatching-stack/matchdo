# 修改進度：媒體牆 lightbox ＋ FLUX ＋ 產品設計頁

更新：2026-02-06

---

## 1. 媒體牆「先放大再連結」— **已完成**

### 已修改檔案
- **`public/iStudio-1.0.0/index.html`**

### 實作內容
- **Lightbox 彈窗**：新增 `#media-wall-lightbox` Bootstrap modal（標題、內容區、footer 有「前往連結」「關閉」）。
- **點擊行為**：卡片連結改為 `href="#"`，點擊時 `preventDefault()`，不再直接跳轉。
- **資料**：每個 `.media-wall-item` 設 `data-item`（JSON：type, title, link, image_url, image_url_before, cover_image_url）。
- **事件**：在 `#media-wall-grid` 上做 click 委派，點到 `a.media-wall-card-link` 時：
  - 讀取 `data-item`
  - 依 type 組 lightbox 內容（一般卡：單圖；對比卡：兩圖＋滑桿）
  - 寫入 modal 標題、body、前往連結 href，再 `modal.show()`。
- **對比卡**：lightbox 內對比區有獨立滑桿（range + mousedown 即時定位）。

### 建議自測
- 首頁媒體牆任一點擊 → 應先彈出放大圖／對比滑桿，再按「前往連結」才跳轉。

---

## 2. FLUX 2.0 PRO API ＋ 文字描述與參考圖 — **已完成**

### 參考圖數量（BFL 文件）
- **FLUX 2.0 [pro]**：API 最多 **8 張參考圖**（`input_image` ＋ `input_image_2` … `input_image_8`）。  
- 文件：<https://docs.bfl.ai/flux_2/flux2_image_editing>

### 已修改檔案

| 檔案 | 修改摘要 |
|------|----------|
| **server.js** | 新增 `generateImageWithFlux2Pro(prompt, referenceImages)`：送 BFL `POST https://api.bfl.ai/v1/flux-2-pro`，body 含 prompt、input_image（必填）、input_image_2..8（選填）；輪詢 `polling_url` 取結果；回傳 PNG buffer。`POST /api/generate-product-image`：若有 `referenceImages` 且 `BFL_API_KEY` 存在則先走 FLUX，失敗再 fallback Gemini；response 含 `usedFlux`。 |
| **public/js/custom-product.js** | 文字描述：`#productPrompt`。參考圖：`#referenceImages`（file input multiple）、最多 8 張、`#referenceImagesPreview` 預覽。送出時將參考圖轉成 dataURL 陣列放進 `payload.referenceImages`。成功時顯示「FLUX 2.0 PRO」或「Gemini」。 |
| **public/iStudio-1.0.0/js/custom-product.js** | 同上（iStudio 版客製產品頁用）。 |
| **public/custom-product.html** | `#generateSection` 內：文字描述 textarea、**參考圖片（選填，FLUX 2.0 最多 8 張）** file input、`#referenceImagesPreview`、說明文案。 |
| **public/iStudio-1.0.0/custom-product.html** | 同上。 |

### 環境
- `.env` 需有 **`BFL_API_KEY`**（BFL 後台取得）。  
- 無 key 或未上傳參考圖時，仍用 **Gemini** 純文字生圖。

### 建議自測
- 客製產品頁 → 選「AI 生成」→ 輸入描述、上傳 1～8 張參考圖 → 點「生成示意圖」→ 應呼叫 FLUX（有 key 時）且回傳圖；無參考圖時仍走 Gemini。

---

## 3. 產品設計頁（custom-product.html）— **已完成**

### 文案與標題
- 頁面標題／H1：**「客製產品媒合」→「產品設計」**
- 副標：**「用 AI 產出設計草圖，或上傳參考圖進行媒合」**
- 區塊標題：**「產品示意圖」→「產品設計草圖」**
- 按鈕：「生成示意圖」→「生成草圖」

### 產品類別（與 /admin/custom-categories.html 同源）
- 下拉選單由 **`GET /api/custom-product-categories`** 載入。
- 結構：**主分類 + 子分類**（optgroup = 主分類，option = 主分類本身與其子分類）。
- 後台在 `/admin/custom-categories.html` 新增／編輯的主分類與子分類，會同步顯示在此下拉。

### UI 簡化與設計
- **區塊化**：分為「產品設計草圖」「產品資訊」兩塊 `.form-section`（圓角、邊框、淺灰／白底）。
- **標籤**：`.section-label` 小字、大寫、字距，減少視覺干擾。
- **精簡**：移除多餘說明、合併預算為一行兩格、表單改為 `form-control-sm`。
- **按鈕**：上傳／AI 生成用 `.btn-method`，送出用 `.submit-btn`（圓角、字重）。

### 已修改檔案
- **`public/custom-product.html`**：標題、副標、區塊標題、表單結構、inline style、產品類別僅保留「請選擇...」由 JS 填入。
- **`public/iStudio-1.0.0/custom-product.html`**：同上。
- **`public/js/custom-product.js`**：開頭 `loadCategories()` 呼叫 `/api/custom-product-categories`，組 optgroup/option 填入 `#productCategory`；`.btn-method` 的 active 狀態。
- **`public/iStudio-1.0.0/js/custom-product.js`**：同上。

### 建議自測
- 開啟 `/custom-product.html` 或 iStudio 版 → 標題應為「產品設計」、區塊為「產品設計草圖」。
- 產品類別下拉應有主分類（群組）與子分類（與後台一致）；若 API 失敗會顯示「其他」。

---

## 4. 若當機／中斷後要接續

- **媒體牆**：無未完成項，僅需確認首頁載入與 lightbox 點擊正常。
- **FLUX**：後端與兩邊前端（public + iStudio）皆已接好；若曾當機，多半是執行時錯誤（例如 BFL 輪詢逾時、key 錯誤），可查 server 日誌或加上 try/catch 把錯誤回傳給前端顯示。
- **產品設計頁**：HTML 與 JS 已改完，產品類別由 API 載入；若當機前已存檔，無需重做。

---

## 5. 快速檢查清單

- [ ] 首頁媒體牆點卡片 → 先彈出 lightbox，再按「前往連結」才跳轉。
- [ ] 客製產品頁有「參考圖片（選填，FLUX 2.0 最多 8 張）」與預覽。
- [ ] `.env` 設好 `BFL_API_KEY`，上傳 1 張以上參考圖＋描述送出 → 應走 FLUX（可從 response `usedFlux: true` 或 UI 文案確認）。
- [ ] 未上傳參考圖 → 仍為 Gemini 生圖，行為不變。
- [ ] `/custom-product.html` 標題為「產品設計」、區塊為「產品設計草圖」、UI 為簡化版兩區塊。
- [ ] 產品類別下拉由 API 載入，有主分類群組與子分類（與後台訂製品分類一致）。
