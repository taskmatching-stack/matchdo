# 廠商版型 Tab × 產品關聯樹 — 工作進度交接（2026-06-01）

> 給新對話視窗用：延續「客製產品設計頁內廠商版型訂製 + 產品關聯樹」功能，**不要另開平行 API／分類來源**。

---

## 產品目標（已定案）

1. **不要獨立「選廠商」流程**；廠商版型放在 `custom-product.html` 的 Tab「廠商版型」。
2. **分類**：與「產品設計」Tab 共用 `imageCategoryMainSelect` / `imageCategorySubSelect` + `CustomProductCatPicker`（`/api/custom-product-categories`）。**禁止**整站 `/api/categories`。
3. **列表 API**：與素材庫相同 → `GET /api/vendor-assets?category_key&subcategory_key&asset_kind=prototype`（Bearer 與 `loadVendorAssetsPickerList` 一致）。
4. **廠商名稱篩選**：與素材庫相同 → 輸入框 + `GET /api/manufacturers?category_key&subcategory_key&q=…` 建議。**禁止**用 `vendor-assets` 回傳的 `manufacturers[]` 填下拉（缺名時伺服器會填字面「廠商」）。
5. **選款式後**：`product-tree.html?prototype_asset_id=…&return_to=…` → 看可搭配材料／配件 → 帶回產品設計 Tab 生圖（`prototype_asset_id`、sessionStorage 等既有 guide 邏輯）。
6. **數位原型子分類**：上傳／篩選仍必填（與產品設計一致）。

---

## 已推送到 `origin/main` 的 commit

| Commit | 說明 |
|--------|------|
| `9b1e6f1` | Phase 1：產品關聯樹 UI + API（`vendor_asset_prototype_links`） |
| `970af72` | 數位原型子分類必填；設計分類與 link tree 入口修正 |
| `016cb0d` | browse 流程、`browse-prototypes`、product-tree guide、deep link |
| `0e06dc7` | 設計頁 Tab「廠商版型」、`custom-product-cat-picker`、導覽入口 |
| `e1688f9` | 廠商版型列表改打 `/api/vendor-assets`（不再依賴 browse-prototypes 查詢邏輯） |
| `980c35b` | 廠商版型 Tab 與素材庫共用 `buildVendorAssetsFetchUrl`；廠商名稱輸入 + `/api/manufacturers` 建議 |

---

## 最近提交（2026-06-03）

| Commit | 說明 |
|--------|------|
| `980c35b` | 廠商版型 Tab 與產品設計素材庫共用載入與廠商名稱篩選（`#bs-manufacturer-name` + `/api/manufacturers`；`syncVendorStylesTabFiltersToPicker` → `buildVendorAssetsFetchUrl`） |

---

## 架構（目標狀態）

```text
custom-product.html
  Tab「產品設計」— 原有：cat-tablet、提示詞、參考槽、素材庫 modal（#vendorAssetsPickerModal）
  Tab「廠商版型」— #panel-vendor-styles
                 — 共用 imageCategoryMainSelect / SubSelect
                 — loadVendorStylesTabList() → buildVendorAssetsFetchUrl + fetch /api/vendor-assets
                 — 廠商篩選：#bs-manufacturer-name + #bs-manufacturer-id + /api/manufacturers 建議
                 — 卡片 → product-tree.html → 回 Tab 產品設計
  Tab 實境模擬 / 圖樣提取 — 不變

/browse-styles.html → redirect 到 /custom-product.html?tab=vendor-styles

導覽入口範例：
  客製產品 → 廠商版型訂製 → /custom-product.html?tab=vendor-styles
  廠商檔案 → ?tab=vendor-styles&manufacturer_id=…&vendor_name=…
```

---

## 關鍵檔案

| 檔案 | 用途 |
|------|------|
| `public/custom-product.html` | Tab `panel-vendor-styles`、篩選 UI |
| `public/js/custom-product.js` | `loadVendorStylesTabList`、`openVendorPickerForRefSlot`、`buildVendorAssetsFetchUrl`、`loadVendorAssetsPickerList` |
| `public/js/browse-styles.js` | 薄包裝；`VendorStyleBrowse.loadItems` → `loadVendorStylesTabList` |
| `public/js/custom-product-cat-picker.js` | `/api/custom-product-categories`、雙欄 cat-tablet、`matchdo:categoryChanged` |
| `public/js/vendor-product-link-tree.js` | `product-tree.html` guide、return_to、sessionStorage |
| `public/product-tree.html` | 關聯樹／可搭配導覽頁 |
| `server.js` | `GET /api/vendor-assets`、`GET /api/vendor-assets/:id/link-tree`、`browse-prototypes`（仍存在，列表應以 vendor-assets 為準） |
| `docs/add-vendor-asset-prototype-links.sql` | 關聯表 migration |

---

## 已排除的錯誤做法（勿再犯）

- 用整站 `/api/categories` 做下拉（會出現 APP 開發等無關項目）。
- 在設計頁角落加「產品樹」連結（已移除 `#btn-open-product-tree`）。
- 獨立 `browse-prototypes` 或 `data.manufacturers` 當廠商名稱來源（會整排顯示「廠商」）。
- 從 `is_public`、分類不一致等旁路「猜」列表空白；**對照產品設計 Tab 開素材庫同分類是否看得到**即可。

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

1. `custom-product.html?tab=vendor-styles`，先於產品設計 Tab 選好主／子分類。
2. 廠商版型列表與素材庫（同分類、`asset_kind=prototype`）筆數／廠商名稱一致。
3. 廠商名稱輸入建議來自 `/api/manufacturers`，非全顯示「廠商」。
4. 點卡片「看可搭配」→ `product-tree.html` → 選材料／配件 → 回產品設計帶 `prototype_asset_id`。
5. `/browse-styles.html` 應 redirect 到 `?tab=vendor-styles`。

---

## 待辦（Phase C 與優化，未做）

- [ ] 分享 URL、手機版體驗
- [ ] 多選材料／配件一次帶入 refs
- [ ] 可選：刪除或讓 `GET /api/vendor-assets/browse-prototypes` 僅 thin wrapper，避免 API 分叉
- [ ] 更新 `docs/網站完整功能說明.md` 若需對外說明此 Tab
- [ ] Tab 上「開啟素材庫」按鈕（`#bs-open-vendor-picker`）若產品要一鍵開 modal，需在 HTML 補按鈕並接 `openVendorPickerForRefSlot('prototype')`

---

## 相關對話

Cursor agent transcript（完整脈絡）：  
`agent-transcripts/c34f087d-a5f6-4a90-95ce-7d670795ff87/c34f087d-a5f6-4a90-95ce-7d670795ff87.jsonl`

新對話可說：「請讀 `docs/PROGRESS-vendor-styles-and-product-tree.md` 繼續。」
