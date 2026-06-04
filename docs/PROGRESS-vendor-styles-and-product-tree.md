# 廠商版型 Tab × 產品關聯樹 — 工作進度交接（2026-06-03）

> 給新對話視窗用：延續「客製產品設計頁內廠商版型訂製 + 產品關聯樹」功能，**不要另開平行 API／分類來源**。

---

## 產品目標（已定案）

1. **不要獨立「選廠商」流程**；廠商版型放在 `custom-product.html` 的 Tab「廠商版型」。
2. **分類**：與「產品設計」Tab 共用 `imageCategoryMainSelect` / `imageCategorySubSelect` + `CustomProductCatPicker`（`/api/custom-product-categories`）。**禁止**整站 `/api/categories`。
3. **廠商版型列表**：`GET /api/vendor-assets?…&asset_kind=prototype&has_prototype_links=1` — **只列出**已在 `vendor_asset_prototype_links` 設定至少一筆材料／配件關聯的款式（未設定關聯的不出現在此 Tab）。
4. **廠商名稱**：與控制台相同欄位 `manufacturers.name`；列表經 `buildManufacturerMapForVendorAssetList`；前端可再以 `GET /api/manufacturers/:id` 補名。篩選建議用 `GET /api/manufacturers?category_key&subcategory_key&q=…`。
5. **看可搭配**（`product-tree.html`）：`GET /api/vendor-assets/:id/link-tree` — **只顯示**該主產品已關聯的材料／配件（非分類下全部素材）。
6. **產品設計 → 素材庫**（材料／配件）：仍顯示同分類全部素材，已關聯者排前並標「廠商推薦」；可選 `prototype_linked_only=1` + `for_prototype_asset_id` 僅回傳關聯項。
7. **選款式後**：`product-tree.html?prototype_asset_id=…&return_to=…` → 帶回產品設計 Tab（`prototype_asset_id`、`matchdo.guideLinkedAssetIds` 等）。
8. **數位原型子分類**：上傳／篩選仍必填（與產品設計一致）。

---

## 已推送到 `origin/main` 的 commit

| Commit | 說明 |
|--------|------|
| `9b1e6f1` | Phase 1：產品關聯樹 UI + API（`vendor_asset_prototype_links`） |
| `970af72` | 數位原型子分類必填；設計分類與 link tree 入口修正 |
| `016cb0d` | browse 流程、`browse-prototypes`、product-tree guide、deep link |
| `0e06dc7` | 設計頁 Tab「廠商版型」、`custom-product-cat-picker`、導覽入口 |
| `e1688f9` | 廠商版型列表改打 `/api/vendor-assets` |
| `980c35b` | 廠商版型 Tab 與素材庫共用 `buildVendorAssetsFetchUrl`；廠商名稱輸入 + `/api/manufacturers` 建議 |
| `58cc0a4` | 進度文件初版 |
| `d9670cb` | 廠商名稱：`buildManufacturerMapForVendorAssetList`；分類摘要 `syncCategoriesDataFromPicker` |
| `980b0f8` | 廠商名稱補強（id/user_id 索引、auth metadata、`enrichVendorAssetItemsManufacturerNames`） |
| `8f91465` | 列表回傳 `link_count`；卡片顯示「可搭配 N 項」 |
| `7d5b134` | **廠商版型 Tab `has_prototype_links=1`** — 只列已設關聯的款式（2026-06-03 使用者驗收 OK） |

**目前前端版本：** `custom-product.js?v=60`（手機：廠商版型 Tab 分類 Bottom Sheet、`browse-styles.css?v=2`）

---

## 架構（現況）

```text
custom-product.html
  Tab「產品設計」— cat-tablet、提示詞、參考槽、素材庫 modal
  Tab「廠商版型」— #panel-vendor-styles
                 — 共用 imageCategoryMainSelect / SubSelect（中文名稱自 API）
                 — loadVendorStylesTabList()
                     → __vendorAssetsFetchParams.hasPrototypeLinks = true
                     → GET /api/vendor-assets?…&asset_kind=prototype&has_prototype_links=1
                 — 卡片：link_count 徽章 +「看可搭配」→ product-tree.html
  Tab 實境模擬 / 圖樣提取 — 不變

product-tree.html（guide）
  → GET /api/vendor-assets/:id/link-tree → 僅 linked_assets

/browse-styles.html → redirect ?tab=vendor-styles

廠商後台設定關聯：
  manufacturer-materials.html → 產品關聯圖 / PUT prototype-links
```

---

## API 查詢參數（勿分叉新端點）

| 參數 | 用途 |
|------|------|
| `has_prototype_links=1` | 廠商版型 Tab：只回傳至少一筆材／配關聯的 prototype |
| `for_prototype_asset_id` | 素材庫：標記 `is_linked_to_prototype`、關聯排前 |
| `prototype_linked_only=1` | 搭配 `for_prototype_asset_id`：素材庫只回傳已關聯項 |
| `asset_kind=prototype` | 數位原型列表 |

列表項目（prototype）可含：`link_count`、`material_count`、`part_count`、`match_guide_url`。

---

## 關鍵檔案

| 檔案 | 用途 |
|------|------|
| `public/custom-product.html` | Tab `panel-vendor-styles`、篩選 UI |
| `public/js/custom-product.js` | `loadVendorStylesTabList`、`buildVendorAssetsFetchUrl`、`buildManufacturerMap…`（server）、`enrichVendorAssetItemsManufacturerNames` |
| `public/js/browse-styles.js` | redirect + Tab `shown` → `loadVendorStylesTabList` |
| `public/js/custom-product-cat-picker.js` | 分類資料與 `matchdo:categoryChanged` |
| `public/js/vendor-product-link-tree.js` | `product-tree.html` guide |
| `public/product-tree.html` | 看可搭配頁 |
| `server.js` | `GET /api/vendor-assets`、`buildManufacturerMapForVendorAssetList`、`GET …/link-tree` |
| `docs/add-vendor-asset-prototype-links.sql` | 關聯表 |
| `docs/vendor-asset-prototype-links.md` | 關聯語意與 API 說明 |

---

## 已排除的錯誤做法（勿再犯）

- 用整站 `/api/categories` 做下拉。
- 廠商版型 Tab 列出**全部分類原型**再靠按鈕區分「尚未設定搭配」（應直接 `has_prototype_links=1` 過濾）。
- 把「看可搭配」頁做成顯示分類下全部材料／配件（應只顯示 `vendor_asset_prototype_links`）。
- 用 `vendor-assets` 回傳的占位 `manufacturers[]` 或字面「廠商」當顯示名（應對 `manufacturers.name`）。
- 在設計頁角落加「產品樹」連結（已移除 `#btn-open-product-tree`）。

---

## 資料庫

關聯樹需已執行：

- `docs/add-vendor-asset-prototype-links.sql` → 表 `vendor_asset_prototype_links`

---

## 部署（唯一正確方式）

在 **Google Cloud Shell**（本機無 gcloud）：

```bash
cd ~/matchdo && git fetch origin main && git reset --hard origin/main && gcloud run deploy matchdo --source . --region=asia-northeast1 --allow-unauthenticated --clear-base-image
```

---

## 上線後驗收清單

- [x] `?tab=vendor-styles`：只顯示已設「主產品↔材／配」關聯的款式（2026-06-03 已確認）
- [x] 分類摘要為中文（`custom-product-categories` + cat-picker）
- [x] 卡片廠商名稱為真實名稱（非整排「廠商」）
- [ ] 「看可搭配」頁僅顯示該款已關聯的材／配
- [ ] 回產品設計帶 `prototype_asset_id` 與 guide 選取之 refs
- [ ] `/browse-styles.html` redirect 到 `?tab=vendor-styles`

---

## 待辦（Phase C，未做）

- [ ] 分享 URL、手機版體驗
- [ ] 多選材料／配件一次帶入 refs（設計頁已支援多筆 `guideLinkedAssetRefs`；見下「擇一組」）
- [ ] **廠商設定擇一組**：`vendor_asset_prototype_links.pick_group`（同組訂製者只能選一個；留空＝可與其他並選）
- [ ] 可選：精簡 `GET /api/vendor-assets/browse-prototypes` 避免 API 分叉
- [ ] 更新 `docs/網站完整功能說明.md`
- [ ] `#bs-open-vendor-picker` 一鍵開素材庫（若產品要此按鈕）

---

## 相關對話

Cursor agent transcripts：

- `c34f087d-a5f6-4a90-95ce-7d670795ff87` — Phase 1～廠商版型 Tab 初版
- 2026-06-03 對話 — 廠商名稱、分類中文、`has_prototype_links` 列表過濾

新對話可說：「請讀 `docs/PROGRESS-vendor-styles-and-product-tree.md` 繼續。」
