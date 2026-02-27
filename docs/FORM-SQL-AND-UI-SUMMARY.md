# 發包商／承包商填表與媒合對應 — SQL 與前端修正摘要

更新：2026-02-06

---

## 一、媒合邏輯對應關係

- **發包商**填寫：每個項目的**數量**、**單位**、**總預算下限／上限**（總價）。
- **承包商**填寫：**單價區間**（或階梯：不同數量區間對應不同單價區間）、**單位**。
- **媒合時**：用**發包商的數量**去對應**承包商的數量區間與單價**  
  → 計算「承包商單價 × 發包商數量」＝ 承包商總價  
  → 再與發包商的總預算比對。

---

## 二、需執行的 SQL（依序）

在 Supabase SQL Editor 執行以下腳本（若尚未執行過）：

| 順序 | 檔案 | 說明 |
|------|------|------|
| 1 | `docs/add-project-items-quantity-unit.sql` | `project_items` 新增 `quantity`、`unit`，並註解 `budget_min/max` 為總預算 |
| 2 | `docs/clarify-listings-pricing.sql` | 註解 `listings.price_min/max` 為單價 |
| 3 | `docs/add-listing-price-tiers.sql` | `listings` 新增 `price_tiers`（階梯定價 JSONB） |

---

## 三、發包商前端（client）

**檔案**：`client/project-detail.html`

- **資料來源**：專案項目改為從 **`project_items` 表**載入（不再從 `projects.description` JSON 解析）。
- **表格欄位**：項目名稱、說明、**數量**、**單位**、**總預算下限（元）**、**總預算上限（元）**、操作。
- **新增項目**：可填數量、單位、總預算下限／上限；儲存時寫入 `project_items`，`status = 'draft'`。
- **編輯項目**：Modal 可編輯數量、單位、總預算下限／上限，寫回 `project_items`。
- **送出媒合**：勾選項目的 **id**（UUID）傳給 `POST /api/match/run-split` 的 `item_ids`。

---

## 四、承包商前端（expert）

**檔案**：`expert/listing-form.html`

- **計價方式**：  
  - **單一單價區間**：單價下限／上限（元/單位），對應 `listings.price_min`、`price_max`、`unit`。  
  - **階梯定價**：多組「數量區間 → 單價區間」，送出時寫入 `listings.price_tiers`。
- **階梯格式**：每階為 `quantity_min`、`quantity_max`（可留空表示「以上」）、`unit_price_min`、`unit_price_max`。
- **單位**：與發包商填寫的單位一致才能媒合；選項含坪、m²、組、次、件、式等。
- **送出**：若選階梯定價，會組出 `price_tiers` 陣列並一併送出；`price_min`/`price_max` 以第一階或單一區間帶入。

---

## 五、後端媒合邏輯（已實作）

- **`resolveUnitPriceForQuantity(listing, quantity)`**：依發包商數量從 `listing.price_tiers` 找出對應階梯，取得該階的 `unit_price_min`、`unit_price_max`；無階梯則用 `listing.price_min`、`listing.price_max`。
- **run-split / preview**：  
  - 用**發包商數量**×**承包商對應單價**得到承包商總價，與發包商總預算比對。  
  - 單位過濾：`listing.unit` 與 `item.unit` 須一致。

以上為發包商／承包商填表 SQL 與前後端修正的對應說明。
