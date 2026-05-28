# 數位原型：MOQ 與訂製程度 — 功能說明與統計規劃備忘

> 建立：2026-05-26  
> 相關 migration：`add-vendor-asset-prototype-moq-customization.sql`、`add-vendor-asset-gallery-images.sql`  
> 上線 commit 參考：`76c2736`（欄位）、`0ff5ec6`（按鈕 UI）、`b71e2b3`（篩選修正）、`5514f1d`（尺寸／零件）

## 欄位定義（僅 `asset_kind = prototype`）

| 欄位 | 型別 | 說明 |
|------|------|------|
| `min_order_quantity` | `INTEGER` | 最小訂購量（件）；上傳／編輯必填 |
| `customization_levels` | `text[]` | 訂製程度 slug，至少一項；可複選 |

### 訂製程度 slug（固定五項，順序固定）

| slug | 顯示 | 語意 |
|------|------|------|
| `mono_graphic` | 單色表面圖文 | 與 `color_graphic` **前端 UI 互斥擇一**（後端僅正規化舊雙選資料） |
| `color_graphic` | 彩色表面圖文 | 同上；**不含**布料／主體顏色 |
| `color_material` | 主體顏色／材質 | 產品本體色相、布紋、塗層等（與表面圖文分開） |
| `size_part` | 尺寸／零件 |
| `form_structure` | 造型／結構 |

材料參考（`material`）兩欄維持 `NULL` / `[]`。

## 目前產品用途（已實作）

- **廠商上傳／編輯**：`public/client/manufacturer-materials.html`
- **設計頁素材庫篩選**：`public/custom-product.html` + `public/js/custom-product.js`
- **公開 API**：`GET /api/vendor-assets`
  - `min_order_quantity`：**精確相等**（訂製者輸入 N → 只顯示 MOQ = N 的原型）
  - `customization_levels`：逗號分隔，**OR**（任一符合即顯示；篩「單色圖文」時亦會包含僅勾彩色的原型）
  - 有篩選時：未填 MOQ／訂製程度的舊原型會被排除
- **選訂製程度／MOQ 後自動重載列表**（不必只依賴「套用」）
- **生圖提示詞**：分類＋使用者描述＋製造限制句 **拼成同一 `fullPrompt`** 送 BFL。僅對未勾選項寫限制句。送前 Gemini 英譯整段，但 **半形雙引號 `"..."` 內文字保留不譯**（設計頁 ? 說明）。

### 與展示案例 MOQ 的差異

- 展示案例：`manufacturer_portfolio.min_order_quantity`（選填）
- 數位原型：`vendor_assets.min_order_quantity`（必填）  
→ 全站統計若要做，需分表查或日後整合。

## 統計：現狀結論

**資料面：適合統計**（結構化欄位 + GIN 索引 on `customization_levels`）。  
**產品面：尚未有統計報表或行為 log 使用這些欄位。**

目前僅用於：媒合、列表顯示、篩選。  
未實作：

- 後台／廠商端 MOQ、訂製程度分布圖表
- 篩選／選圖行為寫入 `design_action_log`
- `custom_products.reference_sources` 快照 MOQ／訂製程度（現只存 `vendor_asset_id` 等）

## 日後可做統計（備選方向）

### A. 供給端報表（較簡單）

只查 `vendor_assets`：

- 各 MOQ 數值或區間的 prototype 筆數
- 各 `customization_levels` slug 被標記次數（`unnest` + `GROUP BY`）
- 依 `category_key`、廠商 breakdown

### B. 需求端報表（較完整）

需補資料管道其一：

1. 選圖／套用篩選時寫 event log；或  
2. 存入設計單時，在 `reference_sources[]` 加快照：`min_order_quantity`、`customization_levels`（選當下原型屬性）

方可分析：訂製者常搜的 MOQ、常被選的原型訂製程度組合。

## Supabase 查詢範例（供給端）

```sql
-- 各訂製程度標記次數（一筆原型可計入多個 level）
SELECT unnest(customization_levels) AS level, COUNT(*) AS asset_count
FROM vendor_assets
WHERE asset_kind = 'prototype'
  AND cardinality(customization_levels) > 0
GROUP BY 1
ORDER BY asset_count DESC;

-- MOQ 分布
SELECT min_order_quantity, COUNT(*) AS asset_count
FROM vendor_assets
WHERE asset_kind = 'prototype'
  AND min_order_quantity IS NOT NULL
GROUP BY 1
ORDER BY min_order_quantity;
```

## 主要程式位置

| 區塊 | 路徑 |
|------|------|
| 驗證／篩選／API 回傳 | `server.js`（`normalizeCustomizationLevels`、`vendorAssetMatchesMoqFilter` 等） |
| 廠商 UI | `public/client/manufacturer-materials.html` |
| 設計端篩選 | `public/js/custom-product.js`、`public/custom-product.html` |
| i18n | `public/locales/zh-TW.json`、`en.json`（`baseModels.*`、`customProduct.*`） |

## 產品決策紀錄（篩選行為）

- MOQ 篩選：**正好等於 N**（非 ≤ N）
- 訂製程度篩選：**OR**（篩「單色圖文」時亦含僅勾彩色的原型，因實務可做單色）
- 舊資料：有篩選條件時排除未填欄位者；**編輯原型可補填** MOQ 與訂製程度

## 生圖提示詞邏輯（2026-05）

| 類別 | UI | 提示詞 |
|------|-----|--------|
| 已勾選 | — | 僅在附錄標題列出「支援」能力，**不寫**正向 prompt |
| 未勾選／互斥未選 | — | **限制句**併入同一 prompt（勿／不得…） |
| 單色／彩色表面圖文 | 互斥擇一 | 未選之圖文類型寫禁止（如選單色→禁止全彩） |
| 附錄開頭 | — | 使用者產品描述為主；下列僅限未支援項目 |
| 多個參考原型 | — | 各原型分開列出；圖文能力取交集（最嚴） |

---

*待辦（統計相關，未排程）：指標清單、是否做 A/B、是否擴充 `reference_sources` 快照。*
