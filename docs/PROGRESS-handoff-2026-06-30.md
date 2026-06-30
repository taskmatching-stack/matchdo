# 工作區 handoff（2026-06-30）

> **給新視窗接續用**：本文件摘要本輪對話完成事項、**未推送程式**、文件位置、下一步建議。  
> Embed 專項詳見 [`PROGRESS-vendor-embed-simulator-handoff-2026-06-27.md`](PROGRESS-vendor-embed-simulator-handoff-2026-06-27.md)（已更新為 MVP 結案）。

---

## 0. 目前優先（使用者自行進行中）

- **廠商／產品資料上線**（與程式開發並行，非阻塞項）

---

## 1. 未 commit／未 push（本機有改動 · 部署前必做）

以下 4 檔在 **`main` 工作區未提交**（上次 push 被中斷）：

| 檔案 | 內容 |
|------|------|
| `lib/embed-simulator.js` | 新增 `manufacturerProfileUrlFromRow()` |
| `server.js` | bootstrap 回傳 `manufacturer.profile_url` |
| `public/embed/simulator.html` | header logo+名稱包成 `<a>` 連廠商頁；BUILD `20260630b` |
| `public/js/embed-simulator.js` | `renderHeader()` 設定廠商首頁連結；BUILD `20260630b` |

**建議 commit 訊息：**

```
feat(embed): header 廠商 logo 與名稱連結至廠商首頁
```

**推送後部署**（Cloud Shell，見 [`deploy-matchdo-push-and-deploy.md`](deploy-matchdo-push-and-deploy.md)）：

```bash
cd ~/matchdo && git fetch origin main && git reset --hard origin/main && gcloud run deploy matchdo --source . --region=asia-northeast1 --allow-unauthenticated --clear-base-image && gcloud run services update-traffic matchdo --region=asia-northeast1 --to-latest
```

---

## 2. 已推送 `main` 的近期 commit（`7b0fd5c` 為最新遠端）

| Hash | 摘要 |
|------|------|
| `7b0fd5c` | docs(embed): MVP 已上線可結案狀態 |
| `5a7ff31` | 產品設計頁 AI 免責聲明（琥珀提示區 + 新文案） |
| `392f2d7` | **素材庫→廠商版型**（修正 i18n locale 覆寫根因） |
| `9f41b70` | 素材管理頁 UI（內嵌 style，必填/選填視覺） |
| `0cf2541` | 看可搭配 CSS 直接改原檔（刪 `-modern.css` 補丁） |
| `f0431ec` 等 | 素材卡片批次渲染、廠商版型跳轉 |

---

## 3. Embed 模擬器 — 狀態摘要

### 3.1 已定案（勿改）

- 訪客 iframe **不查訂閱**；付費只 gate **取得嵌入碼**（`POST /api/me/embed-simulator-instances`）
- 生圖成功扣廠商 **10 點/次**（非月池）
- 300/900/1800 分級：iframe 組數、Powered by、媒體牆
- 與主站試做連結 ① **計費分開**

### 3.2 已完成（MVP）

- 公開 API、限流、簽名、生圖、紀錄、insights
- `public/embed/simulator.html` + `embed-simulator.js`
- 素材後台主產品編輯 **② iframe**、Embed 生圖紀錄頁、admin 生圖紀錄
- 生圖後文案：「AI 模擬為設計參考…」
- SQL：`add-embed-simulator-schema.sql` → `add-embed-simulator-plan-tiers.sql`（**已於線上執行**）

### 3.3 本輪新增（待 push）

- Header：**廠商 logo + 名稱** → 連結 `/vendor-profile.html?id={manufacturer_id}`（新分頁）
- bootstrap 多回傳 `profile_url`

### 3.4 選做 backlog（不擋上線）

- 獨立 iframe 實例管理頁
- loading／錯誤態 polish
- Phase E：域名白名單、CAPTCHA、熔斷、GA4

**規格母本：** [`PROGRESS-vendor-embed-simulator.md`](PROGRESS-vendor-embed-simulator.md)

---

## 4. 主站 UI／UX 本輪變更

### 4.1 產品設計頁 `custom-product.html`

- **素材庫按鈕** → **廠商版型**連結（非 modal）
  - 根因：`i18n.applyPage()` 會用 `zh-TW.json` 的 `customProduct.refSlotPickVendor` 覆寫文字；已改 locale 為「廠商版型」
  - 原型槽 → `?tab=vendor-styles`；材料/配件（已有原型）→ `product-tree.html`
  - `custom-product.js?v=113`、`matchdo-asset-version=45`
- **AI 免責聲明**：琥珀色提示區；文案「AI 設計圖為創意溝通工具，實際製造規格與成品以廠商確認為準。」

### 4.2 看可搭配 `product-tree.html`

- 直接改 `public/css/vendor-product-link-tree.css?v=33`（**勿**再加 `-modern.css` + `!important`）
- 卡片 hover、區塊標題、已選側欄等視覺強化

### 4.3 素材管理 `manufacturer-materials.html`

- 在頁內 `<style>` 加必填/選填視覺（藍底必填、虛線選填「選填」標籤）
- 素材卡片 **批次渲染**（`requestAnimationFrame`，每批 12 張）— 不改後端 API

---

## 5. 重要教訓（勿再犯）

| 問題 | 正確做法 |
|------|----------|
| 改 JS fallback 但畫面仍是「素材庫」 | **必改** `public/locales/zh-TW.json`（`data-i18n` 會被 `applyPage` 覆寫） |
| UI 不生效就加 `!important` 新 CSS | **直接改**原 CSS 或頁內 style，提高選擇器權重即可 |
| 每次 `openEditModal` 新建 Bootstrap Modal | 全頁只建一次 Modal（BS 5.0.0 無 `getOrCreateInstance`） |

---

## 6. 關鍵檔案索引

| 用途 | 路徑 |
|------|------|
| Embed iframe 頁 | `public/embed/simulator.html` |
| Embed 邏輯 | `public/js/embed-simulator.js` |
| Embed 後端 | `lib/embed-simulator.js`、`server.js`（`/api/embed/simulator/*`） |
| 嵌入碼 UI | `public/client/manufacturer-materials.html`（編輯 Modal ②） |
| Embed 紀錄 | `public/client/embed-design-records.html` |
| 產品設計 | `public/custom-product.html`、`public/js/custom-product.js` |
| 看可搭配 | `public/product-tree.html`、`public/css/vendor-product-link-tree.css` |
| i18n | `public/locales/zh-TW.json`（`refSlotPickVendor`、`aiSimulationDisclaimer`） |
| 部署 | [`docs/deploy-matchdo-push-and-deploy.md`](deploy-matchdo-push-and-deploy.md) |
| FLUX 政策 | [`docs/flux-and-gemini-prompt-policy.md`](flux-and-gemini-prompt-policy.md) |

---

## 7. 新視窗接續建議

1. **先** commit + push §1 的 Embed 廠商連結 → 部署 → 無痕開 iframe 點 logo 驗收  
2. 繼續 **廠商/產品資料** 上線  
3. 若要做 UI：看可搭配 / 素材管理 **微調**（非功能缺失）  
4. Embed **backlog** 僅在有需求時做（獨立管理頁、Phase E）

---

**最後更新**：2026-06-30  
**遠端 HEAD**：`7b0fd5c`（不含 §1 未推送改動）
