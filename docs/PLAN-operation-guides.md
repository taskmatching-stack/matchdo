# 操作介紹文件頁 — 規劃（先不寫程式）

**日期**：2026-09-03  
**狀態**：T1 已實作（後台 CMS + `/help/` SSR）；T2 工具頁深鏈、T3 首頁一句尚未做  
**取代關係**：舊檔 `docs/使用者操作教學-規劃.md` 仍可當「要寫哪些主題」的大綱；發佈形態為本檔（後台可上傳的獨立網址文件）。

---

## 0. 要解決什麼

現況：`/help/` 只有一篇長文（目錄＋FAQ 混在一起），改內容要改程式／locales；無法自己上傳 GIF／JPG／YouTube；大功能與小功能沒有可複製的獨立網址。

目標：像 **Google 文件資料夾** 一樣——

| Google 文件 | 本站操作介紹 |
|-------------|--------------|
| 資料夾 | **大功能**（一組相關操作） |
| 一份文件 | **一篇介紹**（一個可分享網址） |
| 文件內標題 | **段落錨點**（`#heading`，同頁跳轉） |
| 複製連結 | 每篇、每個標題都可複製 |
| 內文可插圖／影片 | 文字區塊 + JPG／GIF 上傳 + YouTube 嵌入 |

讀者用獨立 URL 閱讀；Google／AI 爬的也是這些真頁，**不是**設計頁 `?tab=`。

---

## 1. 頁型歸屬（SEO，必守）

這是 **官方說明內容**，不是靈感牆 UGC，也不是個人後台。

| 層級 | 路徑 | 頁型 | 收錄 |
|------|------|------|------|
| 總目錄 | `/help/` | **C 公開目錄**（真列表 SSR） | `index` + sitemap |
| 大功能目錄 | `/help/{大功能slug}/` | 同上，列出底下各篇 | `index` + sitemap |
| 單篇操作 | `/help/{大功能slug}/{篇slug}` | **說明單件**（SSR 全文） | `index` + sitemap |
| 同頁段落 | `...#{標題id}` | 錨點，**不當獨立 sitemap 頁** | 跟隨該篇 |
| 後台編輯 | `/admin/operation-guides.html` | **D 後台** | `noindex` |

**禁止**

- 做成 `custom-product.html?tab=help` 或 `browse=guide`
- 用 sitemap 堆 `?id=` 的 CSR 空殼當多頁
- 把說明塞進 `/client/*` 後台（會被當個人頁、不利分享）
- 與 `/inspiration/` 混用（那是作品／版型單件）

現有頁尾、sitemap 已有 `/help/`，**公開網址沿用此前綴**，不必再發明第二套 `/guides/`（若做，只當 301 別名，增加維護）。

---

## 2. 資訊架構（大功能／小功能怎麼拆）

管理員在後台決定「這段要獨立成頁，還是只當同篇的一個標題」。

### 2.1 建議拆頁原則

| 做成**獨立網址** | 留在同篇當**段落**（`#錨點`） |
|------------------|--------------------------------|
| 一個可單獨給人看的功能（商攝導演、材料組合、方案訂閱） | 同一畫面裡的小步驟（選解析度、勾選上傳） |
| 會被「從工具頁深鏈」的主題 | 前後文必須連著讀才懂的一句話 |
| 預期會被搜尋的關鍵詞（「如何不上媒體牆」） | 純截圖說明、沒有獨立搜尋價值 |

**預設**：大功能 = 資料夾＋一篇「總覽」；底下常被問的步驟再拆子頁。不要一開始就把每個按鈕都做成一頁。

### 2.2 網址形狀（範例，實作前可改 slug）

草稿樹已建成（全部 `is_published=false`，見 `docs/add-help-guides-draft-tree.sql`）。發佈前前台仍走靜態 `/help/`。

```
/help/                              總目錄（有已發佈資料夾才改 SSR）
/help/getting-started/               開始使用（總覽／login／first-visit）
/help/design-draft/                  設計稿（總覽含無樣版／有樣版）
/help/design-draft/references        參考圖
/help/design-draft/vendor-styles    廠商版型
/help/design-draft/official-templates 官方版型
/help/promo-camera/                商攝（product／space／portrait／pwa-app）
/help/promo-image/  /help/materials/  /help/print-asset/
/help/pattern-extract/  /help/design-to-physical/  /help/scene-sim/
/help/my-assets/  /help/gallery/  /help/design-direction/
/help/vendor-start/  /help/vendor-portfolio/  /help/vendor-materials/
/help/vendor-embed/  /help/vendor-inquiries/  /help/vendor-profile/  /help/vendor-sourcing/
/help/supplier-catalog/  /help/supplier-profile/
/help/membership/                   方案與點數（top-up／hide-from-wall／free-limits）
/help/faq                          常見問題
```

- slug **英文短橫線**（利 SEO、好複製）。
- 已發佈後若改 slug：舊網址 **301** 到新網址（避免複製出去的連結失效）。
- 語系用既有 `?lang=zh-TW` / `?lang=en`，**不要**做成 `/help/en/xxx` 兩套樹（除非日後真的要分開收錄再議）。

### 2.3 閱讀畫面（像 Google 文件）

左：該大功能的文件清單（目前這篇高亮）。  
中：標題 + 內文區塊（文字／圖／GIF／YouTube）。  
右或文首：本篇大綱（由標題自動產生），點了變 `#錨點`。  
每篇右上：**複製本頁網址**；每個標題旁小鏈：**複製此段落網址**。

---

## 3. 內容區塊（後台上傳什麼）

一篇由**區塊**組成，順序可拖曳。v1 只做四種：

| 區塊 | 來源 | 前台呈現 |
|------|------|----------|
| **文字** | 後台富文本或 Markdown（擇一，建議 Markdown 較穩） | 標題 H2／H3、段落、清單 |
| **JPG** | 上傳（建議 ≤ 2MB，長邊可壓） | `<img>` + 選填圖說 |
| **GIF** | 上傳（建議 ≤ 8MB） | `<img>` 自動播放；勿當獨立頁 |
| **YouTube** | 貼網址（Shorts／一般影片皆可） | 嵌入播放器；只存 video id，不代轉檔 |

**不做（v1）**：PDF 當正文、自行上傳 MP4、註解／共同編輯、即時協作游標。那才是真 Google 文件，範圍太大。

媒體存 **Supabase Storage**（與現有上傳同一套），公開讀、後台寫。YouTube 不佔我們流量。

### 3.1 內容多語系（後台欄位，不是 locales 硬翻內文）

會出現在前台的標題／內文／圖說，後台要有：

- `title`（中文／預設）、`title_en`（必填欄，可暫與中文相同）
- 區塊文字、圖說同樣 `…` / `…_en`
- 前台 `?lang=` 選顯示；缺英文則 fallback 中文

**不要**只改 `locales/*.json` 就以為操作介紹變英文。

---

## 4. 後台（誰寫、在哪寫）

| 項目 | 建議 |
|------|------|
| 誰 | 僅 **管理員**（與金流設定相同） |
| 頁 | `/admin/operation-guides.html`（名稱：**操作介紹**） |
| 能力 | 新增資料夾／篇、排序、草稿／發佈、上傳圖、貼 YouTube、改 slug、預覽 |
| 草稿 | 未發佈前台 404；預覽用帶 token 或管理員 session |
| 與舊知識庫 | `public/admin/help-knowledgebase.html` 是樣板，**不要拿來當 CMS** |

列表像資料夾：左邊樹、右邊該篇編輯器。儲存後「開啟前台」開獨立網址。

---

## 5. 連結放哪（入口策略）

頂部主選單已經很滿（客製產品、設計風向、方案、我的功能），**不要再加第五個主選單「說明」**。

### 5.1 全站找得到（建議做）

| 位置 | 連到 | 理由 |
|------|------|------|
| **頁尾「連結」** | `/help/` | **已經有**「使用說明」（`public/partials/footer.html`）。維持，之後目錄會變豐富。 |
| **頁尾 footer-menu** | `/help/`、常見問題改連 `/help/faq`（獨立篇，不要永遠 `#faq`） | `public/partials/footer.html` 已指向 `/help/`；`iStudio-1.0.0` 那份 footer 仍是 `#`，之後對齊。 |
| **帳號下拉**（頭像） | `/help/` | 與「方案與定價」「我的點數」同層，登入後也好找。 |
| **我的功能最下方** | `/help/` | ①②③ 之後一條「操作介紹」，**不是第四種角色**，只是說明入口；不依資格隱藏。 |

### 5.2 讓「不會用」的人第一眼看到（擇一，不要全做）

| 優先 | 位置 | 連到 |
|------|------|------|
| **P1** | 首頁靈感牆**搜尋列上方**一行小字：「第一次來？看操作介紹」 | `/help/` 或 `/help/getting-started/` |
| **P2** | 各**工具頁標題旁**「操作介紹」文字鏈 | **該功能的獨立篇**（見下表），新分頁打開 |
| 可選 | 右下角「？」 | 只開 `/help/`；容易擋商攝／設計操作，**預設不做** |

P1 不要用擋住媒體牆的大 modal。

### 5.3 工具頁深鏈（複製網址的真正用途）

說明頁是工具的**旁邊文件**，不是把教學做進工具裡。

| 工具／頁 | 建議深鏈（slug 可再改） |
|----------|-------------------------|
| 設計稿 `/custom-product.html` | `/help/design-draft/`（**不要**加設計頁 tab） |
| 商攝 `/promo-camera` | `/help/promo-camera/` |
| 情境圖 `/promo-image/` | `/help/promo-image/` |
| 材料組合 | `/help/materials/` |
| 印花 | `/help/print-asset/` |
| 方案與定價 | `/help/membership/` |
| 我的點數 | `/help/membership/top-up` |
| 素材管理 | `/help/vendor-materials/` |
| 廠商作品 | `/help/vendor-portfolio/` |

同一頁多個小功能：按鈕旁連**子篇**（例如商攝「空間」→ `/help/promo-camera/space`）。

### 5.4 後台入口

管理員頭像選單、與「金流設定／會員方案」附近加 **操作介紹** → `/admin/operation-guides.html`。

---

## 6. 與現有 `/help/index.html` 怎麼過渡

1. 先上 CMS + SSR；總目錄改由資料庫列出已發佈資料夾／篇。  
2. 把目前靜態長文拆成數篇（開始使用、設計稿、商攝、FAQ）再貼進後台。  
3. 舊書籤：`/help/` 永遠是目錄；`/help/#faq` 可 301 到 `/help/faq`。  
4. `locales` 裡現有 `help.*` 只留目錄殼的按鈕字；**正文改走 DB**。

---

## 7. 技術邊界（實作時才做，此處只定調）

- 前台單篇、目錄：**伺服器吐 HTML**（title／description／正文），避免只有 JSON 的空殼。  
- API 仍可寫在 `server.js`（與現況一致）；若單檔新增很大再考慮 `routes/help-guides.js`。  
- 新表建議：`help_guide_folders`、`help_guide_pages`、`help_guide_blocks`（或 pages + `blocks_json`）；媒體 URL 存區塊裡。  
- sitemap：已發佈頁進既有 `sitemap-pages` 或獨立 `sitemap-help`（篇數變多再拆）。  
- 圖檔不當獨立 SEO 頁；YouTube 用官方 embed，尊重原影片頁。

---

## 8. 分期（仍不寫程式，僅排序）

| 期 | 內容 | 完成長相 |
|----|------|----------|
| **T0 規劃** | 本檔；你確認網址前綴、入口要哪些 | 本檔打勾 |
| **T1 CMS 最小** | 後台上傳文字＋JPG／GIF＋YouTube；發佈；`/help/` 目錄 + `/help/a/b` 單篇 SSR；複製網址 | **已上線程式**（須執行 migration `help-guides`） |
| **T2 入口** | 頁尾對齊、帳號下拉、我的功能、工具頁標題旁深鏈 | 使用者找得到、可分享單篇 |
| **T3 首頁一句** | 靈感牆上方「第一次來？」 | 新訪客看得到 |
| 以後 | 改 slug 的 301、HowTo JSON-LD、全文搜尋 | 非第一版 |

---

## 9. 請你拍板的三件事

1. **公開前綴**：維持 `/help/…`（建議，因頁尾與 sitemap 已存在）還是改成 `/guides/…`？  
2. **入口**：P1 首頁一句 + 工具頁深鏈 + 頁尾／帳號下拉，**不做**右下角「？」——是否同意？  
3. **編輯器**：v1 用「區塊＋Markdown」而不是真 Google 文件協作——是否同意？

確認後再開實作（T1），不會在本規劃階段改程式。
