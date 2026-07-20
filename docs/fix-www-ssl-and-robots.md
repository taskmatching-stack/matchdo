# 修復 www SSL 與 robots.txt 問題

## 問題 1：www.matchdo.cc SSL handshake failure

### 現況
- `https://matchdo.cc` ✅ 正常（200 OK）
- `https://www.matchdo.cc` ❌ SSL handshake failure

### 影響
1. Google Search Console 若註冊為**網域資源**（`matchdo.cc`），會同時驗證 www 與非 www
2. SSL 失敗可能導致 Google 認為網站配置不一致

### 修復方式（Cloud Run）

#### 檢查目前 Domain Mapping
```bash
gcloud run domain-mappings list --region=asia-northeast1
```

#### 新增 www 子網域（如果未設定）
```bash
gcloud run domain-mappings create \
  --service=matchdo \
  --domain=www.matchdo.cc \
  --region=asia-northeast1
```

#### 驗證 DNS 記錄
確保您的 DNS（Namecheap/Cloudflare 等）有以下記錄：

**方法 A：CNAME（推薦）**
```
Type: CNAME
Name: www
Value: ghs.googlehosted.com.
TTL: 自動
```

**方法 B：A 記錄（如果 CNAME 不支援）**
```
Type: A
Name: www
Value: 216.239.32.21
      216.239.34.21
      216.239.36.21
      216.239.38.21
```

#### 等待 SSL 憑證自動簽發
Cloud Run 會自動為 www.matchdo.cc 簽發 SSL 憑證（約 15-60 分鐘）

---

## 問題 2：robots.txt 路由 vs 靜態檔案

### 現況
- `routes/sitemap.js` 第 248 行定義了 `GET /robots.txt` 路由
- 但 `public/robots.txt` **不存在**（404）
- 路由會正確回應，但若 `public/` 靜態優先，可能被遮蔽

### 目前實作（正確）
```javascript
// routes/sitemap.js 第 248-254 行
app.get('/robots.txt', (req, res) => {
    const base = siteBase();
    const body = 'User-agent: *\nDisallow: /admin/\nDisallow: /api/\nDisallow: /payment/\nAllow: /\n\nSitemap: ' + base + '/sitemap.xml\n';
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(body);
});
```

### 檢查掛載順序（server.js）
```javascript
// 第 4678 行：sitemap 路由（須在 static 之前）
registerSitemapRoutes(app, { supabase, BASE_URL });

// 第 8581 行：靜態檔案
app.use(express.static(path.join(__dirname, 'public')));
```

✅ **順序正確**：sitemap 路由在 `express.static` 之前，所以動態 robots.txt 會優先

### 驗證
```bash
# 測試 robots.txt（應顯示 Sitemap: https://matchdo.cc/sitemap.xml）
curl -A "Googlebot" https://matchdo.cc/robots.txt
```

**預期輸出：**
```
User-agent: *
Disallow: /admin/
Disallow: /api/
Disallow: /payment/
Allow: /

Sitemap: https://matchdo.cc/sitemap.xml
```

---

## 優先修復順序

1. **立即執行**：`docs/fix-sitemap-categories-rls.sql`（修復 RLS 政策）
2. **驗證**：`https://matchdo.cc/sitemap-categories.xml`（應顯示分類 URL）
3. **Search Console**：重新提交 sitemap（見下方步驟）
4. **選擇性**：修復 www SSL（如果 GSC 是網域資源）

---

## Google Search Console 操作步驟

### Step 1：驗證 sitemap 已修復
1. 開啟：`https://matchdo.cc/sitemap-categories.xml`
2. 應顯示類似：
   ```xml
   <url><loc>https://matchdo.cc/?category_key=home</loc>...
   <url><loc>https://matchdo.cc/?category_key=pet</loc>...
   ```

### Step 2：URL 檢查工具（Live Test）
1. GSC → **URL 檢查**
2. 輸入：`https://matchdo.cc/sitemap.xml`
3. 點擊「**測試線上網址**」
4. 等待結果（應顯示「可建立索引」）

### Step 3：重新提交 sitemap
1. GSC → **Sitemap**（左側選單）
2. **刪除**舊的 `https://matchdo.cc/sitemap.xml` 提交記錄
3. **新增**：`https://matchdo.cc/sitemap.xml`
4. 點擊「提交」

### Step 4：等待 Google 重新抓取
- 通常 1-3 天內會更新狀態
- 若 3 天後仍失敗，檢查「**涵蓋範圍**」報告中的錯誤訊息

---

## 補充：如果 ai_categories 是空的

執行完 RLS 政策後，若 `SELECT COUNT(*) FROM ai_categories` 回傳 0：

### 方法 1（推薦）：從網站後台匯入
1. 登入 Admin：`https://matchdo.cc/admin/`
2. 左側選單 → **分類管理**
3. 點擊「**一鍵匯入預設分類**」

### 方法 2：手動 API 呼叫
```bash
# 取得 admin token（從瀏覽器 DevTools → Application → Cookies → sb-*-auth-token）
curl -X POST https://matchdo.cc/api/categories/import-default \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

### 方法 3：直接 SQL（參考 default-categories.json 完整內容）
```sql
-- 手動插入（僅範例，完整資料見 public/config/default-categories.json）
INSERT INTO public.ai_categories (key, name, prompt, sort_order) VALUES
('home', '居家', '你是專業居家裝修與維修估算師...', 0),
('pet', '寵物', '你是專業寵物服務顧問...', 1)
ON CONFLICT (key) DO NOTHING;
```
