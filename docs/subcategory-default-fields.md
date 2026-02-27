# 子分類預設填寫欄位

每個子分類（ai_subcategories）的 `form_config` 為 JSONB 陣列，定義該子分類在專案詳情頁的**必填/選填欄位**。

## 欄位物件格式

| 屬性 | 類型 | 必填 | 說明 |
|------|------|------|------|
| name | string | 是 | 欄位代碼（英文，用於儲存與 id） |
| label | string | 是 | 顯示名稱 |
| type | string | 是 | `text`、`number`、`textarea`、`select` |
| required | boolean | 否 | 是否必填，預設 false |
| unit | string | 否 | 單位（顯示在 label 後，如「坪」） |
| placeholder | string | 否 | 輸入提示 |
| options | string[] | 否 | type 為 `select` 時的選項 |

## 通用預設欄位（所有子分類）

以下為建議的通用必填/選填欄位，可透過 `docs/seed-subcategory-form-config.sql` 寫入資料庫：

- **需求說明**（必填）：textarea
- **預算範圍**（選填）：text，placeholder「例：10-20萬」

## 依子分類自訂欄位範例

可在後台「分類管理」為各子分類編輯專屬欄位，例如：

- **清潔服務**：需求說明、坪數(坪)、清潔頻率(select: 一次/每週/每月)、預算範圍
- **廚房**：需求說明、廚具類型、坪數(坪)、預算範圍
- **水電工程**：需求說明、工程類型、預算範圍

## 相關檔案

- 表結構：`docs/ai-subcategories-schema.sql`
- 寫入通用預設：`docs/seed-subcategory-form-config.sql`
- 專案詳情頁動態欄位：`client/project-detail.html`（`loadDynamicFields`）
