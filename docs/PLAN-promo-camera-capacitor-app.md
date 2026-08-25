# 攝影模擬 Store App（Capacitor · 作法 B）— 規劃與工時

> **更新**：2026-08-01（2026-08-15 補連結：iOS 打包手冊）  
> **狀態**：已決案 · **C0～C1 部分完成**（Android 本機可跑；上架／IAP 日後）  
> **進度 handoff：** [`PROGRESS-promo-camera-app-store.md`](PROGRESS-promo-camera-app-store.md)（**§9** 隔離包／同步頁已有，Store 還缺什麼）  
> **iOS 實作步驟（Mac／雲端）：** [`HOW-TO-promo-camera-ios-xcode-and-cloud.md`](HOW-TO-promo-camera-ios-xcode-and-cloud.md)
> **範圍**：**只包** [`https://matchdo.cc/promo-camera-app`](https://matchdo.cc/promo-camera-app) 一頁（及其靜態依賴），**不包**整站 MatchDO。  
> **相關**：[PLAN-promo-advanced-camera.md §8](PLAN-promo-advanced-camera.md)、[promo-camera-app-isolation](../.cursor/rules/promo-camera-app-isolation.mdc)

---

## 1. 已定案

| 項目 | 決策 |
|------|------|
| 包裝路線 | **B. Capacitor**，本地 bundle 靜態檔 + 線上 API |
| 入口 | 僅 `public/client/promo-camera-app.html` → App 內 `www/index.html` |
| 後端 | **不進包**；生圖／選項／扣點打 `https://matchdo.cc/api/promo-camera/*` |
| 子專案 | `apps/matchdo-promo-camera/`（與 Cloud Run deploy **分離**） |
| PWA | 線上 `/promo-camera-app` **保留**；Store 版為另一發行管道 |
| 原站 | **禁止**為 Store 改 `/promo-camera` 或共用 CSS/JS 行為（見 isolation rule） |
| **使用型態** | **輕量**：攝影模擬單頁、**偶爾打包**（非每日 CI） |
| **iOS 建置（無 Mac）** | **Codemagic 個人帳號** 免費 500 分／月為主；見 [§7.4](#74-輕量情境偶爾打包本專案預期用法) |

**不做**（本階段）：Flutter **整頁重寫 UI**、bundle 整站、`server.js` 進 App、App 內 WebView 開綠界 `/credits.html`。

> **若你問 Flutter 是因為「沒 Mac 想做雙平台」** → 見 **[§7.5 Flutter vs Capacitor](#75-flutter-vs-capacitor為何仍建議-b)**：Flutter **同樣無法**在 Windows 本機打 iOS；差別在 **工時與是否重用現有 Web UI**，不在「免 Mac 上架 iOS」。

---

## 2. 架構

```
┌─────────────────────────────────────┐
│  iOS / Android App (Capacitor)      │
│  www/  ← 僅 promo-camera-app 依賴樹   │
│  index.html, css/, js/, img/, locales│
└──────────────┬──────────────────────┘
               │ HTTPS
               ▼
┌─────────────────────────────────────┐
│  matchdo.cc（現有 Cloud Run）         │
│  /api/promo-camera/*                │
│  /api/me/credits                    │
│  Supabase Auth                      │
│  （未來）/api/payment/iap/verify      │
└─────────────────────────────────────┘
```

---

## 3. 目錄結構（建議）

```
ai-matching/
  public/client/promo-camera-app.html    ← Web/PWA 唯一來源（持續維護）
  apps/matchdo-promo-camera/
    capacitor.config.ts
    package.json
    scripts/sync-www.mjs                 ← 只 copy 允許清單 → www/
    www/                                   ← 不手改；由 sync 產生
      index.html
      css/ js/ img/ config/ locales/
    android/                               ← Capacitor 產生
    ios/                                   ← Capacitor 產生（需 Mac 或雲端建置）
```

**Deploy 分離**

| 目標 | 指令／流程 |
|------|------------|
| 網站 + API | 現有 `git push` → Cloud Shell deploy（不變） |
| Android APK/AAB | 本機 Windows + Android Studio，或 CI |
| iOS IPA | **需 macOS + Xcode**（本機 Mac 或雲端 CI，見 §7） |

---

## 4. `www/` 允許清單（sync 腳本依此 copy）

### 4.1 入口

| 來源 | 目標 |
|------|------|
| `public/client/promo-camera-app.html` | `www/index.html` |

sync 時需改：移除/改寫 `canonical`、`manifest` 連結；CDN script 改成本機路徑（§4.3）。

### 4.2 本機靜態（repo 內）

**CSS**

- `public/css/bootstrap.min.css`
- `public/css/morandi-global.css`
- `public/css/image-lightbox.css`
- `public/css/promo-camera.css`
- `public/css/promo-camera-app.css`
- `public/css/digital-asset-picker.css`

**JS**

- `public/js/promo-camera/app-shell.js`
- `public/js/promo-camera/index.js`
- `public/js/promo-camera/state.js`
- `public/js/promo-camera/api.js`
- `public/js/matchdo-promo-image.js`
- `public/js/image-lightbox.js`
- `public/js/digital-asset-picker.js`
- `public/js/auth-middleware.js`
- `public/js/i18n.js`
- `public/js/bootstrap.bundle.min.js`（取代 HTML 內 CDN Bootstrap 5.0.0）

**設定與文案**

- `public/config/auth-config.js`
- `public/locales/zh-Hant.json`（必要）
- `public/locales/en.json`（若要英文）

**圖片（此頁引用）**

- `public/img/matchdo-logo.png`
- `public/img/cam-lcd-on.png`
- （若 HTML 擴充引用其他 `/img/`，sync 腳本需一併列入）

### 4.3 需 vendor 進 `www/`（勿依賴 CDN）

HTML 目前從 CDN 載入，Store bundle **應改成本機**：

| 現況（CDN） | 作法 B |
|-------------|--------|
| `bootstrap-icons@1.11.0` CSS + 字型 | 下載至 `www/vendor/bootstrap-icons/` |
| `bootstrap@5.0.0` bundle JS | 改用 repo 內 `bootstrap.bundle.min.js` |
| `@supabase/supabase-js@2` | 下載 UMD 單檔至 `www/vendor/supabase/` |

### 4.4 刻意不 copy

- `public/credits.html`、`public/custom-product.html`、其餘 `public/client/*`
- `public/admin/`、`server.js`
- 綠界付款頁與 `/api/payment/ecpay/*` 的 **App 內 WebView 入口**

---

## 5. 實作時必補（現有 PWA 尚未滿足 Store）

| # | 項目 | 說明 |
|---|------|------|
| 1 | **API 絕對位址** | 本地 `file`/`capacitor://` 下相對路徑 `/api/...` 會打錯；需 `window.__MATCHDO_API_ORIGIN = 'https://matchdo.cc'`（或 build 注入），**僅 App bundle 分支**，不破坏線上 PWA。 |
| 2 | **登入** | HTML 內 `/login.html` 不在 bundle；需 **InAppBrowser / 系統瀏覽器** 開 `https://matchdo.cc/login.html?returnUrl=...` + **Deep Link / Universal Link** 回 App，或另做精簡 `www/login.html`。 |
| 3 | **儲值（審核必過）** | App 內 **Apple IAP + Google Play Billing**；後端新增 receipt verify → 寫入 `user_credits`。**不可** App 內開綠界 credits 頁（現 `app-shell.js` 新分頁開 credits 僅適用 PWA）。 |
| 4 | **隱私權／支援 URL** | Store 必填；可指向 `matchdo.cc` 既有頁或新增靜態頁。 |
| 5 | **App 圖示與 splash** | Store 1024² 等；與 `promo-camera-app.webmanifest` 分開維護。 |
| 6 | **生圖紀錄** | 已支援 `client_channel: app`；Store 版可再加 metadata（例：`distribution: capacitor`）。 |

---

## 6. 工時評估

假設：**1 名熟悉本 repo 的開發者**；後端 IAP verify 與 Store 商家帳號可並行申請。

### 6.1 分階段（開發人日）

| 階段 | 內容 | 人日（估） |
|------|------|------------|
| **C0** | 本文件 + `apps/matchdo-promo-camera` 空殼、`sync-www` 腳本 | 0.5～1 |
| **C1** | Capacitor 初始化、www bundle、vendor CDN、Android 真機可開頁 | 2～3 |
| **C2** | API origin、登入 deep link / InAppBrowser、選項／上傳／生圖打通 | 3～5 |
| **C3** | IAP（RevenueCat 或原生）+ 後端 verify API + App 儲值 UI | 8～12 |
| **C4** | iOS 雲端建置（Codemagic 等）+ 簽章 + TestFlight 內測 | 2～4（首次含學習） |
| **C5** | Store 文案、截圖、隱私問卷、審核來回 | 3～7（日曆天，非全職） |

**合計（到雙平台上架 MVP）**

| 情境 | 開發 effort | 日曆時間（含審核） |
|------|-------------|-------------------|
| **保守** | **约 18～25 人日** | **6～10 週** |
| **順利**（IAP 一次過、審核一輪） | **约 12～16 人日** | **4～6 週** |

**不含**：Flutter 原生重做、整站 PWA、後端大拆 `server.js`。

### 6.2 若先做「能裝、能生圖、儲值仍外開」（不建議送審）

| 階段 | 人日 |
|------|------|
| C0～C2 only | **约 6～9 人日** |

此版本 **Google Play 可能以 3.1.1 拒審**；僅適合內測 APK，不適合正式上架。

---

## 7. 沒有 Mac，能否做雙平台 App？

### 7.1 結論

| 平台 | 無 Mac 可否？ | 說明 |
|------|---------------|------|
| **Android** | **可以** | Windows 安裝 Android Studio + JDK；Capacitor `npx cap run android` / 出 AAB 上架 Play。 |
| **iOS** | **本機不行** | 編譯、簽章、上傳 App Store **必須 macOS + Xcode**。 |
| **雙平台整體** | **可以（用雲端 Mac）** | 見 [§7.2](#72-雲端-macos-建置--費用怎麼算)、[§7.4](#74-輕量情境偶爾打包本專案預期用法) |

**可以直接做成雙平台 App**，但 **iOS 不能只在 Windows 本機完成**；需雲端 Mac CI 或借 Mac。

### 7.2 雲端 Mac／iOS 建置 — 費用怎麼算

> 價格以各服務官網為準（2026 初）；**Flutter 與 Capacitor 相同**，都要 macOS 才能打 iOS。

#### 7.2.1 CI 按分鐘（最適合「偶爾打一版 IPA」）

**Codemagic**（Capacitor 常用，[codemagic.io/pricing](https://codemagic.io/pricing/)）

| 項目 | 費用 |
|------|------|
| **個人帳號免費額** | 每月 **500 分鐘**（macOS M2），每月 1 日重置 |
| **超出後** | **USD 0.095 / 分鐘**（M2）；M4 為 USD 0.114 / 分鐘 |
| **年付固定方案** | **USD 3,990 / 年**（無限分鐘、3 併發 — 適合團隊**天天** build，本專案**不必**） |

**GitHub Actions**（[Actions 計價](https://docs.github.com/en/billing/reference/actions-runner-pricing)）

| 項目 | 費用 |
|------|------|
| **macOS 標準 runner** | **USD 0.062 / 分鐘**（2026 起） |
| **私人 repo 免費額** | 約 **2,000 Linux 等效分鐘 / 月** |
| **macOS 消耗倍率** | 1 分鐘 macOS = 扣 **10** 分鐘額度 → 約 **200 分鐘 macOS / 月** |
| **備註** | 需自行管理 p12、Provisioning、App Store Connect API key |

**一次 Capacitor iOS build**（sync + archive + 上傳）約 **15～40 分鐘**。

#### 7.2.2 遠端租用整台 Mac（手動開 Xcode）

**MacinCloud**（[Pay-as-you-go](https://www.macincloud.com/pages/payg.html)）

| 方案 | 費用 | 注意 |
|------|------|------|
| 按小時 | 約 **USD 1 / 小時** 起 | 當日登入時間加總後**進位到整小時** |
| 按日 | 約 **USD 4 / 天** | 最少算 24 小時 |
| 預購例 | USD 30 ≈ 30 小時 | Pay-as-you-go **無 root**；要完整管理權需 Dedicated（月租更高） |

**MacStadium** Dedicated Mac mini（[macstadium.com/pricing](https://macstadium.com/pricing)）

| 機型 | 月租（參考） |
|------|-------------|
| M2 Mac mini 入門 | **USD 109 / 月** |
| M2 Pro 等級 | **USD 199～349 / 月** |

適合**長期、每天**用 Mac；**只為偶爾打包不划算**。

**AWS EC2 Mac**（Dedicated Host）

| 項目 | 費用 |
|------|------|
| mac2.metal（M1 mini） | **USD 0.65 / 小時** |
| **Apple 授權最低租期** | **每次至少 24 小時** → 開一次 host ≈ **USD 15～16** |

適合集中一天搞完；**不適合**「偶爾 build 30 分鐘」。

#### 7.2.3 Store 固定成本（與雲端 Mac 無關）

| 項目 | 費用 |
|------|------|
| **Apple Developer** | **USD 99 / 年**（TestFlight / App Store 必備） |
| **Google Play** | **USD 25 一次性**（若也上 Android） |

#### 7.2.4 方案速查（依使用頻率）

| 使用頻率 | 建議 | 預估雲 Mac 費用 |
|----------|------|-----------------|
| **每月 1～4 次 iOS 打包** | **Codemagic 個人帳號** | **USD 0 / 月**（500 免費分鐘內） |
| **第一次簽章踩坑** | Codemagic 向導；卡住再 MacinCloud 1～2 小時 | **USD 0 或 1～2（一次性）** |
| **每月 >30 次 build** | Codemagic 按量或 GitHub Actions 超額 | **USD 20～50 / 月** |
| **每天 build** | MacStadium 月租或 Codemagic 年付 | **USD 109+ / 月** |

**不必考慮**（本專案輕量場景）：MacStadium 月租、AWS EC2 Mac 日常 build、Codemagic USD 3,990 年付、Flutter 重寫。

**仍需**（上架 iOS 時）：Apple Developer Program、App Store Connect 建 App、IAP 商品設定（可於 Windows 瀏覽器操作）。

### 7.3 建議路線（無 Mac 開發者）

1. **Windows**：C0～C3 + **Android 內測／Play 封測**（先驗證 bundle + API + 登入 + 生圖）。  
2. **並行**：申請 Apple Developer、設計 IAP 商品、後端 verify。  
3. **Codemagic**（首選）或 GitHub Actions：同一 repo `apps/matchdo-promo-camera` push 即打 iOS。  
4. **TestFlight** 給自己測 iOS → 再正式送審。  

Android 與 iOS **共用同一套 `www/`**；差別只在原生殼、權限、IAP SDK 與 Store 設定。

**若僅為輕量、偶爾打包** → 直接採用 [§7.4](#74-輕量情境偶爾打包本專案預期用法)，不必租月付 Mac。

### 7.4 輕量情境：偶爾打包（本專案預期用法）

**前提**：只包 [`/promo-camera-app`](https://matchdo.cc/promo-camera-app) 一頁；開發在 Windows；**每月更新 0～4 次** Store 版即可。

#### 定案

| 項目 | 決策 |
|------|------|
| 日常開發 | Windows + 線上 PWA／Android Studio 測 Android |
| iOS 打包 | **Codemagic 個人帳號**（GitHub 連 repo，`git push` 觸發） |
| 雲 Mac 月費 | **預期 USD 0**（500 免費分鐘／月足夠） |
| 首次 iOS 簽章 | Codemagic 向導優先；必要時 **MacinCloud 1～2 小時**（約 USD 1～2，一次性） |
| 不做 | MacStadium 月租、AWS EC2 24h 最低計費、Flutter 重寫、Codemagic 年付 |

#### 用量估算

| 頻率 | 每次 build 時間 | 月消耗（估） | 是否在 500 免費分鐘內 |
|------|----------------|-------------|----------------------|
| 每月 2 版 | 25 分鐘 | 50 分鐘 | 是 |
| 每月 4 版 | 30 分鐘 | 120 分鐘 | 是 |
| 每月 10 版（除錯期） | 30 分鐘 | 300 分鐘 | 是 |
| 每月 20 版 | 30 分鐘 | 600 分鐘 | 超出 100 分鐘 → 約 **USD 9.5** |

#### 偶爾打包流程

```
1. 改 promo-camera-app 相關檔 → git push main（網站照常 Cloud Run deploy）
2. 本地或 CI：npm run sync:www → npx cap sync（Android 可在 Windows 本機測）
3. git push apps/matchdo-promo-camera/ → Codemagic 自動打 iOS IPA → TestFlight
4. 需要 Play 版：Windows 本機或 CI 出 AAB → Play Console 上傳
```

#### 實際成本摘要（輕量、偶爾打包）

| 項目 | 費用 |
|------|------|
| 雲 Mac／CI（iOS build） | **USD 0～10 / 月**（多數月份 **0**） |
| Apple Developer（若要 iOS Store） | **USD 99 / 年** |
| Google Play（若要 Android Store） | **USD 25 一次性** |
| Capacitor 殼一次性搭建（C0～C2） | 開發人力 **約 6～9 人日**（見 §6.2；不含 IAP 送審） |

**結論**：輕量攝影模擬頁、偶爾打包 → **不必買 Mac、不必租月付雲 Mac**；固定支出主要是 **若要上架 Store 的 Apple／Google 開發者費**。

### 7.5 Flutter vs Capacitor（為何仍建議 B）

很多人（含本專案）會先想到 **Flutter**，常見動機是「一套 code、Android + iOS」。對 **MatchDO 攝影模擬 App** 而言，需分開兩件事：

| 問題 | Flutter 能解決嗎？ | Capacitor（作法 B） |
|------|-------------------|---------------------|
| **Windows 本機打 iOS、上 App Store** | **不能** — 仍要 macOS + Xcode 或 **雲端 Mac CI**（Codemagic 等） | **同左** — 完全一樣 |
| **Android 在 Windows 開發上架** | **可以** | **可以** |
| **重用已做好的 `/promo-camera-app` UI** | **不行**（除非 Flutter 裡再包 WebView，見下） | **可以** — 直接 bundle 現有 HTML/CSS/JS |
| **Store 審核：App 內儲值** | 必做 **IAP** + 後端 verify | **同左** |
| **登入（Supabase）回 App** | Deep Link / 原生登入頁 | Deep Link / InAppBrowser |
| **開發到雙平台 MVP 工時** | **约 25～45+ 人日**（重寫 UI + 狀態 + 上傳 + 燈箱 + picker） | **约 12～25 人日**（§6） |

#### Flutter 的三種用法（與本專案關係）

| 用法 | 說明 | 適不適合現在 |
|------|------|--------------|
| **A. 原生 Flutter UI 重做** | 用 Widget 重做主題／場景／比例／上傳／結果牆 | 功能最多、**工時最長**；現有 Web App 等於重寫 |
| **B. Flutter + `WebView` 載入 `matchdo.cc/promo-camera-app`** | 外層 Flutter 殼 + 內嵌網頁 | 比 Capacitor **多一層**、IAP/登入仍要橋接；**不優於 Capacitor** |
| **C. Flutter 只做殼 + 少數原生頁（登入／儲值）** | Web 生圖 + 原生 IAP 頁 | 可行但 **兩套 UI 技術並存**，維護成本高 |

**結論（無 Mac 仍要做雙平台 Store App）：**

- 選 **Flutter 不會**讓 iOS 變成「Windows 本機就能完成」；**iOS 門檻與 Capacitor 相同**（雲端 Mac 或借 Mac）。
- 選 **Flutter 會**大幅增加前端工作量，因為 **`promo-camera-app` 已有一套可上架的 Web UI**（含 PWA、isolation rule、近期 UX 修正）。
- 若目標是 **盡快雙平台上架、且 UI 與 Web 一致** → **Capacitor 作法 B** 仍較合理。
- 若目標是 **長期原生體驗、離線草稿、深度相機 SDK、願意接受 1.5～2× 工時** → 可另開 **Flutter 路線**（見 [PLAN-promo-advanced-camera.md §8 作法 C](PLAN-promo-advanced-camera.md)），**不取代**現有 Web／PWA。

#### Flutter 路線粗估工時（供對照）

| 階段 | 人日（估） |
|------|------------|
| 專案 scaffold + 路由 + 主題 | 2～3 |
| 重寫表單（主題／場景／比例／MP／底片） | 5～8 |
| 上傳、資產庫、生圖流程接 API | 5～8 |
| 結果牆、燈箱、分享 | 3～5 |
| IAP + 登入 + deep link | 8～12（與 Capacitor 同級） |
| iOS 雲端建置 + 雙平台送審 | 5～10 |
| **合計 MVP** | **约 28～46 人日**（**6～12 週** 日曆） |

---

## 8. 與現有 PWA 的同步策略

1. 功能改動：只改 `promo-camera-app.html`、`promo-camera-app.css`、`app-shell.js`（及必要時共用 `api.js` 的 **App 相容**小改，需符合 isolation rule）。  
2. 發 Store 版前：執行 `npm run sync:www`（待建）→ `npx cap sync` → 打版。  
3. 線上 PWA：維持 `git push` deploy；**不必**等 Store 審核。  

---

## 9. 風險與緩解

| 風險 | 緩解 |
|------|------|
| 審核 4.2（像網站殼） | 單一工具 App、bundle 完整 UI、原生 IAP／相簿權限 |
| 審核 3.1.1（外開付費） | C3 IAP 必做；移除 App 內 credits 外連 |
| 登入回 App 失敗 | Universal Link / Custom URL Scheme 早測 |
| sync 漏檔 | 允許清單寫死在 `sync-www.mjs` + CI 檢查 |
| 無 Mac 卡 iOS | Codemagic 免費額 + §7.4 輕量流程；Android 先上 |

---

## 10. 待辦（backlog）

逐步勾選請跟 [`PROGRESS-promo-camera-app-store.md`](PROGRESS-promo-camera-app-store.md) **§10**。

- [x] 建立 `apps/matchdo-promo-camera/` + Capacitor init（`ff6e3ce`）  
- [x] `scripts/sync-www.mjs`（§4 允許清單）  
- [x] API origin（`store/capacitor-boot.js`，sync 注入 www）  
- [x] Android 本機模擬器可開頁（Pixel 7 已驗證）  
- [x] Windows 中文路徑 Gradle patch（`patch-android-gradle.mjs`）  
- [ ] `sync-www` 納入 `pwa-install-prompt.js`（L3b 新增後接續）  
- [ ] 登入 deep link 方案定稿  
- [ ] IAP 商品表 + `POST /api/payment/iap/verify` 規格  
- [ ] Android 內測 APK／AAB 上 Play  
- [ ] Codemagic iOS pipeline（§7.4 輕量、個人免費額）  
- [ ] Store 上架素材  
- [x] 線上 PWA iOS／Android「加入主畫面」引導（`pwa-install-prompt.js`）

---

## 11. 修訂紀錄

| 日期 | 說明 |
|------|------|
| 2026-07-31 | 初版：作法 B 定案、允許清單、工時、無 Mac 雙平台評估 |
| 2026-07-31 | §7.5：Flutter vs Capacitor（無 Mac 誤解、三種 Flutter 用法、工時對照） |
| 2026-07-31 | §7.2 雲 Mac 費用明細、§7.4 輕量偶爾打包定案與流程；§1 補充使用型態 |
| 2026-08-01 | §10 勾選 C0～C1 完成項；PROGRESS handoff；PWA 加入主畫面引導 |
| 2026-08-25 | 指向 PROGRESS §10 上架前逐步清單 |
