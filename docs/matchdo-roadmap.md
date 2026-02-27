# MatchDO「合做」開發路線圖

> **最後更新**: 2026-02-06  
> **當前階段**: Phase 1.6 已完成；下一步 Phase 1.8 廠商端媒合專案（規劃見 `docs/PHASE-1.8-VENDOR-MATCH-PROJECTS.md`）

---

## ⚠️ 核心商業邏輯（重要！）

### ❌ 錯誤思維（老式賣聯絡方式）
- 媒合成功 → 申請查看 → 付費解鎖 → 看到聯絡方式
- 這是在「賣電話號碼」❌

### ✅ 正確思維（MatchDO 模式）
- **媒合成功 = 雙方直接看到聯絡方式**
- 重點在「AI 媒合品質」不是「鎖住資訊」
- 收費模式：訂閱方案、刊登費用
- **永不顯示價格**（價格僅用於後台媒合算法）

### 🔑 關鍵原則（請勿再加「解鎖」流程）
1. **媒合成功後，聯絡方式直接顯示**（電話、LINE、Email）— 不鎖、無需申請、無需解鎖。
2. **絕不實作**「申請查看」「付費解鎖」「審核通過才看得到」。
3. 若有 contact_unlocks 表，**僅供選用紀錄**（誰曾查看過），不拿來控制權限、不擋聯絡方式。
4. 價格範圍永遠不在前端顯示。

---

## 📊 總體進度

```
Phase 1  資料庫基礎           ████████████████████ 100%
Phase 1.5 發案者功能          █████████████████░░░  85%
Phase 1.6 Storage 遷移       ████████████████████ 100%
Phase 1.8 廠商端媒合專案      ░░░░░░░░░░░░░░░░░░░░  規劃中
Phase 2  專家功能優化          ░░░░░░░░░░░░░░░░░░░░   0%
Phase 3  媒合引擎             ████░░░░░░░░░░░░░░░░  演算法 V2 + run-split + 預媒合 ✅
Phase 4  通知系統             ░░░░░░░░░░░░░░░░░░░░   0%
Phase 5  訂閱金流             ░░░░░░░░░░░░░░░░░░░░   0%
```

---

## ✅ Phase 1: 資料庫基礎 (100%)

**完成日期**: 2026-02-05  
**目標**: 建立完整資料庫結構

### 已執行的 Schema

| Schema 檔案 | 說明 | 執行日期 |
|------------|------|---------|
| ✅ user-roles-schema.sql | 用戶角色與權限 | 2026-02-05 |
| ✅ contact-info-schema.sql | 聯絡資訊管理 (12種聯絡方式) | 2026-02-05 |
| ✅ subscriptions-schema.sql | 訂閱方案與點數系統 (5個表) | 2026-02-05 |
| ✅ matches-schema.sql | 媒合記錄 | 2026-02-05 |
| ✅ project-items-schema.sql | 統包分包系統 | 2026-02-05 |
| ✅ contact-unlocks-schema.sql | 聯絡紀錄表（可選；僅記錄用，不鎖聯絡方式） | 2026-02-05 |
| ✅ notifications-schema.sql | 通知系統 (38種通知類型) | 2026-02-05 |

### 資料庫統計

- **資料表**: 11 個 (不含既有的 projects, users)
- **Views**: 2 個
- **函數**: 5 個
- **管理員**: liutsaiiu@gmail.com

---

## ⏳ Phase 1.5: 發案者功能 (**約 85%**，核心已完成)

**目標**: 建立發案者端基本介面

### ✅ 已完成

- [x] **client/dashboard.html** - 客戶控制台 (2026-02-05)
  - 4個統計卡片、快速操作按鈕、最近專案/媒合列表、iStudio 模板、統一認證

- [x] **client/my-projects.html** - 我的專案列表 (既有)
- [x] **client/my-custom-products.html** - 客製產品列表 (既有)

- [x] **client/project-detail.html** - 專案詳情頁 (**第一版已完成 2026-02-06**)
  - [x] 專案完整資訊顯示、動態欄位顯示和編輯
  - [x] **預算欄位**（budget_min, budget_max）設定與儲存
  - [x] **預媒合測試功能**（第一版：依工項+標籤、市場估算、同類專家常用標籤可點擊加入）
  - [x] 分包項目管理：從 `project_items` 載入、數量/單位/預算編輯、**標籤可編輯並寫入 DB**
  - [x] 送出媒合（run-split）、顯示媒合結果
  - [x] **媒合專家列表**：動態顯示、評分/報價/聯絡方式、**移除此廠商**
  - [x] 聯繫專家（「立即聯繫」→ 站內對話 Modal，需執行 `docs/conversations-schema.sql`）

### 📋 已具備（可選優化）

- [x] **查看媒合專家**：在 project-detail 內已完成（列表、聯絡、移除廠商）；`matched-experts.html` 已改為**導向頁**（說明請至專案詳情、連結我的專案）。
- [x] **我的專案**：my-projects.html 已為完整頁面。

### 📋 真正待完成（Phase 1.5 收尾）

- [x] **聯繫專家**：已完成（「立即聯繫」→ 站內對話 Modal，conversations/messages API）
- [ ] （可選）跨專案媒合廠商列表獨立頁、或 client/project-items.html
- [ ] E2E 測試：發包流程、預媒合、移除廠商、線上對話

**進度控管**：`docs/PHASE.md` 為階段與檢查清單單一來源，請同步更新。  
**首頁／後台**：AI 識別流程與提示詞撰寫見 `docs/首頁AI識別流程.md`。

---

## ✅ Phase 1.6: Supabase Storage 遷移 (100%)

**目標**: 上傳改為 Supabase Storage，支援無狀態部署與 CDN。

- [x] 在 Supabase SQL Editor 執行 `docs/create-storage-bucket.sql`（project-images、custom-products + RLS）
- [x] server.js：Multer memoryStorage、uploadToSupabaseStorage、四支 API 改用 Storage
- [x] 前端圖片 URL 處理（toAbsoluteUrl、uploaded_files 顯示）
- [ ] （可選）遷移腳本：既有 `uploads/` → Storage

**細項**：`docs/PHASE-1.6-STORAGE-MIGRATION.md`

---

## 📅 Phase 1.8: 廠商端媒合專案（規劃中）

**目標**: 由**報價廠商（專家）**主動媒合專案需求；支援預媒合、**不鎖聯絡方式**。

- 規劃文件：**`docs/PHASE-1.8-VENDOR-MATCH-PROJECTS.md`**
- 要點：專家端可瀏覽／篩選開放中的專案 → 預媒合（看自己符合多少專案）→ 主動申請／觸發媒合 → 媒合成功即雙方直接看到聯絡方式（與現有原則一致）。

---

## 📅 Phase 2: 專家功能優化 (0%)

**目標**: 完善專家端介面

- [ ] **expert/listing-detail.html** - 報價詳情
- [ ] **expert/project-detail.html** - 專家查看專案詳情
- [ ] 優化 expert/matched-projects.html 顯示真實資料

---

## 🤖 Phase 3: 媒合引擎 (0%)

**目標**: 實現 AI 媒合算法

### A. 資料表與 API

- [ ] 建立 matches 資料表結構 ✅ (已在 Phase 1 完成)
- [ ] 實作預媒合 API `/api/match/preview` ← **優先實現**
- [ ] 實作媒合 API `/api/match/run`
- [ ] 實作統包組媒合 `/api/match/run-package-group`
- [ ] 實作分包媒合 `/api/match/run-split`

### A.1 預媒合功能（Preview Match）

**目標**: 讓發案者在正式發包前，先了解符合預算的專家數量

**前端介面**:
- [ ] project-detail.html 新增預算欄位（budget_min, budget_max）
  - 顯示位置：專案基本資訊區
  - 編輯模式：可修改預算範圍
  - **不公開顯示**：僅用於後台媒合算法
- [ ] 「預媒合測試」按鈕功能實現
  - 調用 `/api/match/preview` API
  - 顯示符合預算的專家百分比
  - 顯示預期可媒合的專家數量範圍

**後端 API**:
```javascript
POST /api/match/preview
Body: {
  project_id: uuid,
  budget_min: number,  // 預算下限
  budget_max: number   // 預算上限
}

Response: {
  total_experts: number,           // 該分類總專家數
  matched_experts: number,         // 符合預算的專家數
  match_percentage: number,        // 符合百分比 (0-100)
  price_distribution: {            // 價格分布統計
    ranges: [
      { min: 0, max: 50000, count: 10 },
      { min: 50000, max: 100000, count: 25 },
      ...
    ]
  },
  estimated_responses: string      // 預期回應數量（例如："3-5 位專家"）
}
```

**演算邏輯**:
```
1. 根據專案的 category 和 subcategory 查詢所有相關專家
2. 篩選專家的報價範圍與預算區間有重疊的
3. 計算百分比：符合專家數 / 總專家數 × 100%
4. 返回統計數據（不包含具體專家資訊）
```

**範例**:
```
發案者預算: 50萬 - 100萬
該分類總專家: 50 位

價格重疊判斷:
- 專家A: 80萬-150萬 → 重疊 (80-100萬) ✅
- 專家B: 120萬-200萬 → 不重疊 ❌
- 專家C: 30萬-60萬 → 重疊 (50-60萬) ✅

結果:
- 符合專家: 35 位
- 符合百分比: 70%
- 顯示: "您的預算範圍符合 70% 的專家（約 35 位），預期可獲得 10-15 位專家回應"
```

### B. 媒合邏輯

- [ ] 分析專案需求 (AI 分析結果)
- [ ] 判斷發包類型 (統包組 or 單獨分項)
- [ ] 計算匹配分數 (關鍵字/地區/經驗)
- [ ] **價格範圍比對**（後台邏輯，前端永不顯示）
  ```
  發案者: budget_min=50萬, budget_max=100萬
  專家: price_min=80萬, price_max=150萬
  重疊區間: 80萬-100萬 → 媒合成功
  ```
- [ ] **計算價格重疊百分比**（顯示在媒合結果）
  - 重疊區間長度 / 發案者期望區間長度 × 100%
  - 範例: (100-80) / (100-50) × 100% = 40%
  - 顯示："價格區間符合度 40%"（不顯示具體金額）
- [ ] 儲存媒合記錄
- [ ] 觸發通知（媒合成功 → 雙方直接看到聯絡方式）

### C. 聯絡資訊顯示

- [x] 媒合成功後直接顯示聯絡方式（電話、LINE、Email）— 已實作於 project-detail 媒合專家列表
- [x] 無申請、解鎖、審核流程（MatchDO 不鎖聯絡方式）；站內對話（conversations / messages）已實作完成
- （可選）若需「誰曾查看」紀錄可寫入表，**不拿來控制權限**
- [ ] **媒合專家卡片顯示項目**：
  - 專家名稱、公司名稱
  - 媒合分數（0-100）
  - 服務地區（例如：台北市、新北市）
  - 經驗年資、評價
  - 聯絡方式（電話、LINE、Email）← 媒合成功直接顯示
  - 價格重疊百分比（未來功能，提供議價參考）

---

## 🔔 Phase 4: 通知系統 (0%)

**目標**: 讓使用者即時知道平台動態

- [ ] 建立 notifications 資料表
- [ ] 導航欄通知圖示 (未讀紅點)
- [ ] 通知中心頁面 `/notifications.html`
- [ ] 整合通知觸發點
  - 新媒合產生 → 通知雙方（附帶對方聯絡方式）
  - 專案狀態更新 → 通知相關人員

---

## 💳 Phase 5: 訂閱金流 (0%)

**目標**: 整合綠界金流

### A. 綠界基礎設定

- [ ] 使用綠界測試環境
- [ ] 建立 config/ecpay-config.js
- [ ] 正式上線後切換為正式環境

### B. 訂閱方案購買

- [ ] 建立訂閱方案頁面 public/pricing.html
- [ ] 實作訂閱購買 API
- [ ] 實作綠界付款回調
- [ ] 訂閱管理頁面

### C. 點數購買與管理

- [ ] 建立點數購買頁面
- [ ] 實作點數購買 API
- [ ] 點數消費 API

### D. 管理後台

- [ ] 訂閱方案管理頁面 admin/subscription-plans.html
- [ ] 方案編輯表單
- [ ] 使用量追蹤 API

---

## 🧪 Phase 6: 測試與優化 (0%)

**目標**: 修復 bugs、補充缺少的頁面

### A. 測試數據生成

- [ ] 建立 scripts/generate-test-data.js
- [ ] 生成 20 個測試帳號
- [ ] 生成 30 個測試專案
- [ ] 生成 40 個專家報價

### B. 完整測試

- [ ] 註冊 → 發案 → 等待媒合 → 收到通知 → 看到聯絡方式
- [ ] 註冊 → 刊登報價 → 收到媒合 → 看到發案者聯絡方式
- [ ] 完整跑通「發案 → 媒合 → 直接聯繫」全流程
- [ ] 邊界情況測試 (無媒合結果/網路錯誤等)

### C. 效能優化

- [ ] 查詢優化 (加索引)
- [ ] 圖片載入優化 (lazy loading)
- [ ] 媒合算法優化 (避免 N+1 查詢)

---

## 🚀 Phase 7: 部署上線 (0%)

**目標**: 部署到 Vercel

### A. 準備工作

- [ ] 檔案上傳改為 Supabase Storage
- [ ] 建立 .gitignore
- [ ] 建立 vercel.json 配置
- [ ] 整理環境變數

### B. GitHub 設定

- [ ] 初始化 Git Repository
- [ ] 建立 GitHub Repository
- [ ] 推送代碼到 GitHub

### C. Vercel 部署

- [ ] 註冊並連接 GitHub
- [ ] 匯入專案
- [ ] 配置環境變數
- [ ] 首次部署

### D. 測試與驗證

- [ ] 功能測試清單 (8項)
- [ ] 性能檢查 (Lighthouse > 80)
- [ ] 安全性檢查

---

## 📝 技術決策紀錄

### 檔案儲存方案
- **決策**: Supabase Storage
- **理由**: 與 Supabase Auth 無縫整合、簡單易用、初期成本低

### 部署平台
- **決策**: Vercel
- **理由**: 零架構調整、原生支援 Node.js/Express、自動 CI/CD

### 認證系統
- **決策**: Supabase Auth + Google OAuth
- **統一檔案**: config/auth-config.js (全站使用)

---

## 🎯 本週重點任務 (2026-02-05 ~ 2026-02-11)

### Day 1-2: 專案詳情頁
- [ ] 建立 client/project-detail.html
- [ ] 統包/分包項目管理
- [ ] 媒合專家列表顯示

### Day 3-4: 分包項目管理
- [ ] 建立 client/project-items.html
- [ ] 自選統包組合功能
- [ ] 彈性發包選擇

### Day 5-6: 媒合引擎基礎
- [ ] 建立 matches 表
- [ ] 實作基礎媒合 API
- [ ] 專家端顯示真實媒合資料

### Day 7: 測試與修復
- [ ] 端到端測試
- [ ] Bug 修復
- [ ] UI/UX 優化

---

## 📌 重要提醒

### 開發原則
1. **跟隨既有模式** - 使用 iStudio 模板結構
2. **統一認證** - 全站使用 config/auth-config.js
3. **共用組件** - site-header.js, site-footer.js
4. **進度追蹤** - 完成任務後更新本檔案

### 資料庫注意事項
- projects 表是**既有表** (不需建立)
- 所有 Schema 已執行完畢
- RLS policies 已啟用

### 文件位置
- 網站地圖: docs/sitemap.md
- 資料庫驗證: docs/verify-database.sql
- 舊進度記錄: docs/matchdo-todo.md (已棄用)
