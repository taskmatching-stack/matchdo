# Matchdo 攝影模擬 — Store App（L4）

**Capacitor／App Store 專用工作區。不是線上 `/promo-camera-app`。**

## 基準

與雲端一致之 commit：`f5dceeb`（見 `docs/PLAN-promo-camera-app-isolation-layer.md`）。

## 凍結（Store 前置期間勿改）

- `/promo-camera`、`/promo-camera?embed=design`
- `/promo-camera-app`（`promo-camera-app.html`、`promo-camera-app.css`、`app-shell.js`）

## 下一步（Capacitor init 時再做）

1. 讀 `docs/PLAN-promo-camera-app-isolation-layer.md`
2. 讀 `docs/PLAN-promo-camera-capacitor-app.md` §1A（B+ 原生插件）
3. 在本目錄 `npx @capacitor/cli init`
4. 複製 `public/client/promo-camera-app*`、`public/css/promo-camera-app.css` 等至 `www/`（快照，不直接改 L3b 源檔）
5. Store bundle 額外載入：
   - `/js/promo-camera/app-runtime.js`
   - `/js/promo-camera/app-native-bridge.js`（待建）

## L4 專用 JS（repo 根目錄，未掛線上 PWA）

| 檔案 | 用途 |
|------|------|
| `public/js/promo-camera/app-runtime.js` | channel、Capacitor 殼偵測 |
| `public/js/promo-camera/app-native-bridge.js` | 原生 API 橋（待建） |
