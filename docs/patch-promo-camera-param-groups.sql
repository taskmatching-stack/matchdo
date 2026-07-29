-- 攝影模擬參數：補「分組 meta.group」與前台「說明 description」
-- 已有 promo_camera_param_options 表時執行（Supabase SQL Editor）

-- 數位成像（camera_brand）→ 已改為品牌色彩，請改跑 docs/patch-promo-camera-brand-seeds.sql
-- （下列 UPDATE 保留給僅需分組／說明、尚未換品牌種子者；新環境請用 patch-promo-camera-brand-seeds.sql）

-- 底片模擬（film_simulation）＋分組
UPDATE public.promo_camera_param_options SET
  name = 'Portra 400 風',
  description = '柯达 Portra 400 彩负風：膚色／產品色自然、顆粒細、高光柔和。',
  meta = COALESCE(meta, '{}'::jsonb) || '{"group":"柯達彩負"}'::jsonb
WHERE category = 'film_simulation' AND key = 'portra_400';

UPDATE public.promo_camera_param_options SET
  name = 'Ektar 100 風',
  description = '柯达 Ektar 100 風：飽和度較鮮明但可控、細節銳利、顆粒細。',
  meta = COALESCE(meta, '{}'::jsonb) || '{"group":"柯達彩負"}'::jsonb
WHERE category = 'film_simulation' AND key = 'ektar_100';

UPDATE public.promo_camera_param_options SET
  name = 'Tri-X 400 風',
  description = 'Ilford Tri-X 黑白片：经典黑白影调、颗粒感、主体分离强。',
  meta = COALESCE(meta, '{}'::jsonb) || '{"group":"黑白片"}'::jsonb
WHERE category = 'film_simulation' AND key = 'tri_x_400';

UPDATE public.promo_camera_param_options SET
  name = 'Provia 正片風',
  description = '富士 Provia 正片：色彩干净、饱和自然、高光通透。',
  meta = COALESCE(meta, '{}'::jsonb) || '{"group":"正片"}'::jsonb
WHERE category = 'film_simulation' AND key = 'provia_slide';

UPDATE public.promo_camera_param_options SET
  name = 'Cinestill 800T 風',
  description = 'Cinestill 800T 钨丝灯负片：冷阴影、亮点 halation，偏夜景／电影氛围。',
  meta = COALESCE(meta, '{}'::jsonb) || '{"group":"电影负片"}'::jsonb
WHERE category = 'film_simulation' AND key = 'cinestill_800t';

-- 鏡頭 → 請改跑 docs/patch-promo-camera-lens-category.sql（category=lens，依鏡頭類型分組）

-- 若曾误建重复 key，可手动在后台删除