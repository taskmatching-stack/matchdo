-- 材料組合／印花資產庫：名稱（既有 title）＋分類（新增 category）
-- Supabase SQL Editor 執行一次（表已存在時用本檔；全新安裝請看下方 CREATE 備註）

ALTER TABLE user_material_combo_generations
    ADD COLUMN IF NOT EXISTS category text;

ALTER TABLE user_print_generations
    ADD COLUMN IF NOT EXISTS category text;

CREATE INDEX IF NOT EXISTS idx_user_material_combo_generations_user_category
    ON user_material_combo_generations (user_id, category);

CREATE INDEX IF NOT EXISTS idx_user_print_generations_user_category
    ON user_print_generations (user_id, category);

COMMENT ON COLUMN user_material_combo_generations.category IS '使用者自訂分類（自由文字，便於資產庫篩選）';
COMMENT ON COLUMN user_print_generations.category IS '使用者自訂分類（自由文字，便於資產庫篩選）';
