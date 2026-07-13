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
- `editGalleryDisplayUrl` — **主圖區永遠回傳原圖 URL**（禁止把上方換成重繪圖）
- `editGalleryPreviewBlock` — 下方：上傳原圖勾選＋重繪／放大／寫實化**新圖**縮圖＋上傳此張（與待傳清單同序）
- `previewGallerySlotRedraw` — 編輯區重繪入口（**不是** `redrawGalleryImage`）
- `applyEditGallerySlotPreview` / `flushEditGallerySlotPreviewsBeforeSave`

Build 標記：`window.__MATCHDO_MATERIALS_BUILD` ≥ `redraw-top-original-bottom-new-20260713`

## 曾犯錯誤（勿重演）

| Commit / 做法 | 錯誤 |
|--------|------|
| `ddd55a0` | `galleryCardsFromItems`：每筆 `image_items` 一卡、「不區分衍生／原圖」 |
| `6d08923` | 為了「對衍生圖再重繪」而 flatten 編輯卡片 |
| `efa3dd1` onlyNew 路徑／後續誤還原 | **上方顯示重繪、下方塞原圖**（與待傳相反）→ 勾選語意矛盾 |

後果：使用者看到「AI 重繪自動加成新圖」、原圖／新圖勾選消失、與待傳清單 UX 不一致，連帶搞壞多項互動。

## Agent 自查（改 materials 圖庫前必過）

- [ ] 編輯區「AI 重繪」是否仍走 **preview**，而非一按就 `gallery-images/redraw` 追加？
- [ ] **上方是否仍是原圖、下方才是重繪新圖**（與待傳清單一致）？
- [ ] 新圖是否仍在**同一格**下方（含已存 `ai_derived`）？
- [ ] 是否仍有「上傳原圖／上傳此張」勾選，且預設只傳新圖？
- [ ] 有無把 `groupGalleryDisplayItems` 改回 flat list？

任一項否 → **停止並還原**，先問使用者。
