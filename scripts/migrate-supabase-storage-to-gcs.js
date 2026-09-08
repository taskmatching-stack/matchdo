/**
 * Phase 2：Supabase Storage → GCS matchdo-media（保留 path，可重複執行）
 *
 * 用法：
 *   node scripts/migrate-supabase-storage-to-gcs.js [--dry-run] [--limit=N] [--bucket=custom-products|project-images|all] [--force]
 *
 * 需 .env：SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * GCS：Cloud Run / gcloud ADC（本機可 gcloud auth application-default login）
 *
 * 產出：tmp/gcs-migration-manifest.jsonl（每行一筆對照）
 */
'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { Storage } = require('@google-cloud/storage');
const { walkSupabaseStorageFiles } = require('../lib/supabase-storage-walk');
const { GCS_MEDIA_BUCKET, GCS_PUBLIC_BASE_URL, publicUrlForObjectKey } = require('../lib/object-storage');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const ALL_BUCKETS = ['custom-products', 'project-images'];
const CONCURRENCY = Math.min(Math.max(parseInt(process.env.GCS_MIGRATE_CONCURRENCY, 10) || 4, 1), 8);
const MANIFEST_PATH = path.join(__dirname, '..', 'tmp', 'gcs-migration-manifest.jsonl');

function parseArgs() {
    const opts = { dryRun: false, limit: 0, bucket: 'all', force: false };
    for (const arg of process.argv.slice(2)) {
        if (arg === '--dry-run') opts.dryRun = true;
        else if (arg === '--force') opts.force = true;
        else if (arg.startsWith('--limit=')) opts.limit = parseInt(arg.slice(8), 10) || 0;
        else if (arg.startsWith('--bucket=')) opts.bucket = arg.slice(9);
    }
    return opts;
}

function objectKeyForSupabaseFile(supabaseBucket, pathInBucket) {
    return `${supabaseBucket}/${pathInBucket}`.replace(/\/+/g, '/').replace(/^\/+/, '');
}

function supabasePublicUrl(supabaseBucket, pathInBucket) {
    const base = String(SUPABASE_URL || '').replace(/\/$/, '');
    return `${base}/storage/v1/object/public/${supabaseBucket}/${pathInBucket}`;
}

async function downloadBuffer(supabase, bucket, objectPath) {
    const { data, error } = await supabase.storage.from(bucket).download(objectPath);
    if (error) throw error;
    if (!data) throw new Error('empty download');
    if (Buffer.isBuffer(data)) return data;
    if (typeof data.arrayBuffer === 'function') {
        return Buffer.from(await data.arrayBuffer());
    }
    return Buffer.from(data);
}

async function runPool(items, worker) {
    let index = 0;
    async function next() {
        while (index < items.length) {
            const i = index++;
            await worker(items[i], i);
        }
    }
    const workers = [];
    for (let w = 0; w < CONCURRENCY; w++) workers.push(next());
    await Promise.all(workers);
}

async function main() {
    const opts = parseArgs();
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error('缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY');
        process.exit(1);
    }

    const buckets = opts.bucket === 'all' ? ALL_BUCKETS : [opts.bucket];
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const gcs = new Storage();
    const gcsBucket = gcs.bucket(GCS_MEDIA_BUCKET);

    const files = [];
    for (const bucket of buckets) {
        await walkSupabaseStorageFiles(supabase, bucket, (f) => {
            files.push(f);
        });
    }
    files.sort((a, b) => `${a.bucket}/${a.path}`.localeCompare(`${b.bucket}/${b.path}`));

    const toProcess = opts.limit > 0 ? files.slice(0, opts.limit) : files;
    console.log(`Phase 2 migrate: ${toProcess.length} / ${files.length} objects → gs://${GCS_MEDIA_BUCKET}`);
    console.log(`  dryRun=${opts.dryRun} force=${opts.force} concurrency=${CONCURRENCY}`);
    console.log(`  public base: ${GCS_PUBLIC_BASE_URL}\n`);

    if (!opts.dryRun) {
        fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
    }

    let copied = 0;
    let skipped = 0;
    let failed = 0;

    await runPool(toProcess, async (file) => {
        const objectKey = objectKeyForSupabaseFile(file.bucket, file.path);
        const gcsUrl = publicUrlForObjectKey(objectKey);
        const supabaseUrl = supabasePublicUrl(file.bucket, file.path);
        const line = JSON.stringify({
            supabase_bucket: file.bucket,
            path: file.path,
            object_key: objectKey,
            supabase_url: supabaseUrl,
            gcs_url: gcsUrl,
            bytes: file.size
        });

        if (opts.dryRun) {
            console.log(`[dry-run] ${objectKey} (${file.size} B)`);
            skipped += 1;
            return;
        }

        try {
            const gcsFile = gcsBucket.file(objectKey);
            if (!opts.force) {
                const [exists] = await gcsFile.exists();
                if (exists) {
                    skipped += 1;
                    fs.appendFileSync(MANIFEST_PATH, line + '\n');
                    return;
                }
            }

            const buffer = await downloadBuffer(supabase, file.bucket, file.path);
            const contentType = file.mimetype || 'application/octet-stream';
            await gcsFile.save(buffer, {
                resumable: buffer.length > 8 * 1024 * 1024,
                metadata: {
                    contentType,
                    cacheControl: 'public, max-age=3600'
                }
            });
            copied += 1;
            fs.appendFileSync(MANIFEST_PATH, line + '\n');
            if (copied % 50 === 0) {
                console.log(`  … copied ${copied}, skipped ${skipped}, failed ${failed}`);
            }
        } catch (err) {
            failed += 1;
            console.error(`FAIL ${objectKey}:`, err.message || err);
        }
    });

    console.log('\n--- done ---');
    console.log(`copied:  ${copied}`);
    console.log(`skipped: ${skipped}`);
    console.log(`failed:  ${failed}`);
    if (!opts.dryRun) console.log(`manifest: ${MANIFEST_PATH}`);
    if (failed > 0) process.exit(1);
}

main().catch((e) => {
    console.error(e.message || e);
    process.exit(1);
});
