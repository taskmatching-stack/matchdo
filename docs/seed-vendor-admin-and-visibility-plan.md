# 種子廠商：後台天數管理、內部預覽、素材上下架 — 實作規劃

> 建立：2026-05-26 · **實作狀態：已依本檔落地（2026-05-26）**  
> 相關頁面：[種子廠商管理](https://matchdo.cc/admin/seed-vendors.html)、[上傳數位版型](https://matchdo.cc/client/manufacturer-materials.html)  
> 現行手冊：`docs/種子廠商入駐操作手冊.md`  
> 現行程式：`server.js`（`vendor_source`、`expires_at`、`GET /api/vendor-assets` 種子過濾）

---

## 刪除 vs 下架（維持資料）

| 操作 | API／UI | 結果 |
|------|---------|------|
| **下架廠商** | 種子後台「下架」→ `is_active=false` | **資料全保留**（廠商列、作品、`vendor_assets`）；前台不顯示，可「重新上架」 |
| **下架素材** | `is_public=false`（素材上下架） | 單筆素材不對外；廠商與其他素材仍在 |
| **刪除廠商** | 種子後台「刪除」→ `DELETE /api/admin/manufacturers/:id` | **永久刪除** `manufacturers` 該列；`vendor_assets`、`manufacturer_portfolio` 等 **ON DELETE CASCADE** 一併消失，**無法復原** |

**建議**：封測製作完成、尚未同意公開前，用 **下架** 或 **素材下架**，不要用刪除。

---

## 一、需求與現況對照

| # | 需求 | 現況 | 缺口 |
|---|------|------|------|
| 1 | 後台可管理種子天數 | 建立時固定 **90 天**（`POST /api/admin/seed-manufacturer`）；`PATCH /api/admin/manufacturers/:id` **已支援** `expires_at`，但 [seed-vendors.html](https://matchdo.cc/admin/seed-vendors.html) **無 UI** | 列表僅顯示剩餘天數，無法改天數／延長 |
| 2 | 種子資料在「廠商同意前」僅內部可測；同意後才對外 | `GET /api/vendor-assets`：**僅 `role=admin`** 可看種子素材；**`tester` 與一般使用者相同**（看不到） | 測試員無法走完整 E2E；尚無「廠商已同意對外」旗標 |
| 3 | 數位原型／材料可上架、下架 | DB 已有 **`vendor_assets.is_public`**；公開 API 已 `.eq('is_public', true)`；廠商列表 API **不篩** `is_public`（`/api/me/vendor-assets` 看全部） | [manufacturer-materials.html](https://matchdo.cc/client/manufacturer-materials.html) **無開關 UI**；後台代傳素材亦固定 `is_public: true` |

**不變範圍（明確寫死）**

- **一般廠商**（`vendor_source` 非 `seed`）：列表、公開規則、廠商本人編輯權限 **維持現狀**。
- 種子廠商本人仍 **不得** 自行上傳／編輯（除非轉付費／官方範例）；內部預覽權限 **不** 等同開放廠商編輯。

---

## 二、建議資料模型（最小增量）

### 2.1 廠商層 `manufacturers`（種子生命週期）

| 欄位 | 現有 | 建議 |
|------|------|------|
| `vendor_source` | `'seed'` \| `'platform'` \| `null` | 不變 |
| `expires_at` | 種子建立時 +90 天 | 後台可改（已有 API） |
| `is_active` | 下架廠商 | 不變 |
| **`seed_public_released_at`**（新，可選） | 無 | `timestamptz NULL`：NULL＝尚未同意對外；有值＝已同意，種子素材依 **`is_public`** 對一般使用者顯示 |

**釋義（建議產品規則）**

```
對「一般訪客／訂製者」顯示種子廠商的素材，須同時：
  manufacturer.is_active = true
  AND (expires_at IS NULL OR expires_at > now())   -- 種子公開期未過（若仍用到期制）
  AND seed_public_released_at IS NOT NULL          -- 廠商已同意
  AND vendor_assets.is_public = true               -- 該筆素材已上架
```

**內部預覽（admin + tester）**

```
可看種子廠商及其素材（含 is_public=false），用於上架前測試：
  profiles.role IN ('admin', 'tester')
  OR ALLOWED_TESTER_EMAILS（與 /api/admin/can-access 一致）
```

若暫不加 `seed_public_released_at`，可先用「轉為付費／官方範例」代表同意；但無法區分「內部測試中」與「已同意但未逐筆上架」，故 **建議仍加此欄**。

### 2.2 素材層 `vendor_assets`（上下架）

| 欄位 | 用途 |
|------|------|
| `is_public` | **true**＝上架（設計端選圖、廠商頁素材庫、圖庫 fallback 等）；**false**＝下架（僅廠商後台列表與 admin/tester 預覽可見） |

上傳預設建議：

- 一般廠商：`is_public = true`（維持現狀）。
- 種子廠商（管理員代傳或日後開放）：**`is_public = false`**，由營運在 [manufacturer-materials.html](https://matchdo.cc/client/manufacturer-materials.html) 或種子後台逐筆「上架」；廠商同意後再對外。

---

## 三、功能規劃

### 3.1 種子廠商後台 — 天數與生命週期（需求 1）

**頁面**：`public/admin/seed-vendors.html`

| 功能 | UI | API |
|------|-----|-----|
| 建立時指定公開天數 | 數字輸入「公開天數」（預設 90） | `POST /api/admin/seed-manufacturer` 增加 `public_days` 或 `expires_at` |
| 列表調整到期日 | 「編輯」Modal：到期日 date、或「延長 N 天」 | 既有 `PATCH /api/admin/manufacturers/:id` `{ expires_at }` |
| 清除倒數（官方／付費前測試） | 「清除到期日」按鈕（確認框） | `PATCH` `{ expires_at: null }`（僅種子時顯示警告） |
| 廠商同意對外 | 「標記已同意公開」 | `PATCH` `{ seed_public_released_at: <now> }` |
| 撤回同意（少數） | 「撤回對外同意」 | 設 `seed_public_released_at: null`（素材仍靠 is_public） |

**列表欄位建議加**：同意狀態（未同意／已同意）、上架素材數／總數（可後續 SQL 聚合）。

**後端小改**

- `POST /api/admin/seed-manufacturer`：`expires_at = now + (public_days || 90) * 86400000`。
- `GET /api/admin/seed-manufacturers`：回傳 `seed_public_released_at`、可選 `assets_public_count`。

---

### 3.2 內部預覽：admin + tester（需求 2）

**核心**：抽出共用函式，取代僅 `getRequestAdminFlag` 的寫法。

```text
async function getRequestInternalPreviewFlag(req) → boolean
  admin OR tester OR ALLOWED_TESTER_EMAILS
```

**須套用「種子過濾」的 API／頁面**（逐一對照實作）：

| 區塊 | 端點／行為 | 現況 | 調整 |
|------|------------|------|------|
| 設計選圖 | `GET /api/vendor-assets` | 僅 admin 跳過種子過濾 | 改為 **internal preview** 跳過；一般使用者再加 **released + is_public** |
| 廠商頁素材庫 | 同上（`vendor-profile.html` 帶 token 時） | 未登入看不到種子素材 | 登入 tester/admin 且帶 `Authorization` 時可見 |
| 圖庫 fallback | `custom/gallery.html` → vendor-assets | 同左 | 同左 |
| 廠商列表 | `GET /api/manufacturers` | **未**隱藏種子廠商 | 可選：未同意種子對一般使用者隱藏廠商列；internal 可見（避免訪客點進空素材庫） |
| 廠商詳情 | `GET /api/manufacturers/:id` | 過期 404；種子未過期可開 | 未同意種子：一般使用者 404 或「尚未公開」；internal 可開 |
| 首頁靈感牆 | media-wall 相關 | 需確認是否含種子廠商作品／訂製圖 | 種子廠商 **portfolio**／**custom_products** 建議同規則：未同意不進公開牆；internal 可見 |
| 產品設計 E2E | 選種子素材生圖 | tester 目前選不到 | internal 可選 |

**前端**

- `vendor-profile.html`、`custom-product.js` 素材請求：若已登入，**一律帶 Bearer token**（現有可能未帶，導致 admin 登入前台仍看不到種子素材）。
- 可選：internal 使用者看到灰條「預覽模式：種子廠商內容尚未對外」。

**不做的誤解**

- 不給 tester 後台 `requireAdmin` 的寫入權（除非另開）；僅 **讀取／預覽** 種子內容。
- 種子廠商帳號本人登入仍 **403 編輯**（不變）。

---

### 3.3 素材上架／下架（需求 3）

**頁面**：`public/client/manufacturer-materials.html`（管理員代維護時亦用此頁或種子後台素材列表）

| 位置 | UI |
|------|-----|
| 已上傳列表（原型／材料分頁） | 每列：**上架中**／**已下架** badge + 切換開關或按鈕 |
| 編輯 Modal | `is_public` 核取或「顯示於素材庫／設計端」 |

**API**

| 方法 | 說明 |
|------|------|
| `PATCH /api/me/vendor-assets/:id` | body `{ is_public: true/false }`（確認 PUT 已支援或補上） |
| `PATCH /api/admin/manufacturers/:mfrId/vendor-assets/:id`（新，可選） | 管理員代改種子素材上下架，不冒充廠商 session |

**公開查詢**（已部分存在，補齊規則）：

- `GET /api/vendor-assets`：一般使用者 `is_public=true` + 種子須 `seed_public_released_at`。
- `GET /api/me/vendor-assets`：回傳全部並帶 `is_public`，供廠商／管理員管理。

**廠商頁** `vendor-profile.html`：呼叫 vendor-assets 時僅顯示公開規則通過的筆數（與設計端一致）。

---

## 四、實作順序建議

| 階段 | 內容 | 理由 |
|------|------|------|
| **P0** | `getRequestInternalPreviewFlag` + `GET /api/vendor-assets` 改為 admin/tester 可見種子；前台請求帶 token | 解決測試阻塞，改動面小 |
| **P0** | `manufacturer-materials` 列表上下架 + `PATCH is_public` | 需求 3，欄位已有 |
| **P1** | `seed-vendors.html` 天數／到期日編輯 UI | 需求 1，API 大半已有 |
| **P1** | migration `seed_public_released_at` + 後台「標記已同意」 | 需求 2 與對外釋出分界 |
| **P2** | 廠商列表／詳情／圖庫／靈感牆統一種子可見性 | 避免「廠商看得到、素材是空的」 |
| **P2** | 種子後台「素材列表」集中上下架（可選） | 不必進廠商帳號也能管素材 |

---

## 五、SQL 草案（P1）

```sql
-- docs/add-manufacturers-seed-public-released.sql
ALTER TABLE public.manufacturers
  ADD COLUMN IF NOT EXISTS seed_public_released_at timestamptz;

COMMENT ON COLUMN public.manufacturers.seed_public_released_at IS
  '種子廠商：廠商同意對外展示後寫入；NULL 表示僅 admin/tester 可預覽素材';
```

`vendor_assets.is_public` 已存在則不必新增；若舊資料皆 true，種子廠商可批次改 false 再由營運上架。

---

## 六、測試清單（上線前）

1. **admin** 登入前台 → 設計頁可選種子素材；未同意 + `is_public=false` 時一般帳號選不到。
2. **tester** 同上（`profiles.role=tester` 或 `ALLOWED_TESTER_EMAILS`）。
3. 一般使用者：看不到未同意種子素材；同意後僅見 `is_public=true`。
4. 種子後台：改 30 天、延長 7 天、清除到期日，列表倒數正確。
5. manufacturer-materials：下架後廠商頁與設計端消失；上架後恢復；`/api/me/vendor-assets` 仍見下架項。
6. 轉付費／官方範例後行為與現行手冊一致。

---

## 七、文件待同步（實作後）

- `docs/種子廠商入駐操作手冊.md` — 天數 UI、同意公開、素材上下架
- `docs/網站完整功能說明.md` — 種子可見性改為 admin+tester 預覽
- `docs/matchdo-todo.md` — 勾選項與 SQL 檔名

---

*本檔為規劃；實作時以 Agent 模式依 P0→P1 開 PR 為宜。*
