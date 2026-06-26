# 子分類圖片上傳功能完整實作指南

## 步驟 1：升級資料庫格式

在 Supabase SQL Editor 執行 `docs/upgrade-subcategories-format.sql`

這會將 subcategories 從：
```json
["清潔服務", "家電 燈具"]
```

改成：
```json
[
  {"name": "清潔服務", "image_url": null},
  {"name": "家電 燈具", "image_url": "https://..."}
]
```

## 步驟 2：修改前端代碼

我已經準備好完整的修改檔案，請執行以下PowerShell指令：

```powershell
# 備份當前檔案
Copy-Item "d:\AI建站\ai-matching\admin\category-images.html" "d:\AI建站\ai-matching\admin\category-images.html.backup"

# 下載更新後的檔案（我會提供完整檔案）
```

或者，我可以直接為你重寫這個檔案，完整支援子分類圖片上傳。

你希望我：
1. 提供完整的新檔案
2. 還是繼續修補現有檔案？

請告訴我你的選擇。
