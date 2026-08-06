# 生圖履歷 — 進度 Handoff

**Baseline：** `ca32d39`（2026-08-07）  
**P1 上線 commit：** `472a5bd`  
**P2 上線 commit：** `2a9c287`  
**規劃主檔：** `docs/PLAN-provenance-resume-export.md`

## 已完成

- [x] P1：`user_design` + `promo_scene`（API、PDF、資產庫、後台生圖紀錄）
- [x] P2：`material_combo` + `print` + `embed_visitor`
- [x] P3 migration：`docs/add-provenance-resume-fields.sql`（`credit_transaction_id`、`composed_flux_prompt`、`generation_meta_json`、`parent_record_*`）
- [x] P3：新設計稿／情境圖寫入 composed prompt 與扣點 FK
- [x] P3：後台生圖紀錄批量 ZIP（JSON + PDF，最多 40 筆）

## 待做（可選）

- 舊資料 backfill `credit_transaction_id`（無 FK 時履歷仍顯示「未保存」）
- 重繪／放大等衍生入口自動帶 `parent_record_*`
- 前台資產庫批量 ZIP

## 部署

commit → push → Cloud Shell（見 `docs/deploy-matchdo-push-and-deploy.md` §3.1）  
**上線後請執行 migration：** 後台 → `provenance-resume-fields`
