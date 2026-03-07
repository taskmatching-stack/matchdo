# MatchDO 網站地圖 (Sitemap)

## 📍 公開頁面 (Public)
基礎路徑: `http://localhost:3000/`

| 路徑 | 檔案位置 | 說明 | 狀態 |
|------|---------|------|------|
| `/` | `public/index.html` | 僅做導向，會跳轉到下方首頁 | ✅ 存在 |
| **首頁（實際內容）** | **`public/iStudio-1.0.0/index.html`** | **主要首頁（iStudio 模板）**；導航用 **`/iStudio-1.0.0/js/site-header.js`** | ✅ 存在 |
| `/login.html` | `public/login.html` | 登入頁面 | ✅ 存在 |
| `/register.html` | `public/register.html` | 註冊頁面 | ✅ 存在 |
| `/subscription-plans.html` | `public/subscription-plans.html` | 會員方案與定價（訂製品四級方案、點數規則） | ✅ 存在 |
| `/custom/` | `public/custom/index.html` | 訂製方案首頁（找訂製廠商、建立客製產品、圖庫） | ✅ 存在 |
| `/custom-product.html` | `public/custom-product.html` | 產品設計表單（訂製分類） | ✅ 存在 |
| `/custom-product.html?tab=scene-sim` | 同上 | 產品設計頁「實境模擬」分頁 | ✅ 動態網址 |
| `/custom-product.html?tab=pattern-extract` | 同上 | 產品設計頁「圖樣提取」分頁 | ✅ 動態網址 |
| `/remake/` | `public/remake/index.html` | 再製方案首頁（改裝現有品、必填參考圖） | ✅ 存在 |
| `/remake-product.html` | `public/remake-product.html` | 再製設計表單（再製分類，後台 remake-categories） | ✅ 存在 |
| `/credits.html` | `public/credits.html` | 我的點數／儲值／訂閱付款 | ✅ 存在 |

### 多語系與 Sitemap
- **目前行為**：`/sitemap-pages.xml` 僅列出固定路徑（如 `/remake/`、`/custom/`），**不依語系重複列出**；多語系由**同一 URL** 加 `?lang=en`（或 localStorage）與前台 i18n 切換，搜尋引擎可抓取同一 URL。
- **分類多語系**：訂製／再製分類名稱由 API 支援 `?lang=en|ja|es|de|fr`（`/api/custom-product-categories`、`/api/remake-categories`），前台依語系請求即可顯示對應名稱；sitemap 未單獨列出「分類頁」URL。
- **若需擴充**：可產出 `xhtml:link rel="alternate" hreflang` 或依語系拆成多個 sitemap（如 `sitemap-pages-en.xml`），再於 `sitemap.xml` 索引中列入。

---

## 👤 客戶前台 (Client)
基礎路徑: `http://localhost:3000/client/`
**使用者**: 發案者（有需求的業主）

| 路徑 | 檔案位置 | 說明 | 狀態 |
|------|---------|------|------|
| `/client/dashboard.html` | `client/dashboard.html` | 客戶控制台（統計、快速操作） | ✅ 已建立 |
| `/client/my-projects.html` | `client/my-projects.html` | 我的專案列表 | ⏳ 待確認 |
| `/client/project-detail.html` | `client/project-detail.html` | 專案詳情（含套餐管理） | ❌ 未建立 |
| `/client/project-items.html` | `client/project-items.html` | 項目/套餐管理介面 | ❌ 未建立 |
| `/client/matched-experts.html` | `client/matched-experts.html` | 媒合廠商列表 | ❌ 未建立 |
| `/client/contact-unlocks.html` | `client/contact-unlocks.html` | 聯絡紀錄 | ❌ 未建立 |

### 客戶流程
1. **註冊/登入** → 選擇「發案者」角色
2. **控制台** (`/client/dashboard.html`) → 查看統計資訊
3. **建立專案** → 點擊「建立新專案」→ 進入 `my-projects.html?action=create`
4. **管理項目** (`/client/project-items.html`) → 建立套餐（A組、B組）→ 發布項目
5. **查看媒合** (`/client/matched-experts.html`) → 系統推薦的廠商
6. **聯絡方式** → 媒合成功後直接顯示廠商聯絡方式（無解鎖、無付費解鎖）

---

## 🔧 專家前台 (Expert)
基礎路徑: `http://localhost:3000/expert/`
**使用者**: 接案者（提供服務的廠商/專家）

| 路徑 | 檔案位置 | 說明 | 狀態 |
|------|---------|------|------|
| `/expert/dashboard.html` | `expert/dashboard.html` | 專家控制台 | ❌ 未建立 |
| `/expert/listing-detail.html` | `expert/listing-detail.html` | 服務項目詳情 | ❌ 未建立 |
| `/expert/my-listings.html` | `expert/my-listings.html` | 我的服務列表 | ❌ 未建立 |
| `/expert/matched-projects.html` | `expert/matched-projects.html` | 媒合到的專案 | ❌ 未建立 |
| `/expert/vendor-settings.html` | `expert/vendor-settings.html` | 廠商設定 | ❌ 未建立 |

### 專家流程
1. **註冊/登入** → 選擇「專家」角色
2. **控制台** (`/expert/dashboard.html`) → 查看統計資訊
3. **建立服務** → 填寫專長、價格範圍、作品集
4. **查看媒合** (`/expert/matched-projects.html`) → 系統推薦的專案
5. **接受委託** → 與客戶聯絡洽談

---

## 🛠️ 管理員後台 (Admin)
基礎路徑: `http://localhost:3000/admin/`
**使用者**: 系統管理員

| 路徑 | 檔案位置 | 說明 | 狀態 |
|------|---------|------|------|
| `/admin/index.html` | `admin/index.html` | 管理員儀表板 | ✅ 存在 |
| `/admin/membership.html` | `admin/membership.html` | 會員／訂閱管理（方案、點數規則、權限、用戶等級、點數流水） | ✅ 存在 |
| `/admin/dashboard.html` | `admin/dashboard.html` | 管理員控制台 | ⏳ 待確認 |
| `/admin/users.html` | `admin/users.html` | 用戶管理 | ⏳ 待確認 |
| `/admin/analytics.html` | `admin/analytics.html` | 數據分析 | ⏳ 待確認 |

---

## 🗂️ 靜態資源

### JavaScript 模組與導航
- **首頁**（`/` → `iStudio-1.0.0/index.html`）使用 **`/iStudio-1.0.0/js/site-header.js`**，登入狀態邏輯需與 `/js/site-header.js` 同步。
- 其他使用 `/js/site-header.js` 的頁面：如 `public/custom-product.html` 等。

| 檔案 | 說明 | 狀態 |
|------|------|------|
| `config/auth-config.js` | 認證服務（Supabase），全站共用 | ✅ 存在 |
| `js/site-header.js` | 網站頭部（非首頁） | ✅ 存在 |
| `iStudio-1.0.0/js/site-header.js` | **首頁用**網站頭部 | ✅ 存在 |
| `js/sidebar.js` | 側邊欄元件 | ⏳ 待確認 |

### CSS 樣式
路徑: `/css/`

| 檔案 | 說明 | 狀態 |
|------|------|------|
| `css/style.css` | 全域樣式 | ⏳ 待確認 |

### 配置檔案
路徑: `/config/`

| 檔案 | 說明 | 狀態 |
|------|------|------|
| `config/auth-config.js` | Supabase 配置 | ✅ 存在 |

---

## 🌐 API 端點 (Server Routes)

### 後端 API
基礎路徑: `http://localhost:3000/api/`

| 端點 | 方法 | 說明 | 狀態 |
|------|------|------|------|
| `/api/analyze` | POST | AI 圖片分析 | ✅ 存在 |
| `/api/upload` | POST | 檔案上傳 | ✅ 存在 |

---

## 📊 目前進度統計

### ✅ 已完成 (6 項)
1. 資料庫架構（11 表 + 5 函數 + 2 視圖）
2. 認證系統（Supabase Auth）
3. 公開頁面（首頁、登入、註冊）
4. 客戶控制台 (`/client/dashboard.html`)
5. 伺服器靜態路由配置
6. AI 分析 API

### 🔄 進行中 (Stage 2)
- 客戶前台介面開發

### ⏳ 待開發
- 客戶專案管理頁面（4 個頁面）
- 專家前台介面（5 個頁面）
- 管理員後台確認

---

## 🚀 優先順序

### 高優先級（本週）
1. ✅ `/client/dashboard.html` - 客戶控制台
2. ⬜ `/client/my-projects.html` - 專案列表
3. ⬜ `/client/project-detail.html` - 專案詳情
4. ⬜ `/client/project-items.html` - 項目/套餐管理

### 中優先級（下週）
5. ⬜ `/client/matched-experts.html` - 媒合廠商
6. ⬜ `/expert/dashboard.html` - 專家控制台
7. ⬜ `/expert/my-listings.html` - 服務列表

### 低優先級（可延後）
- 廠商目錄（公開頁面）
- 管理員後台完善

---

## 📝 路由配置 (server.js)

```javascript
// 靜態檔案服務
app.use(express.static('public'));           // 公開頁面
app.use('/uploads', express.static(uploadDir)); // 上傳檔案
app.use('/client', express.static('client')); // 客戶前台
app.use('/expert', express.static('expert')); // 專家前台
app.use('/admin', express.static('admin'));   // 管理員後台
```

**注意**: 所有路徑都是相對於專案根目錄 `d:\AI建站\ai-matching\`

---

## 🔍 SEO 用 Sitemap（自動更新、Google 收錄）

### 實作方式（後端動態產生）

| 網址 | 說明 | 更新方式 |
|------|------|----------|
| **GET /sitemap.xml** | Sitemap **索引**，列出五個子 sitemap（pages / categories / vendors / products / collections） | 固定結構 |
| **GET /sitemap-pages.xml** | 靜態公開頁 + **首頁四種類型**（全部 `/`、設計圖/對照圖/系列圖 `/?layout_type=...`）+ **中英文**（`/?lang=en` 與三種 layout_type + lang）；見 server.js SITEMAP_PAGES | 程式內固定清單 |
| **GET /sitemap-categories.xml** | **動態**：首頁「分類」篩選 `/?category_key=xxx`（來自 `ai_categories` 主分類）；與 layout_type／lang 可疊加，sitemap 只列主分類 landing | **每次請求即時查 DB** |
| **GET /sitemap-vendors.xml** | **動態**：廠商列表 + 各廠商詳情頁 | **每次請求即時查 DB**（`manufacturers`），新廠商上線即被收錄 |

- **首頁網址疊加**：`layout_type`、`category_key`、`subcategory_key`、`q`、`lang` 可同時出現在同一 URL；sitemap 收錄「全部、三種類型、中英文、主分類」等主要 landing，不列所有組合。
- **會員頁面**（`/client/*`、`/profile/*`、`/expert/*`、`/admin/*`）**不放進 sitemap**，僅收錄對外公開頁與廠商相關頁。
- **唯一可能手動**：若新增一種**全新的公開頁面**，在 **server.js** 的 **SITEMAP_PAGES** 加一筆即可；其餘皆自動。目前已含：`/`、三種 `/?layout_type=...`、四筆 `?lang=en` 變體、`/subscription-plans.html`、`/custom/`、`/custom/gallery.html`、`/custom-product.html`、`/custom-product.html?tab=scene-sim`、`/custom-product.html?tab=pattern-extract`、`/remake/`、`/remake-product.html`、about/contact、login/register 等。
- **GET /robots.txt**：內含 `Sitemap: {BASE_URL}/sitemap.xml` 與 `Disallow: /admin/`、`/api/`、`/payment/`。
- 部署後在 **Google Search Console** 提交 `https://你的網域/sitemap.xml` 即可。

### 什麼該進 Sitemap（簡表）

| 類型 | 建議 |
|------|------|
| 首頁、方案、圖庫、廠商列表／詳情、登入註冊、關於聯絡 | ✅ 放 |
| 會員後台、金流回調、404／測試頁 | ❌ 不放 |

---

## 📈 Google Analytics（GA4）

- **申請位置**：[https://analytics.google.com/](https://analytics.google.com/) → 建立資源 → 選擇 **GA4**，取得 **Measurement ID**（`G-XXXXXXXXXX`）。
- **要用 GA4 還是 GA5？** 請用 **GA4**；目前 Google 只提供 GA4，**沒有 GA5**（GA4 為現行版本，新站一律 GA4）。
- **本專案**：將 Measurement ID 設為環境變數（如 `GA_MEASUREMENT_ID`），在全站共用版型（如 site-header 或各頁 `<head>`）加入 GA4 追蹤碼（gtag.js）即可。

---

最後更新: 2026-02-22
