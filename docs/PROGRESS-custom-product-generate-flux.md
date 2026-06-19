# 訂製設計頁生圖（FLUX）× 看可搭配帶入 — 工作進度（2026-06-18）

> 給新對話用：延續「產品樹選款 → 設計頁四槽 → FLUX 多圖生圖」管線。**政策必讀** `docs/flux-and-gemini-prompt-policy.md`、四槽語意 `docs/ref-tabs-vs-customization-levels.md`。

---

## 目前狀態（2026-06-18，使用者驗收）

**品質：可接受，先凍結大改。**

實測情境（護照套子分類 + 原型 + 材料色款 + 圖樣 LOGO +「打凹的 LOGO」）：

| 項目 | 結果 |
|------|------|
| 原型造型 | ✅ 符合參考 |
| 材料色（如牛仔藍） | ✅ 依選中色款 swatch |
| 圖樣槽上傳 LOGO | ✅ 依圖案壓凹／套印（`9339a5e` 後） |
| 使用者描述引號 | ✅ 不再整段自動包 `"…"`；只在使用者句內標要印的字 |

**線上最新 commit（生圖／帶入相關）：** `9339a5e`

**前端 cache bust：**

| 檔案 | 版本 | 頁面 |
|------|------|------|
| `public/js/custom-product.js` | `v=76` | `custom-product.html` |
| `public/js/vendor-product-link-tree.js` | `v=60` | `product-tree.html` |

---

## 已推送到 `origin/main` 的 commit（本段）

| Commit | 說明 |
|--------|------|
| `534ca65` | guide：選取框改青綠、首次點選更快 |
| `408c356` | guide：原型多選角度；`matchdo.guidePrototypeRefs` |
| `de697ba` | 設計頁：guide session 原子匯入；原型已鎖時仍帶材料／配件；persist 強化 |
| `6f50dca` | FLUX：BFL 對齊引號、材料 swatch 語意、referenceSources 帶 URL／id；有材料時原型圖限 1 張 |
| `9339a5e` | FLUX：參考圖各槽 **用途角色句**（圖樣＝依此圖套印／壓凹等） |

---

## 端到端流程（現況）

```text
product-tree.html（看可搭配）
  選主產品角度（可多選）→ matchdo.guidePrototypeRefs
  選材料色款／配件     → matchdo.guideLinkedAssetRefs
  「用此款開始設計」   → return_to custom-product.html

custom-product.html Tab「產品設計」
  consumeGuideSessionFromStorage()
  applyGuideSessionBundle() → 原型槽／材料槽／配件槽
  使用者可再加圖樣槽（本機上傳或素材庫）
  composeUserPromptForGenerate() → prompt + 各槽備註
  collectReferencePayload() → referenceImages + referenceSources

POST /api/generate-product-image
  composeGeneratePromptWithReferences()
    1. DB 分類 prompt（custom_product_subcategories）
    2. reorderFluxReferenceInputs（原型→配件→材料→圖樣；有材料時原型最多 1 張）
    3. resolveMaterialRefsForPrompt（依 image_url 跑 Gemini 語意，含非 cover 色款）
    4. buildFluxReferenceFactsAppendix（含【參考圖用途 — FLUX 多圖編輯】+ 各 image 角色句）
    5. 勾選工藝 visual_hint（若有）
    6. 使用者描述（fluxFormatUserPromptForPrint：原樣，不自動整段引號）
  generateImageWithFlux2Pro → translatePromptToEnglishForFlux（保留 `"要印的字"`）
```

---

## 參考圖四槽 → FLUX prompt（server.js）

| Tab | asset_kind | image 角色句（摘要） |
|-----|------------|----------------------|
| 原型 | `prototype` | 造型、輪廓、比例與結構 |
| 配件 | `part` | 五金、飾件外觀 |
| 材料 | `material` | 本體表面色彩／材質／質感 + Gemini `image_semantics_json` |
| 圖樣 | `other` | **表面圖案：依使用者描述將此圖圖案套到產品本體，內容須與此圖一致** |

函式：`fluxReferenceKindRoleLine`、`buildFluxReferenceFactsAppendix`（別名 `buildFluxReferenceImageRoleMapAppendix`）。

---

## 前端關鍵（custom-product.js）

| 函式 | 用途 |
|------|------|
| `consumeGuideSessionFromStorage` | 讀取並清除 `guidePrototypeRefs` / `guideLinkedAssetRefs` |
| `applyGuideSessionBundle` | 寫入 refSlots；原型已鎖時仍 merge 材料／配件 |
| `collectReferencePayload` | 送 `image_url`、`vendor_asset_id`、`title`、`gallery_label`、`user_note` |
| `composeUserPromptForGenerate` | 主描述 + 各槽 addon + 單圖備註 |

Guide 端：`vendor-product-link-tree.js` → `persistGuideSelectionForDesign`。

---

## 提示詞／UI 文案（2026-06）

- 說明：引號只包**描述句內要印的字**，勿整段 prompt 包引號（對齊 BFL Typography）。
- 範例：`正面燙印 "恭喜發財" 四個字，黑底金字`
- i18n：`public/locales/zh-TW.json`、`en.json`；`public/custom-product.html` 問號說明

---

## 已排除的錯誤做法（勿再犯）

| 問題 | 後果 |
|------|------|
| `fluxFormatUserPromptForPrint` 整段包 `"…"` | 「黑色LOGO」被當字面印上產品 |
| 參考圖附錄只有 `image N · 圖樣` 無用途句 | 圖樣槽有圖但 FLUX 自創幾何紋 |
| 材料只用 DB cover 的 `image_semantics_json` | 色款 swatch（≠ cover URL）顏色錯／缺 |
| 有材料仍送 3 張原型 | 造型參考蓋過材料色 |
| 用 `material_key`／檔名 regex 組 FLUX 材質句 | 違反 `flux-and-gemini-prompt-policy.md` |

---

## 已知限制

- FLUX 輸出 **1024×1024**（BFL pro 圖生圖）。
- 圖樣位置／大小仍依使用者描述；可在**圖樣那張的備註**補「正面中央、約封面 1/3」提高穩定度。
- 子分類 DB prompt 內【參考圖】長段與後端附錄可能重複；二期可只留品類 + Split-view（見 `custom-product-subcategory-prompt-guide.md` §2）。

---

## 待辦（非急）

- [ ] 子分類 prompt 批量接上共用【輸出格式】【參考圖】段（或全改 server 自動附錄，減少百筆維護）
- [ ] 生圖成功後 P3：對 `ai_generated_image_url` Gemini 讀圖寫語意庫（見 `matchdo-todo.md`）
- [ ] 設計頁 `?` 加一段「圖樣槽＝表面圖案參考，描述寫工法如壓凹／燙印」（i18n）

---

## 相關文件

| 文件 | 內容 |
|------|------|
| `docs/PROGRESS-vendor-styles-and-product-tree.md` | 廠商版型 Tab、看可搭配 UI、guide 橫條 |
| `docs/ref-tabs-vs-customization-levels.md` | 四 Tab × 訂製程度 |
| `docs/custom-product-subcategory-prompt-guide.md` | Split-view 子分類 prompt 規範 |
| `docs/flux-and-gemini-prompt-policy.md` | 嚴禁查表式硬編碼 |
| `docs/vendor-asset-prototype-moq-customization-notes.md` | 材料附錄、reorder |

---

## 部署

```bash
cd ~/matchdo && git fetch origin main && git reset --hard origin/main && gcloud run deploy matchdo --source . --region=asia-northeast1 --allow-unauthenticated --clear-base-image && gcloud run services update-traffic matchdo --region=asia-northeast1 --to-latest
```

新對話可說：「請讀 `docs/PROGRESS-custom-product-generate-flux.md` 繼續。」
