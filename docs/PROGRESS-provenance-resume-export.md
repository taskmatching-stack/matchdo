# 生圖履歷 — 進度 Handoff

**Baseline：** `ca32d39`（2026-08-07）  
**P1 上線 commit：** `472a5bd`  
**規劃主檔：** `docs/PLAN-provenance-resume-export.md`

## 已完成

- [x] 規劃：前後台 audience、schema、分期
- [x] P1：`user_design` + `promo_scene`（API、PDF、資產庫、後台生圖紀錄）
- [x] P2：`material_combo` + `print` + `embed_visitor`
- [x] P2：材料組合／印花 tab、Embed 訪客紀錄頁履歷
- [x] P2：有 `credit_transaction_id` 時帶交易時間

## P3 待做

- 批量 ZIP 匯出
- 設計稿／情境圖 `credit_transaction_id` 回寫 migration
- 衍生鏈 `parent_record`、composed prompt 持久化

## 部署

commit → push → Cloud Shell（見 `docs/deploy-matchdo-push-and-deploy.md` §3.1）
