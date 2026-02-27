# 測試首頁動態欄位顯示

## 問題診斷步驟

### 1. 確認資料庫已執行 SQL
確保已執行以下 SQL 腳本：
```bash
# 在 Supabase SQL Editor 執行
執行: docs/seed-home-subcategory-fields.sql
```

### 2. 驗證資料庫數據
在 Supabase SQL Editor 執行：
```sql
-- 檢查居家分類的子分類是否有 form_config
SELECT 
    name AS "子分類名稱",
    jsonb_array_length(form_config) AS "欄位數量",
    form_config
FROM public.ai_subcategories
WHERE category_key = 'home'
ORDER BY sort_order;
```

### 3. 測試 API 端點
在瀏覽器 Console 執行：
```javascript
// 測試 API 是否返回正確數據
fetch('/api/subcategories?category_key=home')
  .then(res => res.json())
  .then(data => console.log('API 返回:', data));
```

### 4. 檢查前端 Console
1. 打開 http://localhost:3000/iStudio-1.0.0/index.html
2. 按 F12 打開開發者工具
3. 選擇「居家」大分類
4. 觀察 Console 輸出：
   - 🔍 loadDynamicFields 被調用
   - 📡 API 請求
   - 📥 API 返回
   - 🔎 查找子分類
   - ✅ 有 X 個欄位
   - 📝 準備渲染欄位
   - ✅ 欄位渲染完成

### 5. 常見問題

#### 問題 1: API 返回 success: false
**解決**：執行 `docs/seed-home-subcategory-fields.sql`

#### 問題 2: API 返回 subcategories: []
**解決**：檢查 `ai_subcategories` 表是否有數據
```sql
SELECT COUNT(*) FROM public.ai_subcategories WHERE category_key = 'home';
```

#### 問題 3: form_config 是空陣列
**解決**：重新執行 `docs/seed-home-subcategory-fields.sql`

#### 問題 4: 頁面沒有任何反應
**解決**：
- 檢查 jQuery 是否正確載入
- 檢查是否有 JavaScript 錯誤
- 確認 `#dynamicFields` div 存在於頁面中

## 手動測試步驟

1. 重啟伺服器
2. 清除瀏覽器快取（Ctrl+Shift+Delete）
3. 開啟首頁：http://localhost:3000/iStudio-1.0.0/index.html
4. 打開 Console（F12）
5. 選擇「居家」大分類
6. 選擇「清潔服務」子分類
7. 應該看到 3 個欄位：
   - 施作坪數 (坪) *
   - 清潔類型 *
   - 樓層與電梯 *

## 完成後確認

- [ ] Console 沒有錯誤
- [ ] API 返回正確數據
- [ ] 動態欄位正確顯示
- [ ] 必填標示 (*) 正確
- [ ] 下拉選單選項正確
