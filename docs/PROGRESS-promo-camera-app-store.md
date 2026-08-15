# 攝影模擬 App／Store 進度（handoff · 2026-08-01）

> **給日後接續用**：摘要 L4 Capacitor、線上 PWA 嵌入、iOS「加入主畫面」引導之已完成項、**未推送本機改動**、下一步 backlog。  
> **規格母本：** [`PLAN-promo-camera-app-isolation-layer.md`](PLAN-promo-camera-app-isolation-layer.md)、[`PLAN-promo-camera-capacitor-app.md`](PLAN-promo-camera-capacitor-app.md)  
> **iOS 打包照做：** [`HOW-TO-promo-camera-ios-xcode-and-cloud.md`](HOW-TO-promo-camera-ios-xcode-and-cloud.md)（Mac Xcode／Codemagic）

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
