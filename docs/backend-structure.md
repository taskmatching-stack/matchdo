# MatchDO 後台結構說明

## 📂 目錄結構

```
ai-matching/
├── admin/              ⭐ 管理員後台（只有管理員可訪問）
│   ├── index.html                  - 管理員控制台首頁
│   ├── user-management.html        - 用戶管理
│   ├── categories.html             - 分類管理
│   └── category-images.html        - 分類圖片管理
│
├── client/             👤 客戶（發案者）後台
│   ├── dashboard.html              - 發案控制台
│   ├── my-projects.html            - 我的專案列表
│   ├── project-detail.html         - 專案詳情
│   ├── project-items.html          - 分包項目管理（待建立）
│   └── my-custom-products.html     - 我的客製產品
│
└── expert/             🔧 專家（接案者）後台
    ├── dashboard.html              - 專家控制台
    ├── my-listings.html            - 我的報價列表
    ├── matched-projects.html       - 媒合到的專案
    └── listing-detail.html         - 報價詳情（待建立）
```

---

## 🔐 權限說明

### 1. **管理員後台** (`/admin/`)
- **訪問條件**: 
  - 必須登入
  - `profiles.role = 'admin'` 或 `user_metadata.role = 'admin'`
- **功能**:
  - 管理所有用戶
  - 管理分類系統
  - 上傳/管理分類圖片
  - 系統設定

### 2. **客戶後台** (`/client/`)
- **訪問條件**: 
  - 必須登入
  - 任何用戶都可訪問（發案功能開放給所有人）
- **功能**:
  - 發布專案
  - 管理自己的專案
  - 查看媒合專家
  - 管理分包項目
  - 查看聯絡資訊

### 3. **專家後台** (`/expert/`)
- **訪問條件**: 
  - 必須登入
  - 任何用戶都可訪問（接案功能開放給所有人）
- **功能**:
  - 刊登報價
  - 管理自己的報價
  - 查看媒合專案
  - 聯繫客戶

---

## 📋 訪問路徑整理

### 管理員後台
```
http://localhost:3000/admin/index.html
http://localhost:3000/admin/user-management.html
http://localhost:3000/admin/categories.html
http://localhost:3000/admin/category-images.html
```

### 客戶後台
```
http://localhost:3000/client/dashboard.html
http://localhost:3000/client/my-projects.html
http://localhost:3000/client/project-detail.html?id=xxx
http://localhost:3000/client/my-custom-products.html
```

### 專家後台
```
http://localhost:3000/expert/dashboard.html
http://localhost:3000/expert/my-listings.html
http://localhost:3000/expert/matched-projects.html
```

---

## 🔄 導航選單整理

### 一般用戶（已登入）
- 首頁
- 服務媒合
- **專家功能** 下拉
  - 專家控制台
  - 我的報價
  - 媒合專案
- **發案功能** 下拉
  - 發案控制台
  - 我的專案
- **客製產品** 下拉
  - 建立新產品
  - 我的客製產品
- 聯絡我們

### 管理員（額外顯示）
- **管理功能** 下拉 ⭐
  - 用戶管理
  - 分類管理
  - 分類圖片管理

---

## 🔄 專案生命週期與狀態

1. **草稿階段 (Draft)**: 首頁生成 -> 儲存至「我的專案」編輯中分頁。
2. **細修階段 (Editing)**: 透過列表展開或進入「專案詳情」修改描述、動態欄位、工項。
3. **預媒合測試 (Pre-match)**: 詳情頁一鍵查看潛在專家數量，確認市場規模。
4. **發佈階段 (Published)**: 點擊發佈，狀態轉為 `published`，正式進入媒合引擎。

---

## ⚠️ 注意事項

1. **管理員頁面必須檢查權限**
   ```javascript
   const isAdmin = await AuthService.isAdmin();
   if (!isAdmin) {
       alert('⚠️ 您沒有權限訪問此頁面');
       window.location.href = '/';
       return;
   }
   ```

2. **客戶/專家頁面只需檢查登入**
   ```javascript
   const user = await AuthService.getCurrentUser();
   if (!user) {
       window.location.href = '/login.html';
       return;
   }
   ```

3. **雙重身份用戶**
   - 所有用戶都可以同時發案和接案
   - 不需要切換角色
   - 導航選單會同時顯示兩邊功能

---

## 📂 分類資料表（主分類 / 子分類獨立）

- **ai_categories**：僅存放**主分類**（key, name, prompt, image_url, updated_at）
- **ai_subcategories**：**子分類**獨立表（key, name, category_key → ai_categories.key, form_config, sort_order 等）
- 遷移腳本：`docs/migrate-categories-split.sql`（將既有 ai_categories 中的子分類搬至 ai_subcategories）
- 表結構定義：`docs/ai-subcategories-schema.sql`

### 子分類預設填寫欄位（form_config）

- 每個子分類的 **form_config**（JSONB 陣列）定義專案詳情頁的必填/選填欄位。
- 欄位格式：`name`, `label`, `type`（text/number/textarea/select）, `required`, `unit`, `placeholder`, `options`。
- 說明與範例：`docs/subcategory-default-fields.md`
- 寫入通用預設（需求說明、預算範圍）：執行 `docs/seed-subcategory-form-config.sql`
- **居家分類專用**：所有 20 個居家子分類各有 3 個必問問題（詳見 `docs/home-subcategory-form-fields.json`），執行 `docs/seed-home-subcategory-fields.sql` 導入。
- **後台管理**：在 `admin/categories.html` 點選「設定」按鈕，可為每個子分類編輯 form_config（新增/刪除欄位、設定類型、必填等）。

---

## 🏠 首頁 AI 估價與專案詳情

### 首頁檔案位置
- **主要首頁**：`public/iStudio-1.0.0/index.html`（使用 iStudio 模板）
- 對應 JS：`public/iStudio-1.0.0/js/main.js`

### 子分類選擇
- **首頁子分類**：標籤顯示「子分類」（已移除括號說明文字）。
- **必選**：至少選一個，可複選；未選時送出會提示「請至少選擇一個子分類」。
- **預設選項**：切換大分類後，自動選該大分類的第一個子分類。
- **專案詳情（project-detail.html）**：
  - 「專案詳細描述」區塊下方會顯示**本專案必填欄位**說明（依所選子分類的 form_config 動態列出）。
  - 「分類專屬需求」區塊為動態欄位表單（依子分類 form_config 渲染），支援 text、number、textarea、select；必填欄位以紅色 * 標示。
  - **首頁建立專案時**：已選擇的子分類會存入 `projects.subcategory` 欄位（JSONB 陣列），專案詳情頁載入時自動讀取並顯示對應的必填欄位。

---

## 📊 已完成狀態

### 管理員後台
- ✅ index.html - 管理員控制台
- ✅ user-management.html - 用戶管理
- ✅ categories.html - 分類管理
- ✅ category-images.html - 分類圖片管理

### 客戶後台
- ✅ dashboard.html - 發案控制台
- ✅ my-projects.html - 我的專案
- ✅ project-detail.html - 專案詳情
- ⏳ project-items.html - 分包項目管理（待建立）
- ✅ my-custom-products.html - 客製產品

### 專家後台
- ✅ dashboard.html - 專家控制台
- ✅ my-listings.html - 我的報價
- ✅ matched-projects.html - 媒合專案
- ⏳ listing-detail.html - 報價詳情（待建立）
