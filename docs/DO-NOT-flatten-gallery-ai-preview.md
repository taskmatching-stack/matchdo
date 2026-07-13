# 禁止：把 AI 重繪改成「自動加成獨立新圖卡片」

> **狀態：** 強制遵守（2026-07-13 使用者再次強調）  
> **相關規則：** `.cursor/rules/minimal-change-healthy-code.mdc` §2b  
> **進度檔：** `docs/PROGRESS-vendor-asset-gallery-edit.md`

## 正確 UX（已驗收、不可擅自改）

1. 點「AI 重繪」→ `POST /api/me/vendor-assets/preview-image-redraw`（**只預覽、扣點**）
2. **同一格**出現：主圖（原圖）＋下方新圖縮圖＋勾選「上傳原圖」「上傳此張」
3. 按「儲存」→ 依勾選寫入（新圖可帶 `ai_derived` + `source_url` 掛在原圖下）
4. 已寫入的衍生圖：**仍顯示在原圖同一格**（可勾選／清除），**不要**變成旁邊多一張獨立卡片

前端關鍵函式（`public/client/manufacturer-materials.html`）：

- `groupGalleryDisplayItems` — 依 `source_url` 併格
- `ensureEditGallerySlotForGroup` — 已存衍生圖→同格勾選 UI
- `editGalleryPreviewBlock` — 僅傳新圖時顯示「原圖」對照縮圖
- `previewGallerySlotRedraw` — 編輯區重繪入口（**不是** `redrawGalleryImage`）
- `applyEditGallerySlotPreview` / `flushEditGallerySlotPreviewsBeforeSave`

Build 標記：`window.__MATCHDO_MATERIALS_BUILD` ≥ `gallery-same-card-checkbox-20260713`

## 曾犯錯誤（勿重演）

| Commit | 錯誤 |
|--------|------|
| `ddd55a0` | `galleryCardsFromItems`：每筆 `image_items` 一卡、「不區分衍生／原圖」 |
| `6d08923` | 為了「對衍生圖再重繪」而 flatten 編輯卡片 |

後果：使用者看到「AI 重繪自動加成新圖」、原圖／新圖勾選消失、與待傳清單 UX 不一致，連帶搞壞多項互動。

## Agent 自查（改 materials 圖庫前必過）

- [ ] 編輯區「AI 重繪」是否仍走 **preview**，而非一按就 `gallery-images/redraw` 追加？
- [ ] 新圖是否仍在**同一格**下方（含已存 `ai_derived`）？
- [ ] 是否仍有「上傳原圖／上傳此張」勾選，且預設只傳新圖？
- [ ] 有無把 `groupGalleryDisplayItems` 改回 flat list？

任一項否 → **停止並還原**，先問使用者。
