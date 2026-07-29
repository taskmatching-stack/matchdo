-- 將底片分組「柯达彩负」改為「柯達彩負」（Supabase SQL Editor）
-- 已有 add-promo-camera-param-groups.sql 時兩段都跑；尚未建 groups 表時只跑第二段 UPDATE options。

UPDATE public.promo_camera_param_groups
SET name = '柯達彩負',
    name_en = COALESCE(name_en, 'Kodak color negative'),
    updated_at = NOW()
WHERE category = 'film_simulation'
  AND (name = '柯达彩负' OR name = '柯達彩負');

UPDATE public.promo_camera_param_options
SET meta = jsonb_set(COALESCE(meta, '{}'::jsonb), '{group}', '"柯達彩負"'),
    updated_at = NOW()
WHERE category = 'film_simulation'
  AND meta->>'group' IN ('柯达彩负', '柯達彩负');

UPDATE public.promo_camera_param_options o
SET meta = jsonb_set(COALESCE(o.meta, '{}'::jsonb), '{group}', '"柯達彩負"'),
    updated_at = NOW()
FROM public.promo_camera_param_groups g
WHERE o.group_id = g.id
  AND g.category = 'film_simulation'
  AND g.name = '柯達彩負';
