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

## Phase 1 — 新上傳走 GCS（進行中）

- [x] `lib/object-storage.js` + `@google-cloud/storage`
- [x] `uploadToSupabaseStorage` → GCS（保留函式名，路徑與 Supabase 對齊）
- [ ] push `main` + Cloud Run 部署
- [ ] 抽樣：素材上傳、生圖、商攝 → URL 為 `https://media.matchdo.cc/...`

**環境變數（選用，預設已對）：**

| 變數 | 預設 |
|------|------|
| `GCS_MEDIA_BUCKET` | `matchdo-media` |
| `GCS_PUBLIC_BASE_URL` | `https://media.matchdo.cc` |

Cloud Run 服務帳號已有 bucket **objectAdmin**（Phase 0）；本機開發需 `gcloud auth application-default login` 或同等 ADC。

---

## Phase 2～5

見 [PLAN-storage-gcs-migration.md](./PLAN-storage-gcs-migration.md)。
