# 進度：材料組合 · 配色範例

> **最後更新**：2026-08-06  
> **HEAD（功能上線 commit）**：`14ec911`  
> **對照規劃**：`docs/PLAN-material-color-palettes.md`  
> **相關**：`docs/PLAN-material-dual-color-compose.md`（雙色生圖管線；三色預規劃見下方／PLAN）

---

## 狀態總覽

| 項目 | 狀態 | 備註 |
|------|------|------|
| DB 表＋migration 白名單 | ✅ | `docs/add-material-color-palettes.sql`；後台「資料庫維護」id=`material-color-palettes` |
| Admin 類型字典＋官方雙色 CRUD | ✅ | `/admin/material-color-palettes.html` |
| 材料組合「配色範例」Modal | ✅ | 官方｜我的 → **每類型一 Tab** → **表格**套用 |
| 我的配色（帳號共用） | ✅ | 存目前兩色／編輯／刪 |
| 一鍵寫入主色／配色 HEX | ✅ | 不扣點、不動材質／印花／FLUX |
| 三色 UI／三色色卡／三色 FLUX | ⏳ 預規劃 | 見 PLAN §三色預規劃；**本輪不做 code** |
| 部署 | ⏳ 使用者 Cloud Shell | 須先跑 SQL 再建官方類型／配色 |

---

## 已定案（勿改）

1. 入口：設計區材料組合、官方版型庫、廠商版型庫、供應商區（同一 `material-dual-color` 頁）  
2. 「我的配色」：**帳號共用**（不分區）  
3. 官方類型：管理區字典；我的類型：自由字、可選填  
4. 前台綜覽：**表格**，不用下拉選一筆  
5. Tab：**官方｜我的**，其下 **每個類型一個 Tab**  
6. 禁止：首頁／媒體牆自動 Gemini 補標這類偷渡（與配色無關但同週已禁）

---

## 部署／驗收 checklist

1. [ ] Supabase 或後台維護執行 `add-material-color-palettes.sql`  
2. [ ] `git` 已於 `14ec911`（或更新）deploy  
3. [ ] 管理區建至少 1 個類型＋數筆官方雙色  
4. [ ] 材料組合 → 配色範例 → 官方表格套用 → 兩框 HEX＋色卡預覽變了  
5. [ ] 「把目前兩色存成我的」後，我的 Tab／類型 Tab 看得到並可再套用  

**Cloud Shell 部署**（靜音版，見 `docs/deploy-matchdo-push-and-deploy.md` §3.1）：

```bash
gcloud config set account taskmatching@gmail.com
gcloud config set project matchdo
```

```bash
cd ~/matchdo && git fetch origin main && git reset --hard origin/main && ( gcloud run deploy matchdo --source . --region=asia-northeast1 --allow-unauthenticated --clear-base-image && gcloud run services update-traffic matchdo --region=asia-northeast1 --to-latest ) 2>&1 | grep --line-buffered -v -E 'Regional Access Boundary|taskmatchlng'
```

---

## 下一輪（三色）接續點

見 **`docs/PLAN-material-color-palettes.md` →「三色預規劃」**。  
實作前需使用者確認：三種色塊比重 preset 的具體比例數字、印花仍「一區擇一」是否延用。
