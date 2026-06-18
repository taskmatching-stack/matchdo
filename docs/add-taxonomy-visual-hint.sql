-- 工藝標籤生圖用 visual_hint（短句、僅技法、不寫死顏色）
-- 執行：Supabase SQL Editor（需已執行 add-manufacturer-taxonomy.sql）
-- 規則：箔色／配色依使用者描述；Gemini 翻譯整包 prompt 後送 FLUX

ALTER TABLE public.taxonomy_nodes
    ADD COLUMN IF NOT EXISTS visual_hint text;

COMMENT ON COLUMN public.taxonomy_nodes.visual_hint IS '生圖用短提示（depth=2 工藝標籤）；僅技法質感，不指定顏色';

-- 燙金／燙銀：同一技法句，避免與「銀色燙箔」等描述衝突
UPDATE public.taxonomy_nodes SET visual_hint = '熱壓金屬箔於平面圖案；箔色依使用者描述'
WHERE key IN ('cap.printing.special.foil_gold', 'cap.printing.special.foil_silver');

UPDATE public.taxonomy_nodes SET visual_hint = '圖案區局部亮膜，其餘區域維持霧面質感'
WHERE key = 'cap.printing.special.spot_uv';

UPDATE public.taxonomy_nodes SET visual_hint = '平面 UV 固化印刷；圖案與配色依使用者描述；須為平面墨層，不得做成浮雕、壓印或打凸'
WHERE key = 'cap.printing.digital.uv';

UPDATE public.taxonomy_nodes SET visual_hint = '轉印圖案於表面；圖樣依使用者描述'
WHERE key IN (
    'cap.printing.digital.heat_transfer',
    'cap.printing.digital.sublimation',
    'cap.printing.digital.heat_press',
    'cap.printing.digital.film_transfer',
    'cap.printing.digital.dtf'
);

UPDATE public.taxonomy_nodes SET visual_hint = '直噴印刷於表面；圖案依使用者描述'
WHERE key IN ('cap.printing.digital.dtg', 'cap.printing.digital.inkjet', 'cap.printing.digital.latex');

UPDATE public.taxonomy_nodes SET visual_hint = '網版或移印於表面；圖案依使用者描述'
WHERE key IN (
    'cap.printing.traditional.screen',
    'cap.printing.traditional.pad',
    'cap.printing.traditional.letterpress',
    'cap.printing.traditional.gravure',
    'cap.printing.traditional.offset'
);

UPDATE public.taxonomy_nodes SET visual_hint = '浮雕或壓印紋理；深淺與配色依使用者描述'
WHERE key IN ('cap.printing.special.emboss_print', 'cap.leather.leather_goods.emboss');

UPDATE public.taxonomy_nodes SET visual_hint = '淺浮雕線條或刻紋質感；不指定顏色'
WHERE key LIKE 'cap.laser.laser_engrave.%' AND depth = 2;

UPDATE public.taxonomy_nodes SET visual_hint = '雷射切割邊緣或鏤空質感；不指定顏色'
WHERE key LIKE 'cap.laser.laser_cut.%' AND depth = 2;

UPDATE public.taxonomy_nodes SET visual_hint = '淺浮雕線條或刻紋質感；不指定顏色'
WHERE key IN (
    'cap.textile.fabric_proc.laser_fabric',
    'cap.wood.wood_proc.laser_cut',
    'cap.metal.sheet_metal.laser_cut'
);

-- 其餘工藝標籤：通用短句（可後台逐項改寫）
UPDATE public.taxonomy_nodes
SET visual_hint = name_zh || '；技法與配色依使用者描述，不改參考造型'
WHERE dimension = 'capability'
  AND depth = 2
  AND (visual_hint IS NULL OR visual_hint = '');
