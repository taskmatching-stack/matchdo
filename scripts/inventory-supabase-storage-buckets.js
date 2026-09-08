/**
 * Phase 0：盤點 Supabase Storage 兩桶物件數與估算大小
 * 執行：node scripts/inventory-supabase-storage-buckets.js
 * 需 .env：SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
'use strict';

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const BUCKETS = ['custom-products', 'project-images'];
const PAGE_SIZE = 1000;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function listBucket(bucket) {
    let offset = 0;
    let count = 0;
    let bytes = 0;
    let prefixCounts = {};

    for (;;) {
        const { data, error } = await supabase.storage.from(bucket).list('', {
            limit: PAGE_SIZE,
            offset,
            sortBy: { column: 'name', order: 'asc' }
        });
        if (error) throw new Error(`${bucket} list: ${error.message}`);

        const items = data || [];
        if (!items.length) break;

        for (const item of items) {
            if (item.id) {
                count += 1;
                const size = Number(item.metadata && item.metadata.size) || 0;
                bytes += size;
                const top = String(item.name || '').split('/')[0] || '(root)';
                prefixCounts[top] = (prefixCounts[top] || 0) + 1;
            }
        }

        if (items.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
    }

    return { bucket, count, bytes, prefixCounts };
}

/** 遞迴列出（Supabase list 只列一層；大桶需 walk） */
async function listBucketRecursive(bucket, prefix = '') {
    let count = 0;
    let bytes = 0;
    const prefixCounts = {};

    async function walk(path) {
        let offset = 0;
        for (;;) {
            const { data, error } = await supabase.storage.from(bucket).list(path, {
                limit: PAGE_SIZE,
                offset,
                sortBy: { column: 'name', order: 'asc' }
            });
            if (error) throw new Error(`${bucket}/${path}: ${error.message}`);
            const items = data || [];
            if (!items.length) break;

            for (const item of items) {
                const rel = path ? `${path}/${item.name}` : item.name;
                if (item.id) {
                    count += 1;
                    const size = Number(item.metadata && item.metadata.size) || 0;
                    bytes += size;
                    const top = rel.split('/')[0] || '(root)';
                    prefixCounts[top] = (prefixCounts[top] || 0) + 1;
                } else {
                    await walk(rel);
                }
            }

            if (items.length < PAGE_SIZE) break;
            offset += PAGE_SIZE;
        }
    }

    await walk(prefix);
    return { bucket, count, bytes, prefixCounts };
}

function formatBytes(n) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`;
    return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

async function main() {
    console.log('Supabase Storage inventory (Phase 0 baseline)\n');
    let totalCount = 0;
    let totalBytes = 0;

    for (const bucket of BUCKETS) {
        console.log(`Scanning ${bucket}…`);
        const result = await listBucketRecursive(bucket);
        totalCount += result.count;
        totalBytes += result.bytes;
        console.log(`  objects: ${result.count}`);
        console.log(`  size:    ${formatBytes(result.bytes)} (${result.bytes} bytes)`);
        const tops = Object.entries(result.prefixCounts).sort((a, b) => b[1] - a[1]);
        if (tops.length) {
            console.log('  top-level prefixes:');
            for (const [p, c] of tops.slice(0, 20)) {
                console.log(`    ${p}: ${c}`);
            }
            if (tops.length > 20) console.log(`    … +${tops.length - 20} more`);
        }
        console.log('');
    }

    console.log('--- total ---');
    console.log(`objects: ${totalCount}`);
    console.log(`size:    ${formatBytes(totalBytes)}`);
    console.log('\nCompare with Supabase Dashboard → Storage.');
}

main().catch((e) => {
    console.error(e.message || e);
    process.exit(1);
});
