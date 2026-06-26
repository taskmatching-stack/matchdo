#!/usr/bin/env node
/**
 * 圖樣排查：模擬設計頁 4 張參考圖 payload → 後端排序 → FLUX prompt 附錄 + BFL 欄位對照。
 * 不連 DB、不呼叫 BFL。用法：node scripts/diagnose-pattern-flux-payload.js
 */
'use strict';

function normalizeVendorAssetKind(k) {
    const s = String(k || 'prototype').trim().toLowerCase();
    if (s === 'material' || s === 'part' || s === 'other') return s;
    return 'prototype';
}
function normalizePatternIntent(intent) {
    const s = intent != null ? String(intent).trim().toLowerCase() : '';
    return s === 'style' ? 'style' : 'print';
}
function fluxRefKindLabel(kind, isEn) {
    const k = normalizeVendorAssetKind(kind);
    if (isEn) {
        if (k === 'prototype') return 'prototype';
        if (k === 'material') return 'material';
        if (k === 'part') return 'part';
        return 'pattern';
    }
    return k;
}
function buildFluxCatalogCompositeRefLead() {
    return [
        'Catalog composite mode (follow Split-view 1–4 in the category prompt above): output ONE image with a 2x2 grid only.',
        'Exactly four panels — top-left, bottom-left, top-right, bottom-right — with no fifth view, no extra rows, and no separate product-photo series.',
        'Every panel shows the same single finished product — prototype shape, attached parts, body material/texture, and surface print/graphic merged together — only the studio camera angle per panel changes per Split-view.',
        'One identical product instance in all four panels; do not render multiple different variants, duplicates, or colorways in the same output.',
        'Reference input images supply product features only; never show each reference photo in its own panel; never replace Split-view angles with reference photo compositions or backgrounds.'
    ].join(' ');
}
function fluxReferenceKindRoleLine(kind, isEn, imageNum, protoImageNum, patternIntent, styleArtworkRequested) {
    const k = normalizeVendorAssetKind(kind);
    const n = imageNum != null ? imageNum : 1;
    const p = protoImageNum != null ? protoImageNum : 1;
    const panelNote = isEn ? ' Feature for the same product in all four 2x2 catalog panels.' : '';
    if (!isEn) return '';
    if (k === 'prototype') return 'Prototype shape, silhouette, proportions, and structure (image ' + n + ').' + panelNote;
    if (k === 'material') {
        return 'Recolor the main product body using material reference (image ' + n + '): keep the same body opacity, thickness, side-edge treatment, and material class visible in prototype image ' + p + '; apply only the color and surface texture from image ' + n + ' to matching regions including side edges. Do not introduce transparency, frosted acrylic, or a printed color layer unless the prototype or material reference clearly shows it.' + panelNote;
    }
    if (k === 'part') return 'Hardware/trim from image ' + n + ' mounted on the same main product (shape from image ' + p + ').' + panelNote;
    if (k === 'other') {
        if (normalizePatternIntent(patternIntent) === 'style') {
            if (styleArtworkRequested) {
                return 'Style reference (image ' + n + ') for the main product body surface in every panel; inspired look only, no literal copy.' + panelNote;
            }
            return 'Style reference (image ' + n + ') for optional subtle mood only; keep the main product printable surface plain without added logos, icons, or busy graphics.' + panelNote;
        }
        return 'Exact surface graphic from image ' + n + ' printed on the same main product body in every panel; artwork must match image ' + n + '.' + panelNote;
    }
    return '';
}
function resolveFluxProtoImageIndex(sources) {
    for (let i = 0; i < sources.length; i++) {
        if (normalizeVendorAssetKind(sources[i] && sources[i].asset_kind) === 'prototype') return i + 1;
    }
    return 1;
}
function buildFluxReferenceApplySummary(sources, styleArtworkRequested) {
    const protoN = resolveFluxProtoImageIndex(sources);
    const bits = [];
    sources.forEach(function (s, idx) {
        const n = idx + 1;
        const k = normalizeVendorAssetKind(s.asset_kind);
        if (k === 'other') {
            if (normalizePatternIntent(s.pattern_intent) === 'style') {
                if (styleArtworkRequested) bits.push('style from image ' + n + ' on the same product in all panels');
            } else {
                bits.push('exact surface graphic from image ' + n + ' on the same product in all panels');
            }
        } else if (k === 'part') bits.push('hardware from image ' + n + ' on the same product (shape from image ' + protoN + ') in all panels');
        else if (k === 'material') bits.push('body color/texture from image ' + n + ' with opacity and material class from prototype image ' + protoN + ' in all panels');
    });
    if (!bits.length) return '';
    return '\nMerge into one product for every 2x2 panel: ' + bits.join('; ') + '.';
}
function userRequestedSurfaceArtwork(userPrompt, placementHints) {
    if (Array.isArray(placementHints) && placementHints.length) return true;
    const raw = String(userPrompt || '').trim();
    if (!raw) return false;
    return /印刷|圖樣|圖文|logo|graphic|pattern|print|圖案|印花|贴图|貼圖|圖稿|artwork|surface design/i.test(raw);
}
function buildFluxReferenceFactsAppendix(orderedSources, fluxRefOpts) {
    const list = orderedSources.filter(Boolean);
    if (!list.length) return '';
    const userPrompt = (fluxRefOpts && fluxRefOpts.userPrompt) || '';
    const placementHints = (fluxRefOpts && fluxRefOpts.placementHints) || [];
    const styleArtworkRequested = userRequestedSurfaceArtwork(userPrompt, placementHints);
    const lines = ['【Reference images — feature extract for 2x2 catalog composite】', buildFluxCatalogCompositeRefLead()];
    const protoN = resolveFluxProtoImageIndex(list);
    const protoCount = list.filter((s) => normalizeVendorAssetKind(s.asset_kind) === 'prototype').length;
    const hasProto = protoCount > 0;
    const hasPart = list.some((s) => normalizeVendorAssetKind(s.asset_kind) === 'part');
    const hasPrintPattern = list.some((s) => normalizeVendorAssetKind(s.asset_kind) === 'other' && normalizePatternIntent(s.pattern_intent) !== 'style');
    const hasStylePattern = list.some((s) => normalizeVendorAssetKind(s.asset_kind) === 'other' && normalizePatternIntent(s.pattern_intent) === 'style');
    if (hasProto) {
        if (protoCount === 1) lines.push('Prototype tab: image ' + protoN + ' supplies shape; merged into the same product in every 2x2 panel.');
        else lines.push('Prototype tab: images ' + list.map((s, i) => (normalizeVendorAssetKind(s.asset_kind) === 'prototype' ? String(i + 1) : null)).filter(Boolean).join(', ') + ' are multiple views of one product; combine for one shape in every panel.');
    }
    if (hasPart) {
        const partNums = list.map((s, i) => (normalizeVendorAssetKind(s.asset_kind) === 'part' ? String(i + 1) : null)).filter(Boolean).join(', ');
        lines.push('Parts tab: image ' + partNums + ' — hardware on the same product in every panel.');
    }
    const matNums = list.map((s, i) => (normalizeVendorAssetKind(s.asset_kind) === 'material' ? String(i + 1) : null)).filter(Boolean).join(', ');
    if (matNums) {
        const protoNumsForMat = list.map((s, i) => (normalizeVendorAssetKind(s.asset_kind) === 'prototype' ? String(i + 1) : null)).filter(Boolean).join(', ');
        lines.push('Material tab: image ' + matNums + ' — color/texture only; body opacity, thickness, and material class follow prototype image(s) ' + protoNumsForMat + ' (user already provided main product photos).');
    }
    if (hasPrintPattern) {
        const patNums = list.map((s, i) => (normalizeVendorAssetKind(s.asset_kind) === 'other' && normalizePatternIntent(s.pattern_intent) !== 'style' ? String(i + 1) : null)).filter(Boolean).join(', ');
        lines.push('Pattern tab (exact print): image ' + patNums + ' — apply the exact surface graphic/artwork from the reference onto the product in every panel.');
    } else if (!hasStylePattern || !styleArtworkRequested) {
        lines.push('No exact-print reference images; keep the main product printable surface plain unless the user description specifies surface artwork.');
    }
    if (hasStylePattern) {
        const styNums = list.map((s, i) => (normalizeVendorAssetKind(s.asset_kind) === 'other' && normalizePatternIntent(s.pattern_intent) === 'style' ? String(i + 1) : null)).filter(Boolean).join(', ');
        if (styleArtworkRequested) lines.push('Pattern tab (style reference): image ' + styNums + ' — inspired surface design on the same product in every panel; follow the user description for surface artwork.');
        else lines.push('Pattern tab (style reference): image ' + styNums + ' — optional subtle mood inspiration only; keep the main product printable surface plain without logos, icons, or busy graphics.');
    }
    list.forEach(function (s, idx) {
        const n = idx + 1;
        const kind = normalizeVendorAssetKind(s.asset_kind || 'prototype');
        const isPrintPattern = kind === 'other' && normalizePatternIntent(s.pattern_intent) !== 'style';
        const title = (s.title || '').trim();
        const titlePart = (title && !isPrintPattern && kind !== 'material') ? (' · "' + title + '"') : '';
        lines.push('image ' + n + ' · ' + fluxRefKindLabel(kind, true) + titlePart);
        const roleLine = fluxReferenceKindRoleLine(kind, true, n, protoN, s.pattern_intent, styleArtworkRequested);
        if (roleLine) lines.push('  ' + roleLine);
        if (isPrintPattern && s.pattern_remove_bg) lines.push('  Remove solid background from image ' + n + ' before compositing the surface artwork onto the product.');
    });
    const applySummary = buildFluxReferenceApplySummary(list, styleArtworkRequested);
    if (applySummary) lines.push(applySummary.trim());
    return '\n\n' + lines.join('\n');
}
function fluxReferenceSourceRank(src) {
    const k = normalizeVendorAssetKind(src && src.asset_kind);
    if (k === 'prototype') return 0;
    if (k === 'part') return 1;
    if (k === 'material') return 2;
    if (k === 'other') return normalizePatternIntent(src && src.pattern_intent) === 'style' ? 4 : 3;
    return 5;
}
function reorderFluxReferenceInputs(referenceImages, referenceSources) {
    const pairs = referenceImages.map((img, i) => ({ img, src: referenceSources[i] || null, ord: i }));
    pairs.sort((a, b) => {
        const dr = fluxReferenceSourceRank(a.src) - fluxReferenceSourceRank(b.src);
        return dr !== 0 ? dr : a.ord - b.ord;
    });
    return { images: pairs.map((p) => p.img), sources: pairs.map((p) => p.src) };
}
function mapBflImageFields(sources) {
    return sources.map((s, i) => ({
        bflField: i === 0 ? 'input_image' : 'input_image_' + (i + 1),
        imageNum: i + 1,
        asset_kind: s.asset_kind,
        pattern_intent: s.pattern_intent || null,
        title: s.title || null
    }));
}

function runScenario(name, sources, userPrompt) {
    const images = sources.map((_, i) => 'data:image/png;base64,MOCK' + i);
    const ordered = reorderFluxReferenceInputs(images, sources);
    const appendix = buildFluxReferenceFactsAppendix(ordered.sources, { userPrompt: userPrompt || '', placementHints: [] });
    const bfl = mapBflImageFields(ordered.sources);
    const printRow = bfl.find((r) => normalizeVendorAssetKind(r.asset_kind) === 'other' && normalizePatternIntent(r.pattern_intent) !== 'style');
    console.log('\n========== ' + name + ' ==========');
    console.log('參考圖張數:', ordered.sources.length);
    console.log('使用者 prompt（送 API 的 prompt 欄）:', JSON.stringify(userPrompt || ''));
    console.log('\n--- BFL 圖欄位對照 ---');
    bfl.forEach((r) => console.log(r.bflField + ' ← image ' + r.imageNum + ' | ' + r.asset_kind + (r.pattern_intent ? '/' + r.pattern_intent : '') + (r.title ? ' | title=' + r.title : '')));
    if (printRow) {
        console.log('\n原圖印刷 → ' + printRow.bflField + '（第 ' + printRow.imageNum + ' 張；BFL 主編輯底圖是 input_image = 原型）');
    }
    console.log('\n--- 參考附錄（不含子分類 DB prompt）---');
    console.log(appendix);
    const printRoleLines = appendix.split('\n').filter((l) => /Exact surface graphic|Pattern tab \(exact print\)|exact surface graphic from image/.test(l));
    console.log('\n--- 圖樣相關句（摘）---');
    printRoleLines.forEach((l) => console.log(l));
}

// 模擬截圖：原型×2、配件×1、材料×1、原圖印刷×1（總 5/8）或 4/8 精簡版
runScenario('4/8：原型+配件+材料+原圖印刷（各1）', [
    { asset_kind: 'prototype', title: '識別證套原型' },
    { asset_kind: 'part', title: '掛繩' },
    { asset_kind: 'material', title: '米白塑料' },
    { asset_kind: 'other', pattern_intent: 'print', title: 'Match DO' }
], '');

runScenario('5/8：原型×2+配件+材料+原圖印刷', [
    { asset_kind: 'prototype', title: '原型A' },
    { asset_kind: 'prototype', title: '原型B' },
    { asset_kind: 'part', title: '掛繩' },
    { asset_kind: 'material', title: '米白' },
    { asset_kind: 'other', pattern_intent: 'print', title: 'Match DO' }
], '');

runScenario('pattern_intent 遺失（bug 探測）', [
    { asset_kind: 'other', title: 'Match DO' }
], '');

console.log('\n--- API 可觀測性 ---');
console.log('POST /api/generate-product-image 回傳不含 fullPrompt；DB generation_prompt 只存使用者 prompt，不含子分類+附錄。');
console.log('若要對照實際送 BFL 字串，需加 log 或 admin 除錯欄位。');
