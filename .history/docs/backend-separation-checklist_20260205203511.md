# MatchDO 後台分離檢查清單

## ✅ 已完成

### 📂 目錄結構
- [x] 建立 `/admin/` 管理員後台目錄
- [x] 建立 `/client/` 客戶後台目錄  
- [x] 建立 `/expert/` 專家後台目錄（已有部分檔案）
- [x] 建立導航配置檔案 `site-navigation.js`
- [x] 建立共用 header 組件
- [x] 建立管理員專用 header 組件

### 🗄️ 資料庫
- [x] 建立 `ai-categories-schema.sql` 資料表定義
- [x] 建立 `project-cover-image-schema.sql` 封面圖系統
- [x] RLS 政策規劃（管理員可寫，所有人可讀）

### 🎨 功能實作
- [x] 三層圖片系統（預設/上傳/AI生成）
- [x] 分類圖片管理介面
- [x] AI 生成隱私保護選項
- [x] AuthService.isAdmin() 權限檢查

---

## ⏳ 待完成

### 1. **資料庫執行** 🔴 重要
```bash
# 請在 Supabase SQL Editor 執行以下檔案：
1. docs/ai-categories-schema.sql
2. docs/project-cover-image-schema.sql
```

**驗證方式：**
```sql
-- 檢查表是否存在
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('ai_categories', 'projects');

-- 檢查 projects 表是否有新欄位
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'projects' 
AND column_name LIKE 'cover_image%';
```

---

### 2. **Storage Bucket 建立** 🔴 重要
前往 Supabase > Storage > 建立新 Bucket：
- **Bucket 名稱**: `project-images`
- **Public**: ✅ 啟用（讓圖片可公開訪問）
- **檔案大小限制**: 500KB
- **允許的檔案類型**: `image/jpeg, image/png, image/gif, image/svg+xml`

**建立資料夾結構：**
```
project-images/
├── categories/     （分類圖片）
└── projects/       （專案圖片）
```

---

### 3. **更新所有頁面 Header** 🟡 中優先

#### 管理員後台頁面（使用 admin-header.html）
- [ ] admin/index.html
- [ ] admin/user-management.html
- [ ] admin/categories.html
- [ ] admin/category-images.html

**替換方式：**
```html
<!-- 舊的 Header（移除） -->
<nav class="navbar...">...</nav>

<!-- 新的 Header（引入） -->
<div id="adminHeader"></div>
<script>
fetch('/admin/components/admin-header.html')
    .then(r => r.text())
    .then(html => document.getElementById('adminHeader').innerHTML = html);
</script>
```

#### 客戶後台頁面（使用 site-header.html）
- [ ] client/dashboard.html
- [ ] client/my-projects.html
- [ ] client/project-detail.html
- [ ] client/my-custom-products.html

**替換方式：**
```html
<!-- 引入依賴 -->
<script src="/config/auth-config.js"></script>
<script src="/config/site-navigation.js"></script>

<!-- 引入 Header -->
<div id="siteHeader"></div>
<script>
fetch('/components/site-header.html')
    .then(r => r.text())
    .then(html => document.getElementById('siteHeader').innerHTML = html);
</script>
```

---

### 4. **路徑清理** 🟢 低優先

#### 移除 `/iStudio-1.0.0/` 前綴
檔案清理：
- [ ] 檢查所有 HTML 中的 breadcrumb
- [ ] 檢查所有 `href` 和 `src` 連結
- [ ] 確保管理員連結都是 `/admin/`
- [ ] 確保客戶連結都是 `/client/`

**搜尋方式：**
```bash
# 在專案中搜尋 iStudio-1.0.0
grep -r "iStudio-1.0.0" --include="*.html" --include="*.js"
```

---

### 5. **權限保護加強** 🟡 中優先

#### 所有管理員頁面加上保護
在 `<script>` 開頭加入：
```javascript
document.addEventListener('DOMContentLoaded', async () => {
    // 檢查登入
    const user = await AuthService.getCurrentUser();
    if (!user) {
        alert('請先登入');
        window.location.href = '/login.html';
        return;
    }
    
    // 檢查管理員權限
    const isAdmin = await AuthService.isAdmin();
    if (!isAdmin) {
        alert('⚠️ 您沒有權限訪問此頁面');
        window.location.href = '/';
        return;
    }
    
    // 繼續載入頁面...
});
```

#### 所有客戶/專家頁面檢查登入
```javascript
document.addEventListener('DOMContentLoaded', async () => {
    const user = await AuthService.getCurrentUser();
    if (!user) {
        window.location.href = '/login.html';
        return;
    }
    
    // 繼續載入頁面...
});
```

---

### 6. **測試清單** 🔵 最後執行

#### 管理員後台測試
- [ ] 用管理員帳號登入
- [ ] 訪問 `/admin/index.html` - 應該成功
- [ ] 訪問 `/admin/category-images.html` - 應該能載入分類
- [ ] 上傳分類圖片 - 應該成功儲存
- [ ] 用一般用戶登入，訪問管理後台 - 應該被擋下

#### 客戶後台測試
- [ ] 用任何帳號登入
- [ ] 訪問 `/client/dashboard.html` - 應該成功
- [ ] 訪問 `/client/my-projects.html` - 應該顯示自己的專案
- [ ] 開啟專案詳情 - 封面圖應該正常顯示
- [ ] 上傳專案封面 - 應該成功

#### 導航測試
- [ ] 未登入：只顯示「登入」「註冊」
- [ ] 一般用戶：顯示「我的專案」「專家服務」
- [ ] 管理員：額外顯示紅色的「管理功能」下拉

---

## 🐛 已知問題

### 1. category-images.html 的 400 錯誤
**原因**: ai_categories 表可能不存在或 RLS 政策阻擋

**解決方式**:
1. 執行 `docs/ai-categories-schema.sql`
2. 確認 profiles 表中你的帳號 `role = 'admin'`
3. 重新整理頁面

**驗證指令**:
```sql
-- 檢查你的權限
SELECT id, email, role FROM profiles WHERE email = 'liutsaiiu@gmail.com';

-- 應該顯示 role = 'admin'
```

---

## 📝 下一步建議

1. **立即執行（最高優先）**:
   - 執行兩個 SQL 檔案
   - 建立 Storage Bucket
   - 測試 category-images.html 是否正常

2. **短期目標（本週）**:
   - 更新所有頁面的 header
   - 清理 `/iStudio-1.0.0/` 路徑
   - 加強權限保護

3. **中期目標（下週）**:
   - 完整測試所有功能
   - 建立使用者手冊
   - 準備正式上線

---

## 🎯 成功標準

當以下全部達成，後台分離即完成：

- ✅ 管理員訪問 `/admin/` 目錄正常，一般用戶被擋下
- ✅ 所有頁面使用統一的導航系統
- ✅ 沒有任何 `/iStudio-1.0.0/` 路徑出現在管理員後台
- ✅ 分類圖片管理功能正常運作
- ✅ 專案封面圖三層系統正常運作
- ✅ 所有 SQL 表和 Storage 都已建立
