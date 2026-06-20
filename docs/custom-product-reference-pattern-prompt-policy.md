# 訂製設計頁 — 參考圖槽 × 原圖印刷提示詞政策（通用性必守）

**更新**：2026-06-18  
**狀態**：**強制**（改 `composeGeneratePromptWithReferences`、`buildFluxReferenceFactsAppendix`、`public/js/custom-product.js` 參考槽前必讀）  
**相關**：`docs/flux-and-gemini-prompt-policy.md`、`docs/custom-product-subcategory-prompt-guide.md`、`docs/ref-tabs-vs-customization-levels.md`

---

## 1. 一句話

**原圖印刷 = 任意表面圖稿／印花／圖案的原樣套印，不是「Logo 專用管線」。**  
**風格參考 = 只借風格，不逐字複製圖稿。**

提示詞、UI 文案、後端 FLUX 附錄一律用 **通用「surface graphic / artwork / pattern」** 語意；**禁止**為單一案例（品牌 Logo、Match DO 等）寫死 lockup／wordmark／勿重打字長文。

---

## 2. 設計頁參考槽（2026-06 現行）

| Tab | `asset_kind` | `pattern_intent` | 用途 |
|-----|--------------|------------------|------|
| 原型 | `prototype` | — | 造型、輪廓、比例、結構 |
| 材料 | `material` | — | 本體表面質感／色（非零件） |
| 配件 | `part` | — | 五金、拉鍊、掛繩等 |
| **原圖印刷** | `other` | `print` | **圖稿／印花／圖案原樣套印**；可勾選去背 |
| **風格參考** | `other` | `style` | 表面風格參考；可用主提示詞指定，或不填讓 AI 設計 |

- 舊單一「圖樣」Tab + 下拉已廢；**不可**再合併回一槽。
- 前端：`public/js/custom-product.js` → `REF_INTENT_SLOTS`  
- 後端排序：`reorderFluxReferenceInputs` / `fluxReferenceSourceRank`

---

## 3. 送 FLUX 的 image 編號（有圖才佔號）

**順序（與 UI Tab 列順序無關，與 payload 一致）：**

```text
原型 → 配件 → 材料 → 原圖印刷 → 風格參考
→ image 1 … N
```

- 空 Tab **不佔** image 編號。
- 編號由 **後端** `buildFluxReferenceUiSlotSummary` 依實際 `referenceSources` 順序產生。
- **禁止**在前端 Tab 下方顯示「image 對照／設計頁已選…」等除錯摘要（使用者不必看）。

---

## 4. 原圖印刷 vs 風格參考（業務語意）

| | 原圖印刷 Tab | 風格參考 Tab |
|---|-------------|-------------|
| 參考內容 | Logo、字標、插畫、全幅印花、照片圖、幾何圖案、條碼、圖騰… | 配色／筆觸／裝飾風格 |
| 預期輸出 | **與參考圖相同的圖稿**套在產品可印刷面上 | **啟發式**表面設計；可跟使用者主提示詞，或 AI 自由發揮 |
| API 欄位 | `pattern_intent: 'print'` | `pattern_intent: 'style'` |
| 去背 | `pattern_remove_bg: true` 時附錄加「去背後合成」 | 不適用 |

**通用性要求：** 文案與 FLUX 句型必須同時適用於：

- 品牌 Logo／字標  
- 全幅花卉、幾何 repeat  
- 插畫、照片、QR、條碼  
- 單色線稿、彩色圖案  

**不得**把原圖印刷窄化成「Logo branding」「wordmark lockup」專用流程。

---

## 5. 後端 FLUX 附錄 — 允許與禁止

### 5.1 組裝順序（`composeGeneratePromptWithReferences`）

```text
1. DB 子分類 prompt（2×2 Split-view 劇本等）
2. buildFluxReferenceFactsAppendix（參考圖角色、材料 Gemini JSON）
3. 勾選工藝 visual_hint（若有）
4. 使用者描述（可空；有參考圖時允許不填）
```

- **禁止**在附錄後再疊第二、第三段「Logo 專用長文」覆蓋通用角色句。
- **禁止**為「勿把 Match DO 打成 DO」等個案加 **title  regex** 或 **省略所有 print 標題** 的隱藏規則；若標題會誤導模型，應改 **Gemini／使用者描述**，不是寫死 skip title。

### 5.2 原圖印刷 — 現行唯一正確角色句（英文，送 BFL 前可整段翻譯）

**`fluxReferenceKindRoleLine`（`pattern_intent !== 'style'`）：**

```text
Exact surface graphic from image {n} printed on the same main product body in every panel;
artwork must match image {n}.
```

**`buildFluxReferenceApplySummary`：**

```text
exact surface graphic from image {n} on the same product in all panels
```

**去背（僅 `pattern_remove_bg === true`）：**

```text
Remove solid background from image {n} before compositing the surface artwork onto the product.
```

### 5.3 風格參考 — 角色句

```text
Style reference (image {n}) … inspired look only, no literal copy.
```

### 5.4 嚴禁（曾造成退步，勿再犯）

| 禁止 | 原因 |
|------|------|
| `logo lockup` / `wordmark` / `brand artwork` 整段專用 block | 窄化為 Logo；插畫／印花失效 |
| `Do not retypeset…` 長段重複多次 | 模型反而當「文字生成」任務 |
| 原圖印刷附錄帶 **asset 標題** | 標題可能含字樣，模型當文字任務 |
| 前端／附錄自動塞 `image 1=原型→…` | 使用者未寫就不加；image 編號僅 BFL 內部對位 |
| 檔名／`material_key` 查表推圖案內容 | 違反 `flux-and-gemini-prompt-policy.md` |
| 2×2 四格各秀一張參考圖 | 違反 `custom-product-subcategory-prompt-guide.md` |

### 5.5 2×2 型錄（與子分類 prompt 一致）

- 輸出 **一張圖、2×2 四格**；四格 **同一合成成品**，僅 Split-view 視角不同。  
- 參考圖只提供 **特徵**（造型、材料、配件、圖稿），**不得**各格各秀一張參考照片。  
- 見 `buildFluxCatalogCompositeRefLead()`。

---

## 6. 前端行為

| 項目 | 規則 |
|------|------|
| 生圖 prompt | 主提示詞 + 各槽 addon + 各圖 note（**槽名**開頭，不寫 image 編號） |
| 有參考無描述 | **允許**生圖（後端靠分類 prompt + 參考附錄） |
| 自動建議 | **不要**把 image 編號對照、2×2 說明自動灌進 textarea |
| 原圖印刷 UI | 文案用「圖稿／印花」，不用「僅 Logo」 |
| 去背 | 每張 print 圖可勾選；送 `pattern_remove_bg` |

---

## 7. 子分類 DB prompt 撰寫提醒

後台 `custom_product_subcategories.prompt` 應：

- 寫清 **Split-view 1～4** 與 **2×2 同一產品**（見 `custom-product-subcategory-prompt-guide.md`）  
- 【參考圖】段用 **圖樣／表面圖稿** 等通用詞，不要寫「Logo 槽」「四格對四槽」  
- 印刷工法（燙印、熱轉、打凹、上光）由 **使用者描述** 或工藝 `visual_hint` 帶入，不在程式寫死

---

## 8. Code review 勾選

- [ ] 原圖印刷 FLUX 句是否 **surface graphic / artwork** 通用表述？  
- [ ] 是否 **未** 新增 Logo-only 函式或 `buildFluxPrintPattern*Lockup` 類 block？  
- [ ] `pattern_intent` 是否由 Tab 定義（`print` / `style`），而非前端下拉或 regex？  
- [ ] image 順序是否與 `fluxReferenceSourceRank` 一致？  
- [ ] 前端是否 **未** 恢復 Tab 下 debug legend？  
- [ ] 材料句是否仍只來自 Gemini JSON（見 flux 政策）？

---

## 9. 程式錨點

| 項目 | 位置 |
|------|------|
| 參考槽 UI | `public/js/custom-product.js` — `REF_INTENT_SLOTS` |
| payload | `collectReferencePayload()` |
| 排序 | `server.js` — `reorderFluxReferenceInputs` |
| 附錄 | `buildFluxReferenceFactsAppendix` |
| 角色句 | `fluxReferenceKindRoleLine` |
| 組 prompt | `composeGeneratePromptWithReferences` |
| 子分類 2×2 | `docs/custom-product-subcategory-prompt-guide.md` |

---

## 10. 修訂紀錄

| 日期 | 說明 |
|------|------|
| 2026-06-18 | 初版：原圖印刷／風格參考雙 Tab；強調提示詞 **通用性**；禁止 Logo 專用化與前端 image 對照垃圾文案 |
