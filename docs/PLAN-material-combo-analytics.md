# 材料組合追蹤與分析

> **狀態**：2026-08-07 初版（生成血緣 + 管理員聚合 API + 後台頁）

## 追什麼

| 欄位 | 來源 | 說明 |
|------|------|------|
| `main.material` | 使用者手打 | 主色區材質，例：編織布 |
| `accent.material` | 使用者手打 | 配色區材質，例：粒面皮革 |
| `third.material` | 使用者手打 | 三色輔色區材質 |
| HEX、比重 | 選色 UI | 一併存在 `material_combo` |
| `source_palette` | 套用配色範例後生成 | 官方／我的配色 id、類型、名稱 |
| `source_generation_id` | 生成／引用 | 對應 `user_material_combo_generations.id` |

## 資料流

1. **材料組合頁**套用配色範例 → 記 `lastSourcePalette` → 生成 API 帶 `source_palette_json` → 寫入 `user_material_combo_generations.material_combo_json`
2. **我的數位資產**選材料組合 → `material_combo` 帶 `source_generation_id` → 設計稿 `reference_sources[].material_combo`
3. **分析**掃描生成表 + 設計稿引用，聚合材質 TOP、組合 TOP、配色範例 TOP

## API

`GET /api/admin/material-combo-analytics?from_date=&to_date=&top_limit=30`

需管理員登入。

## 後台頁

`/admin/material-combo-analytics.html`

## 程式

| 檔 | 用途 |
|----|------|
| `lib/material-combo-analytics.js` | 解析 snapshot、聚合 |
| `server.js` | `mergeMaterialComboLineage`、`GET /api/admin/material-combo-analytics` |
| `public/js/material-color-palette-picker.js` | 套用時帶 `source_palette` |
| `public/client/material-dual-color.html` | 生成時提交 `source_palette_json` |
| `public/js/digital-asset-picker.js` | 引用時帶 `source_generation_id` |

## 限制

- 舊資料沒有 `source_palette`（僅材質／HEX 仍可統計）
- 材質為自由文字，「編織布」「尼龙布」分開計數
- 未生成、未引用進設計稿的填表不會入庫
