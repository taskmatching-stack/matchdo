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
 * 圖後 trailing 請用 buildPortraitIgnoreRefPoseTrailingLine（只忽略姿勢，避免圖後再強調抄衣著）。
 */
function buildPortraitIgnoreRefPoseEmphasisLine(themeKey, mode) {
    const m = normalizePortraitStylingMode(mode);
    if (m === 'reference') {
        return '***忽略原圖姿勢***。服裝維持參考圖款式、色系、輪廓。';
    }
    return '***忽略原圖姿勢***。參考圖1只提供人物。';
}

/** 看完參考圖後只補忽略姿勢，三種衣著相同 */
function buildPortraitIgnoreRefPoseTrailingLine() {
    return '***忽略原圖姿勢***。';
}

/** 未填描述時不再指定姿勢 */
function buildPortraitPoseBySceneGeminiLine(themeKey) {
    return '';
}

/** 生圖原則：三種衣著都只複製人物＋忽略姿勢；依原圖另鎖服裝來源 */
function buildPortraitCommercialPrincipleZh(mode, themeKey) {
    const m = normalizePortraitStylingMode(mode);
    if (m === 'reference') {
        return '生圖原則（必須遵守）：只複製人物；服裝維持參考圖款式、色系、輪廓；***忽略原圖姿勢***，***不要情色感***。';
    }
    return '生圖原則（必須遵守）：只複製人物，***忽略原圖姿勢***，***不要情色感***。';
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
    const blend = '位置與第二張空間一致；在第二張裡重繪完整人物，***忽略原圖姿勢***，接觸點陰影正確；'
        + '第一張只作臉與身材參考，禁止保留裁切框、矩形邊界、貼紙或分層；'
        + '接觸陰影、環境反光、色溫、透視與場景一致；邊緣柔和過渡，不要生硬剪貼。';
    if (m === 'reference') {
        return '成品：人與體型＝第一張；衣服依參考圖款式色系；***忽略原圖姿勢***；構圖商用，***不要情色感***；場景＝第二張。' + blend;
    }
    if (m === 'scene') {
        return '成品：人與體型＝第一張；衣服依主題與場景；***忽略原圖姿勢***；構圖商用，***不要情色感***；場景＝第二張。' + blend;
    }
    return '成品：人與體型＝第一張；衣服依描述；***忽略原圖姿勢***；構圖商用，***不要情色感***；場景＝第二張。' + blend;
}

/** 氛圍／混合「貼人」中文句（buildPromoPortraitMoodFaceRefinePrompt） */
function buildPortraitStylingMoodFaceLines(mode, userPrompt) {
    const m = normalizePortraitStylingMode(mode);
    const user = String(userPrompt || '').trim();
    const lines = [];
    if (user && m === 'reference') {
        lines.push('描述可調髮型、表情與姿勢（服裝維持上傳圖）：' + user);
    } else if (user && m === 'scene') {
        lines.push('姿勢、表情等可參考描述（服裝依主題與場景）：' + user);
    }
    if (m === 'reference') {
        lines.push('衣服款式色系維持參考圖。');
        lines.push(buildPortraitCommercialPrincipleZh(m));
    } else if (m === 'scene') {
        lines.push('衣服依拍攝主題與場景決定，不要用上傳圖的衣服。');
        lines.push(buildPortraitCommercialPrincipleZh(m));
    } else {
        lines.push('衣服依描述，不要用上傳圖的衣服' + (user ? '：' + user : '。'));
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
