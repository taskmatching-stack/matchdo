# 進度：材料組合 · 配色範例

> **最後更新**：2026-08-06  
> **本機未 push**（配色內容多語系＋拖曳排序待 commit）  
> **對照規劃**：`docs/PLAN-material-color-palettes.md`  
> **相關**：`docs/PLAN-material-dual-color-compose.md`

---

## 狀態總覽

| 項目 | 狀態 | 備註 |
|------|------|------|
| DB 表＋migration 白名單 | ✅ | `add-material-color-palettes.sql`；比重欄位見下 |
| 比重欄位 migration | ✅ | `docs/add-material-color-palette-ratios.sql`；id=`material-color-palette-ratios` |
| Admin 類型＋官方雙／三色 CRUD | ✅ | `/admin/material-color-palettes.html`（色數／比重／輔色）；類型內 ↑↓ |
| 材料組合「配色範例」Modal | ✅ | 官方｜我的 → 類型 Tab → 表格；顯示輔色／比重 |
| 我的配色（帳號共用） | ✅ | 存目前配色（含三色／比重）／編輯／刪 |
| 我的配色類型內拖曳排序 | ✅ | 左側把手 → `PATCH …/me/… { sort_order }` |
| 官方類型／配色內容多語系 | ✅ 本輪 | `name_en` 等＋`note_en`；後台欄位；`?lang=`；見 `docs/admin-content-multilang-for-frontend.md` |
| 套用＝填表單 | ✅ | 對齊色數、HEX、比重；不自動存／不自動生圖 |
| T1 選色 UI＋色卡按比例 | ✅ | 雙色 75/25｜50/50；三色自訂％＋canvas |
| T2 範例存讀比重 | ✅ | API／Admin／我的／套用 |
| 生圖提示跟實際％ | ✅（併入 T1） | `buildMaterialDualColorFluxPrompt` 用 `ratio_percents` |
| 部署 | ⏳ | commit／push → Cloud Shell |

---

## 已定案（勿改）

1. 入口：設計區材料組合、官方版型庫、廠商版型庫、供應商區（同一 `material-dual-color` 頁）  
2. 「我的配色」：**帳號共用**（不分區）  
3. 官方類型：管理區字典（**風格分類，與材質無關**）；我的類型：自由字、可選填  
4. 前台綜覽：**表格**，不用下拉選一筆  
5. Tab：**官方｜我的**，其下 **每個類型一個 Tab**  
6. 手動色號＋手動存為主；套用只填表單  
7. 前端 **不露出模型名稱**；Step2 主線為生圖（路由／點數 key 歷史名 `…flux` 勿寫進產品文案）

---

## 部署／驗收 checklist

1. [ ] 執行 `add-material-color-palettes.sql`（若尚未建表）  
2. [ ] 執行 `add-material-color-palette-ratios.sql`（或後台維護 id=`material-color-palette-ratios`）  
3. [ ] commit＋push 本輪後再 Cloud Shell deploy  
4. [ ] 管理區建類型＋雙色（75/25 與 50/50）＋至少一筆三色  
5. [ ] 材料組合：切雙／三、改比重 → 色卡即時變  
6. [ ] 配色範例套用 → 色數／HEX／比重對齊；「存成我的」後可再套用  

**Cloud Shell 部署**（靜音版，見 `docs/deploy-matchdo-push-and-deploy.md` §3.1）：

```bash
gcloud config set account taskmatching@gmail.com
gcloud config set project matchdo
```

```bash
cd ~/matchdo && git fetch origin main && git reset --hard origin/main && ( gcloud run deploy matchdo --source . --region=asia-northeast1 --allow-unauthenticated --clear-base-image && gcloud run services update-traffic matchdo --region=asia-northeast1 --to-latest ) 2>&1 | grep --line-buffered -v -E 'Regional Access Boundary|taskmatchlng'
```

---

## 比重定案（2026-08-06）

- 雙色：固定 **75/25（預設）**＋**50/50**  
- 三色：**自訂％**合計 100；canvas = `floor`＋最後一段餘數，1024 PNG  
- `ratio_preset`：`dual_75_25`｜`dual_50_50`｜`tri_custom`  
- `ratio_percents`：JSONB 整數陣列  

## 下一輪（可選）

- 三色快速「帶入數字」預設（非必須）  
- 印花仍一區擇一（維持）  
- 正式 deploy 後補官方內容  

## 本輪變更（我的拖曳排序）

- `public/js/material-color-palette-picker.js`：同一類型內 HTML5 DnD；存檔用下一個 `sort_order`  
- `public/client/material-dual-color.html`：把手樣式＋提示；build 標記更新  
- 後端：既有 `PATCH /api/me/material-color-palettes/:id` 已支援 `sort_order`，無需新 API／SQL  

## 本輪變更（官方內容多語系）

- SQL：`docs/add-material-color-palette-i18n.sql`（migration id=`material-color-palette-i18n`）  
- 後台類型／配色：名稱（英文）＋其他語系；備註英文  
- `GET /api/material-color-palettes/platform?lang=` 回傳已本地化的 `name`／`note`／類型名  
- 文件／規則：`docs/admin-content-multilang-for-frontend.md`、`.cursor/rules/admin-content-multilang.mdc`  
- build：`material-combo-palette-i18n-20260806`

