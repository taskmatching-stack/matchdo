# 限時特價（年付訂閱）— 規劃

> **狀態**：規劃定案，待實作（2026-09-26）  
> **進度 handoff**：`docs/PROGRESS-pricing-campaigns.md`  
> **金流現況**：`docs/PROGRESS-payment-subscription-handoff.md`

---

## 1. 產品定案（使用者確認）

| 項目 | 規則 |
|------|------|
| 特價範圍 | 僅 **年付**（`billing=yearly`） |
| 月付 | **永不**套用活動價，一律常態 `subscription_plans` 月費 |
| 單次儲值 | **v1 不特價**（`topup_presets` / `credits.html` 不讀活動表） |
| 特價語意 | 檔期內完成 **年付一次付清** 的訂單，整段年訂閱期依 **當次成交價**；活動結束不 retroactive 改已付訂單 |
| 牌價年付 | 與現行一致：**月費 × 10**（TWD、USD 各自計算） |
| 活動年付 | 後台設定 **整年特價**（TWD 一筆、USD 一筆），或相對牌價年付的折扣％（實作時二選一，建議 v1 **直接填特價金額**） |
| 每月點數 | v1 **不變**（仍為方案 `credits_monthly × 12` 年付入點邏輯） |
| 檔期 | 全球同一瞬間開關：`starts_at` / `ends_at` 為 `timestamptz`；後台以 **台北時間**輸入並顯示 UTC 對照 |
| 疊加 | v1 **同時間僅一檔** `is_enabled` 且落在檔期內（`priority` 保留欄位，預設 0） |

### 與現有「83 折」年付的關係

前台年付已是「10 個月價」相對月付 ×12 的結構折扣。限時特價是 **在牌價年付之上** 再降（或直接把活動年付設低於 `monthly×10`）。UI 建議：年付切換時顯示 **牌價年付（刪除線）＋活動年付＋活動主題**。

---

## 2. 現況與缺口（實作前必讀）

| 現有能力 | 缺口 |
|----------|------|
| 常態價：`subscription_plans`、`/admin/membership.html` | 無檔期、無主題文案 |
| 前台：`GET /api/subscription-plans`、`subscription-plans.html` | 價格來自 DB，無 `sale` 欄位 |
| 結帳：URL 帶 `amount` / `credits` → `subscription-checkout.html` | **伺服器未依方案重算**，與活動無關 |
| PayPal 年付：`POST /api/payment/paypal/create` + `billing=yearly` | 信任 body.amount |
| PayPal 月訂：`create-subscription` + `ensurePayPalBillingPlan` 快取 | v1 活動 **不碰**月訂 |
| 內部優惠方案：`seed-promo-subscription-plans.sql`（sort≥10） | 與公開檔期活動 **分開** |

**必做**：`quote` 算價 + 結帳 API 只接受 quote 結果（順便補常態價驗證）。

**勿做**：活動期間改寫 `subscription_plans.price` 或 `syncTopupPresetsFromPaidPlans` 覆寫牌價。

---

## 3. 資料模型

Migration：`docs/add-pricing-campaigns.sql`（id：`pricing-campaigns`）

### 3.1 `pricing_campaigns`

| 欄位 | 型別 | 說明 |
|------|------|------|
| `id` | uuid PK | |
| `title` | text NOT NULL | 活動主題（繁中／預設 UI） |
| `title_en` | text | 英文主題（前台 `lang=en`） |
| `note_internal` | text | 後台備註 |
| `starts_at` | timestamptz NOT NULL | 含起點 |
| `ends_at` | timestamptz NOT NULL | 含終點（建議後台說明：結束日 23:59:59 台北） |
| `input_timezone` | text NOT NULL DEFAULT `Asia/Taipei` | 記錄後台輸入時區（IANA） |
| `is_enabled` | boolean DEFAULT true | 手動關閉 |
| `priority` | int DEFAULT 0 | v1 未疊加時可忽略 |
| `created_at` / `updated_at` | timestamptz | |

有效活動查詢：

```text
is_enabled = true
AND now() >= starts_at AND now() < ends_at
ORDER BY priority DESC, starts_at DESC
LIMIT 1
```

### 3.2 `pricing_campaign_yearly_rules`

每檔活動、每個公開方案一列（`plan_key` = `tier2` | `tier3` | `tier4`）。

| 欄位 | 型別 | 說明 |
|------|------|------|
| `id` | uuid PK | |
| `campaign_id` | uuid FK → pricing_campaigns | ON DELETE CASCADE |
| `plan_key` | text NOT NULL | 與結帳 `metadata.plan_key`、前台 `data-plan` 一致 |
| `yearly_price_twd` | int NOT NULL | 活動整年台幣（≥1） |
| `yearly_price_usd` | numeric(10,2) NOT NULL | 活動整年美金（PayPal） |
| UNIQUE | `(campaign_id, plan_key)` | |

未填寫的方案＝該檔活動不折扣該 tier（仍賣牌價年付）。

---

## 4. 算價（`lib/pricing-campaigns.js` 建議）

### 4.1 常態牌價（無活動）

對 `plan_key` 解析 `subscription_plans`（依 `plan_key` 或 sort_order 1/2/3 對 tier2/3/4，與 `server.js` `INTERNAL_SUBSCRIPTION_PLAN_KEYS` 篩選後的公開方案一致）：

| billing | TWD | USD | credits |
|---------|-----|-----|---------|
| monthly | `price` | `price_usd_monthly` | `credits_monthly` |
| yearly | `price * 10` | `resolvePlanUsdMonthly(plan) * 10` | `credits_monthly * 12`（與前台 `yearlyCredits` 一致） |

### 4.2 活動年付

若存在有效 `campaign` 且該 `plan_key` 有 rule：

- `amount_twd` = `yearly_price_twd`
- `amount_usd` = `yearly_price_usd`
- `list_twd` / `list_usd` = 牌價年付（顯示用）
- `campaign_id`, `title` / `title_en`

否則年付回傳牌價，`campaign` 欄位 null。

### 4.3 `resolveCheckoutQuote({ planKey, billing, currencyMode, now })`

- `billing !== 'yearly'` → 只回常態月付，**忽略活動表**
- `billing === 'yearly'` → 套用 §4.2
- `currencyMode`：`twd` | `usd`（與 `paymentUiLangFromReq` / `PaymentLocale` 一致）
- 回傳單一 `amount`、`credits`、`campaign_id?`、`list_amount?`

結帳建立訂單前 **必須** 呼叫；body 的 amount 與 quote 不符 → 400。

---

## 5. API

| 方法 | 路徑 | 權限 | 行為 |
|------|------|------|------|
| GET | `/api/pricing-campaign/active` | 公開 | 目前有效活動摘要 + 各 tier 年付特價（無則 204 或 `{ campaign: null }`） |
| GET | `/api/subscription-plans` | 公開 | 擴充每 plan：`yearly_list_*`、`yearly_sale_*`、`campaign_title`（僅年付相關；月付欄位不變） |
| POST | `/api/payment/quote` | 登入 | body: `{ plan, billing, lang? }` → quote |
| GET | `/api/admin/pricing-campaigns` | admin | 列表（含已結束） |
| GET | `/api/admin/pricing-campaigns/:id` | admin | 單檔 + rules |
| POST | `/api/admin/pricing-campaigns` | admin | 建立 |
| PATCH | `/api/admin/pricing-campaigns/:id` | admin | 更新 |
| DELETE | `/api/admin/pricing-campaigns/:id` | admin | 刪除（或僅允許 `is_enabled=false`） |

**修改既有結帳**（同一 PR 內）：

- `POST /api/payment/paypal/create`（年付）
- `POST /api/payment/ecpay/create`（年付，`billing=yearly`）
- **不修改** `create-subscription`（月訂）

`payment_orders.metadata` 建議增：

```json
{
  "plan_key": "tier3",
  "billing": "yearly",
  "campaign_id": "uuid-or-null",
  "list_amount": 330,
  "quoted_amount": 279
}
```

（`list_amount` 與 `quoted_amount` 幣別同 `currency` 欄。）

---

## 6. 後台 UI

**新頁**：`/admin/pricing-campaigns.html`（側欄：金流區，在「金流設定」旁）

| 區塊 | 內容 |
|------|------|
| 列表 | 主題、檔期（台北 + UTC）、狀態（未開始／進行中／已結束／已停用）、操作 |
| 編輯 | 主題中／英、備註、開始／結束（datetime + 固定說明「以台北時間輸入」）、啟用 |
| 規則表 | 方案二／三／四 各一列：年付特價 TWD、年付特價 USD |
| 預覽 | 呼叫內部 preview API 或前端用牌價公式對照 |
| 警告 | 月付不受影動；已年付用戶不受活動結束影響；PayPal 以 USD 為準 |

**內容多語**：活動主題走 DB `title` / `title_en`（對齊 `.cursor/rules/admin-content-multilang.mdc` 精神；此為行銷文案非 locales 檔）。

---

## 7. 前台 UI

| 頁面 | 變更 |
|------|------|
| `subscription-plans.html` | 年付價格區：有活動時顯示牌價＋特價＋主題條；月付不顯示活動 |
| `subscription-checkout.html` | URL **可只帶** `plan` + `billing=yearly`；進頁 `POST /api/payment/quote` 填 amount/credits；顯示活動主題 |
| `credits.html` | v1 不變 |

`locales`：可加通用 key如 `pricing.campaignEnds`；主題文字用 API 回傳，不寫死 locales。

---

## 8. 實作順序（建議 PR 切分）

### PR1 — 資料 + 算價 + Admin CRUD（無前台）

1. Migration + `lib/admin-migrations.js`
2. `lib/pricing-campaigns.js`（查有效活動、quote、牌價年付）
3. Admin API + `pricing-campaigns.html`
4. 單元測試：檔期邊界（UTC）、無 rule 的 tier、月付忽略活動

### PR2 — 前台顯示 + quote

1. 擴充 `GET /api/subscription-plans` 或 `GET /api/pricing-campaign/active`
2. 方案頁年付 UI
3. `POST /api/payment/quote` + checkout 改 quote

### PR3 — 結帳強制驗價 + metadata

1. PayPal / 綠界 create 年付路徑
2. `payment-orders.html` 可選顯示 `campaign_id` / 牌價 vs 實付

### 不做（v1）

- 月付特價、儲值特價、同價加點、多檔疊加、PayPal Billing Plan 快取改版（月訂不特價故不需要）

---

## 9. 測試清單

- [ ] 活動開始前：年付顯示牌價，quote = 牌價
- [ ] 活動中：僅 tier 有 rule 的顯示特價；月付 quote 仍為常態月費
- [ ] 活動結束：自動恢復牌價年付
- [ ] `is_enabled=false`：即時下線
- [ ] 檔期邊界：台北 0:00 / 23:59 與 UTC 對照
- [ ] PayPal 年付：實付 USD = quote；metadata 含 campaign
- [ ] 篡改 checkout body amount → 400
- [ ] 英文頁：主題 `title_en` fallback `title`

---

## 10. 關鍵檔案（實作後）

| 用途 | 路徑 |
|------|------|
| 規劃 | 本檔 |
| SQL | `docs/add-pricing-campaigns.sql` |
| 算價 | `lib/pricing-campaigns.js`（新建） |
| API | `server.js` 或拆 `routes/payment-quote.js`（若拆檔需 `node --check`） |
| 後台 | `public/admin/pricing-campaigns.html` |
| 前台 | `subscription-plans.html`、`subscription-checkout.html` |
| 金流交接 | `docs/PROGRESS-payment-subscription-handoff.md`（實作後補一節連結） |

---

## 11. 勿做

- ❌ 為 SEO 在 `custom-product.html?tab=` 加方案活動頁
- ❌ 活動期改 `subscription_plans` 常態價當「臨時特價」
- ❌ 讓 `topup_presets` 與活動連動（v1）
- ❌ 未跑 quote 就信任前端年付金額
