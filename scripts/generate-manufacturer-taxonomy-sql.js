'use strict';
/**
 * 產出 docs/add-manufacturer-taxonomy.sql（MT-1；規格見 docs/manufacturer-taxonomy-plan.md）
 * 執行：node scripts/generate-manufacturer-taxonomy-sql.js
 */
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'docs', 'add-manufacturer-taxonomy.sql');

const PRODUCTION_TYPES = [
    { key: 'prod.bespoke', name_zh: '單件客製', sort: 10, moq: { min: 1, max: 1 } },
    { key: 'prod.artisan', name_zh: '職人工藝', sort: 20, moq: { min: 1, max: 20 } },
    { key: 'prod.small_batch', name_zh: '小量生產', sort: 30, moq: { min: 20, max: 500 } },
    { key: 'prod.mass', name_zh: '工業量產', sort: 40, moq: { min: 500, max: null } }
];

const MATERIALS = [
    { key: 'mat.leather', name_zh: '皮革', depth: 0, sort: 10 },
    { key: 'mat.leather.vegetable_tanned', name_zh: '植鞣牛皮', parent: 'mat.leather', depth: 1, sort: 11, aliases: ['植鞣', 'veg tan'] },
    { key: 'mat.leather.chrome_tanned', name_zh: '鉻鞣革', parent: 'mat.leather', depth: 1, sort: 12 },
    { key: 'mat.leather.pu', name_zh: 'PU 人造皮', parent: 'mat.leather', depth: 1, sort: 13 },
    { key: 'mat.leather.pvc', name_zh: 'PVC 人造皮', parent: 'mat.leather', depth: 1, sort: 14 },
    { key: 'mat.wood', name_zh: '木材', depth: 0, sort: 20 },
    { key: 'mat.wood.walnut', name_zh: '胡桃木', parent: 'mat.wood', depth: 1, sort: 21 },
    { key: 'mat.wood.oak', name_zh: '橡木', parent: 'mat.wood', depth: 1, sort: 22 },
    { key: 'mat.wood.bamboo', name_zh: '竹材', parent: 'mat.wood', depth: 1, sort: 23 },
    { key: 'mat.metal', name_zh: '金屬', depth: 0, sort: 30 },
    { key: 'mat.metal.al6061', name_zh: '6061 鋁合金', parent: 'mat.metal', depth: 1, sort: 31, aliases: ['6061', '鋁合金'] },
    { key: 'mat.metal.stainless', name_zh: '不鏽鋼', parent: 'mat.metal', depth: 1, sort: 32 },
    { key: 'mat.metal.brass', name_zh: '黃銅', parent: 'mat.metal', depth: 1, sort: 33 },
    { key: 'mat.metal.gold_k', name_zh: 'K 金', parent: 'mat.metal', depth: 1, sort: 34 },
    { key: 'mat.metal.silver', name_zh: '純銀／925 銀', parent: 'mat.metal', depth: 1, sort: 35 },
    { key: 'mat.plastic', name_zh: '塑膠', depth: 0, sort: 40 },
    { key: 'mat.plastic.abs', name_zh: 'ABS 塑膠', parent: 'mat.plastic', depth: 1, sort: 41, aliases: ['ABS'] },
    { key: 'mat.plastic.pc', name_zh: 'PC 塑膠', parent: 'mat.plastic', depth: 1, sort: 42 },
    { key: 'mat.plastic.acrylic', name_zh: '壓克力（PMMA）', parent: 'mat.plastic', depth: 1, sort: 43, aliases: ['壓克力', '亞克力'] },
    { key: 'mat.silicone', name_zh: '矽膠', depth: 0, sort: 50 },
    { key: 'mat.silicone.liquid', name_zh: '液態矽膠（LSR）', parent: 'mat.silicone', depth: 1, sort: 51, aliases: ['LSR', '液態矽膠'] },
    { key: 'mat.silicone.solid', name_zh: '固態矽膠', parent: 'mat.silicone', depth: 1, sort: 52 },
    { key: 'mat.fabric', name_zh: '布料', depth: 0, sort: 60 },
    { key: 'mat.fabric.cotton', name_zh: '棉布', parent: 'mat.fabric', depth: 1, sort: 61 },
    { key: 'mat.fabric.linen', name_zh: '亞麻布', parent: 'mat.fabric', depth: 1, sort: 62 },
    { key: 'mat.fabric.polyester', name_zh: '聚酯纖維', parent: 'mat.fabric', depth: 1, sort: 63 },
    { key: 'mat.fabric.nylon', name_zh: '尼龍', parent: 'mat.fabric', depth: 1, sort: 64 },
    { key: 'mat.fabric.goretex', name_zh: 'Gore-Tex 防水布', parent: 'mat.fabric', depth: 1, sort: 65, aliases: ['Gore-Tex', '防水布'] },
    { key: 'mat.glass', name_zh: '玻璃', depth: 0, sort: 70 },
    { key: 'mat.glass.tempered', name_zh: '強化玻璃', parent: 'mat.glass', depth: 1, sort: 71 },
    { key: 'mat.ceramic', name_zh: '陶瓷', depth: 0, sort: 80 },
    { key: 'mat.ceramic.porcelain', name_zh: '瓷土／陶瓷', parent: 'mat.ceramic', depth: 1, sort: 81 },
    { key: 'mat.rubber', name_zh: '橡膠', depth: 0, sort: 90 },
    { key: 'mat.rubber.natural', name_zh: '天然橡膠', parent: 'mat.rubber', depth: 1, sort: 91 },
    { key: 'mat.carbon_fiber', name_zh: '碳纖維', depth: 0, sort: 100, aliases: ['碳纖', 'CF'] }
];

/** @type {{ key: string, name_zh: string, sort: number, children: { key: string, name_zh: string, leaves: [string, string][] }[] }[]} */
const CAPABILITY_TREE = [
    {
        key: 'cap.printing', name_zh: '印刷工藝', sort: 10, children: [
            { key: 'digital', name_zh: '數位印刷', leaves: [['inkjet', '數位噴墨印刷'], ['latex', 'Latex 印刷'], ['dtg', 'DTG 直噴印刷'], ['dtf', 'DTF 轉印'], ['heat_transfer', '熱轉印'], ['sublimation', '熱昇華轉印'], ['heat_press', '熱壓轉印'], ['film_transfer', '膠膜轉印']] },
            { key: 'traditional', name_zh: '傳統印刷', leaves: [['screen', '網版印刷'], ['pad', '移印'], ['letterpress', '凸版印刷'], ['gravure', '凹版印刷'], ['offset', '平版印刷']] },
            { key: 'special', name_zh: '特殊印刷', leaves: [['foil_gold', '燙金'], ['foil_silver', '燙銀'], ['spot_uv', '局部 UV'], ['emboss_print', '浮雕印刷'], ['glow', '夜光印刷'], ['scent', '香味印刷']] },
            { key: 'hand_paint', name_zh: '手工彩繪', leaves: [['hand_paint', '手工彩繪', ['手繪', '定制彩繪']]] }
        ]
    },
    {
        key: 'cap.textile', name_zh: '紡織工藝', sort: 20, children: [
            { key: 'fabric_proc', name_zh: '布料加工', leaves: [
                ['dyeing', '染色'],
                ['digital_print', '數位印花'],
                ['jacquard', '提花織造'],
                ['embroidery', '刺繡', ['手繡', '傳統刺繡']],
                ['machine_embroidery', '電繡', ['電腦刺繡', '機繡', '電腦繡']],
                ['embroidery_3d', '立體電繡', ['3D刺繡', '立體刺繡', '泡棉繡']],
                ['laser_fabric', '雷射雕刻布料']
            ] },
            { key: 'sewing', name_zh: '車縫製造', leaves: [['flat_seam', '平車'], ['high_post', '高車'], ['twin_needle', '雙針車'], ['binding', '包邊'], ['piping', '滾邊']] },
            { key: 'garment', name_zh: '成衣加工', leaves: [['pattern', '打版'], ['sampling', '樣品製作'], ['garment_mfg', '成衣製造'], ['uniform', '制服製造'], ['sportswear', '運動服製造']] }
        ]
    },
    {
        key: 'cap.leather', name_zh: '皮革工藝', sort: 30, children: [
            { key: 'leather_proc', name_zh: '皮革加工', leaves: [['genuine', '真皮加工（植鞣革／鉻鞣革）'], ['synthetic', '人造皮加工（PU／PVC／超纖）']] },
            { key: 'leather_goods', name_zh: '皮件製造', leaves: [['handcraft', '手工皮件'], ['cutting', '裁切'], ['stitching', '縫製'], ['emboss', '壓印'], ['branding', '烙印'], ['leather_dye', '染色']] }
        ]
    },
    {
        key: 'cap.wood', name_zh: '木工工藝', sort: 40, children: [
            { key: 'wood_proc', name_zh: '木材加工', leaves: [['cnc_carve', 'CNC 木雕'], ['laser_cut', '雷射切割'], ['carving', '雕刻'], ['lathe', '車床加工']] },
            { key: 'wood_finish', name_zh: '表面處理', leaves: [['wood_dye', '染色'], ['wax_oil', '木蠟油'], ['pu_coat', 'PU 漆'], ['bake_paint', '烤漆']] },
            { key: 'wood_asm', name_zh: '組裝工藝', leaves: [['mortise', '榫接'], ['hardware_asm', '五金組裝'], ['panel_furniture', '板式家具組裝']] }
        ]
    },
    {
        key: 'cap.metal', name_zh: '金屬加工', sort: 50, children: [
            { key: 'sheet_metal', name_zh: '板金與成型', leaves: [['laser_cut', '雷射切割'], ['stamping', '沖壓'], ['bending', '折彎'], ['deep_draw', '深抽']] },
            { key: 'cnc_metal', name_zh: 'CNC 加工', leaves: [['cnc_turn', 'CNC 車削'], ['cnc_mill', 'CNC 銑削'], ['five_axis', '五軸加工']] },
            { key: 'welding', name_zh: '金屬焊接', leaves: [['tig', 'TIG 焊接'], ['mig', 'MIG 焊接'], ['spot_weld', '點焊'], ['laser_weld', '雷射焊接']] },
            { key: 'metal_finish', name_zh: '表面處理', leaves: [['anodize', '陽極處理'], ['plating', '電鍍'], ['sandblast', '噴砂'], ['hairline', '髮絲紋'], ['polish', '拋光'], ['powder_coat', '粉體烤漆']] }
        ]
    },
    {
        key: 'cap.plastics', name_zh: '塑膠工藝', sort: 60, children: [
            { key: 'molding', name_zh: '成型工藝', leaves: [['injection', '單色／雙色射出'], ['overmold', '包膠射出'], ['blow_mold', '吹塑（中空吹塑）'], ['vacuum_form', '真空成型（吸塑／真空罩成型）']] },
            { key: 'plastic_post', name_zh: '後加工', leaves: [['ultrasonic', '超音波熔接'], ['heat_weld', '熱熔接'], ['bonding', '膠合']] }
        ]
    },
    {
        key: 'cap.silicone_rubber', name_zh: '矽膠與橡膠', sort: 70, children: [
            { key: 'silicone', name_zh: '矽膠加工', leaves: [['lsr', '液態矽膠'], ['compression', '模壓矽膠'], ['food_grade', '食品級矽膠']] },
            { key: 'rubber', name_zh: '橡膠加工', leaves: [['rubber_mold', '模壓成型'], ['extrusion', '擠出成型']] }
        ]
    },
    {
        key: 'cap.jewelry', name_zh: '珠寶工藝', sort: 80, children: [
            { key: 'casting', name_zh: '鑄造', leaves: [['lost_wax', '脫蠟鑄造'], ['centrifugal', '離心鑄造']] },
            { key: 'metalsmith', name_zh: '金工製作', leaves: [['hand_metal', '手工金工'], ['silver', '銀飾製作'], ['gold_k', 'K 金製作']] },
            { key: 'gem', name_zh: '寶石加工', leaves: [['setting', '鑲嵌'], ['gem_polish', '拋光'], ['gem_cut', '切割']] }
        ]
    },
    {
        key: 'cap.modeling', name_zh: '模型工藝', sort: 90, children: [
            { key: 'model_make', name_zh: '模型製作', leaves: [['resin_pvc_abs', '樹脂／PVC／ABS 模型製作']] },
            { key: 'mold_cast', name_zh: '翻模與灌注', leaves: [['silicone_mold', '矽膠翻模'], ['pu_cast', 'PU 灌注']] },
            { key: 'proto', name_zh: '原型開發', leaves: [['mockup', '手板製作'], ['sampling', '打樣']] }
        ]
    },
    {
        key: 'cap.3d', name_zh: '3D 製造', sort: 100, children: [
            { key: 'print_3d', name_zh: '3D 列印', leaves: [['fdm', 'FDM'], ['sla', 'SLA'], ['sls', 'SLS'], ['mjf', 'MJF']] },
            { key: 'reverse_3d', name_zh: '3D 逆向', leaves: [['scan_3d', '3D 掃描'], ['point_cloud', '點雲掃描'], ['reverse_eng', '逆向工程']] }
        ]
    },
    {
        key: 'cap.laser', name_zh: '雷射加工', sort: 110, children: [
            { key: 'laser_cut', name_zh: '雷射切割', leaves: [['wood', '木材切割'], ['acrylic', '壓克力切割'], ['metal', '金屬切割'], ['fabric', '布料切割']] },
            { key: 'laser_engrave', name_zh: '雷射雕刻', leaves: [['wood', '木材雕刻'], ['metal', '金屬雕刻'], ['leather', '皮革雕刻'], ['glass', '玻璃雕刻']] }
        ]
    },
    {
        key: 'cap.glass_ceramic', name_zh: '玻璃陶瓷', sort: 120, children: [
            { key: 'glass', name_zh: '玻璃工藝', leaves: [['heat_bend', '熱彎玻璃'], ['sandblast_glass', '噴砂玻璃'], ['painted_glass', '彩繪玻璃']] },
            { key: 'ceramic', name_zh: '陶瓷工藝', leaves: [['slip_cast', '灌漿'], ['wheel_throw', '手拉坯'], ['high_fire', '高溫燒製'], ['glaze_fire', '釉燒']] }
        ]
    },
    {
        key: 'cap.packaging', name_zh: '包裝工藝', sort: 130, children: [
            { key: 'paper_pack', name_zh: '紙製包裝', leaves: [['color_box', '彩盒'], ['corrugated', '瓦楞紙箱'], ['rigid_box', '精裝盒']] },
            { key: 'special_pack', name_zh: '特殊包裝', leaves: [['magnetic_box', '磁吸盒'], ['drawer_box', '抽屜盒'], ['display_box', '展示盒']] }
        ]
    },
    {
        key: 'cap.horology', name_zh: '鐘錶微型工藝', sort: 140, children: [
            { key: 'watch', name_zh: '鐘錶加工', leaves: [['case', '錶殼加工'], ['strap', '錶帶製造'], ['dial', '面盤加工']] },
            { key: 'micro', name_zh: '微型加工', leaves: [['micro_cnc', '微米 CNC'], ['precision_turn', '精密車削'], ['micro_asm', '微型組裝']] }
        ]
    },
    {
        key: 'cap.automotive_outdoor', name_zh: '交通改裝工藝', sort: 150, children: [
            { key: 'vehicle', name_zh: '車體改裝', leaves: [['paint', '烤漆'], ['wrap', '包膜'], ['carbon_fiber', '碳纖維加工']] },
            { key: 'outdoor', name_zh: '戶外裝備', leaves: [['tactical_sew', '戰術縫製'], ['seam_tape', '防水貼條'], ['hf_weld', '高週波熔接']] }
        ]
    }
];

function esc(s) {
    return String(s).replace(/'/g, "''");
}

function arrSql(arr) {
    if (!arr || !arr.length) return 'NULL';
    return `ARRAY[${arr.map((a) => `'${esc(a)}'`).join(', ')}]::text[]`;
}

function buildRows() {
    const rows = [];
    let sort = 0;
    const push = (r) => { sort += 1; rows.push({ ...r, sort_order: r.sort_order != null ? r.sort_order : sort }); };

    for (const p of PRODUCTION_TYPES) {
        push({
            key: p.key,
            dimension: 'production_type',
            parent_key: null,
            depth: 0,
            name_zh: p.name_zh,
            moq_hint_json: JSON.stringify(p.moq),
            sort_order: p.sort
        });
    }

    for (const m of MATERIALS) {
        push({
            key: m.key,
            dimension: 'material',
            parent_key: m.parent || null,
            depth: m.depth,
            name_zh: m.name_zh,
            aliases: m.aliases || null,
            sort_order: m.sort
        });
    }

    for (const major of CAPABILITY_TREE) {
        push({
            key: major.key,
            dimension: 'capability',
            parent_key: null,
            depth: 0,
            name_zh: major.name_zh,
            sort_order: major.sort
        });
        for (const mid of major.children) {
            const midKey = `${major.key}.${mid.key}`;
            push({
                key: midKey,
                dimension: 'capability',
                parent_key: major.key,
                depth: 1,
                name_zh: mid.name_zh,
                sort_order: major.sort
            });
            let leafSort = 0;
            for (const leaf of mid.leaves) {
                const slug = leaf[0];
                const label = leaf[1];
                const leafAliases = leaf.length > 2 ? leaf[2] : null;
                leafSort += 1;
                push({
                    key: `${midKey}.${slug}`,
                    dimension: 'capability',
                    parent_key: midKey,
                    depth: 2,
                    name_zh: label,
                    aliases: leafAliases,
                    sort_order: major.sort * 100 + leafSort
                });
            }
        }
    }
    return rows;
}

function rowSql(r) {
    const moq = r.moq_hint_json ? `'${esc(r.moq_hint_json)}'::jsonb` : 'NULL';
    const parent = r.parent_key ? `'${esc(r.parent_key)}'` : 'NULL';
    const aliases = r.aliases ? arrSql(r.aliases) : `'{}'::text[]`;
    return `('${esc(r.key)}', '${r.dimension}', ${parent}, ${r.depth}, '${esc(r.name_zh)}', ${aliases}, ${moq}, ${r.sort_order})`;
}

function main() {
    const rows = buildRows();
    const capLeaves = rows.filter((r) => r.dimension === 'capability' && r.depth === 2).length;
    const header = `-- 廠商分類三維度：生產模式、材料、工藝能力樹（MT-1）
-- 規格：docs/manufacturer-taxonomy-and-capability-tree-plan.md
-- 執行：Supabase SQL Editor 或 /admin/db-migrations.html
-- 種子統計：production_type=${PRODUCTION_TYPES.length} material=${MATERIALS.length} capability_leaves=${capLeaves}

`;

    const ddl = `
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

COMMENT ON TABLE public.taxonomy_nodes IS '平台標準詞彙：生產模式、材料、工藝能力樹';

ALTER TABLE public.taxonomy_nodes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "taxonomy_nodes_select" ON public.taxonomy_nodes;
CREATE POLICY "taxonomy_nodes_select" ON public.taxonomy_nodes FOR SELECT USING (is_active = true);

CREATE TABLE IF NOT EXISTS public.vendor_asset_taxonomy_links (
    asset_id uuid NOT NULL REFERENCES public.vendor_assets(id) ON DELETE CASCADE,
    taxonomy_key text NOT NULL REFERENCES public.taxonomy_nodes(key) ON DELETE CASCADE,
    PRIMARY KEY (asset_id, taxonomy_key)
);

CREATE INDEX IF NOT EXISTS idx_vendor_asset_taxonomy_key ON public.vendor_asset_taxonomy_links(taxonomy_key);

COMMENT ON TABLE public.vendor_asset_taxonomy_links IS '素材可執行工藝（capability 葉節點）';

ALTER TABLE public.vendor_assets
    ADD COLUMN IF NOT EXISTS production_type_key text;

CREATE INDEX IF NOT EXISTS idx_vendor_assets_production_type ON public.vendor_assets(production_type_key);

COMMENT ON COLUMN public.vendor_assets.production_type_key IS '生產模式：prod.bespoke 等（單選）';

ALTER TABLE public.vendor_asset_taxonomy_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vendor_asset_taxonomy_links_select" ON public.vendor_asset_taxonomy_links;
CREATE POLICY "vendor_asset_taxonomy_links_select" ON public.vendor_asset_taxonomy_links FOR SELECT USING (true);
`;

    const ddlAfterSeed = `
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
`;

    const values = rows.map(rowSql).join(',\n');
    const seed = `
INSERT INTO public.taxonomy_nodes (key, dimension, parent_key, depth, name_zh, aliases, moq_hint_json, sort_order)
VALUES
${values}
ON CONFLICT (key) DO UPDATE SET
    dimension = EXCLUDED.dimension,
    parent_key = EXCLUDED.parent_key,
    depth = EXCLUDED.depth,
    name_zh = EXCLUDED.name_zh,
    aliases = EXCLUDED.aliases,
    moq_hint_json = EXCLUDED.moq_hint_json,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();
`;

    fs.writeFileSync(OUT, header + ddl.trim() + '\n\n' + seed.trim() + '\n\n' + ddlAfterSeed.trim() + '\n', 'utf8');
    console.log('Wrote', OUT);
    console.log('Rows:', rows.length, '| capability leaves:', capLeaves);
}

main();
