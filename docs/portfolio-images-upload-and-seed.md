# 範例圖上傳雲端與種子資料

**前提**：圖已改為存於雲端（Supabase Storage），不再用本機路徑。

## 流程

1. **你**：依分類架構建好本機資料夾，把範例圖放進去。
2. **腳本**：讀取該資料夾 → **每張圖上傳到 Supabase Storage（雲端）** → 取得 public URL → 寫入 DB 種子資料（`manufacturer_portfolio` 等）。

## 本機資料夾結構（約定）

請依「訂製品主分類 key」建一層資料夾，底下直接放圖檔：

```
{專案根目錄}/docs/portfolio-images/   （或你指定的路徑）
├── formal_wear/
│   ├── 01.jpg
│   └── 02.png
├── sports_gear/
│   └── 01.jpg
├── luxury_bags/
│   ├── 01.jpg
│   └── 02.jpg
└── ...
```

- **第一層資料夾名稱** = `custom_product_categories.key`（如 `formal_wear`, `sports_gear`, `luxury_bags`）。
- **檔名**隨意，腳本會上傳並用檔名當作品標題（可再改）。

上傳到雲端後的路徑為：`custom-products/portfolio/{category_key}/{檔名}`，對應的 URL 會寫進 DB。

## 腳本

- **檔名**：`scripts/upload-portfolio-images-and-seed.js`
- **執行**：在專案根目錄  
  `node scripts/upload-portfolio-images-and-seed.js [本機資料夾路徑]`  
  未傳路徑時，預設為 `docs/portfolio-images`。
- **環境變數**：`.env` 需有 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`（上傳與寫入用）。

## 腳本會做的事

1. 掃描你給的本機資料夾（一層 = 分類 key）。
2. **每張圖上傳到 Supabase Storage**（bucket: `custom-products`，路徑: `portfolio/{category_key}/{檔名}`）。
3. 取得每張圖的 **雲端 public URL**。
4. 若沒有「示範廠商」則建立一筆，並把該廠商的 `categories` 設為有圖的分類。
5. 依序寫入 `manufacturer_portfolio`：`manufacturer_id`、`title`（由檔名來）、`image_url`（雲端 URL）、`tags`（含該分類 key）、`sort_order`。

完成後，圖都在雲端，圖庫／列表會用這些 URL 顯示。
