# 材料組合 — 同材質全幅混色（mix）

## 與交界漸層（gradient）的差異

| | Gradient（已上線） | Mix（本功能） |
|---|---|---|
| 範圍 | 交界帶 | **全幅 1024²** |
| UI | 同材質 + 漸層選項 | Step1：**分區色帶 \| 同材質全幅混色** |
| 材質 | 各區可不同（漸層需 link） | **單一材質** |
| 比例 | 色帶高度 % | **混色權重**（如 70:30） |
| JSON | `swatch_mode: "banded"` + `transitions` | `swatch_mode: "mixed"` + `mix` |
| 印花 | 漸層 v1 禁印花 | **v1 禁印花** |

## 實作（2026-08-10）

- **Canvas**：`composeMixedSwatch()` — heather 細點交織預覽
- **頁面**：`/client/material-dual-color.html`，build `material-combo-mix-v1-20260810`
- **API**：`POST /api/me/vendor-assets/material-dual-color-flux` 收 `swatch_mode`、`mix_json`
- **結構**：`material_combo.version: 4`，`mix: { style, weights, colors[] }`
- **設計頁 addon**：`formatMaterialComboAddon` 顯示混色摘要

## 未來（P3 選做）

- `mix.style`: `marble` / `splash` 等第二種混色紋理
