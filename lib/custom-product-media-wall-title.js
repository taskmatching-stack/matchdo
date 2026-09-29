'use strict';

const visualSemantics = require('./visual-semantics');

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

function truncateMediaWallTitle(text, maxLen = 56) {
    const s = String(text || '').replace(/\s+/g, ' ').trim();
    if (!s) return '';
    if (s.length <= maxLen) return s;
    return s.slice(0, maxLen) + '…';
}

function firstSentenceFromText(text) {
    const s = String(text || '').replace(/\s+/g, ' ').trim();
    if (!s) return '';
    const m = s.match(/^[^。.\n!?！？]+[。.\n!?！？]?/);
    return (m ? m[0] : s).trim();
}

function parseImageSemanticsJson(raw) {
    if (!raw) return null;
    if (typeof raw === 'object') return raw;
    if (typeof raw === 'string') {
        try { return JSON.parse(raw); } catch (_) { return null; }
    }
    return null;
}

function normalizeVendorContentLang(lang) {
    const l = String(lang || '').trim().toLowerCase();
    if (l === 'en' || l.startsWith('en-')) return 'en';
    return 'zh';
}

function mediaWallTitlePairFromDbTitleFields(title, titleEn) {
    const raw = String(title || '').trim();
    const rawEn = String(titleEn || '').trim();
    let zh = '';
    let en = '';
    if (raw && !isGenericMediaWallTitle(raw)) {
        const t = truncateMediaWallTitle(raw);
        if (mediaWallTextHasCjk(t)) zh = t;
        else en = t;
    }
    if (rawEn && !isGenericMediaWallTitle(rawEn)) {
        const t = truncateMediaWallTitle(rawEn);
        if (!en) en = t;
        else if (!zh && mediaWallTextHasCjk(t)) zh = t;
    }
    return { zh, en };
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

function resolveCustomProductDisplayTitlePair(p, genPromptOverride) {
    if (!p || typeof p !== 'object') return { zh: '', en: '' };
    const gp = genPromptOverride != null
        ? String(genPromptOverride).trim()
        : (p.generation_prompt != null ? String(p.generation_prompt).trim() : '');
    let titleZh = p.title;
    let titleEn = p.title_en;
    const titlePair = resolveCustomProductTitlePairFromRow(p);
    if (titlePair) {
        if (customProductTextCopiedFromPrompt(titleZh, gp) || isGenericMediaWallTitle(titleZh)) {
            if (titlePair.zh) titleZh = titlePair.zh;
            else if (titlePair.en) titleZh = titlePair.en;
        }
        const enTrim = String(titleEn || '').trim();
        const zhTrim = String(titleZh || '').trim();
        const enNeeds = !enTrim || isGenericMediaWallTitle(enTrim) || customProductTextCopiedFromPrompt(enTrim, gp);
        const pairEn = titlePair.en ? String(titlePair.en).trim() : '';
        const enMismatch = pairEn && (
            enNeeds
            || (enTrim === zhTrim && zhTrim && mediaWallTextHasCjk(zhTrim))
            || (enTrim && mediaWallTextHasCjk(enTrim) && !mediaWallTextHasCjk(pairEn))
        );
        if (enMismatch && pairEn) titleEn = pairEn;
        else if (enNeeds && titlePair.en) titleEn = titlePair.en;
        else if (enNeeds && titlePair.zh) titleEn = titlePair.zh;
    }
    return {
        zh: titleZh != null ? String(titleZh).trim() : '',
        en: titleEn != null ? String(titleEn).trim() : ''
    };
}

function legacyCustomProductTitleFallbackFromPrompt(genPrompt) {
    const gp = String(genPrompt || '').trim();
    if (!gp) return { zh: '', en: '' };
    const fb = truncateMediaWallTitle(firstSentenceFromText(gp));
    if (!fb || isGenericMediaWallTitle(fb)) return { zh: '', en: '' };
    if (mediaWallTextHasCjk(fb)) return { zh: fb, en: '' };
    return { zh: fb, en: fb };
}

function resolveUserDesignMediaWallTitlePair(p) {
    let aj = p.analysis_json;
    if (typeof aj === 'string') try { aj = JSON.parse(aj); } catch (_) { aj = null; }
    const genPrompt = (p.generation_prompt || (aj && aj.generation_prompt) || '').trim();
    const sem = parseImageSemanticsJson(p.image_semantics_json);
    const displayTitles = resolveCustomProductDisplayTitlePair(p, genPrompt);
    const fromDb = mediaWallTitlePairFromDbTitleFields(displayTitles.zh || p.title, displayTitles.en || p.title_en);
    let zh = fromDb.zh ? truncateMediaWallTitle(fromDb.zh) : '';
    let en = fromDb.en ? truncateMediaWallTitle(fromDb.en) : '';

    if (!zh && !en) {
        const zhDesc = sem && sem.product_description_zh ? firstSentenceFromText(sem.product_description_zh) : '';
        const enDesc = sem && sem.product_description_en ? firstSentenceFromText(sem.product_description_en) : '';
        if (zhDesc) zh = truncateMediaWallTitle(zhDesc);
        if (enDesc) en = truncateMediaWallTitle(enDesc);
    }

    const zhBad = !zh || isGenericMediaWallTitle(zh);
    const enBad = !en || isGenericMediaWallTitle(en);
    if (zhBad || enBad) {
        const pair = resolveCustomProductTitlePairFromRow(p);
        if (pair) {
            if (zhBad && pair.zh && !isGenericMediaWallTitle(pair.zh)) zh = truncateMediaWallTitle(pair.zh);
            if (enBad && pair.en && !isGenericMediaWallTitle(pair.en)) en = truncateMediaWallTitle(pair.en);
            else if (enBad && pair.zh && !isGenericMediaWallTitle(pair.zh)) en = truncateMediaWallTitle(pair.zh);
        }
    }

    if ((!zh || isGenericMediaWallTitle(zh)) && (!en || isGenericMediaWallTitle(en))
        && !customProductRowHasStoredImageSemantics(p) && genPrompt) {
        const legacy = legacyCustomProductTitleFallbackFromPrompt(genPrompt);
        if (legacy.zh && (!zh || isGenericMediaWallTitle(zh))) zh = legacy.zh;
        if (legacy.en && (!en || isGenericMediaWallTitle(en))) en = legacy.en;
    }

    if (genPrompt) {
        if (zh && customProductTextCopiedFromPrompt(zh, genPrompt)) {
            const pair = resolveCustomProductTitlePairFromRow(p);
            if (pair && pair.zh && !customProductTextCopiedFromPrompt(pair.zh, genPrompt)) zh = truncateMediaWallTitle(pair.zh);
            else zh = '';
        }
        if (en && customProductTextCopiedFromPrompt(en, genPrompt)) {
            const pair = resolveCustomProductTitlePairFromRow(p);
            if (pair && pair.en && !customProductTextCopiedFromPrompt(pair.en, genPrompt)) en = truncateMediaWallTitle(pair.en);
            else if (pair && pair.zh && !customProductTextCopiedFromPrompt(pair.zh, genPrompt)) en = truncateMediaWallTitle(pair.zh);
            else en = '';
        }
    }

    return { zh: zh || '', en: en || '' };
}

function pickMediaWallLocalizedTitle(zh, en, lang, kind, opts) {
    const o = opts && typeof opts === 'object' ? opts : {};
    const isEn = normalizeVendorContentLang(lang) === 'en';
    const z = String(zh || '').trim();
    const e = String(en || '').trim();
    const zOk = z && !isGenericMediaWallTitle(z);
    const eOk = e && !isGenericMediaWallTitle(e);
    const noDesignPlaceholder = kind === 'user_design' && o.hasGenerationPrompt === false;
    if (isEn) {
        if (eOk) return e;
        if (zOk) return z;
        if (noDesignPlaceholder) return '';
        return kind === 'promo' ? 'Scene image' : 'Product design draft';
    }
    if (zOk) return z;
    if (z && mediaWallTextHasCjk(z)) return z;
    if (eOk) return e;
    if (noDesignPlaceholder) return '';
    return kind === 'promo' ? '情境圖' : '產品設計稿';
}

function userDesignGenerationPromptOnly(p) {
    if (!p) return '';
    let aj = p.analysis_json;
    if (typeof aj === 'string') try { aj = JSON.parse(aj); } catch (_) { aj = null; }
    return String(p.generation_prompt || (aj && aj.generation_prompt) || '').trim();
}

/** SEO 隱藏描述：優先 description／語意句，勿在已有讀圖標題時再塞整段提示詞 */
function userDesignMediaWallSeoDescription(p, titleForLang) {
    if (!p) return '';
    const gp = userDesignGenerationPromptOnly(p);
    const desc = String(p.description || '').trim();
    if (desc && (!titleForLang || desc !== titleForLang)) return desc;
    const sem = parseImageSemanticsJson(p.image_semantics_json);
    if (sem) {
        const dz = sem.product_description_zh ? firstSentenceFromText(sem.product_description_zh) : '';
        const de = sem.product_description_en ? firstSentenceFromText(sem.product_description_en) : '';
        const pick = mediaWallTextHasCjk(titleForLang) ? dz : (de || dz);
        if (pick && pick !== titleForLang) return pick;
    }
    if (gp && titleForLang && !customProductTextCopiedFromPrompt(titleForLang, gp)) return gp;
    if (gp && !titleForLang) return gp;
    return '';
}

module.exports = {
    resolveUserDesignMediaWallTitlePair,
    pickMediaWallLocalizedTitle,
    userDesignGenerationPromptOnly,
    userDesignMediaWallSeoDescription,
    customProductTextCopiedFromPrompt,
    isGenericMediaWallTitle,
    parseImageSemanticsJson,
    resolveCustomProductTitlePairFromRow
};
