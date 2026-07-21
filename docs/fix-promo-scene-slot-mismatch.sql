-- 修正「場景」列 slot 被誤標成 theme（後台場景 tab 看不到、前台卻可能錯分）
-- 可重複執行（冪等）

UPDATE public.promo_scene_templates
SET slot = 'scene', updated_at = NOW()
WHERE COALESCE(slot, 'theme') <> 'scene'
  AND (
    key LIKE 'scene\_%' ESCAPE '\'
    OR category = 'scene'
  );
