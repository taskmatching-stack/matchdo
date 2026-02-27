# 網站轉為手機／平板雙版本 App 規劃

更新日期：2026-02-25

---

## 一、目標

在**不改寫現有網站**的前提下，用最少工把 MatchDO 站「快速轉成」：

- **手機版 App**：小螢幕、觸控優先、可安裝到主畫面或上架商店。
- **平板版 App**：大螢幕、可與手機共用同一套程式，依螢幕寬度自動調整版面。

**原則**：同一套前端（現有 HTML/CSS/JS + Bootstrap），透過 **PWA + 原生殼層** 同時滿足「瀏覽器安裝」與「商店上架」，手機與平板共用同一套 App，以響應式區分體驗。

---

## 二、技術路線總覽

| 方式 | 說明 | 優點 | 適合階段 |
|------|------|------|----------|
| **PWA** | 加 manifest、Service Worker、圖示與 meta | 改動小、可「加到主畫面」、離線快取可選 | **第一階段（必做）** |
| **Capacitor** | 用 WebView 包現有網站，產出 iOS/Android 專案 | 一套前端、可上架 App Store / Play Store、可插原生 API | **第二階段（要上架時）** |
| **TWA（僅 Android）** | 用 Chrome TWA 把 PWA 包成一個 APK 上架 Play | 不需維護 Android 原生碼、審核較寬 | 可選，與 Capacitor 二擇一 |

**建議路徑**：  
**先做 PWA** → 網站可安裝到手機／平板主畫面，立即有「類 App」體驗；  
**若要上架商店** → 用 **Capacitor** 包同一套網址或打包後的靜態檔，一次產出 iOS + Android，手機與平板共用同一 App（依螢幕響應式呈現）。

---

## 三、第一階段：PWA（快速可安裝）

### 3.1 要做的事

1. **Web App Manifest**（`/manifest.json` 或 `manifest.webmanifest`）
   - `name`、`short_name`、`start_url`（例如 `/index.html`）
   - `display`: `standalone` 或 `minimal-ui`（去瀏覽器 UI，像 App）
   - `theme_color`、`background_color`
   - `icons`：至少 192×192、512×512（可再補 144、384 等）

2. **HTML 引用**
   - 所有主要入口頁 `<head>` 加：
     - `<link rel="manifest" href="/manifest.json">`
     - `<meta name="theme-color" content="...">`
     - `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`（已有 viewport 可補 `viewport-fit=cover` 以支援安全區域）
   - 建議在共用的 header 或 layout 裡加，避免每頁手動貼。

3. **圖示**
   - 從現有 logo 或 favicon 產出 192、512（及可選 144、384）。
   - 放置於 `/icons/` 或 `/img/icons/`，並在 manifest 中寫入路徑。

4. **Service Worker（可選但建議）**
   - 用途：離線快取靜態資源、加快重訪、必要時離線顯示基本頁面。
   - 可先用「快取靜態檔 + 網路優先」策略，API 仍走網路。
   - 註冊於主頁或共用的 JS（例如 `public/js/app.js` 或 site-header 載入後執行）。

5. **HTTPS**
   - PWA 安裝與 Service Worker 皆需 **HTTPS**（本地可用 localhost）。上線後需確保網域為 HTTPS。

### 3.2 檔案與位置建議

| 項目 | 建議路徑 | 說明 |
|------|----------|------|
| Manifest | `public/manifest.json` 或 `public/manifest.webmanifest` | 與現有靜態檔一起由 Express 送出 |
| Service Worker | `public/sw.js` | 僅快取靜態資源，不攔 API |
| 圖示 | `public/icons/icon-192.png`、`icon-512.png` | 在 manifest 中列出 |

### 3.3 手機／平板差異（PWA 階段）

- **不需分兩套**：同一 PWA，同一 `start_url`。
- 版面已用 **Bootstrap 響應式**（`container`、breakpoints），手機窄螢幕與平板寬螢幕會自動換欄、縮排。
- 若日後要微調：可用 **media query** 或 Bootstrap 的 `md`/`lg` 再細調按鈕、字級、留白，仍維持單一 codebase。

---

## 四、第二階段：Capacitor（上架商店、雙平台一碼）

### 4.1 概念

- **Capacitor**（Ionic 團隊）把「現有網站」包進原生殼層（WebView），產出 **iOS 專案** 與 **Android 專案**。
- 同一套前端：可指向**線上網址**（例如 `https://your-domain.com`），或**打包進 App 的靜態檔**（build 後複製到 App 內）。
- 手機與平板：**同一個 App**，在 iPhone / iPad / Android 手機 / Android 平板 上都是同一套，依螢幕大小響應式顯示。

### 4.2 專案結構建議

```
ai-matching/                 # 現有專案
├── public/                  # 現有靜態檔（含 PWA manifest、sw、icons）
├── client/
├── server.js
└── ...

# 選項 A：Capacitor 放在現有 repo 內（推薦）
ai-matching/
├── public/                  # Web 靜態檔
├── capacitor/               # 或命名為 mobile-app/
│   ├── capacitor.config.ts
│   ├── ios/
│   ├── android/
│   └── package.json         # Capacitor 依賴
```

- **Capacitor 的 `webDir`**：可設為 `../public`（直接吃現有靜態檔），或設為某個 **build 輸出目錄**（若日後有前端 build 步驟）。
- **起點網址**：若用線上網址，在 Capacitor 內設 `server.url` 為 `https://your-domain.com`，App 打開即載入網站；若用打包進 App 的檔案，則不設 `server.url`，用相對路徑。

### 4.3 基本步驟（摘要）

1. 在專案根目錄或子目錄新增 Capacitor 專案：
   ```bash
   npm init @capacitor/core@latest
   # 或：npx cap init "MatchDO" "com.matchdo.app" --web-dir=../public
   ```
2. 設定 `capacitor.config.ts`：
   - `appId`：例如 `com.matchdo.app`
   - `appName`：MatchDO
   - `webDir`：指向現有靜態檔目錄（如 `public`）
   - 若先連線上網站：`server: { url: 'https://your-domain.com', cleartext: true }`（開發時可開 cleartext）
3. 加入平台：
   ```bash
   npx cap add ios
   npx cap add android
   ```
4. 建置與同步：
   - 若前端有 build：先 build，再 `npx cap sync`。
   - 若直接用 `public`：改完靜態檔後執行 `npx cap sync`，再在 Xcode / Android Studio 開專案跑模擬器或真機。

### 4.4 雙版本（手機／平板）在 Capacitor 的作法

- **不需建兩套 App**：
  - **iOS**：同一 App 在 iPhone 與 iPad 都可安裝，依螢幕 size class 自動調整（可再在 CSS 用 media query 微調）。
  - **Android**：同上，同一 APK/AAB 支援手機與平板，版面由現有響應式負責。
- 若未來要「平板專用 UI」：可在同一專案內用 **CSS 媒體查詢**（如 `min-width: 768px`）或 Capacitor 的 **Device API** 判斷是否平板，再切換 class 或版面，仍維持單一 codebase。

### 4.5 注意事項

- **登入／Session**：App 內用 WebView 開網站，Cookie / localStorage 與一般瀏覽器行為一致；Supabase Auth 若用 session 或 token 存 localStorage，可沿用。
- **深連結（Deep Link）**：若需要從外部連結開 App 到特定頁，可在 Capacitor 設定 URL scheme 或 App Links / Universal Links。
- **上架**：iOS 需 Apple Developer 帳號與 Xcode 打包；Android 需 Play Console 與簽署金鑰。Capacitor 產出的是標準原生專案，照兩邊商店規定送審即可。

---

## 五、實作順序建議（快速轉化）

| 步驟 | 內容 | 預估工時 |
|------|------|----------|
| 1 | 新增 `public/manifest.json`（name、short_name、start_url、display、icons、theme_color） | 約 0.5 天 |
| 2 | 產出並放置 PWA 圖示（192、512），在 manifest 中引用 | 約 0.5 天 |
| 3 | 全站主要頁面 `<head>` 加 manifest link、theme-color meta、viewport-fit（可集中寫在共用 layout 或一個小 snippet） | 約 0.5 天 |
| 4 | 撰寫並註冊 Service Worker（`public/sw.js`，僅快取靜態資源） | 約 1 天 |
| 5 | 以手機／平板瀏覽器測試「加到主畫面」、standalone 顯示、基本離線或弱網 | 約 0.5 天 |
| 6 | （要上架時）在專案內加入 Capacitor、設定 webDir、加入 ios/android、第一次 sync 與模擬器測試 | 約 1 天 |
| 7 | 依需求設定 Capacitor server.url 或改為打包靜態檔、真機測試、準備商店上架 | 依商店流程 |

**總計**：PWA 約 2–3 天可完成「可安裝到主畫面」；Capacitor 再加約 1–2 天可產出雙平台 App 雛形，上架則依商店審核時程。

---

## 六、與現有架構的對應

| 現有項目 | PWA/Capacitor 對應 |
|----------|--------------------|
| 前端 | `public/`、`client/` 等靜態檔，Bootstrap 已響應式 → 直接作為 PWA 與 Capacitor 的內容來源 |
| 後端 | `server.js` 維持不變；PWA/Capacitor App 仍透過 API 與現有後端溝通（需確保上線網址 HTTPS） |
| 登入 | Supabase Auth；App 內 WebView 與瀏覽器行為一致，無需特別改動 |
| 多語系 | 現有 i18n（`/js/i18n.js`、`?lang=en`）照用，不需為 App 另做一份 |

---

## 七、文件與檢查清單

- 本規劃檔：`docs/app-mobile-tablet-plan.md`
- 待辦與進度可記於：`docs/matchdo-todo.md` 的「下一步建議」或獨立小節。

**PWA 上線前檢查**：
- [ ] `manifest.json` 已存在且可被請求（`/manifest.json` 回傳正確 JSON）
- [ ] 圖示 192、512 已放好且路徑與 manifest 一致
- [ ] 至少一個入口頁有 `<link rel="manifest">` 與 `theme-color`
- [ ] Service Worker 已註冊（可選），且站點為 HTTPS
- [ ] 以 Chrome DevTools → Application → Manifest 檢查無錯誤，並可「Add to home screen」

**Capacitor 上架前檢查**：
- [ ] `capacitor.config` 的 webDir 正確、appId/appName 已設
- [ ] `npx cap sync` 成功，ios 與 android 專案可建置
- [ ] 真機上登入、主要流程（例如首頁、AI 編輯、方案頁）可正常使用
- [ ] 隱私權政策／商店說明備齊（依 Apple / Google 要求）

---

以上規劃可讓站在**最小改動**下，先以 PWA 提供手機／平板「可安裝」體驗，再視需要以 Capacitor 產出同一套前端的雙平台 App，並維持單一 codebase、雙版本（手機／平板）共用。
