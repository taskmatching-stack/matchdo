-- 推廣圖：主題（theme）＋場景（scene）雙選
-- 執行：Supabase SQL Editor
-- 同一張表 promo_scene_templates，以 slot 區分；前台兩個下拉、後台兩個 TAB

ALTER TABLE public.promo_scene_templates
    ADD COLUMN IF NOT EXISTS slot TEXT NOT NULL DEFAULT 'theme';

-- 既有列一律視為「主題」
UPDATE public.promo_scene_templates
SET slot = 'theme'
WHERE slot IS NULL OR slot = '' OR slot NOT IN ('theme', 'scene');

ALTER TABLE public.promo_scene_templates
    DROP CONSTRAINT IF EXISTS promo_scene_templates_slot_check;

ALTER TABLE public.promo_scene_templates
    ADD CONSTRAINT promo_scene_templates_slot_check
    CHECK (slot IN ('theme', 'scene'));

CREATE INDEX IF NOT EXISTS idx_promo_scene_templates_slot_active
    ON public.promo_scene_templates (slot, is_active, sort_order);

COMMENT ON COLUMN public.promo_scene_templates.slot IS
    'theme＝前台「主題」；scene＝前台「場景」。兩者的 scene_prompt／composition_hint 都會併入 FLUX 提示詞';

COMMENT ON TABLE public.promo_scene_templates IS
    '推廣圖主題／場景模板（廣告取向；非僅換背景）';

-- 生成紀錄可存場景 key（選填）
ALTER TABLE public.product_promo_generations
    ADD COLUMN IF NOT EXISTS scene_key TEXT;

-- 種子：商業廣告「場景」（非居家生活換場景）
INSERT INTO public.promo_scene_templates (key, name, description, scene_prompt, composition_hint, category, sort_order, slot) VALUES
('scene_clean_studio', '乾淨棚拍場景', '簡潔商業棚拍環境，適合主視覺',
 'place the product in a clean commercial studio advertising environment with controlled seamless backdrop and polished studio lighting',
 'studio advertising set; product clearly isolated as hero; not a lifestyle room story',
 'scene', 10, 'scene'),
('scene_retail_display', '零售陳列場景', '店頭／陳列架廣告感',
 'place the product in a premium retail display advertising environment suitable for in-store promo',
 'retail shelf or display context that supports the product as the advertised hero',
 'scene', 20, 'scene'),
('scene_exhibition', '展場／活動攤位', '展覽會場或活動攤位主視覺感',
 'place the product in an exhibition booth or trade-show advertising environment with clean campaign lighting',
 'booth / event promo framing; commercial event energy without cluttered lifestyle narrative',
 'scene', 30, 'scene'),
('scene_soft_gradient', '柔色漸層背景', '抽象柔色漸層，偏品牌廣告',
 'place the product against a soft abstract gradient advertising backdrop with premium brand lighting',
 'minimal abstract commercial environment; product remains the sole hero',
 'scene', 40, 'scene'),
('scene_outdoor_campaign', '戶外廣告場景', '戶外廣告／活動宣傳感（非居家）',
 'place the product in an outdoor commercial campaign advertising environment with dramatic natural or campaign lighting',
 'outdoor campaign ad look; forbid inventing unrelated home-interior lifestyle stories',
 'scene', 50, 'scene')
ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    scene_prompt = EXCLUDED.scene_prompt,
    composition_hint = EXCLUDED.composition_hint,
    category = EXCLUDED.category,
    sort_order = EXCLUDED.sort_order,
    slot = 'scene',
    is_active = TRUE,
    updated_at = NOW();
