# Supabase Storage → GCS 遷移規劃

**狀態**：Phase 0 進行中（腳本已進 repo）  
**最後更新**：2026-09-08  
**進度 handoff：** [PROGRESS-storage-gcs-migration.md](./PROGRESS-storage-gcs-migration.md)  
**目標**：圖片改存 GCP；Supabase 只留 Auth + PostgreSQL，避免 Storage quota 連帶鎖整站。

---

## 使用者定案（2026-09-08）

| # | 項目 | 決定 |
|---|------|------|
| 1 | **公開讀圖域名** | 直接做 **`https://media.matchdo.cc`**（GCS + Cloud CDN + Load Balancer） |
| 2 | **過渡期雙存** | Supabase 舊物件 **保留 2 週**（GCS 為主、DB 已改寫後仍不刪 Supabase） |
| 3 | **暫存目錄生命週期** | **90 天**自動刪除（僅 `*-preview/` 前綴，見 §5.4） |

---

## 一、成功標準

1. 新上傳 100% 進 GCS，DB 存 `https://media.matchdo.cc/...` URL  
2. 既有 Supabase 物件已複製到 GCS，DB／JSONB 內 URL 已改寫  
3. 遷移完成後 **2 週**內 Supabase Storage 舊檔仍可读（雙存）  
4. 2 週後清空 Supabase Storage；Dashboard 用量接近 0  
5. 首頁媒體牆、作品、素材、商攝、help-guides 圖片抽樣 QA 無 404  

---

## 二、現況盤點（repo）

### 2.1 Supabase Buckets

| Bucket | 用途 |
|--------|------|
| `custom-products` | 主體（生圖、素材、作品、訊息圖等） |
| `project-images` | 專案／ai-detect 上傳圖 |

上傳入口：`server.js` → `uploadToSupabaseStorage()`（約 30 處）+ `routes/help-guides.js`。

### 2.2 `custom-products` 路徑前綴（GCS **原樣保留**）

```
vendor-assets/{manufacturerId}
vendor-assets-preview/{manufacturerId}     ← 暫存，90 天 lifecycle
manufacturer/{manufacturerId}
generated/
product/
promo/{userId}
embed-generated/
embed-scene-sim/
help-guides/
supplier-catalog/{supplierId}
supplier-catalog-preview/{supplierId}      ← 暫存，90 天 lifecycle
print-asset-preview/{userId}               ← 暫存，90 天 lifecycle
material-combo-preview/{userId}            ← 暫存，90 天 lifecycle
messages/{conversationId}
```

`project-images/{owner_id|anon}/...` 同步鏡像到 GCS 同 path。

### 2.3 需改寫 URL 的資料

**TEXT 欄位：** `custom_products`（`reference_image_url`、`ai_generated_image_url`）、`manufacturer_portfolio`（`image_url`、`image_url_before`）、`manufacturers.logo_url`、`vendor_assets.image_url`、`supplier_catalog_items` 封面欄、`media_collections.cover_image_url`、`product_promo_generations`（`source_image_url`、`result_image_url`）、`user_print_generations.image_url`、`user_material_combo_generations.image_url`、`direct_messages.image_url`、`projects.cover_image_url`、`ai_categories`／`ai_subcategories.image_url`、`visual_semantics_events.image_url`。

**JSONB（需 Node 深度掃描）：** `vendor_assets.gallery_images`、`supplier_catalog_items.gallery_images`、`manufacturer_portfolio.series_image_urls`、`custom_products.reference_sources`、`projects.description.files`、`listings.images`、`help_guide_pages.blocks_json`、`media_wall_favorites.item_data`（可選）。

### 2.4 程式觸點（實作階段）

- `server.js`：`uploadToSupabaseStorage` → 改為 `uploadToObjectStorage`（GCS）  
- `routes/help-guides.js`  
- `scripts/upload-portfolio-images-and-seed.js`  
- 前端無硬編 `supabase.co/storage`；DB URL 改完即可  

---

## 三、目標架構

```
瀏覽器 / FLUX / Gemini
    ↓ HTTPS
media.matchdo.cc  （Cloud CDN）
    ↓
External HTTP(S) Load Balancer
    ↓ backend bucket
GCS: matchdo-media
    ├── custom-products/...
    └── project-images/...

Cloud Run (matchdo) ──上傳──→ GCS matchdo-media
Cloud Run ──查寫──→ Supabase PostgreSQL + Auth（不再寫 Storage）
```

### 3.1 GCS Bucket

| 項目 | 值 |
|------|-----|
| 專案 | `matchdo`（與 Cloud Run 相同） |
| Bucket 名稱 | `matchdo-media` |
| Location | `asia-northeast1`（與 Cloud Run 同區） |
| 存取 | Uniform bucket-level access；對外經 **LB + CDN**；bucket 需 `allUsers` **objectViewer**（否則 403），公開 URL 仍只用 `media.matchdo.cc` |

### 3.2 公開 URL 格式

```
https://media.matchdo.cc/custom-products/vendor-assets/{id}/{file}.jpg
https://media.matchdo.cc/project-images/{owner}/...
```

後端環境變數（規劃）：

| 變數 | 範例 |
|------|------|
| `GCS_MEDIA_BUCKET` | `matchdo-media` |
| `GCS_PUBLIC_BASE_URL` | `https://media.matchdo.cc` |

`uploadToObjectStorage` 回傳的 `publicUrl` = `GCS_PUBLIC_BASE_URL` + `/` + bucket + `/` + objectPath（或 bucket 名稱作 path 第一段，與現有 Supabase path 對齊）。

### 3.3 GCP 基礎建設（Phase 0，Console／gcloud）

1. **建立 bucket** `matchdo-media`（`asia-northeast1`）  
2. **Backend bucket** 指向 `matchdo-media`  
3. **URL map** + **Target HTTPS proxy** + **Forwarding rule**（全域）  
4. **Cloud CDN** 啟用在 backend bucket（cache mode：cache all static；TTL 建議 1d～7d，圖片可較長）  
5. **DNS**：`media.matchdo.cc` → A/AAAA 指到 LB IP（或 CNAME 若用 Google 托管）  
6. **SSL**：Google managed certificate for `media.matchdo.cc`  
7. **Cloud Run 服務帳號**（`matchdo` 服務）：`roles/storage.objectAdmin` on `matchdo-media`（或 objectCreator + 必要讀權）  

**注意：** 設定完成後用 `curl -I https://media.matchdo.cc/...` 測試一張測試物件，確認 CDN `cache-hit` 行為再開 Phase 1。

---

## 四、遷移分期

### Phase 0 — 盤點與 GCP 準備（0.5～1 天）

**操作說明：** [PROGRESS-storage-gcs-migration.md](./PROGRESS-storage-gcs-migration.md)

- [ ] Supabase Dashboard：兩桶物件數、總 GB（或 `node scripts/inventory-supabase-storage-buckets.js`）  
- [ ] Cloud Shell：`bash scripts/gcs-media-phase0-setup.sh`（§3.3 bucket、CDN、IAM）  
- [ ] DNS：`media` → LB IP；SSL ACTIVE  
- [ ] `bash scripts/gcs-media-phase0-healthcheck.sh` → `/_healthcheck/phase0.txt` 200  
- [ ] SQL／腳本盤點：`docs/storage-gcs-phase0-inventory.sql` 或 `inventory-supabase-storage-urls.js`  

### Phase 1 — 新上傳走 GCS（2～3 天）

- [ ] 新增 `lib/object-storage.js`（`@google-cloud/storage`）  
- [ ] `uploadToObjectStorage` 回傳 `https://media.matchdo.cc/...`  
- [ ] 替換所有 `uploadToSupabaseStorage` 呼叫點  
- [ ] Cloud Run 部署 + 抽樣：素材上傳、生圖、商攝存檔、help-guides 上傳  

**效果：** 新圖不再進 Supabase；舊圖仍在 Supabase。

### Phase 2 — 批量複製物件（1 天 + 跑批）

- [ ] 腳本 `scripts/migrate-supabase-storage-to-gcs.js`（規劃，尚未寫）  
- [ ] `list` Supabase `custom-products`、`project-images` → `download` → `upload` GCS **同 path**  
- [ ] 產出 manifest：`supabase_public_url → media.matchdo.cc_url`  
- [ ] Idempotent；抽樣 MD5／大小比對  

### Phase 3 — DB／JSONB URL 改寫（1～2 天）

- [ ] **先確認 Phase 2 完成**  
- [ ] 各表 TEXT 欄位 `regexp_replace`（host 改為 `https://media.matchdo.cc/`）  
- [ ] Node 腳本深度掃 JSONB（`gallery_images`、`blocks_json` 等）  
- [ ] 全庫驗證：`LIKE '%supabase.co/storage%'` 應為 0（或僅快照表）  
- [ ] 手動 QA：首頁媒體牆、作品、素材庫、商攝、操作介紹  

### Phase 4 — 雙存過渡 **2 週**（定案）

| 時間 | 行為 |
|------|------|
| Phase 3 完成日起 | DB 與新上傳皆指向 `media.matchdo.cc`；**Supabase 舊物件不刪** |
| 第 1～14 天 | 監控 404／使用者回報；舊 Supabase URL 仍可直接讀（書籤、外鏈） |
| 第 15 天起 | Phase 5 清空 Supabase Storage |

**雙存期間：** GCS 為正式來源；Supabase 僅作舊 URL 備援，不再寫入。

### Phase 5 — 收尾（0.5 天）

- [ ] 刪除 Supabase Storage 兩桶內所有物件（或整桶清空）  
- [ ] 確認 Supabase Dashboard Storage ≈ 0  
- [ ] 更新 `docs/matchdo-todo.md` 技術決策（Storage → GCS）  
- [ ] 啟用 §5.4 Lifecycle（若 Phase 0 未先開）  

---

## 五、營運策略

### 5.1 Storage 與 DB 解耦（遷移後）

| 事件 | 影響 |
|------|------|
| GCS 用量高 | 帳單上升；**不**鎖 Supabase Auth／DB |
| Supabase DB 異常 | 首頁仍可能空（需另做快取，見 SEO／架構文件） |
| CDN 快取 | 讀圖多走 edge，減輕 GCS egress |

### 5.2 舊 URL 對照（redirect 選用）

若需程式層 redirect（非必須，雙存 2 週已涵蓋多數情況）：

```
https://{ref}.supabase.co/storage/v1/object/public/{bucket}/{path}
  → 302 https://media.matchdo.cc/{bucket}/{path}
```

### 5.3 監控（建議）

- GCS bucket 用量：50%／80% 告警（Cloud Monitoring）  
- CDN 4xx/5xx rate on `media.matchdo.cc`  
- Supabase Storage：雙存期結束前確認可刪  

### 5.4 Lifecycle — 暫存目錄 90 天（定案）

僅刪 **預覽／暫存** 前綴；**不**套用在使用者已存庫路徑。

| GCS prefix | 說明 |
|------------|------|
| `custom-products/vendor-assets-preview/` | 素材優化／重繪預覽 |
| `custom-products/supplier-catalog-preview/` | 供應商目錄預覽 |
| `custom-products/print-asset-preview/` | 印花預覽 |
| `custom-products/material-combo-preview/` | 材料組合預覽 |

**Lifecycle 規則：** Object age **≥ 90 天** → Delete。

**刻意不套用 90 天刪除：**

- `generated/`、`promo/`、`vendor-assets/`、`manufacturer/`、`product/`、`messages/`、`help-guides/`、`embed-generated/`、`embed-scene-sim/`、`supplier-catalog/`、`project-images/`  
- 理由：DB 可能長期引用；僅 preview 目錄為「未存庫前的暫存」。

若未來要清測試生圖，另開「手動／批次清理腳本」需求，不走全域 lifecycle。

---

## 六、風險與對策

| 風險 | 對策 |
|------|------|
| JSONB 漏改 | Phase 3 全庫掃描 + 各模組手動 QA |
| CDN／DNS 未生效 | Phase 0 用 `_healthcheck` 測通再改上傳 |
| FLUX／Gemini 拉圖失敗 | `media.matchdo.cc` 須公網可讀；遷移後跑一次生圖測試 |
| 雙存 2 週後舊連結 404 | 第 14 天前跑「仍含 supabase URL」的日誌／DB 殘留檢查 |
| Preview lifecycle 誤刪 | 僅限 §5.4 四個 prefix；存庫後 URL 在 `vendor-assets/` 等永久路徑 |

---

## 七、工作量粗估

| 階段 | 人天 |
|------|------|
| Phase 0（含 CDN + DNS） | 1～1.5 |
| Phase 1 | 2～3 |
| Phase 2 | 1 |
| Phase 3 | 1～2 |
| Phase 4（雙存監控） | 0.5（分散 2 週） |
| Phase 5 | 0.5 |
| **合計** | **約 6～8 人天** |

---

## 八、建議執行順序

```
Phase 0  GCP + media.matchdo.cc 上線
    ↓
Phase 1  新上傳改 GCS（止血）
    ↓
Phase 2  批量複製舊物件
    ↓
Phase 3  DB／JSONB 改寫 + QA
    ↓
Phase 4  雙存 14 天
    ↓
Phase 5  清 Supabase Storage + 確認 Lifecycle
```

---

## 九、相關文件

- 舊方案（已完成）：`docs/PHASE-1.6-STORAGE-MIGRATION.md`（當初 Supabase Storage 落地）  
- 部署：`docs/deploy-matchdo-push-and-deploy.md`  
- 技術決策待更新：`docs/matchdo-todo.md` §檔案儲存方案  

---

## 十、下一步

1. **現在：** 依 [PROGRESS-storage-gcs-migration.md](./PROGRESS-storage-gcs-migration.md) 在 Cloud Shell 跑 Phase 0，healthcheck 通過後回報  
2. **Phase 1：** 新上傳改 GCS（`lib/object-storage.js` + 替換 `uploadToSupabaseStorage`）
