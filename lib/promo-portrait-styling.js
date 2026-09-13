'use strict';

function normalizePortraitStylingMode(raw) {
    const s = String(raw || '').trim().toLowerCase().replace(/-/g, '_');
    if (s === 'reference' || s === 'ref' || s === 'keep' || s === 'original') return 'reference';
    if (s === 'scene' || s === 'auto' || s === 'theme') return 'scene';
    if (s === 'prompt' || s === 'description' || s === 'desc') return 'prompt';
    return 'reference';
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
    buildPortraitStylingMoodFaceLines
};
