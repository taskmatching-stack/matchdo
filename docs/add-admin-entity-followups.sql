-- 管理員備註與處理歷程（會員 / 廠商 / 產業供應商）
-- 於 Supabase SQL Editor 執行一次

CREATE TABLE IF NOT EXISTS admin_entity_followups (
    entity_type text NOT NULL CHECK (entity_type IN ('user', 'manufacturer', 'supplier')),
    entity_id uuid NOT NULL,
    pending_note text,
    updated_at timestamptz DEFAULT now(),
    updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
    PRIMARY KEY (entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_entity_followups_updated
    ON admin_entity_followups (updated_at DESC);

CREATE TABLE IF NOT EXISTS admin_entity_followup_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type text NOT NULL CHECK (entity_type IN ('user', 'manufacturer', 'supplier')),
    entity_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    admin_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
    admin_email text,
    action text NOT NULL DEFAULT 'comment',
    note text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_entity_followup_logs_entity
    ON admin_entity_followup_logs (entity_type, entity_id, created_at DESC);

COMMENT ON TABLE admin_entity_followups IS '管理員待處理備註（每筆 user/manufacturer/supplier 一列）';
COMMENT ON TABLE admin_entity_followup_logs IS '管理員處理歷程（追加紀錄）';
