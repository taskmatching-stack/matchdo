# 單價×數量媒合 — 測試說明

更新：2026-02-06

---

## 接下來要做什麼

1. **確保有測試資料**：專案項目要有 `quantity`、`unit`，且狀態為 **draft**（run-split 只媒合草稿項目）。
2. **測試預覽 API**：`POST /api/match/preview`（可傳 quantity、unit）。
3. **測試執行媒合 API**：`POST /api/match/run-split`（會用「專家單價×客戶數量」過濾與評分）。
4. **（可選）** 更新 `MATCHING-ALGORITHM-V2.md`、前端表單顯示單位與數量。

---

## 測試前準備

### 1. 啟動後端

```bash
cd d:\AI建站\ai-matching
node server.js
```

### 2. 準備測試專案（含 quantity、unit 的草稿項目）

**方式 A：用腳本建立（推薦）**

```bash
node docs/create-draft-items-for-match.js
```

會建立一個專案與 3 個 **draft** 項目（室內設計 30 坪、系統櫃 5 組、油漆 120 m²），並輸出 `project_id`、`item_ids` 供後續 API 使用。

若出現錯誤 `column "total_items" of relation "projects" does not exist`，表示專案表尚未有該欄位，請先執行 `docs/project-items-schema.sql` 或依該檔補上 `total_items`、`published_items` 欄位與觸發器。

**方式 B：手動在 Supabase / 後台**

- 在 `projects` 建立一筆專案。
- 在 `project_items` 建立項目，欄位需包含：`quantity`、`unit`、`budget_min`、`budget_max`、`subcategory`、`category_name`，且 **status = 'draft'**。

---

## 測試 1：預覽媒合（單價×數量）

**目的**：確認「專家單價×客戶數量」與總預算的比對是否正確。

**請求**

```bash
curl -X POST http://localhost:3000/api/match/preview \
  -H "Content-Type: application/json" \
  -d "{
    \"category\": \"home\",
    \"subcategory\": \"home__interior_design\",
    \"budget_min\": 70000,
    \"budget_max\": 100000,
    \"quantity\": 30,
    \"unit\": \"坪\"
  }"
```

**預期**

- `use_unit_pricing: true`
- `matched_experts`：專家單價均値 × 30 落在 70000～100000 的數量。
- `avg_market_price`：市場「單價」（例如約 2500～3500/坪）。

**不帶數量（舊邏輯）**

```bash
curl -X POST http://localhost:3000/api/match/preview \
  -H "Content-Type: application/json" \
  -d "{\"category\": \"home\", \"subcategory\": \"home__interior_design\", \"budget_min\": 70000, \"budget_max\": 100000}"
```

此時為總價對總價比對，`use_unit_pricing` 應為 false。

---

## 測試 2：執行媒合（run-split）

**目的**：確認實際媒合只保留「單位一致」且「專家總價＝專家單價×客戶數量」在預算內的專家，並寫入 `matches`。

**請求**（將 `PROJECT_ID`、`ITEM_ID_1` 換成 create-draft-items-for-match.js 輸出的值）

```bash
curl -X POST http://localhost:3000/api/match/run-split \
  -H "Content-Type: application/json" \
  -d "{
    \"project_id\": \"PROJECT_ID\",
    \"item_ids\": [\"ITEM_ID_1\"]
  }"
```

可只傳一個 `item_id`，或傳多個（例如三個項目的 id）。

**預期**

- 回傳 `match_results`，每項有 `matched_count`。
- 僅「單位＝該項目 unit」的 listing 會進入評分。
- 僅「(price_min+price_max)/2 * quantity」落在 `budget_min`～`budget_max` 的專家會得分並寫入 matches。
- 在 Supabase `matches` 表可看到新記錄。

---

## 測試 3：一鍵腳本（預覽 + 建立草稿 + run-split）

```bash
node docs/test-match-api.js
```

會依序：

1. 呼叫 preview（帶 quantity、unit）。
2. 若沒有可用的 draft 專案，會建立一個並輸出 project_id、item_ids。
3. 呼叫 run-split，帶上該 project_id 與 item_ids。
4. 輸出結果摘要。

（需先啟動 server：`node server.js`）

---

## 檢查清單

- [ ] 後端已啟動（`node server.js`）。
- [ ] 已有專家與 listings（V3 單價資料：`node docs/generate-test-data-v3-unitprice.js`）。
- [ ] 已有專案與 **draft** 項目（含 quantity、unit）：執行 `node docs/create-draft-items-for-match.js`。
- [ ] preview 帶 quantity、unit 時，`use_unit_pricing` 為 true，符合人數合理。
- [ ] run-split 回傳的符合人數與預期一致，且 `matches` 表有新資料。
