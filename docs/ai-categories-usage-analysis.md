# ai_categories 使用情況分析

## 使用位置

### 1. 專家報價／媒合系統（Expert Listings / Matching）
- `/api/pre-match` （第 29759 行）
- `/api/expert/run-split-matchmaker` （第 29984 行）  
- `/api/expert/match-one-by-one` （第 28964 行）
- `/api/expert-listings/:id/match-project` （第 29239 行）

**用途**：分類名稱→key 對照，用於媒合專家與專案

### 2. API 端點
- `GET /api/categories` （第 9060 行）— 取得分類清單
- `PUT /api/categories` （第 9481 行）— 更新分類
- `POST /api/categories/import-default` （第 9430 行）— 匯入預設分類
- `POST /api/debug/bootstrap-ai-categories-from-default` （第 9616 行）

### 3. 啟動函數
- `bootstrapCategories()` （第 8627 行）— 啟動時自動匯入預設分類
- `ensureAiCategoriesTableAndSeed()` （第 4163 行）— 建立表並種子資料

### 4. 其他功能
- `resolvePublicCategoryLabels()` （第 865 行）— SEO 用分類標籤
- `/api/system-info` （第 9578 行）— 系統健康檢查

---

## 問題診斷

**`ai_categories` = 服務類分類系統**（居家、寵物、美容、商務等），用於：
- 專家報價媒合（Expert Listings）
- 舊版的 AI 估價系統

**`custom_product_categories` = 訂製品分類系統**（您目前使用的正確分類）

---

## 決策選項

### 選項 A：完全移除 `ai_categories`（如果不用專家報價）
**條件**：您的網站**不提供**專家報價媒合功能

**需移除**：
- 所有專家報價相關 API
- `ai_categories` / `ai_subcategories` 相關代碼
- `public/config/default-categories.json`

### 選項 B：保留但清空資料（如果功能未來可能用）
**條件**：保留程式碼架構，但清空錯誤的服務類分類

**執行**：
```sql
TRUNCATE TABLE public.ai_categories CASCADE;
```

### 選項 C：改用 `custom_product_categories`（重構）
**條件**：專家報價功能改為使用訂製品分類

**需重構**：所有專家報價 API 改查 `custom_product_categories`

---

## 建議

**請告訴我**：您的網站有沒有使用「專家報價媒合」功能？

1. **有**：那些專家會在什麼分類下報價？（訂製品分類嗎？）
2. **沒有**：我會幫您完全移除 `ai_categories` 相關代碼

**或者直接告訴我**：
- 想要「完全移除」（選項 A）
- 想要「保留程式碼但清空資料」（選項 B）
- 想要「改用訂製品分類」（選項 C）
