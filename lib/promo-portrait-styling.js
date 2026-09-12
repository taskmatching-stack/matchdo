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

/** 未填描述時不再指定姿勢 */
function buildPortraitPoseBySceneGeminiLine(themeKey) {
    return '';
}

/** 生圖原則：依場景／依描述只複製人物；依原圖複製人物與服裝（英文關鍵指令） */
function buildPortraitCommercialPrincipleZh(mode, themeKey) {
    const m = normalizePortraitStylingMode(mode);
    if (m === 'reference') {
        return 'Generation rules (must follow): copy the person and the outfit from the reference; keep the garment type, color palette, and silhouette; ***Ignore the original pose***, ***no erotic tone***.';
    }
    return 'Generation rules (must follow): copy the person only, ***Ignore the original pose***, ***no erotic tone***.';
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

/** 混合貼人：英文開場（對齊氛圍草稿的 Commercial portrait 整合句） */
function buildPortraitStylingHybridSwapLead() {
    return 'Single unified commercial photograph in one continuous shot. Reference image 1 is identity only (face, body type, likeness). '
        + 'Do not paste, overlay, or keep the rectangular crop of image 1. '
        + 'Re-render one complete person inside reference image 2. '
        + 'Correct contact shadows where the body meets the environment. '
        + 'Match lighting, shadows, perspective, depth of field, color grade, film grain, and soft edge transitions to image 2.';
}

function buildPortraitStylingMoodSwapClosing(mode) {
    const m = normalizePortraitStylingMode(mode);
    const blend = 'Match placement to image 2; re-render a complete person in image 2, ***Ignore the original pose***, with correct contact shadows; '
        + 'image 1 is face and body reference only — do not keep the crop box, rectangular border, sticker, or layers; '
        + 'match contact shadows, bounce light, color temperature, and perspective to the scene; soft edges, no hard cut-and-paste.';
    if (m === 'reference') {
        return 'Result: person and body from image 1; clothing from the reference garment style and colors; ***Ignore the original pose***; commercial framing, ***no erotic tone***; scene from image 2. ' + blend;
    }
    if (m === 'scene') {
        return 'Result: person and body from image 1; clothing from the theme and scene; ***Ignore the original pose***; commercial framing, ***no erotic tone***; scene from image 2. ' + blend;
    }
    return 'Result: person and body from image 1; clothing from the description; ***Ignore the original pose***; commercial framing, ***no erotic tone***; scene from image 2. ' + blend;
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
    buildPortraitCommercialPrincipleZh,
    buildPortraitStylingGeminiLead,
    buildPortraitStylingHybridSwapLead,
    buildPortraitStylingMoodSwapClosing,
    buildPortraitStylingMoodFaceLines
};
