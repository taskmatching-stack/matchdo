# 廠商列表篩選（P2）

## 問題

`vendors.html` 曾在前端對 `GET /api/manufacturers` 回傳的**單頁**再做服務地區過濾，導致分頁／「載入更多」筆數與總數不一致。

## 作法

- **API** `GET /api/manufacturers`
  - `service_area` 或 `service_areas`：逗號分隔地區 code，OR 邏輯
  - `sort`：`rating`（預設）或 `name`
  - 回傳 `{ manufacturers, total, page, per_page }`（篩選與排序後再 slice）
- **前台** `public/vendors.html`：多選地區與排序參數送 API；`total` 驅動結果計數與 load-more

## 相關

- 地區 code：`public/js/area-codes.js`
- 比對邏輯：`lib/manufacturer-list-filters.js`（`contact_json.service_area`，相容字串／陣列）；單測 `scripts/test-manufacturer-list-filters.js`

## 狀態

- 已上線：`0b229d4`（API + `vendors.html`）
