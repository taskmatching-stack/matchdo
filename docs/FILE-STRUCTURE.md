# 專案檔案結構與 URL 對照

**目的：** 只維護一份「產品設計／客製產品」相關頁面，避免改兩邊、跑錯檔。

---

## 產品設計表單：只改這兩個檔案（開發時只看這裡）

| 你要改的 | 檔案路徑 |
|----------|----------|
| 頁面（標題、表單、UI） | **`public/custom-product.html`** |
| 邏輯（類別、送出、生圖） | **`public/js/custom-product.js`** |

- 網址：**`http://localhost:3000/custom-product.html`**（從首頁「客製產品」→「建立客製產品」也會到這裡）
- 不要改：`public/iStudio-1.0.0/custom-product.html`、`public/iStudio-1.0.0/js/custom-product.js`（舊路徑，已導向或備援）

---

## 1. 前台入口（使用者看到的網址）

| 網址 | 實際檔案 | 說明 |
|------|----------|------|
| `/`、`/index.html` | `public/iStudio-1.0.0/index.html` | 首頁（媒體牆） |
| `/custom/` | `public/custom/index.html` | 客製產品說明／圖庫入口 |
| **`/custom-product.html`** | **`public/custom-product.html`** | **產品設計表單（唯一維護）** |
| `/client/my-custom-products.html` | `client/my-custom-products.html` | 我的客製產品列表 |
| `/client/custom-product-detail.html?id=...` | `client/custom-product-detail.html` | 單一產品詳情 |
| `/custom/gallery.html` | `public/custom/gallery.html` | 圖庫找廠商 |

**舊網址（自動導向，勿再使用）：**

- `/iStudio-1.0.0/custom-product.html` → 導向 `/custom-product.html`
- `/iStudio-1.0.0/client/my-custom-products.html` → 導向 `/client/my-custom-products.html`
- `/iStudio-1.0.0/client/custom-product-detail.html?...` → 導向 `/client/custom-product-detail.html?...`

---

## 2. 產品設計表單：只改這一個

- **HTML：** `public/custom-product.html`
- **JS：** `public/js/custom-product.js`

**不要改：** `public/iStudio-1.0.0/custom-product.html`（已由 server 導向，僅保留作備援 redirect 頁）。

---

## 3. 客戶端（我的產品／詳情）：只改根目錄 client/

- **列表：** `client/my-custom-products.html`
- **詳情：** `client/custom-product-detail.html`

**不要改：** `public/iStudio-1.0.0/client/*` 內相同檔名（連結已改為 `/client/...`，必要時可刪除 iStudio 下重複檔）。

---

## 4. 後台與靜態資源

| 網址 | 實際目錄／檔案 |
|------|----------------|
| `/admin/*` | `public/admin/*`（如 index、custom-categories） |
| `/client/*` | 專案根目錄 `client/*` |
| `/expert/*` | 專案根目錄 `expert/*` |
| `/js/*`、`/css/*`、`/config/*` | 先由 `public/` 對應路徑提供；根目錄另有 `js/`、`config/` 由 server 掛載 |

---

## 5. 修改流程（避免搞錯）

1. **產品設計頁（標題、表單、產品類別、UI）**  
   → 只改 `public/custom-product.html` 與 `public/js/custom-product.js`。

2. **「我的客製產品」／產品詳情**  
   → 只改 `client/my-custom-products.html`、`client/custom-product-detail.html`。

3. **從首頁到表單**  
   - 首頁「客製產品」→ `/custom/`（`public/custom/index.html`）  
   - 「建立客製產品」→ `/custom-product.html`（唯一表單）

4. **啟動方式**  
   在專案根目錄執行 `node server.js`，再開 `http://localhost:3000/custom-product.html` 確認。

---

*最後更新：依「檔案結構整理」需求撰寫。*
