# 設計者可選／僅展示（數位原型・配件）

**更新：** 2026-07-12  
**狀態：** 實作中（JSON-only，**不加** DB 欄位）

## 產品規格

| 項目 | 定案 |
|------|------|
| 適用 | **數位原型**、**配件**（材料不用） |
| 封面 | **可**設為僅展示 |
| 過濾 | **僅**設計頁原型參考選圖、embed 原型角度驗證 |
| 瀏覽／燈箱 | 仍可看僅展示圖 |

## 儲存（避免重蹈 42703）

- **禁止** `cover_designer_selectable` 進 `VENDOR_ASSET_SELECT_*`
- 多角度：`gallery_images[].designer_selectable === false`（省略／true＝可引用）
- 封面：同陣列內 meta `{ "__cover_designer_selectable": false }`（無 `url`，不佔圖位）

## 相關函式

- `normalizeDesignerSelectable` / `readCoverDesignerSelectableMeta` / `applyCoverDesignerSelectableMeta`
- `buildVendorAssetImageItems` → `image_items[].designer_selectable`
- `PATCH .../image-labels`：`entries[].designer_selectable`、`cover_designer_selectable`（寫入 JSON meta）
- `buildValidatedEmbedReferencePayload`：略過僅展示 URL
- 設計頁：`isDesignerSelectableImageItem`、`filterPrototypeVendorImageItems`
