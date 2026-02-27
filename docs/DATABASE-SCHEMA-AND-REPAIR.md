# 資料庫結構與同步修復說明

## 1. 問題來源（檢查結果）

- **projects 表**（`docs/projects-schema.sql`）建立時**沒有** `total_items`、`published_items` 欄位。
- **project_items 表**（`docs/project-items-schema.sql`）建立時會：
  - 在一個 DO 區塊裡**嘗試**對已存在的 `projects` 加上 `total_items`、`published_items`；
  - 建立觸發器 `update_project_items_count_trigger`：每次對 `project_items` 做 INSERT/UPDATE/DELETE 時，會執行 `UPDATE projects SET total_items = ..., published_items = ...`。

若實際執行順序或只跑了部分腳本，可能出現：

- `projects` 沒有 `total_items` / `published_items`，
- 但 `project_items` 上的觸發器已存在，

結果是：對 `project_items` 做 INSERT 時觸發器會去更新 `projects.total_items`，欄位不存在就報錯，**同步／分包就會失敗**。

## 2. 修復方式（不再依賴手動執行 SQL）

後端改為**自動修復**，不再要求使用者在 Supabase 手動執行 SQL：

1. **修復邏輯**：移除會去改 `projects.total_items` 的觸發器 `update_project_items_count_trigger`。  
   移除後，`project_items` 的 INSERT/UPDATE/DELETE 不再依賴 `projects` 是否有這兩個欄位，同步即可正常。

2. **何時執行修復**：
   - **後端啟動時**：若在 `.env` 有設定 `SUPABASE_DB_URL`，啟動時會執行一次 `DROP TRIGGER IF EXISTS update_project_items_count_trigger ON public.project_items;`。
   - **同步失敗時**：若 sync-items API 因 `total_items` 相關錯誤失敗，且 `SUPABASE_DB_URL` 有設定，會先執行上述 DROP TRIGGER，再重試一次 INSERT。

3. **必要設定**：  
   修復需要後端能連到 Postgres（執行 DROP TRIGGER）。請在 **.env** 設定：

   ```env
   SUPABASE_DB_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
   ```

   在 Supabase 專案：**Settings → Database → Connection string** 可取得（選 Transaction 或 Session 皆可，需含密碼）。

4. **若未設定 SUPABASE_DB_URL**：  
   無法自動修復時，API 會回傳錯誤，內容會說明「請在 .env 設定 SUPABASE_DB_URL，重啟後端後再試，系統將自動修復，無須手動執行 SQL」。

## 3. 相關表與欄位整理

| 表名 | 說明 | 備註 |
|------|------|------|
| **projects** | 專案主表 | `projects-schema.sql` 建立，無 total_items / published_items。若曾跑過 project-items-schema 的 DO 區塊，才可能會有這兩欄。 |
| **project_items** | 專案分包項目 | 有觸發器 `update_project_items_count_trigger` 會更新 projects（若該欄位存在）。後端修復會移除此觸發器。 |

數量統計改為在查詢時用 `COUNT(*)` 從 `project_items` 計算即可，不依賴 `projects.total_items` / `published_items`。

## 4. 小結

- **原因**：觸發器依賴 `projects.total_items`，但 projects 可能沒有該欄位。
- **作法**：後端在具備 `SUPABASE_DB_URL` 時，自動執行 `DROP TRIGGER ... update_project_items_count_trigger`，不再要求使用者手動執行任何 SQL。
- **您要做的**：在 .env 設定 `SUPABASE_DB_URL`，儲存後重啟後端；之後同步與發包應可正常。
