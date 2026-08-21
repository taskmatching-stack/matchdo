-- 商攝・空間用途字典（前台 Space use 下拉；多語系顯示名）
-- 執行：Supabase SQL Editor 或後台「資料庫維護」id=`promo-space-use-types`

CREATE TABLE IF NOT EXISTS public.promo_space_use_types (
  key text PRIMARY KEY,
  name text NOT NULL,
  name_en text,
  name_ja text,
  name_es text,
  name_de text,
  name_fr text,
  layout_label text,
  layout_label_en text,
  sort_order integer NOT NULL DEFAULT 10,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT promo_space_use_types_key_format CHECK (key ~ '^[a-z][a-z0-9_]{0,63}$')
);

COMMENT ON TABLE public.promo_space_use_types IS '商攝導演空間用途（Space use）；前台依 lang 顯示 name／name_en';
COMMENT ON COLUMN public.promo_space_use_types.name IS '顯示名（預設／中文）';
COMMENT ON COLUMN public.promo_space_use_types.name_en IS '顯示名（英文），前台 lang=en';
COMMENT ON COLUMN public.promo_space_use_types.layout_label IS '進提示詞的空間類型描述（預設語）';
COMMENT ON COLUMN public.promo_space_use_types.layout_label_en IS '進提示詞的空間類型描述（英文）';

CREATE INDEX IF NOT EXISTS idx_promo_space_use_types_active_sort
  ON public.promo_space_use_types (is_active, sort_order, key);

INSERT INTO public.promo_space_use_types (
  key, name, name_en, layout_label, layout_label_en, sort_order, is_active
) VALUES
  ('residential', '住家空間', 'Residential', '住家／住宅空間', 'residential / home interior', 10, true),
  ('restaurant', '餐飲商業空間', 'Dining / F&B', '餐飲商業空間', 'restaurant / dining commercial space', 20, true),
  ('retail', '零售商業空間', 'Retail', '零售商業空間', 'retail commercial space', 30, true),
  ('office', '辦公商業空間', 'Office', '辦公商業空間', 'office commercial space', 40, true),
  ('exhibition', '展覽商業空間', 'Exhibition', '展覽／活動空間', 'exhibition / event space', 50, true),
  ('hotel', '飯店／民宿空間', 'Hotel / B&B', '飯店 hospitality 商業空間', 'hotel / hospitality commercial space', 60, true),
  ('clinic', '診所／美業空間', 'Clinic / Beauty', '醫美商業空間', 'clinic / beauty commercial space', 70, true)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  name_en = COALESCE(public.promo_space_use_types.name_en, EXCLUDED.name_en),
  layout_label = COALESCE(public.promo_space_use_types.layout_label, EXCLUDED.layout_label),
  layout_label_en = COALESCE(public.promo_space_use_types.layout_label_en, EXCLUDED.layout_label_en),
  sort_order = COALESCE(public.promo_space_use_types.sort_order, EXCLUDED.sort_order),
  updated_at = now();
