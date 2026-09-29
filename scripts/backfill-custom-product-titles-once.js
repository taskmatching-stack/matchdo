/**
 * 一次性：舊設計稿 title／title_en（先 SQL repair，再 Gemini 讀圖）
 * 用法：node scripts/backfill-custom-product-titles-once.js
 *       node scripts/backfill-custom-product-titles-once.js --repair-only
 *       node scripts/backfill-custom-product-titles-once.js --dry-run
 * 需 .env：SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY（或 SUPABASE_KEY）, GEMINI_API_KEY（讀圖階段）
 * 選填：PUBLIC_SITE_URL（相對圖 URL 用，預設 https://matchdo.cc）
 */
'use strict';

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenAI } = require('@google/genai');
const visualSemantics = require('../lib/visual-semantics');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const SITE_BASE = String(process.env.PUBLIC_SITE_URL || process.env.BASE_URL || 'https://matchdo.cc').replace(/\/$/, '');
const BATCH = Math.min(25, Math.max(1, parseInt(process.argv.find((a) => a.startsWith('--batch='))?.split('=')[1], 10) || 10));
const MAX_GEMINI_BATCHES = Math.max(1, parseInt(process.argv.find((a) => a.startsWith('--max-batches='))?.split('=')[1], 10) || 500);
const DRY_RUN = process.argv.includes('--dry-run');
const REPAIR_ONLY = process.argv.includes('--repair-only');
const GEMINI_ONLY = process.argv.includes('--gemini-only');

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}
if (!REPAIR_ONLY && !process.env.GEMINI_API_KEY) {
    console.error('讀圖階段需要 GEMINI_API_KEY（或加 --repair-only）');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;
let _geminiQueueTail = Promise.resolve();
function runInGeminiQueue(fn) {
    const p = _geminiQueueTail.then(() => fn());
    _geminiQueueTail = p.catch(() => {});
    return p;
}
function getVisualSemanticsDeps() {
    return {
        supabase,
        genAI,
        runInGeminiQueue,
        getTaggingModelName: () => visualSemantics.getTaggingModelName(supabase),
        fetch: globalThis.fetch
    };
}

function mediaWallTextHasCjk(text) {
    return /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/.test(String(text || ''));
}

function isGenericMediaWallTitle(title) {
    const t = String(title || '').trim();
    if (!t) return true;
    const generic = ['產品設計稿', '產品設計圖', '未命名', '推廣圖', '情境圖', 'Untitled', 'Product design', 'Product design draft', 'Design draft', 'Design drafts'];
    return generic.some((g) => t === g || t.toLowerCase() === g.toLowerCase());
}

function truncateLikeGenerationPromptTitle(prompt, maxLen) {
    const gp = String(prompt || '').trim();
    if (!gp) return '';
    const n = maxLen == null ? 80 : maxLen;
    return gp.substring(0, n) + (gp.length > n ? '…' : '');
}

function customProductTextCopiedFromPrompt(text, genPrompt) {
    const t = String(text || '').trim();
    const gp = String(genPrompt || '').trim();
    if (!t || !gp) return false;
    if (t === gp) return true;
    if (t === truncateLikeGenerationPromptTitle(gp)) return true;
    const head = t.replace(/…$/, '');
    if (head.length >= 6 && gp.startsWith(head) && gp.length > head.length) return true;
    return false;
}

function shouldReplaceCustomProductTitleFromAi(title, genPrompt) {
    if (isGenericMediaWallTitle(title)) return true;
    return customProductTextCopiedFromPrompt(title, genPrompt);
}

function parseImageSemanticsJson(raw) {
    if (!raw) return null;
    if (typeof raw === 'object') return raw;
    if (typeof raw === 'string') {
        try { return JSON.parse(raw); } catch (_) { return null; }
    }
    return null;
}

function resolveCustomProductTitlePairFromRow(p) {
    if (!p || typeof p !== 'object') return null;
    const sem = parseImageSemanticsJson(p.image_semantics_json);
    if (sem) {
        const pair = visualSemantics.buildCustomProductTitlePairFromSemantics(sem);
        if (pair && (pair.zh || pair.en)) return pair;
    }
    if (Array.isArray(p.ai_tags) && p.ai_tags.length) {
        return visualSemantics.buildCustomProductTitlePairFromSemantics({ tags: p.ai_tags });
    }
    return null;
}

function customProductRowHasStoredImageSemantics(row) {
    if (!row) return false;
    if (row.image_semantics_json) return true;
    return Array.isArray(row.ai_tags) && row.ai_tags.length > 0;
}

function customProductTitleEnNeedsRepairFromPair(row, titlePair, genPrompt) {
    if (!row || !titlePair) return false;
    const enTrim = String(row.title_en || '').trim();
    const zhTrim = String(row.title || '').trim();
    const gp = genPrompt != null ? String(genPrompt).trim() : '';
    const enNeeds = !enTrim || isGenericMediaWallTitle(enTrim) || customProductTextCopiedFromPrompt(enTrim, gp);
    const pairEn = titlePair.en ? String(titlePair.en).trim() : '';
    if (!pairEn) return enNeeds;
    return enNeeds
        || (enTrim === zhTrim && zhTrim && mediaWallTextHasCjk(zhTrim))
        || (enTrim && mediaWallTextHasCjk(enTrim) && !mediaWallTextHasCjk(pairEn));
}

function customProductRowNeedsTitleRepairFromStoredSemantics(row) {
    if (!row || !row.id || !customProductRowHasStoredImageSemantics(row)) return false;
    const gp = (row.generation_prompt != null) ? String(row.generation_prompt).trim() : '';
    const pair = resolveCustomProductTitlePairFromRow(row);
    if (!pair || (!pair.zh && !pair.en)) return false;
    if (shouldReplaceCustomProductTitleFromAi(row.title, gp)) return true;
    return customProductTitleEnNeedsRepairFromPair(row, pair, gp);
}

function resolveFetchableImageUrl(imageUrl) {
    const u = String(imageUrl || '').trim();
    if (!u || /^data:/i.test(u)) return '';
    if (/^https?:\/\//i.test(u)) return u;
    if (u.startsWith('//')) return 'https:' + u;
    return SITE_BASE + (u.startsWith('/') ? u : '/' + u);
}

function rowNeedsGemini(row, scope) {
    if (!row || !row.id || !row.owner_id || !row.ai_generated_image_url) return false;
    if (String(row.ai_generated_image_url).indexOf('data:') === 0) return false;
    const gp = (row.generation_prompt != null) ? String(row.generation_prompt).trim() : '';
    const hasSem = !!row.semantics_generated_at || !!row.image_semantics_json
        || (Array.isArray(row.ai_tags) && row.ai_tags.length > 0);
    if (scope === 'all') return true;
    if (!hasSem) return true;
    // 已有讀圖語意：僅繁中 title 仍佔位才再跑 Gemini（英文僅 repair，避免無 title_en 欄時死迴圈）
    return shouldReplaceCustomProductTitleFromAi(row.title, gp);
}

async function persistCustomProductSemanticsUpdate(productId, updates) {
    if (!productId || !updates || typeof updates !== 'object') return { ok: false };
    function layer(full, omitKeys) {
        const u = Object.assign({}, full);
        (omitKeys || []).forEach((k) => { delete u[k]; });
        return u;
    }
    const attempts = [
        updates,
        layer(updates, ['title_en', 'description_en']),
        layer(updates, ['title_en', 'description_en', 'ai_tags_by_dimension', 'prompt_semantics_json', 'semantics_generated_at']),
        (function () {
            const u = {};
            if (updates.title != null) u.title = updates.title;
            if (updates.title_en != null) u.title_en = updates.title_en;
            if (updates.ai_tags != null) u.ai_tags = updates.ai_tags;
            if (updates.image_semantics_json != null) u.image_semantics_json = updates.image_semantics_json;
            return u;
        })()
    ];
    for (let i = 0; i < attempts.length; i++) {
        const patch = attempts[i];
        if (!patch || !Object.keys(patch).length) continue;
        const { error } = await supabase.from('custom_products').update(patch).eq('id', productId);
        if (!error) return { ok: true };
        if (error.code !== '42703' && !/column/i.test(String(error.message || ''))) return { ok: false, error };
    }
    return { ok: false };
}

function mergeCustomProductTitlePairIntoUpdates(updates, titlePair, currentTitle, currentTitleEn, genPrompt) {
    if (!titlePair || (!titlePair.zh && !titlePair.en)) return;
    if (shouldReplaceCustomProductTitleFromAi(currentTitle, genPrompt)) {
        if (titlePair.zh) updates.title = titlePair.zh;
        else if (titlePair.en) updates.title = titlePair.en;
    }
    const enTrim = String(currentTitleEn || '').trim();
    const zhTrim = String(currentTitle || '').trim();
    const enNeeds = !enTrim || isGenericMediaWallTitle(enTrim) || customProductTextCopiedFromPrompt(enTrim, genPrompt);
    const pairEn = titlePair.en ? String(titlePair.en).trim() : '';
    const enMismatch = pairEn && (
        enNeeds
        || (enTrim === zhTrim && zhTrim && mediaWallTextHasCjk(zhTrim))
        || (enTrim && mediaWallTextHasCjk(enTrim) && !mediaWallTextHasCjk(pairEn))
    );
    if (enMismatch && pairEn) updates.title_en = pairEn;
    else if (enNeeds && titlePair.en) updates.title_en = titlePair.en;
    else if (enNeeds && titlePair.zh) updates.title_en = titlePair.zh;
}

function resolveCustomProductTitlePairFromEnrichSemantics(semantics, mergedTags) {
    let pair = visualSemantics.buildCustomProductTitlePairFromSemantics(semantics);
    if ((!pair || (!pair.zh && !pair.en)) && Array.isArray(mergedTags) && mergedTags.length) {
        pair = visualSemantics.buildCustomProductTitlePairFromSemantics({ tags: mergedTags });
    }
    return pair;
}

async function repairRowFromStoredSemantics(row) {
    const productId = row.id;
    const ownerId = row.owner_id;
    const gp = (row.generation_prompt != null) ? String(row.generation_prompt).trim() : '';
    const titlePair = resolveCustomProductTitlePairFromRow(row);
    if (!titlePair || (!titlePair.zh && !titlePair.en)) return false;
    const updates = {};
    if (shouldReplaceCustomProductTitleFromAi(row.title, gp)) {
        if (titlePair.zh) updates.title = titlePair.zh;
        else if (titlePair.en) updates.title = titlePair.en;
    }
    const enTrim = String(row.title_en || '').trim();
    const zhTrim = String(row.title || '').trim();
    const enNeeds = !enTrim || isGenericMediaWallTitle(enTrim) || customProductTextCopiedFromPrompt(enTrim, gp);
    const pairEn = titlePair.en ? String(titlePair.en).trim() : '';
    const enMismatch = pairEn && (
        enNeeds
        || (enTrim === zhTrim && zhTrim && mediaWallTextHasCjk(zhTrim))
        || (enTrim && mediaWallTextHasCjk(enTrim) && !mediaWallTextHasCjk(pairEn))
    );
    if (enMismatch && pairEn) updates.title_en = pairEn;
    else if (enNeeds && titlePair.en) updates.title_en = titlePair.en;
    else if (enNeeds && titlePair.zh) updates.title_en = titlePair.zh;
    if (!Object.keys(updates).length) return false;
    if (DRY_RUN) {
        console.log('[dry-run] repair', productId, updates);
        return true;
    }
    const { error } = await supabase.from('custom_products').update(updates).eq('id', productId).eq('owner_id', ownerId);
    return !error;
}

async function enrichOne(row, force) {
    const deps = getVisualSemanticsDeps();
    const imageUrl = resolveFetchableImageUrl(row.ai_generated_image_url);
    if (!imageUrl) return { ok: false, error: 'no url' };
    if (DRY_RUN) {
        console.log('[dry-run] gemini', row.id, imageUrl);
        return { ok: true };
    }
    const imagePart = await visualSemantics.fetchUrlToImagePart(deps.fetch, imageUrl);
    const imgResult = await visualSemantics.analyzeGeneratedImageSemantics(deps, imagePart, {
        generation_prompt: row.generation_prompt || null,
        title: row.title || null,
        category_key: row.category || null
    });
    let mergedTags = imgResult.tags || [];
    let genPrompt = (row.generation_prompt || '').trim();
    if (genPrompt) {
        try {
            const pResult = await visualSemantics.analyzePromptSemantics(deps, genPrompt, {
                title: row.title,
                category_key: row.category
            });
            mergedTags = visualSemantics.mergeTags(mergedTags, pResult.tags);
        } catch (_) {}
    }
    const tagsByDim = visualSemantics.buildTagsByDimension(imgResult.semantics);
    let currentTitle = (row.title || '').trim();
    let currentTitleEn = (row.title_en || '').trim();
    const titlePair = resolveCustomProductTitlePairFromEnrichSemantics(imgResult.semantics, mergedTags);
    const updates = {
        ai_tags: mergedTags,
        image_semantics_json: imgResult.semantics,
        ai_tags_by_dimension: tagsByDim,
        semantics_generated_at: new Date().toISOString()
    };
    if (!force) {
        mergeCustomProductTitlePairIntoUpdates(updates, titlePair, currentTitle, currentTitleEn, genPrompt);
    } else {
        if (titlePair.zh) updates.title = titlePair.zh;
        else if (titlePair.en) updates.title = titlePair.en;
        if (titlePair.en) updates.title_en = titlePair.en;
        else if (titlePair.zh) updates.title_en = titlePair.zh;
    }
    const persist = await persistCustomProductSemanticsUpdate(row.id, updates);
    return {
        ok: persist.ok,
        title_zh: updates.title || null,
        title_en: updates.title_en || null
    };
}

const SELECT_COLS = 'id, owner_id, title, title_en, category, generation_prompt, ai_generated_image_url, ai_tags, semantics_generated_at, image_semantics_json';

async function fetchCandidateRows() {
    const selectAttempts = [
        SELECT_COLS,
        'id, owner_id, title, category, generation_prompt, ai_generated_image_url, ai_tags, semantics_generated_at, image_semantics_json',
        'id, owner_id, title, category, generation_prompt, ai_generated_image_url, ai_tags'
    ];
    for (let i = 0; i < selectAttempts.length; i++) {
        const { data: rows, error } = await supabase
            .from('custom_products')
            .select(selectAttempts[i])
            .not('ai_generated_image_url', 'is', null)
            .order('created_at', { ascending: false })
            .limit(2000);
        if (!error) return rows || [];
        if (error.code !== '42703' && !/column/i.test(String(error.message || ''))) {
            throw new Error(error.message);
        }
    }
    return [];
}

async function runRepairPhase(rows) {
    let repaired = 0;
    let skipped = 0;
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!customProductRowNeedsTitleRepairFromStoredSemantics(row)) {
            skipped++;
            continue;
        }
        const ok = await repairRowFromStoredSemantics(row);
        if (ok) repaired++;
        if (repaired > 0 && repaired % 20 === 0) process.stdout.write(`  repair progress ${repaired}\n`);
    }
    return { repaired, skipped };
}

async function runGeminiPhase(rows) {
    let batches = 0;
    let totalOk = 0;
    let totalFail = 0;
    while (batches < MAX_GEMINI_BATCHES) {
        const pending = rows.filter((r) => rowNeedsGemini(r, 'generic')).slice(0, BATCH);
        if (!pending.length) break;
        batches++;
        console.log(`Gemini 批次 ${batches}，本批 ${pending.length} 張…`);
        for (let i = 0; i < pending.length; i++) {
            const row = pending[i];
            try {
                const out = await enrichOne(row, false);
                if (out.ok) totalOk++;
                else totalFail++;
                console.log(`  ${row.id} ok=${out.ok} zh=${out.title_zh || '-'} en=${out.title_en || '-'}`);
            } catch (e) {
                totalFail++;
                console.warn(`  ${row.id} error:`, e.message);
            }
        }
        if (!DRY_RUN) {
            rows = await fetchCandidateRows();
        } else {
            break;
        }
    }
    return { batches, totalOk, totalFail };
}

async function main() {
    console.log('載入候選設計稿…');
    let rows = await fetchCandidateRows();
    console.log('有生成圖的稿件（最多 2000）:', rows.length);

    if (!GEMINI_ONLY) {
        console.log('\n=== Phase 1：從已存語意 repair（不扣 Gemini）===');
        const r1 = await runRepairPhase(rows);
        console.log('repair 完成:', r1);
        if (!DRY_RUN) rows = await fetchCandidateRows();
    }

    if (!REPAIR_ONLY) {
        const needGemini = rows.filter((r) => rowNeedsGemini(r, 'generic')).length;
        console.log('\n=== Phase 2：Gemini 讀圖（仍待處理約', needGemini, '張）===');
        const r2 = await runGeminiPhase(rows);
        console.log('Gemini 完成:', r2);
    }

    console.log('\n全部結束。請硬刷新首頁驗證媒體牆標題。');
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
