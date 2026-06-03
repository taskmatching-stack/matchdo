# 主產品 ↔ 材料／配件 關聯（設計端推薦標示）

## 產品決策

1. **樹狀結構只從「主產品」（`asset_kind = prototype`）長出來**；其下僅一層 **材料或配件**（`material` | `part`），**不再往下巢狀**。
2. **材料與配件在關聯上不再分兩套規則**——同一主產品可掛多筆材料、多筆配件；若需要更細的層級（例如「此配件只屬於某材料」），請廠商**另建一筆主產品**表達，勿在系統內做材料→配件子樹。
3. **多對多**：同一材料／配件可關聯多個主產品；同一主產品可關聯多筆材料／配件。**不設筆數上限**（僅受合理 UI／查詢效能限制）。
4. **「我的素材分類」（`vendor_catalog_groups`）** 仍僅作廠商自訂標籤／資料夾，**不代表 BOM 或產品結構**。

## 資料表

見 `docs/add-vendor-asset-prototype-links.sql`：

| 欄位 | 說明 |
|------|------|
| `manufacturer_id` | 冗餘，方便依廠商查詢與約束 |
| `prototype_asset_id` | 主產品（根） |
| `linked_asset_id` | 材料或配件 |
| `sort_order` | 同一主產品下連結的排序（設計端「推薦優先」順序） |

唯一鍵：`(prototype_asset_id, linked_asset_id)`。

## API

### 廠商後台

- `GET /api/me/vendor-assets/:id/prototype-links`  
  回傳目前關聯 ID 與可選候選（同廠商之 prototype 或 material+part）。
- `PUT /api/me/vendor-assets/:id` 表單欄位（選填）：
  - 主產品：`linked_asset_ids` — JSON 陣列，成員須為同廠之 `material` 或 `part`。
  - 材料／配件：`linked_prototype_ids` — JSON 陣列，成員須為同廠之 `prototype`。

雙向編輯語意（**同一張表、同一列連結**，非兩份資料）：

- 在**主產品 A** 勾選配件 A → 寫入一列 `(prototype_asset_id=A, linked_asset_id=配件A)`。
- 打開**配件 A** 編輯時，`GET …/prototype-links` 會讀到已連結的主產品 A（已勾選），**不必再勾一次**。
- 若主產品端尚未建立連結，也可在**配件 A** 勾選主產品 A → 寫入同一列。
- 儲存主產品時：以該主產品為準 **整批取代**「此主產品底下」的材／配連結（不影響其他主產品與同一配件的連結）。
- 儲存材料／配件時：以該筆為準 **整批取代**「此材／配連到哪些主產品」（不影響同一主產品連到的其他材／配）。

### 設計端選圖

- `GET /api/vendor-assets?...&for_prototype_asset_id=<uuid>`  
  當設計頁已鎖定某數位原型時，材料／配件分頁帶此參數。
- 回應每筆多 `is_linked_to_prototype: boolean`；列表 **已關聯者排前**（依 `sort_order`），其餘維持原排序。**未關聯者仍可選**。

## 設計頁 UX（與其他標示區隔）

| 機制 | 用途 | 樣式 |
|------|------|------|
| 訂製程度（`customization_levels`） | 廠商開放哪些參考類別 | 綠色 scope badge |
| 原型鎖定 | 只能同 `vendor_asset_id` 的多角度原型 | 灰化不可選之卡片 |
| **主產品關聯（本功能）** | 廠商推薦與此原型搭配的材／配 | 品牌色邊框 +「廠商推薦」badge |
| 超出訂製範圍使用 | 仍可選，但提醒 | 黃色 ⚠️ |

關聯標示 **不隱藏** 未關聯素材，僅排序與視覺提示。

## 部署前

在 Supabase SQL Editor 執行：`docs/add-vendor-asset-prototype-links.sql`
