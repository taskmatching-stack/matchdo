# MatchDO「合做」系統架構與落地規劃

更新日期：2026-02-04

## 1. 現況分析（Workspace 現態）
- 前端：目前為 Bootstrap / 靜態 HTML 模板（public/admin/*），尚未綁定任一 JS 框架或打包工具。
- 執行：`npm start` 在根目錄與 public/admin 皆失敗（Exit Code: 1），推測尚無前端開發伺服器或腳本設定。
- 後端：未見任何 API/Server 程式碼；資料存取與金流尚未串接。
- 結論：目前為「靜態介面」階段，適合先以漸進方式導入 Supabase、金流與 AI 服務。

## 2. 網站功能地圖（Site Map）
將網站分為五大區塊，圍繞「發案、報價、媒合、金流」的主線：

### A. 服務媒合（Service Matching）
- AI 發案艙：圖片上傳區、AI 規格自動拆解顯示區。
- 專案管理：已發佈項目、工項拆包狀態、媒合成功廠商清單。
- 私密查看：僅在點擊「合做」後，開啟廠商聯繫資料與對話框。
- **使用場景**：裝修服務、維修服務、專業服務等

### B. 客製產品（Custom Product）✨ NEW
- 產品示意圖輸入：
  - **方式一**：AI 生成圖片（Gemini 3 Pro Image Preview）- 用戶輸入文字描述
  - **方式二**：上傳產品圖片 - 支援多圖上傳
- AI 產品分析：識別產品類型、材質、工藝需求、製作難度
- 訂製廠商媒合：推薦合適的訂製工廠/工作室
- 預算與數量管理：設定預算範圍與訂製數量
- **使用場景**：家具訂製、裝飾品訂製、客製化商品等

### C. 專家／承包商端（Supply Side）
- 報價管理系統（591 模式）：單一工項上架、單價設定、AI 自動生成隱藏 Tags。
- 報價單期限管理：顯示剩餘天數、一鍵更新價格／續期。
- 任務牆：顯示 AI 媒合中的項目、已確認「合做」的歷史記錄。
- **訂製廠商專區**：展示可訂製產品類別、製作能力、成功案例
D. AI 媒合引擎（Core Engine）
- 規格轉換層：將圖紙轉為 JSON 規格清單（工項＋規格 Tags）。
- **產品分析層**：識別產品特徵、材質、工藝需求 ✨ NEW
- **圖片生成層**：文字描述轉換為產品示意圖 ✨ NEW
- 標籤比對層：執行「發案 Tags」vs「專家 Tags」的 SQL 交叉比對。

### E
### D. 後台管理（Admin）
- 審核機制：專家身分審核、檢舉處理。
- 營運數據：訂閱轉換率、刊登費流量、熱門工項統計。

## 3. 技術架構（Technical Architecture）
採事件驅動、可擴充的雲端風格：

- 前端：Bootstrap / Vanilla JS（初期），後續可選用 Vite + 原生 ES Modules；以 Supabase JS SDK 處理 Auth、資料存取與 Realtime。
- AI 大腦：Gemini 3.0 (Vision) 用於雙向標籤生成：
  - 發案：拆圖 → 3 個工項，每項 3 個規格 Tags。
  - 專家：輸入「品名／價格」→ 5 個隱藏 Tags（SEO＋語義擴展）。
- 資料庫：Supabase（PostgreSQL + Storage + Edge Functions）。
- 金流：Stripe 或綠界（ECPay）
  - 會員訂閱（月費）＋單次刊登費（591 模式）。
- 架構模式：
  - 事件（Event）舉例：`DemandUploaded`、`SupplyListingCreated`、`TagsGenerated`、`MatchComputed`、`ContactUnlocked`、`PaymentProcessed`、`ExpiryChecked`。
  - 由 Edge Functions/定時任務（Supabase Scheduler 或外部 Cron）觸發，更新狀態與下游資料。

## 4. 資料模型（PostgreSQL 建議 Schema）
以 JSONB/Array 儲存 Tags，兼顧靈活與 SQL 查詢性能：

- `users`
  - `id` (uuid, PK), `email`, `role` ('demand'|'expert'|'admin'), `subscription_tier` ('free'|'expert')
- `experts_profile`
  - `user_id` (FK users), `verified_status` (bool), `skills_tags` (text[]), `rating` (numeric)
- `listings`（報價單）
  - `id` (uuid, PK), `user_id` (FK users), `item_name` (text), `price` (numeric), `tags_generated` (text[]), `expire_at` (timestamptz), `status` ('active'|'expired')
- `projects`（發案）
  - `id` (uuid, PK), `owner_id` (FK users), `image_url` (text), `ai_components` (jsonb)，例如：[{'name':'門窗','qty':2}, ...]
  - `component_tags` (jsonb)，例如：{'門窗':['鋁框','雙層玻璃','隔音'], ...}
  - `status` ('draft'|'published'|'matched'|'closed')
- `matches`
  - `id`, `project_id` (FK), `listing_id` (FK), `score` (numeric)，`tags_overlap_count` (int)，`price_fit` (bool)，`created_at`
  - `unlocked_by_user_id` (FK users, nullable) — 何時解鎖聯繫
- `conversations`
  - `id`, `user_a`, `user_b`, `project_id`, `opened_at`
- `payments`
  - `id`, `user_id`, `type` ('subscription'|'listing'), `amount`, `currency`, `status` ('pending'|'paid'|'failed'), `provider` ('stripe'|'ecpay'), `provider_id`
- `admin_flags`
  - `id`, `target_type` ('user'|'listing'|'project'), `target_id`, `reason`, `status` ('open'|'resolved')

> 索引建議：`listings(tags_generated)` 使用 GIN（`USING gin` on `jsonb_path_ops` 或 `btree_gin` for array element）以提升交集查詢效率。

## 5. 核心資料流程（Data Flow）

### 5.1 專家上傳（刊登費模式）
1) 專家輸入「品名 / 價格」→ 上傳提交。
2) Edge Function 呼叫 Gemini → 產出 5 個隱藏 Tags。
3) 寫入 `listings`（`expire_at = now() + interval '90 days'`）。

### 5.2 發案上傳（圖紙拆解）
1) 發案者丟圖至 Storage。
2) Edge Function 呼叫 Gemini → 產出 3 個工項 × 每項 3 個規格 Tags（寫入 `projects`）。

### 5.3 自動比對（SQL 層）
- 符合條件：`tags_overlap >= 1 && price 在容許範圍 && expire_at > now()`。
- 交集計算（示例）：
```sql
-- 計算兩個 text[] 的交集數量
WITH p AS (
  SELECT id AS project_id, array['鋁框','雙層玻璃','隔音']::text[] AS demand_tags
), l AS (
  SELECT id AS listing_id, array['鋁框','木框','隔音']::text[] AS expert_tags, price, expire_at
  FROM listings
  WHERE status = 'active' AND expire_at > now()
)
SELECT p.project_id, l.listing_id,
       (
         SELECT COUNT(*)
         FROM UNNEST(p.demand_tags) dt
         WHERE dt = ANY(l.expert_tags)
       ) AS tags_overlap,
       (l.price BETWEEN 1000 AND 2000) AS price_fit
FROM p CROSS JOIN l
WHERE (
  SELECT COUNT(*) FROM UNNEST(p.demand_tags) dt WHERE dt = ANY(l.expert_tags)
) > 0;
```
- 依交集數、價格適配度等綜合得分排序，寫入 `matches`。

### 5.4 解鎖聯繫（合做）
- 發案者點擊「合做」→ 紀錄 `unlocked_by_user_id`，建立 `conversations`，雙方可私訊溝通。

## 6. 會員與付費機制（Monetization）
- 普通用戶（free）：免費註冊，免費 AI 拆圖；僅能看平均行情，無法解鎖廠商。
- 訂閱專家（月費）：可上架報價單、AI 標籤生成、享有「合做」優先推薦權。
- 單次刊登費：每條報價單上架 90 天；過期需補費或確認價格，避免殭屍資料。

## 7. 邊界與安全
- 金流：採用 Stripe / 綠界；Edge Functions 驗證簽章與 webhook，確保支付狀態可信。
- 隱私：廠商聯絡資料僅在「合做」後揭露；資料庫分權控管（RLS）。
- 風控：專家審核與檢舉機制；高風險關鍵字與異常行為（上架過量、惡意價差）監控。

## 8. 實作路線圖（Roadmap）
- Phase 1 (MVP)：Bootstrap 靜態介面、導入 Supabase Auth（註冊／登入）、建置基本 Schema。
- Phase 2 (AI Core)：Supabase Edge Functions 串 Gemini Vision，能輸出 JSON（工項＋Tags）。
- Phase 3 (Matching)：PostgreSQL 函數／檢視完成標籤比對，提供排名結果。
- Phase 4 (Business)：刊登期限檢查、金流（Stripe／綠界）與訂閱／刊登費邏輯，含 webhook。

## 9. API 與 Edge Functions 設計建議
- `POST /functions/v1/generate-listing-tags`：輸入 `item_name/price` → 回傳 `tags_generated[]`。
- `POST /functions/v1/extract-project-specs`：輸入 `image_url` → 回傳 `ai_components[]`＋`component_tags{}`。
- `POST /functions/v1/compute-matches`：基於條件計算並寫入 `matches`（或回傳候選清單）。
- `POST /functions/v1/unlock-contact`：紀錄解鎖與建立對話。
- `POST /functions/v1/payment-webhook`：金流通知（Stripe/綠界）。

## 10. 風險與對策
- AI 輸出品質：加入人工覆核入口（專家可微調 Tags）。
- 標籤維度擴張：以字典／同義詞庫增強（Edge Function 內部維護）。
- 查詢效能：對 `listings.tags_generated`、`projects.component_tags` 建 GIN 索引，必要時以物化檢視快取。

---
命名規則：網站名稱以「MatchDO 合做」為準（非「合作」）。
