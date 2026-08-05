# 設計工具獨立 URL — 禁止發明功能（稽核備忘）

> 使用者多次要求：**只搬既有行為到獨立 path，禁止新造按鈕／連結／文案功能。**

## 版型卡（設計頁舊版 = 唯一真相）

`public/js/custom-product.js` 版型瀏覽卡：

| 按鈕 | 條件 |
|------|------|
| **用此款進行設計**（或官方材料／配件「加入參考圖」） | 一定有 |
| **看可搭配** | **僅** `link_count > 0`（有材料／配件關聯）→ `/product-tree.html?prototype_asset_id=` |
| ~~作品頁~~ | **禁止**（不是舊版功能） |

SSR `/vendor-styles/`、`/official-templates/` **必須**同一規則。

## 改獨立 path 時允許／禁止

| 允許 | 禁止 |
|------|------|
| TAB／選單改指已有獨立 URL | 新造「作品頁」「分享」「收藏」等舊卡沒有的 CTA |
| 舊 `?tab=` 301 到新 path | 無關聯仍顯示「看可搭配」 |
| 修相對路徑導致 CSS 掛掉 | 順便重做卡版面／文案行銷句 |

## 本輪已修（對齊舊卡）

- 拿掉「作品頁」→ inspiration
- 「看可搭配」改為僅 `link_count > 0`
- 列表 API 補 `link_count`／`match_guide_url`
- 縮圖不亂連（舊版為放大預覽，非跳 inspiration）
