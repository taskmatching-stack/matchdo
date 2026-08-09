# 材料組合 · 同材質漸層（規劃定案）

> **日期**：2026-08-09  
> **狀態**：P1–P3 已實作（2026-08-09）；設計頁 addon／待傳匯入已接基本欄位  
> **前置**：`docs/PLAN-material-dual-color-compose.md`（Step1 色卡 + Step2 材質化現況）  
> **入口（三處共用）**：`/client/material-dual-color.html`  
> - 廠商：`manufacturer-materials.html` → 材料組合  
> - 官方：`?official_platform=1`  
> - 設計：`?return=design`（`custom-product` 材料組合 Tab 深鏈）

---

## 1. 使用者定案（一句話）

**同材質才能漸層；材質相同也不自動漸層——預設仍是硬分界，只有使用者先「套用相同材質」、再在交界處明確選「同材質漸層」才生效。**

---

## 2. 核心規則

| # | 規則 |
|---|------|
| R1 | **不同材質** → 該段交界**只能硬分界**（可填分界描述）；**不顯示**漸層選項 |
| R2 | **相同材質** → **預設仍硬分界**（同色接色、明線、包邊等）；漸層是**可選** |
| R3 | 漸層僅表示「同一表面、兩個色度自然過渡」，不是皮革接帆布 |
| R4 | 須先經**「與主色相同材質」／「與上一區相同材質」**按鈕建立 **linked** 狀態，才**解鎖**該段漸層下拉 |
| R5 | **改回獨立材質** → 該段漸層自動關閉，回到 `hard` |
| R6 | 三色時 **主↔配**、**配↔輔** 兩段交界**各自獨立**（可一段漸層、一段硬切） |
| R7 | 三入口（官方／廠商／設計）**同一 UI、同一 JSON**，禁止分三套 |

### 材質「相同」判定（v1）

- 正規化後字串相等：trim、全半形、大小寫不敏感（中文材質名）
- v2（可選）：自同一 `vendor_assets` 材料帶入時強綁定 `material_asset_id`

---

## 3. UX 流程（兩段式防呆）

```
選色（Step1）→ 填各區材質（Step2）
    → （可選）按「與主色相同材質」／「與上一區相同材質」
        → 該段材質欄 linked（唯讀或鎖 +「改回獨立材質」）
        → 交界列出現：[ 硬分界 ▼ | 同材質漸層 ▼ ]，預設硬分界
            → 若選漸層：顯示「過渡寬度 %」（例 8–20，預設 12）
            → 若硬分界：顯示「分界描述」（沿用現有 boundary 語意）
    → 生成材質圖
```

### 不採用

- ❌ 一進頁就有全域「漸層模式」開關  
- ❌ 材質字串相同就自動開漸層  
- ❌ 只有漸層按鈕、沒有「相同材質」門檻  
- ❌ 「建層」等易與 PS 圖層混淆的文案  

### 建議文案

| 控制項 | 文案 |
|--------|------|
| 按鈕 | **與主色相同材質**／**與上一區相同材質** |
| 解鎖後 | **改回獨立材質** |
| 交界 | **硬分界**｜**同材質漸層** |
| 漸層參數 | **過渡寬度**（占整圖高度 %） |
| 硬分界 | **分界描述**（選填，例：同色明線車縫） |

### Wireframe（雙色）

```
┌─ 材質生成 ─────────────────────────────────────┐
│ 主色材質  [ 粒面皮革          ]                 │
│ 配色材質  [ 粒面皮革 🔒 ] [改回獨立材質]        │
│           [ 與主色相同材質 ]  ← 未 link 時顯示   │
│                                                 │
│ ── 主色 ↔ 配色 交界 ──                          │
│ 交界方式  (●) 硬分界  ( ) 同材質漸層  ← link 後│
│ 分界描述  [ 同色明線車縫    ]  ← hard 時        │
│ 過渡寬度  [ 12 ] %           ← gradient 時     │
└─────────────────────────────────────────────────┘
```

---

## 4. 資料結構（擴充 `material_combo`）

`normalizeMaterialCombo` 升 **version 3**；舊版無 `transitions` → 全部視為 `hard`（向後相容）。

```json
{
  "version": 3,
  "color_count": 2,
  "ratio_percents": [75, 25],
  "ratio_preset": "dual_75_25",
  "main": { "hex": "#3B82C4", "material": "粒面皮革" },
  "accent": { "hex": "#F5F0E8", "material": "粒面皮革" },
  "material_links": {
    "accent": { "linked_to": "main", "linked": true }
  },
  "transitions": [
    {
      "edge": "main_accent",
      "mode": "hard",
      "boundary": "同色明線車縫"
    }
  ]
}
```

漸層範例：

```json
{
  "edge": "main_accent",
  "mode": "gradient",
  "span_pct": 12
}
```

| 欄位 | 說明 |
|------|------|
| `material_links.{zone}.linked_to` | `main`｜`accent`（三色時 `accent` 可 link 到 `main` 或 `third` 的上一區） |
| `transitions[].edge` | `main_accent`｜`accent_third` |
| `transitions[].mode` | **`hard`（預設）**｜`gradient` |
| `transitions[].span_pct` | 1–30 整數，僅 `gradient`；過渡帶占 canvas 高度 % |
| `transitions[].boundary` | 僅 `hard`；可併入此物件，頂層 `boundary` 保留相容舊讀取 |

寫入位置（與現況一致）：

- 生成紀錄 `user_material_combo_generations`
- 待傳／入庫 `image_semantics_json.material_combo`
- 設計頁參考槽 `refSlots.material` addon 文案

---

## 5. Step1 色卡 canvas

**檔案**：`public/js/material-dual-color-compose.js`

| 模式 | 繪製 |
|------|------|
| 全段 `hard` | 維持現有 `fillRect` 硬色帶 |
| 某段 `gradient` | 在該交界附近以 `createLinearGradient` 繪過渡帶；過渡寬度由 `span_pct` 與 `ratio_percents` 換算像素 |

- 輸出仍 **PNG 1024²**  
- 預覽與上傳色卡一致，減少 Step2 模型誤判硬切  

---

## 6. Step2 生圖 prompt（草案）

**原則**：短中文、正向描述、勿反向詞；材質句來自使用者輸入（遵守 `docs/flux-and-gemini-prompt-policy.md`）。

### 6.1 硬分界（含「同材質但未選漸層」）

維持現有模板（見 `PLAN-material-dual-color-compose.md`）。  
同材質兩區時 prompt 可寫同一 `{材質}`，分界描述來自 `boundary`。

### 6.2 同材質漸層（無印花 v1）

```
同一{材質}表面，上方{主HEX}至下方{配HEX}自然色度過渡，過渡帶約{span_pct}%高度，解析度1024x1024，請維持原圖色塊比例
```

三色：依 `edge` 分段組句（相鄰兩色 + 該段 mode）。

### 6.3 印花 × 漸層（v1 限制）

**v1 建議**：任一段交界為 `gradient` 時，**該段相鄰兩區不可掛印花**；UI 選漸層時隱藏／禁用該區印花按鈕，或提示先清除印花。  
（避免 prompt 與參考圖角色衝突；v2 再評估是否開放單側印花。）

### 6.4 扣點

與現行 Step2 相同：`points_material_dual_color_flux`（預設 10 點）；漸層不另加價（除非日後實測成本明顯較高再調）。

---

## 7. 三入口行為（無分叉）

| 入口 | URL 差異 | 漸層 UI |
|------|----------|---------|
| 廠商材料 | 預設 | 同左 |
| 官方版型庫 | `official_platform=1` | 同左 |
| 設計頁 | `return=design` | 同左；帶回 `material_combo` 進參考槽 |

設計頁 addon 展示例：`粒面皮革 · 75/25 · 主↔配漸層 12%`（僅顯示，不在設計頁另做漸層編輯器）。

---

## 8. 實作分期

| 期 | 內容 | 主要檔案 |
|----|------|----------|
| **P1** | `material_links` UI（相同材質按鈕、鎖定、改回獨立）+ `transitions` 預設 `hard` + 交界列 | `material-dual-color.html`、頁內 JS |
| **P2** | Step1 canvas 漸層預覽 + `composeVerticalSwatch` 擴充 | `material-dual-color-compose.js` |
| **P3** | Step2 prompt 分支 + `normalizeMaterialCombo` v3 + API 收寫 | `server.js` |
| **P4** | 存庫／資產庫／設計頁 addon／picker 顯示 | `material-dual-color-import.js`、`custom-product.js` |
| **P5（可選）** | 管理後台 analytics：漸層使用率 | `material-combo-analytics` |

每期部署前：`window.__MATCHDO_DUAL_COLOR_BUILD` 遞增；`node --check server.js`。

---

## 9. 禁止再犯

- ❌ 材質相同就自動漸層  
- ❌ 不同材質仍顯示漸層選項  
- ❌ 未按「相同材質」就出漸層 toggle  
- ❌ 為漸層在後端寫死材質 enum／regex 表面句（見 flux policy）  
- ❌ 漸層 v1 與印花同段硬開（未更新 prompt 前）  
- ❌ 官方／廠商／設計三套 UI  

---

## 10. 驗收清單

- [ ] 主／配不同材質：無漸層選項，可硬分界 + boundary  
- [ ] 按「與主色相同材質」後：預設仍硬分界，可選漸層  
- [ ] 選漸層 + 調 span：Step1 預覽可見過渡帶  
- [ ] 改回獨立材質：漸層關閉、交界回 hard  
- [ ] 三色：兩段交界可 independent（一段 gradient、一段 hard）  
- [ ] 舊 `material_combo` 紀錄仍可讀、生成、入庫  
- [ ] 三入口同一頁行為一致  

---

## 11. 相關文件

- 現行雙色卡：`docs/PLAN-material-dual-color-compose.md`  
- 配色範例：`docs/PROGRESS-material-color-palettes.md`  
- 資產庫 handoff：`docs/PROGRESS-handoff-2026-08-05-material-combo-assets.md`  
- FLUX 政策：`docs/flux-and-gemini-prompt-policy.md`
