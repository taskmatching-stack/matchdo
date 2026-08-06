# 生圖履歷 — 進度 Handoff

**Baseline：** `ca32d39`（2026-08-07）  
**規劃主檔：** `docs/PLAN-provenance-resume-export.md`

## 已完成

- [x] 規劃：前後台 audience、schema、分期
- [x] P1：`lib/provenance-resume.js`（user_design + promo_scene）
- [x] P1：`lib/provenance-resume-pdf.js` + API（me + admin）
- [x] P1：後台生圖紀錄 modal 履歷／PDF
- [x] P1：我的資產庫（設計稿、情境圖）履歷按鈕
- [x] P1：`public/js/provenance-resume-ui.js` 共用 modal

## P2 待做

- material_combo、print、embed_visitor
- `credit_transaction_id` migration
- 批量 ZIP

## 部署

P1 完成後：commit → push → Cloud Shell（見 `docs/deploy-matchdo-push-and-deploy.md` §3.1）
