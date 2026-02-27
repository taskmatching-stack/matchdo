# 上傳雲端時機與 Vercel 適用性評估

## 一、適合上傳到雲端的階段

建議在以下**至少達到 (1)(2)** 時再部署到雲端對外開放：

| 階段 | 內容 | 是否必須先上線 |
|------|------|----------------|
| **(1) 環境齊全** | `.env` 已設好（Supabase、綠界測試/正式）、綠界 Notify URL 為**公網 HTTPS** | 是，綠界回調需公網 |
| **(2) 金流回調就緒** | 後端有 `/api/payment/notify`，驗證 CheckMacValue 並可回傳 `1\|OK` | 是，否則付款成功無法更新訂單 |
| **(3) 基本流程可測** | 登入、發案、媒合、靜態與 API 在本地或測試網域可完整跑一輪 | 建議 |
| **(4) 正式金流** | 已取得綠界正式 MerchantID，切換為正式環境 | 可上線後再切換 |

**實務建議**：
- **先部署到「測試/預覽網址」**（例如 Vercel 或 Render 的預覽 URL），用綠界**測試環境**把付款、Notify 跑通。
- 確認 Notify 收得到、訂單狀態會更新後，再申請綠界**正式**帳號、改正式參數並切換。

---

## 二、Vercel 適不適合你的系統？

### 你的系統特色
- **後端**：單一 Node.js **Express 伺服器**（`server.js`），常駐聆聽、提供 API 與靜態檔。
- **依賴**：Supabase（Auth、DB、Storage）、綠界（金流）、Gemini（AI）。
- **較重操作**：`POST /api/match/run-split`（迴圈查 DB、計分、寫入 matches）、上傳轉傳 Supabase。
- **結構較單純、啟動速度不錯** → 在 Vercel serverless 或 Render 免費層冷啟動時，延遲通常可接受。

### Vercel 的特性與限制

| 項目 | 說明 |
|------|------|
| **部署模型** | 以 **Serverless Functions** 為主，每個請求獨立執行、有**執行時間上限**（Hobby 約 10 秒、Pro 約 60 秒）。 |
| **Express** | 可把整個 Express 包成「單一 serverless function」對外，但等同每次請求冷啟動一次 Express，且受上述時間限制。 |
| **綠界 Notify** | 很適合：綠界 POST 到 Notify URL → 觸發一次 function → 驗證、更新 DB、回傳 `1\|OK`，通常幾秒內完成。 |
| **run-split 媒合** | 若專案/工項多、迴圈久，有可能超過 **10 秒**（Hobby），Pro 60 秒較安全，或需優化（分批、快取）。 |
| **靜態與前端** | 靜態檔、前端頁面用 Vercel 很合適（CDN、快）。 |

### 結論：Vercel 的適用性

- **可以用的情況**  
  - 你願意把 Express 當成「單一 serverless function」部署（或拆成少數幾個 API route）。  
  - 媒合（run-split）執行時間在方案時限內（或你升級 Pro 拉長到 60 秒／或優化演算法）。  
  - 綠界只用「單次付款」或簡單流程，Notify 處理輕量。

- **不那麼適合的情況**  
  - 希望傳統「一台 Node 常駐跑 Express」、不想改 serverless 架構。  
  - 有長時間背景任務、WebSocket、或需要常駐 process。  
  - 不想被 Hobby 10 秒 / Pro 60 秒限制，又不想先做優化。

**簡短建議**：  
- 若以**先上線、金流與 Notify 能動**為目標，Vercel **可以**用，但要接受 Express 以 serverless 方式跑、並注意 run-split 超時。  
- 若希望**架構簡單、少改後端**，**Render 或 Railway** 更貼近「一台 Node 伺服器」的用法，沒有單次請求 10/60 秒的硬限制。

---

## 三、Render 和 Vercel 比較

| 項目 | **Vercel** | **Render** |
|------|------------|------------|
| **部署模型** | Serverless（每個請求觸發一次 function） | 傳統 Web Service（一台 Node 常駐跑） |
| **免費方案** | ✅ 有（Hobby 免費）；Pro 付費 | ✅ 有（約 750 小時/月）；約 15 分鐘無流量會休眠 |
| **冷啟動** | 每次請求都可能冷啟動（幾百 ms～數秒） | 免費層：休眠後第一次請求約 **50 秒～1 分鐘**；付費層可常駐、無休眠 |
| **單次請求時間上限** | Hobby 約 **10 秒**、Pro 約 **60 秒** | 無硬性上限，run-split 再久也不會被砍 |
| **Express 怎麼跑** | 需把整個 app 包成「一個 serverless function」或拆成多個 API route | **直接 `npm start` 跑 `node server.js`**，不用改架構 |
| **靜態 / 前端** | 很強（全球 CDN、預覽部署、Git 整合） | 可一起由同一個 Node 服務提供，或拆成 Static Site |
| **綠界 Notify** | 適合（短請求、幾秒內回傳 `1\|OK`） | 適合；若在免費層休眠時打來，需等喚醒（綠界會重試） |
| **適合你專案嗎** | 可以，但要接受 Express 改 serverless、run-split 別超過 10/60 秒 | **較貼合**：現有 `server.js` 幾乎不用改、直接部署，免費層冷啟動你已能接受 |

**一句話**：  
- **Vercel**：前端與輕量 API 體驗好，Express 要配合 serverless，有請求時間上限。  
- **Render**：就是「一台 Node 伺服器」，架構單純、無請求時限，免費層代價是閒置會休眠、喚醒約 1 分鐘。

**對你這套系統的建議**：若不想改後端架構、又希望零月費，**Render 免費層**較好配合；若你偏好 Vercel 的部署與預覽流程，再考慮把 Express 包成 serverless 並注意 run-split 時間。

---

## 四、其他雲端選型（與 Vercel 對照）

| 平台 | 適合情境 | 優點 | 注意 |
|------|----------|------|------|
| **Vercel** | 前後端分離、API 輕量或可接受 serverless 時限 | 部署簡單、預覽環境、CDN、與 Git 整合好 | Express 需包成 function、run-split 注意逾時 |
| **Render** | 傳統 Node 一機跑到底 | 免費/付費都有 Web Service、常駐 Node、環境變數齊全 | 免費方案會 sleep、冷啟動較慢 |
| **Railway** | 同上，想快速從 Git 部署 Node | 支援 Docker/Node、資料庫與服務同一平台 | 付費制，用量計費 |
| **Fly.io** | 要更多控制、多區域部署 | 全球節點、VM 等級 | 設定較多 |

**若選 Vercel**：  
- 需在專案根目錄設 `vercel.json`，把 API 與靜態路由指到同一個 Node server（或拆成多個 function）。  
- 環境變數在 Vercel 後台設定 `SUPABASE_*`、`ECPAY_*`、`BASE_URL`（或 `VERCEL_URL` 由 Vercel 自動提供）。

**若選 Render**：  
- 選 "Web Service"，Build Command 可為 `npm install`，Start Command 為 `npm start`。  
- 在 Render 後台設定環境變數，並把綠界 Notify URL 設成 `https://<your-app>.onrender.com/api/payment/notify`。

---

## 五、現在還差什麼？（部署前待辦）

要達到「綠界測試成功 + PayPal」再部署，目前專案狀態與缺口如下。

| 項目 | 狀態 | 說明 |
|------|------|------|
| **綠界環境** | ✅ 已有 | `config/ecpay-config.js`、`.env` 填 ECPAY_MERCHANT_ID / HASH_KEY / HASH_IV。 |
| **綠界：建立訂單／導向付款** | ✅ 已做 | `POST /api/payment/ecpay/create`：建立 payment_orders、組參數與 CheckMacValue、回傳自動送出表單 HTML。 |
| **綠界：Notify 回調** | ✅ 已做 | `POST /api/payment/notify`：驗證 CheckMacValue、更新 payment_orders、入點（user_credits + credit_transactions）、回傳 `1\|OK`。 |
| **綠界：付款完成返回頁** | ✅ 已做 | `/payment/return.html?order_id=xxx` 顯示結果說明（實際入點以 Notify 為準）。 |
| **PayPal：建立訂單／導向付款** | ✅ 已做 | `POST /api/payment/paypal/create`：建立 payment_orders、呼叫 SDK 建立訂單、回傳 approval_url。 |
| **PayPal：完成請款／入點** | ✅ 已做 | 用戶從 PayPal 返回帶 `token`，前端呼叫 `POST /api/payment/paypal/capture` 完成請款並入點（無 Webhook）。 |
| **付款／訂單資料** | ✅ 已做 | `docs/payment-orders-schema.sql` 有 `payment_orders` 表；點數用 `user_credits`、`credit_transactions`（見 subscriptions-schema）。 |
| **前端：選擇付款方式** | ✅ 已做 | `/credits.html`：我的點數、儲值（金額/點數、選綠界或 PayPal）、前往付款／返回結果。 |

**總結**：  
- **點數與雙金流**：已實作點數查詢 `GET /api/me/credits`、扣點 `POST /api/credits/consume`、綠界建立+Notify、PayPal 建立+Capture、前端 `/credits.html` 與 `/payment/return.html`。  
- **環境變數**：綠界、PayPal 可改由**後台「金流設定」**填寫（上線後自行更換正式帳號，無需改 .env）。未填則沿用 .env。須執行 `docs/payment-orders-schema.sql`、`docs/subscriptions-schema.sql`、**`docs/payment-config-schema.sql`**（金流設定表）。綠界測試：<https://vendor-stage.ecpay.com.tw>；PayPal 測試：<https://developer.paypal.com> Sandbox。

完成上述金流與回調後，即可部署到雲端並用綠界測試 + PayPal 做驗證。

---

## 六、綠界環境與上線檢查清單

- [ ] 已在 `.env` 設定 `ECPAY_MERCHANT_ID`、`ECPAY_HASH_KEY`、`ECPAY_HASH_IV`（測試或正式）
- [ ] `BASE_URL` 為實際對外網址（例如 `https://xxx.vercel.app` 或 `https://xxx.onrender.com`）
- [ ] 綠界後台「付款回調網址」設為 `{BASE_URL}/api/payment/notify`（須公網 HTTPS）
- [x] 後端實作 `/api/payment/notify`，驗證 CheckMacValue 並回傳 `1|OK`
- [ ] 正式環境：申請綠界正式帳號後，改為正式 MerchantID / HashKey / HashIV，並設 `ECPAY_USE_PRODUCTION=1`（若依 config 設計）
- [ ] PayPal：`.env` 設定 `PAYPAL_CLIENT_ID`、`PAYPAL_CLIENT_SECRET`，測試時 `PAYPAL_SANDBOX=true`；執行 `npm install`（含 `@paypal/checkout-server-sdk`）

以上完成後，即可在該雲端環境進行付款測試與正式上線。

---

## 七、Render / Railway / Fly.io 免費方案比較（2024–2025）

| 平台 | 是否有免費方案 | 免費內容與限制 |
|------|----------------|----------------|
| **Render** | ✅ 有 | **Web Service 免費層**：每月約 750 小時執行時間；**約 15 分鐘無流量會休眠**，下次請求冷啟動約 **50 秒～1 分鐘**。無需信用卡、可綁自訂網域與 SSL。本系統結構單純、啟動快，若流量不密集，冷啟動尚可接受；綠界 Notify 回調若在休眠後觸發，需等喚醒後才回應（綠界會重試）。 |
| **Railway** | ⚠️ 試用後需付費 | **新帳號**：約 30 天內有 **$5 試用額度**，用罄或到期後需加信用卡；之後最低約 **$1/月** 起（依用量計費）。無「永久免費」方案，但用量少時月費很低。 |
| **Fly.io** | ⚠️ 試用為主 | **新帳號**：免費試用約 **2 小時 VM 運行時間** 或 **7 天**（先到為止）；試用結束後多數需綁定付款方式。部分舊帳號有 3 台 256MB 免費機的優惠，新用戶通常無長期免費方案。 |

**若想盡量零月費**：**Render 免費層**最實際，代價是約 15 分鐘沒人用就會睡著、下次要等約 1 分鐘喚醒；你系統結構單純、啟動速度不錯，喚醒延遲在可接受範圍內。  
**若可接受小額月費**：Railway 約 $1～5/月 可常駐不休眠，適合要避免冷啟動的場景。
