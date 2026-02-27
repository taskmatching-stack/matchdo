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

---

程式參考：`server.js` 中所有 `custom_products` 的 insert/update 皆應只使用上表欄位。
