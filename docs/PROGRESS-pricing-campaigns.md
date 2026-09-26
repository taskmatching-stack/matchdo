# 限時特價（年付）— 進度

> 規劃：`docs/PLAN-pricing-campaigns.md`  
> 金流基線：`docs/PROGRESS-payment-subscription-handoff.md`

## 定案摘要

- 僅 **年付** 特價；月付、儲值不特價。
- 檔期內年付成交價適用 **整段年訂閱**；活動結束只影響新單。
- 牌價年付 = 月費 × 10；活動價由後台每 tier 填整年 TWD / USD。

## 已完成

- [x] 產品定案與技術規劃（2026-09-26）
- [x] DB：`docs/add-pricing-campaigns.sql` + migration `pricing-campaigns`
- [x] `lib/pricing-campaigns.js`（算價、檔期、CRUD  helper）
- [x] Admin：`/admin/pricing-campaigns.html` + CRUD API + 側欄
- [x] `GET /api/subscription-plans` 擴充年付牌價／特價 + `campaign`
- [x] `GET /api/pricing-campaign/active`
- [x] `POST /api/payment/quote`
- [x] 年付 PayPal／綠界 + 月訂 PayPal／綠界 **驗價**（`scripts/test-pricing-campaigns.js`）
- [x] 前台方案頁年付特價顯示、結帳頁 quote

## 部署後必做

1. `/admin/db-migrations.html` 執行 **pricing-campaigns**（或 Supabase 跑 `docs/add-pricing-campaigns.sql`）
2. `/admin/pricing-campaigns.html` 建立檔期並填 tier 年付特價
3. Sandbox：年付結帳金額與方案頁一致；篡改 URL amount 應 400

## 待選（非 v1）

- [ ] `payment-orders.html` 顯示 `metadata.campaign_id`／牌價 vs 實付
- [ ] 結帳 URL 僅帶 `plan` + `billing`（完全移除 amount query）
