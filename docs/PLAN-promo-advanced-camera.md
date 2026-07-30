# 攝影模擬・相機控制台 — 規劃與實作說明

> **更新**：2026-07-31  
> **狀態**：Phase 1 已完成；Phase 2（入口整合）進行中；**獨立 APP 評估**見 §8  
> **原則**：**只加不改** — 獨立頁、獨立 API、獨立 prompt 組裝；**禁止**影響設計頁／廠商區既有情境圖 TAB。

---

## 1. 已定案決策

| # | 決策 |
|---|------|
| 1 | **AI 對話框 + 相機介面**；僅上傳／數位資產匯入產品；FLUX 圖生圖；場景＋解析度與現有情境圖一致 |
| 2 | **獨立入口**，與簡易 TAB **UI 不重疊** |
| 3 | 入口：**設計頁 TAB**（情境圖右側）、**帳號選單**、廠商素材庫情境圖 TAB 底部連結；獨立 URL `/promo-camera` 保留 |
| 4 | 相機／底片選項 **純 FLUX 畫質模擬**，不綁任何相機系統生態 |

---

## 2. 檔案與 URL

| 項目 | 路徑 |
|------|------|
| 前台頁 | `public/client/promo-camera.html` → 短網址 **`/promo-camera`**（舊 `/client/promo-camera.html` 301） |
| 設計頁嵌入 | `public/custom-product.html?tab=promo-camera`（iframe → `/promo-camera?embed=design`） |
| 前端模組 | `public/js/promo-camera/`（`api.js`、`state.js`、`index.js`） |
| 樣式 | `public/css/promo-camera.css`（限定 `#promo-camera-app`；`body.pc-embed-design` 嵌入模式） |
| 管理區 | `public/admin/promo-camera-params.html` |
| SQL | `docs/add-promo-camera-params.sql` 等 |
| Build | `window.__MATCHDO_PROMO_CAMERA_BUILD`（例：`promo-camera-20260731a`） |

SEO：**可 index**（`meta robots: index, follow`；見 `docs/SEO-PROGRESS.md`、`architecture-and-seo-principles.md` §B 公開工具）。

---

## 3. 與現有功能隔離

| 項目 | 做法 |
|------|------|
| 生圖 API | **新** `POST /api/promo-camera/generate`（不修改 `/api/promo-image/generate`） |
| Prompt | **新** `buildPromoCameraAdvancedPrompt()`（不修改 `buildPromoImagePrompt`） |
| 攝影參數組 | 攝影模擬頁**不用** `photography_prompt_sets`（由相機參數 DB 取代） |
| 紀錄 | 同一表 `product_promo_generations`，`generation_mode = 'camera_advanced'` |
| 模型／點數 | 沿用 `bfl_flux_model_promo_image`、`points_promo_camera_*` |

---

## 4. UI 布局

- **左**：聊天（選圖、主題／場景、比例／MP、描述、生成、結果）
- **右**：相機控制台（成像來源、鏡頭、光圈、EV、葉片 + LCD 摘要）
- **手機**：上下堆疊（相機區在下方）
- **嵌入模式**（`?embed=design`）：隱藏 site header／footer／返回列，供設計頁 iframe 使用

---

## 5. 相機參數（DB：`promo_camera_param_options`）

**管理區**：`/admin/promo-camera-params.html` — 分類／分組 CRUD，每筆 `prompt_fragment` 可獨立編輯。

| category | UI |
|----------|-----|
| `camera_brand` | 品牌色彩（成像來源・數位） |
| `film_simulation` | 底片模擬（成像來源・底片） |
| `lens` | 鏡頭 |
| `shooting_angle` | 拍攝角度（按鈕列） |
| `aperture` | 光圈 |
| `exposure_ev` | EV |
| `aperture_blades` | 光圈葉片 |

（`focal_length`、`lens_type` 等可由後台 `ui_hidden_categories` 隱藏，邏輯保留於 state。）

## 5b. 點數與參考圖

### 情境圖 TAB

| 項目 | 定案 |
|------|------|
| 計價 | **固定每張**；一般 **20**／訂閱 **15** |
| 後台 key | `points_promo_image_standard`、`points_promo_image_subscriber` |
| 參考圖 | 最多 **8 張** |

### 攝影模擬

| 項目 | 定案 |
|------|------|
| 計價 | **1 MP 基礎**（一般 20／訂閱 10）**+ 每多 1 MP +10** |
| 後台 key | `points_promo_camera_standard`、`points_promo_camera_subscriber`、`points_promo_camera_per_extra_mp` |
| 參考圖 | **僅 1 張** |

訂閱判定：`hasActivePaidSubscription()`（與全站一致）。

---

## 6. Prompt 組裝順序

1. 情境圖廣告定位底稿（與現有相同語意）
2. 主題 + 場景（`promo_scene_templates`）
3. 相機光學區塊（DB 片段，依分類 sort_order）
4. 使用者描述（聊天輸入）

---

## 7. API

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/promo-camera/options` | 主題／場景／相機參數／UI config |
| GET | `/api/promo-camera/points-preview` | 依 width×height 預估點數 |
| POST | `/api/promo-camera/generate` | 生圖（需登入 JWT） |
| GET | `/api/custom-products?gallery=1` | 數位資產選圖（前端 picker 用） |
| GET/POST/PUT/DELETE | `/api/admin/promo-camera-params*` | 管理區 CRUD |

---

## 8. 獨立 APP 架構評估（2026-07-31）

### 8.1 結論（摘要）

| 維度 | 評估 |
|------|------|
| **是否適合包成獨立 APP** | **是，且已有良好基礎** — 後端邊界清楚、前端 `api.js`／`state.js` 已與 DOM 分離 |
| **最適合的第一型態** | **PWA 或 WebView 殼**（Capacitor／Tauri）包 `/promo-camera`，成本最低、與現有 Web 共用 API |
| **原生重寫 UI** | **可行但非必要** — 可 Phase 3 再做；業務邏輯可從 `state.js` 移植 |
| **現階段阻塞項** | 登入（Supabase JWT）、點數、數位資產 picker、結果面板仍依賴 MatchDO 共用模組 |

**一句話**：攝影模擬在**產品邊界**上已是獨立微功能；要變成「可上架的獨立 APP」，優先做 **PWA／WebView 殼 + 認證深連結**，而非從零原生重寫。

---

### 8.2 已具備的「可獨立化」條件 ✅

| 項目 | 說明 |
|------|------|
| **獨立 URL** | `/promo-camera` 可直達，不依賴設計頁 DOM |
| **獨立 API 面** | 3 個前台 API + 管理 API；JSON 契約穩定 |
| **獨立 prompt 管線** | `buildPromoCameraAdvancedPrompt()` 與情境圖完全分離 |
| **獨立 DB 維度** | `promo_camera_param_*` 表；`generation_mode = camera_advanced` |
| **模組分層** | `api.js`（HTTP）、`state.js`（payload／LCD 摘要）、`index.js`（DOM） |
| **樣式隔離** | `#promo-camera-app` + `promo-camera.css`，不污染全站 |
| **嵌入模式** | `?embed=design` 已驗證 iframe 嵌入路徑（設計頁 TAB） |
| **SEO／對外可發現** | 公開工具類，可進 sitemap（與 `/client/*` 工作區 noindex 不同） |

---

### 8.3 仍綁定 MatchDO 平台的耦合 ⚠️

| 耦合點 | 現況 | 獨立 APP 影響 |
|--------|------|----------------|
| **認證** | `AuthService`（Supabase session → Bearer JWT） | APP 需 OAuth／magic link 或 token 注入 WebView |
| **點數／訂閱** | 後端 `generate` 內扣點、`hasActivePaidSubscription()` | 無法離線生圖；需 MatchDO 帳號或另開 B2B 計費 |
| **主題／場景** | 共用 `promo_scene_templates`（與情境圖 TAB 同源） | 可保留共用；若 APP 要離線選單需快取 options API |
| **數位資產** | `MatchdoDigitalAssetPicker` + `GET /api/custom-products?gallery=1` | 原生 APP 需相機／相簿 API 或精簡「僅本地上傳」模式 |
| **結果 UI** | `MatchdoPromoImage.renderPromoResultPanel`（下載／存庫） | 可抽成共用元件或 APP 內建 UI |
| **i18n** | `window.i18n` + `locales/*.json` | PWA 可沿用；原生需帶 locale bundle |
| **UI 框架** | Bootstrap 5.0 Modal（資產選擇） | WebView 無問題；原生需重做 modal |
| **後端位置** | 邏輯在 `server.js`（~17k 行） | APP 仍打同一 Cloud Run；**不必**先拆路由 |

---

### 8.4 三種包裝路線比較

| 路線 | 工作量 | 重用率 | 適用情境 |
|------|--------|--------|----------|
| **A. PWA**（manifest + 可選 SW） | 小（1～3 天） | ~95% 現有 HTML/JS | 手機「加到主畫面」、輕量獨立圖示 |
| **B. Capacitor / Electron 殼** | 中（1～2 週） | ~90% Web UI | App Store／Play 上架、推播、相機權限 |
| **C. 原生 UI + SDK**（RN／Flutter） | 大（4～8 週+） | ~40%（僅 api/state 邏輯） | 重度原生 UX、離線草稿、相機 SDK 深度整合 |

**建議順序**：A → B；僅在 PWA／WebView 體驗不足時才做 C。

---

### 8.5 與「廠商 iframe 模擬器」的差異

參考 [`PROGRESS-vendor-embed-simulator.md`](PROGRESS-vendor-embed-simulator.md)：

| | 廠商 embed 模擬器 | 攝影模擬 APP |
|--|-------------------|--------------|
| 訪客 | 匿名，廠商付點 | **需登入**，使用者付點 |
| 入口 | 第三方 iframe | 自有 APP／PWA |
| API | `/api/embed/simulator/*` | `/api/promo-camera/*` |
| 產品範圍 | 單一綁定原型 | 任意 1 張產品參考圖 |

攝影模擬**不適合**直接套用 embed 匿名扣廠商點模式；獨立 APP 應維持 **C 端帳號 + JWT** 路徑。

---

### 8.6 分階段路線圖（backlog）

#### Phase APP-1 — PWA 最小可行（建議優先）

- [ ] `public/client/promo-camera.webmanifest`（名稱、圖示、`start_url: /promo-camera`）
- [ ] 登入態：未登入導向 `/login.html?redirect=/promo-camera`
- [ ] 確認 `viewport`、safe-area、手機相機區堆疊無遮擋
- [ ] 文件化：API 契約一頁（options / generate payload 範例）

**完成標準**：手機可「安裝」為獨立圖示，開啟即攝影模擬全功能（含登入後生圖）。

#### Phase APP-2 — 共用 SDK 抽離（降低原生門檻）

- [ ] 將 `api.js` + `state.js` 抽為 `lib/promo-camera-sdk/`（或 npm 內部包）
- [ ] TypeScript 型別：`PromoCameraOptions`、`GeneratePayload`、`CameraKeys`
- [ ] 結果面板：從 `MatchdoPromoImage` 抽 **最小** `renderPromoResult()` 介面
- [ ] 數位資產：定義 `AssetPickerAdapter`（Web 用現有 picker；APP 用 native stub）

**完成標準**：新 client（Capacitor 殼或測試 HTML）僅依賴 SDK + 薄 UI 層即可生圖。

#### Phase APP-3 — 商店殼（Capacitor 等）

- [ ] Capacitor 專案：`WebView` → `https://matchdo.../promo-camera` 或 bundled static
- [ ] Deep link：`matchdo://promo-camera`、Universal Links
- [ ] 相機／相簿：原生 picker → upload 或 base64 注入 `PromoCameraState.addImage`
- [ ] 推播（選做）：生成完成通知

**完成標準**：TestFlight／Play 內測可安裝，生圖流程與 Web 一致。

#### Phase APP-4 — 原生 UI（選做，非必要）

- [ ] 以 SDK 重寫控制台 UI（LCD、底片／品牌切換）
- [ ] 離線：快取 `options`、草稿 prompt（生圖仍須上線）

---

### 8.7 不建議現在做的事

- ❌ 為 APP 另開一套生圖 API（維持 `/api/promo-camera/*` 唯一入口）
- ❌ 把 prompt 組裝搬到前端（FLUX 提示詞與金鑰必須留後端）
- ❌ 未評估前拆 `server.js` 路由（APP 不依賴此步）
- ❌ 用 iframe embed 模式當正式 APP 主殼（embed 是設計頁內嵌用，非產品入口）

---

## 9. 入口（2026-07-31 現況）

| 入口 | URL／行為 |
|------|-----------|
| 獨立頁 | `/promo-camera`（`?back=design`／`?back=vendor` 控制返回） |
| **App 獨立 UI** | **`/promo-camera-app`**（無原站 header/footer；PWA manifest） |
| 設計頁 TAB | `/custom-product.html?tab=promo-camera`（iframe embed） |
| 設計頁・情境圖 TAB 底部 | 連至 `?tab=promo-camera` |
| 帳號選單（頭像下拉） | `/custom-product.html?tab=promo-camera` |
| 廠商素材庫・情境圖 TAB | `/promo-camera?back=vendor` |

---

## 10. Phase 1 完成項

- [x] 本文件 + SQL
- [x] 後端 API + prompt 組裝
- [x] 管理區 CRUD
- [x] 獨立頁 + 廠商／設計返回連結
- [x] 設計頁「攝影模擬」TAB + 帳號選單入口（2026-07-31）
- [x] 嵌入模式 `?embed=design`（設計頁 iframe）

## 11. Phase 2 / APP backlog（待做）

- [ ] Phase APP-1：PWA manifest + 登入 redirect 文件
- [x] Phase APP-1（部分）：`/promo-camera-app` 獨立 UI + `promo-camera-app.webmanifest`（2026-07-31）
- [ ] Phase APP-2：SDK 抽離 + 型別
- [ ] Phase APP-3：Capacitor 殼 + 深連結
- [ ] （選做）Phase APP-4：原生 UI
