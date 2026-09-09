# 免費方案 UGC 圖片留存與冷儲存 — 規劃與實作

**狀態：** 規劃定案（2026-09-09）  
**範圍：** 僅使用者 UGC（訂製品生圖、商攝情境圖）；**不含**廠商原型／材料／系列／對照（`vendor_assets`、`manufacturer_portfolio`）。

---

## 1. 產品定案摘要

### 1.1 適用／不適用

| 適用 | 不適用 |
|------|--------|
| `custom_products`（AI 生圖） | `vendor_assets`（原型、零件、材料） |
| `product_promo_generations`（商攝） | `manufacturer_portfolio`（系列、對照） |
| （第二期）印花、材料組合等使用者生圖 | 官方版型、平台代管資產 |

### 1.2 三條時間軸（分開）

| 軸 | 規則 |
|----|------|
| **A. 儲存** | 免費：`max(last_accessed_at, free_retention_started_at)` 起 **90 天無有效存取** → GCS **Coldline**；再 90 天無存取 → 軟刪 → **+15 天** GCS 硬刪。點選有效存取 → 恢復 **Standard** 並更新 `last_accessed_at`。 |
| **B. 靈感牆** | 免費非人像：**強制上牆**；人像預設不上牆。小分類牆上 **&lt; 48** 可多留（內部，不公布）。牆下架 **不刪檔**、不強制冷凍。 |
| **C. 降級緩衝（僅上牆）** | 見 §1.6：**非自願到期** → 15 天內仍可控制上牆；**主動取消** → 無緩衝、立刻依免費上牆規則。儲存 tier 兩種皆降級當天啟動。 |

### 1.3 帳號狀態

| 狀態 | `retention_tier` | 上牆控制 | 冷凍 |
|------|------------------|----------|------|
| 免費 | `free` | 期滿後強制（人像除外） | 適用 |
| 付費 | `paid` | 可控制 | 不冷凍 |
| 降級後 15 天內（**非自願**） | `free` + `wall_grace_until` | **仍可控制** | 適用（不立刻冷凍） |
| 降級（**主動取消**） | `free`，`wall_grace_until` 為空 | 立刻依免費（非人像強制上牆） | 適用（不立刻冷凍） |
| 管理員／測試／種子廠商 UGC | `staff` 或豁免 | 既有 bypass | 豁免 |

### 1.4 內部原則（不寫條款）

- `media_wall_favorites` 有人收藏的 UGC：**不刪除**（建議維持 Standard，不進 Coldline）。
- 有效存取**不算**靈感牆列表縮圖滑過，只算：本人圖庫詳情、大圖／lightbox、最愛開啟、公開 `/inspiration/*` 詳情。

### 1.5 對外文案（精簡）

> **免費方案：** 圖片保存 90 天；長期無人查看可能移入冷儲存，再次開啟時自動恢復。  
> **付費方案：** 長期保存，可控制靈感牆展示。  
> **續訂失敗或到期未扣款成功：** 系統將保留 **15 日**讓您整理靈感牆公開設定或完成續訂（不適用於您主動取消訂閱）。

### 1.6 降級兩條路（上牆緩衝）

| 情境 | 判定 | `wall_grace_until` | 上牆 |
|------|------|-------------------|------|
| **主動取消**（明確不想再用） | 使用者按「取消訂閱」、PayPal／綠界**使用者端取消**、後台標記 `cancelled` + 自願 | **不設**（NULL） | **立刻**依免費：非人像強制上牆 |
| **非自願到期** | 忘記續訂、`end_date` 過了扣款失敗、信用卡過期、Webhook 扣款失敗、cron 掃到 `expired` 且非自願取消 | **now + 15 天** | 15 天內仍可按付費控制；期滿後非人像強制上牆 |

**儲存規則（Coldline／刪除）：** 兩條路皆在降級當天 `retention_tier=free`、`ugc_free_retention_started_at=now`；**不**因主動取消而提早刪圖。

**實作欄位：** `user_subscriptions.cancellation_reason`（見 §2.1）或 `profiles.last_downgrade_kind`：`voluntary` | `involuntary`。

---

## 2. 資料模型

### 2.1 `profiles`（帳號級）

| 欄位 | 型別 | 說明 |
|------|------|------|
| `wall_grace_until` | `timestamptz` NULL | 僅 **involuntary** 降級：+15 天；主動取消保持 NULL |
| `ugc_free_retention_started_at` | `timestamptz` NULL | 最近一次進入免費留存規則的時間 |
| `last_downgrade_kind` | `text` NULL | `voluntary` \| `involuntary`（稽核／通知文案） |

### 2.1b `user_subscriptions`（建議擴充）

| 欄位 | 型別 | 說明 |
|------|------|------|
| `cancelled_at` | `timestamptz` NULL | 取消時間 |
| `cancellation_reason` | `text` NULL | `user_voluntary` \| `payment_failed` \| `expired_no_renew` \| `admin` \| `plan_change` |

- `user_voluntary` → **無** `wall_grace_until`
- `payment_failed` / `expired_no_renew` / 扣款 Webhook 失敗 → **有** 15 天緩衝
- `plan_change`（換方案）→ 不觸發降級免費流程

Migration：`docs/add-ugc-retention-profiles.sql`、`docs/add-subscription-cancellation-reason.sql`

### 2.2 `custom_products`、`product_promo_generations`

| 欄位 | 型別 | 說明 |
|------|------|------|
| `generation_completed_at` | `timestamptz` | 生圖完成（有結果圖 URL 時寫入） |
| `last_accessed_at` | `timestamptz` | 最後有效存取 |
| `free_retention_started_at` | `timestamptz` NULL | 該筆開始適用免費規則（降級或從未付費生圖時） |
| `retention_tier` | `text` | `free` \| `paid` \| `staff` |
| `storage_tier` | `text` | `standard` \| `coldline` |
| `soft_deleted_at` | `timestamptz` NULL | 軟刪時間 |
| `wall_category_key` | `text` NULL | 上牆時快照 `subcategory_key` 或 `category`（內部牆輪替用） |
| `content_kind` | `text` NULL | `design` \| `promo_product` \| `promo_space` \| `promo_portrait` |

Migration：`docs/add-ugc-retention-content.sql`

**人像判定：**

- `product_promo_generations`：`generation_mode = 'portrait'` 或 `shoot_mode` 在 `generation_meta_json`／`camera_params`。
- `custom_products`：預設 `design`（訂製品設計頁無人像模式）。

### 2.3 不新增欄位的表

`vendor_assets`、`manufacturer_portfolio`、`media_collections` — 本功能不碰。

---

## 3. 核心模組（建議新檔）

### 3.1 `lib/ugc-retention.js`

| 函式 | 職責 |
|------|------|
| `isUgcRetentionExemptUser(userId)` | staff / seed 豁免 |
| `effectiveRetentionAnchor(row)` | `max(last_accessed_at, free_retention_started_at, generation_completed_at)` |
| `shouldColdline(row, now)` | free + standard + 90d 無存取 |
| `shouldSoftDelete(row, now)` | coldline + 再 90d 無存取 + 無收藏 |
| `hasMediaWallFavorite(itemType, itemId)` | 查 `media_wall_favorites` |
| `markAccessed(supabase, table, id)` | 更新 `last_accessed_at`；若 coldline 則排程恢復 standard |
| `applyDowngradeToFree(userId, { kind })` | `kind=voluntary` 無緩衝 + 立刻 `enforceWall`；`involuntary` 設 `wall_grace_until`；皆 `retention_tier=free` |
| `applyUpgradeToPaid(userId)` | 清緩衝、`retention_tier=paid`、恢復 standard |
| `enforceWallGraceExpired(userId?)` | 緩衝期滿 → 非人像 `show_on_homepage=true` |
| `runRetentionSweep()` | cron 單次入口：coldline / soft-delete / hard-delete |

### 3.2 `lib/object-storage.js` 擴充

| 函式 | 職責 |
|------|------|
| `setGcsStorageClass(objectKey, class)` | `STANDARD` / `COLDLINE` |
| `deleteGcsObject(objectKey)` | 硬刪 |
| `parseMediaUrlToObjectKey(url)` | `https://media.matchdo.cc/custom-products/...` → key |

### 3.3 `scripts/ugc-retention-cron.js`

- 本地／Cloud Scheduler 每日執行（建議 UTC 03:00 = 台灣 11:00）。
- 呼叫 `runRetentionSweep()` + `enforceWallGraceExpired()`。
- 日誌：coldline 數、軟刪數、硬刪數、錯誤清單。

---

## 4. 與現有程式接點

### 4.1 會員降級／升級

**檔案：** `server.js` → `syncMembershipCatalogVisibility`

在 `tierPrev === 'paid' && tierNow === 'free'` 分支，於 `hideVendorAssetsOnMembershipDowngrade` **之後**呼叫：

```text
applyDowngradeToFree(userId, { kind: resolveDowngradeKind(userId) })
```

`resolveDowngradeKind` 依最近一筆 subscription 的 `cancellation_reason`：  
`user_voluntary` → `voluntary`；`payment_failed` / `expired_no_renew` / NULL（僅到期）→ `involuntary`。

在 `tierPrev === 'free' && tierNow === 'paid'` 分支呼叫：

```text
applyUpgradeToPaid(userId)
```

**觸發點（既有）：** 訂閱 webhook、admin 改 `member_level`、`user_subscriptions` 更新後 — 凡已呼叫 `syncMembershipCatalogVisibility` 者即涵蓋。

**缺口：** 文件中的 `scripts/subscription-cron.js` **尚未存在**。建議 P1 新增：每日掃 `user_subscriptions.end_date < now()` 且仍 `active` → 改 `expired` 並呼叫 `syncMembershipCatalogVisibility`，避免僅依 webhook 漏單。

### 4.2 上牆控制

**檔案：** `server.js`

- `canControlDesignShowOnHomepage(userId)`：若 `wall_grace_until > now()` → 回傳 `true`（緩衝內視同付費）。
- `resolveDesignShowOnHomepageFromRequest`：**修正**免費人像 — 在 `!(await canControl)` 之前，若 `shootMode === 'portrait'` → 預設 `false`（與付費一致）。

**檔案：** `public/js/show-on-homepage-control.js`

- 免費 + `portraitMode`：checkbox **可選、預設不勾**（與後端一致）。
- 免費 + 非人像 + 無緩衝：disabled + 勾選（既有）。
- 免費 + `wall_grace_until` 未過：等同付費 UI（API 需在 `GET /api/me/capabilities` 回傳 `wall_grace_until`）。

### 4.3 生圖寫入

**檔案：** `server.js`（`POST` 生圖、`product_promo_generations` insert）

新圖寫入時：

```text
generation_completed_at = now()
last_accessed_at = now()
retention_tier = paid ? 'paid' : 'free'
free_retention_started_at = paid ? null : now()
storage_tier = 'standard'
content_kind = 依類型
wall_category_key = subcategory_key || category
```

### 4.4 有效存取記錄

在以下路徑呼叫 `markAccessed`（**不含**媒體牆列表 API）：

| 路徑 | 說明 |
|------|------|
| `GET /api/custom-products/:id`（本人或公開詳情） | 設計詳情 |
| `GET /api/promo-image/generations/:id` 或同等 | 商攝詳情 |
| `GET /api/media-wall-item/:type/:id` | 僅 UGC type：`user_design`、`promo_scene` |
| `GET /inspiration/user_design|promo_scene/:id` | SSR 前後皆可（擇一避免雙計） |
| 本人 `GET /api/custom-products` 列表 | **不計**（可選：僅點進詳情才計） |

### 4.5 靈感牆查詢

**檔案：** `lib/media-wall-queries.js`

公開牆排除：

- `soft_deleted_at IS NOT NULL`
- `show_on_homepage = false`（含人像、緩衝內使用者關閉）
- （P2）小分類 ≥48 且上牆逾 90 天 — 內部輪替

**不過濾** `storage_tier = coldline`（仍可上牆，直到牆規則下架）。

### 4.6 公開 URL 與 SEO

| 狀態 | `/inspiration/*` | sitemap |
|------|------------------|---------|
| 正常 | 200 | 列入 |
| 軟刪 | **410 Gone** | 移除 |
| Coldline 未軟刪 | 200（開啟時恢復 standard） | 列入 |

**檔案：** `server.js` `GET /inspiration/:type/:id`、`GET /api/media-wall-item`、`routes/sitemap.js`

### 4.7 收藏豁免

`hasMediaWallFavorite` 查詢 `item_id` 格式需與前端一致（例如 `user_design:{uuid}`、`promo_scene:{uuid}` — 實作前 grep `media_wall_favorites` 寫入處確認）。

有收藏 → 跳過 `shouldSoftDelete` 與 GCS 硬刪；建議也跳過 Coldline。

---

## 5. 實作分期

### P0 — 基礎留存（約 3～4 人天）

1. SQL migration（profiles + 兩張 UGC 表）
2. `lib/object-storage.js`：storage class + delete + URL 解析
3. `lib/ugc-retention.js` 核心 + `markAccessed`
4. 生圖寫入欄位；免費新圖 `retention_tier=free`
5. `canControlDesignShowOnHomepage` + 人像後端修正
6. 詳情 API `markAccessed`
7. `scripts/ugc-retention-cron.js`：僅 Coldline sweep（先不軟刪）
8. `lib/admin-migrations.js` 登記 migration id

**驗收：** 免費測試帳號生圖 → 改 DB 將 `last_accessed_at` 往前 91 天 → cron → 物件變 Coldline；點詳情 → Standard。

### P1 — 降級／升級 + 雙軌緩衝（約 2～3 人天）

1. `user_subscriptions.cancellation_reason` + 取消訂閱 API 寫入 `user_voluntary`
2. 扣款失敗 Webhook／`subscription-expiry-cron` 寫入 `payment_failed` 或 `expired_no_renew`
3. `applyDowngradeToFree(userId, { kind })` 接入 `syncMembershipCatalogVisibility`
4. **voluntary**：`enforceWallGraceExpired(userId)` **立即**執行（非人像強制上牆）
5. **involuntary**：`wall_grace_until = +15d`；`GET /api/me/capabilities` 回傳剩餘天數
6. `show-on-homepage-control.js` + 帳號頁（僅 involuntary 顯示「15 日內請整理或續訂」）
7. `scripts/subscription-expiry-cron.js`：`end_date` 過期 → `expired` + `expired_no_renew` + sync

**驗收：**  
- 主動取消 → 當下非人像強制上牆。  
- 扣款失敗 → 15 天內仍可關上牆；第 16 天強制開。

### P2 — 刪除、410、sitemap、牆輪替（約 2～3 人天）

1. 軟刪 + 15 天 GCS 硬刪
2. 收藏豁免
3. `/inspiration` 410；sitemap 排除 `soft_deleted_at`
4. 小分類 &lt;48 牆面例外（`wall_category_key` 計數 job）
5. Admin `generation-records.html` 可選顯示 `storage_tier` / 到期

### P3 — 體驗與營運（約 1～2 人天）

1. 降級／到期前站內通知（第 0、7 天）
2. 「我的設計」顯示保存狀態（標準／冷儲存／將刪除）
3. 後台報表：coldline 總量、即將刪除筆數
4. 條款／方案頁文案更新

---

## 6. 部署與運維

### 6.1 Cloud Scheduler（matchdo 專案）

```bash
# 範例：每日 03:00 UTC
gcloud scheduler jobs create http ugc-retention-daily \
  --schedule="0 3 * * *" \
  --uri="https://<matchdo-url>/api/internal/ugc-retention-cron" \
  --http-method=POST \
  --headers="Authorization=Bearer <INTERNAL_CRON_SECRET>"
```

或 Cloud Run Job 執行 `node scripts/ugc-retention-cron.js`（需 `SUPABASE_SERVICE_ROLE_KEY`）。

### 6.2 環境變數

| 變數 | 說明 |
|------|------|
| `UGC_RETENTION_COLDLINE_DAYS` | 預設 `90` |
| `UGC_RETENTION_DELETE_AFTER_COLDLINE_DAYS` | 預設 `90` |
| `UGC_RETENTION_SOFT_DELETE_GRACE_DAYS` | 預設 `15` |
| `UGC_WALL_GRACE_DAYS` | 降級上牆緩衝，預設 `15` |
| `UGC_WALL_SUBCATEGORY_SPARSE_MAX` | 內部，預設 `48` |
| `INTERNAL_CRON_SECRET` | 內部 cron 驗證 |

### 6.3 監控

- 每日 cron 日誌：coldline / soft / hard 計數
- GCS bucket 監控：Coldline 物件數、刪除失敗
- 平台用量監控頁可選加「UGC Coldline 估算」

### 6.4 風險

| 風險 | 對策 |
|------|------|
| Coldline 讀取延遲 | 僅詳情觸發恢復；CDN 快取仍有效 |
| Cron 漏跑 | Scheduler 告警；手動 `node scripts/ugc-retention-cron.js` |
| `item_id` 收藏格式不一致 | P2 前統一並寫 migration 修正 |
| 降級未觸發 sync | 補 subscription-expiry-cron |
| 誤刪付費圖 | 所有 sweep 必帶 `retention_tier = 'free'` |

---

## 7. 測試清單

- [ ] 免費新生圖：欄位正確、非人像強制上牆
- [ ] 免費人像：預設不上牆
- [ ] 91 天無存取 → Coldline；點詳情 → Standard + `last_accessed_at` 更新
- [ ] 付費圖：永不 Coldline
- [ ] 降級：15 天內可關上牆；期滿強制開（非人像）
- [ ] 降級後 7 天內續訂：清緩衝、恢復 paid tier
- [ ] 有收藏：不軟刪
- [ ] 軟刪後：inspiration 410、sitemap 無該 URL
- [ ] 廠商 portfolio／vendor_assets：不受 cron 影響
- [ ] GCS 硬刪後：URL 404，DB `ai_generated_image_url` 已清或標記

---

## 8. 相關檔案索引

| 類型 | 路徑 |
|------|------|
| 會員判斷 | `server.js` `hasActivePaidSubscription`、`syncMembershipCatalogVisibility` |
| 上牆 UI | `public/js/show-on-homepage-control.js` |
| 媒體牆查詢 | `lib/media-wall-queries.js` |
| GCS | `lib/object-storage.js`、`docs/PLAN-storage-gcs-migration.md` §5.4 |
| 收藏 | `docs/media-wall-favorites.sql` |
| 能力 API | `GET /api/me/capabilities` |
| Sitemap | `routes/sitemap.js` |

---

## 9. 修訂紀錄

| 日期 | 說明 |
|------|------|
| 2026-09-09 | 初版：存取驅動 Coldline、降級 15 天上牆緩衝、廠商內容排除、收藏不刪 |
| 2026-09-09 | 降級雙軌：主動取消無上牆緩衝；忘記續訂／扣款失敗 15 天緩衝 |
