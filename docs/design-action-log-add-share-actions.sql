-- 若已建立過 design_action_log 且僅有 find_vendor、redesign_generate_ok，請執行此腳本以加入社群分享 action
-- 執行於 Supabase SQL Editor

ALTER TABLE design_action_log DROP CONSTRAINT IF EXISTS design_action_log_action_check;
ALTER TABLE design_action_log ADD CONSTRAINT design_action_log_action_check CHECK (action IN (
    'find_vendor', 'redesign_generate_ok',
    'share_facebook', 'share_line', 'share_instagram', 'share_pinterest', 'share_copy_link'
));
