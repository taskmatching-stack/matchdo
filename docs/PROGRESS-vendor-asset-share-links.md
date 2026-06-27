# 廠商素材卡片 — 可分享深連結 — 規劃（2026-06-26）

> 給新對話視窗用：讓**沒有自家模擬系統的廠商**，能在官網／LINE／型錄貼「這一款直接試做」連結。  
> 關聯導覽與 deep link 基礎見 **`docs/PROGRESS-vendor-styles-and-product-tree.md`**、**`docs/vendor-product-link-tree-ui-plan.md` §8**。

---

## 產品目標（已定案）

1. **每張數位原型**（`asset_kind=prototype`）應有穩定、可複製的 **HTTPS 深連結**，訪客點進來即可進入 Matchdo 模擬／設計流程。
2. **主要使用者在廠商後台**（`manufacturer-materials.html`）：上傳／管理素材時就能「複製連結」，不必去公開廠商頁找同一張卡。
3. **對外頁面已有入口**（公開廠商頁、設計頁廠商版型 Tab）維持現狀；本項補**後台缺口的複製 UI**，不重做對外卡片版面。
4. 連結只對 **`is_public=true` 且廠商 active** 的素材有意義；下架時訪客應看到既有 404／未公開提示（不新增平行權限模型）。

### 與 iframe 試做（②）的關係（2026-06-27）

| | ① 本文件試做／導覽連結 | ② iframe（[`PROGRESS-vendor-embed-simulator.md`](PROGRESS-vendor-embed-simulator.md)） |
|---|---|---|
| 入口 | `custom-product.html` / `product-tree.html` | `/embed/simulator.html` 嵌在廠商頁 |
| 訪客付點 | **是**（登入後扣訪客 Matchdo 點數） | **否**（廠商 embed 方案／點數） |
| 可試款式 | 主站流程（可換款等） | **僅**綁定的一款主產品 |

兩者並存；素材後台「分享與嵌入」區塊已分開文案。

---

## 現況盤點

### 已有（URL 與對外 UI）

| 位置 | 行為 |
|------|------|
| `public/vendor-profile.html` | `buildVendorAssetDesignUrl()`、`buildVendorAssetGuideUrl()`；卡片按鈕「用此款進行設計」「看可搭配」 |
| `public/js/custom-product.js` | `buildVendorStyleDesignUrl()`；廠商版型 Tab 同邏輯 |
| `server.js` `GET /api/vendor-assets/browse-prototypes` | 列表含 `match_guide_url` |
| `public/js/custom-product.js` | 讀 `prototype_asset_id`、`vendor_asset_id` 等 query → 自動帶入參考／分類 |

### 缺少（本項要補）

| 位置 | 缺口 |
|------|------|
| `public/client/manufacturer-materials.html` | 素材卡片僅編輯／刪除／上下架／洞察；**無複製連結** |
| `public/client/manufacturer-dashboard.html` | 僅複製**整站廠商頁** URL，**非單款** |
| 共用 helper | `buildVendorAssetDesignUrl` 邏輯分散在 `vendor-profile.html` 與 `custom-product.js`，後台尚未共用 |

---

## URL 規格（canonical，勿分叉）

基底網域：`process.env.BASE_URL` 或前端 `window.location.origin`（正式環境 `https://matchdo.cc`）。

### 1. 快速試做（設計頁，鎖定原型）

```text
/custom-product.html?tab=product-design&prototype_asset_id={vendor_assets.id}
```

選填（與公開頁一致，利於分類預選）：

- `&manufacturer_id={uuid}`
- `&category_key={key}`
- `&subcategory_key={key}`

**不帶** `return_to`（對外分享 canonical 應簡短；`return_to` 僅 guide 內部導回用）。

### 2. 可搭配導覽（有材／配關聯時）

```text
/product-tree.html?prototype_asset_id={vendor_assets.id}
```

- 僅當 `link_count > 0`（或 `material_count + part_count > 0`）時對廠商顯示此連結。
- 與 API `match_guide_url` 相同路徑；**不含** `return_to` 於分享用複製文案。

### 3. 材料／配件（次要，Phase 2 可選）

```text
/custom-product.html?tab=product-design&vendor_asset_id={vendor_assets.id}
```

- 鎖定單張材料／配件進參考槽；**無** prototype 鎖定時使用。
- 官網主推仍以 **prototype 試做連結** 為主。

### SEO／索引

- `product-tree.html?prototype_asset_id=` — 可 index（見 `docs/SEO-PROGRESS.md`）。
- `custom-product.html` — 工作區 `noindex`；**作深連結 OK**，不作 sitemap 條目。

---

## 實作規劃

### Phase 1 — 廠商素材庫卡片「複製連結」（P0，最小可上線）

**檔案：** `public/client/manufacturer-materials.html`（必要時 bump `__MATCHDO_MATERIALS_BUILD`）

**UI（僅 `asset_kind=prototype`，非 seed 鎖定帳號）：**

- 卡片操作列新增 **「連結 ▼」** 小按鈕（或 link 圖示），dropdown：
  - **複製試做連結** → URL §1（必顯示）
  - **複製搭配導覽連結** → URL §2（僅 `link_count > 0` 時顯示；列表若無 `link_count` 則 Phase 1 可只顯示試做連結，或打 lightweight count API）
- 複製成功：toast／短文案「已複製」（對齊 `manufacturer-dashboard` `#copy-profile-url-msg` 模式）。
- **已下架**（`is_public=false`）：按鈕 disabled + tooltip「請先上架後再分享」。

**JS helper（Phase 1 可 inline 於 materials 頁，與 `vendor-profile.html` 對齊）：**

```javascript
function buildShareDesignUrl(item) {
  var base = window.location.origin;
  var url = base + '/custom-product.html?tab=product-design&prototype_asset_id=' + encodeURIComponent(item.id);
  if (item.manufacturer_id) url += '&manufacturer_id=' + encodeURIComponent(item.manufacturer_id);
  if (item.category_key) url += '&category_key=' + encodeURIComponent(item.category_key);
  if (item.subcategory_key) url += '&subcategory_key=' + encodeURIComponent(item.subcategory_key);
  return url;
}
function buildShareGuideUrl(item) {
  return window.location.origin + '/product-tree.html?prototype_asset_id=' + encodeURIComponent(item.id);
}
```

**資料：** 公開 `GET /api/vendor-assets` 已含 `link_count`、`match_guide_url`；**`GET /api/me/vendor-assets`（廠商後台列表）目前沒有** — Phase 1 需二擇一：

- **1A（推薦）** 在 `server.js` `GET /api/me/vendor-assets` 對 `prototype` 批次補 `link_count` / `match_guide_url`（複用 `batchPrototypeLinkCounts`，與公開列表一致）；導覽連結才有依據。  
- **1B** Phase 1 只做「複製試做連結」，導覽連結延到 1A 完成後再加。

**驗收：**

1. 廠商後台 → 數位原型卡片 → 複製試做連結 → 無痕開啟 → 設計頁已鎖該原型。
2. 下架狀態無法複製（或複製但訪客 404 — 以 disabled 為準）。
3. seed 鎖定帳號行為不變（不顯示或維持唯讀）。

---

### Phase 2 — 共用 helper + API 欄位（P1，減少三處重複）

| 項目 | 說明 |
|------|------|
| 新檔 `public/js/vendor-asset-share-urls.js` | `buildShareDesignUrl(item)`、`buildShareGuideUrl(item)`、`buildShareMaterialUrl(item)` |
| 改引用 | `vendor-profile.html`、`custom-product.js`（browse 卡）、`manufacturer-materials.html` |
| API | `GET /api/me/vendor-assets`、`GET /api/vendor-assets` 列表項增加可選欄位：`design_share_url`、`guide_share_url`（absolute URL，server 用 `BASE_URL` 組） — **方便日後 QR、Email、第三方整合** |

**注意：** 前端仍以 helper 為主即可；API 欄位為便利非必須。

---

### Phase 3 — 廠商控制台與說明（P2）

| 項目 | 說明 |
|------|------|
| `manufacturer-dashboard.html` | 「我的廠商首頁」區塊下加一句：「單款試做連結請至素材庫各原型卡片複製」 |
| `docs/user-manual.md` | 廠商章節：如何貼在官網／LINE |
| 可選 | 編輯 modal 內顯示該款試做 URL（只讀 + 複製），避免回列表找卡片 |

---

## 關鍵檔案

| 檔案 | Phase |
|------|-------|
| `public/client/manufacturer-materials.html` | 1 |
| `public/vendor-profile.html` | 2（改共用 helper） |
| `public/js/custom-product.js` | 2 |
| `public/js/vendor-asset-share-urls.js` | 2（新建） |
| `server.js`（列表 enrich `link_count` / share URL） | 1A 或 2 |
| `docs/user-manual.md` | 3 |

---

## 已排除的錯誤做法（勿再犯）

- ❌ 為每款新建獨立 HTML 頁或 sitemap 條目（工作區 `custom-product` 保持 noindex）。
- ❌ 分享連結帶 `return_to`（canonical 應短、穩定）。
- ❌ 只有廠商頁能進試做、後台仍無複製（本項要解的就是這個）。
- ❌ 材料／配件用 `prototype_asset_id` 冒充（應用 `vendor_asset_id` 或只做 prototype 試做）。

---

## 待做 checklist

- [x] **P0** `manufacturer-materials.html` 原型卡「複製試做連結」
- [x] **P0** 上架狀態 gating + 複製成功提示
- [x] **P0** 列表含 `link_count` → 「複製搭配導覽連結」（有關聯才顯示）— `GET /api/me/vendor-assets`
- [x] **P1** 抽出 `vendor-asset-share-urls.js`；`vendor-profile`、`custom-product`、`manufacturer-materials` 已引用
- [x] **P1** API `design_share_url` / `guide_share_url`（`GET /api/me/vendor-assets`、`GET /api/vendor-assets`）
- [x] **P2** 使用者手冊 §8.3 + 控制台說明一句
- [x] **P2** 編輯 modal 內試做／導覽 URL（只讀 + 複製）

---

## 部署

功能為前端為主；Phase 1 若僅改 `manufacturer-materials.html`：**commit + push 後 Cloud Run 部署即可**。  
若 Phase 1A 改 `server.js` 補 `link_count`：同次部署，無需新 SQL。
