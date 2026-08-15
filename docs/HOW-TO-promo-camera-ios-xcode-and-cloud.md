# 攝影模擬 App — iOS 打包手冊（Mac Xcode／雲端）

> **用途**：之後要用 Xcode 或雲端打 IPA／TestFlight 時照這份做。  
> **範圍**：只包商攝導演 App（`/promo-camera-app`），**不包**整站。  
> **子專案**：`apps/matchdo-promo-camera/`（Capacitor L4）  
> **規格母本**：[`PLAN-promo-camera-capacitor-app.md`](PLAN-promo-camera-capacitor-app.md) §7  
> **進度**：[`PROGRESS-promo-camera-app-store.md`](PROGRESS-promo-camera-app-store.md)  
> **隔離規則**：`.cursor/rules/promo-camera-app-isolation.mdc`（禁止為 Store 改線上 PWA／原站）

**狀態（寫入手冊時）**

| 項目 | 狀態 |
|------|------|
| Android 本機可跑 | ✅ |
| `ios/` 專案 | ⏸ 尚未 `cap add ios`（需 Mac 或雲端首次產生） |
| Codemagic pipeline | ⏸ 尚未建 |
| IAP／登入 deep link | ⏸ 上架前必做；內測殼可先不做 |

---

## 0. 先選哪一條路

| 情境 | 建議 |
|------|------|
| 有 Mac，要手動調 UI／簽章／除錯 | **A. 本機 Mac + Xcode** |
| 日常在 Windows，偶爾打一版給 TestFlight | **B. Codemagic 雲端**（本專案定案首選） |
| 第一次簽章卡住、要開完整 Xcode | Codemagic 向導優先；必要時 **MacinCloud** 租 1～2 小時 |

**共通前提（兩條路都要）**

1. [Apple Developer Program](https://developer.apple.com/programs/)（約 USD 99／年）
2. [App Store Connect](https://appstoreconnect.apple.com/) 已建 App（Bundle ID 建議：`cc.matchdo.promocamera`，與 Android 對齊）
3. 網站 API 已上線：`https://matchdo.cc`（App 內靜態檔打線上 API，見 `store/capacitor-boot.js`）
4. **不要**手改 `www/`；一律 `npm run sync:www`／`npm run cap:sync` 產生

**Windows 本機無法完成**：iOS 編譯、簽章、上傳 App Store。只能在 Mac 或雲端 Mac 做。

---

## A. 本機 Mac + Xcode

### A.1 環境

- macOS + 最新穩定版 **Xcode**（含 Command Line Tools）
- Node.js 18+
- 本機已登入 Apple ID（Xcode → Settings → Accounts）
- 建議路徑**不要**含奇怪字元；若從 Windows 複製 repo，用 git clone 到例如 `~/matchdo`

### A.2 第一次（產生 `ios/`）

```bash
cd apps/matchdo-promo-camera
npm install
npm run sync:www
npx cap add ios
npm run cap:sync
# 若尚未加 Android 腳本對稱指令，可：
# npx cap open ios
```

之後可把下列 script 加進 `package.json`（尚未加時用 `npx`）：

```json
"cap:open:ios": "npx cap open ios",
"cap:run:ios": "npm run cap:sync && npx cap run ios"
```

### A.3 日常改版 → 開 Xcode

```bash
cd apps/matchdo-promo-camera
# 先在 repo 改 public/ 下允許清單內的檔（或 L4 store 檔），再：
npm run cap:sync
npx cap open ios
```

在 Xcode：

1. 左側選 **App target**（通常是 `App`）
2. **Signing & Capabilities**
   - Team：你的 Developer Team
   - Bundle Identifier：`cc.matchdo.promocamera`（或 Connect 已建的 ID）
3. 選模擬器或真機 → **Run ▶**
4. 要上傳：選 **Any iOS Device (arm64)** → **Product → Archive**
5. Organizer → **Distribute App** → App Store Connect → 上傳
6. 到 App Store Connect → TestFlight 處理完再加測試員

### A.4 注意

| 項目 | 說明 |
|------|------|
| `ios/` 是否進 git | 可進 git 方便 CI；若暫不 commit，每位 Mac／CI 都要能 `cap add ios` |
| 路徑／中文 | Mac 通常沒事；Windows 建 Android 才需 `android.overridePathCheck` |
| 改 Web UI | 改 `public/` 允許清單來源 → `sync:www` → `cap sync`；**不要**只改 `www/` |
| 線上 PWA | **禁止**為 Store 改 `promo-camera-app.html`／`app-shell.js` 行為；Store 專用邏輯走 L4 `app-runtime.js`／`app-native-bridge.js` |
| 儲值 | 正式上架必須 **Apple IAP**；不可 App 內開綠界 credits |

### A.5 遠端租 Mac（等同本機 Xcode）

沒有實體 Mac、但要手動開 Xcode 時：

| 服務 | 何時用 |
|------|--------|
| [MacinCloud](https://www.macincloud.com/) Pay-as-you-go | 偶爾 1～2 小時踩簽章坑 |
| MacStadium／AWS EC2 Mac | 長期天天用（本專案**通常不必**） |

遠端桌面連上後，流程同 **A.2～A.3**。

---

## B. 雲端打包（Codemagic · 定案首選）

適合：開發在 Windows、每月打 0～4 次 IPA、不想買 Mac。

### B.1 帳號與連線

1. 註冊 [Codemagic](https://codemagic.io/)（個人帳號有 **每月約 500 分鐘** macOS 免費額，以官網為準）
2. 連接 GitHub repo（`taskmatching-stack/matchdo` 或目前遠端）
3. App Store Connect 建立：
   - App
   - **App Store Connect API Key**（Issuer ID、Key ID、`.p8`）
4. 在 Codemagic 上傳／填入：
   - API Key（自動上傳 TestFlight）
   - 或手動管理憑證／Provisioning（Codemagic 向導可產生）

### B.2 專案設定要點

| 項目 | 建議 |
|------|------|
| 工作目錄 | `apps/matchdo-promo-camera` |
| 建置前 | `npm ci` → `npm run sync:www` → `npx cap add ios`（若尚無 `ios/`）→ `npx cap sync ios` |
| Xcode project | Capacitor 預設 `ios/App/App.xcworkspace` |
| Bundle ID | 與 Connect 一致 |
| 觸發 | `main` push（或手動 Run）；可限路徑 `apps/matchdo-promo-camera/**` |
| 產物 | IPA → 自動上傳 TestFlight |

**建議流程（Windows 開發者）**

```
1. 改 public/ 允許清單或 L4 檔 → git push main
2. （可選）Windows：npm run cap:sync 測 Android
3. Codemagic 偵測 push → Mac runner 打 iOS → TestFlight
4. iPhone 用 TestFlight 安裝驗證
```

網站 Cloud Run 部署與 App 打包**分開**：網站仍用既有 `docs/deploy-matchdo-push-and-deploy.md` §3.1。

### B.3 首次建 `codemagic.yaml` 時（待實作檢查清單）

Repo 根或 `apps/matchdo-promo-camera/` 可放 `codemagic.yaml`（尚未建立時依此補）：

- [ ] `working_directory: apps/matchdo-promo-camera`
- [ ] Node 18+
- [ ] `npm ci && npm run sync:www`
- [ ] 若無 `ios/`：`npx cap add ios`
- [ ] `npx cap sync ios`
- [ ] Xcode archive + 簽章
- [ ] 上傳 App Store Connect／TestFlight
- [ ] 機密：API Key、憑證只放 Codemagic Environment，**勿** commit `.p8`／p12 進 git

細節與費用見 [`PLAN-promo-camera-capacitor-app.md`](PLAN-promo-camera-capacitor-app.md) §7.2～§7.4。

### B.4 備援：GitHub Actions macOS

可自架 workflow（macOS runner 較貴／額度倍率高）。本專案**優先 Codemagic**；Actions 當備援即可。

---

## C. 兩條路對照

| 步驟 | A. Mac Xcode | B. Codemagic |
|------|--------------|--------------|
| 產生 `ios/` | `npx cap add ios` | CI 內同指令（或先 commit `ios/`） |
| sync Web | `npm run cap:sync` | CI：`sync:www` + `cap sync ios` |
| 簽章 | Xcode Signing UI | Codemagic + ASC API Key |
| 上傳 | Archive → Distribute | 自動 → TestFlight |
| 除錯 UI | 模擬器／真機最方便 | 適合出正式內測包 |
| 無 Mac | 不行（除非租遠端 Mac） | 可以 |

---

## D. 上架前仍缺（與「能不能打出 IPA」分開）

打出 IPA ≠ 能過審。正式 Store 前還要：

| # | 項目 | 說明 |
|---|------|------|
| 1 | 登入回 App | InAppBrowser／系統瀏覽器 + Universal Link／Deep Link |
| 2 | Apple IAP + 後端 verify | 不可 App 內綠界 |
| 3 | 隱私權／支援 URL | Store 必填 |
| 4 | 圖示、Splash、截圖 | 與 PWA manifest 分開 |
| 5 | 審核文案 | 說明為攝影模擬工具、點數用途 |

內測階段可先「能開頁、能打 API」；**不要**把「外開綠界儲值」的包送正式審核。

---

## E. 相關檔案速查

| 路徑 | 用途 |
|------|------|
| `apps/matchdo-promo-camera/` | Capacitor 子專案 |
| `apps/matchdo-promo-camera/README.md` | Android 日常指令 |
| `apps/matchdo-promo-camera/scripts/sync-www.mjs` | `public/` → `www/` |
| `apps/matchdo-promo-camera/store/capacitor-boot.js` | API origin 改寫 |
| `public/js/promo-camera/app-runtime.js` | L4 僅 Store |
| `docs/PLAN-promo-camera-capacitor-app.md` | 完整規劃與費用 |
| `docs/PROGRESS-promo-camera-app-store.md` | 進度 handoff |
| `docs/DO-NOT-hide-promo-space-camera-shell.md` | 與空間相機殼無關；打包時勿改錯層 |

---

## F. 修訂紀錄

| 日期 | 說明 |
|------|------|
| 2026-08-15 | 初版：彙整 Mac Xcode 與 Codemagic／雲端打包步驟，供日後照做 |
