# 怎麼測試 & 接下來要做什麼

更新：2026-02-06

---

## 一、接下來要做什麼（建議順序）

| 步驟 | 做什麼 | 說明 |
|------|--------|------|
| 1 | 執行 SQL | 在 Supabase 跑完 3 個 SQL，確保表結構正確 |
| 2 | 啟動後端 | 本機跑 `node server.js` |
| 3 | 準備測試資料 | 有專家（listings）＋有發包專案與草稿項目（project_items） |
| 4 | 測試發包商表單 | 登入發包端，專案詳情頁新增/編輯項目（數量、單位、總預算） |
| 5 | 測試承包商表單 | 登入專家端，新增報價（單價或階梯定價、單位） |
| 6 | 測試媒合 | 預覽 API → 執行媒合 → 看 matches 與結果 |

---

## 二、具體操作步驟

### 步驟 1：執行 SQL（Supabase SQL Editor）

依序執行（若已執行過可略過）：

1. **`docs/add-project-items-quantity-unit.sql`**  
   → project_items 有 `quantity`、`unit`

2. **`docs/clarify-listings-pricing.sql`**  
   → 註解 listings 價格為單價

3. **`docs/add-listing-price-tiers.sql`**  
   → listings 有 `price_tiers`

---

### 步驟 2：啟動後端

1. **分包同步**：若「同步為分包項目」會失敗，請在 Supabase **SQL Editor 執行一次** `docs/fix-projects-total-items-執行此段.sql`。

2. 啟動：
```bash
cd d:\AI建站\ai-matching
node server.js
```

看到類似 `Server running on port 3000` 即表示成功。

---

### 步驟 3：準備測試資料

**3a. 專家與報價（若還沒有）**

```bash
node docs/generate-test-data-v3-unitprice.js
```

會建立約 32 位專家，報價為**單價**（坪、組、m²、次等）。

**3b. 發包專案與草稿項目（供媒合用）**

```bash
node docs/create-draft-items-for-match.js
```

會建立一個測試專案與 3 個 **draft** 項目（室內設計 30 坪、系統櫃 5 組、油漆 120 m²），並在終端印出 `project_id`、`item_ids`。

若同步失敗：請在 Supabase SQL Editor 執行一次 **`docs/fix-projects-total-items-執行此段.sql`**。詳見 `matchdo-todo.md` 的「發包／同步現況與資料庫修復」。

---

### 步驟 4：測試發包商表單（前端）

1. 瀏覽器打開：`http://localhost:3000/client/project-detail.html?project=專案ID`  
   （專案ID 可用步驟 3b 輸出的 `project_id`，或從「我的專案」點進某專案）

2. 用**發包商帳號**登入（例如測試客戶 `test.client.v3@matchdo.test` / `Test1234!`，若腳本有建立）。

3. 在「分包項目」表格確認：
   - 有欄位：項目名稱、說明、**數量**、**單位**、**總預算下限**、**總預算上限**
   - 資料來自 **project_items** 表

4. 點「新增項目」：填數量、單位、總預算下限/上限 → 儲存，再重新整理，確認有寫入且顯示正確。

5. 點某筆的「編輯」：改數量或總預算 → 儲存，確認更新成功。

---

### 步驟 5：測試承包商表單（前端）

1. 打開：`http://localhost:3000/expert/listing-form.html`

2. 用**專家帳號**登入（例如 V3 測試專家）。

3. **單一單價**：選「單一單價區間」，填單價下限/上限、單位（例：坪）→ 發布，到「我的報價」確認有該筆且為單價。

4. **階梯定價**：再新增一筆報價，選「階梯定價」：
   - 第 1 階：數量起 1、數量迄 10、單價 8000～12000
   - 第 2 階：數量起 11、數量迄留空、單價 7000～10000  
   發布後到 Supabase `listings` 表看該筆的 `price_tiers` 是否有正確 JSON。

---

### 步驟 6：測試媒合

**6a. 一鍵腳本（建議）**

後端已啟動、且已有 draft 項目時，在**另一個終端**執行：

```bash
node docs/test-match-api.js
```

會依序：呼叫 preview（帶 quantity、unit）→ 查一組 draft 項目 → 呼叫 run-split → 印出結果。

**6b. 手動呼叫 API**

- **預覽**（PowerShell 單行）：

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/match/preview" -Method POST -ContentType "application/json" -Body '{"category":"home","subcategory":"home__interior_design","budget_min":70000,"budget_max":100000,"quantity":30,"unit":"坪"}'
```

- **執行媒合**（把 `PROJECT_ID`、`ITEM_ID` 換成實際值）：

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/match/run-split" -Method POST -ContentType "application/json" -Body '{"project_id":"PROJECT_ID","item_ids":["ITEM_ID"]}'
```

**6c. 從發包商前端送出媒合**

1. 在專案詳情頁勾選要發包的**草稿**項目。
2. 點「送出媒合」。
3. 看畫面上的媒合結果；到 Supabase `matches` 表確認是否有新記錄。

---

### 步驟 7：測試站內對話（立即聯繫）

**前置**：`conversations` 與 `messages` 表已建立（已執行 `docs/conversations-schema.sql`），且專案已有媒合到的專家。

1. **啟動後端**（若尚未啟動）：
   ```bash
   node server.js
   ```

2. **發包商登入**：用發案者帳號登入（例如測試客戶）。

3. **進入專案詳情**：從「我的專案」點進一個**已送出媒合、有媒合專家**的專案。  
   網址形如：`http://localhost:3000/client/project-detail.html?project=專案ID`

4. **點「立即聯繫」**：在「媒合專家列表」任選一位專家，點該卡片上的 **「立即聯繫」** 按鈕。

5. **確認對話 Modal**：
   - 應跳出「與 ○○ 的對話」視窗。
   - 若為第一次對話，會顯示「尚無訊息，輸入下方內容開始對話」。
   - 若有舊訊息，應顯示歷史紀錄（自己的訊息靠右、對方靠左）。

6. **送出一則訊息**：
   - 在下方輸入框輸入文字（例如：您好，想詢問報價與工期）。
   - 按 **Enter** 或點 **「送出」**。
   - 畫面上應立即出現剛送出的訊息（靠右、自己的）。

7. **（可選）到 Supabase 檢查**：
   - `conversations` 表：應有一筆該專案 + 該專家的記錄（`project_id`、`client_id`、`expert_id`）。
   - `messages` 表：應有剛送出的那則（`conversation_id`、`sender_id`、`body`、`created_at`）。

**注意**：目前僅發案者端有對話 UI；專家端若要回覆，需在專家「媒合專案」頁面加「查看對話／回覆」功能（呼叫同一組 API：GET/POST `/api/conversations/:id/messages`）。

---

## 三、檢查清單

- [ ] 3 個 SQL 已在 Supabase 執行
- [ ] 本機 `node server.js` 已啟動
- [ ] 有專家報價（V3 單價資料）
- [ ] 有至少一個專案與 **draft** 項目（含 quantity、unit、budget_min、budget_max）
- [ ] 發包商表單：新增/編輯項目有數量、單位、總預算，且存進 project_items
- [ ] 承包商表單：可填單價或階梯定價，單位可選
- [ ] preview 回傳 `use_unit_pricing: true` 且符合人數合理
- [ ] run-split 有回傳媒合結果，且 `matches` 表有新資料
- [ ] **站內對話**：專案詳情點「立即聯繫」→ 對話 Modal 開啟 → 可送出訊息；`conversations`、`messages` 表有資料

---

## 四、接下來可做的功能（選做）

- 在專案詳情頁顯示媒合到的專家與分數
- 發包商預覽時依「每筆項目」帶 quantity、unit 呼叫 preview
- 專家「我的報價」列表顯示階梯定價摘要

---

## 五、相關文件

| 文件 | 說明 |
|------|------|
| `docs/matchdo-todo.md` | 整體進度與待辦清單（含發包／同步現況與 DB 修復） |
| `docs/MATCHING-ALGORITHM-V2.md` | 媒合演算法規格（含單價×數量、階梯定價、市場單價） |
| `docs/HOW-TO-TEST-AND-NEXT.md` | 本文件：測試步驟與檢查清單 |
| `docs/FORM-SQL-AND-UI-SUMMARY.md` | 發包商／承包商表單與 SQL 對應摘要 |
| `docs/DATABASE-SCHEMA-AND-REPAIR.md` | 資料庫觸發器與同步修復說明（維運用） |
