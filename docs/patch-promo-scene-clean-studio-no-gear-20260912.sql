-- 乾淨棚拍：改寫 scene_prompt，避免「studio lighting」被畫成棚燈入鏡

UPDATE public.promo_scene_templates
SET
    scene_prompt = $p$place the product against a seamless advertising backdrop with even wrap light and gentle form shadows on the subject. Catalog-ready commercial still. Finished hero photograph, not a behind-the-scenes studio view.$p$,
    composition_hint = $c$seamless advertising backdrop. product clearly isolated as hero. catalog still, not a behind-the-scenes studio. not a lifestyle room story$c$,
    updated_at = now()
WHERE key = 'scene_clean_studio';

INSERT INTO public.payment_config (key, value, updated_at)
VALUES ('promo_scene_clean_studio_no_gear_20260912', '1', now())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;
