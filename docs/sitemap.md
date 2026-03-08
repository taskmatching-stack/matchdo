# MatchDO 網站地圖 (Sitemap)

**說明**：本表「狀態」已依專案實際檔案核對。`/client`、`/expert` 由 server 掛載根目錄的 `client/`、`expert/`；`/admin` 因先掛 `static('public')`，實際由 **public/admin/** 提供。

---

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
**實際檔案目錄**：專案根目錄 `client/`（server 掛載 `/client` → `client/`）  
**使用者**: 發案者（有需求的業主）

| 路徑 | 檔案位置 | 說明 | 狀態 |
|------|---------|------|------|
| `/client/dashboard.html` | `client/dashboard.html` | 客戶控制台（統計、快速操作） | ✅ 存在 |
| `/client/my-projects.html` | `client/my-projects.html` | 我的專案列表 | ✅ 存在 |
| `/client/project-detail.html` | `client/project-detail.html` | 專案詳情（含套餐管理） | ✅ 存在 |
| `/client/project-items.html` | `client/project-items.html` | 項目/套餐管理介面（專案詳情內可導向，獨立頁尚未建立） | ❌ 未建立 |
| `/client/matched-experts.html` | `client/matched-experts.html` | 媒合廠商列表 | ✅ 存在 |
| `/client/contact-unlocks.html` | `client/contact-unlocks.html` | 聯絡紀錄 | ✅ 存在 |

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
**實際檔案目錄**：專案根目錄 `expert/`

| 路徑 | 檔案位置 | 說明 | 狀態 |
|------|---------|------|------|
| `/expert/dashboard.html` | `expert/dashboard.html` | 專家控制台 | ✅ 存在 |
| `/expert/listing-detail.html` | `expert/listing-detail.html` | 服務項目詳情 | ❌ 未建立（目前有 listing-form.html） |
| `/expert/my-listings.html` | `expert/my-listings.html` | 我的服務列表 | ✅ 存在 |
| `/expert/matched-projects.html` | `expert/matched-projects.html` | 媒合到的專案 | ✅ 存在 |
| `/expert/vendor-settings.html` | `expert/vendor-settings.html` | 廠商設定 | ❌ 未建立（目前有 my-profile.html、profile-view.html） |

### 專家流程
1. **註冊/登入** → 選擇「專家」角色
2. **控制台** (`/expert/dashboard.html`) → 查看統計資訊
3. **建立服務** → 填寫專長、價格範圍、作品集
4. **查看媒合** (`/expert/matched-projects.html`) → 系統推薦的專案
5. **接受委託** → 與客戶聯絡洽談

---

## 🛠️ 管理員後台 (Admin)
基礎路徑: `http://localhost:3000/admin/`  
**實際檔案目錄**：`public/admin/`（因先掛 `static('public')`，/admin 由 public/admin 提供）

| 路徑 | 檔案位置 | 說明 | 狀態 |
|------|---------|------|------|
| `/admin/index.html` | `public/admin/index.html` | 管理員儀表板 | ✅ 存在 |
| `/admin/membership.html` | `public/admin/membership.html` | 會員／訂閱管理（方案、點數規則、權限、用戶等級、點數流水） | ✅ 存在 |
| `/admin/user-management.html` | `public/admin/user-management.html` | 用戶管理 | ✅ 存在 |
| `/admin/analytics.html` | `public/admin/analytics.html` | 數據分析 | ✅ 存在 |

---

## 🗂️ 靜態資源

### JavaScript 模組與導航
- **首頁**（`/` → `iStudio-1.0.0/index.html`）使用 **`/iStudio-1.0.0/js/site-header.js`**，登入狀態邏輯需與 `/js/site-header.js` 同步。
- 其他使用 `/js/site-header.js` 的頁面：如 `public/custom-product.html` 等。

| 檔案 | 說明 | 狀態 |
|------|------|------|
| `public/config/auth-config.js` | 認證服務（Supabase），全站共用 | ✅ 存在 |
| `public/js/site-header.js` | 網站頭部（非首頁） | ✅ 存在 |
| `public/iStudio-1.0.0/js/site-header.js` | **首頁用**網站頭部 | ✅ 存在 |

### CSS 樣式
路徑: `/css/`（由 public 提供）

| 檔案 | 說明 | 狀態 |
|------|------|------|
| `public/css/style.css` 或 iStudio 內樣式 | 全域樣式 | 依模板存在 |

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

### ✅ 已建立
- 公開頁面、客戶前台（dashboard / my-projects / project-detail / matched-experts / contact-unlocks）、專家前台（dashboard / my-listings / matched-projects / listing-form 等）、管理員後台（public/admin 內多數頁面）、認證與靜態路由、AI 相關 API。

### ❌ 尚未建立（文件中標示）
- `/client/project-items.html`（項目/套餐獨立頁；專案詳情內有導向，實際檔案未建）
- `/expert/listing-detail.html`、`/expert/vendor-settings.html`（目前有 listing-form、my-profile 等）

---

## 🚀 優先順序（參考）

### 已上線
- 客戶：dashboard、my-projects、project-detail、matched-experts、contact-unlocks
- 專家：dashboard、my-listings、matched-projects、listing-form
- 管理員：index、membership、user-management、analytics 等（public/admin）

### 可補建
- `/client/project-items.html` - 項目/套餐獨立頁（目前由 project-detail 內流程涵蓋）
- `/expert/listing-detail.html`、`/expert/vendor-settings.html` - 視需求對應至現有 listing-form、my-profile

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
| **GET /sitemap.xml** | Sitemap **索引**，列出六個子 sitemap（pages / categories / vendors / products / collections / inspiration） | 固定結構 |
| **GET /sitemap-pages.xml** | 靜態公開頁 + **首頁四種類型**（全部 `/`、設計圖/對照圖/系列圖 `/?layout_type=...`）+ **中英文**（`/?lang=en` 與三種 layout_type + lang）；見 server.js SITEMAP_PAGES | 程式內固定清單 |
| **GET /sitemap-categories.xml** | **動態**：首頁「分類」篩選 `/?category_key=xxx`（來自 `ai_categories` 主分類）；與 layout_type／lang 可疊加，sitemap 只列主分類 landing | **每次請求即時查 DB** |
| **GET /sitemap-vendors.xml** | **動態**：廠商列表 + 各廠商詳情頁 | **每次請求即時查 DB**（`manufacturers`），新廠商上線即被收錄 |
| **GET /sitemap-products.xml** | **動態**：公開客製作品詳情頁 | **每次請求即時查 DB**（custom_products） |
| **GET /sitemap-collections.xml** | **動態**：作品系列／資料夾頁（slug） | **每次請求即時查 DB**（media_collections） |
| **GET /sitemap-inspiration.xml** | **動態**：靈感牆單一作品獨立 URL（/inspiration/:type/:id），上限 150 筆 | **每次請求即時查 DB** |

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

最後更新: 2026-03-05（已依實際專案檔案核對客戶/專家/後台狀態）
