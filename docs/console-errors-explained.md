# 主控台錯誤說明與處理

## 1. Image corrupt or truncated（圖片損壞或截斷）

**現象**：例如 `1772661886612-aa53491d21856.png`、`1772466505591-166ff128d4fe7.jpg` 等檔名出現「Image corrupt or truncated」。

**可能原因**：
- 上傳時網路中斷或逾時，檔案未完整寫入 Supabase Storage。
- 儲存時寫入不完整或檔案被覆寫。
- CDN/網路傳輸中斷，回應被截斷（較少見）。

**建議**：
- **已發生的檔案**：在後台找到對應作品，重新上傳該張圖片並儲存。
- **預防**：上傳 API 已使用 `multer.memoryStorage()` 完整讀取後再傳到 Supabase；若仍出現，可考慮在上傳前做簡單驗證（例如 JPEG/PNG magic bytes、最小長度），並在後端寫入後比對長度或做 HEAD 檢查（可選實作）。

---

## 2. -webkit-text-size-adjust / -moz-*（Bootstrap CSS 解析警告）

**現象**：  
- `分析「-webkit-text-size-adjust」的值時發生錯誤。 中斷宣告。`（bootstrap.min.css）  
- `未知的 pseudo-class 或 pseudo-element「-moz-focus-inner」`、`-moz-focus-outer`、`-moz-placeholder-shown` 等，並「由於有錯誤的選擇器所以略過規則組」。

**原因**：  
Bootstrap 的 CSS 內含 **-webkit-**、**-moz-** 等前綴，用於舊版瀏覽器相容。部分瀏覽器（例如 **Opera**）或嚴格 CSS 解析器不認識這些寫法，會報警告並略過該規則，**不影響版面與功能**。

**建議**：  
**可安全忽略**。若希望主控台較乾淨，可改為使用本機 Bootstrap 並以建置步驟移除這些規則（較麻煩），或改用較新版本 Bootstrap CDN（不一定會消失）。

---

## 3. Auth 狀態變化: INITIAL_SESSION

**現象**：  
主控台出現 `Auth 狀態變化: INITIAL_SESSION`（來自 auth-middleware.js）。

**說明**：  
這是 **正常日誌**，表示 Auth 初始化時觸發了一次 session 狀態回調，**不是錯誤**，可忽略。

---

## 4. 由於來自無效網域，已拒絕 Cookie「__cf_bm」

**現象**：  
載入圖片時（例如 `1772460530202-6fa47e0356cde.jpg`）出現「由於來自無效網域，已拒絕 Cookie「__cf_bm」」。

**原因**：  
圖片來自 **Supabase Storage**（或前方 CDN，如 Cloudflare）。該網域在回應中會設定 `__cf_bm`（Cloudflare Bot Management）等 Cookie。  
當頁面在 **localhost** 或 **matchdo 主網域**，而圖片在 **另一網域**（例如 `xxx.supabase.co`）時，瀏覽器依同站/跨站政策拒絕寫入該 Cookie，屬於正常安全行為。

**影響**：  
圖片通常仍可正常顯示；只是該跨站 Cookie 被拒絕，主控台會出現警告。

**若要消除此警告（可選）**：  
- 後端已提供 **圖片代理**：`GET /api/proxy-image?url=<encodeURIComponent(圖片網址)>`。僅接受 `SUPABASE_URL` 同源的網址（白名單），由伺服器向 Supabase 取圖後以同源回應，瀏覽器不再向儲存網域發請求，故不會出現 __cf_bm 拒絕。  
- 前端若改為使用代理網址（例如 `'/api/proxy-image?url=' + encodeURIComponent(imageUrl)`）顯示媒體牆等圖片，即可消除此類主控台訊息；代價是圖片流量會經由自家伺服器轉發。

---

## 總結

| 類型           | 是否影響功能 | 建議 |
|----------------|--------------|------|
| 圖片損壞/截斷  | 是，該圖無法顯示 | 重新上傳該圖；可選：上傳驗證與寫入後檢查 |
| Bootstrap/CSS 解析警告 | 否 | 可安全忽略（多見於 Opera） |
| Auth INITIAL_SESSION   | 否（正常日誌） | 可忽略 |
| __cf_bm 拒絕   | 否（圖仍可載入） | 可忽略，或實作同源圖片代理 |
