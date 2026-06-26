# ⚠️ 常見問題檢查清單 - 無限旋轉問題

## 🔄 症狀：頁面一直旋轉/載入
當頁面中的 spinner 一直轉不停時，請按照以下步驟檢查：

---

## ✅ 檢查清單

### 1. 檢查 Console 錯誤 ⭐⭐⭐ **最重要**
```
按 F12 → Console 標籤 → 查看紅色錯誤訊息
```

常見錯誤：
- ❌ `404 (Not Found)` → 檔案不存在
- ❌ `auth-service.js net::ERR_ABORTED` → 認證服務檔案遺失
- ❌ `relation "xxx" does not exist` → 資料表未建立
- ❌ `ReferenceError: xxx is not defined` → 變數未定義

---

### 2. 確認必要檔案存在

#### 2.1 認證服務
```
✅ js/auth-service.js （必須）
```

#### 2.2 配置檔案
```
✅ config/auth-config.js （如果使用）
```

#### 2.3 檢查方法
在 PowerShell 執行：
```powershell
Test-Path "d:\AI建站\ai-matching\js\auth-service.js"
Test-Path "d:\AI建站\ai-matching\config\auth-config.js"
```

---

### 3. 確認資料表已建立

執行 SQL 檢查：
```sql
-- 在 Supabase SQL Editor 執行
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';
```

必要的表：
- ✅ profiles
- ✅ projects
- ✅ project_items
- ✅ matches
- ✅ contact_unlocks
- ✅ notifications

---

### 4. 檢查錯誤處理

每個 async 函數都必須有錯誤處理：

#### ❌ 錯誤寫法（會無限旋轉）
```javascript
async function loadData() {
    const { data, error } = await supabase.from('xxx').select('*');
    if (error) throw error; // ← 拋出錯誤但沒人接住
    // ... 處理資料
}
```

#### ✅ 正確寫法
```javascript
async function loadData() {
    const container = document.getElementById('xxx');
    try {
        const { data, error } = await supabase.from('xxx').select('*');
        
        if (error) {
            console.error('載入失敗:', error);
            container.innerHTML = `<div class="text-danger">載入失敗: ${error.message}</div>`;
            return; // ← 停止旋轉
        }
        
        // ... 處理資料
    } catch (err) {
        console.error('系統錯誤:', err);
        container.innerHTML = `<div class="text-danger">系統錯誤</div>`;
    }
}
```

---

### 5. 檢查 Spinner 停止邏輯

#### 方法 A：直接替換 HTML
```javascript
container.innerHTML = `<div>資料內容</div>`; // ✅ 自動移除 spinner
```

#### 方法 B：明確移除 spinner
```javascript
const spinner = container.querySelector('.spinner-border');
if (spinner) spinner.remove();
```

---

### 6. 強制重新整理

修改後必須清除瀏覽器快取：
```
Ctrl + Shift + R （Windows/Linux）
Cmd + Shift + R （Mac）
```

或開啟無痕模式測試。

---

### 7. 伺服器重啟

修改 JS 檔案後重啟：
```powershell
Get-Process node | Stop-Process -Force
npm start
```

---

## 🔧 快速修復模板

### 完整的資料載入範例
```javascript
async function loadSomething() {
    const container = document.getElementById('container');
    
    try {
        // 1. 查詢資料
        const { data, error } = await supabase
            .from('table_name')
            .select('*')
            .eq('user_id', currentUser.id);

        // 2. 處理查詢錯誤
        if (error) {
            console.error('查詢錯誤:', error);
            container.innerHTML = `
                <div class="empty-state">
                    <i class="bi bi-exclamation-triangle text-warning"></i>
                    <p>無法載入資料</p>
                    <small class="text-danger">${error.message}</small>
                </div>
            `;
            return; // ← 停止執行
        }

        // 3. 處理空資料
        if (!data || data.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="bi bi-inbox"></i>
                    <p>尚無資料</p>
                </div>
            `;
            return; // ← 停止執行
        }

        // 4. 顯示資料
        container.innerHTML = data.map(item => `
            <div>${item.name}</div>
        `).join('');
        
    } catch (err) {
        // 5. 處理系統錯誤
        console.error('系統錯誤:', err);
        container.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-exclamation-circle text-danger"></i>
                <p>系統錯誤</p>
                <small>${err.message}</small>
            </div>
        `;
    }
}
```

---

## 📋 問題排查流程圖

```
頁面一直旋轉
    ↓
按 F12 檢查 Console
    ↓
有紅色錯誤？
    ├─ Yes → 
    │   ├─ 404 錯誤 → 檔案不存在，建立檔案
    │   ├─ relation not exist → 資料表未建立，執行 SQL
    │   └─ 其他錯誤 → 修正程式碼
    │
    └─ No →
        ├─ 檢查網路請求（Network 標籤）
        ├─ 檢查 Supabase 連線
        └─ 檢查 RLS 權限設定
```

---

## 🚨 預防措施

### 1. 每次建立新頁面都要：
- ✅ 檢查引用的 JS 檔案是否存在
- ✅ 確認資料表已建立
- ✅ 加入完整的錯誤處理
- ✅ 測試空資料狀態
- ✅ 測試錯誤狀態

### 2. 使用範本程式碼
不要從頭寫，複製已驗證的範本修改。

### 3. 逐步測試
先確保一個功能正常，再加下一個功能。

---

## 📝 本次問題記錄

**日期**: 2026-02-05  
**問題**: client/dashboard.html 一直旋轉  
**原因**: `js/auth-service.js` 檔案不存在  
**解決**: 建立 auth-service.js 檔案  
**教訓**: 每次引用新檔案前，先確認檔案存在  

---

## 🔍 除錯指令集

```powershell
# 檢查檔案是否存在
Test-Path "d:\AI建站\ai-matching\js\auth-service.js"

# 列出目錄內容
Get-ChildItem "d:\AI建站\ai-matching\js"

# 重啟伺服器
Get-Process node | Stop-Process -Force; npm start

# 檢查伺服器是否運行
Get-Process node

# 測試 API
curl http://localhost:3000/client/dashboard.html
```

---

最後更新: 2026-02-05
