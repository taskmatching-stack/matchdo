# MatchDO【設計風向 Design Signals】功能開發預規劃書

**狀態**：📋 **待開發（僅規劃，尚未實作）**  
**建立**：2026-05-21  
**產品定位**：由「生圖工具」延伸為 **產業數據顧問**；以 **排名 → 成長率 → 圖表趨勢 → 自訂組合** 建構經典 **Data Paywall（數據付費牆）**。

**相關文件**（已存在、可撈資料）：

| 文件 | 內容 |
|------|------|
| `docs/design-direction-analysis-time-fields.md` | 時間軸與語意欄位（`created_at`、`semantics_generated_at`、事件表等） |
| `docs/design-lineage-and-design-direction-plan.md` | 產品線 D0–D7、血緣、`product_line` |
| `docs/membership-tiers-and-points-plan.md` | 四級會員（0／300／900／1800 元） |
| `docs/matchdo-todo.md` | 總待辦；本功能見 **「待開發：Design Signals」** |

---

## 一、基礎資料源盤點（對齊現有 DB）

規劃書中的「原料」對應 **目前程式已寫入或規劃中** 的欄位（非虛構 `generated_designs.ai_metadata`）：

| 維度 | 規劃用語 | 實際來源（現況） | 備註 |
|------|----------|------------------|------|
| **時間軸 Time** | 生圖／儲存精確時間 | `custom_products.created_at`；語意完成 `semantics_generated_at`；事件級 `visual_semantics_events.created_at` | 見 `design-direction-analysis-time-fields.md` |
| **分類 Category** | 20 大主分類、子分類 | `category` + `subcategory_key`（訂製：`custom_product_categories`；設計風向現仍 `remake_categories`） | 主分類約 12 筆種子，可擴至 20；中英對照靠多語系欄位 |
| **意圖標籤 AI Tags** | Material、Style、Color… | `ai_tags`、`ai_tags_by_dimension`（JSONB 分維） | 需 `add-custom-products-semantics*.sql` |
| **地理 Geography** | IP 國家／區域 | `designer_country_code`、`designer_region_codes`（內部） | 需 `add-custom-products-designer-region.sql`；**$1,800 才對外展示** |

**樣本範圍（分析時需定義）**：

- 主表：`custom_products`（訂製 + 設計風向共用；日後以 `product_line` 篩 `design_direction`）。
- 排除：`is_vendor_self_serve = true`（廠商自引素材生圖，僅內部報表用）。
- 測試帳號：後台或設定檔排除列表（待 D-S0 定義）。

---

## 二、四階層數據解鎖藍圖（Tiered Access Matrix）

會員方案對照（與 `docs/seed-subscription-plans.sql` 一致）：

| 階級 | 月費（NT$） | 種子方案名 | 定位 |
|------|------------|------------|------|
| 免費／訪客 | 0 | 免費會員 | 靈感刺激 |
| 基礎廠商 | 300 | 方案二 | 短期備貨指南 |
| 進階 Pro | 900 | 方案三 | 中期趨勢預測 |
| 企業供應商 | 1800 | 方案四 | 全球供應鏈戰略 |

### 🆓 免費會員／訪客 — Inspiration

**開放權限**：極度限縮；只給「結果」，不給「趨勢」。

| 項目 | 規格 |
|------|------|
| UI | 「本週熱門風向」：各**主分類**下僅 **Top 3 標籤關鍵字**（如 #Cyberpunk、#碳纖維、#極簡風）；文字雲或 Badge |
| 限制 | **不顯示**生成次數、佔比 % |
| 商業目的 | 刺激點標籤去生圖（消耗點數，如 15 點/次） |
| Upsell | 下方 **模糊化**成長趨勢圖 + 文案：「解鎖 $300 方案，查看哪些風格正在爆發成長」 |

### 🥉 $300 基礎廠商 — Tactical Execution

**開放權限**：排行榜 + 短期成長動能。

| 項目 | 規格 |
|------|------|
| UI | 各主分類 **Top 10 Tags** + **佔比 %** |
| 成長 | **風向箭頭**：相較上週成長率排名（例：「#透明壓克力 ▲ 120% 飆升中」） |
| 限制 | 僅 **當下斷代**（過去 7 天／30 天）；**無**長期歷史回溯 |
| 商業目的 | 小廠本週備貨、上架對應素材（如 5 元上架） |
| Upsell | 點 Tag 提示：「解鎖 $900 Pro，查看歷史曲線與生命週期」 |

### 🥈 $900 進階 Pro — Trend Forecasting

**開放權限**：時間序列 + 交叉比對。

| 項目 | 規格 |
|------|------|
| UI | **折線圖**：單一 Tag 過去 **3～6 個月** 走勢（起步／到頂／衰退） |
| 交叉 | 鎖定**子分類** + Tag（例：手機殼 × 金屬材質） |
| 對比 | 同一圖 **2～3 個 Tags**（例：真皮 vs 荔枝皮） |
| 商業目的 | 設計師／中型廠提前約 1 個月備料 |
| Upsell | （可選）導向 $1,800：地理維度、自訂儀表板 |

### 🥇 $1,800 企業供應商 — Global Strategy

**開放權限**：全維度 + 地理 + 自訂儀表板。

| 項目 | 規格 |
|------|------|
| UI | **自訂儀表板**：釘選最多 N 個 Tag（如 5 種布料），每日更新熱度 |
| 地圖 | **全球熱區 Heatmap**（IP 維度）：例 JP #Wabi-Sabi vs US #Tactical |
| 警報 | **Signal Alerts**：條件觸發 Email（例：#防潑水 在北美成長率 > 50%） |
| 商業目的 | L0 大廠產能與外銷市場決策 |

### 付費牆邏輯摘要

| 方案 | 顧什麼 | 核心數據產品 |
|------|--------|--------------|
| $300 | 眼前 | 排名 + 短期成長 |
| $900 | 下個月 | 折線圖 + 交叉比對 |
| $1,800 | 明年 | 全球地圖 + 自訂儀表板 + 警報 |

---

## 三、效能與資料架構（開發防雷）

### 3.1 禁止：每次請求 Real-time 掃 JSONB

使用者開啟風向頁時，**不可**即時對幾萬筆 `custom_products` 做 `ai_tags_by_dimension` 聚合（會拖垮 DB）。

### 3.2 建議：定時預聚合（Cron）

| 項目 | 規格 |
|------|------|
| 排程 | 每日 **03:00**（時區待訂，建議 `Asia/Taipei`） |
| 工作 | 依主分類／子分類／Tag 維度／地區（僅企業方案用）計算：排名、佔比、週成長率、月序列點 |
| 落地表 | **待建** 例：`daily_trend_stats`（或 `design_signal_snapshots`）— 見 §四 |
| 日間 API | 只讀預聚合表 + 依 `subscription_plan` 過濾欄位 |

### 3.3 前端 MVP

- 圖表：**Chart.js** 或 **Recharts**；API 回 JSON 陣列即可。
- v1 **不必**自研複雜地圖引擎；Heatmap 可用現成庫 + GeoJSON 簡版。

---

## 四、待建資料表（規劃草案，未執行 SQL）

> 以下為預規劃結構，**尚未建立 migration**；實作前需 D-S0 審欄位與索引。

### 4.1 `daily_trend_stats`（每日快照）

用途：免費～$900 的排行榜、成長率、$900 折線圖資料源。

| 欄位（草案） | 型別 | 說明 |
|--------------|------|------|
| `stat_date` | `date` | 統計日（台北日切或 UTC 待訂） |
| `category_key` | `text` | 主分類 |
| `subcategory_key` | `text` | 可 NULL（全類） |
| `tag_key` | `text` | 正規化 tag（如 `style:cyberpunk` 或維度+值） |
| `dimension` | `text` | `style` / `material` / `color` / … |
| `tag_label_zh` | `text` | 顯示用 |
| `tag_label_en` | `text` | 顯示用 |
| `sample_count` | `int` | 當日納入樣本數 |
| `share_pct` | `numeric` | 佔比 |
| `rank_in_category` | `int` | 當日排名 |
| `growth_pct_wow` | `numeric` | 週成長率（vs 前 7 日） |
| `growth_rank_wow` | `int` | 成長率排名 |
| `product_line` | `text` | `all` / `custom` / `design_direction`（待 `product_line` 上線） |

建議索引：`(stat_date, category_key, dimension, rank_in_category)`。

### 4.2 `design_signal_user_dashboards`（$1,800）

| 欄位（草案） | 說明 |
|--------------|------|
| `user_id` | 訂閱者 |
| `pinned_tags` | JSONB 陣列（最多 5～10） |
| `alert_rules` | JSONB（條件、閾值、通知 Email） |

### 4.3 `design_signal_alerts_log`（可選）

警報觸發紀錄，避免重複發信。

---

## 五、API 與權限（待開發）

| 端點（草案） | 最低方案 | 回傳 |
|--------------|----------|------|
| `GET /api/design-signals/weekly-highlights` | 訪客 | 各主分類 Top 3 tag（無數字） |
| `GET /api/design-signals/rankings` | $300+ | Top 10 + % + 成長箭頭（7d/30d 參數） |
| `GET /api/design-signals/timeseries` | $900+ | 單/多 tag 月序列 |
| `GET /api/design-signals/geo-heatmap` | $1,800 | 國家 × tag 熱度 |
| `GET/PUT /api/design-signals/dashboard` | $1,800 | 釘選與警報設定 |

**權限實作**：讀取使用者 `subscription_plans`／`user_subscriptions`（與現有點數、方案頁一致）；未達階級回 **402 + upsell payload**（含所需方案與模糊預覽圖 URL）。

**前台路由（草案）**：`/design-signals/` 或過渡 `/remake/insights/`（與 `/remake/` 產品線區隔待 D0）。

---

## 六、實作階段待辦（DS 系列，均未開始）

| 階段 | 待辦 | 依賴 |
|------|------|------|
| **DS-0** | 規格凍結：樣本定義、tag 正規化規則、方案權限矩陣、時區 | — |
| **DS-1** | SQL：`daily_trend_stats` + migration；種子回填腳本（可選） | semantics + designer-region migration 已跑 |
| **DS-2** | Cron／Cloud Scheduler + 聚合 job（Node script 或 Supabase Edge） | DS-1 |
| **DS-3** | API 層 + 方案 gate + upsell 結構 | DS-2、`membership` 已接 |
| **DS-4** | 前端 v1：免費 Top3 + $300 排行榜 + 付費牆模糊區 | DS-3 |
| **DS-5** | $900 折線圖 + 多 tag 對比 | DS-4 |
| **DS-6** | $1,800 儀表板 + Heatmap + Email 警報 | DS-5 |
| **DS-7** | E2E、效能壓測、文件、SEO | DS-6 |

**與 D0–D7（設計風向產品線）關係**：

- **D 系列**：意圖分析流程、`product_line`、前台 `/remake/` 改版。
- **DS 系列**：**趨勢報表與付費牆**（可於 `custom_products` 已有語意標籤後並行，但對外文案統稱「設計風向」）。

建議順序：**資料血緣／語意欄位穩定 → DS-1 聚合表 → DS-4 MVP 付費牆 → D 系列產品流程**（可並行，由產品優先級決定）。

---

## 七、商業與產品備註（紀錄原文精煉）

1. **Data Paywall** 四層與四維資料（分類、Tags、時間、IP）對齊清楚，利於 Query 與 UI 分工。
2. 區域 IP 放 **$1,800**、折線放 **$900**、排名放 **$300**，對應「現貨 → 下月設計 → 明年產能」決策週期。
3. 免費層只給 Tag 名稱、不給數字，保留升級誘因。
4. 第一版圖表用開源庫即可，不必過度工程。

---

## 八、變更紀錄

| 日期 | 說明 |
|------|------|
| 2026-05-21 | 初版：納入四階層付費牆、資料源對齊 `custom_products`、待建 `daily_trend_stats`、DS-0～DS-7 待辦 |
