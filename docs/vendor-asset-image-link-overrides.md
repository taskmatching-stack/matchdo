# 產品樹圖片層連動覆寫

## 目的

卡片層 `vendor_asset_prototype_links` 保留作原型的預設材料／配件組；
原型圖片可在 `gallery_images` 內以 `linked_asset_ids` 覆寫成自己的材料／配件組。

## JSONB 格式

非封面圖：

```json
{
  "url": "https://…",
  "link_group": "black",
  "linked_asset_ids": ["material-or-part-uuid"]
}
```

封面圖：

```json
{
  "__cover_linked_asset_ids": ["material-or-part-uuid"]
}
```

僅允許同一廠商的 `material` 或 `part`。不設或空陣列代表沿用卡片層預設組。

## 訂製者端

1. 有 `link_group` 時預選第一組圖；沒有組時只預選第一張。
2. 選中圖有覆寫時，產品樹顯示並預選該圖片組的材料／配件。
3. 沒覆寫時，沿用卡片預設關聯。
4. 覆寫材料可完全不同於卡片預設；卡片預設不會被圖片設定覆蓋或刪除。
