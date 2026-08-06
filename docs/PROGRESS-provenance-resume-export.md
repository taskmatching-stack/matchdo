# 生圖履歷 — 進度 Handoff

**Baseline：** `ca32d39`（2026-08-07）  
**P1 上線 commit：** `472a5bd`  
**P2 上線 commit：** `2a9c287`  
**P3 上線 commit：** `77be87d`  
**規劃主檔：** `docs/PLAN-provenance-resume-export.md`  
**全站功能說明：** `docs/網站功能說明-使用者版.md` §十一、`docs/網站功能說明-管理員版.md` §五

---

## 狀態：**主線已完成**（2026-08-07）

| 期別 | Commit | 內容 |
|------|--------|------|
| P1 | `472a5bd` | `user_design` + `promo_scene`：JSON／PDF API、資產庫、後台生圖紀錄 modal |
| P2 | `2a9c287` | `material_combo` + `print` + `embed_visitor` 履歷 |
| P3 | `77be87d` | composed prompt 持久化、扣點 FK、衍生鏈、後台批量 ZIP |

---

## 已完成

- [x] 統一 schema v1（`owner` / `admin` audience；admin 多 `_internal`）
- [x] `lib/provenance-resume.js` + `lib/provenance-resume-pdf.js` + `lib/provenance-resume-zip.js`
- [x] API：`GET /api/me|admin/provenance-resume`（JSON）、`export.pdf`、`POST …/export.zip`（admin，≤40 筆）
- [x] 前台：我的數位資產（設計稿／情境圖／材料組合／印花）卡片「履歷」
- [x] 前台：Embed 訪客紀錄 `/client/embed-design-records.html`
- [x] 後台：生圖紀錄詳情 → 履歷／PDF；本頁勾選 → 批量 ZIP
- [x] Migration：`docs/add-provenance-resume-fields.sql`（id=`provenance-resume-fields`）
- [x] 新設計稿／情境圖／商攝導演：寫入 `credit_transaction_id`、`composed_flux_prompt`（設計稿）、`generation_meta_json`；情境圖來自設計稿時自動 `parent_record`

---

## 上線後必做

1. **部署** Cloud Run（見 `docs/deploy-matchdo-push-and-deploy.md` §3.1）
2. **Migration** 後台 → 資料庫維護 → **`provenance-resume-fields`**
3. **驗收**
   - 新產一張設計稿 → 履歷含完整模型 prompt（migration 後）
   - 後台生圖紀錄 → 勾選 2 筆 → 匯出 ZIP（含 JSON + PDF）

---

## 待做（可選 backlog）

- [ ] 舊資料 backfill `credit_transaction_id`（舊圖履歷扣點欄可能為空）
- [ ] 重繪／放大／寫實化等衍生入口自動帶 `parent_record_*`
- [ ] 前台資產庫批量 ZIP
- [ ] Embed 表也持久化 `composed_flux_prompt`（目前僅設計稿／情境圖）

---

## 程式索引

| 檔 | 用途 |
|----|------|
| `lib/provenance-resume.js` | 查表、組裝 JSON |
| `lib/provenance-resume-pdf.js` | PDF |
| `lib/provenance-resume-zip.js` | 批量 ZIP |
| `public/js/provenance-resume-ui.js` | 共用 modal |
| `public/admin/generation-records.html` | 後台列表 + 批量匯出 |
| `public/client/my-custom-products.html` | 資產庫履歷按鈕 |
| `public/client/embed-design-records.html` | Embed 訪客履歷 |
| `server.js` | 路由 + 生圖寫入 provenance 欄位 |

---

## 部署

commit → push → Cloud Shell（見 `docs/deploy-matchdo-push-and-deploy.md` §3.1）
