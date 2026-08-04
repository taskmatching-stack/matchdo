# 工作區 handoff（2026-08-05 · 材料組合 × 數位資產庫）

> **給新 Chat 接續用**：本輪主題為「材料組合 TAB 進設計者資產庫」＋「設計頁從資產庫匯入參考圖」。  
> **遠端 `main` 已推送至 `d046658`，本機 working tree clean。**

---

## 0. 新 Chat 第一句可貼

```
請先讀 docs/PROGRESS-handoff-2026-08-05-material-combo-assets.md。
延續材料組合／數位資產庫；最小改動、勿動已驗證 UI（同格勾選圖庫等）。
```

---

## 1. 使用者要什麼（定案，勿改回去）

| 需求 | 正確理解 |
|------|----------|
| 材料組合 TAB 在「我的數位資產」 | **設計者**資產庫：`/client/my-custom-products.html` 與設計頁右側 `#pastGeneratedGallery`，不是只有廠商 `manufacturer-materials.html` |
| 材料組合生成 | **任何登入＋點數**即可；**不得**綁「須有廠商資料／return=design 才算設計入口」 |
| 管理員 | **`isAdminUserId` 獨立分支**；與一般設計者能力分開，勿混為一談 |
| 設計頁匯入資產庫 | 參考圖每槽有 **「我的資產庫」**；右側縮圖放大 Modal 有 **「加入參考圖」** |
| 圖庫 AI 重繪 | 仍遵守 `docs/DO-NOT-flatten-gallery-ai-preview.md`（同格原圖上／新圖下，禁止 flatten） |

---

## 2. 已推送 commit（`origin/main`）

| Hash | 摘要 |
|------|------|
| `d046658` | 設計頁：參考槽「我的資產庫」＋資產預覽「加入參考圖」 |
| `cf59e9c` | 數位資產庫材料組合 TAB、API、生成後寫入、blob→data URL 修復 |
| `0c7f5d1` | `collectPendingUploadPayload`：`item`→`p`（待傳上傳 500） |
| `cf33fcf` | 材料組合 flux：登入＋扣點即可；admin 無須廠商 gate |
| `7d3ad08` 等 | 三入口材料組合 TAB、metadata、`return=design` 基礎 |

**最新 HEAD：** `d046658`

---

## 3. 功能地圖（部署後去哪看）

### 3.1 材料組合 TAB（設計者資產庫）

順序一律：**設計圖 → 材料組合 → 情境圖 → 我的最愛**

| 位置 | 檔案 | 說明 |
|------|------|------|
| 產品設計頁右側 | `public/custom-product.html` + `custom-product.js` | `#pastGalleryTabs`，資料來自 `MatchdoDigitalAssetPicker` |
| 我的數位資產 | `public/client/my-custom-products.html` | `#tab-combo` / `#pane-combo`；`?tab=material_combo` |
| 共用選擇器 | `public/js/digital-asset-picker.js` | `TABS` 含 `material_combo` |

### 3.2 材料組合生成

| 位置 | 說明 |
|------|------|
| `public/client/material-dual-color.html` | POST 含 `main_hex` / `accent_hex`；`?return=design` 回設計頁 |
| `POST /api/me/vendor-assets/material-dual-color-flux` | 成功後 `insertUserMaterialComboGeneration` |
| `GET /api/me/material-combo-generations` | 資產庫列表；表不存在時回 `{ table_missing: true, items: [] }` |

### 3.3 設計頁匯入資產庫 → 參考圖（`d046658`）

| 入口 | 行為 |
|------|------|
| 參考圖各槽 **「我的資產庫」** | `openAssetPickerModalForRefSlot(slotKey)` → 選圖 → `importDigitalAssetToRefSlot` |
| 右側資產縮圖 → Modal **「加入參考圖」** | 有 `data-material-combo` 時自動進 **材料** 槽 |

### 3.4 廠商／供應商後台（先前已有，非本輪新增）

- `public/client/manufacturer-materials.html` — `#tab-material-combo`
- `public/client/supplier-catalog-manage.html` — `#tab-material-combo`

---

## 4. 部署前／後必做

### 4.1 Supabase SQL（若尚未執行）

**檔案：** `docs/add-user-material-combo-generations.sql`

- 建表 `user_material_combo_generations`
- 未執行時：材料組合 TAB **永遠空白**（API 靜默 `table_missing`）
- 僅 `ENABLE ROW LEVEL SECURITY`；讀寫經 **server.js service role**，正常

### 4.2 Cloud Shell 部署

**只貼** [`docs/deploy-matchdo-push-and-deploy.md`](deploy-matchdo-push-and-deploy.md) **§3.1 整行**（含 `grep --line-buffered -v -E 'Regional Access Boundary|taskmatchlng'`）。  
Agent 給指令時**禁止**刪掉 grep。

### 4.3 部署後版本自查

| 項目 | 預期 |
|------|------|
| `custom-product.js` | `?v=148` |
| `digital-asset-picker.js` | `?v=3` |
| 我的資產頁 console | `__MATCHDO_MY_ASSETS_BUILD = 'material-combo-tab-library-20260804'` |
| 材料組合生成頁 | `__MATCHDO_DUAL_COLOR_BUILD = 'material-combo-gen-no-mfr-gate-20260804'` |

### 4.4 建議手動驗收

1. 登入 → 材料組合頁生成一張 → **我的數位資產**／設計頁右側 **材料組合** 分頁有圖  
2. 設計頁 → 材料槽 → **我的資產庫** → 選材料組合 → 參考圖出現、材料補充有雙色說明  
3. 右側資產庫點縮圖 → **加入參考圖**  
4. 用材料組合圖生設計（先前 blob URL 會 500；現應走 `data:` URL）

---

## 5. 關鍵檔案索引

| 用途 | 路徑 |
|------|------|
| 設計頁主邏輯 | `public/js/custom-product.js` |
| 資產選擇器 | `public/js/digital-asset-picker.js` |
| 我的數位資產 | `public/client/my-custom-products.html` |
| 材料組合生成 UI | `public/client/material-dual-color.html` |
| API + 寫入 | `server.js`（`insertUserMaterialComboGeneration`、`GET/POST material-combo`） |
| DB  migration | `docs/add-user-material-combo-generations.sql` |
| FLUX／提示詞政策 | `docs/flux-and-gemini-prompt-policy.md`、`.cursor/rules/flux-gemini-prompt-policy.mdc` |
| 圖庫同格 UI 禁令 | `docs/DO-NOT-flatten-gallery-ai-preview.md` |
| 完整對話紀錄 | agent transcript `92991383-3ed3-4e47-94bb-6b6cfdb90449` |

---

## 6. 已知 bug 根因（勿重犯）

| 現象 | 根因 |
|------|------|
| 待傳上傳 500 `item is not defined` | `collectPendingUploadPayload` 迴圈變數是 `p` 不是 `item` |
| 材料組合圖生設計 500，看可搭配卻正常 | `applyDesignDualColorImport` 曾用 `URL.createObjectURL` → 後端只吃 `data:`；已改 `FileReader.readAsDataURL` |
| 使用者說「TAB 做了四次都沒有」 | TAB 只加在廠商頁，**沒加** `digital-asset-picker.js` / `my-custom-products.html` |
| 宣稱完成但線上看不到 | 未 push、未 deploy、或 Supabase 表未建 |

---

## 7. Agent 工作守則（本專案）

1. **最小 diff** — 只改使用者當次要求；修 A 不重構 B  
2. **Bootstrap 5.0.0** — 無 `Modal.getOrCreateInstance`；Modal 全頁只建一次  
3. **改 i18n** — 有 `data-i18n` 的文案要改 `public/locales/zh-TW.json`（及 en）  
4. **部署** — 先 `git push origin main` 再給 Cloud Shell §3.1 整行  
5. **勿 commit** 除非使用者明確要求  
6. **Cursor OOM** — 長對話易 `reason: oom`；大改完 **開新 Chat**，少並行讀 `server.js` 全檔  

---

## 8. 可能後續（未做／未確認）

- [ ] 確認 Supabase 已跑 `add-user-material-combo-generations.sql`  
- [ ] 確認 Cloud Run 已 deploy 到 `d046658`  
- [ ] 材料組合紀錄 **刪除** API／UI（目前僅列表，無刪除）  
- [ ] 「用於產品設計」從我的資產卡片 **深連結** 到設計頁並自動匯入該圖（現只連到 `/custom-product.html`）  
- [ ] RLS policy 若日後要讓 client 直連 Supabase 再補  

---

## 9. 與舊 handoff 的關係

- 通用 embed／廠商版型 handoff 仍見 [`PROGRESS-handoff-2026-06-30.md`](PROGRESS-handoff-2026-06-30.md)  
- **本文件優先**於材料組合、設計者數位資產庫、設計頁匯入相關議題  

---

*最後更新：2026-08-05 · 對應 `main` @ `d046658`*
