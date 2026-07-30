-- 只還原兩筆主題：「主視覺/Banner」「社群貼文」
-- 來源：MatchDO_影像品牌配方對照表_含材料色卡組 -20260719-2200（試算表 D6 等）
-- 不動其他 promo_scene_templates 列。
-- ⚠ 從試算表複製時只取英文 prompt 一行；勿整頁複製（會帶入「螢幕閱讀器」等介面字）
-- ⚠ 請勿再跑 docs/update-promo-templates-ad-dm.sql
-- ① 先確認 key／目前狀態（應只有 2 列）
SELECT id, key, name, slot,
       length(coalesce(scene_prompt, '')) AS prompt_len,
       left(scene_prompt, 100) AS prompt_preview,
       updated_at
FROM public.promo_scene_templates
WHERE name IN ('主視覺/Banner', '社群貼文')
   OR key IN ('hero_banner', 'social_post', 'social_feed', 'banner_hero');

-- ② 若曾用這兩個主題生過圖，從生成紀錄找舊 final_prompt（手動抄回 ③）
SELECT t.key, t.name, g.created_at,
       left(g.final_prompt, 600) AS final_prompt_preview
FROM public.promo_scene_templates t
JOIN public.product_promo_generations g
  ON g.scene_template_key = t.key
 AND g.status = 'success'
 AND coalesce(g.final_prompt, '') <> ''
WHERE t.name IN ('主視覺/Banner', '社群貼文')
ORDER BY g.created_at DESC
LIMIT 10;

-- ③ 只更新這兩筆（主視覺/Banner＝對照表 D6 原文）
UPDATE public.promo_scene_templates SET
  scene_prompt = 'hero banner composition, cinematic storytelling feel, generous negative space for headline text, designed to evoke curiosity and stop the scroll',
  composition_hint = NULL,
  updated_at = NOW()
WHERE name = '主視覺/Banner'
   OR key IN ('hero_banner', 'banner_hero');

-- 社群貼文：請把下一行的 scene_prompt 改成對照表該列英文（貼上後再執行）
-- UPDATE public.promo_scene_templates SET
--   scene_prompt = '（從對照表複製社群貼文列，只留一行英文）',
--   composition_hint = NULL,
--   updated_at = NOW()
-- WHERE name = '社群貼文'
--    OR key IN ('social_post', 'social_feed');
-- ④ 確認（應各 1 列有內容）
SELECT key, name, left(scene_prompt, 80) AS scene_prompt, left(composition_hint, 60) AS composition_hint
FROM public.promo_scene_templates
WHERE name IN ('主視覺/Banner', '社群貼文');
