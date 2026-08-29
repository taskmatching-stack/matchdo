# MatchDO 官網文案規劃

**更新**：2026-08-29（P1 商攝：攝影參數、空間地圖用詞）
**語氣**：官方說明（陳述功能、短句、不推銷、不提 AI、不跟別家比）  
**實作**：P0 已寫入 `public/locales/*.json`、首頁 meta、help；其餘見下方分期。

---

## 1. 原則

| 做 | 不做 |
|---|---|
| 名詞＋動詞，一句一事 | 「不是…而是…」、競品對照 |
| 功能名稱貫穿（設計稿、情境圖、數位資產、生成履歷） | 口號式 hero、堆形容詞 |
| 多角色入口寫在 help「帳號與入口」 | 全站 slogan 寫「同一帳號」 |
| subtitle 公式：`[做什麼]。[可選：輸入／輸出]` | 「工作流」「顛覆」「智能」 |

**「延續專業流程」**不靠標語，靠：數位資產集中、參考圖帶入、生成履歷、選單分區（以結構／以風格／行銷影像）。

---

## 2. 全站定位

| Key | 中文 | English |
|-----|------|---------|
| `site.taglineCategory` | 訂製品設計與製作協作 | Custom design & production |
| `site.taglineSlogan` | 設計稿 · 影像 · 廠商素材 | Drafts · scenes · vendor assets |

**定義句**（meta、OG、JSON-LD、help 共用）：

- 中文：MatchDO 合做 — 訂製品設計、情境影像產出、廠商媒合與數位素材管理。
- English：MatchDO — custom product design, scene imagery, vendor matching, and digital asset management.

---

## 3. P0（已實作）

| Key / 位置 | 中文 | English |
|------------|------|---------|
| `home.wallDesc` | 設計稿、廠商作品、情境影像。 | Design drafts, vendor work, and scene images. |
| `home.helpCtaLink` | 使用說明 | Help |
| `help.subtitle` | 各功能入口、操作步驟與常見問題。 | Feature entry points, steps, and FAQ. |
| `customProduct.pageSub` | 依描述、分類與參考圖產出設計稿。 | Produce design drafts from description, category, and references. |
| `promoCamera.tagline` / `appSubtitle` | 產品、空間、人像攝影模擬 | Product, space, and portrait photography simulation |
| `promoCamera.introPrefix` | 上傳或自數位資產選擇產品參考圖；右側可調攝影參數。 | Upload or pick a product reference from digital assets; adjust camera parameters on the right. |
| `myCustomProducts.subtitle` | 設計稿、情境圖與相關產出；含參考來源與生成履歷。 | Design drafts, scene images, and related outputs; includes reference sources and generation history. |
| `gallery.heroLead` | 瀏覽廠商作品；可帶入設計稿。 | Browse vendor work; load references into design drafts. |
| `remake.heroLead` | 依參考圖與描述分析設計意圖與風格方向。 | Analyze design intent and style from references and description. |
| `pricing.subtitle` | 會員方案與點數規則。 | Membership plans and credit rules. |
| 首頁 `meta` / `og:*` / JSON-LD | 見定義句 | — |

---

## 4. 商攝導演（P1 · 已實作）

### 用詞

| 對外 | 不用 |
|------|------|
| **攝影參數**（統稱） | 鏡頭、光圈、EV 等零碎列舉（官網／intro） |
| **空間地圖** | ISO 地圖、ISO 空間地圖（前台） |
| **45° 俯視** | 45° ISO |
| **地圖標記** | — |

空間流程一句：**平面配置 → 空間地圖 → 地圖標記 → 平視攝影**

Help 對照（情境圖 vs 商攝）：

| | 情境圖 | 商攝導演 |
|---|---|---|
| 控制 | 主題、場景、長寬比 | 攝影參數 |
| 空間 | — | 平面配置 → 空間地圖 → 地圖標記 → 平視 |

內部文件／code key（`layout_plan`、`genIsoMap` 等）可保留 ISO，**不出現在前台 UI**。

---

## 5. P1（其他待做）

| 頁面 / Key | 建議 subtitle |
|------------|----------------|
| `customProduct.promoImageIntroPrefix` | 依產品或設計稿產出情境影像。 |
| `materialCombo.pageSub` | 雙色／三色材料組合樣張。 |
| `remakeProduct.pageSub` | 上傳參考圖與描述，進行設計意圖分析。 |
| `baseModels.pageIntro` | 供設計稿引用；分開上傳數位原型與材料／顏色。 |
| `portfolio.pageSubtitle` | 對外展示案例（系列圖、對照圖）。 |
| help 內文 | 改為任務標題＋步驟（見 §5） |
| `register.html` subtitle | 登入後可使用設計、接案與上架功能。 |

---

## 6. Help 結構（P1 文案重排）

1. **產出設計稿** — 分類、參考圖、描述 → 數位資產  
2. **產出情境影像** — 數位資產或上傳 → 情境圖／商攝導演  
3. **上架廠商素材** — 控制台 → 數位版型／材料  
4. **帳號與入口** — ① 訂製／設計 ② 製造商 ③ 產業供應商  
5. **常見問題**

---

## 7. 維護

- 前台字串以 `public/locales/zh-TW.json`、`en.json` 為準；**官網 `/promo-camera` 與 PWA `/promo-camera-app` 共用同一套 locales**；HTML fallback 與 tagline 同步。  
- 改 locales 後更新 `public/js/i18n.js` 的 `LOCALE_CACHE_V`。  
- 首頁 meta 在 `public/iStudio-1.0.0/index.html`（根路徑 `/`）。
