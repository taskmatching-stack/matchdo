# 設計分析：從材料／素材回推需求（規劃紀錄）

更新日期：2026-05-26  
狀態：**需求已確認，待實作**（與「訂製品 `ai_tags` 是否併入素材標籤」分開處理）

---

## 1. 需求一句話

**設計分析**（訂製品分析、設計風向／意圖分析、日後 AI 產品顧問等）除了依 **生成圖 + 使用者 prompt** 外，也要能依 **所引用的廠商材料／數位原型**（`reference_sources` → `vendor_assets`）**回推訂製需求**（品類、材質、工藝、結構約束、可製性、數量線索等）。

---

## 2. 與「成品標籤」的區隔（必讀）

| 面向 | 成品語意（現行） | 材料回推需求（本需求） |
|------|------------------|------------------------|
| 主要資料 | `ai_generated_image_url` → `image_semantics_json`／`ai_tags` | `reference_sources[].vendor_asset_id` → `vendor_assets`（`asset_kind`、`material_key`、`style_key`、`ai_tags`、`image_semantics_json`） |
| 用途 | 靈感牆搜尋、趨勢看「市場上長出來的樣子」 | 分析／顧問／找廠：「使用者**選了什麼料件**」所隱含的製作需求 |
| 是否併入 `custom_products.ai_tags` | 建議**不**整包複製素材 tags（避免搜尋失真） | 回推結果寫入 **分析專用結構**（見 §4），或分析時即時 JOIN |

先前結論：素材標籤不必為了搜尋而併入 `ai_tags`；**但設計分析管線必須能讀到材料語意並回推需求**。

---

## 3. 現況（程式對照，2026-05-26）

| 項目 | 現況 |
|------|------|
| `reference_sources` | 儲存時有 `vendor_asset_id`、`manufacturer_id`、`image_url`、`asset_kind`、`title` 等；**未**含素材 `ai_tags` |
| `enrichCustomProductSemantics()` | 僅解析**生成圖** + **generation_prompt**；**未**讀引用素材 |
| `POST /api/analyze-custom-product` | 使用 `getReadModelName()` 看**上傳／生成圖**；**未**帶入 `reference_sources` 或 `vendor_assets` 欄位 |
| 設計頁選素材 | `public/js/custom-product.js` 選廠商素材後寫入 `refSources`；儲存時傳 `reference_sources` |

相關：`docs/custom-products-db-columns.md`、`docs/design-lineage-and-design-direction-plan.md` §二。

---

## 4. 建議輸出（規劃，欄位名可調）

分析 API 或儲存後非同步任務，在既有 `analysis_json` 或獨立 JSONB 中增加例如：

```json
{
  "material_backtrace": {
    "sources": [
      {
        "vendor_asset_id": "uuid",
        "asset_kind": "material",
        "material_key": "leather",
        "style_key": null,
        "inferred": {
          "materials": ["皮革"],
          "techniques": ["車縫"],
          "constraints": ["需與既有領片同厚"],
          "product_hints": ["包袋", "肩帶"]
        }
      }
    ],
    "merged_requirements": {
      "materials": [],
      "techniques": [],
      "key_features": [],
      "feasibility_notes": ""
    },
    "model": "gemini-3.1-pro-preview",
    "computed_at": "2026-05-26T00:00:00.000Z"
  }
}
```

**合併規則（待實作時細化）**：

- 多張引用：依 `asset_kind`（`material` vs `prototype`）加權；材料以 `material_key` + `image_semantics_json.materials` 為主，版型以結構／部件標籤為主。
- 與生成圖分析結果合併時標註 `source: generated_image | prompt | material_backtrace`，供 UI 顯示「來自材料推論」區塊。

---

## 5. 建議實作階段（待排程）

| 階段 | 內容 |
|------|------|
| **MB-0** | 規格：本檔 + `matchdo-todo` §6 交叉引用；確認與設計風向 D3／AI 顧問 AD 餵料一致 |
| **MB-1** | `POST /api/custom-products` 儲存後（或 `analyze-custom-product`）依 `reference_sources` **批次查** `vendor_assets`（含 `ai_tags`、`material_key`、`asset_kind`） |
| **MB-2** | 新增 `inferRequirementsFromReferenceMaterials()`（Gemini `gemini_model_read`，見 `docs/admin-ai-settings-models.md`）→ 寫入 `analysis_json.material_backtrace` 或 `reference_requirements_json` |
| **MB-3** | 前端：訂製分析／找廠結果頁顯示「依所選材料推論」；設計風向意圖分析頁同邏輯 |
| **MB-4** | 可選：快照引用當下素材 tags 至 `reference_sources[]` 或 `data_lineage_json`，避免素材日後改標影響歷史分析 |
| **MB-4b** | 與 **`supplier-reverse-intent-discovery-plan.md` RI-4** 對齊：引用可追溯至 L0 時 → **自動通知** + 寫入供應商 **「引用製造商」清單**（§3.3）；不做合作意向表單 |

**不納入 MB-0**：把素材 tags 整包寫進 `custom_products.ai_tags`（除非另開產品需求）。

---

## 6. 相關文件

| 文件 | 說明 |
|------|------|
| `docs/matchdo-todo.md` §6 | 視覺語意庫；已加「材料回推需求」待辦 |
| `docs/design-lineage-and-design-direction-plan.md` | 血緣 + 設計風向；§1.2 缺口 |
| `docs/design-direction-ai-advisor-plan.md` | 顧問餵料可含材料回推結果 |
| `docs/admin-ai-settings-models.md` | 讀圖／分析模型（建議 Pro Preview） |
