# 廠商版型 Tab × 產品關聯樹 — 工作進度交接（2026-06-03，guide UI 2026-06-04，帶入生圖 2026-06-18）

> 給新對話視窗用：延續「客製產品設計頁內廠商版型訂製 + 產品關聯樹」功能，**不要另開平行 API／分類來源**。  
> **FLUX 生圖／四槽／材料色款／圖樣套用** 見 **`docs/PROGRESS-custom-product-generate-flux.md`**（2026-06-18 驗收通過）。

---

## 產品目標（已定案）

1. **不要獨立「選廠商」流程**；廠商版型放在 `custom-product.html` 的 Tab「廠商版型」。
2. **分類**：與「產品設計」Tab 共用 `imageCategoryMainSelect` / `imageCategorySubSelect` + `CustomProductCatPicker`（`/api/custom-product-categories`）。**禁止**整站 `/api/categories`。
3. **廠商版型列表**：`GET /api/vendor-assets?…&asset_kind=prototype&has_prototype_links=1` — **只列出**已在 `vendor_asset_prototype_links` 設定至少一筆材料／配件關聯的款式（未設定關聯的不出現在此 Tab）。
4. **廠商名稱**：與控制台相同欄位 `manufacturers.name`；列表經 `buildManufacturerMapForVendorAssetList`；前端可再以 `GET /api/manufacturers/:id` 補名。篩選建議用 `GET /api/manufacturers?category_key&subcategory_key&q=…`。
5. **看可搭配**（`product-tree.html`）：`GET /api/vendor-assets/:id/link-tree` — **只顯示**該主產品已關聯的材料／配件（非分類下全部素材）。
6. **產品設計 → 素材庫**（材料／配件）：仍顯示同分類全部素材，已關聯者排前並標「廠商推薦」；可選 `prototype_linked_only=1` + `for_prototype_asset_id` 僅回傳關聯項。
7. **選款式後**：`product-tree.html?prototype_asset_id=…&return_to=…` → 帶回產品設計 Tab（`matchdo.guidePrototypeRefs` 多角度、`matchdo.guideLinkedAssetRefs` 材／配含色款 URL；舊 key `guideLinkedAssetIds` 仍相容）。
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
| `2fded54`～`472a025` | guide 關聯樹互動、多展開、標題位置等迭代 |
| `5ca8f98` | guide：Apple 風橫向選單列（初版） |
| `23f1637` | guide：主產品／每配件／每材料各一橫條；色款全顯示 |
| `38bdf0a` | guide：已選狀態可見；版心 `container`（非全頁 fluid） |
| `94d2c81` | guide：圖格 🔍 放大（燈箱），不影響選取 |
| （廠商後台同批） | `pick_group`／`allow_multi_pick`、設計洞察 API、素材庫關聯編輯強化 |
| `534ca65`～`9339a5e` | guide 多選角度、設計頁匯入、FLUX 材料色款／圖樣角色句（詳 **`PROGRESS-custom-product-generate-flux.md`**） |

**目前前端版本（看可搭配）：** `vendor-product-link-tree.css/js?v=60`（`product-tree.html`）

**目前前端版本（客製 Tab）：** `custom-product.js?v=77`（含 guide 匯入、四槽生圖、AI 免責文案、廠商 logo；廠商版型 Tab 分類 Bottom Sheet、`browse-styles.css?v=2`）

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

product-tree.html（guide，2026-06-04 現況）
  → GET /api/vendor-assets/:id/link-tree
  → 版面：container 版心 + 左主欄「搭配摘要」
  → 主產品／每個配件／每個材料：各一區塊標題（分類 · 商品名）+ 橫向圖列
  → 多圖（色款／角度）：每圖一格；標籤「色款 N」「角度 N」（不用檔名當 caption）
  → 選取：點圖格選色／加入已選；配件／材料顯示「已選」綠框
  → 主產品：可多選角度 → matchdo.guidePrototypeRefs（2026-06）；預覽中與已選分開
  → 橫向捲動：隱藏捲軸條 + 左右 ‹ › 箭頭（浮在列上，不推擠左緣）
  → 右上角 🔍：燈箱瀏覽該品所有圖（stopPropagation，不觸發選取）
  → sessionStorage：matchdo.guidePrototypeRefs、guideLinkedAssetRefs、guideVariantByAssetId

/browse-styles.html → redirect ?tab=vendor-styles

廠商後台設定關聯：
  manufacturer-materials.html → 產品關聯圖（vendor 模式，卡片樹編輯）
  → 關聯編輯：allow_multi_pick、pick_group（擇一組）
  → vendor-prototype-insights.html → 訂製者用圖統計（需 link 資料）
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
| `docs/add-vendor-asset-prototype-link-pick-group.sql` | `allow_multi_pick`、`pick_group`（**部署前必跑**） |
| `docs/vendor-asset-prototype-links.md` | 關聯語意與 API 說明 |
| `docs/PROGRESS-custom-product-generate-flux.md` | 設計頁 FLUX 生圖、四槽、guide 匯入、2026-06-18 驗收狀態 |
| `public/css/vendor-product-link-tree.css` | guide 橫條樣式、箭頭、已選態 |
| `public/client/vendor-prototype-insights.html` | 廠商：訂製洞察 |

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
- `docs/add-vendor-asset-prototype-link-pick-group.sql` → 欄位 `allow_multi_pick`、`pick_group`（看可搭配「擇一組」用）

---

## 看可搭配頁（guide）— 2026-06-04 定案行為

與原 `vendor-product-link-tree-ui-plan.md` 的「中央卡片樹」不同，**訂製者端已改為橫向選單列**（類 Apple Mac 產品列），廠商編輯頁仍為 vendor 卡片樹。

| 項目 | 行為 |
|------|------|
| 資料來源 | 僅 `link-tree` 回傳之 `linked_assets`（非整分類素材庫） |
| 區塊 | **主產品** 一列；**每個配件** 一列；**每個材料** 一列 |
| 標題 | `主產品 · 角粒殼3.0`、`配件 · …`、`材料 · …` |
| 多圖 | 全部並排；不隱藏 `+N`；不併成單格小圓點 |
| 選取規則 | `enforceGuideSelectionRules`：`pick_group` 同組互斥 |
| 帶回設計 | `buildStartDesignUrl` + `guidePrototypeRefs`（角度）+ `guideLinkedAssetRefs`（材／配含 `variant_url`）→ 設計頁 `applyGuideSessionBundle` |

**勿再犯（guide UI）：**

- 不要用 `100vw` 把整頁推到螢幕最左（僅主內容欄全寬即可）。
- 不要用 flex 內嵌箭頭佔寬導致與主產品列左緣不對齊（箭頭改 `absolute` 浮層）。
- 不要在 `applyGuideVariantChoice` 後對 `querySelector` 第一格硬加 `已選`（會雙重高亮）。
- 不要用檔名／UUID 當圖下標籤（用色款名或「角度 N／色款 N」）。

---

## 部署（唯一正確方式）

在 **Google Cloud Shell**（本機無 gcloud）：

```bash
cd ~/matchdo && git fetch origin main && git reset --hard origin/main && gcloud run deploy matchdo --source . --region=asia-northeast1 --allow-unauthenticated --clear-base-image && gcloud run services update-traffic matchdo --region=asia-northeast1 --to-latest
```

---

## 上線後驗收清單

- [x] `?tab=vendor-styles`：只顯示已設「主產品↔材／配」關聯的款式（2026-06-03 已確認）
- [x] 分類摘要為中文（`custom-product-categories` + cat-picker）
- [x] 卡片廠商名稱為真實名稱（非整排「廠商」）
- [x] 「看可搭配」僅顯示該款已關聯材／配（API 不變；UI 2026-06-04 驗收）
- [x] guide：主產品／配件／材料分區橫條、色款全顯示、標題「分類 · 名稱」
- [x] guide：已選／預覽中狀態可辨、🔍 放大不誤觸選取
- [x] 回產品設計帶原型角度 + guide 選取之材／配 refs（2026-06-18 驗收；生圖品質見 `PROGRESS-custom-product-generate-flux.md`）
- [ ] `/browse-styles.html` redirect 到 `?tab=vendor-styles`
- [ ] Supabase 已執行 `add-vendor-asset-prototype-link-pick-group.sql`（線上 pick_group 才會生效）

---

## 待辦（Phase C，未做）

- [ ] **產品關聯鏈匯出 PDF**（無網站 UI）— 見 **`docs/product-link-chain-export-plan.md`**
- [ ] 分享 URL、手機版 guide 體驗優化
- [x] 多選材料／配件帶入 refs（`guideLinkedAssetRefs` + 設計頁參考槽）
- [x] **廠商設定擇一組** UI + API（`pick_group`／`allow_multi_pick`；SQL 見上）
- [x] 廠商設計洞察頁（`GET …/design-insights`、控制台入口）
- [ ] guide 與原規劃「卡片樹」文件對齊說明（`vendor-product-link-tree-ui-plan.md` 仍寫樹狀—實作為橫條）
- [ ] 可選：精簡 `GET /api/vendor-assets/browse-prototypes` 避免 API 分叉
- [ ] 更新 `docs/網站完整功能說明.md`
- [ ] `#bs-open-vendor-picker` 一鍵開素材庫（若產品要此按鈕）
- [ ] Phase 2 SEO：`sitemap-product-trees.xml`（見 `vendor-product-link-tree-ui-plan.md` §8）

---

## 相關對話

Cursor agent transcripts：

- `c34f087d-a5f6-4a90-95ce-7d670795ff87` — Phase 1～廠商版型 Tab 初版
- 2026-06-03 對話 — 廠商名稱、分類中文、`has_prototype_links` 列表過濾
- `04206a2e-bd2d-44ec-a58e-68cec9616193` — guide 橫條 UI、選取態、放大、對齊與捲動箭頭（2026-06-04）

新對話可說：「請讀 `docs/PROGRESS-vendor-styles-and-product-tree.md` 繼續。」
