# custom_products 表實際欄位（以 schema 為準）

後端寫入/更新此表時**只能使用以下欄位**，不得假設未列出的欄位存在。

## 基底表（一定存在）

來源：`docs/custom-products-schema.sql`

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | UUID | 主鍵，預設 gen_random_uuid() |
| owner_id | UUID | 必填，REFERENCES auth.users(id) |
| title | TEXT | 必填 |
| description | TEXT | 必填 |
| category | TEXT | 選填，對應 ai_categories.key |
| reference_image_url | TEXT | 使用者示意圖 URL |
| ai_generated_image_url | TEXT | AI 生成圖 URL |
| analysis_json | JSONB | 選填，可存 generation_prompt、generation_seed、show_on_homepage 等 |
| status | TEXT | 必填，預設 'draft'；CHECK: draft, analyzing, matched, contacted, completed |
| created_at | TIMESTAMPTZ | 自動 |
| updated_at | TIMESTAMPTZ | 自動 |

**注意：表中沒有 `generation_prompt`、`generation_seed` 獨立欄位。**  
若要存這些值，請寫入 `analysis_json`，例如：  
`analysis_json = { "generation_prompt": "...", "generation_seed": 12345 }`。

## 選用欄位（需手動執行 migration 才有）

來源：`docs/add-custom-products-show-on-homepage.sql`

| 欄位 | 型別 | 說明 |
|------|------|------|
| show_on_homepage | BOOLEAN | 是否顯示在首頁媒體牆，預設 false |

來源：`docs/add-custom-products-prompt-seed.sql`（**建議執行**，否則寫入時勿傳 generation_prompt / generation_seed）

| 欄位 | 型別 | 說明 |
|------|------|------|
| generation_prompt | TEXT | 使用者輸入的生成提示詞 |
| generation_seed | BIGINT | FLUX 生圖 seed；NULL 表示隨機 |

未執行該 migration 時，**不可**在 INSERT 中傳入 `generation_prompt`、`generation_seed`（後端已改為寫入此二欄，請先執行 SQL）。  
未執行 show_on_homepage migration 時，GET `/api/custom-products/for-homepage` 會回傳空列表（已處理）。

來源：`docs/add-custom-products-reference-sources.sql`

| 欄位 | 型別 | 說明 |
|------|------|------|
| reference_sources | JSONB | 再設計時引用之廠商素材來源陣列，每項含 vendor_asset_id, manufacturer_id, manufacturer_name, manufacturer_profile_url, image_url |

來源：`docs/add-custom-products-semantics.sql`（語意／標籤，分析用）

| 欄位 | 型別 | 說明 |
|------|------|------|
| ai_tags | text[] | Gemini 合併標籤（生成圖＋提示詞） |
| prompt_semantics_json | JSONB | 提示詞語意 |
| image_semantics_json | JSONB | 生成圖語意 |
| semantics_generated_at | TIMESTAMPTZ | 語意產生時間 |

來源：`docs/add-custom-products-semantics-taxonomy.sql`

| 欄位 | 型別 | 說明 |
|------|------|------|
| ai_tags_by_dimension | JSONB | 分維標籤：style, material, color, structure, features, patterns, craftsmanship, form, mood, use_case, category |

來源：`docs/add-custom-products-data-lineage.sql`（**不對前端暴露**）

| 欄位 | 型別 | 說明 |
|------|------|------|
| generator_manufacturer_id | UUID | 生圖者若為廠商，對應 manufacturers.id |
| has_self_vendor_reference | BOOLEAN | 是否從素材庫引用自己廠商素材 |
| is_vendor_self_serve | BOOLEAN | 同上且為廠商帳號；**僅**素材庫自引才算，上傳參考圖不算 |
| data_lineage_json | JSONB | 判定細節（內部） |
| product_line | TEXT | 規劃中：`custom`／`design_direction`（再製改版用） |

來源：`docs/add-custom-products-designer-region.sql`（**僅 IP**，不強制表單；不對前端暴露）

| 欄位 | 型別 | 說明 |
|------|------|------|
| designer_country_code | TEXT | ISO2（如 TW、US），儲存當下由 IP 推斷 |
| designer_region_codes | text[] | 目前 IP 僅國家，預設 `{}` |
| designer_region_source | TEXT | `ip` 或 `unknown` |
| designer_ui_locale | TEXT | 儲存當下介面語系（輔助，不作國家） |
| designer_region_json | JSONB | 內部：推斷方式、遮罩 IP（不含完整 IP） |

---

程式參考：`server.js` 中所有 `custom_products` 的 insert/update 皆應只使用上表欄位。  
設計者地區：`lib/designer-region-from-ip.js`（CDN 標頭 → `geoip-lite` 後備）。
