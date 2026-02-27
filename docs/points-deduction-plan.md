# 扣點功能規劃與放大功能預計位置

更新日期：2026-02-22

---

## 一、扣點僅此五處（一覽）

| # | 行為 | 扣點 | 規則 key（payment_config） | 觸發 API／時機 | 實作狀態 |
|---|------|------|----------------------------|----------------|----------|
| 1 | **AI 文生圖**（無參考圖） | 15 點 | `points_text_to_image` | `POST /api/generate-product-image`，無 referenceImages，**成功生圖後** | 待接扣點 |
| 2 | **AI 圖生圖**（有參考圖） | 20 點 | `points_image_to_image` | `POST /api/generate-product-image`，有 referenceImages，**成功生圖後** | 待接扣點 |
| 3 | **AI 放大** | 10 點 | `points_ai_upscale` | `POST /api/upscale-image`，**成功放大後**（僅前台；管理區不扣點） | 待 API 與頁面 |
| 4 | **對話視窗翻譯**（一段 1 點） | 1 點 | `points_translation` | 未來翻譯 API 成功後 | 尚未實作 |
| 5 | **額外刊登接案製作資訊** | 200 點 | `points_listing_per_category` | 製作方啟用「超出方案額度」的接案分類時 | 待接扣點 |

- 後端扣點前先讀取對應 key，若為 0 則不扣、不寫流水。
- 餘額不足時回傳 **402**，body 帶 `{ error: '點數不足', balance }`。

---

## 二、點數規則來源（後台可調）

| 規則 key | 說明 | 預設值 |
|----------|------|--------|
| `points_text_to_image` | AI 文生圖 每次 | 15 |
| `points_image_to_image` | AI 圖生圖 每次 | 20 |
| `points_ai_upscale` | AI 放大 每次 | 10 |
| `points_translation` | 對話翻譯 每段 | 1 |
| `points_listing_per_category` | 額外刊登接案 每分類/月 | 200 |

後台「會員管理」→ 點數規則已支援上述五項；讀取規則用 `getPointsConfig()`（見下）。

---

## 三、後端共用扣點（必備）

| 項目 | 說明 |
|------|------|
| **getPointsConfig()** | 讀取 `payment_config` 上述五個 key，回傳整數（未設定則用預設）。 |
| **deductPoints(userId, amount, source, description, metadata)** | 查 `user_credits` 餘額 → 不足回傳 `{ ok: false, balance }`；足夠則更新餘額、寫入 `credit_transactions`（type: consumed），回傳 `{ ok: true, balance_after }`。 |

- 各 API 在「確定要扣點」時呼叫 `deductPoints`；若 `ok: false` 則該 API 回傳 402。
- `POST /api/credits/consume` 可保留給其他用途；內部扣點建議用 `deductPoints()`，避免前端濫用。

---

## 四、放大功能預計放置位置

- **與發案流程無關**：一般瀏覽與「設計→儲存→找製作方」不需放大，故不放在主流程。
- **管理區**：當**工具**使用，**不扣點**。
- **前台**：當**使用者個人工具**，**扣 10 點/次**。

| 位置 | 預計入口／路徑 | 扣點 |
|------|----------------|------|
| **管理區** | 後台選單 **「AI 工具」**（或「圖片工具」）→ **「AI 放大」**；新頁如 `admin/ai-tools.html` 或 `admin/upscale.html`；上傳圖片→呼叫 `POST /api/upscale-image`（後端依管理員身分不扣點）→ 下載結果 | **不扣點** |
| **前台** | 獨立頁 **`/client/ai-upscale.html`**（或「我的」下拉選單「AI 圖片放大」）；登入後上傳圖片→呼叫 `POST /api/upscale-image`（一般使用者）→ 成功扣 10 點、回傳放大圖與下載 | **10 點/次** |

- API：同一支 `POST /api/upscale-image`，依是否為**管理員**決定是否扣點。

---

## 五、各行為扣點流程摘要

### 1. AI 文生圖（15 點）

- **API**：`POST /api/generate-product-image`（無 referenceImages）。
- **流程**：生圖成功後 → 若已登入且 `points_text_to_image > 0` → 查餘額 → 不足 402 → 足夠則 `deductPoints(..., 15, 'text_to_image', 'AI 文生圖')` → 回傳圖片。
- **前端**：點數不足時提示並導向 `/credits.html`。

### 2. AI 圖生圖（20 點）

- **API**：`POST /api/generate-product-image`（有 referenceImages）。
- **流程**：同上，扣點用 `points_image_to_image`，source: `image_to_image`，description: 「AI 圖生圖」。

### 3. AI 放大（10 點）

- **API**：`POST /api/upscale-image`。
- **流程**：若為**管理員**（後台）→ 不扣點；若為**一般使用者**→ 放大成功後讀取 `points_ai_upscale`，扣點、寫流水（source: `ai_upscale`）。
- **前端**：前台獨立頁；管理區「AI 工具」頁。

### 4. 對話翻譯（1 點）— 尚未實作

- **觸發**：未來翻譯 API 成功後，每段扣 1 點（source: `translation`）。

### 5. 額外刊登接案（200 點）

- **觸發**：製作方啟用「超出方案內含」的接案分類時（需有接案分類 API／資料）。
- **流程**：檢查餘額 → 不足 402 → 足夠則扣 200、寫流水（source: `listing_category`，metadata 可帶 category_key、月份）。

---

## 六、實作順序建議

| 順序 | 項目 |
|------|------|
| 1 | 後端：實作 **getPointsConfig()**、**deductPoints()**（或沿用既有 consume 邏輯封裝）。 |
| 2 | 後端：**generate-product-image** 成功後依有無參考圖分別扣 15／20 點；不足回 402。 |
| 3 | 前端：生圖 API 回傳 402 時提示「點數不足」並導向儲值頁。 |
| 4 | 後端：新增 **POST /api/upscale-image**（Stability Fast）；管理員不扣點、一般使用者成功後扣 10 點。 |
| 5 | 前台：新增 **`/client/ai-upscale.html`**（AI 圖片放大）；管理區：新增「AI 工具」→「AI 放大」頁。 |
| 6 | 額外刊登接案：在啟用超出額度之接案分類的 API 接 200 點扣點。 |
| 7 | 對話翻譯：功能上線後接 1 點/段扣點。 |

---

## 七、與現有程式對照

| 現有 | 說明 |
|------|------|
| `GET/PATCH /api/admin/points-config` | 已支援五個 key（points_text_to_image、points_image_to_image、points_ai_upscale、points_translation、points_listing_per_category）。 |
| `POST /api/credits/consume` | 保留；內部扣點可抽成 deductPoints 或經由此 API。 |
| `user_credits`、`credit_transactions` | 已存在；deductPoints 只更新餘額與寫入一筆 consumed。 |
| 後台「點數規則」 | `admin/membership.html` 已顯示上述五項。 |

---

以上為扣點功能規劃與放大功能預計位置；Stability API 細節與成本見 **`docs/ai-upscale-stability-evaluation-and-plan.md`**。
