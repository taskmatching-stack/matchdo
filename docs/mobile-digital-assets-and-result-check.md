# 手機版「數位資產看不到圖」與「生成圖看不到」檢查報告（不寫程式）

## 一、數位資產在手機版看不到圖

### 結構

- 頁面裡**只有一個**數位資產區：`#pastGeneratedGallery`（class `past-gallery`）。
- 它放在 `.create-panel-right` 裡，結構是：
  - `#generatedImagePreviewWrap`（.create-panel-right）
    - `#generatedImagePreview`（生成結果區）
    - `#pastGeneratedGallery`（數位資產／歷史縮圖）
    - `#generatedImagePlaceholder`（佔位文字）

### 手機版 CSS（custom-product.html 約 188–190 行）

```css
/* 畫布內的資產庫在手機版隱藏（避免撐高），改由下方獨立顯示 */
#custom-product .create-panel-right #pastGeneratedGallery {
    display: none !important;
}
```

- 在 `@media (max-width: 768px)` 裡，**刻意把「畫布內」的數位資產隱藏**。
- 註解寫「改由下方獨立顯示」，表示設計上打算在**別的地方**再顯示一份數位資產。

### 實際狀況

- **整份 HTML 裡沒有第二個數位資產區**，沒有「下方獨立顯示」用的區塊。
- JS 只會把內容填進同一個 `#pastGeneratedGallery`（例如 `refreshPastGeneratedGallery()`、`addGeneratedThumbnailToGallery()` 等）。
- 因此：
  - 手機版：這塊被 `display: none !important` 藏起來 → **數位資產在畫面上完全看不到**。
  - 資料有寫進 DOM，只是被 CSS 隱藏，不是沒資料。

### 小結（數位資產）

| 項目 | 說明 |
|------|------|
| 原因 | 手機版用 CSS 把唯一的 `#pastGeneratedGallery` 隱藏，且沒有「下方獨立顯示」的對應區塊。 |
| 結果 | 手機上無法在數位資產區看到任何圖。 |

---

## 二、生成圖在手機版看不到

### 成功後畫面上會出現什麼

- JS 在生成成功時，只會把**文字 + 按鈕**塞進 `#generatedImagePreview`，例如：
  - 「已生成並儲存，重整後仍會保留在右側歷史」
  - 「重新生成」按鈕
- **沒有把「剛生成的那張圖」插進預覽區**，所以 `#generatedImagePreview` 裡不會有 `<img>`。
- 新圖會經由 `addGeneratedThumbnailToGallery()` 被加進 `#pastGeneratedGallery` 的縮圖列表。

### 和手機版數位資產的關係

- 桌機：數位資產區是顯示的，所以使用者至少能在右側看到剛生成的縮圖。
- 手機：數位資產區被藏起來（見上一節），所以：
  - 預覽區沒有圖（程式本來就沒放），
  - 數位資產區又被隱藏，
  - 結果就是**生成成功後在手機上完全看不到那張圖**。

### 小結（生成圖）

| 項目 | 說明 |
|------|------|
| 原因 1 | 成功時沒有在 `#generatedImagePreview` 裡插入生成圖的 `<img>`，預覽區本來就只顯示文字與按鈕。 |
| 原因 2 | 手機版把唯一會顯示縮圖的 `#pastGeneratedGallery` 隱藏，所以也無法從數位資產區看到剛生成的圖。 |
| 結果 | 手機上「全部按完」後仍看不到生成圖。 |

---

## 三、生成失敗時的行為（為什麼「失敗也沒有圖」）

### 失敗時程式做了什麼

- **生成失敗**（非 200 成功、或 402 點數不足、或 catch 網路/解析錯誤）時，程式**不會**放任何圖（失敗本來就沒有圖可顯示），但**會**把錯誤區塊寫入 `#generatedImagePreview`，例如：
  - 402：`alert alert-warning` + 「點數不足」+ 購買/升級按鈕
  - 其他錯誤：`alert alert-danger` + 「生成失敗」+ `result.error` + 重試按鈕
  - catch：`alert alert-warning` + 「API 未正確回應」或「網路連線失敗」+ 重試按鈕  
（見 `custom-product.js` 約 401–441 行。）

### 為什麼手機上可能「失敗也像沒有東西」

- 失敗時**沒有圖是正常**的；但理論上應該會看到**錯誤訊息與按鈕**。
- 手機版 `.create-panel-right` 的樣式是：
  - `width: min(55vw, 240px)`、`aspect-ratio: 1`（固定 1:1 小方塊）
  - `overflow: hidden !important`（約 186 行）
- 若錯誤區塊（標題 + 內文 + 按鈕）高度超過這個小方塊，**多出來的會被裁掉**，使用者可能只看到一小塊或空白，感覺「失敗也沒有圖／沒有內容」。
- 結論：**失敗沒有圖是預期**；若連錯誤訊息都看不到，很可能是手機版結果區 **overflow: hidden + 固定高度** 導致錯誤區塊被裁掉。

---

## 四、整理：兩問題的關係

- **數位資產看不到圖**：純粹是**版型／CSS** — 手機版隱藏了唯一的數位資產區，且沒有實作「下方獨立顯示」。
- **生成圖看不到**：  
  - **內容**：成功時沒在預覽區放圖；  
  - **版型**：手機又看不到數位資產區。  
兩者加起來，手機上就完全看不到圖。
- **生成失敗沒有圖**：失敗時本來就不會有圖；但錯誤訊息會寫進 `#generatedImagePreview`。若手機上連錯誤訊息都看不到，多半是結果區 `overflow: hidden` + 固定 1:1 高度把錯誤區塊裁掉。

若要修復，方向會是（僅列方向，不寫程式）：

1. **數位資產**：在手機版要嘛取消隱藏 `#pastGeneratedGallery`（並調整版面避免撐高），要嘛在「下方」新增一個區塊專門在手機顯示數位資產，並讓 JS 把同一份內容填到那裡或改寫入該區塊。
2. **生成圖**：成功時在 `#generatedImagePreview` 裡插入當次生成圖的 `<img>`，讓預覽區直接顯示圖；和數位資產是否隱藏無關，至少預覽區會有一張圖可看。
3. **失敗時錯誤訊息**：手機版結果區可考慮改為 `overflow: auto`（或取消固定 aspect-ratio），讓錯誤區塊完整顯示、可捲動，避免被裁掉。

以上為先不寫程式、只做檢查與說明的結論。
