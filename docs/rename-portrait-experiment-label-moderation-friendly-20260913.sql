-- 前台顯示名：寬鬆尺度 → 審核友善（內部 render_mode 仍 experiment）
-- 可重複執行。更新已發佈操作介紹與摘要中的中英文文案。

UPDATE public.help_guide_pages
SET
    summary = replace(summary, '寬鬆尺度', '審核友善'),
    summary_en = replace(replace(summary_en, 'Looser scale', 'Moderation-friendly'), 'looser scale', 'moderation-friendly'),
    title = replace(title, '寬鬆尺度', '審核友善'),
    title_en = replace(replace(title_en, 'Looser scale', 'Moderation-friendly'), 'looser scale', 'moderation-friendly'),
    blocks_json = replace(
        replace(
            replace(blocks_json::text, '寬鬆尺度', '審核友善'),
            'Looser scale', 'Moderation-friendly'
        ),
        'looser scale', 'moderation-friendly'
    )::jsonb,
    updated_at = now()
WHERE summary LIKE '%寬鬆尺度%'
   OR summary_en ILIKE '%looser scale%'
   OR blocks_json::text LIKE '%寬鬆尺度%'
   OR blocks_json::text LIKE '%Looser scale%'
   OR blocks_json::text LIKE '%looser scale%';

INSERT INTO public.payment_config (key, value, updated_at)
VALUES ('help_guides_portrait_experiment_label_moderation_friendly_20260913', '1', now())
ON CONFLICT (key) DO UPDATE SET value = '1', updated_at = now();
