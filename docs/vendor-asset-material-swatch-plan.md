# 材料參考（色卡／圖樣）獨立規劃

> 建立：2026-05-26｜**政策**：2026-07-10 對齊 `docs/flux-and-gemini-prompt-policy.md`（**嚴禁查表式硬編碼提示詞**）  
> **與數位原型分線**：原型 = 立體商品 + MOQ + 訂製程度 + 產品重繪；材料 = **平面圖樣／色卡** + Gemini 讀圖 + 設計端材質附錄。  
> **不共用**：產品棚拍底色、訂製程度限制句、prototype_tagging 當材料讀圖標準（材料用 `material_tagging_prompt`）。

---

## 一、產品目標（你要的「色卡」）

| 目標 | 說明 |
|------|------|
| 視覺 | 滿版或近滿版的 **材質圖樣**（像 Pantone／布樣卡），不是小塊樣板浮在白底商品照上 |
| 純色 + 材質類型 | 使用者填「AI 重繪材質類型」→ FLUX 生成該材質滿版質感（**預期行為**） |
| 產品／服裝照 + 材質類型 | 同上材質語意，但 prompt 第二句去除版型，整張滿版色卡（2026-07-10） |
| 上傳 | 可選 **AI 優化圖樣**：提清晰度、均勻光線、去雜物；**不強制**攝影棚白底 |
| 設計生圖 | 只借 **色彩 + 表面紋理語意** 套到原型造型上；禁止整塊色卡貼圖 |
| 尺度 | 滿板圖 **無法從像素 alone 推物理尺寸**；須用 **metadata + 文案** 輔助 |

---

## 二、為何不要和「產品重繪」共用

| 產品重繪 | 材料圖樣優化 |
|----------|----------------|
| 主體是立體商品 | 整張圖 **就是** 材質 |
| 需要選白／灰底隔離商品 | 滿版時 **沒有「以外」**；底色會誤導成商品照 |
| 輪廓、比例、陰影 | 織紋週期、色相、光澤方向 |
| 訂製程度 / MOQ 附錄 | 使用者勾選能力 + DB | `material_key` 查表送 FLUX |

**已決策（2026-05-26 起）：** 材料 AI 優化 **移除底色 UI**；prompt **不寫** `seamless white studio background`。

---

## 三、滿板圖，AI 能理解「紋路比例」嗎？

### 3.1 誠實結論

- **單張滿板參考圖 + FLUX**：模型 **不能保證** 真實世界的 mm／織紋密度；它只學「看起來多細／多粗」。
- **微距滿板**（線程巨大）→ 生圖易把紋路 **放大** 到不像手機殼／包袋。
- **遠距／低解析滿板** → 易 **糊成一片** 或過細重複。

因此：**滿板 ≠ 自動正確尺度**；靠 **使用者描述**、日後可選 DB 欄位（如 `texture_scale_hint` 由人填寫）。**禁止**程式從檔名 regex 或 `material_key` 查表發明 FLUX 表面句（見政策檔 §3）。

### 3.2 三層尺度策略（建議實作順序）

| 層級 | 內容 | 狀態 |
|------|------|------|
| L1 | 標題 + **Gemini** `image_semantics_json`（上傳時必跑） | ✅ |
| L2 上傳可選 | **`texture_scale_hint`**（廠商自選枚舉，寫入 DB） | **規劃** |
| L3 設計端 | 使用者 prompt；材料附錄僅轉寫 Gemini JSON | ✅ |

#### `texture_scale_hint` 建議枚舉（Phase 2）

| 值 | 語意 | 生圖／優化暗示 |
|----|------|----------------|
| `macro_close` | 微距特寫 | 成品上用 **更細** 的紋，勿把參考當 1:1 貼上 |
| `swatch_card` | 色卡／布樣卡尺度 | 服飾、包袋常規織紋重複 |
| `panel` | 板材／門片尺度 | 木紋、石紋條帶尺度 |
| `product_surface` | 已是成品局部表面 | 尺度最接近成品，可較忠實 |

### 3.3 上傳圖拍攝建議（寫進廠商說明）

- **優先**：滿版平鋪、均勻光、無球體、無手指。
- **避免**：材質球、小塊樣板佔畫面 30% 其餘是桌子（若無裁切工具，寧可後製裁滿版再上傳）。
- 微距圖請在標題或（日後）尺度欄註明「微距」。

---

## 四、兩條獨立管線

```
┌─────────────────────────────────────────────────────────────┐
│ A. 上傳管線（廠商素材庫）                                      │
├─────────────────────────────────────────────────────────────┤
│ 原圖 ──► Gemini 讀圖 → image_semantics_json（標籤；不進 optimize）      │
│      ──► [可選] materialOptimize (FLUX)                              │
│          · buildVendorAssetMaterialFluxOptimizePrompt(material_surface_type) │
│          · 中文兩句；1024×1024；seed 3647440197；無底色                │
│      ──► Storage URL                                         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ B. 設計生圖管線（訂製者）                                      │
├─────────────────────────────────────────────────────────────┤
│ 分類 prompt（DB）+ 使用者描述                                 │
│ 原型 ref → buildPrototypeCustomizationPromptAppendix         │
│ 材料 ref → buildMaterialTexturePromptAppendix                │
│          · 通用角色句 + DB image_semantics_json 轉寫           │
│          · 禁止檔名／material_key 查表（見政策檔）             │
└─────────────────────────────────────────────────────────────┘
```

**禁止再合併：** 材料 optimize 不得呼叫 `normalizeVendorOptimizeBackground`（產品專用）。

---

## 五、程式對照（現行 2026-07-10）

| 項目 | 檔案 | 現行 |
|------|------|------|
| 政策（必讀） | `docs/flux-and-gemini-prompt-policy.md` | 嚴禁查表式硬編碼 |
| Prompt 鎖 | `.cursor/rules/material-flux-prompt-lock.mdc` | 中文兩句 |
| 材料優化 prompt | `buildVendorAssetMaterialFluxOptimizePrompt` | `material_surface_type` → 中文 |
| 材料 FLUX | `optimizeVendorAssetImageWithFlux` | 忽略 background；1024² |
| 讀圖（標籤） | `material_tagging_prompt` | Gemini → `image_semantics_json` |
| 生圖附錄 | `buildMaterialTexturePromptAppendix` | DB 語意轉寫（設計頁） |
| 廠商 UI | `manufacturer-materials.html` | 材料無底色區；`buildMaterialFluxPromptPreview` |
| **未接上線** | `resolveMaterialFluxEditPrompt` 等 | 勿當 optimize 現行 |

**已刪除、勿復活**：`inferMaterialKeyFromHints`、`inferOptionalMaterialContextHints`、`materialTextureScaleRuleForKey`、`materialOptimizeTextureDirective`。

---

## 六、Phase 路線圖

### Phase 1（立即，與本次 commit 一致）

- [x] 材料優化 prompt 改為色卡／滿版圖樣導向，**移除底色**
- [x] 材料表單 **移除底色 UI**
- [x] 本規劃文件

### Phase 2（建議下一版）

- [ ] DB：`vendor_assets.texture_scale_hint`（enum 或 text）
- [ ] 上傳表單：尺度下拉 + i18n 說明
- [ ] `buildMaterialTexturePromptAppendix` / optimize prompt 讀取 hint
- [ ] `material_tagging_prompt`（Gemini 讀圖專用，強調 patterns/materials 維度）

### Phase 3（視需求）

- [ ] 可選 **邊緣裁切／去背**（非 FLUX 重畫整圖）：僅當偵測到非滿版
- [ ] 設計頁 `?`：材質參考與紋路尺度說明
- [ ] 參考圖重排：原型在前、材料在後

---

## 七、FAQ

**Q：滿板還要不要 AI 優化？**  
A：圖已清晰可 **不勾**；雜光、模糊、手機隨拍可勾，目標是 **圖樣更乾淨**，不是換白底。

**Q：產品照丟進材料 tab 會怎樣？**  
A：與純色相同，依「AI 重繪材質類型」走 FLUX；第二句會去版型、整張滿版材質色卡（見 `material-flux-prompt-lock.mdc`）。

**Q：和「提取圖樣」一樣嗎？**  
A：Phase 1 仍是 FLUX img2img **強化**同一構圖；真・去背提取屬 Phase 3。設計端則用 prompt **語意提取** 紋理。

**Q：為何堅持獨立規劃？**  
A：產品心智不同（立體 vs 平面）、尺度問題不同、UI 不應出現無意義的底色選項。
