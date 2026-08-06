'use strict';

const fs = require('fs');
const path = require('path');

const DOCS_DIR = path.join(__dirname, '..', 'docs');

/** 白名單：僅允許執行此清單內的 migration（不可貼任意 SQL） */
const MIGRATIONS = [
    {
        id: 'digital-prototype-ai-tags',
        title: '廠商素材／作品集 AI 標籤欄位',
        description: 'vendor_assets、manufacturer_portfolio 新增 ai_tags、image_semantics_json 等（§6 T0-1）',
        files: ['add-digital-prototype-ai-tags.sql'],
        check: async (client) => columnExists(client, 'vendor_assets', 'ai_tags')
    },
    {
        id: 'custom-products-semantics',
        title: '訂製品語意欄位',
        description: 'custom_products 新增 prompt_semantics_json、image_semantics_json、ai_tags（§6 T0-2）',
        files: ['add-custom-products-semantics.sql'],
        check: async (client) => columnExists(client, 'custom_products', 'ai_tags')
    },
    {
        id: 'custom-products-semantics-taxonomy',
        title: '設計圖 AI 分維標籤',
        description: 'custom_products.ai_tags_by_dimension（風格、材質、顏色、結構、特色等）',
        files: ['add-custom-products-semantics-taxonomy.sql'],
        check: async (client) => columnExists(client, 'custom_products', 'ai_tags_by_dimension')
    },
    {
        id: 'custom-products-data-lineage',
        title: '訂製生圖資料血緣',
        description: 'is_vendor_self_serve 等（僅後端分析，不暴露前端）',
        files: ['add-custom-products-data-lineage.sql'],
        check: async (client) => columnExists(client, 'custom_products', 'is_vendor_self_serve')
    },
    {
        id: 'custom-products-designer-region',
        title: '設計者國家（IP 快照）',
        description: 'designer_country_code 等；僅 IP 推斷，不強制填寫',
        files: ['add-custom-products-designer-region.sql'],
        check: async (client) => columnExists(client, 'custom_products', 'designer_country_code')
    },
    {
        id: 'visual-semantics-events',
        title: '視覺語意事件表',
        description: '建立 visual_semantics_events 供搜尋與趨勢累積（§6 T0-3）',
        files: ['add-visual-semantics-events.sql'],
        check: async (client) => tableExists(client, 'visual_semantics_events')
    },
    {
        id: 'industry-supplier-catalog',
        title: '產業供應商目錄（B 線）',
        description: 'industry_suppliers、supplier_catalog_items、manufacturer_supplier_imports',
        files: ['add-industry-supplier-catalog.sql'],
        check: async (client) => tableExists(client, 'supplier_catalog_items')
    },
    {
        id: 'manufacturer-logo',
        title: '廠商 logo_url 欄位',
        description: 'manufacturers.logo_url（廠商頁頭像；後台 PATCH 需要）',
        files: ['add-manufacturer-logo.sql'],
        check: async (client) => columnExists(client, 'manufacturers', 'logo_url')
    },
    {
        id: 'vendor-catalog-groups-asset-kind',
        title: '廠商自訂分類 asset_kind',
        description: 'vendor_catalog_groups.asset_kind（材料／零件獨立分類）',
        files: ['add-vendor-catalog-groups-asset-kind.sql'],
        check: async (client) => columnExists(client, 'vendor_catalog_groups', 'asset_kind')
    },
    {
        id: 'vendor-catalog-groups-slug-per-kind',
        title: '廠商自訂分類 slug 依類型唯一',
        description: '材料／零件與原型可同名；避免跨類型 slug 撞唯一索引導致新增 500',
        files: ['add-vendor-catalog-groups-slug-per-kind.sql'],
        check: async (client) => {
            const r = await client.query(
                `SELECT EXISTS (
                    SELECT 1 FROM pg_indexes
                    WHERE schemaname = 'public' AND indexname = 'idx_vendor_catalog_groups_mfr_kind_slug'
                ) AS ok`
            );
            return !!r.rows[0]?.ok;
        }
    },
    {
        id: 'vendor-asset-kind',
        title: '數位版型 asset_kind（原型／材料）',
        description: 'vendor_assets 新增 asset_kind：prototype | material',
        files: ['add-vendor-asset-kind.sql'],
        check: async (client) => columnExists(client, 'vendor_assets', 'asset_kind')
    },
    {
        id: 'manufacturer-taxonomy',
        title: '廠商分類三維度（MT-1）',
        description: 'taxonomy_nodes、vendor_asset／portfolio 工藝連結、production_type_key',
        files: ['add-manufacturer-taxonomy.sql'],
        check: async (client) => tableExists(client, 'taxonomy_nodes')
    },
    {
        id: 'visual-semantics-all',
        title: '視覺語意庫（一次執行三項）',
        description: '依序執行上述三個 migration；新環境建議用此項',
        files: [
            'add-digital-prototype-ai-tags.sql',
            'add-custom-products-semantics.sql',
            'add-visual-semantics-events.sql'
        ],
        check: async (client) => {
            const a = await columnExists(client, 'vendor_assets', 'ai_tags');
            const b = await columnExists(client, 'custom_products', 'ai_tags');
            const c = await tableExists(client, 'visual_semantics_events');
            return a && b && c;
        }
    },
    {
        id: 'promo-theme-scene-slots',
        title: '情境圖主題／場景 slot 欄位',
        description: 'promo_scene_templates.slot（theme|scene）＋預設場景種子；後台「場景」分頁才可編輯',
        files: ['add-promo-theme-scene-slots.sql', 'fix-promo-scene-slot-mismatch.sql'],
        check: async (client) => columnExists(client, 'promo_scene_templates', 'slot')
    },
    {
        id: 'promo-scene-multilang',
        title: '情境圖主題／場景多語系',
        description: 'promo_scene_templates.name_en 等',
        files: ['add-promo-scene-templates-multilang.sql'],
        check: async (client) => columnExists(client, 'promo_scene_templates', 'name_en')
    },
    {
        id: 'promo-show-on-homepage',
        title: '情境圖媒體牆公開欄位',
        description: 'product_promo_generations.show_on_homepage',
        files: ['add-promo-show-on-homepage.sql'],
        check: async (client) => columnExists(client, 'product_promo_generations', 'show_on_homepage')
    },
    {
        id: 'promo-vendor-asset-homepage-backfill',
        title: '情境圖 vendor_asset 補媒體牆（新圖上首頁）',
        description: '執行 backfill-promo-media-wall.sql：vendor_asset 且 show_on_homepage≠true 的成功情境圖改為公開',
        files: ['backfill-promo-media-wall.sql'],
        check: async (client) => {
            const r = await client.query(
                `SELECT NOT EXISTS (
                    SELECT 1 FROM public.product_promo_generations
                    WHERE status = 'success'
                      AND result_image_url IS NOT NULL
                      AND source_type = 'vendor_asset'
                      AND source_id IS NOT NULL
                      AND show_on_homepage IS DISTINCT FROM true
                    LIMIT 1
                ) AS ok`
            );
            return !!(r.rows && r.rows[0] && r.rows[0].ok === true);
        }
    },
    {
        id: 'custom-products-title-i18n',
        title: '訂製品標題英文欄位',
        description: 'custom_products.title_en（Gemini 雙語標題）',
        files: ['add-custom-products-title-i18n.sql'],
        check: async (client) => columnExists(client, 'custom_products', 'title_en')
    },
    {
        id: 'promo-generations-semantics',
        title: '情境圖 Gemini 語意欄位',
        description: 'product_promo_generations.ai_tags / description / image_semantics_json',
        files: ['add-promo-generations-semantics.sql'],
        check: async (client) => columnExists(client, 'product_promo_generations', 'ai_tags')
    },
    {
        id: 'material-color-palettes',
        title: '材料組合配色範例',
        description: 'material_color_palette_types + material_color_palettes（官方／我的雙色表）',
        files: ['add-material-color-palettes.sql'],
        check: async (client) => tableExists(client, 'material_color_palettes')
    },
    {
        id: 'material-color-palette-ratios',
        title: '材料組合配色比重欄位',
        description: 'material_color_palettes.ratio_preset / ratio_percents（雙色／三色）',
        files: ['add-material-color-palette-ratios.sql'],
        check: async (client) => columnExists(client, 'material_color_palettes', 'ratio_percents')
    },
    {
        id: 'material-color-palette-notes',
        title: '材料組合配色備註',
        description: 'material_color_palettes.note（備註描述選填）',
        files: ['add-material-color-palette-notes.sql'],
        check: async (client) => columnExists(client, 'material_color_palettes', 'note')
    },
    {
        id: 'material-color-palette-i18n',
        title: '材料組合配色多語系',
        description: '類型／配色 name_en 等＋note_en 等（後台維護，前台 ?lang= 顯示）',
        files: ['add-material-color-palette-i18n.sql'],
        check: async (client) => columnExists(client, 'material_color_palettes', 'name_en')
    },
    {
        id: 'photography-prompt-multilang',
        title: '攝影參數組多語系',
        description: 'photography_prompt_sets.name_en 等',
        files: ['add-photography-prompt-sets-multilang.sql'],
        check: async (client) => columnExists(client, 'photography_prompt_sets', 'name_en')
    },
    {
        id: 'design-direction-categories-seed',
        title: '設計風向分類種子（覆寫錯誤再製分類）',
        description: '停用舊再製分類，寫入 12 品類域＋子分類（與 seed-design-direction-categories.sql 相同）',
        files: ['seed-design-direction-categories.sql'],
        check: async (client) => {
            const r = await client.query(
                `SELECT COUNT(*)::int AS n FROM public.remake_categories WHERE key = 'formal_wear' AND is_active = true`
            );
            return (r.rows[0] && r.rows[0].n > 0);
        }
    },
    {
        id: 'material-color-palette-examples-seed',
        title: '材料組合配色範例種子（雙色／三色，含英文）',
        description: '13 個風格類型＋77 組雙色＋84 組三色官方配色範例（依尼龍布寵物用品色卡整理，含英文；不含單色）',
        files: ['seed-material-color-palette-examples.sql'],
        check: async (client) => {
            const r = await client.query(
                `SELECT COUNT(*)::int AS n FROM public.material_color_palettes
                 WHERE owner_scope = 'platform' AND color_count = 3`
            );
            return (r.rows[0] && r.rows[0].n >= 80);
        }
    },
    {
        id: 'user-material-presets',
        title: '材料組合常用文字（材質／分界處）',
        description: 'user_material_presets：帳號自存材質名與分界處文字，材料組合頁點選填入',
        files: ['add-user-material-presets.sql'],
        check: async (client) => columnExists(client, 'user_material_presets', 'kind')
    },
    {
        id: 'rename-custom-products-title-design-draft',
        title: '舊標題「產品設計圖」→「產品設計稿」',
        description: '一次性 UPDATE custom_products.title／title_en；不改表結構',
        files: ['rename-custom-products-title-design-draft.sql'],
        check: async (client) => {
            const r = await client.query(
                `SELECT COUNT(*)::int AS n FROM public.custom_products WHERE title = '產品設計圖'`
            );
            return !((r.rows[0] && r.rows[0].n) > 0);
        }
    }
];

async function columnExists(client, tableName, columnName) {
    const r = await client.query(
        `SELECT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
        ) AS ok`,
        [tableName, columnName]
    );
    return !!r.rows[0]?.ok;
}

async function tableExists(client, tableName) {
    const r = await client.query(
        `SELECT to_regclass($1) IS NOT NULL AS ok`,
        [`public.${tableName}`]
    );
    return !!r.rows[0]?.ok;
}

function stripSqlComments(sql) {
    return String(sql)
        .replace(/\r\n/g, '\n')
        .split('\n')
        .filter((line) => !/^\s*--/.test(line))
        .join('\n');
}

function splitSqlStatements(sql) {
    const cleaned = stripSqlComments(sql);
    return cleaned
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
}

function readMigrationSql(filename) {
    const full = path.join(DOCS_DIR, filename);
    if (!fs.existsSync(full)) throw new Error('找不到 migration 檔案：' + filename);
    const raw = fs.readFileSync(full, 'utf8');
    return splitSqlStatements(raw);
}

async function runMigrationById(id, client) {
    const def = MIGRATIONS.find((m) => m.id === id);
    if (!def) throw new Error('未知的 migration：' + id);
    const executed = [];
    for (const file of def.files) {
        const statements = readMigrationSql(file);
        for (const stmt of statements) {
            await client.query(stmt);
        }
        executed.push(file);
    }
    const applied = def.check ? await def.check(client) : true;
    return { id: def.id, title: def.title, files: executed, verified: applied };
}

async function getMigrationStatuses(client) {
    const list = [];
    for (const def of MIGRATIONS) {
        let applied = false;
        try {
            applied = def.check ? await def.check(client) : false;
        } catch (e) {
            applied = false;
        }
        list.push({
            id: def.id,
            title: def.title,
            description: def.description,
            files: def.files,
            applied,
            bundle: def.files.length > 1
        });
    }
    return list;
}

module.exports = {
    MIGRATIONS,
    getMigrationStatuses,
    runMigrationById
};
