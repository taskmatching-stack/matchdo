'use strict';

function normalizePortraitStylingMode(raw) {
    const s = String(raw || '').trim().toLowerCase().replace(/-/g, '_');
    if (s === 'reference' || s === 'ref' || s === 'keep' || s === 'original') return 'reference';
    if (s === 'scene' || s === 'auto' || s === 'theme') return 'scene';
    if (s === 'prompt' || s === 'description' || s === 'desc') return 'prompt';
    return 'scene';
}

function resolvePortraitStylingFromBody(body) {
    const b = body && typeof body === 'object' ? body : {};
    return normalizePortraitStylingMode(
        b.portrait_styling_mode || b.portraitStylingMode || b.styling_mode
    );
}

function assertPortraitStylingPromptRequired(mode, userPrompt) {
    if (normalizePortraitStylingMode(mode) === 'prompt' && !String(userPrompt || '').trim()) {
        const err = new Error('依描述調整時請填寫描述（服裝、髮型等）');
        err.status = 400;
        throw err;
    }
}

/**
 * 開頭：依場景／依描述＝參考圖只提供人物；依原圖＝忽略姿勢但服裝仍跟參考圖。
 * 關鍵指令用英文（Gemini 官方建議語系）。圖後 trailing 請用 buildPortraitIgnoreRefPoseTrailingLine。
 */
function buildPortraitIgnoreRefPoseEmphasisLine(themeKey, mode) {
    const m = normalizePortraitStylingMode(mode);
    if (m === 'reference') {
        return '***Ignore the original pose***. Keep the garment type, color palette, and silhouette from the reference.';
    }
    return '***Ignore the original pose***. Reference image 1 provides the person only.';
}

/** 看完參考圖後只補忽略姿勢，三種衣著相同 */
function buildPortraitIgnoreRefPoseTrailingLine() {
    return '***Ignore the original pose***.';
}

/**
 * 審核友善（Grok）：臉複製較低，可允許比清晰更大的姿勢與構圖變化。
 * 仍鎖同一個人，但不鎖參考圖的肢體位置、站姿或裁切。
 */
function buildPortraitFluxExperimentPriorityLead(mode) {
    const m = normalizePortraitStylingMode(mode);
    let clothes;
    if (m === 'reference') {
        clothes = 'Keep the same outfit as the reference (garment type, color palette, silhouette); do not invent a different outfit.';
    } else if (m === 'scene') {
        clothes = 'Clothing follows the theme and scene, not the reference outfit.';
    } else {
        clothes = 'Clothing follows the user description, not the reference outfit.';
    }
    return (
        'Priority for this image edit: ***Keep the same person*** (same face, same identity, same apparent age); do not replace them with someone else. '
        + '***Do not copy the pose or framing*** from the reference: do not reuse its limb positions, body stance, crop, or camera distance. '
        + 'Invent a new natural pose and body language that fits the scene and shoot theme—any stance the environment supports is fine. '
        + 'Framing may be full body, three-quarter, half-length, or closer; choose what best shows the garment and scene. '
        + 'Full-body shots are allowed and often preferred for apparel. Do not default to a tight head-and-shoulders crop. '
        + clothes
    );
}

/** 審核友善尾句：構圖偏編輯／型錄，全身與環境取景皆可。 */
function buildPortraitFluxExperimentCompositionLine() {
    return (
        'Editorial catalog composition: full body, three-quarter, half-length, or environmental framing are all valid. '
        + 'Vary angle, distance, and where the person sits in the frame. Do not mirror the reference image layout.'
    );
}

/** 未填描述時不再指定姿勢 */
function buildPortraitPoseBySceneGeminiLine(themeKey) {
    return '';
}

/** 生圖原則：依場景／依描述只複製人物；依原圖複製人物與服裝（英文關鍵指令） */
function buildPortraitCommercialPrincipleZh(mode, themeKey) {
    const m = normalizePortraitStylingMode(mode);
    if (m === 'reference') {
        return 'Generation rules (must follow): copy the person and the outfit from the reference; keep the garment type, color palette, and silhouette; ***Ignore the original pose***.';
    }
    return 'Generation rules (must follow): copy the person only, ***Ignore the original pose***.';
}

/** 依參考圖：商用構圖（中文，氛圍／混合貼人） */
function buildPortraitReferenceCommercialFramingMoodLine() {
    return buildPortraitCommercialPrincipleZh('reference');
}

/** 依原圖衣著：句型對齊依場景，只改衣服來源 */
function buildPortraitReferenceGarmentGeminiLine() {
    return 'Clothing and styling should follow reference image 1 (same garment type, color palette, and silhouette); keep that outfit; do not invent a different outfit.';
}

function buildPortraitStylingGeminiLead(mode, themeKey) {
    const m = normalizePortraitStylingMode(mode);
    const identity = 'Preserve the same person\'s facial identity and likeness from reference image 1. ';
    if (m === 'reference') {
        return identity + buildPortraitReferenceGarmentGeminiLine();
    }
    if (m === 'scene') {
        return identity
            + 'Clothing and styling should follow the shoot theme and scene environment; do not copy outfit from reference image 1.';
    }
    return identity
        + 'Clothing, hairstyle, accessories, and styling must follow the user description.';
}

/** 混合第二階段：人像融入 FLUX 空景（邊緣、光影、姿勢皆對齊場景） */
function buildPortraitStylingHybridSwapLead() {
    return 'Single unified commercial photograph in one continuous shot. Reference image 1 is identity only (face, body type, likeness). '
        + 'Do not paste, overlay, or keep the rectangular crop of image 1. '
        + 'Re-render one complete person inside reference image 2. '
        + 'Pose must belong in image 2: match scene perspective, ground plane, furniture height, and the subject area in the composition; '
        + 'do not reuse limb positions, stance, or framing from image 1. '
        + 'Edge transitions must follow image 2 optics: depth of field, atmospheric haze, ambient color bleed on silhouettes, and rim light from the scene only—'
        + 'not a generic blur or halo unrelated to the environment. Feather hair, shoulders, sleeves, and garment edges accordingly; no outlines, sticker edges, or visible paste boundaries. '
        + 'Re-light the person entirely from image 2: key light direction, shadow length and softness, ambient bounce, color temperature, contrast, and depth of field must match the empty scene; '
        + 'no studio lighting carried over from image 1. '
        + 'Correct contact shadows and ambient occlusion where the body meets the environment.';
}

function buildPortraitStylingMoodSwapClosing(mode) {
    const m = normalizePortraitStylingMode(mode);
    const blend = 'Match placement to image 2; re-render a complete person in image 2, ***Ignore the original pose***, with pose integrated into scene perspective; '
        + 'image 1 is face and body reference only — do not keep the crop box, rectangular border, sticker, or layers; '
        + 'match contact shadows, bounce light, color temperature, and perspective to the scene; '
        + 'edge transitions must match image 2 depth of field, atmosphere, and ambient color—not generic feathering; no hard cut-and-paste.';
    if (m === 'reference') {
        return 'Result: person and body from image 1; clothing from the reference garment style and colors; ***Ignore the original pose***; commercial framing; scene from image 2. ' + blend;
    }
    if (m === 'scene') {
        return 'Result: person and body from image 1; clothing from the theme and scene; ***Ignore the original pose***; commercial framing; scene from image 2. ' + blend;
    }
    return 'Result: person and body from image 1; clothing from the description; ***Ignore the original pose***; commercial framing; scene from image 2. ' + blend;
}

const GROK_CAMERA_OPTICS_LITE =
    'Depth of field as soft background blur only—no aperture shapes, lens flare, light spots, or floating orbs.';

/** 單句攝影參數：剝除 Grok 易字面化的耀光／光斑／光圈片數用語，保留焦段與景深語意。 */
function stripGrokHeavyOpticsClause(clause) {
    let t = String(clause || '').trim();
    if (!t) return '';

    if (/\b(?:five|seven|nine|eleven)[-\s]?blade\b/i.test(t) && /\b(?:aperture|iris)\b/i.test(t)) {
        return GROK_CAMERA_OPTICS_LITE;
    }
    if (/\baperture\s+iris\b/i.test(t)) {
        return GROK_CAMERA_OPTICS_LITE;
    }

    t = t.replace(/\b(?:subtle|gentle|premium\s+cinematic|distinct|cinematic|classic)\s+(?:lens\s+)?flare[^,;.]*/gi, '');
    t = t.replace(/\b(?:lens\s+)?flare\s+character\b/gi, '');
    t = t.replace(/\b(?:lens\s+)?flare\b/gi, '');
    t = t.replace(/\banamorphic\s+streaks?\b/gi, '');
    t = t.replace(/\b(?:light\s+leaks?|ghosting|sun\s*stars?)\b/gi, '');

    t = t.replace(/\b(?:smooth|creamy|organic|swirly|round\s+smooth)\s+bokeh(?:\s+falloff|\s+highlights?|\s+circles?|\s+tendency)?[^,;.]*/gi,
        'soft background separation');
    t = t.replace(/\bbokeh\s+(?:highlights?|falloff|circles?|tendency)[^,;.]*/gi, '');
    t = t.replace(/\bbokeh\b/gi, 'background blur');
    t = t.replace(/\b(?:pentagonal|heptagonal|nonagonal|hendecagonal)\b/gi, '');

    t = t.replace(/\bhighlight\s+shape\b/gi, '');
    t = t.replace(/\bgentle\s+glow\b/gi, '');
    t = t.replace(/\b(?:soft(?:er)?\s+)?glow\b/gi, '');
    t = t.replace(/\bglass\s+imperfections?\b/gi, '');
    t = t.replace(/\blower\s+micro-contrast\b/gi, 'natural contrast');

    t = t.replace(/:\s*[,;]/g, ':').replace(/,\s*[,;]/g, ',').replace(/;\s*;/g, ';');
    t = t.replace(/\s{2,}/g, ' ').trim();
    if (/[,;:]$/.test(t)) t = t.slice(0, -1).trim();
    return t;
}

/**
 * Grok 易把 bokeh／耀光／光圈片數字面畫成漂浮光球；送 Grok 前轉寫攝影參數英文句。
 */
function sanitizePromoCameraBlockForGrok(cameraBlock) {
    let s = String(cameraBlock || '').trim();
    if (!s) return '';

    const clauses = s.split(/\.\s+/).map(stripGrokHeavyOpticsClause).filter(Boolean);
    s = clauses.join('. ');

    const liteGuard = GROK_CAMERA_OPTICS_LITE;
    const guardRe = new RegExp(liteGuard.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:\\.\\s*)?', 'gi');
    if (guardRe.test(s)) {
        s = s.replace(guardRe, '').trim();
        s = (s ? s + '. ' : '') + liteGuard;
    }

    if (/\b(?:lens|optical\s+character|vintage|prime|telephoto)\b/i.test(s)) {
        s += ' No added lens flare, light spots, ghosting, or bright bokeh orbs in the scene.';
    }

    return s.replace(/\s{2,}/g, ' ').replace(/\.\s*\./g, '.').trim();
}

function buildPortraitGrokOpticsNegativeGuard() {
    return (
        'Optics (mandatory): depth of field and background blur are subtle lens effects only—'
        + 'do NOT add lens flare, sun stars, anamorphic streaks, ghosting, light leaks, or bright specular orbs. '
        + 'No soap bubbles, floating spheres, bubble overlays, lens-shaped objects, or visible bokeh highlight shapes as physical elements. '
        + 'Do not add new particles, glitter spheres, or iridescent balls. '
        + 'Preserve <IMAGE_0> background content exactly aside from the integrated person.'
    );
}

/**
 * Grok 放人：場景為 <IMAGE_0> 底圖、人像為 <IMAGE_1> 身份參考（與 Gemini 混合的圖序相反，對齊 xAI 以首圖為編輯底圖）。
 */
function buildPortraitStylingGrokSwapLead() {
    return (
        'Single unified commercial photograph in one continuous shot. '
        + '<IMAGE_0> is the empty scene plate—preserve its composition, perspective, architecture, ground plane, and lighting exactly; do not pan, crop, or repaint the environment. '
        + '<IMAGE_1> is identity only (face, body type, likeness)—do not paste, overlay, or keep its rectangular crop or background. '
        + 'Composite one complete person into <IMAGE_0>. '
        + 'Pose must belong in <IMAGE_0>: match scene perspective, furniture height, and the subject placement area; do not reuse limb positions, stance, or framing from <IMAGE_1>. '
        + 'Edge transitions must follow <IMAGE_0> optics only: depth of field, atmospheric haze, ambient color bleed on silhouettes, and rim light from the scene—never a generic blur halo unrelated to the environment. '
        + 'Feather hair strands, shoulders, sleeves, and garment hem so edge softness matches scene sharpness; no sticker outlines, hard cutout, white fringe, or visible paste boundary. '
        + 'Re-light the person entirely from <IMAGE_0>: key light direction, shadow length and softness, ambient bounce, color temperature, contrast, and depth of field must match the empty scene; no studio lighting carried over from <IMAGE_1>. '
        + 'Correct contact shadows and ambient occlusion where the body meets floors, seats, or props in <IMAGE_0>.'
    );
}

function buildPortraitStylingGrokSwapClosing(mode) {
    const m = normalizePortraitStylingMode(mode);
    const blend = (
        'Place a complete person into <IMAGE_0>, ***Ignore the original pose***; <IMAGE_1> is face and body reference only—do not keep its crop box, rectangular border, sticker, or layers. '
        + 'Match contact shadows, bounce light, color temperature, and perspective to <IMAGE_0>. '
        + 'Edge transitions must match <IMAGE_0> depth of field, atmosphere, and ambient color—not generic feathering; no hard cut-and-paste. '
        + 'Skin and garment tones must share the same color grade as <IMAGE_0>; the person must not look brighter, flatter, or more cut out than the scene.'
    );
    if (m === 'reference') {
        return 'Result: person and body from <IMAGE_1>; clothing from the reference garment style and colors; ***Ignore the original pose***; commercial framing; scene from <IMAGE_0>. ' + blend;
    }
    if (m === 'scene') {
        return 'Result: person and body from <IMAGE_1>; clothing from the theme and scene; ***Ignore the original pose***; commercial framing; scene from <IMAGE_0>. ' + blend;
    }
    return 'Result: person and body from <IMAGE_1>; clothing from the description; ***Ignore the original pose***; commercial framing; scene from <IMAGE_0>. ' + blend;
}

function buildPortraitGrokSwapCaptions(stylingMode) {
    return {
        sceneLabel: 'empty scene base (no people; keep composition, light, and environment exactly)',
        personLabel: 'identity reference only (face and body; do not keep crop box or background)',
        lead: buildPortraitStylingGrokSwapLead(),
        closing: buildPortraitStylingGrokSwapClosing(stylingMode)
    };
}

/** 氛圍／混合「貼人」中文句（buildPromoPortraitMoodFaceRefinePrompt） */
function buildPortraitStylingMoodFaceLines(mode, userPrompt) {
    const m = normalizePortraitStylingMode(mode);
    const user = String(userPrompt || '').trim();
    const lines = [];
    if (user && m === 'reference') {
        lines.push('Description may adjust hair, expression, and pose (keep the upload outfit): ' + user);
    } else if (user && m === 'scene') {
        lines.push('Pose and expression may follow the description (clothing from theme and scene): ' + user);
    }
    if (m === 'reference') {
        lines.push('Keep the garment style and colors from the reference.');
        lines.push(buildPortraitCommercialPrincipleZh(m));
    } else if (m === 'scene') {
        lines.push('Clothing follows the shoot theme and scene; do not use clothes from the upload.');
        lines.push(buildPortraitCommercialPrincipleZh(m));
    } else {
        lines.push('Clothing follows the description; do not use clothes from the upload' + (user ? ': ' + user : '.'));
        lines.push(buildPortraitCommercialPrincipleZh(m));
    }
    return lines;
}

module.exports = {
    normalizePortraitStylingMode,
    resolvePortraitStylingFromBody,
    assertPortraitStylingPromptRequired,
    buildPortraitPoseBySceneGeminiLine,
    buildPortraitIgnoreRefPoseEmphasisLine,
    buildPortraitIgnoreRefPoseTrailingLine,
    buildPortraitFluxExperimentPriorityLead,
    buildPortraitFluxExperimentCompositionLine,
    buildPortraitCommercialPrincipleZh,
    buildPortraitStylingGeminiLead,
    buildPortraitStylingHybridSwapLead,
    buildPortraitStylingMoodSwapClosing,
    buildPortraitStylingGrokSwapLead,
    buildPortraitStylingGrokSwapClosing,
    buildPortraitGrokSwapCaptions,
    sanitizePromoCameraBlockForGrok,
    buildPortraitGrokOpticsNegativeGuard,
    buildPortraitStylingMoodFaceLines
};
