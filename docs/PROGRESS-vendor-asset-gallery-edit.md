# 進度紀錄：廠商素材多角度圖（新增／編輯）

> **新對話：** 先讀 **`docs/session-handoff-2026-06-03.md`**（單一入口），再讀本檔。若還要改 guide／廠商版型 Tab，另讀 `docs/PROGRESS-vendor-styles-and-product-tree.md`。

**最後更新：** 2026-06-05  
**狀態：** ✅ 逐張 AI 重繪**追加新圖**（原圖保留）+ 預覽重繪不重複收上傳費；部署後確認 `__MATCHDO_MATERIALS_BUILD=redraw-append-new-image-20260605`  
**頁面：** [`/client/manufacturer-materials.html`](https://matchdo.cc/client/manufacturer-materials.html)（僅 `public/client/`，勿改根目錄同名檔）

**一句話：** 主產品／配件 = 多圖 + **AI 重繪**（雙按鈕分流）；材料 = 材質圖 AI 優化；展示底色只是重繪附帶參數。

---

## 〇、新對話快速索引

| 要看什麼 | 章節 |
|----------|------|
| 功能已完成什麼 | §二 |
| 改 HTML／JS 別弄壞 | §三 |
| 曾壞過什麼 | §四 |
| git／部署／禁忌 | §五 |
| **驗收 checkbox** | **§七** |
| **待辦 T1～T6** | **§八** |
| 全站入口＋P0 | `docs/session-handoff-2026-06-03.md` §3 |

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

### 新增素材（表單上方，prototype／part）

- 可「新增圖片」逐張或「一次選多張」加入待傳清單（`pending-image-card`）。
- 第一張為封面；各卡 **「AI 重繪」** 預覽後在卡下方顯示**重繪新圖**縮圖（原圖仍為主圖，非並排大欄）。
- 發布：產生 AI 新圖後**預設只上傳新圖**（不勾原圖）；勾「上傳原圖」與「上傳此張」互斥。**名稱維持使用者自訂**（不強加 `（重繪）`／`（放大）`）；衍生圖以 `gallery_images[].ai_derived`（`redraw`｜`upscale`）標記；預覽已扣點則發布不再重扣重繪費。
- 扣點：封面重繪補差額、角度圖 `points_optimize_extra`（見 `computeGalleryImageRedrawPoints`）。
- 送出：`POST /api/me/vendor-assets`（`image` + `gallery[]` + `image_labels`）。

### 新增素材（material）

- 單圖；**材質圖 AI 優化**（非產品 AI 重繪）；維持單一「上傳並發布」。

### 編輯素材（Modal）

- **Modal 實例**：全頁只建立一次 `bootstrap.Modal`（CDN 5.0 無 `getOrCreateInstance`）；儲存後只 `populateEditModal` 不重建，關閉時清殘留 `.modal-backdrop`。
- **產品圖片（多角度）**：縮圖格、封面標籤、非封面可刪除。
- **新增角度圖**／**一次選多張** → 待傳清單逐張勾 **AI 重繪** →「僅上傳所選」／「上傳並重繪勾選」→ `POST .../gallery-images`（可加 `optimize_image_indices`）。
- 狀態列：`#edit-gallery-status`（上傳中／成功／錯誤）。
- **更換封面**：下方「更換封面」+ 儲存時 `PUT` 單圖（與多角度 API 分開）。
- **AI 重繪（逐張）**：縮圖「AI 重繪」→ `POST .../gallery-images/redraw`（`replace: false`）**追加**一張新圖（`ai_derived` + `source_url`；編輯 UI **與待傳清單相同**：新圖縮圖在同格下方，不另開一格）。舊資料無 `source_url` 時前端會依名稱嘗試併格。

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
#btn-edit-pick-gallery-one / -multi
  → #edit-add-gallery-input-one | -multi
  → onEditGalleryFilesSelected() → appendFilesToEditGalleryPending()
  → #btn-edit-upload-pending-only | -redraw → uploadEditGalleryFiles(files, optIdx?)
  → POST .../gallery-images
  → renderEditGallery() + setEditGalleryStatus()

各圖「AI 重繪」→ redrawGalleryImage() → POST .../gallery-images/redraw（replace: false，追加新圖）
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
| `95b4b98` | 按鈕接線 + 狀態提示 + 版本標記 |
| `e718384` | 主產品／配件：上傳與 AI 重繪按鈕分流；編輯區單張重繪 |
| `02a834b` | 恢復新增表單 AI 重繪勾選 + 上傳／重繪雙按鈕 |
| *本 push* | **逐張重繪追加新圖**（非取代）；`preview-image-redraw` + `replace: false`；`redraw-append-new-image-20260605` |

**部署紀錄（2026-06-03）：** Cloud Shell 曾部署到 `e718384`（revision `matchdo-00344-n8b`），比 `02a834b` 舊一版（缺少 AI 重繪勾選還原）。請再部署以對齊 git。

**維護禁忌（2026-06-03 使用者驗收）：**

- **核心功能是 AI 重繪**（prototype／part）；material 是材質圖 AI 優化。勿為改文案或「釐清底色」而拆掉勾選、雙按鈕、`gallery-images/redraw` 或上傳分流邏輯。
- 展示底色只是重繪時的局部參數（`optimize_background`），**不要把它當成獨立功能來重構頁面**。

---

## 六、部署與 SQL（營運勾選）

1. Supabase：`docs/add-vendor-asset-gallery-images.sql`（若尚未執行）。
2. `git push origin main` 後 Cloud Shell 部署（見 `.cursor/rules/deployment.mdc`）。
3. 冒煙：見下方 **§七 驗收清單**。

---

## 七、上線後驗收清單

- [ ] Cloud Run 已部署 **`02a834b` 或更新**（若 log 停在 `e718384` 則 AI 重繪勾選未還原）
- [ ] 主產品／配件新增：多圖待傳清單、逐張勾 **AI 重繪**、「僅上傳並發布」／「AI 重繪並發布」雙按鈕可用
- [ ] 主產品／配件新增：勾選重繪後可送出且扣點正確；未勾選走「僅上傳」不誤扣重繪點
- [ ] 材料新增：單圖上傳；材質圖 AI 優化（非產品重繪）
- [ ] 編輯 Modal：新增角度圖選檔即上傳；各圖「AI 重繪」追加結果、原圖保留
- [ ] 公開廠商頁素材庫：多角度張數與後台一致

---

## 八、待辦清單（未做／可選）

| # | 項目 | 優先 | 備註 |
|---|------|------|------|
| T1 | **push + 再部署** `02a834b` | P0 | 線上若仍 `e718384`（`matchdo-00344-n8b`）必做 |
| T2 | push 本進度檔更新 | P0 | 與 `PROGRESS-vendor-styles-and-product-tree.md` 同步 |
| T3 | `user-manual.md` §8.3 補「僅上傳／AI 重繪並發布」雙按鈕 | P2 | 使用者操作說明 |
| T4 | `網站完整功能說明.md` 素材上傳段落對齊 | P2 | 與本檔 §二 一致 |
| T5 | 移除 `__MATCHDO_MATERIALS_BUILD`／`edit-gallery-build-hint` | P3 | 穩定後除錯用可清 |
| T6 | 清理 `getOptimizeBackgroundValue` 內無 DOM 的 `edit-pending-optimize-bg` | P3 | 不影響功能 |

**勿做（除非另開需求）：**

- [ ] ~~把展示底色當獨立功能重構頁面~~
- [ ] ~~為改文案拆掉 AI 重繪勾選、雙按鈕或 `gallery-images/redraw` 流程~~

---

## 九、相關文件

| 文件 | 內容 |
|------|------|
| `docs/add-vendor-asset-gallery-images.sql` | DB migration |
| `docs/vendor-asset-prototype-moq-customization-notes.md` | MOQ／訂製程度 + **§多角度圖** |
| `docs/session-handoff-2026-06-03.md` | **新對話單一入口**（部署、P0、語意、檔案表） |
| `docs/PROGRESS-vendor-styles-and-product-tree.md` | 同後台之關聯樹／guide（與本檔並讀） |
| `docs/matchdo-todo.md` | 全站總表「近期完成」 |
| `docs/user-manual.md` §8.3 | 廠商操作說明 |
| `docs/網站完整功能說明.md` | 全站功能表 |

---

（若再改編輯區 HTML，請同 PR 更新 `bindEditGalleryUpload` 與本檔 §三、§八。）
