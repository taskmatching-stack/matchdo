# Embed 模擬器 — 線上 handoff（2026-06-27 · 2026-06-30 結案更新）

> **狀態（2026-06-30）**：**MVP 已上線可結案** — Phase A～D 核心完成；SQL／部署／全鏈路驗收已由廠商端確認。  
> **目前工作**：廠商／產品資料上線（與 Embed 功能開發無關）。  
> **規格母本**：[`PROGRESS-vendor-embed-simulator.md`](PROGRESS-vendor-embed-simulator.md)  
> **串接細節**：[`PROGRESS-vendor-embed-simulator-integration.md`](PROGRESS-vendor-embed-simulator-integration.md)

---

## 1. 產品一句話

**付費廠商**在素材後台取得 **iframe 嵌入碼**；**任何人**（訪客、未登入）開啟該 iframe 都能試做。**付費只 gate「取得嵌入碼」**，不 gate「看介面／生圖」。

| 誰 | 能做什麼 |
|----|----------|
| **訪客**（有合法 `embed_id` + `sig`） | 完整試做 UI、生圖；**不付 Matchdo 點** |
| **付費廠商**（300／900／1800） | 建立 iframe 實例、複製 `<iframe>`、看 Embed 生圖紀錄 |
| **免費廠商** | **無法**建立新 iframe；若已有舊連結，訪客端仍依實例運作（目前不對訪客查訂閱） |

**與主站試做連結 ① 分開**：`custom-product.html?prototype_asset_id=` → 訪客登入後扣**自己的**點數；與 iframe **不是同一套計費**。

---

## 2. 付費方案分級（embed 權益）

| 方案 | iframe 組數 | Powered by Matchdo | 成圖上首頁媒體牆 |
|------|-------------|-------------------|------------------|
| **300** | 最多 **3 組**（不同主產品各一實例） | **顯示** | **強制上牆** |
| **900** | **無限** | **顯示** | **強制上牆** |
| **1800** | **無限** | **不顯示** | **可設定**（素材後台勾選） |
| admin／tester | 比照 1800 | — | — |

- 方案判定：`lib/embed-simulator.js` → `resolveEmbedPlanTier()`（`plan_key` 或月費 `price >= 300`）。
- **建立 iframe 時**寫入實例：`show_powered_by`、`show_on_media_wall`（公開 API **只讀實例**，不再查訂閱）。

---

## 3. 扣點（已定案 · 取代舊「月池」）

- **每次生圖成功**才扣 **10 點**（`payment_config.points_embed_simulator_generate`）。
- 扣 **廠商** `user_id`（`manufacturers.user_id`），不是訪客。
- 生圖**前**檢查餘額；FLUX **失敗不扣**。
- ~~`embed_generations_monthly` 月池~~：**已不再使用**（欄位可留 DB，邏輯已移除）。

---

## 4. 售前／媒體牆／洞察

- 成功生圖寫入：
  - `vendor_embed_designs`（`source: 'embed'`）
  - `custom_products`（`owner_id` = 廠商；`is_vendor_self_serve = false`；`analysis_json.embed_visitor_design = true`）
- **不算**廠商自產刷量；`buildVendorPrototypeDesignInsights` 已合併 embed 資料並排除 `is_vendor_self_serve`。
- 媒體牆：`show_on_homepage` 依實例 `show_on_media_wall`（300/900 建立時固定 true）。

---

## 5. 公開 API vs 廠商 API

### 5.1 訪客 iframe（不查訂閱）

| Method | Path | 說明 |
|--------|------|------|
| GET | `/api/embed/simulator/bootstrap` | 廠商 logo、綁定主產品、`embed_branding` |
| GET | `/api/embed/simulator/link-tree` | 材配樹 |
| GET | `/api/embed/simulator/capabilities` | 工藝 |
| POST | `/api/embed/simulator/generate` | 生圖 + 扣廠商點 |

驗證：`embed_id` + `sig`、實例 `is_active`、限流 cap、廠商點數。

### 5.2 廠商後台（需 Bearer）

| Method | Path | 說明 |
|--------|------|------|
| GET/POST | `/api/me/embed-simulator-instances` | 取得／建立 iframe（**付費檢查在此**） |
| PATCH | `/api/me/embed-simulator-instances/:id` | 1800：媒體牆開關 |
| GET | `/api/me/embed-designs` | Embed 訪客生圖列表 |

### 5.3 官方管理

| Path | 說明 |
|------|------|
| `/admin/generation-records.html` | 主站 + Embed 生圖紀錄 |
| `GET /api/admin/generation-records` | 同上 API |

---

## 6. 前端檔案（UI 收尾用）

| 檔案 | BUILD / 版本 | 備註 |
|------|----------------|------|
| `public/embed/simulator.html` | — | 主 iframe 頁 |
| `public/js/embed-simulator.js` | `embed-simulator-20260630a` | 邏輯 |
| `public/client/manufacturer-materials.html` | `embed-plan-tiers-20260627a` 等 | ② iframe 區 |
| `public/client/embed-design-records.html` | — | 廠商 Embed 紀錄 |
| `public/client/vendor-prototype-insights.html` | — | 洞察含 Embed badge |

### 6.1 已完成 UI

- Header：**淺灰漸層底**；Powered by **深底 + 白底 logo 膠囊**；1800 可隱藏 Powered by。
- 廠商 logo **破圖 → 名稱首字** fallback。
- 已選參考：**窄版 sticky「已選」列** + **≥880px 右側欄** + 步驟 1 摘要縮圖。
- 步驟 2 **不重複**步驟 1 主產品大圖。
- 生圖結果下方文案：「AI 模擬為設計參考，實際結構與材質細節歡迎與我們溝通確認。」

### 6.2 選做 backlog（不擋上線 · 需要時再做）

- [ ] 依真實 iframe 寬度／廠商 logo 比例再調 header
- [ ] loading／錯誤態視覺再統一一輪
- [ ] `?mock=1` 與正式 API 視覺對齊（開發用）
- [ ] **獨立**「iframe 實例管理頁」（現以素材編輯窗 ② + 紀錄頁已足 MVP）
- [ ] **Phase E**：域名白名單、CAPTCHA、平台熔斷、GA4

---

## 7. 後端／SQL

### 7.1 必跑順序（Supabase SQL Editor）

1. [`docs/add-embed-simulator-schema.sql`](add-embed-simulator-schema.sql)
2. [`docs/add-embed-simulator-plan-tiers.sql`](add-embed-simulator-plan-tiers.sql)

**狀態（2026-06-30）**：✅ 已於線上執行；新環境 clone 時仍須依序跑上述兩檔。

`plan-tiers` 含：`embed_enabled`、`show_on_media_wall`、`show_powered_by`、`vendor_embed_designs.source` / `custom_product_id`、`billing_type` 含 `credit_points`。

### 7.2 核心程式

- `lib/embed-simulator.js` — 簽名、限流、方案 tier、實例查詢 fallback（缺欄位不誤判 schema）
- `server.js` — `/api/embed/simulator/*`、`/api/me/embed-*`、`/api/admin/generation-records`

---

## 8. 重要 commit（main）

| Hash | 摘要 |
|------|------|
| `021133c` | 付費分級、生圖紀錄、媒體牆、insights |
| `b373ffa` | 缺 `show_on_media_wall` 勿誤判 schema |
| `49b3ba9` | 付費 tier 判定修正 |
| `ce6325f` | **公開 iframe 不查訂閱**；付費僅取得嵌入碼 |
| `824955b` | Header 底色、Powered by、logo fallback |
| `392f2d7` 起 | 主站 UI 調整（與 Embed 無關） |
| `5a7ff31` | 產品設計頁 AI 免責聲明 |

部署：見 [`docs/deploy-matchdo-push-and-deploy.md`](deploy-matchdo-push-and-deploy.md)。

---

## 9. 常見問題（這次踩過的坑）

1. **`Embed 尚未設定`**：常是缺 DB 表，或缺新欄位被誤判 → 已用 fallback 查詢修正（`b373ffa`）。
2. **`僅限付費會員` 在訪客 iframe**：不應出現 → 已改為僅 POST 建立 iframe 時檢查（`ce6325f`）。
3. **`embed_enabled=false` 預設**：曾擋付費戶 → 現以 **price / plan_key** 為準建立 iframe。
4. **Powered by 看不清**：header 已加底色；1800 靠實例 `show_powered_by=false` 隱藏。

---

## 10. 驗收捷徑（MVP 已通過）

1. ~~Supabase 跑完 §7.1 SQL~~ ✅  
2. ~~部署最新 `main`~~ ✅  
3. 付費帳號 → 素材 → 主產品 → 編輯 → **② iframe** → 複製碼 ✅  
4. 無痕／訪客開 iframe URL → **直接**試做（非付費錯誤頁）✅  
5. 生圖成功 → 廠商點數 -10、`/client/embed-design-records.html` 有紀錄 ✅  

**結論**：Embed MVP **可結案**；§6.2 為日後優化 backlog。

---

**最後更新**：2026-06-30（MVP 結案；廠商／產品資料上線進行中）
