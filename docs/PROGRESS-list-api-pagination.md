# 列表 API 分頁（官方庫 500 與後續）

**日期：** 2026-08-24

官方版型庫曾因「畫面有分頁、API 一次撈全部」導致 500。此檔記下已修項目，以及核對媒體牆／數位資產庫後**尚未改**的同類風險。

---

## 已修：`GET /api/me/vendor-assets` 全量查詢

**現象：** `/client/manufacturer-materials.html?official_platform=1&manage=1` 列表空白，Network 顯示 `GET /api/me/vendor-assets` → 500 `{ error: '系統錯誤' }`。

**原因：** 前端已有 12／24／48 分頁，但 API 仍回傳該廠商**全部** `vendor_assets`（含 `gallery_images`、`image_semantics_json`），再在瀏覽器切頁。官方庫一多就炸。

**修法：** 請求帶 `limit` 時後端 `.range()` 只查當頁；回傳真實 `total`。關聯勾選另走 `lite=1`。頁面 build：`me-assets-page-20260824`。

**仍全量（故意保留）：** 未帶 `limit` 的呼叫（dashboard 計數、insights、embed 設計紀錄）。日後若也 500，再改那些入口，勿直接讓無 `limit` 變成預設分頁（計數會錯）。

---

## 已核對：媒體牆 — 無同樣問題

`GET /api/media-wall` 依 `page` + `per_page` 用 `.range()`（預設約 33～48，上限 100）。「載入更多」是下一頁。搜尋／標籤有上限池（約 100）；情境圖子類最多約 500。**不必為官方庫那次 500 去改媒體牆。**

---

## 待做：我的數位資產／收藏（先記下，未開工）

核對頁：`/client/my-custom-products.html`。**不要**把列表做成設計頁 `?tab=`。

| 項目 | 現況 | 風險 |
|------|------|------|
| **設計稿** | `GET /api/custom-products?list=1` 每次 24 筆，下滑再要下一頁 | 無（同類問題已避開） |
| **我的最愛** | `GET /api/me/favorites` **無分頁**，整包 `item_data` | 收藏變多時可能重演「一次撈全部」。呼叫端：`my-custom-products.html`、首頁 `syncFavsFromDB`、`public/js/digital-asset-picker.js` |
| **材料組合／印花／情境圖** | API 已有 `limit`／`offset`（上限 50），畫面只載最新 **48** 筆、沒有「載入更多」 | 不會 500；超過 48 筆看不到更舊的 |

建議下次做：**最愛**改成與設計稿相同的 `limit`＋`offset`（三個呼叫端一併改）；組合／印花／情境圖補無限捲動或分頁鈕（API 已就緒）。
