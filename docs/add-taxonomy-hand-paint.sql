-- 工藝標籤：手工彩繪（通用；球鞋、安全帽、3C 外殼等皆可，不另拆品類標籤）
-- 執行：Supabase SQL Editor（需已執行 add-manufacturer-taxonomy.sql）
-- 路徑：印刷工藝 → 手工彩繪 → 手工彩繪

INSERT INTO public.taxonomy_nodes (key, dimension, parent_key, depth, name_zh, aliases, moq_hint_json, sort_order, is_active)
VALUES
('cap.printing.hand_paint', 'capability', 'cap.printing', 1, '手工彩繪', '{}'::text[], NULL, 40, true),
('cap.printing.hand_paint.hand_paint', 'capability', 'cap.printing.hand_paint', 2, '手工彩繪',
 ARRAY['手繪','定制彩繪']::text[], NULL, 4001, true)
ON CONFLICT (key) DO UPDATE SET
    parent_key = EXCLUDED.parent_key,
    depth = EXCLUDED.depth,
    name_zh = EXCLUDED.name_zh,
    aliases = EXCLUDED.aliases,
    sort_order = EXCLUDED.sort_order,
    is_active = true,
    updated_at = now();

-- 若曾誤加「模型與裝飾品」路徑，停用（不刪 link，避免 FK 問題）
UPDATE public.taxonomy_nodes SET is_active = false, updated_at = now()
WHERE key IN ('cap.modeling.surface_decor', 'cap.modeling.surface_decor.hand_paint');

DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'taxonomy_nodes' AND column_name = 'visual_hint'
    ) THEN
        UPDATE public.taxonomy_nodes SET visual_hint = '手工彩繪於成品表面；筆觸質感與圖案依使用者描述，配色依使用者描述'
        WHERE key = 'cap.printing.hand_paint.hand_paint';
    END IF;
END $$;
