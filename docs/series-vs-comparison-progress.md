# 系列圖 vs 對照圖分離 — 進度與規格

更新：2026-03-04

---

## 檢查與修復狀態（最近一次）

- **API**：`layout_type=series` 或 `collection` 時只查廠商 series（`image_url_before` 為 null）＋ media_collections，回傳皆為 `type=series`；`layout_type=comparison` 時只查 `image_url_before` 非 null；`layout_type=user_design` 時只查 custom_products；回傳前依 layoutOnly 過濾，且防呆：有 manufacturer_id 的絕不為 user_design。
- **前端**：`applyStateFromURL` 支援 `series`；篩選按鈕「系列圖」為 `data-layout-type="series"`；`renderOne` 對 `series`／`collection` 同一分支（1/2/4 張、1×2）；`loadMediaWall` 會帶 `layout_type`，並以 `currentLayoutType` 再濾一次。
- **聯絡資訊**：儲存失敗時請在 Supabase 執行 `docs/fix-contact-info-fk-to-auth-users.sql`。

---

## 目前進度（總覽）

| 項目 | 狀態 | 說明 |
|------|------|------|
| 系列圖／對照圖資料分離 | ✅ | 系列：`series_image_urls`、`image_url_before=null`；對照：`image_url`＋`image_url_before`，不混用 |
| **資料夾與系列圖整合為同一種** | ✅ | **後端**：media_collections 改為回傳 `type=series`、`series_image_urls`（與廠商系列一致）。篩選「系列圖」或「資料夾」皆回傳同一組（廠商 series + 資料夾）。**前端**：`renderOne` 以 `series \|\| collection` 同一分支渲染（1/2/4 張、1×2 大卡規則一致）。 |
| 上傳類型選擇（系列／對照） | ✅ | 新增時單選，一次一種；對照欄位標示「設計圖」「作品圖」 |
| 編輯依類型顯示區塊 | ✅ | 純系列只顯示系列區塊並列出**全部** series_image_urls；對照只顯示設計圖／作品圖 |
| 靈感牆「對照圖」篩選 | ✅ | **已修**：`layout_type=comparison` 時 API 只查 `image_url_before` 非 null，沒傳對照圖的項目不會出現 |
| 靈感牆「系列圖」／「資料夾」篩選 | ✅ | 兩者皆查廠商 series + media_collections，回傳皆為 `type=series`，前端同一套顯示 |
| 防呆不把廠商當設計圖 | ✅ | API 回傳前將有 manufacturer_id 且 type=user_design 的改為 comparison/series |
| Lightbox 按鈕 | ✅ | 有 manufacturer_id→「廠商詳情」連 vendor-profile；否則「搜尋廠商」 |
| 聯絡資訊儲存失敗 | ⚠️ 需執行 SQL | 執行 `docs/fix-contact-info-fk-to-auth-users.sql` 將 contact_info.user_id 改參照 auth.users |

---

## 規格摘要

| 類型 | 說明 | DB 欄位 | 靈感牆顯示 |
|------|------|---------|------------|
| **系列圖** | 廠商上傳多張圖 | `image_url_before` 為 null，`series_image_urls` 存多張 | 1×2／2×2 多圖格 |
| **對照圖** | 設計圖＋作品圖兩張 | `image_url_before`＝設計圖、`image_url`＝作品圖 | 滑桿（左＝設計圖、右＝作品圖） |

- 沒傳對照圖的項目**不能**出現在對照圖區。
- 系列圖**不能**當成對照圖或設計圖（禁止把廠商圖當設計圖）。

---

## 已完成

### 後端（server.js）

- **GET /api/media-wall**
  - `layout_type=series`／`layout_type=collection`：**整合為同一種**。皆查廠商 series（image_url_before 為 null）＋ media_collections（資料夾）；資料夾改為回傳 `type=series`、`series_image_urls`（來自 image_urls 或 [cover]），與廠商系列同一格式。篩選結果皆 filter 為 `type===series`。
  - `layout_type=comparison`：**查詢時**即加上 `.not('image_url_before', 'is', null)`，只回傳有設計圖的項目；系列圖不會被塞進對照圖區（含 hasCategoryFilter 與 fallback 分支皆同）。
  - 防呆：有 `manufacturer_id` 的項目絕不設為 `type=user_design`（根因修在 API 回傳）。
- **GET/POST/PUT 廠商作品**
  - 支援 `show_on_media_wall`、`series_image_urls`。
  - POST：純系列只寫 `series_image_urls` 且 `image_url_before=null`；對照圖只寫 `image_url`／`image_url_before`，不寫 series。
  - PUT：`upload_type=series` 時明確清除 `image_url_before`，避免混成對照圖。

### 前端 — 首頁靈感牆（public/iStudio-1.0.0/index.html）

- 「系列圖」按鈕 `data-layout-type="series"`，「對照圖」為 `comparison`，「資料夾」為 `collection`（與系列圖後端同一種，篩選結果相同）。
- `applyStateFromURL` 含 `series`；篩選後以 `layout_type` 重載 API。
- `renderOne`：**系列圖與資料夾整合**，`type===series` 或 `type===collection` 同一分支，依 `series_image_urls`／`image_urls`／`cover_image_url` 顯示 0/1/2/4 張、1×2 大卡規則一致；`type===comparison` 用滑桿；收藏還原時依 `manufacturer_id`／`image_url_before` 推 type，並帶 `series_image_urls`。
- 載入後依 `currentLayoutType` 過濾 `items`，只顯示對應 type。
- Lightbox：有 `manufacturer_id` 顯示「廠商詳情」→ `vendor-profile.html?id=...`；否則「搜尋廠商」。

### 前端 — 廠商作品（public/client/manufacturer-portfolio.html）

- **上傳類型**：單選「系列圖（可多張）」／「對照圖（設計圖＋作品圖）」；一次只能一種，切換時清空另一區檔案。
- **新增**：系列模式只送多張 `image`；對照模式送 `image`（作品圖）＋`image_before`（設計圖）。
- **編輯**：依 `image_url_before` 有無決定顯示「系列圖區塊」或「對照圖區塊」；系列區塊用 `edit-current-series-wrap` 顯示**全部** `series_image_urls`（多張縮圖）；對照區塊只顯示設計圖／作品圖。
- **公開／不公開**：對應 `show_on_media_wall`，列表與表單皆有。

---

## 聯絡資訊儲存失敗（contact_info FK）

- **現象**：`/profile/contact-info.html` 儲存時 `contact_info_user_id_fkey` 違反外鍵。
- **原因**：`contact_info.user_id` 若參照 `public.users`，而登入來自 Supabase Auth（`auth.users`），可能無對應列。
- **修正**：在 Supabase SQL Editor 執行 **`docs/fix-contact-info-fk-to-auth-users.sql`**，將外鍵改為參照 `auth.users(id)`。

---

## 設計圖僅 AI 生成、系列圖 1×2 不重複（2026-03-04）

- **設計圖只准 AI 生成**：`layout_type=user_design` 時 API 只查 `custom_products`，且回傳前過濾為 `type===user_design` 且無 `manufacturer_id`；廠商圖絕不當設計圖。
- **系列圖 1×2**：前端不再用同一張圖填兩格；僅 1 張時顯示單圖，2 張時顯示 1×2 兩張**不同**圖，4 張以上顯示 2×2；系列 2+ 張時卡片加 `media-wall-1x2`。

---

## 待確認／可選優化

1. **編輯系列圖換圖**：目前 PUT 只支援單張 `image` 更新主圖，不會整批替換 `series_image_urls`；若需「一次換掉全部系列圖」需另支援多檔上傳。
2. **Sitemap**：若需系列／對照獨立 URL，可在 `docs/sitemap.md` 或 SEO 設定中補 `layout_type=series`、`layout_type=comparison`。

---

## 關鍵檔案

| 用途 | 路徑 |
|------|------|
| 首頁靈感牆 | `public/iStudio-1.0.0/index.html` |
| 靈感牆 API | `server.js` 約 5753 行起 `GET /api/media-wall` |
| 廠商作品上傳／編輯 | `public/client/manufacturer-portfolio.html` |
| 聯絡資訊 FK 修正 | `docs/fix-contact-info-fk-to-auth-users.sql` |

---

## 部署

部署方式僅一種：**Google Cloud Shell**（見 `.cursor/rules/deployment.mdc`）。  
指令範例：

```bash
cd ~/matchdo && git fetch origin main && git reset --hard origin/main && gcloud run deploy matchdo --source . --region=asia-northeast1 --allow-unauthenticated --clear-base-image
```
