-- 商攝空間用途：新增舞臺／活動空間，與展覽拆開
-- 可重複執行。不覆寫後台已改過的自訂名稱／排序。
-- 執行：後台「資料庫維護」id=`promo-space-use-stage-exhibition-20260913`

INSERT INTO public.promo_space_use_types (
  key, name, name_en, layout_label, layout_label_en, sort_order, is_active
) VALUES (
  'stage',
  '舞臺／活動空間',
  'Stage / event',
  '舞臺／活動空間',
  'stage / event venue',
  50,
  true
)
ON CONFLICT (key) DO NOTHING;

UPDATE public.promo_space_use_types
SET
  name = '展覽空間',
  updated_at = now()
WHERE key = 'exhibition'
  AND name = '展覽商業空間';

UPDATE public.promo_space_use_types
SET
  layout_label = '展覽空間',
  updated_at = now()
WHERE key = 'exhibition'
  AND layout_label = '展覽／活動空間';

UPDATE public.promo_space_use_types
SET
  layout_label_en = 'exhibition space',
  updated_at = now()
WHERE key = 'exhibition'
  AND layout_label_en = 'exhibition / event space';

UPDATE public.promo_space_use_types
SET
  sort_order = 55,
  updated_at = now()
WHERE key = 'exhibition'
  AND sort_order = 50;

INSERT INTO public.payment_config (key, value, updated_at)
VALUES ('promo_space_use_stage_exhibition_20260913', '1', now())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
