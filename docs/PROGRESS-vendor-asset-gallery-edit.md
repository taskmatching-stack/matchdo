# 進度紀錄：廠商素材多角度圖（新增／編輯）

**最後更新：** 2026-06-02  
**狀態：** ✅ 已上線驗證（編輯窗選檔即上傳、列表顯示多張）  
**頁面：** [`/client/manufacturer-materials.html`](https://matchdo.cc/client/manufacturer-materials.html)（僅 `public/client/`，勿改根目錄同名檔）

---

## 一、功能範圍（與其他頁無關）

| 項目 | 說明 |
|------|------|
| **適用種類** | `asset_kind = prototype`（數位原型）、`part`（配件／零件） |
| **不適用** | `material`（材料參考，單圖）；**展示案例**（`manufacturer-portfolio.html`，系列／對照圖） |
| **資料** | `vendor_assets.image_url`（封面）+ `gallery_images` jsonb `[{url, sort_order}, …]` |
| **上限** | 封面 1 + 額外多角度（見 `server.js` 內 `PROTOTYPE_GALLERY_MAX_EXTRA`） |

---

## 二、已完成（2026-06-01 確認可用）

### 新增素材（表單上方）

- 可「新增圖片」逐張或「一次選多張」加入待傳清單（`pending-image-card`）。
- 第一張為封面；可逐張勾選 **AI 重繪**；扣點：首張重繪價 + 每多一張 `points_optimize_extra`（預設 +5）。
- 送出：`POST /api/me/vendor-assets`（`image` + `gallery[]`）。

### 編輯素材（Modal）

- **產品圖片（多角度）**：縮圖格、封面標籤、非封面可刪除。
- **新增角度圖**／**一次選多張** → 選檔後**立即** `POST /api/me/vendor-assets/:id/gallery-images`。
- 狀態列：`#edit-gallery-status`（上傳中／成功／錯誤）；可勾「本批新圖 AI 重繪」。
- **更換封面**：下方「更換封面」+ 儲存時 `PUT` 單圖（與多角度 API 分開）。

### 後端

- `mapVendorAssetForApi`：`prototype` 與 `part` 皆回傳 `gallery_images`、`image_urls`、`image_count`。
- `POST`／`DELETE` `/api/me/vendor-assets/:id/gallery-images`。
- 缺欄 `42703` → 500 並提示執行 `docs/add-vendor-asset-gallery-images.sql`。

### 其他 UI

- 列表卡、lightbox 多圖可左右切換（`image-lightbox.js`）。

---

## 三、前端架構（維護用，避免再壞）

**編輯多角度僅一條路徑，勿疊第二套：**

```
#btn-edit-add-gallery / #btn-edit-add-gallery-multi
  → #edit-add-gallery-input-one | -multi（hidden file）
  → onEditGalleryFilesSelected()
  → uploadEditGalleryFiles()
  → POST .../gallery-images
  → renderEditGallery() + setEditGalleryStatus()
```

- 綁定：`bindEditGalleryUpload()`（`editGalleryUploadBound` 防重複綁定）。
- **勿**再改 HTML 為 `<label>` 內嵌 input 卻保留 `#btn-edit-add-gallery` 的舊 JS（曾導致整頁 script 載入拋錯、選檔無反應）。

**與編輯無關、但同頁的程式（不是殘留）：**

- `add-pending-images`／`btn-add-pending-image`：僅用於**上方新增表單**，與編輯 Modal 無關。

**可選清理（不影響功能）：**

- `getOptimizeBackgroundValue` 內 `edit-pending-optimize-bg` 已無對應 DOM。
- `edit-gallery-build-hint`／`__MATCHDO_MATERIALS_BUILD` 為除錯用，穩定後可移除。

---

## 四、問題紀錄（2026-05～06 排查）

| 現象 | 原因 | 處置 |
|------|------|------|
| 選檔完全沒反應、無狀態字 | HTML 改 label 後 JS 仍 `getElementById('btn-edit-add-gallery').addEventListener` → 載入拋錯 | `91ce645` 委派；`95b4b98` 改回按鈕 + 明確綁定 |
| 與「對照圖／portfolio」混淆 | 無關；展示案例為另一頁 | 僅改 `manufacturer-materials.html` |
| Console `content.js` code 403 | 瀏覽器擴充功能 | 可忽略 |
| 上傳成功仍只 1 張 | DB 未跑 `add-vendor-asset-gallery-images.sql`；或舊版 API 未回傳 `part` 的 gallery | SQL + `964649d` server |
| 編輯曾要求按「上傳待傳圖片」 | `db02661` 舊 UX | 已改選檔即傳（`0d6953a` 起） |

---

## 五、Git 參考（`public/client/manufacturer-materials.html` + `server.js`）

| Commit | 摘要 |
|--------|------|
| `9067081` / `2b8db09` | 多角度 API、新增區多圖、lightbox |
| `964649d` | 零件列表 API 回傳 gallery |
| `5051759` | 編輯恢復角度圖按鈕 |
| `91ce645` | 修正 label／按鈕 JS 不一致 |
| `95b4b98` | 按鈕接線 + 狀態提示 + 版本標記（**目前穩定線**） |

---

## 六、部署與 SQL（營運勾選）

1. Supabase：`docs/add-vendor-asset-gallery-images.sql`（若尚未執行）。
2. `git push origin main` 後 Cloud Shell 部署（見 `.cursor/rules/deployment.mdc`）。
3. 冒煙：編輯原型 → 新增角度圖 → 見綠色「已加入，目前共 N 張圖」；公開廠商頁素材庫張數一致。

---

## 七、相關文件

| 文件 | 內容 |
|------|------|
| `docs/add-vendor-asset-gallery-images.sql` | DB migration |
| `docs/vendor-asset-prototype-moq-customization-notes.md` | MOQ／訂製程度 + **§多角度圖** |
| `docs/matchdo-todo.md` | 總進度「近期完成」 |
| `docs/user-manual.md` §8.3 | 廠商操作說明 |
| `docs/網站完整功能說明.md` | 全站功能表 |

---

（若再改編輯區 HTML，請同 PR 更新 `bindEditGalleryUpload` 與本檔 §三。）
