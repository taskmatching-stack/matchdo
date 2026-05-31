# docs/*.sql 使用說明

## 兩類 SQL（不要混用預期）

| 類型 | 範例 | 怎麼用 |
|------|------|--------|
| **結構／種子** | `add-*.sql`、`seed-*.sql`、`SETUP-ALL-IN-ONE.sql` | 整段或依檔內 STEP 執行；**不用改帳號** |
| **帳號操作** | `bind-industry-supplier-account.sql` | **必須先改檔內信箱等設定**再執行綁定段 |

舊版 `bind-industry-supplier-account.sql` 曾把 `YOUR_USER_UUID` 寫在可執行的 `::uuid` 上，未替換就會 **22P02**。其他檔案沒有這種寫法。

## 帳號操作檔的規則（之後新增檔案必守）

1. **禁止**可執行行上的 `YOUR_*`、`REPLACE_ME` 等假 UUID。
2. 優先用 **email** 從 `auth.users` 查 `id`，不要用戶手填 UUID。
3. 敏感 `UPDATE` 前加 **查詢 SELECT**；改錯時用 `RAISE EXCEPTION` 明確失敗。
4. 需註解的範例用 `/* ... */` 包整段，不要留半段可執行。

## 設管理員／測試員

- `user-roles-schema.sql`：admin 的 `UPDATE` 在註解塊內，要改 email 後**取消註解**才執行。
- `migration-add-tester-role-fix.sql`：同樣以註解或明確 STEP 分隔。

## 產業供應商綁帳號

見 **`bind-industry-supplier-account.sql`**（只改「你的登入信箱」與 `supplier_id`）。
