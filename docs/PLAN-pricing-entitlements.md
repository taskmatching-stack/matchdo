# 個人訂閱優惠鎖價（P1-A）

> **狀態**：規劃定案（2026-09-29），待分 Phase 實作  
> **進度**：`docs/PROGRESS-pricing-campaigns.md` §A  
> **前置**：限時檔期 v1（`pricing_campaigns`）、牌價年付 DB（P1-B）已上線

## 1. 產品定案（建議預設）

| 名詞 | 定義 |
|------|------|
| **僅本訂閱期** `subscription_term` | 成交當次年付（或月訂）整段有效期內，續約／換方案依**當下**牌價與檔期重算（= 現行檔期年付語意 + 訂單 metadata 留存） |
| **終身鎖價** `lifetime` | 同一 `user_id` + `plan_key` + `billing` 在**續約年付**（與同 tier 升級規則另議）時，仍用鎖定的 `amount`／`currency`，直到管理員撤銷 |

**v1 不鎖**：tier 權益（`credits_monthly`、功能旗標）— 權益仍跟 `subscription_plans` 現行表；僅鎖**年付成交價**（TWD／USD 分開記）。

**預設**：所有新成交、檔期活動、手動指派若未勾選終身 → `subscription_term`。

## 2. 資料模型（Phase 1 migration）

`docs/add-user-pricing-entitlements.sql`（尚未實作）

| 欄位 | 說明 |
|------|------|
| `user_id` | auth.users |
| `plan_key` | tier2／tier3／tier4 |
| `billing` | `yearly`（v1 僅年付鎖價；月訂 Phase 2） |
| `currency` | TWD／USD |
| `locked_amount` | 鎖定年付金額 |
| `scope` | `subscription_term` \| `lifetime` |
| `source` | `campaign` \| `admin_grant` \| `order` |
| `campaign_id` | 可空 |
| `expires_at` | `subscription_term` 時 = 該次 `user_subscriptions.end_date`；`lifetime` = NULL |
| `revoked_at` | 管理員撤銷 |

唯一約束（建議）：`(user_id, plan_key, billing, currency)` WHERE `revoked_at IS NULL` AND (`expires_at IS NULL` OR `expires_at > now()`)。

## 3. 流程

### 3.1 成交寫入（Phase 1）

年付 `payment_orders` 標記 `paid` 且建立／延長 `user_subscriptions` 時：

1. 自 `metadata` + quote 寫入 entitlement，`scope=subscription_term`，`expires_at=end_date`。
2. 若未來後台「手動終身」：POST admin API，`scope=lifetime`，`expires_at=NULL`。

### 3.2 Quote（Phase 2）

`buildPaymentCheckoutQuote`：

1. 查有效 entitlement（`lifetime` 或 `expires_at > now()`）。
2. 若 `billing=yearly` 且命中 → `amount=locked_amount`（仍驗 credits 現行方案）。
3. 否則沿用 `computeListYearlyPrices` + 檔期 rule。

### 3.3 後台（Phase 3）

- `/admin/membership.html` 或新「用戶鎖價」：搜 user、選 tier、填年付 TWD/USD、勾選終身。
- 列表顯示 `user_pricing_entitlements` + 連結來源訂單。

## 4. 實作順序

| Phase | 內容 |
|-------|------|
| **1** | SQL + migration 登記；付款成功寫入 `subscription_term` entitlement（與 metadata 雙寫） |
| **2** | `quote`／PayPal／綠界讀 `lifetime` 鎖價 |
| **3** | 後台指派／撤銷 UI |
| **4** | 換 tier、退款、撤銷後邊界測試 |

## 5. 與現有能力關係

- **檔期活動**：仍全域；成交後 entitlement 快照活動價，檔期結束不影響已鎖 `subscription_term` 期內價格（已符合現行）。
- **牌價年付 DB**：`computeListYearlyPrices` 的 list；鎖價可低於或等於當次 list／sale。
- **內部方案 sort≥10**：維持分開；終身指派不取代隱藏 tier 指派流程。
