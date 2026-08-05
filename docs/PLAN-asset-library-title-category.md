# 數位資產庫：材料組合／印花 — 名稱與分類

> 更新日期：2026-08-05  
> 用途：資料變多時可依名稱整理、依分類篩選。

## 1. 資料欄位

| 表 | 名稱 | 分類 |
|----|------|------|
| `user_material_combo_generations` | `title`（既有） | `category`（新增） |
| `user_print_generations` | `title`（既有） | `category`（新增） |

- `category`：使用者**自由文字**（非產品 taxonomy），最長 64。  
- Migration（已有表）：`docs/add-user-asset-library-category.sql`  
- 全新建表：已寫入 `add-user-material-combo-generations.sql`／`add-user-print-generations.sql`

## 2. API

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/me/material-combo-generations?category=` | 可篩選；回傳 `categories[]` |
| PATCH | `/api/me/material-combo-generations/:id` | `{ title?, category? }` |
| GET | `/api/me/print-generations?category=` | 同上 |
| PATCH | `/api/me/print-generations/:id` | 同上 |
| POST | 印花存庫／材料組合生成 | 可帶 `title`、`category` |

## 3. 前端

| 頁面 | 行為 |
|------|------|
| `/client/my-custom-products.html` | 卡片「名稱／分類」編輯；TAB 頂部分類篩選 |
| `/client/print-asset.html` | 存庫前可填名稱／分類 |
| `/client/material-dual-color.html` | 生成前可填存庫名稱／分類 |
| `digital-asset-picker.js` | 標題旁顯示分類（若有） |

build：`asset-library-title-category-20260805`

## 4. 上線前必做

在 Supabase SQL Editor 執行：

```sql
-- 內容見 docs/add-user-asset-library-category.sql
```

未執行時：列表仍可用（fallback 無 category）；PATCH／帶分類寫入會提示執行該 SQL。
