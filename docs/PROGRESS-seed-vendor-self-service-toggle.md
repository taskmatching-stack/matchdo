# 種子廠商自助編輯開關 — 工作進度與操作手冊（2026-06-21）

> **核心原則：** 平台人員用 **種子綁定帳號** 登入廠商前台建內容；管理員帳號只在 `/admin/seed-vendors.html` **切換是否允許該帳號寫入**。  
> **不是** 以 admin 代建 API 為主要流程。  
> **「關閉自助編輯」只擋寫入（POST/PATCH/DELETE），不擋本人瀏覽公開頁與試用。**

---

## 讀取 vs 寫入（必分清楚）

| 行為 | 關閉自助編輯後 |
|------|----------------|
| 本人登入瀏覽公開廠商頁、控制台、素材列表（GET） | ✅ 允許 |
| 本人修改簡介、上傳素材／作品（`/api/me/*` 寫入） | ❌ 403 |
| 一般訪客瀏覽種子頁（未同意公開） | ❌ 404（與開關無關，種子曝光規則） |

---

## 產品目標（已定案）

| 角色 | 做什麼 |
|------|--------|
| **管理員**（`/admin/*`） | 建立種子、設天數／同意公開、**開／關「允許自助編輯」** |
| **平台維護**（種子綁定帳號，非 admin） | 開關 **ON** 時，登入 `/client/*` 前台建素材／作品／簡介 |
| **交付前** | 管理員將開關 **OFF** → 帳密交給廠商試用時無法再改內容 |
| **正式廠商**（轉付費／非 seed） | 不受此開關限制，一律可自助編輯 |

種子綁定帳號 **不能** 進 `/admin/*`；管理員帳號 **不應** 混用為種子綁定帳號。

---

## 建議操作流程

1. **管理員**：`seed-vendors.html` 步驟一建立種子 → 確認「自助編輯」為 **開啟**（預設 ON）。
2. **平台人員**：登出 admin → 用種子綁定帳號登入 → 在廠商控制台／素材／作品頁建內容。
3. **管理員**：內容就緒、要交廠商試用前 → 列表點 **關閉自助編輯**。
4. **廠商**：同一帳號登入 → 可瀏覽、試用；`POST/PATCH/DELETE` 等 `/api/me/*` 寫入回 **403**（`SEED_SELF_SERVICE_LOCKED`）。
5. **轉付費** 後：種子限制解除，廠商正常自助編輯。

---

## 資料庫

**Migration（須手動在 Supabase 執行）：** `docs/add-manufacturers-seed-self-service-enabled.sql`

| 表 | 欄位 | 預設 | 說明 |
|----|------|------|------|
| `manufacturers` | `seed_vendor_self_service_enabled` | `true` | 僅 `vendor_source='seed'` 時生效；`false` = 鎖定 `/api/me/*` 寫入 |

既有種子列預設 **true**，避免 migration 後突然無法編輯進行中的建置。

---

## API

### 管理員

| 端點 | 行為 |
|------|------|
| `GET /api/admin/seed-manufacturers` | 每列含 `seed_vendor_self_service_enabled` |
| `PATCH /api/admin/manufacturers/:id` | body 可傳 `seed_vendor_self_service_enabled: true/false` |

### 廠商前台（種子綁定帳號）

| 端點 | 開關 OFF 時 |
|------|-------------|
| 所有 `/api/me/*` **寫入**（含素材上傳、作品、PATCH 簡介、generate-i18n-en、collections 等） | **403**，`code: SEED_SELF_SERVICE_LOCKED` |
| `GET /api/me/*` 讀取 | 不受限 |

### Capabilities

`GET /api/me/capabilities` 回傳：

| 欄位 | 意義 |
|------|------|
| `seed_vendor_self_service_locked` | 種子且開關 OFF → `true` |
| `can_edit_vendor_content` | 非種子或開關 ON → `true` |

---

## 前端

| 檔案 | 變更 |
|------|------|
| `public/admin/seed-vendors.html` | 列表「自助編輯」欄；種子列可切換 ON/OFF；更新說明文案 |
| `public/client/manufacturer-dashboard.html` | 種子且鎖定時顯示唯讀提示 banner |

---

## 實作狀態

| 步驟 | 狀態 |
|------|------|
| 本文件 | ✅ |
| SQL migration | ✅（待 Supabase 執行） |
| `server.js` reject + admin + capabilities | ✅ |
| `seed-vendors.html` UI | ✅ |
| `manufacturer-dashboard` banner | ✅ |
| commit / push | ⏳ 待使用者要求 |
| Cloud Run 部署 | ⏳ push 後 |

---

## 測試手冊

### 前置

1. Supabase 執行 `docs/add-manufacturers-seed-self-service-enabled.sql`
2. 有一筆 `vendor_source='seed'` 的測試廠商

### A. 開關 ON（預設）

1. 管理員開 `seed-vendors.html` → 種子列「自助編輯」應為 **開啟**。
2. 種子綁定帳號登入 → 控制台可儲存簡介、上傳素材。

### B. 開關 OFF

1. 管理員點 **關閉自助編輯**。
2. 同一帳號再登入 → 儲存應失敗（403）；控制台 banner 顯示唯讀。
3. `GET /api/me/capabilities` → `seed_vendor_self_service_locked: true`。

### C. 轉付費

1. 管理員「轉付費」→ 即使 DB 欄位仍為 false，寫入應恢復（非 seed 不檢查）。

### D. 非種子

一般／付費廠商不受開關影響；列表該欄顯示「不適用」。

---

## 後續（未實作）

- **種子沙盒**：未 release 的 seed 在首頁／素材池只看自家商品（另開 `seed_sandbox_mode` 規格）。
- Admin 代傳「上傳」按鈕保留作備援，非主要流程。

---

## 相關文件

- `docs/seed-vendor-admin-and-visibility-plan.md` — 種子可見性／同意公開
- `docs/種子廠商入駐操作手冊.md` — 入駐總手冊（可補本開關一節）
