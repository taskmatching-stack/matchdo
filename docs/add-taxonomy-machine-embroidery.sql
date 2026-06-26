-- 工藝標籤：電繡、立體電繡（布料加工常用標籤）
-- 執行：Supabase SQL Editor（需已執行 add-manufacturer-taxonomy.sql）
-- 路徑：紡織與車縫 → 布料加工 → 電繡／立體電繡

INSERT INTO public.taxonomy_nodes (key, dimension, parent_key, depth, name_zh, aliases, moq_hint_json, sort_order, is_active)
VALUES
('cap.textile.fabric_proc.machine_embroidery', 'capability', 'cap.textile.fabric_proc', 2, '電繡',
 ARRAY['電腦刺繡','機繡','電腦繡']::text[], NULL, 1006, true),
('cap.textile.fabric_proc.embroidery_3d', 'capability', 'cap.textile.fabric_proc', 2, '立體電繡',
 ARRAY['3D刺繡','立體刺繡','泡棉繡']::text[], NULL, 1007, true)
ON CONFLICT (key) DO UPDATE SET
    parent_key = EXCLUDED.parent_key,
    depth = EXCLUDED.depth,
    name_zh = EXCLUDED.name_zh,
    aliases = EXCLUDED.aliases,
    sort_order = EXCLUDED.sort_order,
    is_active = true,
    updated_at = now();

-- 刺繡：補搜尋別名（既有節點）
UPDATE public.taxonomy_nodes
SET aliases = ARRAY['手繡','傳統刺繡']::text[], updated_at = now()
WHERE key = 'cap.textile.fabric_proc.embroidery';

DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'taxonomy_nodes' AND column_name = 'visual_hint'
    ) THEN
        UPDATE public.taxonomy_nodes SET visual_hint = '刺繡於成品表面；圖案與配色依使用者描述'
        WHERE key = 'cap.textile.fabric_proc.embroidery';
        UPDATE public.taxonomy_nodes SET visual_hint = '電腦刺繡於成品表面；圖案與配色依使用者描述'
        WHERE key = 'cap.textile.fabric_proc.machine_embroidery';
        UPDATE public.taxonomy_nodes SET visual_hint = '立體電繡（泡棉／立體層次）於成品表面；圖案與配色依使用者描述'
        WHERE key = 'cap.textile.fabric_proc.embroidery_3d';
    END IF;
END $$;
