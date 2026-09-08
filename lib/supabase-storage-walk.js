/**
 * 遞迴列出 Supabase Storage bucket 內所有檔案物件。
 */
'use strict';

const PAGE_SIZE = 1000;

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} bucket
 * @param {(file: { bucket: string, path: string, size: number, mimetype: string }) => (void|Promise<void>)} onFile
 */
async function walkSupabaseStorageFiles(supabase, bucket, onFile) {
    async function walk(prefix) {
        let offset = 0;
        for (;;) {
            const { data, error } = await supabase.storage.from(bucket).list(prefix, {
                limit: PAGE_SIZE,
                offset,
                sortBy: { column: 'name', order: 'asc' }
            });
            if (error) throw new Error(`${bucket}/${prefix || ''}: ${error.message}`);
            const items = data || [];
            if (!items.length) break;

            for (const item of items) {
                const rel = prefix ? `${prefix}/${item.name}` : item.name;
                if (item.id) {
                    await onFile({
                        bucket,
                        path: rel,
                        size: Number(item.metadata && item.metadata.size) || 0,
                        mimetype: String((item.metadata && item.metadata.mimetype) || '')
                    });
                } else {
                    await walk(rel);
                }
            }

            if (items.length < PAGE_SIZE) break;
            offset += PAGE_SIZE;
        }
    }

    await walk('');
}

module.exports = { walkSupabaseStorageFiles, PAGE_SIZE };
