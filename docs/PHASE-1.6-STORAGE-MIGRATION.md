# Phase 1.6：Supabase Storage 遷移 — 執行細項

**目標**：將目前本地 `uploads/` 的檔案上傳改為 Supabase Storage，以支援無狀態部署（如 Vercel）與 CDN。

**最後更新**：2026-02-06  
**狀態**：✅ **Phase 1.6 已完成**（SQL 已執行、後端與前端已改用 Supabase Storage；遷移腳本為可選）

---

## 一、現況盤點

### 1.1 目前使用本地上傳的 API 與儲存位置

| API | 表單欄位 | 儲存位置 | 寫入 DB / 回傳 |
|-----|----------|----------|----------------|
| `POST /api/ai-detect` | `designImages` (最多 10) | `uploads/` | `projects.description.files` → `{ filename, url: "/uploads/xxx" }` |
| `POST /api/analyze` | `designImages` (最多 10) | `uploads/` | 僅送 AI，不回存 URL |
| `POST /api/generate-product-image` | 無（AI 生成） | `uploads/generated-xxx.png` | 回傳 `imageUrl: "/uploads/xxx"` |
| `POST /api/analyze-custom-product` | `images` (最多 10) | `uploads/` | `custom_products.image_urls` 陣列 → `["/uploads/xxx", ...]` |

### 1.2 相關程式位置（server.js）

- **Multer 設定**：約 14–25 行（`uploadDir`、`diskStorage`、`upload`）
- **靜態服務**：約 155 行 `app.use('/uploads', express.static(uploadDir))`
- **ai-detect**：213 行起，300 行 `filesInfo`，351–356 行寫入 `description.files`
- **analyze**：477 行起（不寫 URL 進 DB）
- **generate-product-image**：1176 行起，1216–1224 行寫檔 + 回傳 URL
- **analyze-custom-product**：1240 行起，1323、1329–1331 行 `image_urls`

### 1.3 既有文件

- `docs/create-storage-bucket.sql`：僅含 `project-images` bucket 與 RLS，可擴充為雙 bucket。

---

## 二、執行細項（依序）

### 2.1 在 Supabase 建立 Storage Buckets

**方式 A：Dashboard 手動**

1. 登入 Supabase → **Storage** → **New bucket**
2. 建立兩桶：
   - **id/name**: `project-images`  
     - Public: 是（前端需直接顯示圖片）  
     - File size limit: 例如 50MB  
     - Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`, `image/gif`
   - **id/name**: `custom-products`  
     - 設定同上

**方式 B：SQL（與既有 create-storage-bucket.sql 對齊）**

- 新增 `custom-products` bucket（`docs/create-storage-bucket.sql` 目前只有 `project-images`）。
- 執行腳本：在 Supabase SQL Editor 執行擴充後的 `create-storage-bucket.sql`（見下方 2.2）。

**交付**：兩桶皆存在且為 public，可上傳測試檔。

---

### 2.2 撰寫／擴充 Storage RLS 與 Policy

- 讀取 `docs/create-storage-bucket.sql`，補上 **custom-products** 的 `INSERT` 與 policies。
- **project-images**：維持「公開讀取、已登入可上傳」；若希望「用戶只刪自己的」，可依 path 含 `owner_id` 訂 DELETE policy（選做）。
- **custom-products**：同上（公開讀取、已登入上傳）。
- 說明：目前上傳皆經 **server.js 用 SERVICE_ROLE_KEY**，會繞過 RLS；RLS 主要供日後「前端直傳」或手動在 Dashboard 操作時使用。

**交付**：單一 SQL 檔可重複執行（ON CONFLICT / IF NOT EXISTS），兩桶都有合理 policy。

---

### 2.3 修改 server.js 上傳邏輯

**Step 1：Multer 改為 memory storage**

- 將 `multer.diskStorage` 改為 `multer.memoryStorage()`，不再寫入 `uploads/`。
- 保留 `upload` 變數給現有 `upload.array(...)` 使用，這樣 `req.files` 會是 `{ buffer, originalname, mimetype, ... }`（無 `path`）。

**Step 2：撰寫共用的「上傳單檔至 Supabase」輔助函式**

例如：

```js
async function uploadToSupabaseStorage(bucket, pathPrefix, file, options = {}) {
  const ext = (options.ext || path.extname(file.originalname || '') || '.jpg').replace(/^\./, '');
  const filename = `${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;
  const objectPath = pathPrefix ? `${pathPrefix}/${filename}` : filename;
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(objectPath, file.buffer, {
      contentType: file.mimetype || 'image/jpeg',
      upsert: false
    });
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(data.path);
  return { path: data.path, publicUrl };
}
```

- 回傳 `publicUrl` 供寫入 DB 或回傳前端（不再用 `/uploads/xxx`）。

**Step 3：依 API 替換「寫入本地 → 組 URL」為「上傳 Storage → 組 publicUrl」**

| API | 改動要點 |
|-----|----------|
| **POST /api/ai-detect** | 對 `req.files` 每檔呼叫上傳至 `project-images`，path 建議 `{owner_id || 'anon'}/{filename}`；`filesInfo` 改為 `{ filename, url: publicUrl }`；建立專案時 `description.files` 存 publicUrl。 |
| **POST /api/analyze** | 同上，上傳至 `project-images`；若目前未存 URL 可只改「讀檔」為從 `req.files[0].buffer` 取 base64，不寫 DB。 |
| **POST /api/generate-product-image** | AI 產出 buffer 後，改為上傳至 `custom-products`（例如 path `generated/{filename}`），回傳 `imageUrl: publicUrl`。 |
| **POST /api/analyze-custom-product** | 對 `req.files` 每檔上傳至 `custom-products`，`image_urls` 改為 `publicUrl` 陣列。 |

**Step 4：環境變數**

- 確保已有 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`（上傳用），無需額外 Storage 專用變數。

**交付**：上述四個 API 皆改為只使用 Supabase Storage，不再寫入 `uploads/`；回傳與 DB 皆為 Supabase public URL。

---

### 2.4 更新圖片 URL 格式（前端與 DB）

- **前端**：若目前有寫死 `location.origin + '/uploads/xxx'` 或相對路徑 `/uploads/xxx`，改為直接使用後端回傳的 **完整 publicUrl**（Supabase 的 https 網址）；若後端已回傳完整 URL，前端可不必改。
- **既有專案／客製產品**：DB 內已存的 `description.files[].url`、`custom_products.image_urls` 若為 `/uploads/xxx`，需靠「遷移腳本」改寫（見 2.5）。
- **新資料**：一律存 Supabase public URL，無需再改。

**交付**：新上傳的圖片在前端可正常顯示；舊資料待 2.5 遷移後一併生效。

---

### 2.5 遷移腳本：uploads/ 既有檔案 → Storage

- **目的**：把現有 `uploads/` 底下檔案上傳到對應 bucket，並可選更新 DB 內舊 URL。
- **腳本建議**：
  - 讀取 `uploads/` 目錄下所有檔案（可排除非圖檔）。
  - 依檔名或後端邏輯無法區分「專案圖」或「客製產品圖」時，可統一上傳到 `project-images` 的 `migrated/{filename}`，或依專案需求分桶。
  - 上傳後取得 `publicUrl`。
  - **可選**：查詢 `projects` 的 `description->files`、`custom_products.image_urls`，將 `url` 含 `/uploads/` 的項目改為對應的 `publicUrl`（需建立「舊檔名 → 新 publicUrl」對照，或一律用 `migrated/{filename}` 對應）。
- **執行**：本地執行一次 `node docs/migrate-uploads-to-storage.js`（或你指定的腳本名），需設定 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`。
- **交付**：腳本可重複執行（idempotent 佳）、有簡單 log；若不做 DB 更新，至少檔案已進 Storage，舊連結可改為「新 URL 對照表」或手動修正。

---

### 2.6 設定 Storage RLS（用戶只能上傳/讀取自己檔案）

- **讀取**：兩桶已設為 **public** 時，所有人可讀，不需依 user 限制。
- **上傳**：目前皆經 server（service role），不經 RLS；若日後改為「前端直傳」，需 policy：`auth.role() = 'authenticated'` 且可選 `storage.foldername(name)[1] = auth.uid()::text`（若 path 為 `{owner_id}/xxx`）。
- **刪除**：可選「僅上傳者或管理員可刪」，同上用 path 含 `owner_id` 或 admin 判斷。
- **交付**：`create-storage-bucket.sql` 內 policy 註解說明「server 上傳用 service role；以下 policy 供前端直傳／Dashboard 用」；若已實作 path 含 owner，寫明 DELETE policy 規則。

---

### 2.7 靜態服務與 .gitignore

- **app.use('/uploads', ...)**：遷移完成後可保留一段時間（向後相容舊連結），或改為 404／redirect；最終可移除，改為僅使用 Supabase URL。
- **.gitignore**：確保含 `uploads/`，避免本地上傳檔案被 commit。
- **部署**：Vercel 等無本地磁碟時，不再依賴 `uploads/`，部署前完成 2.3 即可。

**交付**：.gitignore 已含 `uploads/`；部署文件註明「圖片皆來自 Supabase Storage」。

---

## 三、檢查清單（完成標準）

- [x] Supabase 存在 **project-images**、**custom-products** 兩桶（已於 SQL Editor 執行 `docs/create-storage-bucket.sql`）
- [x] RLS / policy 已寫入 `create-storage-bucket.sql`
- [x] **server.js**：Multer 改為 memory；`uploadToSupabaseStorage` 已實作；四個 API 已改用 Storage
- [x] **POST /api/ai-detect**：回傳與 DB 的 `description.files` 為 Supabase publicUrl
- [x] **POST /api/analyze**：改為從 buffer 讀取，不寫入磁碟
- [x] **POST /api/generate-product-image**：上傳至 custom-products/generated/，回傳 Supabase publicUrl
- [x] **POST /api/analyze-custom-product**：`custom_products.image_urls` 為 Supabase publicUrl 陣列
- [ ] 遷移腳本（可選）：將既有 `uploads/` 檔案上傳至 Storage 並可選更新 DB 舊 URL
- [x] 驗證：前端新上傳圖片可顯示；Supabase 兩桶已建立
- [x] .gitignore 含 `uploads/`

---

## 四、風險與注意

- **SERVICE_ROLE_KEY**：僅在 server 使用，不可暴露給前端。
- **路徑設計**：建議 `project-images/{owner_id|'anon'}/{filename}`、`custom-products/{owner_id|'anon'}/{filename}` 或 `generated/`，方便日後做 quota 或 RLS 依 owner 限制。
- **遷移期間**：若先上線新邏輯再遷移舊檔，舊的 `/uploads/xxx` 在無狀態環境會 404，可先保留舊靜態路由或盡快跑遷移並更新 DB。

---

## 五、與 matchdo-todo 對應

對應 `matchdo-todo.md` Phase 1.6 條目：

- [x] 在 Supabase SQL Editor 執行 `create-storage-bucket.sql`（建立 `project-images`、`custom-products`）→ **2.1**
- [x] 修改 `server.js` 上傳邏輯（使用 Supabase Storage API）→ **2.3**
- [ ] 建立遷移腳本：將 `uploads/` 檔案搬到 Supabase Storage（可選）→ **2.5**
- [x] 更新圖片 URL 格式（前端 toAbsoluteUrl；後端回傳 Supabase public URL）→ **2.4**
- [x] 設定 Storage RLS policies（已含於 create-storage-bucket.sql）→ **2.2、2.6**

Phase 1.6 已完成；詳見 `docs/PHASE.md` 與 `matchdo-todo.md`。
