/**
 * Phase 0：盤點 DB 內 Supabase Storage URL 筆數（baseline）
 * 執行：node scripts/inventory-supabase-storage-urls.js
 * 需 .env：SUPABASE_DB_URL（Session pooler URI，port 6543）
 * 亦可直接在 Supabase SQL Editor 執行 docs/storage-gcs-phase0-inventory.sql
 */
'use strict';

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const SQL_PATH = path.join(__dirname, '..', 'docs', 'storage-gcs-phase0-inventory.sql');

async function main() {
    const url = process.env.SUPABASE_DB_URL;
    if (!url) {
        console.error('缺少 SUPABASE_DB_URL');
        process.exit(1);
    }

    const sql = fs.readFileSync(SQL_PATH, 'utf8');
    const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
    const client = await pool.connect();

    try {
        console.log('DB Supabase Storage URL inventory (Phase 0)\n');
        const res = await client.query(sql);
        let sum = 0;
        for (const row of res.rows || []) {
            const n = parseInt(row.rows, 10) || 0;
            if (String(row.source).startsWith('--- TOTAL')) {
                console.log(`\n${row.source}: ${n}`);
                continue;
            }
            sum += n;
            if (n > 0) console.log(`  ${row.source}: ${n}`);
        }
        if (sum === 0 && !(res.rows || []).some((r) => parseInt(r.rows, 10) > 0)) {
            console.log('  (all zero)');
        }
        console.log('\nTip: Supabase SQL Editor shows full table including zero rows.');
    } finally {
        client.release();
        await pool.end();
    }
}

main().catch((e) => {
    console.error(e.message || e);
    process.exit(1);
});
