# 廠商公開頁自訂網址（slug）— 選用功能規劃

**狀態**：選用／後排（非迫切需要）  
**建立日期**：2026-05-21  
**相關**：`docs/SEO-PROGRESS.md` §② 語意化網址（靈感牆／設計頁）、本檔專指**廠商詳情頁**

---

## 1. 問題與目標

### 現況

- 廠商公開首頁：`https://matchdo.cc/vendor-profile.html?id={UUID}`
- `manufacturers` 表**尚無** `slug` 欄位。
- 全站連結、靈感牆、圖庫、sitemap、動態 OG 皆以 `id` 查詢。

### 目標（若實作）

- 對外可分享較短、可讀網址，例如：  
  `https://matchdo.cc/vendor/matchdo-sample`  
  或 `https://matchdo.cc/v/matchdo-sample`（路徑前綴待決）。
- **舊 UUID 連結必須永久有效**（不可讓已分享的 `?id=` 失效）。
- 廠商在後台可設定（或僅系統自動產生）**唯一** slug。

### 非目標（本階段不做）

- 取代 UUID 作為主鍵。
- 靈感牆獨立頁 `/inspiration/...` 的語意化（另見 SEO 文件）。
- 自訂網域（`vendor.example.com`）。

---

## 2. 建議方案摘要

| 項目 | 建議 |
|------|------|
| **資料庫** | `manufacturers.slug`：`text`，唯一索引（`WHERE slug IS NOT NULL`），格式 `[a-z0-9]+(?:-[a-z0-9]+)*`，長度 3～48 |
| **公開 URL** | `GET /vendor/:slug` → 查廠商 → 回傳與現有 `vendor-profile.html` 相同內容（或 302 至 `vendor-profile.html?id=` 過渡） |
| **相容** | `vendor-profile.html?id=UUID` 保留；canonical 可優先指向 slug URL（有 slug 時） |
| **後台** | 廠商控制台／聯絡資料區：「自訂網址代碼」輸入 + 即時預覽完整 URL；建立廠商時可選自動從名稱產生 |
| **保留字** | `admin`, `custom`, `vendor`, `api`, `client`, `login`, `register`, `vendors`, `inspiration`, …（需維護清單） |

參考既有實作：`media_collections.slug` + `/custom/collection.html?slug=...`（資料夾系列，非廠商頁）。

---

## 3. 實作清單（將來開工時）

### 3.1 資料層

- [ ] `docs/add-manufacturers-slug.sql`：`slug` 欄位、唯一約束、索引。
- [ ] 種子／既有廠商：可選批次由 `name` 產生 slug（衝突加 `-2`、`-3`）。
- [ ] `PATCH /api/me/manufacturer` 接受 `slug`（驗證格式、唯一、保留字）。

### 3.2 路由與 API

- [ ] `GET /api/manufacturers/by-slug/:slug` 或擴充 `GET /api/manufacturers/:id` 支援 slug 查詢。
- [ ] `app.get('/vendor/:slug', ...)`（**須在** `express.static('public')` 之前註冊）。
- [ ] 擴充現有 `GET /vendor-profile.html` 動態 OG：支援 `?slug=` 或僅 canonical 用 slug URL。
- [ ] `GET /vendor-profile.html?id=` 有 slug 時可選 **301** 至 `/vendor/:slug`（SEO 決策後再開）。

### 3.3 前端

- [ ] `public/vendor-profile.html`：`init` 支援 `?id=` 與 pathname `/vendor/:slug`（若採同頁渲染）。
- [ ] 控制台「公開廠商頁網址」：有 slug 時顯示短網址 + 仍顯示 UUID 備用（可折疊）。
- [ ] 全站產生連結處改為「有 slug 用 `/vendor/{slug}`，否則 `?id=`」（`server.js` media-wall、gallery、custom-product 等，需盤點）。

### 3.4 SEO

- [ ] `sitemap.xml` 廠商條目改輸出 `/vendor/{slug}`（無 slug 仍輸出 `?id=`）。
- [ ] canonical、og:url、hreflang 對齊主網址策略。
- [ ] 更新 `docs/SEO-PROGRESS.md`、`docs/user-manual.md`。

### 3.5 測試

- [ ] 有／無 slug、重複 slug、改名、保留字、過期廠商 404。
- [ ] 舊 `?id=` 連結、分享預覽、靈感牆「廠商詳情」。

---

## 4. 粗估工時

| 範圍 | 估計 |
|------|------|
| 最小可用（DB + 路由 + 後台填 slug + 舊 id 相容） | 約 1 開發日 |
| 含全站連結替換、sitemap、OG、301 策略 | 約 1.5～2 開發日 |
| 含廠商改名、slug 歷史轉址（進階） | 另計 |

---

## 5. 產品決策（實作前需定案）

1. **路徑前綴**：`/vendor/:slug` vs `/v/:slug` vs `/makers/:slug`（英文品牌一致性）。
2. **誰能改 slug**：僅付費廠商 vs 全部；改名後舊 slug 是否 301 到新 slug。
3. **自動產生**：建立廠商時是否強制產生預設 slug（可再編輯）。
4. **canonical**：有 slug 時是否一律以 slug URL 為正本。

---

## 6. 與其他文件的關係

| 文件 | 關係 |
|------|------|
| `docs/matchdo-todo.md` | 列於「暫緩／後排」選用功能 |
| `docs/SEO-PROGRESS.md` | 靈感牆語意化為另一條線；廠商頁可獨立先做 |
| `docs/網站完整功能說明.md` §2.5 | 實作後補短網址說明 |
| `docs/user-manual.md` §八 | 實作後補「自訂網址」操作 |

---

*本檔僅規劃，不代表已排入開發；啟用時請另開 PR 並更新 `matchdo-todo.md` 執行進度。*
