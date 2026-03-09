# 送點／發點功能說明

更新：2026-03-05（已實作，後台可開關）

---

## 一、功能概述

| 項目 | 說明 |
|------|------|
| **註冊送點** | 後台可開關、可設點數。用戶**第一次**觸發「查點數」時發放一次（不會重複）。 |
| **每月發點** | 後台可開關。每個日曆月內，用戶**第一次**觸發「查點數」時發放當月點數（有付費方案用該方案 `credits_monthly`，否則用「免費會員每月點數」）。 |

**觸發時機**：「查點數」= 前端呼叫 **GET /api/me/credits**。例如登入後個人選單下方顯示點數、進入「我的點數」頁、進入「我的 AI 編輯區」等，都會呼叫此 API。因此通常**登入後第一次看到選單點數**時就會同時發放註冊點（若符合資格）與當月每月點（若符合資格）。

---

## 二、後台設定

**位置**：後台 → 會員／訂閱管理 → **點數規則** 分頁 → **發點設定** 區塊。

| 設定項 | payment_config key | 說明 |
|--------|--------------------|------|
| 註冊送點（勾選） | `grant_welcome_points_on_register` | 開關，存 `'1'`/`'0'` |
| 註冊贈送點數 | `welcome_points_amount` | 整數，預設 0 |
| 每月發點（勾選） | `grant_monthly_points_enabled` | 開關，存 `'1'`/`'0'` |
| 免費會員每月點數 | `monthly_points_free_tier` | 整數，無付費訂閱時使用，預設 150 |

預設兩開關為**關閉**，不影響既有行為；啟用後由後台儲存即可，不需改程式。

---

## 三、技術細節

- **發點邏輯**：在 **GET /api/me/credits** 回傳前，呼叫 `ensureGrantPointsIfEnabled(user.id)`，依 `payment_config` 與 `credit_transactions` 判斷是否發放。
- **註冊送點**：若開關為 on 且該用戶尚無 `source = 'welcome'` 的 `credit_transactions`，則發放 `welcome_points_amount`。
- **每月發點**：若開關為 on 且該用戶當月尚無 `source = 'monthly_grant'` 的紀錄，則計算點數（有有效訂閱 → `subscription_plans.credits_monthly`，否則 `monthly_points_free_tier`）並發放。
- **紀錄**：發點時寫入 `user_credits`（餘額、total_earned）與 `credit_transactions`（`type: 'granted'`，`source: 'welcome'` 或 `'monthly_grant'`）。
- **API**：GET/PATCH **/api/admin/points-config** 會一併讀寫上述四個 key，僅管理員可存。

---

## 四、與方案「每月點數」的關係

- **方案設定**中的「每月點數」（`subscription_plans.credits_monthly`）在**每月發點**啟用時，會用來發給**有該方案有效訂閱**的用戶。
- 無付費訂閱或訂閱已過期者，當月發點數額由「免費會員每月點數」決定。
