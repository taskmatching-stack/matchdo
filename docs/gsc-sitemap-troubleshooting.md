# Google Search Console：Sitemap「無法讀取」— 已查證紀錄

> **最後更新**：2026-07-22  
> **網域**：https://matchdo.cc  
> **GSC 資源**：`sc-domain:matchdo.cc`（網域資源，僅此一個，無 URL 前綴資源可切換）  
> **部署**：Google Cloud Run（asia-northeast1）

---

## 結論（給 Agent／協作者）

**Sitemap 檔案本身沒問題。** GSC「Sitemap 報告」的手動提交介面對本站目前**無法正常接受／顯示成功**，已反覆驗證至少四次（含 2026-07-20、2026-07-22）。

**不要再叫使用者：**
- 刪除後重提 `sitemap.xml` 或 `https://matchdo.cc/sitemap.xml`
- 「等 1～2 天／7～10 天再試提交」
- 用 Cloudflare Worker 轉發後在 GSC 提交 `*.workers.dev/sitemap.xml`（跨網域，GSC 拒絕）
- 把「網址檢查 sitemap.xml → 未編入索引」當成故障（sitemap 本來就不是要索引的頁面）

**正確做法：**
1. 維持 `robots.txt` 內的 `Sitemap: https://matchdo.cc/sitemap.xml`（已設定）
2. **不要**再糾結 GSC Sitemap 報告狀態；改看 **「網頁索引」／覆蓋率**、`site:matchdo.cc`、個別重要 URL 的「要求建立索引」
3. 持續補內容品質與可索引公開頁（Google 官方亦說明：檢索需求量偏低時 Sitemap 可能長期顯示異常）

---

## 已驗證：Sitemap 技術面正常

| 檢查項 | 結果 |
|--------|------|
| `GET https://matchdo.cc/sitemap.xml` | **200**，約 0.1s |
| XML 格式 | 有效 `sitemapindex`，namespace 正確 |
| `<loc>` 網址 | 皆為 **絕對 URL** `https://matchdo.cc/...` |
| `Content-Type` | `application/xml; charset=utf-8` |
| `robots.txt` | 含 `Sitemap: https://matchdo.cc/sitemap.xml`，未 Disallow sitemap |
| Googlebot UA 模擬 | 200，內容正確 |
| 子 sitemap（pages / categories / vendors / collections / inspiration） | 皆可 200 開啟 |

實作：`routes/sitemap.js`（在 `express.static` **之前**掛載，見 `server.js`）。

---

## 已驗證：GSC 手動提交全部失敗

### 嘗試過的提交方式（皆無效）

| 提交內容 | GSC 反應 |
|----------|----------|
| `sitemap.xml`（僅檔名） | **Sitemap 位址無效** —「請輸入你網站中 Sitemap 的有效路徑」 |
| `https://matchdo.cc/sitemap.xml` | 出現在已提交列表，狀態 **無法讀取 Sitemap**（2026-07-20 起） |
| `https://matchdo.cc/`（首頁） | **無法讀取 Sitemap**（非 sitemap 路徑） |
| `https://matchdo-sitemap.taskmatching.workers.dev/sitemap.xml` | **Sitemap 位址無效**（跨網域，非 matchdo.cc 資源底下） |

### 網址檢查（URL Inspection）`https://matchdo.cc/sitemap.xml`

- 顯示「網址不在 Google 服務中／Google 無法辨識的網址」
- **這是預期行為**：sitemap 是給爬蟲讀的 XML，不是一般網頁，**不應**以「是否被索引」判斷 sitemap 好壞

---

## 已驗證無效的方案

### ❌ Cloudflare Worker 轉發

- Worker `matchdo-sitemap.taskmatching.workers.dev` 可成功轉發 `https://matchdo.cc/sitemap.xml` 內容
- **但 GSC 不接受** `*.workers.dev` 網域的 sitemap（必須與資源網域一致）
- 詳見 `docs/sitemap-cloudflare-worker-fix.md`（已標記為不可行）

### ❌ 重複提交／等待

使用者已在 **2026-07-20** 提交相同 sitemap，至 **2026-07-22** 仍「無法讀取」。再叫使用者做相同操作無意義。

---

## 目前採用的策略

### 1. robots.txt 自動發現（主要）

`robots.txt` 已宣告：

```text
Sitemap: https://matchdo.cc/sitemap.xml
```

Google 爬 `robots.txt` 時可發現 sitemap，**不依賴** GSC 手動提交。官方文件：提交 sitemap 只是提示，非唯一途徑。

### 2. 用「索引結果」驗證，不用 Sitemap 報告

| 要看的地方 | 用途 |
|------------|------|
| GSC → **網頁索引**（Pages / 涵蓋範圍） | 實際被 Google 收錄的 URL 數量 |
| 網址檢查 → **要求建立索引** | 對首頁、重要 landing、單篇 inspiration 等**個別**推送 |
| Google 搜尋 `site:matchdo.cc` | 對外可見的索引快照 |
| GSC → **成效**（Search results） | 是否開始有曝光／點擊 |

### 3. 站內 SEO 維護（持續）

- 公開頁維持 `index, follow`；工作區 `/client/*` 維持 `noindex`（見 `architecture-and-seo-principles.md`）
- `product-tree.html` 已移除 `noindex`（commit `e300622`，2026-07-22）
- 動態 sitemap 子檔由 DB 自動更新，無需手動改 XML

---

## Agent 回覆使用者時的話術（必守）

**可以說：**
- 「sitemap 檔案與 robots.txt 已確認正常；GSC 提交介面對 Cloud Run + 網域資源有已知異常，我們改看索引報告。」
- 「請在 GSC 對**重要單一 URL**（例如首頁、某篇 inspiration）用網址檢查 → 要求建立索引。」

**禁止再說：**
- 「請只填 sitemap.xml 再提交一次」
- 「請等 1～2 天 Sitemap 報告會變綠」
- 「請刪除 sitemap 後重提」
- 「請用 Cloudflare Worker 網址提交到 GSC」

---

## 相關檔案

| 檔案 | 說明 |
|------|------|
| `routes/sitemap.js` | sitemap / robots.txt 產生 |
| `docs/sitemap.md` | Sitemap 結構與收錄政策 |
| `docs/SEO-PROGRESS.md` | SEO 總進度（含本議題摘要） |
| `docs/architecture-and-seo-principles.md` | 哪些路徑可索引 |

---

## 變更紀錄

| 日期 | 紀錄 |
|------|------|
| 2026-07-20 | 使用者提交 `https://matchdo.cc/sitemap.xml`，GSC 顯示無法讀取 |
| 2026-07-22 | 再次驗證 curl／Googlebot UA／XML 均正常；`sitemap.xml` 單填仍「位址無效」；Worker 跨域提交被拒；撰寫本文件 |
