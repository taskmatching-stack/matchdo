# ~~Cloudflare Worker 轉發 Sitemap~~ — 已驗證：無法解決 GSC 提交

> **狀態**：❌ **不可行**（2026-07-22 實測）  
> **請改看**：`docs/gsc-sitemap-troubleshooting.md`

---

## 當初目的

Google Search Console 對 `https://matchdo.cc/sitemap.xml` 顯示「無法讀取」，想透過 Cloudflare Worker 轉發 sitemap 內容。

## 實測結果

| 項目 | 結果 |
|------|------|
| Worker 部署 | ✅ `matchdo-sitemap.taskmatching.workers.dev` |
| 轉發 ` /sitemap.xml` | ✅ 內容與 matchdo.cc 一致 |
| **GSC 提交** `https://matchdo-sitemap.taskmatching.workers.dev/sitemap.xml` | ❌ **Sitemap 位址無效** |

**原因**：GSC 資源為 `sc-domain:matchdo.cc`，**不接受其他網域**（含 `*.workers.dev`）的 sitemap URL。

## 結論

Worker 轉發**不能**作為 GSC 手動提交的替代方案。  
本站應依 **`robots.txt` 自動發現** + **個別 URL 要求索引** 策略，見 `docs/gsc-sitemap-troubleshooting.md`。

---

## 保留：Worker 程式碼（僅供參考，非現行方案）

```javascript
export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/sitemap.xml' || url.pathname.startsWith('/sitemap-')) {
      const response = await fetch(`https://matchdo.cc${url.pathname}`, {
        cf: { cacheTtl: 0 }
      });
      return new Response(await response.text(), {
        status: 200,
        headers: { 'Content-Type': 'application/xml; charset=utf-8' }
      });
    }
    return new Response('Sitemap proxy for matchdo.cc', { status: 200 });
  }
};
```
