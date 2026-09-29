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
- [x] **P1-B** 牌價年付 `yearly_price_twd`／`yearly_price_usd`（`4c15b36`）；migration `subscription-plan-yearly-price`

## 部署後必做

1. `/admin/db-migrations.html` 執行 **pricing-campaigns**（或 Supabase 跑 `docs/add-pricing-campaigns.sql`）
2. 執行 **subscription-plan-yearly-price**（`docs/add-subscription-plan-yearly-price.sql`）
3. 執行 **user-pricing-entitlements**（`docs/add-user-pricing-entitlements.sql`）
4. `/admin/pricing-campaigns.html` 建立檔期並填 tier 年付特價
5. Sandbox：年付結帳金額與方案頁一致；篡改 URL amount 應 400

## 待選（非 v1）

- [x] `payment-orders.html` 顯示 `metadata.campaign_id`／牌價 vs 實付（年付訂單 metadata 含 list／quoted）
- [ ] 結帳 URL 僅帶 `plan` + `billing`（完全移除 amount query）

---

## 待辦（使用者 2026-09-29 — **前台英文化收斂後再實作**）

### A. 優惠／特價是否「終身」有效

**需求**：後台優惠功能要能標示該方案優惠是 **僅本次購買的訂閱期間**（預設、正常狀態），還是 **終身持續**（特殊案，例如老客戶鎖價）。

**現況（2026-09-29 程式）**：

| 機制 | 語意 | 是否支援「終身」 |
|------|------|------------------|
| **限時檔期年付特價** `pricing_campaigns` + `pricing_campaign_yearly_rules`（`/admin/pricing-campaigns.html`） | 檔期內成交的年付單，**整段該年訂閱**依活動價；活動結束只影響**新單** | 否；無 per-user 鎖價 |
| **常態方案** `subscription_plans`（`/admin/membership.html`） | 月費／權益由 DB 維護 | 否；改價影響新訂閱邏輯，非「個人終身優惠」旗標 |
| **內部優惠方案** `docs/seed-promo-subscription-plans.sql`（`sort_order ≥ 10`） | 與公開檔期分開的隱藏 tier | 需另查是否僅手動指派；**無**後台 UI 勾「終身」 |

**實作規劃（2026-09-29）**：見 **`docs/PLAN-pricing-entitlements.md`**（鎖年付成交價；`subscription_term` 預設；`lifetime` 需後台指派 Phase 3）。

**進度（2026-09-29）**：✅ Phase 1 年付付款寫入 `subscription_term`；✅ Phase 2 quote 讀 `lifetime`；管理員 API `POST /api/admin/user-pricing-entitlements`、`PATCH …/revoke`（無專用 UI）。待做：Phase 3 membership 鎖價 UI、Phase 4 換 tier／退款邊界。

相關規劃：`docs/PLAN-pricing-campaigns.md` §1（特價語意僅年訂閱期）。

### B. 年付金額能否從後台設定？還是硬編碼 ×10？

**簡答**：

| 價格類型 | 後台能否直接填「年付」？ | 實際來源 |
|----------|-------------------------|----------|
| **牌價年付**（無活動時前台顯示的年付） | **是**（選填） | `subscription_plans.yearly_price_twd` / `yearly_price_usd`；未填則 **`月費 × 10`**（`computeListYearlyPrices`）；後台 `/admin/membership.html`；migration `docs/add-subscription-plan-yearly-price.sql` |
| **活動年付特價** | **是** | `/admin/pricing-campaigns.html` 每 tier 填 `yearly_price_twd` / `yearly_price_usd`；檔期內 `POST /api/payment/quote` 採用 |

定案文件已寫：牌價年付 = 月費 ×10（約 10 個月價、相對月付 ×12 的結構折扣），見 `docs/PLAN-pricing-campaigns.md` §1。

**牌價年付脫離 ×10（P1-B，2026-09-29）**：✅ `yearly_price_twd` / `yearly_price_usd` + `computeListYearlyPrices` fallback ×10；後台 membership 可編；公開 `GET /api/subscription-plans` 無活動時亦帶 `yearly_list_*`；quote 沿用同一函式。

### C. 目前有「打折％」嗎？終身鎖折數

**現況：沒有百分比折扣欄位。**

- 限時年付特價：後台每 tier 填 **整年絕對金額** `yearly_price_twd` / `yearly_price_usd`（`/admin/pricing-campaigns.html`），未填則該 tier 檔期內仍用牌價年付（月費×10）。
- `lib/pricing-campaigns.js` 無 `discount_percent`、無「在牌價上打 X 折」的演算；規劃檔 v1 曾寫「填特價金額或折扣％二選一」，**實作只做了特價金額**。
- 「終身鎖價／鎖折數」：**尚未實作**（見 §A）。若要做，需另定：鎖的是 **牌價年付×折數**、還是鎖 **活動絕對價**、續約／換 tier 時是否重算。

**待做（英文化後）**：後台可選「僅本訂閱期」vs「終身」；並支援 **折數（% off 牌價年付或月費）** 與／或維持現有「整年特價金額」兩種輸入方式。
