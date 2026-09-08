/**
 * Phase 3：DB 內 Supabase Storage URL → media.matchdo.cc（可 --dry-run）
 *
 * 用法：node scripts/rewrite-db-storage-urls-to-gcs.js [--dry-run]
 * 需 .env：SUPABASE_DB_URL
 *
 * 前置：Phase 2 物件已複製到 GCS（同 path）。
 */
'use strict';

require('dotenv').config();
const { Pool } = require('pg');
const { GCS_PUBLIC_BASE_URL } = require('../lib/object-storage');

const DRY_RUN = process.argv.includes('--dry-run');
const SUPABASE_STORAGE_RE = /https:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/public\//g;

const TEXT_COLUMNS = [
    ['custom_products', 'reference_image_url'],
    ['custom_products', 'ai_generated_image_url'],
    ['manufacturer_portfolio', 'image_url'],
    ['manufacturer_portfolio', 'image_url_before'],
    ['manufacturers', 'logo_url'],
    ['vendor_assets', 'image_url'],
    ['supplier_catalog_items', 'cover_image_url'],
    ['media_collections', 'cover_image_url'],
    ['product_promo_generations', 'source_image_url'],
    ['product_promo_generations', 'result_image_url'],
    ['user_print_generations', 'image_url'],
    ['user_material_combo_generations', 'image_url'],
    ['direct_messages', 'image_url'],
    ['projects', 'cover_image_url'],
    ['ai_subcategories', 'image_url'],
    ['visual_semantics_events', 'image_url']
];

const JSONB_COLUMNS = [
    ['vendor_assets', 'gallery_images', 'id'],
    ['supplier_catalog_items', 'gallery_images', 'id'],
    ['manufacturer_portfolio', 'series_image_urls', 'id'],
    ['custom_products', 'reference_sources', 'id'],
    ['projects', 'description', 'id'],
    ['help_guide_pages', 'blocks_json', 'id'],
    ['media_wall_favorites', 'item_data', 'id']
];

const TEXT_ARRAY_COLUMNS = [
    ['listings', 'images', 'id']
];

function replaceUrlString(s) {
    if (typeof s !== 'string' || s.indexOf('supabase.co/storage') < 0) return s;
    return s.replace(SUPABASE_STORAGE_RE, `${GCS_PUBLIC_BASE_URL}/`);
}

function replaceUrlsDeep(value) {
    if (typeof value === 'string') return replaceUrlString(value);
    if (Array.isArray(value)) return value.map(replaceUrlsDeep);
    if (value && typeof value === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(value)) out[k] = replaceUrlsDeep(v);
        return out;
    }
    return value;
}

async function columnExists(client, table, column) {
    const res = await client.query(
        `SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
        [table, column]
    );
    return res.rowCount > 0;
}

async function rewriteTextColumns(client) {
    let total = 0;
    for (const [table, column] of TEXT_COLUMNS) {
        if (!(await columnExists(client, table, column))) continue;
        const countRes = await client.query(
            `SELECT count(*)::int AS n FROM public.${table}
             WHERE ${column} IS NOT NULL AND ${column}::text LIKE '%supabase.co/storage%'`
        );
        const n = countRes.rows[0].n;
        if (!n) continue;
        console.log(`${table}.${column}: ${n} rows`);
        if (!DRY_RUN) {
            const upd = await client.query(
                `UPDATE public.${table}
                 SET ${column} = regexp_replace(${column}::text,
                   '^https://[^/]+\\.supabase\\.co/storage/v1/object/public/',
                   $1, 'g')
                 WHERE ${column} IS NOT NULL AND ${column}::text LIKE '%supabase.co/storage%'`,
                [`${GCS_PUBLIC_BASE_URL}/`]
            );
            total += upd.rowCount;
        } else {
            total += n;
        }
    }
    return total;
}

async function rewriteJsonbColumns(client) {
    let total = 0;
    for (const [table, column, idCol] of JSONB_COLUMNS) {
        if (!(await columnExists(client, table, column))) continue;
        const { rows } = await client.query(
            `SELECT ${idCol} AS id, ${column} AS data FROM public.${table}
             WHERE ${column} IS NOT NULL AND ${column}::text LIKE '%supabase.co/storage%'`
        );
        if (!rows.length) continue;
        console.log(`${table}.${column}: ${rows.length} rows (jsonb)`);
        for (const row of rows) {
            const next = replaceUrlsDeep(row.data);
            if (JSON.stringify(next) === JSON.stringify(row.data)) continue;
            if (!DRY_RUN) {
                await client.query(
                    `UPDATE public.${table} SET ${column} = $1::jsonb WHERE ${idCol} = $2`,
                    [JSON.stringify(next), row.id]
                );
            }
            total += 1;
        }
    }
    return total;
}

async function rewriteTextArrayColumns(client) {
    let total = 0;
    for (const [table, column, idCol] of TEXT_ARRAY_COLUMNS) {
        if (!(await columnExists(client, table, column))) continue;
        const { rows } = await client.query(
            `SELECT ${idCol} AS id, ${column} AS data FROM public.${table}
             WHERE ${column} IS NOT NULL AND array_to_string(${column}, ' ') LIKE '%supabase.co/storage%'`
        );
        if (!rows.length) continue;
        console.log(`${table}.${column}: ${rows.length} rows (text[])`);
        for (const row of rows) {
            const arr = row.data;
            if (!Array.isArray(arr)) continue;
            const next = arr.map((s) => replaceUrlString(String(s)));
            if (next.every((v, i) => v === arr[i])) continue;
            if (!DRY_RUN) {
                await client.query(
                    `UPDATE public.${table} SET ${column} = $1::text[] WHERE ${idCol} = $2`,
                    [next, row.id]
                );
            }
            total += 1;
        }
    }
    return total;
}

async function main() {
    const url = process.env.SUPABASE_DB_URL;
    if (!url) {
        console.error('缺少 SUPABASE_DB_URL');
        process.exit(1);
    }

    console.log(`Phase 3 rewrite DB URLs → ${GCS_PUBLIC_BASE_URL}`);
    console.log(`  dryRun=${DRY_RUN}\n`);

    const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
    const client = await pool.connect();
    try {
        if (!DRY_RUN) await client.query('BEGIN');
        const textN = await rewriteTextColumns(client);
        const jsonN = await rewriteJsonbColumns(client);
        const arrN = await rewriteTextArrayColumns(client);
        if (!DRY_RUN) await client.query('COMMIT');
        console.log(`\n--- done ---`);
        console.log(`text columns updated: ${textN}`);
        console.log(`jsonb rows updated: ${jsonN}`);
        console.log(`text[] rows updated: ${arrN}`);
        if (DRY_RUN) console.log('(dry-run: no writes)');
    } catch (e) {
        if (!DRY_RUN) await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
        await pool.end();
    }
}

main().catch((e) => {
    console.error(e.message || e);
    process.exit(1);
});
