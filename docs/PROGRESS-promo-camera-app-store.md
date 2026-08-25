# 攝影模擬 App／Store 進度（handoff）

> **給日後接續用**：摘要 L4 Capacitor、線上 PWA、加入主畫面引導、**包成 App 還缺什麼**。  
> **規格母本：** [`PLAN-promo-camera-app-isolation-layer.md`](PLAN-promo-camera-app-isolation-layer.md)、[`PLAN-promo-camera-capacitor-app.md`](PLAN-promo-camera-capacitor-app.md)  
> **iOS 打包照做：** [`HOW-TO-promo-camera-ios-xcode-and-cloud.md`](HOW-TO-promo-camera-ios-xcode-and-cloud.md)（Mac Xcode／Codemagic）

**2026-08-25 補充：** 隔離包與 `sync-www` 已有；距離 Store 成品見下方 **§9**。人像清晰／氛圍／混合品質基準見 [`PROGRESS-promo-portrait-modes-baseline-2026-08-25.md`](PROGRESS-promo-portrait-modes-baseline-2026-08-25.md)。

---

## 0. 狀態總覽

| 項目 | 狀態 |
|------|------|
| **L4 隔離腳手架** | ✅ 已 push（`db4cd75`） |
| **Capacitor Android 本機可跑** | ✅ 已 push（`ff6e3ce`）；Pixel 7 模擬器 Run ▶ 成功 |
| **設計頁手機 embed → App 版面** | ✅ 已 push（`401dc70`～`922b8ef`） |
| **iOS／Android「加入主畫面」引導** | ✅ 本 commit 推送 |
| **Store 上架（IAP、登入 deep link、Codemagic iOS）** | ⏸ 日後再繼續 |

**遠端 `main` 最新 commit（截至文件撰寫）：** `922b8ef` — `fix(custom-product): hide empty mobile design preview canvas`

---

## 1. 四個表面（必守）

| 表面 | URL / 位置 | 說明 |
|------|------------|------|
| 原站 | `/promo-camera` | **凍結** — 不為 Store 改 |
| 設計 embed（桌面） | `/promo-camera?embed=design` | **凍結** |
| 線上 PWA | `/promo-camera-app` | 獨立 App 介面；**embed 與 PWA 引導為使用者核准之例外** |
| Store L4 | `apps/matchdo-promo-camera/` | Capacitor；`www/`、`android/` 不進 git |

Cursor 規則：`.cursor/rules/promo-camera-app-isolation.mdc`

---

## 2. 已推送 `main` 的 commit（本輪）

| Hash | 摘要 |
|------|------|
| `db4cd75` | L4 Store 隔離腳手架（`app-runtime.js`、`app-native-bridge.js` 占位、文件、規則） |
| `ff6e3ce` | Capacitor L4：`sync-www.mjs`、Android 專案、`capacitor-boot.js`、`patch-android-gradle.mjs` |
| `401dc70` | 設計頁手機 `tab=promo-camera` iframe 改載 `/promo-camera-app?embed=design` |
| `c0714c2` | embed 生成鈕固定底部；手機產品設計預覽全寬 |
| `922b8ef` | 手機產品設計：無結果／非 loading 時隱藏空白預覽區 |

---

## 3. PWA「加入主畫面」引導（已推送）

**僅** `/promo-camera-app` 獨立頁；**不**載入 `embed=design`。

| 檔案 | 內容 |
|------|------|
| `public/js/promo-camera/pwa-install-prompt.js` | iOS Safari 步驟引導、iOS 非 Safari 提示改用 Safari、Android `beforeinstallprompt` |
| `public/css/promo-camera-app.css` | 底部引導卡片樣式（`?v=20260801c`） |
| `public/client/promo-camera-app.html` | 載入上述 script |
| `public/locales/zh-TW.json`、`en.json` | `promoCamera.pwaInstall*` 文案 |

**行為摘要**

- iOS Safari（非 standalone）：約 0.8s 後底部彈出「分享 → 加入主畫面」
- iOS Chrome 等：提示「請用 Safari 開啟」
- Android Chrome：攔截 `beforeinstallprompt`，顯示「安裝到主畫面」
- 已從主畫面開啟、或 `embed=design`：不顯示
- 「稍後」7 天內不再提示；「不再提示」永久關閉（`localStorage`）

**限制：** Apple 不允許網頁程式自動觸發加入主畫面，只能引導使用者手動操作。

上線 matchdo.cc 後依 [`deploy-matchdo-push-and-deploy.md`](deploy-matchdo-push-and-deploy.md) **§3.1** Cloud Shell 部署。

---

## 4. L4 Capacitor（Android 本機）

### 4.1 目錄與腳本

```
apps/matchdo-promo-camera/
  capacitor.config.json
  package.json
  scripts/sync-www.mjs       ← public/ → www/（允許清單 copy + patch）
  scripts/patch-android-gradle.mjs  ← 中文路徑 android.overridePathCheck
  store/capacitor-boot.js    ← API origin + fetch 改寫（僅 www 副本）
  android/                   ← gitignore；本機 cap add 產生
  www/                       ← gitignore；sync 產生
```

`public/js/promo-camera/app-runtime.js`、`app-native-bridge.js` 存在 repo，**僅**經 sync 注入 Store bundle；**禁止**掛入線上 `promo-camera-app.html`。

### 4.2 Windows 本機流程（已驗證）

```powershell
cd apps/matchdo-promo-camera
npm install
npm run cap:sync          # sync:www + cap sync + patch android
npm run cap:open:android  # 或 cap:run:android
```

- 路徑含中文（`D:\AI建站\...`）：`patch-android-gradle.mjs` 會寫入 `android.overridePathCheck=true`
- 仍失敗可將 repo 移到純英文路徑（見 `apps/matchdo-promo-camera/README.md`）

### 4.3 已完成 vs 待做（Store）

| 項目 | 狀態 |
|------|------|
| `sync-www.mjs` + vendor（Bootstrap、Icons、Supabase） | ✅ |
| `capacitor-boot.js` API origin | ✅ |
| Android 模擬器可開攝影模擬 UI | ✅ |
| 登入 deep link / InAppBrowser 回 App | ⏸ |
| IAP + 後端 verify | ⏸ |
| iOS Codemagic pipeline | ⏸ |
| Play / App Store 上架素材 | ⏸ |

---

## 5. 設計頁手機 embed（custom-product）

**邏輯：** `public/js/custom-product.js` — `ensurePromoCameraEmbedLoaded`

- **≤991px**：iframe → `/promo-camera-app?embed=design`
- **桌面**：iframe → `/promo-camera?embed=design`（原站 embed，凍結）

**`promo-camera-app.html`：** query `embed=design` 時 body 加 `pc-embed-design`，隱藏 App topbar／footnote；生成 dock 固定底部（與獨立 App 一致）。

**手機產品設計 tab：** 預覽全寬；無結果且非 loading 時隱藏 `.create-panel-right` 空白區（`922b8ef`）。

---

## 6. iOS 使用者路線（已定案，Store 日後再做）

| 方式 | 成本 | 狀態 |
|------|------|------|
| **PWA** `/promo-camera-app` + 加入主畫面 | 免 Store 費 | 引導 UI 見 §3（待 push） |
| **App Store 原生殼** | Apple Developer USD 99/年 + Mac 或 Codemagic | ⏸ 見 Capacitor 規劃 §7 |

**不做：** Windows 上 Mac VM 繞過 iOS 簽章。

---

## 7. 日後 backlog（接續時從這裡開始）

1. Cloud Shell deploy §3 → iPhone Safari 實測 PWA 引導
2. **Capacitor C2**：登入 deep link、選項／上傳／生圖在真機／模擬器端到端
3. **Capacitor C3**：IAP + `POST /api/payment/iap/verify`（送審必備）
4. **Codemagic** iOS IPA → TestFlight（照 [`HOW-TO-promo-camera-ios-xcode-and-cloud.md`](HOW-TO-promo-camera-ios-xcode-and-cloud.md) §B；費用見 Capacitor 規劃 §7.4）
5. **Android AAB** Play 內測（Windows 本機可出）
6. **`sync-www.mjs`**：若 L3b 新增依賴（例 `pwa-install-prompt.js`），確認允許清單有 copy 進 Store bundle

---

## 8. 修訂紀錄

| 日期 | 說明 |
|------|------|
| 2026-08-01 | 初版 handoff；PWA 加入主畫面引導與文件一併 push |
| 2026-08-25 | 補 §9 缺口、**§10 上架前逐步清單** |

---

## 9. 包成 App：已有 vs 還缺（2026-08-25）

**範圍：** 只包 [`/promo-camera-app`](https://matchdo.cc/promo-camera-app) 一頁（及其靜態依賴），**不包**整站。Store 實驗只准改 `apps/matchdo-promo-camera/` + L4 專用 JS；**不要**為 Store 改原站 `/promo-camera`、線上 PWA HTML／`app-shell.js`。

### 9.1 已經有

| 項 | 位置 | 說明 |
|----|------|------|
| 線上 PWA | `/promo-camera-app` | 獨立殼、加入主畫面引導（§3） |
| 隔離包 L4 | `apps/matchdo-promo-camera/` | Capacitor；`www/`、`android/` 不進 git |
| 同步頁 | `scripts/sync-www.mjs` | 自 `promo-camera-app.html` 複製快照進 Store `www/`（允許清單） |
| Android 本機 | 模擬器曾 Run ▶ 成功 | 見 §4.2 |
| API | 現有 Cloud Run | Store 打 `https://matchdo.cc/api/*`（`capacitor-boot.js`） |

這還**不是**上架成品，只是殼與同步管線。

### 9.2 還缺（殼與上架，不是再做一個攝影頁）

| 缺口 | 說明 |
|------|------|
| 登入回 App | 深鏈／InAppBrowser：瀏覽器登完要回到 App |
| IAP + 後端核銷 | 送審幾乎必備；規劃 `POST /api/payment/iap/verify` 未做 |
| 原生橋 | `app-native-bridge.js` 仍是占位（相機、相簿、分享、IAP） |
| iOS 出包 | Apple Developer（約 USD 99／年）+ Mac 或 Codemagic → IPA → TestFlight |
| Android 上架 | Play 帳號（約 USD 25 一次）+ AAB 內測 |
| 商店素材 | 圖示、截圖、隱私權、年齡分級、說明 |
| sync 清單 | 線上 PWA 若新增 JS／CSS，確認允許清單有複製進 Store bundle |

**不必做：** 整站進 App、為 Store 改原站或線上 PWA 殼、用 Flutter 重寫這一頁。

### 9.3 建議順序

見下方 **§10**（逐步清單）。細節與費用：[`PLAN-promo-camera-capacitor-app.md`](PLAN-promo-camera-capacitor-app.md) §7。

---

## 10. 上架前逐步清單（2026-08-25）

**範圍：** 只包 `/promo-camera-app` 一頁。Store 只改 `apps/matchdo-promo-camera/` + L4（`app-runtime.js`／`app-native-bridge.js`）。**不要**為上架改線上 PWA 殼或原站。

**現況：** C0～C1 已完成（隔離包、`sync-www`、Android 模擬器可開頁、API origin）。C2 起未做。跟我說「做第 N 步」即可接著做。

### 你先準備（不寫程式，可與第 1～2 步並行）

| # | 項 | 狀態 | 誰做 |
|----|----|------|------|
| A | [Google Play](https://play.google.com/console) 開發者帳號 | ⏸ 約 USD 25 一次 | 你 |
| B | [Apple Developer](https://developer.apple.com/programs/) | ⏸ 約 USD 99／年；沒有就不能 TestFlight／IAP | 你 |
| C | 隱私權頁、支援 URL、客服信箱 | ⏸ Store 必填；站上尚無獨立隱私頁 | 你定文案，我可做成頁 |

### 開發步驟（依序；內測可先做 1～2，送審必須做到 5）

| 步 | 內容 | 完成才算過 | 狀態 |
|----|------|------------|------|
| **1** | 線上 PWA 真機驗 [`/promo-camera-app`](https://matchdo.cc/promo-camera-app) | iPhone Safari「加入主畫面」；登入、扣點、清晰／氛圍／混合生圖 | ⏸ 你測；品質基準 `8b998fe` |
| **2** | Windows 再打 Android 殼 | `apps/matchdo-promo-camera` → `npm run cap:run:android`；能開 UI、參數、打 `matchdo.cc` API | ⏸ 模擬器曾開過頁；**登入回 App、真機生圖未驗** |
| **3** | 登入回 App | 系統瀏覽器／InAppBrowser 開登入 → Deep Link 回 App 仍是同一 session | ⏸ C2 核心 |
| **4** | 原生相簿／相機／分享 | 實作 `app-native-bridge.js`（套件已在 `package.json`，橋仍是空的） | ⏸ 可與 3 同輪，但別改線上 PWA |
| **5** | IAP + 後端核銷 | App 內買點；`POST /api/payment/iap/verify` 寫入點數；**禁止** App 內開綠界 | ⏸ 送審幾乎必備 |
| **6** | 商店素材 | 1024² 圖示、Splash、手機截圖、年齡分級、審查說明（攝影模擬工具） | ⏸ |
| **7** | Android AAB → Play **內測** | 封閉測試跑通登入＋生圖＋（若已做）IAP | ⏸ |
| **8** | iOS：Codemagic → TestFlight | 照 [`HOW-TO-promo-camera-ios-xcode-and-cloud.md`](HOW-TO-promo-camera-ios-xcode-and-cloud.md)；Windows 打不出 IPA | ⏸ 需完成 B |
| **9** | 雙平台正式送審 | 去掉外開儲值；隱私問卷、IAP 商品過審 | ⏸ |

**這一步不要做：** 整站進 App、Flutter 重寫、為 Store 改 `promo-camera-app.html`／`app-shell.js`、把未完成 IAP 的包送正式審核。
