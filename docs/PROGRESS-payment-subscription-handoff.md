# 付款／訂閱 — 交接文件（2026-09-01）

> **給新視窗 Agent：** 先讀本檔「已完成」區，**勿重複實作**。接續工作只看「待你執行」。

---

## 已完成（勿再重做）

### PayPal Sandbox 測試與修復
- [x] `return.html` 登入 session 刷新（PayPal 返回 401）
- [x] `return_to` 帶語系回原頁
- [x] 訂閱／儲值分離：`subscription-checkout.html`（訂閱）、`credits.html`（單次儲值）
- [x] 隱藏 seed／waibeizi 內部方案卡（API + 前台 filter）
- [x] PayPal  stale `APPROVAL_PENDING` 訂閱阻擋新方案 — 後端改為清 pending 而非 500
- [x] `payment-subscription` migration 掛入 `lib/admin-migrations.js`（`order_type` / `metadata`）

### 前台 UX
- [x] 方案頁「我的點數」改為醒目 Primary 大按鈕
- [x] **付款開關** `payment_checkout_enabled`（後台 `/admin/payment-settings.html`）
- [x] 關閉時：方案頁訂閱鈕「即將開放」、結帳 API 503、儲值／訂閱結帳頁提示
- [x] **幣別顯示修正**：中文頁顯示台幣、英文頁顯示 USD，不再出現 `$66元/月`
- [x] 方案功能文案依主要用途重寫（locales + `getPlanFeatures`）

### 後台價格分開設定（本輪）
- [x] DB 欄位 `subscription_plans.price_usd_monthly`（migration `add-subscription-plan-price-usd.sql`）
- [x] 後台 **會員方案** `/admin/membership.html` → 方案設定：台幣月費 + USD 月費分欄編輯
- [x] 前台方案價格由 API `price`（TWD）／`price_usd_monthly`（USD）動態顯示；PayPal 結帳用 USD
- [x] 儲值預設方案 `payment_config.topup_presets`（TWD／USD／點數 JSON）
- [x] 後台 **金流設定** `/admin/payment-settings.html` 可編輯三組儲值預設
- [x] `GET /api/payment-topup-presets`；`credits.html` 動態載入快捷按鈕
- [x] **預設關閉付款**：`parsePaymentCheckoutEnabled` 空值 = `false`；migration `add-payment-checkout-default-off.sql` 寫入 `payment_checkout_enabled=0`

### 關鍵檔案
| 用途 | 路徑 |
|------|------|
| 方案頁 | `public/subscription-plans.html` |
| 訂閱結帳 | `public/subscription-checkout.html` |
| 儲值 | `public/credits.html` |
| PayPal 返回 | `public/payment/return.html` |
| 金流後台 | `public/admin/payment-settings.html` |
| 方案後台 | `public/admin/membership.html`（方案設定分頁） |
| API | `server.js`（payment／subscription-plans／checkout-status／topup-presets） |
| Migrations | `docs/add-subscription-plan-price-usd.sql`、`docs/add-payment-checkout-default-off.sql`、`docs/payment-subscription-migration.sql` |
| 語系 | `public/locales/zh-TW.json`、`en.json` |

---

## 待你執行（部署後）

### 1. 跑 DB Migration（必做）
至 `/admin/db-migrations.html` 依序執行（若尚未跑過）：
1. `payment-subscription`
2. `subscription-plan-price-usd`
3. `payment-checkout-default-off`

或 Supabase SQL Editor 手動執行上述三個 `.sql` 檔。

### 2. 後台設定價格（必做）
1. **`/admin/membership.html`** → 方案設定：確認四方案 **台幣月費** 與 **USD 月費**（年付前台自動 ×10）
2. **`/admin/payment-settings.html`**：
   - 確認 PayPal Sandbox 憑證
   - 確認 **儲值預設方案**（三組 TWD／USD／點數）
   - **付款開關維持關閉**，直到 Sandbox 全流程測過

### 3. Sandbox 測試清單（開關仍關閉時可測 UI；要測 PayPal 需暫時開啟）
- [ ] 方案頁：中文顯示 `300 元/月`，英文 `$11/mo`
- [ ] 訂閱流程：方案 → checkout → PayPal → return → 點數／訂閱狀態
- [ ] 儲值流程：`/credits.html` 預設按鈕與自訂金額
- [ ] 關閉付款開關時無法結帳（503 + 前台提示）

### 4. 正式開放
測試完成後，於 **金流設定** 勾選「開放訂閱／儲值付款」→ 儲存。

---

## 部署

**須先 push `main` 成功**，再在 Cloud Shell：

```bash
gcloud config set account taskmatching@gmail.com
gcloud config set project matchdo
```

```bash
cd ~/matchdo && git fetch origin main && git reset --hard origin/main && ( gcloud run deploy matchdo --source . --region=asia-northeast1 --allow-unauthenticated --clear-base-image && gcloud run services update-traffic matchdo --region=asia-northeast1 --to-latest ) 2>&1 | grep --line-buffered -v -E 'Regional Access Boundary|taskmatchlng'
```

部署後以 `Done.` 為準。

---

## 架構備註

- **顯示**：`?lang=zh-TW` → 台幣（DB `price`）；`?lang=en` → USD（DB `price_usd_monthly`）
- **結帳**：PayPal 一律 USD；綠界（若啟用）台幣
- **年付**：月費 × 10（TWD、USD 各自計算，無獨立年費欄位）
- **付款預設關閉**：未在 DB 設定 `payment_checkout_enabled=1` 前，一般使用者無法結帳

---

## 勿做

- ❌ 不要把方案列表 SEO 塞進 `custom-product.html?tab=`
- ❌ 不要改 `promo-camera-app.html` / L3b 凍結檔（Store 隔離規則）
- ❌ 不要重複實作本檔「已完成」項目

---

## 相關對話

Agent transcript：`863a3493-6847-48e9-97f2-fb34650f484f`
