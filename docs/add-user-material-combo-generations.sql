-- 設計者材料組合生成紀錄（我的數位資產 → 材料組合 TAB）
-- Supabase SQL Editor 執行一次

CREATE TABLE IF NOT EXISTS user_material_combo_generations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    image_url text NOT NULL,
    title text,
    material_combo_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    credit_transaction_id uuid,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_material_combo_generations_user_created
    ON user_material_combo_generations (user_id, created_at DESC);

ALTER TABLE user_material_combo_generations ENABLE ROW LEVEL SECURITY;
