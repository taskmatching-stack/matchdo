/**
 * 官方版型庫：批次補 title_en / description_en、分類 name_en（不扣點）
 * 用法：node scripts/backfill-official-platform-i18n-en.js
 *       node scripts/backfill-official-platform-i18n-en.js --overwrite
 * 需 .env：SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 或 SUPABASE_KEY, GEMINI_API_KEY
 */
'use strict';

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const OFFICIAL_NAME = 'MATCHDO 官方版型';
const CHUNK = 15;
const ASSETS_INSTRUCTION =
    'Translate vendor digital product catalog copy (titles and descriptions) for a B2B marketplace. '
    + 'Source is Traditional Chinese (zh-TW). Output natural US English. '
    + 'Keep brand names, model numbers, URLs, and @handles unchanged. '
    + 'Input JSON shape: { "items": [ { "id": "uuid", "title": "...", "description": "..." } ] }. '
    + 'Return ONLY valid JSON: { "items": [ { "id": "same uuid", "title_en": "...", "description_en": "..." } ] } '
    + 'Same number of items, same ids, preserve order. Empty source fields → empty string in output. No markdown.';
const GROUPS_INSTRUCTION =
    'Translate vendor custom category names for a product catalog. '
    + 'Source is Traditional Chinese (zh-TW). Output concise US English category labels. '
    + 'Input JSON: { "items": [ { "id": "uuid", "name": "..." } ] }. '
    + 'Return ONLY valid JSON: { "items": [ { "id": "same uuid", "name_en": "..." } ] }. Same ids and order. No markdown.';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const overwrite = process.argv.includes('--overwrite');

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}
if (!process.env.GEMINI_API_KEY) {
    console.error('缺少 GEMINI_API_KEY');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function parseJsonObjectFromGeminiText(raw) {
    const s = String(raw || '').trim();
    if (!s) return null;
    const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const body = fence ? fence[1].trim() : s;
    try {
        return JSON.parse(body);
    } catch (_) {
        const start = body.indexOf('{');
        const end = body.lastIndexOf('}');
        if (start >= 0 && end > start) {
            try {
                return JSON.parse(body.slice(start, end + 1));
            } catch (_2) {
                return null;
            }
        }
        return null;
    }
}

async function geminiTranslate(instruction, payloadJson) {
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_TRANSLATION_MODEL || 'gemini-2.5-flash-lite';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: `${instruction}\n\n${payloadJson}` }] }] })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || 'Gemini error');
    const out = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!out) throw new Error('Gemini 無結果');
    return out;
}

async function translateBatches(instruction, items, mapHit) {
    let updated = 0;
    for (let i = 0; i < items.length; i += CHUNK) {
        const chunk = items.slice(i, i + CHUNK);
        const raw = await geminiTranslate(instruction, JSON.stringify({ items: chunk }));
        const parsed = parseJsonObjectFromGeminiText(raw);
        const list = parsed && Array.isArray(parsed.items) ? parsed.items : [];
        const byId = {};
        list.forEach((row) => { if (row && row.id) byId[String(row.id)] = row; });
        for (let j = 0; j < chunk.length; j++) {
            const src = chunk[j];
            const hit = byId[String(src.id)] || list[j] || {};
            const patch = mapHit(src, hit);
            if (!patch) continue;
            const { error } = await supabase.from(patch.table).update(patch.data).eq('id', src.id);
            if (!error) updated += 1;
            else console.warn('update failed', src.id, error.message);
        }
        process.stdout.write(`  batch ${Math.floor(i / CHUNK) + 1} / ${Math.ceil(items.length / CHUNK)}\n`);
    }
    return updated;
}

function assetNeedsEn(row) {
    const hasZh = !!(String(row.title || '').trim() || String(row.description || '').trim());
    if (!hasZh) return false;
    if (overwrite) return true;
    return !(String(row.title_en || '').trim() || String(row.description_en || '').trim());
}

function groupNeedsEn(row) {
    if (!String(row.name || '').trim()) return false;
    if (overwrite) return true;
    return !String(row.name_en || '').trim();
}

async function main() {
    const { data: mfrs, error: mfrErr } = await supabase
        .from('manufacturers')
        .select('id, name')
        .eq('name', OFFICIAL_NAME)
        .limit(1);
    if (mfrErr) throw mfrErr;
    const mfrId = mfrs && mfrs[0] && mfrs[0].id;
    if (!mfrId) {
        console.error('找不到官方廠商：', OFFICIAL_NAME);
        process.exit(1);
    }
    console.log('官方廠商 id:', mfrId, 'overwrite:', overwrite);

    const { data: assets, error: aErr } = await supabase
        .from('vendor_assets')
        .select('id, title, title_en, description, description_en')
        .eq('manufacturer_id', mfrId);
    if (aErr && aErr.code === '42703') {
        console.error('請先執行 docs/add-vendor-content-i18n-en.sql');
        process.exit(1);
    }
    if (aErr) throw aErr;
    const assetTodo = (assets || []).filter(assetNeedsEn).map((r) => ({
        id: r.id,
        title: String(r.title || '').trim(),
        description: String(r.description || '').trim()
    }));
    console.log('素材待翻譯:', assetTodo.length, '/', (assets || []).length);
    let assetUpdated = 0;
    if (assetTodo.length) {
        assetUpdated = await translateBatches(ASSETS_INSTRUCTION, assetTodo, function (src, hit) {
            return {
                table: 'vendor_assets',
                data: {
                    title_en: hit.title_en != null ? String(hit.title_en).trim() || null : null,
                    description_en: hit.description_en != null ? String(hit.description_en).trim() || null : null
                }
            };
        });
    }

    const { data: groups, error: gErr } = await supabase
        .from('vendor_catalog_groups')
        .select('id, name, name_en')
        .eq('manufacturer_id', mfrId);
    if (gErr && gErr.code !== '42703') throw gErr;
    let groupUpdated = 0;
    if (!gErr) {
        const groupTodo = (groups || []).filter(groupNeedsEn).map((r) => ({
            id: r.id,
            name: String(r.name || '').trim()
        }));
        console.log('分類待翻譯:', groupTodo.length);
        if (groupTodo.length) {
            groupUpdated = await translateBatches(GROUPS_INSTRUCTION, groupTodo, function (src, hit) {
                return {
                    table: 'vendor_catalog_groups',
                    data: { name_en: hit.name_en != null ? String(hit.name_en).trim() || null : null }
                };
            });
        }
    }

    console.log('完成。素材更新:', assetUpdated, '分類更新:', groupUpdated);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
