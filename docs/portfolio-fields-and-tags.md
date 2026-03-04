# 廠商作品欄位：顯示位置與標籤搜尋

## 1. 語系（英文版仍出現中文）

- **已處理**：「前、後各一張。」、主／子分類選單預設選項等已加語系鍵；表單標籤／按鈕／placeholder 有鍵者會依語系切換。
- **無法改的**：「選擇檔案」「未選擇任何檔案」為瀏覽器 `<input type="file">` 內建文字，無法用本站 i18n 覆蓋。

---

## 2. 實際有寫的顯示（依程式碼對照）

以下依 **gallery.html**、**vendor-profile.html** 與後端 **getGalleryComparisonItems** 實際實作整理，不是「規劃」而是「已上線行為」。

### 圖庫 (public/custom/gallery.html)

- **列表卡片**（`renderGrid`）：只顯示 **一張圖**（`p.image_url`）、**作品名稱**、**廠商名**、**地區**、**標籤（前 3 個）**。  
  - 列表**沒有**前／後對照、沒有作品亮點、沒有描述。
- **彈窗**（`openModal`）：**一張圖**（`p.image_url`）、**作品名稱**、**描述**（`p.description`）、**作品亮點**（`p.design_highlight`）、廠商、地區、聯絡、**標籤**。  
  - 彈窗**沒有**前／後兩張圖並排，只有單一主圖。
- **篩選**：關鍵字搜 **標題 + 廠商名 + 地區 + 標籤**；大分類／小分類依 API 回傳的 `category_key`、`subcategory_key`／`tags` 等（圖庫 API 目前只回傳 `category_key`，小分類會用 `tags` 比對）。

### 廠商詳情頁 (public/vendor-profile.html) 作品集

- **作品卡**：有 **對照圖（前／後）**（`p.image_url_before` + `p.image_url`）或僅主圖、**作品名稱**、**作品亮點**（`p.design_highlight`）、**標籤**。  
  - 卡片上**沒有**顯示「作品描述」。

### 後端 API（圖庫用）

- **getGalleryComparisonItems**（server.js）從 `manufacturer_portfolio` 取：  
  `id, manufacturer_id, title, image_url, image_url_before, design_highlight, tags, description, category_key`，再組廠商名／地區／聯絡等。  
- 圖庫列表／彈窗用的就是上述欄位；**沒有**用「系列圖多張」（`series_image_urls`），只用到一張主圖 + 一張前圖（廠商詳情頁才用前／後並排）。

### 靈感牆（首頁 media wall：`public/iStudio-1.0.0/index.html`，資料來自 `GET /api/media-wall`）

- **對比圖**（`type === 'comparison'`，來自 `manufacturer_portfolio`，`show_on_media_wall = true`）  
  - **卡片**：前／後圖（滑桿對照）、**作品名稱**（overlay）。  
  - **Lightbox**：前／後滑桿、標題、**作品亮點**、**標籤**、**描述**（有值才顯示）、按鈕（查看廠商、再設計等）。

- **作品集／系列**（`type === 'collection'`，來自 `media_collections`）  
  - **卡片**：1×2 格、兩張圖（`cover_image_url` 或 `image_urls` 前兩張）、**標題**。  
  - **Lightbox**：多張圖（`image_urls` 最多 20 張）、標題、**描述**（資料夾說明，有值才顯示）。

實作：`GET /api/media-wall` 對比圖回傳 `design_highlight, tags, description`；`public/iStudio-1.0.0/index.html` lightbox 內 `#media-wall-lightbox-detail-portfolio` 顯示上述欄位。

---

### 總結對照

| 欄位         | 圖庫列表 | 圖庫彈窗 | 廠商詳情頁作品集 | 靈感牆對比圖 | 靈感牆作品集 |
|--------------|----------|----------|------------------|--------------|--------------|
| 主圖 (image_url) | ✓ 一張   | ✓ 一張   | ✓（或與前圖並排） | ✓（滑桿「後」） | —            |
| 前圖 (image_url_before) | ✗ | ✗ | ✓ 與後圖並排 | ✓（滑桿「前」） | —            |
| 作品名稱     | ✓        | ✓        | ✓                | ✓            | ✓（資料夾標題） |
| 作品亮點     | ✗        | ✓        | ✓                | ✓ Lightbox   | ✗            |
| 作品描述     | ✗        | ✓        | ✗                | ✓ Lightbox   | ✓ Lightbox   |
| 標籤         | ✓ 前 3 個 | ✓ 全部   | ✓                | ✓ Lightbox   | ✗            |
| 分類         | 篩選用   | —        | —                | 篩選用       | 篩選用       |

- **圖庫**：列表／彈窗都沒有前／後並排，只有單一主圖；前／後並排在**廠商詳情頁**作品集才有。  
- **靈感牆**：對比圖 lightbox 已顯示作品亮點、標籤、描述；作品集 lightbox 已顯示描述（資料夾說明）。

---

## 3. 標籤作用與搜尋

- **作用**：圖庫卡片／彈窗、廠商詳情頁作品卡顯示標籤，方便辨識風格或類型。
- **搜尋**：圖庫關鍵字**已實作**搜「標題 + 廠商名 + 地區 + 標籤」（`gallery.html` 內 `applyFilters`）。
- **只點一個標籤就篩選**：不做；版面會太雜，改用關鍵字搜尋即可。
