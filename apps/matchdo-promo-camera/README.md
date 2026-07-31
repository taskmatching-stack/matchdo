# MATCHDO 攝影模擬 — Store App（Capacitor L4）

**不是**線上 [`/promo-camera-app`](https://matchdo.cc/promo-camera-app)。線上 PWA 凍結；Store 版在此目錄開發。

## 需求

- Node.js 18+
- Android Studio + JDK（Android 本機建置）
- iOS：需 macOS 或 Codemagic（見 `docs/PLAN-promo-camera-capacitor-app.md` §7）

## 第一次設定

```bash
cd apps/matchdo-promo-camera
npm install
npm run sync:www
npx cap add android
npm run cap:sync
```

## 日常開發

```bash
cd apps/matchdo-promo-camera
npm run cap:run:android
```

或同步後用 Android Studio 開啟：

```bash
npm run cap:sync
npm run cap:open:android
```

## `www/` 怎麼來

**不要手改 `www/`。** 執行 `npm run sync:www` 會：

1. 自 `public/client/promo-camera-app.html` 產生 `www/index.html`（相對路徑、去 CDN）
2. 複製 CSS/JS/圖/locales（**不修改** repo 內 L3 源檔）
3. 在 `www/` 副本 patch 登入／儲值連結 → `https://matchdo.cc/...`
4. 注入 L4：`store/capacitor-boot.js`、`app-runtime.js`、`app-native-bridge.js`
5. Vendor Bootstrap 5.0.0、Bootstrap Icons、Supabase JS

## API

Store 版打 **`https://matchdo.cc/api/*`**（`store/capacitor-boot.js` 改寫 fetch）。後端仍用現有 Cloud Run，無需另 deploy API。

## 參考

- 隔離層：`docs/PLAN-promo-camera-app-isolation-layer.md`
- 完整規劃：`docs/PLAN-promo-camera-capacitor-app.md`
