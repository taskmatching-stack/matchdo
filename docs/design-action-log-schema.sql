-- 設計行為追蹤表：找廠商訂製、再設計並生圖成功、社群分享（FB/Line/IG/Pinterest/複製連結）
-- 執行於 Supabase SQL Editor 或相同 PostgreSQL 環境

CREATE TABLE IF NOT EXISTS design_action_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    action text NOT NULL CHECK (action IN (
        'find_vendor', 'redesign_generate_ok',
        'share_facebook', 'share_line', 'share_instagram', 'share_pinterest', 'share_copy_link'
    )),
    user_id uuid NULL,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_design_action_log_action ON design_action_log(action);
CREATE INDEX IF NOT EXISTS idx_design_action_log_created_at ON design_action_log(created_at);

COMMENT ON TABLE design_action_log IS '首頁/設計頁：找廠商訂製、再設計並生圖成功、社群分享次數之追蹤';
COMMENT ON COLUMN design_action_log.action IS 'find_vendor|redesign_generate_ok|share_facebook|share_line|share_instagram|share_pinterest|share_copy_link';
