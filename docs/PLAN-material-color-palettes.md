# 材料組合 · 配色範例

> 定案實作對照（2026-08-06）

## 行為

- 材料組合選色區 → **配色範例** Modal
- 第一層 Tab：`官方`｜`我的`
- 第二層 Tab：每個**類型**一頁；內為**表格**（名稱、主色票＋色號、配色票＋色號、套用）
- 官方類型：管理區字典；我的類型：自由字、可選填（空白＝「未分類」）
- 「我的」帳號共用；四入口（設計／官方版型庫／廠商版型庫／供應商）同一頁
- 一鍵套用寫入兩個 HEX；不扣點
- 三色：`tertiary_hex` 預留，UI 暫不開

## 檔案

| 檔 | 用途 |
|----|------|
| `docs/add-material-color-palettes.sql` | 建表 |
| `public/admin/material-color-palettes.html` | 類型＋官方配色 CRUD |
| `public/js/material-color-palette-picker.js` | 前台 Modal |
| `public/client/material-dual-color.html` | 入口按鈕＋Modal DOM |

## 部署前

1. 執行 SQL（Supabase 或後台資料庫維護「材料組合配色範例」）
2. deploy 後於管理區建類型與官方配色
