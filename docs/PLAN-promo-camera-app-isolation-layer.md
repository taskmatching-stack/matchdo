# 攝影模擬 Store 隔離層（L4 前置環境）

## 基準版本（建置前核對）

建置本隔離層時，本機須與雲端一致：

```text
git fetch origin main
git rev-parse HEAD
git rev-parse origin/main
# 兩者相同且 working tree clean
```

**建 L4 前基準 commit：** `f5dceeb`（`feat(promo-camera): account-owned camera preset save and apply`）

**L4 腳手架完成後遠端 HEAD：** `922b8ef`（詳見 [`PROGRESS-promo-camera-app-store.md`](PROGRESS-promo-camera-app-store.md)）

---

## 四個表面

| 表面 | URL / 位置 | 前置期間 |
|------|------------|----------|
| 原站 | `/promo-camera` | **凍結** — 不為 Store 改 |
| 設計 embed | `/promo-camera?embed=design` | **凍結** |
| 線上 PWA | `https://matchdo.cc/promo-camera-app` | **凍結** — 不為 Store 改 |
| Store 實驗 | `apps/matchdo-promo-camera/` | **只在此開發** |

線上 PWA 現行 script 順序（`922b8ef` 起；**Store 前置期勿擅自改序**）：

```text
api.js → state.js → index.js → presets.js → app-shell.js → pwa-install-prompt.js
```

`pwa-install-prompt.js`：僅獨立 `/promo-camera-app`；`embed=design` 不載入。見 [`PROGRESS-promo-camera-app-store.md`](PROGRESS-promo-camera-app-store.md) §3。

---

## 分層

| 層 | 路徑 | 說明 |
|----|------|------|
| L0 | `api.js`, `state.js` | 狀態與 API；Store 前置期僅修三入口共用 bug |
| L1 | `index.js` | 相機 DOM、生圖；同上 |
| L2 | `presets.js` 等 | Web + 線上 PWA 共用；使用者明確要求才改 |
| L3a | `promo-camera.html`, `promo-camera.css` | 原站 + embed（凍結） |
| L3b | `promo-camera-app.html`, `promo-camera-app.css`, `app-shell.js` | 線上 PWA（凍結） |
| **L4** | `apps/matchdo-promo-camera/`, `app-runtime.js`, `app-native-bridge.js` | Store／Capacitor 專用 |

---

## L4 腳本（僅 Store bundle，不掛線上 PWA）

```text
api.js → state.js → app-runtime.js → index.js → presets.js → app-shell.js → app-native-bridge.js
```

- `app-runtime.js`：channel 注入、Capacitor 偵測（**不得**加入 `promo-camera-app.html`）
- `app-native-bridge.js`：相機、相簿、IAP、Share（待實作）

Capacitor 初始化時，自 L3b **複製快照**到 `apps/matchdo-promo-camera/www/`，在 L4 內修改，不直接改 repo 內 L3b 檔。

---

## Store 開發檢查清單

1. `git status` 是否動到 L3a／L3b？→ 還原，改 L4
2. 是否把 `app-runtime.js` 加進 `promo-camera-app.html`？→ **禁止**
3. `/promo-camera` 與 `/promo-camera-app` 行為與基準 commit 一致
4. 新 UI／原生功能只在 `apps/matchdo-promo-camera/` 或其 bundle

---

## 參考

- **進度 handoff：** [`PROGRESS-promo-camera-app-store.md`](PROGRESS-promo-camera-app-store.md)
- Cursor 規則：`.cursor/rules/promo-camera-app-isolation.mdc`
- Capacitor／Store：`docs/PLAN-promo-camera-capacitor-app.md`
- L4 目錄：`apps/matchdo-promo-camera/README.md`
