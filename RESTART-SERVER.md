# 🔄 重啟伺服器說明

## 為什麼需要重啟？

server.js 新增了 API 端點 `/api/subcategories`，必須重啟伺服器才能生效。

## 重啟步驟

### 1. 停止當前伺服器
在運行 `node server.js` 的終端（命令提示字元或 PowerShell）：
- 按 `Ctrl + C` 停止

### 2. 重新啟動
```bash
node server.js
```

### 3. 確認啟動成功
應該看到：
```
Server running on http://localhost:3000
```

## 測試 API 是否生效

重啟後，在瀏覽器 Console 執行：
```javascript
fetch('/api/subcategories?category_key=home')
  .then(res => res.json())
  .then(data => console.log('API 測試:', data));
```

應該看到：
```json
{
  "success": true,
  "subcategories": [
    {
      "key": "home__清潔服務",
      "name": "清潔服務",
      "form_config": [
        {"name": "area", "label": "施作坪數", ...},
        ...
      ]
    },
    ...
  ]
}
```

## 如果還是 404

1. **確認 server.js 已保存**
2. **確認終端沒有錯誤訊息**
3. **清除瀏覽器快取**（Ctrl+Shift+Delete）
4. **使用無痕模式**訪問

## 完整測試流程

1. ✅ 停止伺服器（Ctrl+C）
2. ✅ 重啟伺服器（node server.js）
3. ✅ 清除快取
4. ✅ 訪問 http://localhost:3000/index.html
5. ✅ 選擇「居家」大分類
6. ✅ 應該看到 3 個必填欄位

---

**注意**：每次修改 server.js、任何 .js 後端檔案後，都需要重啟伺服器！
