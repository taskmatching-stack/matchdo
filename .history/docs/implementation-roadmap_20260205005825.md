# MatchDO 實作路線圖與現況評估

更新日期：2026-02-05

## 一、現況盤點（已完成功能）

### ✅ 已實作並可用
1. **基礎架構**
   - Express 伺服器運行正常（port 3000）
   - Supabase 連線已配置（REST API + 直連）
   - 環境變數管理（.env）
   - 靜態檔案服務（Bootstrap 前端）

2. **AI 核心功能**
   - ✅ Gemini Vision API 整合完成
   - ✅ 多模態圖片分析（讀取圖片+影片）
   - ✅ 7 大分類各有專業提示詞（居家/活動/學習/運動/美業/商業/其他）
   - ✅ 子分類系統（{subcategory} 變數替換）

3. **報價功能**
   - ✅ 價格試算 API（/api/calculate-quote）
   - ✅ 項目清單產出（item_name/spec/quantity/unit）
   - ✅ price_library 資料表與查詢

4. **分類管理**
   - ✅ 分類 CRUD API（/api/categories GET/PUT）
   - ✅ 管理後台介面（/admin/categories.html）
   - ✅ 預設分類匯入功能
   - ✅ ai_categories 資料表已建立

5. **檔案處理**
   - ✅ Multer 圖片上傳（本地 uploads/）
   - ✅ 多圖上傳支援（前端預覽）
   - ✅ projects 資料表記錄

### ⚠️ 部分完成但需優化
- 資料庫連線：REST API 正常，直連有 DNS 問題（可暫時忽略）
- 錯誤處理：基本 try-catch，但缺乏統一錯誤回報機制
- 前端狀態管理：jQuery 混雜，缺乏模組化

### ❌ 尚未實作
- 用戶認證系統（Supabase Auth）
- 專家報價上架功能
- AI 媒合引擎
- 金流整合
- 私訊對話系統
- 後台審核機制

---

## 二、架構現況與規劃差異分析

### 現有架構
```
Frontend: Bootstrap + jQuery（靜態頁面）
Backend: Express.js（單一 server.js 630 行）
Database: Supabase（已建部分表）
AI: Gemini Flash 直接呼叫（無 Edge Functions）
Storage: 本地 uploads/（非 Supabase Storage）
```

### 規劃架構（架構文件）
```
Frontend: Bootstrap + Vite + ES Modules
Backend: Supabase Edge Functions
Database: 完整 Schema（10+ 表）
AI: Edge Functions 包裝 Gemini
Storage: Supabase Storage + CDN
```

### 關鍵差異
1. **伺服器層**: 現用 Express，規劃用 Edge Functions
2. **認證**: 尚未實作，規劃用 Supabase Auth
3. **檔案儲存**: 本地 vs Supabase Storage
4. **前端架構**: jQuery vs 模組化

---

## 三、務實的實作策略（建議）

### 策略 A：漸進式遷移（推薦）
**核心理念**: 保留現有 Express，逐步補齊功能，最後再考慮 Edge Functions

#### Phase 1：補齊核心流程（2-3 週）
**目標**: 完成「發案 → AI 分析 → 儲存」完整流程

1. **完善現有 AI 分析** ✨
   - [x] AI 已能讀圖並產出項目清單
   - [ ] 優化輸出格式驗證（確保 JSON 結構正確）
   - [ ] 加入重試機制（AI 失敗時）
   - [ ] 儲存 AI 原始輸出到 projects 表

2. **建立 projects 完整欄位** 📊
   ```sql
   ALTER TABLE projects ADD COLUMN IF NOT EXISTS
     ai_result JSONB,           -- AI 完整輸出
     category TEXT,              -- 所屬分類
     subcategory TEXT,           -- 子分類
     status TEXT DEFAULT 'draft', -- 狀態
     owner_id UUID;              -- 預留用戶 ID
   ```

3. **前端優化** 🎨
   - [ ] 結果頁顯示分類/子分類
   - [ ] 項目清單可編輯（修改數量/規格）
   - [ ] 加入「儲存專案」按鈕
   - [ ] 歷史專案列表頁

**里程碑驗證**: 用戶可上傳圖片 → 看到分析結果 → 儲存專案 → 查看歷史

#### Phase 2：專家報價系統（3-4 週）
**目標**: 專家可上架報價，並自動產生 Tags

1. **資料表建立** 🗄️
   ```sql
   CREATE TABLE listings (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id UUID,  -- 預留
     category TEXT NOT NULL,
     subcategory TEXT NOT NULL,
     item_name TEXT NOT NULL,
     price NUMERIC NOT NULL,
     unit TEXT,
     tags_generated TEXT[],  -- AI 產生的隱藏標籤
     expire_at TIMESTAMPTZ DEFAULT (now() + interval '90 days'),
     status TEXT DEFAULT 'active',
     created_at TIMESTAMPTZ DEFAULT now()
   );
   CREATE INDEX ON listings USING gin(tags_generated);
   ```

2. **AI 標籤生成** 🏷️
   - [ ] 新增 API：POST /api/listings/generate-tags
   - [ ] 輸入：item_name + price + category
   - [ ] Gemini 產出：5-8 個相關標籤（含同義詞）
   - [ ] 示例提示詞：
     ```
     你是專業標籤生成器。給定項目名稱和價格，產出 5-8 個相關標籤。
     
     項目：鋁窗安裝
     價格：18000/才
     分類：居家 > 窗戶 窗簾
     
     請產出 JSON 格式：
     {
       "tags": ["鋁窗", "氣密窗", "隔音窗", "窗戶安裝", "鋁框", "雙層玻璃", "窗戶施工", "窗框更換"]
     }
     ```

3. **報價上架介面** 📝
   - [ ] 新頁面：/expert/listings.html
   - [ ] 表單：分類/子分類/品名/價格/單位
   - [ ] 即時顯示產生的標籤
   - [ ] 列表顯示已上架報價（含剩餘天數）

**里程碑驗證**: 專家可上架報價 → AI 自動生成標籤 → 顯示在列表中

#### Phase 3：簡易媒合引擎（2 週）
**目標**: 發案時顯示推薦專家

1. **SQL 媒合函數** 🎯
   ```sql
   CREATE OR REPLACE FUNCTION match_listings_for_project(
     p_project_id UUID
   ) RETURNS TABLE (
     listing_id UUID,
     item_name TEXT,
     price NUMERIC,
     tags_overlap INT,
     score NUMERIC
   ) AS $$
   BEGIN
     RETURN QUERY
     WITH project_tags AS (
       SELECT unnest(
         array_agg(DISTINCT jsonb_array_elements_text(component_tags))
       ) AS tag
       FROM projects WHERE id = p_project_id
     )
     SELECT 
       l.id,
       l.item_name,
       l.price,
       (SELECT COUNT(*) FROM unnest(l.tags_generated) t 
        WHERE t IN (SELECT tag FROM project_tags))::INT AS overlap,
       (overlap * 10.0 + (CASE WHEN l.status='active' THEN 5 ELSE 0 END))::NUMERIC
     FROM listings l
     WHERE l.status = 'active' 
       AND l.expire_at > now()
       AND (SELECT COUNT(*) FROM unnest(l.tags_generated) t 
            WHERE t IN (SELECT tag FROM project_tags)) > 0
     ORDER BY score DESC, l.created_at DESC
     LIMIT 20;
   END;
   $$ LANGUAGE plpgsql;
   ```

2. **前端整合** 🔗
   - [ ] 專案詳情頁顯示「推薦報價」區塊
   - [ ] 顯示：品名/價格/標籤重疊數/評分
   - [ ] 點擊可查看報價詳情

**里程碑驗證**: 發案後自動顯示相關報價清單

#### Phase 4：用戶系統（3-4 週）
**目標**: 加入註冊登入與權限控制

1. **Supabase Auth 整合** 🔐
   - [ ] 註冊/登入頁面（Supabase Magic Link 或 Email/Password）
   - [ ] 前端加入 `supabase.auth.getSession()`
   - [ ] RLS（Row Level Security）設定
     ```sql
     ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
     CREATE POLICY "用戶只能看自己的專案"
       ON projects FOR SELECT
       USING (auth.uid() = owner_id);
     ```

2. **角色區分** 👥
   - [ ] users 表加入 role 欄位（'demand' | 'expert' | 'admin'）
   - [ ] 專家需通過身分驗證（暫時手動審核）
   - [ ] 不同角色看到不同導航

3. **頁面保護** 🛡️
   - [ ] 未登入無法發案/上架報價
   - [ ] 登入後顯示用戶頭像/選單
   - [ ] 登出功能

**里程碑驗證**: 用戶可註冊 → 登入 → 依角色使用不同功能

#### Phase 5：金流與期限（4-5 週）
**目標**: 刊登費與訂閱機制

1. **綠界 ECPay 整合**（較 Stripe 適合台灣）
   - [ ] 安裝 SDK：`npm install ecpay_aio_nodejs`
   - [ ] 建立 payments 表記錄交易
   - [ ] 上架報價時導向付款頁
   - [ ] 回呼驗證與狀態更新

2. **期限管理** ⏰
   - [ ] 定時任務（node-cron）每日檢查 expire_at
   - [ ] 即將到期通知（Email 或站內訊息）
   - [ ] 過期自動標記 status='expired'

**里程碑驗證**: 專家上架需付費 → 90 天後自動過期

---

### 策略 B：全面重構（不推薦）
直接依照架構文件重寫：
- ❌ 風險高：現有功能需全部遷移
- ❌ 時間長：預估 3-4 個月
- ❌ 不確定性：Edge Functions 可能遇到限制
- ✅ 優點：架構乾淨、可擴充性佳

**建議**: 等 MVP 上線並驗證商業模式後再考慮

---

## 四、技術債務與優化建議

### 立即處理（高優先級）
1. **server.js 模組化** 📦
   ```
   server.js (630 行) → 拆分為：
   ├── routes/
   │   ├── projects.js      // 專案相關
   │   ├── listings.js      // 報價相關
   │   ├── categories.js    // 分類管理
   │   └── ai.js            // AI 功能
   ├── services/
   │   ├── gemini.service.js
   │   └── supabase.service.js
   └── server.js (主檔案 < 100 行)
   ```

2. **錯誤處理統一** ⚠️
   ```javascript
   // middleware/errorHandler.js
   module.exports = (err, req, res, next) => {
     console.error(err);
     res.status(err.status || 500).json({
       success: false,
       error: err.message || '伺服器錯誤',
       code: err.code || 'INTERNAL_ERROR'
     });
   };
   ```

3. **環境變數驗證** ✅
   ```javascript
   // config/validate.js
   const required = ['SUPABASE_URL', 'SUPABASE_KEY', 'GEMINI_API_KEY'];
   required.forEach(key => {
     if (!process.env[key]) {
       throw new Error(`缺少必要環境變數: ${key}`);
     }
   });
   ```

### 中期優化（中優先級）
1. **前端模組化**
   - 採用 Vite 打包
   - 分離共用元件（分類選擇器/檔案上傳/結果顯示）
   - 使用 Alpine.js 或 Vue 3（輕量級）

2. **快取機制**
   - 分類清單快取（Redis 或記憶體）
   - AI 結果快取（避免重複分析相同圖片）

3. **監控與日誌**
   - Winston logger
   - Sentry 錯誤追蹤
   - 效能監控（Gemini API 回應時間）

### 長期規劃（低優先級）
1. **遷移至 Edge Functions**
   - 當流量穩定後再考慮
   - 可以 Express 與 Edge Functions 混合使用

2. **全文搜尋**
   - PostgreSQL full-text search
   - 或整合 Algolia

3. **推薦系統優化**
   - 協同過濾
   - 機器學習模型（成交率預測）

---

## 五、時程估算與資源需求

### 最小可行產品（MVP）時程
- Phase 1：2-3 週（1 名全端工程師）
- Phase 2：3-4 週（1 名全端 + 1 名前端）
- Phase 3：2 週（後端工程師）
- Phase 4：3-4 週（全端工程師）
- Phase 5：4-5 週（全端 + 金流整合經驗）

**總計**：14-18 週（約 3.5-4.5 個月）

### 關鍵里程碑
- Week 4：AI 分析流程完整可用
- Week 8：專家可上架報價
- Week 10：媒合功能上線測試
- Week 14：用戶系統上線
- Week 18：金流整合完成，正式上線

### 建議團隊配置
- 1 名資深全端工程師（專案負責人）
- 1 名前端工程師（UI/UX 實作）
- 1 名 PM（需求確認與測試）
- 外包：UI 設計師、金流整合顧問

---

## 六、風險評估與應對

### 技術風險
| 風險 | 機率 | 影響 | 應對策略 |
|------|------|------|---------|
| Gemini API 額度不足 | 中 | 高 | 加入快取、限制免費用戶次數 |
| Supabase 免費額度超標 | 中 | 中 | 監控使用量、準備升級方案 |
| 媒合準確度不佳 | 高 | 高 | 加入人工審核、持續優化標籤演算法 |
| 金流整合延遲 | 中 | 中 | 先上線「手動審核付款」過渡方案 |

### 商業風險
| 風險 | 機率 | 影響 | 應對策略 |
|------|------|------|---------|
| 專家不願付費上架 | 中 | 高 | 前期免費試用、證明媒合效果 |
| 發案量不足 | 高 | 高 | 行銷導流、與裝修平台合作 |
| 惡意報價干擾 | 低 | 中 | 身分驗證、檢舉機制 |

---

## 七、下一步行動清單

### 本週可立即執行
- [ ] 將 server.js 模組化（拆分 routes/）
- [ ] 完善 projects 表欄位
- [ ] 優化 AI 輸出格式驗證
- [ ] 建立專案歷史列表頁

### 本月目標
- [ ] 完成 Phase 1 所有功能
- [ ] 建立 listings 表
- [ ] 實作標籤生成 API
- [ ] 設計專家報價上架介面

### 季度目標
- [ ] Phase 1-3 全部完成
- [ ] 進入內部測試階段
- [ ] 準備 Phase 4 用戶系統

---

## 八、決策建議

### 建議採用：策略 A - 漸進式遷移
**理由**：
1. ✅ 快速驗證商業模式
2. ✅ 降低技術風險
3. ✅ 可彈性調整優先順序
4. ✅ 現有代碼可重用
5. ✅ 團隊學習曲線平緩

### 不建議：策略 B - 全面重構
**理由**：
1. ❌ 時程過長（4+ 個月）
2. ❌ 無法快速驗證假設
3. ❌ Edge Functions 學習成本高
4. ❌ 現有功能需全部重寫
5. ❌ 商業價值延遲實現

### 妥協方案
- 先用 Express 快速上線
- 將 AI 功能設計為獨立模組（未來易遷移）
- 關鍵業務邏輯使用 PostgreSQL 函數（不依賴特定後端）
- 前端盡量保持狀態管理簡單（方便日後重構）

---

## 結論

**當前最佳策略**：採用「策略 A - 漸進式遷移」，分 5 個 Phase 實作，預估 4-5 個月完成 MVP。

**核心優勢**：
- 現有 AI 功能已完整可用（最大價值）
- 資料庫連線穩定
- 前端介面基礎良好

**關鍵挑戰**：
- 需補齊用戶認證系統
- 媒合演算法需持續優化
- 金流整合需專業協助

**成功關鍵**：
- 專注核心流程（發案→媒合→成交）
- 快速迭代驗證假設
- 不過度設計（先求有再求好）
