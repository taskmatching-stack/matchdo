# 客製產品「歷史生成的圖」儲存位置與驗證

## 存到哪裡？

- **資料庫**：Supabase 專案裡的 **`public.custom_products`** 表。
- **寫入時機**：
  1. **自動儲存**：生成圖片成功且已登入時，前端會呼叫 `POST /api/custom-products`，後端依 JWT 取得 `owner_id`，寫入一筆新列。
  2. **手動儲存**：你按「儲存為我的訂製產品」時，同樣呼叫 `POST /api/custom-products`，寫入一筆。
- **主要欄位**：`owner_id`（你的 auth 用戶 UUID）、`title`、`description`、`ai_generated_image_url`、`generation_prompt`、`analysis_json`（含 seed）、`status`、`created_at`。

## 右側「該帳號歷史生成的圖」從哪來？

- **唯一來源**：後端 **`GET /api/custom-products`**（依你登入的 token 查出 `owner_id`，再從 `custom_products` 表篩選該使用者的列）。
- **沒有假資料**：若 DB 裡沒有任何一筆你的資料，API 就回傳空陣列，畫面上就是「尚無歷史生成的圖」。
- **剛生成完當下看到的縮圖**：是當次 session 前端暫存的縮圖（data URL），**還沒寫入 DB**。要等「自動儲存成功」或「手動儲存成功」後，那一筆才會進 DB；重整後才會從 API 載入並顯示在右側。若儲存一直失敗，重整後就不會出現。

## 如何確認 DB 有沒有資料？

1. **Supabase 後台**  
   - 登入 Supabase → 選專案 → **Table Editor** → 選 **`custom_products`**。  
   - 看是否有列，以及 `owner_id` 是否為你的用戶 UUID（可從 Auth → Users 對照）。

2. **用 API 查筆數（已登入時）**  
   - 瀏覽器 F12 → Console，在產品設計頁執行（會帶你目前的登入 token）：  
     ```js
   fetch('/api/custom-products?summary=1', { headers: { 'Authorization': 'Bearer ' + (await (await window.AuthService.getSession()).access_token) } }).then(r=>r.json()).then(d=>console.log('DB 筆數:', d.count, 'hasItems:', d.hasItems, d))
     ```  
   - 若 `count === 0`，代表 DB 裡目前沒有任何一筆你的客製產品，所以右側會是「尚無歷史生成的圖」。

## 結論

- 資料**只**存在 **Supabase `custom_products`**；右側歷史圖**只**來自這張表。
- 若畫面上一直「尚無歷史生成的圖」且重整後也一樣，代表**沒有任何一筆寫入成功**（自動儲存或手動儲存曾失敗）。可依上面方式查 DB 或 API 筆數確認。
