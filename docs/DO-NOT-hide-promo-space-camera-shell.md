# 商攝・空間模式 — 禁止再藏右側相機殼（第四次禁止重演）

## 使用者定案

**空間攝影**（含 **ISO 空間地圖 `layout_plan`** 與 **平視 `eye_level`**）右側 **相機控制台一律顯示**（鏡頭、光圈、EV、底片／品牌色彩）。參數會組進 Gemini prompt（`buildPromoSpaceLayoutCameraBlock` / `buildPromoSpaceEyeLevelCameraBlock`）。

## 嚴禁

| 禁止 | 為何 |
|------|------|
| `space && !isSpaceEyeLevel()` 時對 `.pc-camera-shell` 加 `d-none` | ISO 地圖也需要相機參數；使用者已四次回報「相機不見了」 |
| 只在 `#promo-camera-app` 改 visibility 卻以為 web `/promo-camera` 不同規則 | 兩入口共用 `#promo-camera-app` 容器與 `index.js` |
| 以「layout 走 Gemini 不用 FLUX」為由整塊藏 UI | 空間仍走 **camera param → prompt 句**，只是 provider 是 Gemini |

## 正確

| 項目 | 做法 |
|------|------|
| 相機殼 | `syncCameraShellVisibility()` — **永遠** `classList.remove('d-none')` |
| 產品專用 | 拍攝角度、人物保留 — `pc-product-only`（空間／人像可藏） |
| 改 UI 前 | 讀 `docs/PLAN-promo-camera-shoot-modes.md` §14.3 |

## 參考

- `public/js/promo-camera/index.js` — `syncCameraShellVisibility`、`applyShootModeUi`
- `public/js/promo-camera/state.js` — `buildGeneratePayload` 空間分支含 `camera`
- `docs/PROGRESS-promo-camera-space-eye-level.md`
