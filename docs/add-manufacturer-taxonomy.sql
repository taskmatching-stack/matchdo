-- 廠商分類：生產模式、材料、工藝能力（MT-1 v3）
-- 規格：docs/manufacturer-taxonomy-plan.md（第三版，2026-06）
-- 執行：Supabase SQL Editor 或 /admin/db-migrations.html
-- 種子統計：production_type=4 | material≈35 | capability 大類15 細類45 工藝標籤≈152

CREATE TABLE IF NOT EXISTS public.taxonomy_nodes (
    key text PRIMARY KEY,
    dimension text NOT NULL CHECK (dimension IN ('production_type', 'material', 'capability')),
    parent_key text REFERENCES public.taxonomy_nodes(key) ON DELETE SET NULL,
    depth integer NOT NULL DEFAULT 0,
    name_zh text NOT NULL,
    name_en text,
    aliases text[] NOT NULL DEFAULT '{}'::text[],
    moq_hint_json jsonb,
    sort_order integer NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_taxonomy_nodes_dimension ON public.taxonomy_nodes(dimension);
CREATE INDEX IF NOT EXISTS idx_taxonomy_nodes_parent ON public.taxonomy_nodes(parent_key);
CREATE INDEX IF NOT EXISTS idx_taxonomy_nodes_dimension_depth ON public.taxonomy_nodes(dimension, depth);

COMMENT ON TABLE public.taxonomy_nodes IS '平台標準詞彙：生產模式、材料、工藝（大類→細類→工藝標籤）';

ALTER TABLE public.taxonomy_nodes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "taxonomy_nodes_select" ON public.taxonomy_nodes;
CREATE POLICY "taxonomy_nodes_select" ON public.taxonomy_nodes FOR SELECT USING (is_active = true);

CREATE TABLE IF NOT EXISTS public.vendor_asset_taxonomy_links (
    asset_id uuid NOT NULL REFERENCES public.vendor_assets(id) ON DELETE CASCADE,
    taxonomy_key text NOT NULL REFERENCES public.taxonomy_nodes(key) ON DELETE CASCADE,
    PRIMARY KEY (asset_id, taxonomy_key)
);

CREATE INDEX IF NOT EXISTS idx_vendor_asset_taxonomy_key ON public.vendor_asset_taxonomy_links(taxonomy_key);

COMMENT ON TABLE public.vendor_asset_taxonomy_links IS '素材／原型可執行工藝（capability depth=2 工藝標籤）';

ALTER TABLE public.vendor_assets
    ADD COLUMN IF NOT EXISTS production_type_key text;

CREATE INDEX IF NOT EXISTS idx_vendor_assets_production_type ON public.vendor_assets(production_type_key);

COMMENT ON COLUMN public.vendor_assets.production_type_key IS '生產模式：prod.mass 等（單選，與工藝分開）';

ALTER TABLE public.vendor_assets
    ADD COLUMN IF NOT EXISTS capability_custom_labels text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.vendor_assets.capability_custom_labels IS '廠商自填工藝（其他），與 taxonomy link 並存';

ALTER TABLE public.vendor_asset_taxonomy_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vendor_asset_taxonomy_links_select" ON public.vendor_asset_taxonomy_links;
CREATE POLICY "vendor_asset_taxonomy_links_select" ON public.vendor_asset_taxonomy_links FOR SELECT USING (true);

-- ── 生產模式（獨立維度；工業製造／職人工藝為 AI 族，不進工藝樹）──
INSERT INTO public.taxonomy_nodes (key, dimension, parent_key, depth, name_zh, aliases, moq_hint_json, sort_order)
VALUES
('prod.mass', 'production_type', NULL, 0, '工業量產', '{}'::text[],
 '{"min":500,"max":null,"family":"industrial","family_label":"工業製造","traits":["大量生產","設備導向","穩定MOQ"],"examples":["射出","CNC","印刷","雷射"]}'::jsonb, 10),
('prod.small_batch', 'production_type', NULL, 0, '小量生產', '{}'::text[],
 '{"min":20,"max":500,"family":"industrial","family_label":"工業製造","traits":["小量生產"],"examples":[]}'::jsonb, 20),
('prod.artisan', 'production_type', NULL, 0, '職人手作', ARRAY['職人工藝']::text[],
 '{"min":1,"max":20,"family":"artisan","family_label":"職人工藝","traits":["少量生產","技術導向","個人品牌導向"],"examples":["訂製西裝","手工皮件","手工珠寶","木作家具"]}'::jsonb, 30),
('prod.bespoke', 'production_type', NULL, 0, '單件客製', '{}'::text[],
 '{"min":1,"max":1,"family":"artisan","family_label":"職人工藝","traits":["單件客製"],"examples":[]}'::jsonb, 40),

-- ── 材料（獨立維度；種子維持，後台可擴充）──
('mat.leather', 'material', NULL, 0, '皮革', '{}'::text[], NULL, 10),
('mat.leather.vegetable_tanned', 'material', 'mat.leather', 1, '植鞣牛皮', ARRAY['植鞣','veg tan']::text[], NULL, 11),
('mat.leather.chrome_tanned', 'material', 'mat.leather', 1, '鉻鞣革', '{}'::text[], NULL, 12),
('mat.leather.pu', 'material', 'mat.leather', 1, 'PU 人造皮', '{}'::text[], NULL, 13),
('mat.leather.pvc', 'material', 'mat.leather', 1, 'PVC 人造皮', '{}'::text[], NULL, 14),
('mat.wood', 'material', NULL, 0, '木材', '{}'::text[], NULL, 20),
('mat.wood.walnut', 'material', 'mat.wood', 1, '胡桃木', '{}'::text[], NULL, 21),
('mat.wood.oak', 'material', 'mat.wood', 1, '橡木', '{}'::text[], NULL, 22),
('mat.wood.bamboo', 'material', 'mat.wood', 1, '竹材', '{}'::text[], NULL, 23),
('mat.metal', 'material', NULL, 0, '金屬', '{}'::text[], NULL, 30),
('mat.metal.al6061', 'material', 'mat.metal', 1, '6061 鋁合金', ARRAY['6061','鋁合金']::text[], NULL, 31),
('mat.metal.stainless', 'material', 'mat.metal', 1, '不鏽鋼', '{}'::text[], NULL, 32),
('mat.metal.brass', 'material', 'mat.metal', 1, '黃銅', '{}'::text[], NULL, 33),
('mat.metal.gold_k', 'material', 'mat.metal', 1, 'K 金', '{}'::text[], NULL, 34),
('mat.metal.silver', 'material', 'mat.metal', 1, '純銀／925 銀', '{}'::text[], NULL, 35),
('mat.plastic', 'material', NULL, 0, '塑膠', '{}'::text[], NULL, 40),
('mat.plastic.abs', 'material', 'mat.plastic', 1, 'ABS 塑膠', ARRAY['ABS']::text[], NULL, 41),
('mat.plastic.pc', 'material', 'mat.plastic', 1, 'PC 塑膠', '{}'::text[], NULL, 42),
('mat.plastic.acrylic', 'material', 'mat.plastic', 1, '壓克力（PMMA）', ARRAY['壓克力','亞克力']::text[], NULL, 43),
('mat.silicone', 'material', NULL, 0, '矽膠', '{}'::text[], NULL, 50),
('mat.silicone.liquid', 'material', 'mat.silicone', 1, '液態矽膠（LSR）', ARRAY['LSR','液態矽膠']::text[], NULL, 51),
('mat.silicone.solid', 'material', 'mat.silicone', 1, '固態矽膠', '{}'::text[], NULL, 52),
('mat.fabric', 'material', NULL, 0, '布料', '{}'::text[], NULL, 60),
('mat.fabric.cotton', 'material', 'mat.fabric', 1, '棉布', '{}'::text[], NULL, 61),
('mat.fabric.linen', 'material', 'mat.fabric', 1, '亞麻布', '{}'::text[], NULL, 62),
('mat.fabric.polyester', 'material', 'mat.fabric', 1, '聚酯纖維', '{}'::text[], NULL, 63),
('mat.fabric.nylon', 'material', 'mat.fabric', 1, '尼龍', '{}'::text[], NULL, 64),
('mat.fabric.goretex', 'material', 'mat.fabric', 1, 'Gore-Tex 防水布', ARRAY['Gore-Tex','防水布']::text[], NULL, 65),
('mat.glass', 'material', NULL, 0, '玻璃', '{}'::text[], NULL, 70),
('mat.glass.tempered', 'material', 'mat.glass', 1, '強化玻璃', '{}'::text[], NULL, 71),
('mat.ceramic', 'material', NULL, 0, '陶瓷', '{}'::text[], NULL, 80),
('mat.ceramic.porcelain', 'material', 'mat.ceramic', 1, '瓷土／陶瓷', '{}'::text[], NULL, 81),
('mat.rubber', 'material', NULL, 0, '橡膠', '{}'::text[], NULL, 90),
('mat.rubber.natural', 'material', 'mat.rubber', 1, '天然橡膠', '{}'::text[], NULL, 91),
('mat.carbon_fiber', 'material', NULL, 0, '碳纖維', ARRAY['碳纖','CF']::text[], NULL, 100),

-- ══ 1 印刷工藝 ══
('cap.printing', 'capability', NULL, 0, '印刷工藝', '{}'::text[], NULL, 10),
('cap.printing.digital', 'capability', 'cap.printing', 1, '數位印刷', '{}'::text[], NULL, 10),
('cap.printing.digital.uv', 'capability', 'cap.printing.digital', 2, 'UV印刷', ARRAY['UV']::text[], NULL, 1001),
('cap.printing.digital.inkjet', 'capability', 'cap.printing.digital', 2, '數位噴墨印刷', '{}'::text[], NULL, 1002),
('cap.printing.digital.latex', 'capability', 'cap.printing.digital', 2, 'Latex印刷', '{}'::text[], NULL, 1003),
('cap.printing.digital.dtg', 'capability', 'cap.printing.digital', 2, 'DTG直噴印刷', ARRAY['DTG']::text[], NULL, 1004),
('cap.printing.digital.dtf', 'capability', 'cap.printing.digital', 2, 'DTF轉印', ARRAY['DTF']::text[], NULL, 1005),
('cap.printing.digital.heat_transfer', 'capability', 'cap.printing.digital', 2, '熱轉印', '{}'::text[], NULL, 1006),
('cap.printing.digital.sublimation', 'capability', 'cap.printing.digital', 2, '熱昇華轉印', '{}'::text[], NULL, 1007),
('cap.printing.digital.heat_press', 'capability', 'cap.printing.digital', 2, '熱壓轉印', '{}'::text[], NULL, 1008),
('cap.printing.digital.film_transfer', 'capability', 'cap.printing.digital', 2, '膠膜轉印', '{}'::text[], NULL, 1009),
('cap.printing.traditional', 'capability', 'cap.printing', 1, '傳統印刷', '{}'::text[], NULL, 20),
('cap.printing.traditional.screen', 'capability', 'cap.printing.traditional', 2, '網版印刷', '{}'::text[], NULL, 2001),
('cap.printing.traditional.pad', 'capability', 'cap.printing.traditional', 2, '移印', '{}'::text[], NULL, 2002),
('cap.printing.traditional.letterpress', 'capability', 'cap.printing.traditional', 2, '凸版印刷', '{}'::text[], NULL, 2003),
('cap.printing.traditional.gravure', 'capability', 'cap.printing.traditional', 2, '凹版印刷', '{}'::text[], NULL, 2004),
('cap.printing.traditional.offset', 'capability', 'cap.printing.traditional', 2, '平版印刷', '{}'::text[], NULL, 2005),
('cap.printing.special', 'capability', 'cap.printing', 1, '特殊印刷', '{}'::text[], NULL, 30),
('cap.printing.special.foil_gold', 'capability', 'cap.printing.special', 2, '燙金', '{}'::text[], NULL, 3001),
('cap.printing.special.foil_silver', 'capability', 'cap.printing.special', 2, '燙銀', '{}'::text[], NULL, 3002),
('cap.printing.special.spot_uv', 'capability', 'cap.printing.special', 2, '局部UV', ARRAY['局部 UV']::text[], NULL, 3003),
('cap.printing.special.emboss_print', 'capability', 'cap.printing.special', 2, '浮雕印刷', '{}'::text[], NULL, 3004),
('cap.printing.special.glow', 'capability', 'cap.printing.special', 2, '夜光印刷', '{}'::text[], NULL, 3005),
('cap.printing.special.scent', 'capability', 'cap.printing.special', 2, '香味印刷', '{}'::text[], NULL, 3006),

-- ══ 2 紡織與車縫 ══
('cap.textile', 'capability', NULL, 0, '紡織與車縫', ARRAY['紡織工藝']::text[], NULL, 20),
('cap.textile.fabric_proc', 'capability', 'cap.textile', 1, '布料加工', '{}'::text[], NULL, 10),
('cap.textile.fabric_proc.dyeing', 'capability', 'cap.textile.fabric_proc', 2, '染色', '{}'::text[], NULL, 1001),
('cap.textile.fabric_proc.digital_print', 'capability', 'cap.textile.fabric_proc', 2, '數位印花', '{}'::text[], NULL, 1002),
('cap.textile.fabric_proc.jacquard', 'capability', 'cap.textile.fabric_proc', 2, '提花織造', '{}'::text[], NULL, 1003),
('cap.textile.fabric_proc.embroidery', 'capability', 'cap.textile.fabric_proc', 2, '刺繡', '{}'::text[], NULL, 1004),
('cap.textile.fabric_proc.laser_fabric', 'capability', 'cap.textile.fabric_proc', 2, '雷射雕刻布料', '{}'::text[], NULL, 1005),
('cap.textile.sewing', 'capability', 'cap.textile', 1, '車縫製造', '{}'::text[], NULL, 20),
('cap.textile.sewing.flat_seam', 'capability', 'cap.textile.sewing', 2, '平車', '{}'::text[], NULL, 2001),
('cap.textile.sewing.high_post', 'capability', 'cap.textile.sewing', 2, '高車', '{}'::text[], NULL, 2002),
('cap.textile.sewing.twin_needle', 'capability', 'cap.textile.sewing', 2, '雙針車', '{}'::text[], NULL, 2003),
('cap.textile.sewing.binding', 'capability', 'cap.textile.sewing', 2, '包邊', '{}'::text[], NULL, 2004),
('cap.textile.sewing.piping', 'capability', 'cap.textile.sewing', 2, '滾邊', '{}'::text[], NULL, 2005),
('cap.textile.garment', 'capability', 'cap.textile', 1, '成衣加工', '{}'::text[], NULL, 30),
('cap.textile.garment.pattern', 'capability', 'cap.textile.garment', 2, '打版', '{}'::text[], NULL, 3001),
('cap.textile.garment.sampling', 'capability', 'cap.textile.garment', 2, '樣品製作', '{}'::text[], NULL, 3002),
('cap.textile.garment.garment_mfg', 'capability', 'cap.textile.garment', 2, '成衣製造', '{}'::text[], NULL, 3003),
('cap.textile.garment.uniform', 'capability', 'cap.textile.garment', 2, '制服製造', '{}'::text[], NULL, 3004),
('cap.textile.garment.sportswear', 'capability', 'cap.textile.garment', 2, '運動服製造', '{}'::text[], NULL, 3005),

-- ══ 3 皮革工藝 ══
('cap.leather', 'capability', NULL, 0, '皮革工藝', '{}'::text[], NULL, 30),
('cap.leather.genuine', 'capability', 'cap.leather', 1, '真皮加工', '{}'::text[], NULL, 10),
('cap.leather.genuine.veg_tan', 'capability', 'cap.leather.genuine', 2, '植鞣革', '{}'::text[], NULL, 1001),
('cap.leather.genuine.chrome_tan', 'capability', 'cap.leather.genuine', 2, '鉻鞣革', '{}'::text[], NULL, 1002),
('cap.leather.genuine.handcraft', 'capability', 'cap.leather.genuine', 2, '手工皮件', ARRAY['手工','手作皮件']::text[], NULL, 1003),
('cap.leather.synthetic', 'capability', 'cap.leather', 1, '人造皮革', '{}'::text[], NULL, 20),
('cap.leather.synthetic.pu', 'capability', 'cap.leather.synthetic', 2, 'PU皮革', ARRAY['PU']::text[], NULL, 2001),
('cap.leather.synthetic.pvc', 'capability', 'cap.leather.synthetic', 2, 'PVC皮革', ARRAY['PVC']::text[], NULL, 2002),
('cap.leather.synthetic.microfiber', 'capability', 'cap.leather.synthetic', 2, '超纖皮革', '{}'::text[], NULL, 2003),
('cap.leather.leather_goods', 'capability', 'cap.leather', 1, '皮件製造', '{}'::text[], NULL, 30),
('cap.leather.leather_goods.cutting', 'capability', 'cap.leather.leather_goods', 2, '裁切', '{}'::text[], NULL, 3001),
('cap.leather.leather_goods.stitching', 'capability', 'cap.leather.leather_goods', 2, '縫製', '{}'::text[], NULL, 3002),
('cap.leather.leather_goods.emboss', 'capability', 'cap.leather.leather_goods', 2, '壓印', '{}'::text[], NULL, 3003),
('cap.leather.leather_goods.branding', 'capability', 'cap.leather.leather_goods', 2, '烙印', '{}'::text[], NULL, 3004),
('cap.leather.leather_goods.leather_dye', 'capability', 'cap.leather.leather_goods', 2, '染色', '{}'::text[], NULL, 3005),

-- ══ 4 木工工藝 ══
('cap.wood', 'capability', NULL, 0, '木工工藝', '{}'::text[], NULL, 40),
('cap.wood.wood_proc', 'capability', 'cap.wood', 1, '木材加工', '{}'::text[], NULL, 10),
('cap.wood.wood_proc.cnc_carve', 'capability', 'cap.wood.wood_proc', 2, 'CNC木雕', '{}'::text[], NULL, 1001),
('cap.wood.wood_proc.laser_cut', 'capability', 'cap.wood.wood_proc', 2, '雷射切割', '{}'::text[], NULL, 1002),
('cap.wood.wood_proc.carving', 'capability', 'cap.wood.wood_proc', 2, '雕刻', '{}'::text[], NULL, 1003),
('cap.wood.wood_proc.lathe', 'capability', 'cap.wood.wood_proc', 2, '車床加工', '{}'::text[], NULL, 1004),
('cap.wood.wood_finish', 'capability', 'cap.wood', 1, '表面處理', '{}'::text[], NULL, 20),
('cap.wood.wood_finish.wood_dye', 'capability', 'cap.wood.wood_finish', 2, '染色', '{}'::text[], NULL, 2001),
('cap.wood.wood_finish.wax_oil', 'capability', 'cap.wood.wood_finish', 2, '木蠟油', '{}'::text[], NULL, 2002),
('cap.wood.wood_finish.pu_coat', 'capability', 'cap.wood.wood_finish', 2, 'PU漆', '{}'::text[], NULL, 2003),
('cap.wood.wood_finish.bake_paint', 'capability', 'cap.wood.wood_finish', 2, '烤漆', '{}'::text[], NULL, 2004),
('cap.wood.wood_asm', 'capability', 'cap.wood', 1, '組裝工藝', '{}'::text[], NULL, 30),
('cap.wood.wood_asm.mortise', 'capability', 'cap.wood.wood_asm', 2, '榫接', '{}'::text[], NULL, 3001),
('cap.wood.wood_asm.hardware_asm', 'capability', 'cap.wood.wood_asm', 2, '五金組裝', '{}'::text[], NULL, 3002),
('cap.wood.wood_asm.panel_furniture', 'capability', 'cap.wood.wood_asm', 2, '板式家具組裝', '{}'::text[], NULL, 3003),

-- ══ 5 金屬加工 ══
('cap.metal', 'capability', NULL, 0, '金屬加工', ARRAY['金工工藝']::text[], NULL, 50),
('cap.metal.sheet_metal', 'capability', 'cap.metal', 1, '板金', '{}'::text[], NULL, 10),
('cap.metal.sheet_metal.laser_cut', 'capability', 'cap.metal.sheet_metal', 2, '雷射切割', '{}'::text[], NULL, 1001),
('cap.metal.sheet_metal.stamping', 'capability', 'cap.metal.sheet_metal', 2, '沖壓', '{}'::text[], NULL, 1002),
('cap.metal.sheet_metal.bending', 'capability', 'cap.metal.sheet_metal', 2, '折彎', '{}'::text[], NULL, 1003),
('cap.metal.sheet_metal.deep_draw', 'capability', 'cap.metal.sheet_metal', 2, '深抽', '{}'::text[], NULL, 1004),
('cap.metal.cnc_metal', 'capability', 'cap.metal', 1, 'CNC加工', '{}'::text[], NULL, 20),
('cap.metal.cnc_metal.cnc_turn', 'capability', 'cap.metal.cnc_metal', 2, 'CNC車削', '{}'::text[], NULL, 2001),
('cap.metal.cnc_metal.cnc_mill', 'capability', 'cap.metal.cnc_metal', 2, 'CNC銑削', '{}'::text[], NULL, 2002),
('cap.metal.cnc_metal.five_axis', 'capability', 'cap.metal.cnc_metal', 2, '五軸加工', '{}'::text[], NULL, 2003),
('cap.metal.welding', 'capability', 'cap.metal', 1, '焊接', '{}'::text[], NULL, 30),
('cap.metal.welding.tig', 'capability', 'cap.metal.welding', 2, 'TIG焊接', ARRAY['TIG']::text[], NULL, 3001),
('cap.metal.welding.mig', 'capability', 'cap.metal.welding', 2, 'MIG焊接', ARRAY['MIG']::text[], NULL, 3002),
('cap.metal.welding.spot_weld', 'capability', 'cap.metal.welding', 2, '點焊', '{}'::text[], NULL, 3003),
('cap.metal.welding.laser_weld', 'capability', 'cap.metal.welding', 2, '雷射焊接', '{}'::text[], NULL, 3004),
('cap.metal.metal_finish', 'capability', 'cap.metal', 1, '表面處理', '{}'::text[], NULL, 40),
('cap.metal.metal_finish.anodize', 'capability', 'cap.metal.metal_finish', 2, '陽極處理', '{}'::text[], NULL, 4001),
('cap.metal.metal_finish.plating', 'capability', 'cap.metal.metal_finish', 2, '電鍍', '{}'::text[], NULL, 4002),
('cap.metal.metal_finish.sandblast', 'capability', 'cap.metal.metal_finish', 2, '噴砂', '{}'::text[], NULL, 4003),
('cap.metal.metal_finish.hairline', 'capability', 'cap.metal.metal_finish', 2, '髮絲紋', '{}'::text[], NULL, 4004),
('cap.metal.metal_finish.polish', 'capability', 'cap.metal.metal_finish', 2, '拋光', '{}'::text[], NULL, 4005),
('cap.metal.metal_finish.powder_coat', 'capability', 'cap.metal.metal_finish', 2, '粉體烤漆', '{}'::text[], NULL, 4006),

-- ══ 6 塑膠加工 ══
('cap.plastics', 'capability', NULL, 0, '塑膠加工', ARRAY['塑膠工藝']::text[], NULL, 60),
('cap.plastics.injection', 'capability', 'cap.plastics', 1, '射出成型', '{}'::text[], NULL, 10),
('cap.plastics.injection.single', 'capability', 'cap.plastics.injection', 2, '單色射出', '{}'::text[], NULL, 1001),
('cap.plastics.injection.dual', 'capability', 'cap.plastics.injection', 2, '雙色射出', '{}'::text[], NULL, 1002),
('cap.plastics.injection.overmold', 'capability', 'cap.plastics.injection', 2, '包膠射出', '{}'::text[], NULL, 1003),
('cap.plastics.blow', 'capability', 'cap.plastics', 1, '吹塑', '{}'::text[], NULL, 20),
('cap.plastics.blow.hollow', 'capability', 'cap.plastics.blow', 2, '中空吹塑', '{}'::text[], NULL, 2001),
('cap.plastics.vacuum', 'capability', 'cap.plastics', 1, '真空成型', '{}'::text[], NULL, 30),
('cap.plastics.vacuum.thermoform', 'capability', 'cap.plastics.vacuum', 2, '吸塑', '{}'::text[], NULL, 3001),
('cap.plastics.vacuum.dome', 'capability', 'cap.plastics.vacuum', 2, '真空罩成型', '{}'::text[], NULL, 3002),
('cap.plastics.post', 'capability', 'cap.plastics', 1, '塑膠後加工', '{}'::text[], NULL, 40),
('cap.plastics.post.ultrasonic', 'capability', 'cap.plastics.post', 2, '超音波熔接', '{}'::text[], NULL, 4001),
('cap.plastics.post.heat_weld', 'capability', 'cap.plastics.post', 2, '熱熔接', '{}'::text[], NULL, 4002),
('cap.plastics.post.bonding', 'capability', 'cap.plastics.post', 2, '膠合', '{}'::text[], NULL, 4003),

-- ══ 7 矽膠與橡膠 ══
('cap.silicone_rubber', 'capability', NULL, 0, '矽膠與橡膠', ARRAY['矽膠工藝']::text[], NULL, 70),
('cap.silicone_rubber.silicone', 'capability', 'cap.silicone_rubber', 1, '矽膠加工', '{}'::text[], NULL, 10),
('cap.silicone_rubber.silicone.lsr', 'capability', 'cap.silicone_rubber.silicone', 2, '液態矽膠', '{}'::text[], NULL, 1001),
('cap.silicone_rubber.silicone.compression', 'capability', 'cap.silicone_rubber.silicone', 2, '模壓矽膠', '{}'::text[], NULL, 1002),
('cap.silicone_rubber.silicone.food_grade', 'capability', 'cap.silicone_rubber.silicone', 2, '食品級矽膠', '{}'::text[], NULL, 1003),
('cap.silicone_rubber.rubber', 'capability', 'cap.silicone_rubber', 1, '橡膠加工', '{}'::text[], NULL, 20),
('cap.silicone_rubber.rubber.rubber_mold', 'capability', 'cap.silicone_rubber.rubber', 2, '模壓成型', '{}'::text[], NULL, 2001),
('cap.silicone_rubber.rubber.extrusion', 'capability', 'cap.silicone_rubber.rubber', 2, '擠出成型', '{}'::text[], NULL, 2002),

-- ══ 8 珠寶與金工 ══
('cap.jewelry', 'capability', NULL, 0, '珠寶與金工', ARRAY['珠寶工藝']::text[], NULL, 80),
('cap.jewelry.casting', 'capability', 'cap.jewelry', 1, '鑄造', '{}'::text[], NULL, 10),
('cap.jewelry.casting.lost_wax', 'capability', 'cap.jewelry.casting', 2, '脫蠟鑄造', '{}'::text[], NULL, 1001),
('cap.jewelry.casting.centrifugal', 'capability', 'cap.jewelry.casting', 2, '離心鑄造', '{}'::text[], NULL, 1002),
('cap.jewelry.metalsmith', 'capability', 'cap.jewelry', 1, '金工', '{}'::text[], NULL, 20),
('cap.jewelry.metalsmith.hand_metal', 'capability', 'cap.jewelry.metalsmith', 2, '手工金工', ARRAY['手工']::text[], NULL, 2001),
('cap.jewelry.metalsmith.silver', 'capability', 'cap.jewelry.metalsmith', 2, '銀飾製作', '{}'::text[], NULL, 2002),
('cap.jewelry.metalsmith.gold_k', 'capability', 'cap.jewelry.metalsmith', 2, 'K金製作', '{}'::text[], NULL, 2003),
('cap.jewelry.gem', 'capability', 'cap.jewelry', 1, '寶石加工', '{}'::text[], NULL, 30),
('cap.jewelry.gem.setting', 'capability', 'cap.jewelry.gem', 2, '鑲嵌', '{}'::text[], NULL, 3001),
('cap.jewelry.gem.gem_polish', 'capability', 'cap.jewelry.gem', 2, '拋光', '{}'::text[], NULL, 3002),
('cap.jewelry.gem.gem_cut', 'capability', 'cap.jewelry.gem', 2, '切割', '{}'::text[], NULL, 3003),

-- ══ 9 模型與裝飾品 ══
('cap.modeling', 'capability', NULL, 0, '模型與裝飾品', ARRAY['模型工藝']::text[], NULL, 90),
('cap.modeling.model_make', 'capability', 'cap.modeling', 1, '模型製作', '{}'::text[], NULL, 10),
('cap.modeling.model_make.resin', 'capability', 'cap.modeling.model_make', 2, '樹脂模型', '{}'::text[], NULL, 1001),
('cap.modeling.model_make.pvc', 'capability', 'cap.modeling.model_make', 2, 'PVC模型', ARRAY['PVC']::text[], NULL, 1002),
('cap.modeling.model_make.abs', 'capability', 'cap.modeling.model_make', 2, 'ABS模型', ARRAY['ABS']::text[], NULL, 1003),
('cap.modeling.mold_cast', 'capability', 'cap.modeling', 1, '翻模', '{}'::text[], NULL, 20),
('cap.modeling.mold_cast.silicone_mold', 'capability', 'cap.modeling.mold_cast', 2, '矽膠翻模', '{}'::text[], NULL, 2001),
('cap.modeling.mold_cast.pu_cast', 'capability', 'cap.modeling.mold_cast', 2, 'PU灌注', '{}'::text[], NULL, 2002),
('cap.modeling.proto', 'capability', 'cap.modeling', 1, '原型開發', '{}'::text[], NULL, 30),
('cap.modeling.proto.mockup', 'capability', 'cap.modeling.proto', 2, '手板製作', '{}'::text[], NULL, 3001),
('cap.modeling.proto.sampling', 'capability', 'cap.modeling.proto', 2, '打樣', '{}'::text[], NULL, 3002),

-- ══ 10 3D製造 ══
('cap.3d', 'capability', NULL, 0, '3D製造', '{}'::text[], NULL, 100),
('cap.3d.print_3d', 'capability', 'cap.3d', 1, '3D列印', '{}'::text[], NULL, 10),
('cap.3d.print_3d.fdm', 'capability', 'cap.3d.print_3d', 2, 'FDM', '{}'::text[], NULL, 1001),
('cap.3d.print_3d.sla', 'capability', 'cap.3d.print_3d', 2, 'SLA', '{}'::text[], NULL, 1002),
('cap.3d.print_3d.sls', 'capability', 'cap.3d.print_3d', 2, 'SLS', '{}'::text[], NULL, 1003),
('cap.3d.print_3d.mjf', 'capability', 'cap.3d.print_3d', 2, 'MJF', '{}'::text[], NULL, 1004),
('cap.3d.scan', 'capability', 'cap.3d', 1, '3D掃描', '{}'::text[], NULL, 20),
('cap.3d.scan.point_cloud', 'capability', 'cap.3d.scan', 2, '點雲掃描', '{}'::text[], NULL, 2001),
('cap.3d.scan.reverse_eng', 'capability', 'cap.3d.scan', 2, '逆向工程', '{}'::text[], NULL, 2002),

-- ══ 11 雷射加工 ══
('cap.laser', 'capability', NULL, 0, '雷射加工', '{}'::text[], NULL, 110),
('cap.laser.laser_cut', 'capability', 'cap.laser', 1, '雷射切割', '{}'::text[], NULL, 10),
('cap.laser.laser_cut.wood', 'capability', 'cap.laser.laser_cut', 2, '木材', ARRAY['雷射切割·木材']::text[], NULL, 1001),
('cap.laser.laser_cut.acrylic', 'capability', 'cap.laser.laser_cut', 2, '壓克力', ARRAY['雷射切割·壓克力']::text[], NULL, 1002),
('cap.laser.laser_cut.metal', 'capability', 'cap.laser.laser_cut', 2, '金屬', ARRAY['雷射切割·金屬']::text[], NULL, 1003),
('cap.laser.laser_cut.fabric', 'capability', 'cap.laser.laser_cut', 2, '布料', ARRAY['雷射切割·布料']::text[], NULL, 1004),
('cap.laser.laser_engrave', 'capability', 'cap.laser', 1, '雷射雕刻', '{}'::text[], NULL, 20),
('cap.laser.laser_engrave.wood', 'capability', 'cap.laser.laser_engrave', 2, '木材', ARRAY['雷射雕刻·木材']::text[], NULL, 2001),
('cap.laser.laser_engrave.metal', 'capability', 'cap.laser.laser_engrave', 2, '金屬', ARRAY['雷射雕刻·金屬']::text[], NULL, 2002),
('cap.laser.laser_engrave.leather', 'capability', 'cap.laser.laser_engrave', 2, '皮革', ARRAY['雷射雕刻·皮革']::text[], NULL, 2003),
('cap.laser.laser_engrave.glass', 'capability', 'cap.laser.laser_engrave', 2, '玻璃', ARRAY['雷射雕刻·玻璃']::text[], NULL, 2004),

-- ══ 12 玻璃與陶瓷 ══
('cap.glass_ceramic', 'capability', NULL, 0, '玻璃與陶瓷', ARRAY['玻璃陶瓷']::text[], NULL, 120),
('cap.glass_ceramic.glass', 'capability', 'cap.glass_ceramic', 1, '玻璃', '{}'::text[], NULL, 10),
('cap.glass_ceramic.glass.heat_bend', 'capability', 'cap.glass_ceramic.glass', 2, '熱彎玻璃', '{}'::text[], NULL, 1001),
('cap.glass_ceramic.glass.sandblast_glass', 'capability', 'cap.glass_ceramic.glass', 2, '噴砂玻璃', '{}'::text[], NULL, 1002),
('cap.glass_ceramic.glass.painted_glass', 'capability', 'cap.glass_ceramic.glass', 2, '彩繪玻璃', '{}'::text[], NULL, 1003),
('cap.glass_ceramic.ceramic', 'capability', 'cap.glass_ceramic', 1, '陶瓷', '{}'::text[], NULL, 20),
('cap.glass_ceramic.ceramic.slip_cast', 'capability', 'cap.glass_ceramic.ceramic', 2, '灌漿', '{}'::text[], NULL, 2001),
('cap.glass_ceramic.ceramic.wheel_throw', 'capability', 'cap.glass_ceramic.ceramic', 2, '手拉坯', ARRAY['手拉坏']::text[], NULL, 2002),
('cap.glass_ceramic.ceramic.high_fire', 'capability', 'cap.glass_ceramic.ceramic', 2, '高溫燒製', '{}'::text[], NULL, 2003),
('cap.glass_ceramic.ceramic.glaze_fire', 'capability', 'cap.glass_ceramic.ceramic', 2, '釉燒', '{}'::text[], NULL, 2004),

-- ══ 13 包裝工藝 ══
('cap.packaging', 'capability', NULL, 0, '包裝工藝', '{}'::text[], NULL, 130),
('cap.packaging.paper_pack', 'capability', 'cap.packaging', 1, '紙製包裝', '{}'::text[], NULL, 10),
('cap.packaging.paper_pack.color_box', 'capability', 'cap.packaging.paper_pack', 2, '彩盒', '{}'::text[], NULL, 1001),
('cap.packaging.paper_pack.corrugated', 'capability', 'cap.packaging.paper_pack', 2, '瓦楞紙箱', '{}'::text[], NULL, 1002),
('cap.packaging.paper_pack.rigid_box', 'capability', 'cap.packaging.paper_pack', 2, '精裝盒', '{}'::text[], NULL, 1003),
('cap.packaging.special_pack', 'capability', 'cap.packaging', 1, '特殊包裝', '{}'::text[], NULL, 20),
('cap.packaging.special_pack.magnetic_box', 'capability', 'cap.packaging.special_pack', 2, '磁吸盒', '{}'::text[], NULL, 2001),
('cap.packaging.special_pack.drawer_box', 'capability', 'cap.packaging.special_pack', 2, '抽屜盒', '{}'::text[], NULL, 2002),
('cap.packaging.special_pack.display_box', 'capability', 'cap.packaging.special_pack', 2, '展示盒', '{}'::text[], NULL, 2003),

-- ══ 14 鐘錶微型工藝 ══
('cap.horology', 'capability', NULL, 0, '鐘錶微型工藝', ARRAY['鐘錶工藝']::text[], NULL, 140),
('cap.horology.watch', 'capability', 'cap.horology', 1, '鐘錶加工', '{}'::text[], NULL, 10),
('cap.horology.watch.case', 'capability', 'cap.horology.watch', 2, '錶殼加工', '{}'::text[], NULL, 1001),
('cap.horology.watch.strap', 'capability', 'cap.horology.watch', 2, '錶帶製造', '{}'::text[], NULL, 1002),
('cap.horology.watch.dial', 'capability', 'cap.horology.watch', 2, '面盤加工', '{}'::text[], NULL, 1003),
('cap.horology.micro', 'capability', 'cap.horology', 1, '微型加工', '{}'::text[], NULL, 20),
('cap.horology.micro.micro_cnc', 'capability', 'cap.horology.micro', 2, '微米CNC', '{}'::text[], NULL, 2001),
('cap.horology.micro.precision_turn', 'capability', 'cap.horology.micro', 2, '精密車削', '{}'::text[], NULL, 2002),
('cap.horology.micro.micro_asm', 'capability', 'cap.horology.micro', 2, '微型組裝', '{}'::text[], NULL, 2003),

-- ══ 15 交通與戶外改裝 ══
('cap.automotive_outdoor', 'capability', NULL, 0, '交通與戶外改裝', ARRAY['交通改裝工藝']::text[], NULL, 150),
('cap.automotive_outdoor.vehicle', 'capability', 'cap.automotive_outdoor', 1, '車體改裝', '{}'::text[], NULL, 10),
('cap.automotive_outdoor.vehicle.paint', 'capability', 'cap.automotive_outdoor.vehicle', 2, '烤漆', '{}'::text[], NULL, 1001),
('cap.automotive_outdoor.vehicle.wrap', 'capability', 'cap.automotive_outdoor.vehicle', 2, '包膜', '{}'::text[], NULL, 1002),
('cap.automotive_outdoor.vehicle.carbon_fiber', 'capability', 'cap.automotive_outdoor.vehicle', 2, '碳纖維加工', '{}'::text[], NULL, 1003),
('cap.automotive_outdoor.outdoor', 'capability', 'cap.automotive_outdoor', 1, '戶外裝備', '{}'::text[], NULL, 20),
('cap.automotive_outdoor.outdoor.tactical_sew', 'capability', 'cap.automotive_outdoor.outdoor', 2, '戰術縫製', '{}'::text[], NULL, 2001),
('cap.automotive_outdoor.outdoor.seam_tape', 'capability', 'cap.automotive_outdoor.outdoor', 2, '防水貼條', '{}'::text[], NULL, 2002),
('cap.automotive_outdoor.outdoor.hf_weld', 'capability', 'cap.automotive_outdoor.outdoor', 2, '高週波熔接', '{}'::text[], NULL, 2003)
ON CONFLICT (key) DO UPDATE SET
    dimension = EXCLUDED.dimension,
    parent_key = EXCLUDED.parent_key,
    depth = EXCLUDED.depth,
    name_zh = EXCLUDED.name_zh,
    aliases = EXCLUDED.aliases,
    moq_hint_json = EXCLUDED.moq_hint_json,
    sort_order = EXCLUDED.sort_order,
    is_active = true,
    updated_at = now();

-- 下架舊版 v2 合併項與錯誤大類（若曾跑過舊 SQL）
UPDATE public.taxonomy_nodes SET is_active = false, updated_at = now()
WHERE key IN (
    'cap.leather.leather_proc',
    'cap.leather.leather_proc.genuine',
    'cap.leather.leather_proc.synthetic',
    'cap.leather.leather_goods.handcraft',
    'cap.plastics.molding',
    'cap.plastics.molding.injection',
    'cap.plastics.molding.overmold',
    'cap.plastics.molding.blow_mold',
    'cap.plastics.molding.vacuum_form',
    'cap.plastics.plastic_post',
    'cap.plastics.plastic_post.ultrasonic',
    'cap.plastics.plastic_post.heat_weld',
    'cap.plastics.plastic_post.bonding',
    'cap.modeling.model_make.resin_pvc_abs',
    'cap.3d.reverse_3d',
    'cap.3d.reverse_3d.scan_3d',
    'cap.3d.reverse_3d.point_cloud',
    'cap.3d.reverse_3d.reverse_eng',
    'cap.surface',
    'cap.assembly',
    'cap.electronics',
    'cap.other'
);

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'vendor_assets_production_type_key_fkey'
          AND table_name = 'vendor_assets'
    ) THEN
        ALTER TABLE public.vendor_assets
            ADD CONSTRAINT vendor_assets_production_type_key_fkey
            FOREIGN KEY (production_type_key) REFERENCES public.taxonomy_nodes(key) ON DELETE SET NULL;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.portfolio_taxonomy_links (
    portfolio_id uuid NOT NULL REFERENCES public.manufacturer_portfolio(id) ON DELETE CASCADE,
    taxonomy_key text NOT NULL REFERENCES public.taxonomy_nodes(key) ON DELETE CASCADE,
    PRIMARY KEY (portfolio_id, taxonomy_key)
);

CREATE INDEX IF NOT EXISTS idx_portfolio_taxonomy_key ON public.portfolio_taxonomy_links(taxonomy_key);

COMMENT ON TABLE public.portfolio_taxonomy_links IS '作品案例涉及的工藝標籤（capability depth=2）';

ALTER TABLE public.manufacturer_portfolio
    ADD COLUMN IF NOT EXISTS production_type_key text;

CREATE INDEX IF NOT EXISTS idx_manufacturer_portfolio_production_type ON public.manufacturer_portfolio(production_type_key);

COMMENT ON COLUMN public.manufacturer_portfolio.production_type_key IS '生產模式（單選，選填）';

ALTER TABLE public.manufacturer_portfolio
    ADD COLUMN IF NOT EXISTS capability_custom_labels text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.manufacturer_portfolio.capability_custom_labels IS '廠商自填工藝（其他）';

ALTER TABLE public.portfolio_taxonomy_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "portfolio_taxonomy_links_select" ON public.portfolio_taxonomy_links;
CREATE POLICY "portfolio_taxonomy_links_select" ON public.portfolio_taxonomy_links FOR SELECT USING (true);

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'manufacturer_portfolio_production_type_key_fkey'
          AND table_name = 'manufacturer_portfolio'
    ) THEN
        ALTER TABLE public.manufacturer_portfolio
            ADD CONSTRAINT manufacturer_portfolio_production_type_key_fkey
            FOREIGN KEY (production_type_key) REFERENCES public.taxonomy_nodes(key) ON DELETE SET NULL;
    END IF;
END $$;
