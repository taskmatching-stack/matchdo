# 對話交接摘要（2026-06-03）

> **新對話請先讀本檔**，再依任務讀下方專題進度。複製貼上：  
> 「請讀 `docs/session-handoff-2026-06-03.md` 接續。」

**2026-06-05 新增：** 材料 FLUX 保真 ＋ 後台 FLUX 模型手填 → **`docs/PROGRESS-material-flux-ai-settings.md`**（§二 有未解決主問題）。

---

## 1. 現在線上／git 在哪？

| 項目 | 狀態 |
|------|------|
| **git `main` 穩定線** | `02a834b` — 素材頁 AI 重繪勾選 + 上傳／重繪雙按鈕還原 |
| **前一版（勿當穩定）** | `e718384` — 有雙按鈕分流，但曾缺新增表單 AI 重繪勾選 |
| **Cloud Run（2026-06-03）** | 使用者曾部署到 `e718384`（revision `matchdo-00344-n8b`）— **可能仍比 git 舊一版** |
| **本機未 push** | 進度檔更新（本檔、`PROGRESS-*`、`matchdo-todo.md`）— 部署前請先 push |

**部署（唯一正確方式）** — Google Cloud Shell：**只貼** [`deploy-matchdo-push-and-deploy.md`](deploy-matchdo-push-and-deploy.md) **§3.1 整行**（含 `grep --line-buffered -v -E 'Regional Access Boundary|taskmatchlng'`）。部署前可先 `git log -1 --oneline` 確認 commit。

確認 `git log -1` 為 **`02a834b` 或更新** 再 deploy。

---

## 2. 專題進度檔（依任務選讀）

| 任務 | 必讀 | 內容 |
|------|------|------|
| **材料 AI 優化保真、FLUX 後台模型** | **`docs/PROGRESS-material-flux-ai-settings.md`** | 固定保真 prompt、四槽手填 `flux-2-pro`、**§二 輸出仍像換材質（未解）** |
| 廠商素材上傳／編輯／**AI 重繪** | **`docs/PROGRESS-vendor-asset-gallery-edit.md`** | 多角度圖、雙按鈕、編輯 redraw API、§七驗收、§八待辦 |
| 廠商版型 Tab、看可搭配、產品關聯樹 | **`docs/PROGRESS-vendor-styles-and-product-tree.md`** | guide 橫條 UI、關聯 API、驗收與 Phase C 待辦 |
| 全站總表（很長） | `docs/matchdo-todo.md` | 「近期完成」區塊已指向上面兩檔 |
| B 線／帳號規則（舊但仍有效） | `docs/session-handoff-2026-05-26.md` §2 產品規則 | 一帳號、①②③ 分區；細節以 `docs/account-one-login-capabilities.md` 為準 |
| 架構／SEO | `docs/architecture-and-seo-principles.md` | `/client/*` noindex、sitemap 原則 |

**勿只讀其中一檔就改 `manufacturer-materials.html`** — 素材頁與關聯樹是同一後台不同分頁，但 AI 重繪邏輯細節只在 gallery 進度檔。

---

## 3. P0 待辦（營運／交接）

- [ ] **push** 進度檔 + 確認 `02a834b` 已在 `origin/main`
- [ ] **再部署** Cloud Run（若 log 曾停在 `e718384`）
- [ ] 冒煙：素材頁主產品／配件 — 多圖、勾 AI 重繪、「僅上傳」／「AI 重繪並發布」（見 gallery 進度檔 §七）
- [ ] Supabase：`add-vendor-asset-prototype-link-pick-group.sql`（guide 擇一組；見 product-tree 進度檔驗收）

---

## 4. 產品語意（不可搞混）

| `asset_kind` | 功能名稱 | 說明 |
|--------------|----------|------|
| `prototype`、`part` | **產品圖 AI 重繪** | 多圖、勾選、雙按鈕、`gallery-images/redraw` |
| `material` | **材質圖 AI 優化** | 單圖；**不是**產品重繪 |
| 重繪附帶參數 | `optimize_background` | 展示底色等；**局部選項**，不是獨立功能，勿當主軸重構頁面 |

**2026-06-03 教訓：** 勿為「改正底色文案」拆掉 AI 重繪勾選、雙按鈕或 redraw API 接線。

---

## 5. 關鍵檔案（改碼前對照）

| 檔案 | 用途 |
|------|------|
| `public/client/manufacturer-materials.html` | 廠商素材頁（**唯一入口**，勿改根目錄 `client/` 同名檔） |
| `public/client/manufacturer-portfolio.html` | 展示案例（對照圖；**與素材 AI 重繪無關**） |
| `public/custom-product.html` + `public/js/custom-product.js` | 設計頁、廠商版型 Tab |
| `public/product-tree.html` + `public/js/vendor-product-link-tree.js` | 看可搭配 guide |
| `server.js` | vendor-assets API、重繪管線、`maybeOptimizeVendorAssetMulterFile` |
| `public/js/site-header.js` | ①②③ 選單常駐（見 account-one-login 規則） |

**Cursor 規則必守：** `.cursor/rules/manufacturer-portfolio.mdc`、`deployment.mdc`、`account-one-login-capabilities.mdc`、`architecture-seo-principles.mdc`

---

## 6. 近期 commit（素材 + guide）

| Commit | 說明 |
|--------|------|
| `94d2c81` | guide 🔍 放大 |
| `e718384` | 素材：上傳／AI 重繪雙按鈕分流 |
| `02a834b` | **素材穩定線**：AI 重繪勾選還原 |

詳細列表見各 `PROGRESS-*.md` §五。

---

## 7. 相關對話

- `04206a2e-bd2d-44ec-a58e-68cec9616193` — guide 橫條 UI；素材 AI 重繪分流；錯誤改版還原（2026-06-03～04）

---

（本檔為**新對話單一入口**；專題細節以 `PROGRESS-vendor-asset-gallery-edit.md` 與 `PROGRESS-vendor-styles-and-product-tree.md` 為準，有衝突以專題檔 + git `02a834b` 程式為準。）
