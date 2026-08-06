# 材料組合 · 配色範例

> **定案實作**：2026-08-06（commit `14ec911`）  
> **進度 handoff**：`docs/PROGRESS-material-color-palettes.md`

---

## 1. 已上線行為（雙色）

- 材料組合選色區 → **配色範例** Modal  
- 第一層 Tab：`官方`｜`我的`  
- 第二層 Tab：每個**類型**一頁；內為**表格**（名稱、主色票＋色號、配色票＋色號、套用）  
- 官方類型：管理區字典；我的類型：自由字、可選填（空白＝「未分類」）  
- 「我的」帳號共用；四入口同一頁  
- 一鍵套用寫入兩個 HEX；不扣點  
- DB 已有 `tertiary_hex`／`color_count` **欄位預留**，前台／管理區 **暫不開三色**

### 檔案

| 檔 | 用途 |
|----|------|
| `docs/add-material-color-palettes.sql` | 建表 |
| `lib/admin-migrations.js` | migration id `material-color-palettes` |
| `public/admin/material-color-palettes.html` | 類型＋官方配色 CRUD |
| `public/js/material-color-palette-picker.js` | 前台 Modal |
| `public/client/material-dual-color.html` | 入口按鈕＋Modal DOM |
| `server.js` | `/api/material-color-palettes/platform`、`/api/me/…`、`/api/admin/…` |

---

## 2. 三色預規劃（尚未實作）

目標：選色區可在 **雙色｜三色** 之間切換；三色時有 **3 種色塊比重搭配（preset）** 可切，色卡 canvas／後續 FLUX 跟選定比重走。

### 2.1 選色 UI 切換（產品）

| 控制 | 行為 |
|------|------|
| **色數模式** | `雙色`（現況）｜`三色`（新）— 建議 segmented control／radio，放在選色卡標題列或色號列上方 |
| 雙色 | 主色＋配色兩框；色卡垂直 **上／下**（現行 75%／25%） |
| 三色 | 主色＋配色＋**輔色**三框；色卡依「比重 preset」切塊 |
| 配色範例 Modal | 雙色列只帶兩色；三色列帶三色＋可選顯示該列綁定的 preset（若有） |
| 切換模式時 | 不清空已填 HEX；從三色切回雙色時忽略第三色（保留在欄位／local 暫存亦可，避免誤刪） |

### 2.2 三種色塊比重搭配（preset，待定案數字）

垂直色帶（與現行雙色同方向，利於對照 FLUX「上／中／下」敘述）。下列為**建議預設**，實作前請使用者確認或改比例：

| Preset key | 顯示名（建議） | 主色 : 配色 : 輔色（由上到下） | 用途直覺 |
|------------|----------------|--------------------------------|----------|
| `tri_dominant` | 主色主導 | **50% : 30% : 20%** | 主材大面、配色／輔色點綴 |
| `tri_balanced` | 均衡 | **40% : 35% : 25%** | 三色接近、仍可辨主次 |
| `tri_accent` | 輔色強調 | **45% : 20% : 35%** | 底部輔色較重（滾邊／內裡感） |

- UI：三色模式下再出現 **比重切換**（三顆 radio 或小 Tab），旁附迷你色帶示意。  
- Canvas：依 preset 畫三色無縫色帶（PNG）；prompt 正向寫明各區百分比（延續雙色「勿加反向詞」原則）。  
- **不做**自由拖曳任意 %（第一版只准三檔 preset，避免無限組合與 FLUX 漂）。

### 2.3 資料／API（預留延伸）

| 欄位／概念 | 說明 |
|------------|------|
| `color_count` | `2`｜`3`（表已有） |
| `tertiary_hex` | 輔色（表已有） |
| `ratio_preset`（**新欄，三色時再加**） | 如 `tri_dominant`／`tri_balanced`／`tri_accent`；雙色可 null 或固定 `dual_75_25` |
| 官方／我的 CRUD | 管理區與「存成我的」在三色模式寫入第三色＋preset |
| 配色範例表 | 三色列多一欄「比重」示意色帶；套用時寫入三 HEX＋切到三色模式＋選中 preset |

現行雙色色卡比例若未來也要多檔（例如 75/25｜66/34），可共用同一套 `ratio_preset` 命名空間（`dual_*`／`tri_*`），選色 UI「色數」與「比重」分開切。

### 2.4 生圖管線（對齊 `PLAN-material-dual-color-compose`）

| 步驟 | 三色時 |
|------|--------|
| Step1 canvas | 三色色帶依 preset；仍不扣點 |
| Step2 FLUX | 單次 img2img；prompt 寫「上方 a%／中間 b%／下方 c%」對應三材質 |
| 印花 | **預設仍「一區擇一」**（主／配／輔擇一）；是否開放需另開需求 |
| 材質輸入 | 第三個材質文字框（輔色區） |
| 扣點 | 可與雙色同 key，或另設 `points_material_tri_color_flux`（定案時再定） |

### 2.5 明確不做（三色第一版）

- ❌ 任意百分比滑桿  
- ❌ 水平／斜切／四色  
- ❌ 未確認 preset 數字就寫死進 production prompt  
- ❌ 媒體牆／首頁自動讀圖打標  

### 2.6 建議實作分期（之後開做）

| Phase | 內容 |
|-------|------|
| T0 | 定案三檔 preset 百分比＋顯示名 |
| T1 | 選色 UI：雙色｜三色切換＋三色框＋比重切換＋canvas |
| T2 | 配色範例／Admin／我的：三色＋preset 存讀與套用 |
| T3 | FLUX prompt＋印花一區規則＋點數／存庫 JSON 帶 `ratio_preset` |

---

## 3. 部署前（雙色已上線）

1. 執行 `docs/add-material-color-palettes.sql`  
2. Deploy 含 `14ec911` 之後版本  
3. 管理區建類型與官方配色後，前台驗收套用
