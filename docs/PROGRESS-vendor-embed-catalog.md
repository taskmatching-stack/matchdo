# 廠商產品卡片 iframe 嵌入 — 進度與評估（2026-06-26）

> 外部官網嵌入**產品卡片牆**，訪客選款後以深連結**跳回 Matchdo 全頁**試做／生圖（不在 iframe 內生成）。  
> 關聯：[`PROGRESS-vendor-asset-share-links.md`](PROGRESS-vendor-asset-share-links.md)、[`vendor-product-link-tree-ui-plan.md`](vendor-product-link-tree-ui-plan.md)

---

## 產品方向（已定案）

1. **嵌入內容**：公開數位原型卡片（縮圖、標題、工藝 badge、CTA）。
2. **選款後**：`target="_top"` 開啟既有試做 URL（`custom-product.html?prototype_asset_id=`）或搭配導覽（`product-tree.html`）。
3. **不做**：iframe 內生圖、登入、點數扣款。

---

## 已實作

| 項目 | 位置 |
|------|------|
| Embed 卡片頁 | [`public/embed/vendor-catalog.html`](../public/embed/vendor-catalog.html) |
| iframe 包裝測試頁 | [`public/embed/preview.html`](../public/embed/preview.html) |
| CSP `frame-ancestors *` | [`server.js`](../server.js) `GET /embed/vendor-catalog.html`、`/embed/preview.html` |
| 共用 helper | [`public/js/vendor-asset-share-urls.js`](../public/js/vendor-asset-share-urls.js) — `buildEmbedIframeSnippet`、`appendEmbedUtm` |
| 後台複製嵌入碼 | [`public/client/manufacturer-dashboard.html`](../public/client/manufacturer-dashboard.html)「官網嵌入產品卡片」區塊 |

### URL 規格

```text
/embed/vendor-catalog.html?manufacturer_id={uuid}
```

可選：

- `catalog_group_id={uuid}` — 預選分類（頁內 pill 可切換）
- `lang=en` — 英文介面

試做／導覽 CTA 自動加 UTM：`utm_source=embed&utm_medium=vendor_site`

### 嵌入碼範例

```html
<iframe
  src="https://matchdo.cc/embed/vendor-catalog.html?manufacturer_id={uuid}"
  width="100%"
  height="640"
  style="border:0;"
  loading="lazy"
  title="Matchdo 數位原型試做">
</iframe>
```

---

## iframe 適合度評估（結論）

**結論：適合 — 採「卡片 embed + 外跳生成」模式。**

| 面向 | 評估 |
|------|------|
| 登入／點數 | 生圖在 Matchdo 全頁，iframe 內無 Supabase 第三方 cookie 問題 |
| 頁面重量 | 輕量列表 + lazy 圖，適合固定高度 iframe |
| 跳出行為 | 所有 CTA 使用 `target="_top"`，可正確離開官網 iframe |
| 公開素材 gating | 沿用 `GET /api/vendor-assets?for_profile=1&asset_kind=prototype`，僅 `is_public` 且廠商 eligible |
| SEO | embed 頁 `noindex`；不進 sitemap |

### 高度策略

- **初版**：建議 iframe `height="640"`（後台預設嵌入碼已採用）。
- 卡片多時 iframe 內可垂直捲動（`embed-shell` min-height 480px）。
- **進階（未做）**：`postMessage` 向父頁回報內容高度，自動調整 iframe。

### CMS 相容性（預期）

| 平台 | 預期 |
|------|------|
| 純 HTML / 自建站 | 直接貼 iframe 即可 |
| WordPress | 自訂 HTML 區塊可貼；部分主題需允許 iframe |
| Wix / Squarespace | 通常支援 embed / HTML 元件 |
| 阻擋 iframe 的 CMS | 備案：沿用單款「複製試做連結」或 QR（見 share-links doc） |

### 安全

- 僅 `/embed/*` 回應 `Content-Security-Policy: frame-ancestors *`。
- 其餘頁面維持現狀（未全域 `DENY`，避免影響未盤點頁面）。
- 域名白名單列 **Phase 4**（若日後需限制僅廠商官網可嵌）。

---

## 驗收方式

1. 開啟 `/embed/preview.html?manufacturer_id={uuid}` 模擬官網。
2. 確認卡片僅顯示公開原型；320px～1280px RWD 可讀。
3. 點「用此款試做」→ 頂層跳至 `custom-product.html` 且已鎖定原型。
4. 有材配關聯時「看可搭配」→ `product-tree.html`。
5. 後台控制台 → 複製嵌入碼 → 貼至測試 HTML 頁驗證。

Build 標記：`window.__MATCHDO_EMBED_CATALOG_BUILD = vendor-embed-catalog-20260626`

---

## 待做（可選）

- [ ] `postMessage` 自動 iframe 高度
- [ ] 廠商官網域名白名單（`frame-ancestors` 限域）
- [ ] GA4 事件：`embed_cta_click`（目前僅 UTM）

---

## 刻意不做

- iframe 內 FLUX 生圖
- 材料／配件 embed 牆（首版僅 prototype）
- embed 頁進 sitemap
