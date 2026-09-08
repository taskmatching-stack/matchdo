# Storage → GCS 遷移進度

**主規劃：** [PLAN-storage-gcs-migration.md](./PLAN-storage-gcs-migration.md)  
**最後更新：** 2026-09-08

---

## Phase 0 — 盤點與 GCP 準備（進行中）

### Repo 已備好（可 pull 後在 Cloud Shell 執行）

| 檔案 | 用途 |
|------|------|
| `scripts/gcs-media-phase0-setup.sh` | 建立 bucket、CDN、LB、`media.matchdo.cc` SSL、Cloud Run IAM、上傳 healthcheck |
| `scripts/gcs-media-phase0-healthcheck.sh` | DNS + SSL 生效後驗證 `https://media.matchdo.cc/_healthcheck/phase0.txt` |
| `infra/gcs-matchdo-media-lifecycle.json` | 四個 `*-preview/` 前綴 90 天刪除 |
| `infra/gcs-healthcheck/phase0.txt` | CDN 測試用物件 |
| `docs/storage-gcs-phase0-inventory.sql` | Supabase SQL Editor：DB URL baseline |
| `scripts/inventory-supabase-storage-buckets.js` | 本機／CI：Supabase 兩桶物件數與大小 |
| `scripts/inventory-supabase-storage-urls.js` | 本機：DB URL 筆數（需 `SUPABASE_DB_URL`） |

### 你在 Cloud Shell 執行（依序）

**0. 帳號與專案**

```bash
gcloud config set account taskmatching@gmail.com
gcloud config set project matchdo
```

**1. 拉最新 main 並跑 GCP 建置**

```bash
cd ~/matchdo && git fetch origin main && git reset --hard origin/main
bash scripts/gcs-media-phase0-setup.sh
```

腳本結尾會印 **LB IP** 與 **DNS 設定**。

**2. DNS（matchdo.cc 管理面板）**

| 類型 | 名稱 | 值 |
|------|------|-----|
| A | `media` | 腳本輸出的 LB IP |

**3. 等 SSL ACTIVE（15–60 分鐘）**

```bash
gcloud compute ssl-certificates describe matchdo-media-cert --global \
  --format='table(name,managed.status,managed.domainStatus)'
```

`managed.status` = `ACTIVE` 且 `media.matchdo.cc` = `ACTIVE` 後再下一步。

**4. Healthcheck**

```bash
bash scripts/gcs-media-phase0-healthcheck.sh
```

**5. 盤點 baseline**

- Supabase Dashboard → Storage：記下兩桶 GB（與腳本對照）  
- 本機（有 `.env`）：

```bash
node scripts/inventory-supabase-storage-buckets.js
node scripts/inventory-supabase-storage-urls.js
```

- 或 Supabase SQL Editor 執行 `docs/storage-gcs-phase0-inventory.sql`

### Phase 0 完成勾選

- [ ] `gs://matchdo-media` 存在（`asia-northeast1`）
- [ ] Lifecycle 已套用（preview 90 天）
- [ ] `media.matchdo.cc` DNS → LB IP
- [ ] SSL 憑證 ACTIVE
- [ ] `curl -I https://media.matchdo.cc/_healthcheck/phase0.txt` → **200**
- [ ] Cloud Run SA 有 `matchdo-media` **objectAdmin**
- [ ] DB／Storage baseline 數字已記錄（貼在下方）

#### Baseline 記錄（執行後填）

| 項目 | 值 | 日期 |
|------|-----|------|
| Supabase `custom-products` 物件數 / GB | **6962 / 2.44 GB** | 2026-09-08（本機腳本） |
| Supabase `project-images` 物件數 / GB | **4 / 2.57 MB** | 2026-09-08 |
| DB 含 supabase storage URL 總筆數（約） | **3728**（2026-09-08 SQL Editor） | |

#### DB URL 分布（Phase 3 優先驗證）

| source | rows | 備註 |
|--------|------|------|
| `visual_semantics_events.image_url` | 1659 | 語意事件 log，非前台主路徑 |
| `vendor_assets.image_url` | 880 | 素材封面 |
| `vendor_assets.gallery_images` | 592 | 圖庫 JSONB |
| `product_promo_generations.result_image_url` | 183 | 商攝成品 |
| `custom_products.ai_generated_image_url` | 128 | 設計稿生圖 |
| `product_promo_generations.source_image_url` | 94 | 商攝原圖 |
| `custom_products.reference_sources` | 56 | JSONB |
| `manufacturer_portfolio.*` | 80 | 作品 39+24+17 |
| `manufacturers.logo_url` | 23 | |
| 其餘 | 34 | 供應商目錄、訊息、收藏快照等 |

前台／媒體牆優先 QA：`vendor_assets`、`custom_products`、`product_promo_generations`、`manufacturer_portfolio`。
| LB IP | 待 `gcs-media-phase0-setup.sh` 輸出 | |
| SSL ACTIVE 時間 | 待 DNS 後 | |

---

## Phase 1 — 新上傳走 GCS（未開始）

待 Phase 0 healthcheck 通過後實作。

---

## Phase 2～5

見 [PLAN-storage-gcs-migration.md](./PLAN-storage-gcs-migration.md)。
