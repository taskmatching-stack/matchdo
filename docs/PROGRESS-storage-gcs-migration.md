# Storage → GCS 遷移進度

**主規劃：** [PLAN-storage-gcs-migration.md](./PLAN-storage-gcs-migration.md)  
**最後更新：** 2026-09-08

---

## Phase 0 — 盤點與 GCP 準備（✅ 完成 2026-09-09）

### Phase 0 完成勾選

- [x] `gs://matchdo-media` 存在（`asia-northeast1`）
- [x] Lifecycle 已套用（preview 90 天）
- [x] `media.matchdo.cc` DNS → **34.102.231.202**（GoDaddy）
- [x] SSL 憑證 ACTIVE
- [x] `curl -I https://media.matchdo.cc/_healthcheck/phase0.txt` → **200**
- [x] Cloud Run SA 有 `matchdo-media` **objectAdmin**
- [x] Bucket `allUsers` **objectViewer**（CDN 讀取；403 修復）
- [x] DB／Storage baseline 已記錄

#### Baseline 記錄

| 項目 | 值 | 日期 |
|------|-----|------|
| Supabase `custom-products` 物件數 / GB | **6962 / 2.44 GB** | 2026-09-08 |
| Supabase `project-images` 物件數 / GB | **4 / 2.57 MB** | 2026-09-08 |
| DB 含 supabase storage URL 總筆數 | **3728** | 2026-09-08 |
| LB IP | **34.102.231.202** | 2026-09-09 |
| SSL ACTIVE | **ACTIVE** | 2026-09-09 |

#### DB URL 分布（Phase 3 優先驗證）

| source | rows | 備註 |
|--------|------|------|
| `visual_semantics_events.image_url` | 1659 | 語意事件 log |
| `vendor_assets.image_url` | 880 | 素材封面 |
| `vendor_assets.gallery_images` | 592 | 圖庫 JSONB |
| `product_promo_generations.result_image_url` | 183 | 商攝成品 |
| `custom_products.ai_generated_image_url` | 128 | 設計稿生圖 |
| 其餘 | 見 SQL 明細 | |

前台優先 QA：`vendor_assets`、`custom_products`、`product_promo_generations`、`manufacturer_portfolio`。

---

## Phase 1 — 新上傳走 GCS（✅ 完成）

- [x] `lib/object-storage.js` + `@google-cloud/storage`
- [x] `uploadToSupabaseStorage` → GCS
- [x] 部署 + 抽樣 URL 為 `https://media.matchdo.cc/...`

---

## Phase 2 — 批量複製物件（腳本已備，待執行）

**腳本：** `scripts/migrate-supabase-storage-to-gcs.js`

本機（有 `.env` + `gcloud auth application-default login`）或 Cloud Shell（需 export Supabase 金鑰）：

```bash
# 先試 10 筆
node scripts/migrate-supabase-storage-to-gcs.js --dry-run --limit=10

# 正式（約 6966 物件 / 2.44 GB，可重複執行，已存在會 skip）
node scripts/migrate-supabase-storage-to-gcs.js
```

產出：`tmp/gcs-migration-manifest.jsonl`

- [ ] 全量 migrate 完成（failed=0）
- [ ] 抽樣 GCS URL 可開圖

---

## Phase 3 — DB URL 改寫（腳本已備，Phase 2 後執行）

**腳本：** `scripts/rewrite-db-storage-urls-to-gcs.js`

```bash
node scripts/rewrite-db-storage-urls-to-gcs.js --dry-run
node scripts/rewrite-db-storage-urls-to-gcs.js
```

驗證：Supabase SQL Editor 再跑 `docs/storage-gcs-phase0-inventory.sql`，TOTAL 應趨近 0。

- [ ] DB rewrite 完成
- [ ] 首頁媒體牆／素材／商攝抽樣 QA

---

## Phase 4～5

雙存 2 週 → 清空 Supabase Storage。見 [PLAN](./PLAN-storage-gcs-migration.md)。
