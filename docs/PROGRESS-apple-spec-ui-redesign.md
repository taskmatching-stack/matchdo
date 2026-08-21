# 設計稿／商攝導演 — Apple 規格選購風 UI（可收折）

## 基準版本（改版前凍結）

| 項目 | 值 |
|------|-----|
| **Baseline commit** | `b2c4d49`（`b2c4d499fe4855ecd20a47f3f64584edcfaaeeb8`） |
| **訊息** | `feat(admin): promo camera card with editable Gemini/FLUX model ids` |
| **日期** | 2026-08-21 |
| **還原** | `git checkout b2c4d49 -- public/client/promo-camera.html public/css/promo-camera.css public/custom-product.html`（依實際改動檔補列） |

之後若需對照「改 UI 前」行為，以此 commit 為準。

## 範圍

| 做 | 不做 |
|----|------|
| 左欄／表單區：可收折規格區塊＋Apple 風外觀 | 改生圖／扣點／API／state |
| 收折摘要文案（純展示） | 精靈式強制步驟 |
| | **商攝右側相機殼與光學攝影參數** |
| | 不重寫 App 選擇器／chips（只包進新收折） |

## 分期

1. **商攝導演** `/promo-camera` — 產品／人像／空間左欄收折（參數殼不動）
2. **設計稿** `/custom-product.html` — 分類＋參考圖槽收折

## 進度

| 項目 | 狀態 |
|------|------|
| Baseline 記錄 | ✅ `b2c4d49` |
| 商攝左欄可收折規格區（`/promo-camera`） | ✅ |
| 設計稿左欄可收折規格區 | ✅ |
| App／手機（`/promo-camera-app`）同分區收折＋標題設定值 | ✅（保留 App 選擇器／chips／相機殼；拿掉舊「情境／輸出」單層收折） |
| 選項改成可點選 Apple 大卡（取代 select） | ⏸ 下一期 |