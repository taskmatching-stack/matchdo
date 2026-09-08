# Storage → GCS 遷移進度

**主規劃：** [PLAN-storage-gcs-migration.md](./PLAN-storage-gcs-migration.md)  
**最後更新：** 2026-09-09  
**狀態：** Phase 0～3 ✅ 完成；Phase 4 雙存進行中；Phase 5 待雙存期滿

---

## 架構摘要（上線後）

| 項目 | 現況 |
|------|------|
| **圖片讀寫** | GCP **GCS** `matchdo-media`（`asia-northeast1`） |
| **公開 CDN** | **`https://media.matchdo.cc`**（Cloud CDN + LB） |
| **DB URL** | `https://media.matchdo.cc/custom-products/...`、`.../project-images/...` |
| **上傳程式** | `lib/object-storage.js`；`server.js` 的 `uploadToSupabaseStorage()` 內部走 GCS |
| **Supabase** | 僅 **Auth + PostgreSQL**；Storage 雙存 2 週後清空 |
| **環境變數（選用）** | `GCS_MEDIA_BUCKET=matchdo-media`、`GCS_PUBLIC_BASE_URL=https://media.matchdo.cc` |

---

## Phase 0 — GCP + `media.matchdo.cc`（✅ 2026-09-09）

- [x] `gs://matchdo-media`、Lifecycle（preview 90 天）
- [x] DNS `media` → **34.102.231.202**（GoDaddy）
- [x] SSL ACTIVE、healthcheck **200**
- [x] Cloud Run SA **objectAdmin**；bucket **objectViewer**（CDN 讀取）

---

## Phase 1 — 新上傳走 GCS（✅）

- [x] `lib/object-storage.js`、`@google-cloud/storage`
- [x] 部署驗證：新圖 URL 為 `media.matchdo.cc`

---

## Phase 2 — 批量複製物件（✅ 2026-09-09）

- [x] `scripts/migrate-supabase-storage-to-gcs.js`
- [x] **6968 / 6970** 成功（2 個 `vendor-assets-preview` 失敗，可忽略）
- [x] manifest：`tmp/gcs-migration-manifest.jsonl`

---

## Phase 3 — DB URL 改寫（✅ 2026-09-09）

- [x] `docs/storage-gcs-phase3-rewrite-urls.sql`（Supabase SQL Editor）
- [x] 驗證：`remaining_supabase_storage_urls = 0`
- [x] 前台抽樣 QA 通過

---

## Phase 4 — 雙存 2 週（進行中）

| 日期 | 事項 |
|------|------|
| **2026-09-09** | Phase 3 完成日起算 |
| **～2026-09-23** | 期滿前勿刪 Supabase Storage 舊物件 |
| 期間 | 新上傳僅 GCS；舊 Supabase URL 仍可读（備援） |

- [ ] 雙存期滿（2026-09-23 後執行 Phase 5）

---

## Phase 5 — 清空 Supabase Storage（待辦）

雙存期滿後：

1. Supabase Dashboard → Storage → 清空 `custom-products`、`project-images`
2. 確認 Dashboard 用量 ≈ 0
3. 勾選本檔 Phase 5 完成

---

## Baseline（遷移前）

| 項目 | 值 |
|------|-----|
| Supabase 物件 / 大小 | 6970 / ~2.44 GB |
| DB Supabase URL 筆數 | 3728 |

---

## 相關腳本與 SQL

| 檔案 | 用途 |
|------|------|
| `scripts/gcs-media-phase0-setup.sh` | GCP bucket、CDN、DNS 說明 |
| `scripts/migrate-supabase-storage-to-gcs.js` | Phase 2 搬檔 |
| `docs/storage-gcs-phase3-rewrite-urls.sql` | Phase 3 改 DB |
| `docs/storage-gcs-phase0-inventory.sql` | URL 殘留盤點 |

---

## 歷史

- Phase 1.6（2026-02）：本地上傳 → Supabase Storage，見 [PHASE-1.6-STORAGE-MIGRATION.md](./PHASE-1.6-STORAGE-MIGRATION.md)
- 2026-09：Storage quota 連帶鎖站 → 遷移 GCS，見本檔與 PLAN
