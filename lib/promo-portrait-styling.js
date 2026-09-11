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

/** 未填描述時：首次生圖預設姿勢依場景（防 400）；證件照除外 */
function buildPortraitPoseBySceneGeminiLine(themeKey) {
    if (String(themeKey || '').trim() === 'portrait_formal_id') return '';
    return 'Pose follows the shoot theme and scene environment naturally (standing, sitting, or leaning as appropriate); '
        + 'do not copy pose from reference image 1.';
}

/** 三種衣著模式共用：商用構圖、避免情色感（英文） */
function buildPortraitCommercialFramingGeminiLine(mode) {
    const base = 'Commercial lifestyle portrait only: tasteful framing and a non-sexualized mood. '
        + 'Do not copy erotic or suggestive composition from reference image 1; '
        + 'reframe as a clean brand-safe portrait';
    if (normalizePortraitStylingMode(mode) === 'reference') {
        return base + ' while keeping the same garment.';
    }
    return base + '.';
}

/** 三種衣著模式共用：商用構圖、避免情色感（中文，氛圍／混合貼人） */
function buildPortraitCommercialFramingMoodLine(mode) {
    const core = '構圖預設商用生活人像，避免情色或過度挑逗感；不要照搬參考圖的煽情構圖';
    if (normalizePortraitStylingMode(mode) === 'reference') {
        return core + '，服裝款式色系仍維持上傳圖。';
    }
    return core + '。';
}

/** 依參考圖：鎖服裝 + 商用構圖（英文，清晰／Gemini） */
function buildPortraitReferenceGarmentGeminiLine() {
    return 'Keep the main garment outfit from reference image 1 (garment type, color palette, silhouette); do not invent or swap the core clothing. '
        + buildPortraitCommercialFramingGeminiLine('reference') + ' '
        + 'User description may adjust hairstyle, expression, and pose—not the main garment.';
}

function buildPortraitStylingGeminiLead(mode) {
    const m = normalizePortraitStylingMode(mode);
    if (m === 'reference') {
        return 'Preserve the same person\'s facial identity and likeness from reference image 1. '
            + buildPortraitReferenceGarmentGeminiLine();
    }
    if (m === 'scene') {
        return 'Preserve the same person\'s facial identity and likeness from reference image 1. '
            + 'Clothing and styling should follow the shoot theme and scene environment; do not copy outfit from reference image 1. '
            + buildPortraitCommercialFramingGeminiLine('scene');
    }
    return 'Preserve the same person\'s facial identity and likeness from reference image 1. '
        + 'Clothing, hairstyle, accessories, and styling must follow the user description. '
        + buildPortraitCommercialFramingGeminiLine('prompt');
}

/** 混合貼人：英文開場（對齊氛圍草稿的 Commercial portrait 整合句） */
function buildPortraitStylingHybridSwapLead() {
    return 'Single unified commercial photograph in one continuous shot. Reference image 1 is identity only (face, body type, likeness). '
        + 'Do not paste, overlay, or keep the rectangular crop of image 1. '
        + 'Re-render one complete person inside reference image 2 with a natural pose that fits the scene (standing, sitting, or leaning as appropriate). '
        + 'Correct contact shadows where the body meets the environment. '
        + 'Match lighting, shadows, perspective, depth of field, color grade, film grain, and soft edge transitions to image 2.';
}

function buildPortraitStylingMoodSwapClosing(mode) {
    const m = normalizePortraitStylingMode(mode);
    const blend = '位置與第二張空間一致；在第二張裡重繪完整人物，姿勢依場景自然（可站可坐可倚靠），接觸點陰影正確；'
        + '第一張只作臉與身材參考，禁止保留裁切框、矩形邊界、貼紙或分層；'
        + '接觸陰影、環境反光、色溫、透視與場景一致；邊緣柔和過渡，不要生硬剪貼。';
    if (m === 'reference') {
        return '成品：人與體型＝第一張；衣服（款式色系）＝第一張；構圖商用、避免情色挑逗感；場景＝第二張。' + blend;
    }
    if (m === 'scene') {
        return '成品：人與體型＝第一張；衣服依主題與場景；構圖商用、避免情色挑逗感；場景＝第二張。' + blend;
    }
    return '成品：人與體型＝第一張；衣服依描述；構圖商用、避免情色挑逗感；場景＝第二張。' + blend;
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
        lines.push('服裝款式色系維持上傳圖，不要另外發明服裝。');
    } else if (m === 'scene') {
        lines.push('衣服依拍攝主題與場景決定，不要用上傳圖的衣服。');
    } else {
        lines.push('衣服依描述，不要用上傳圖的衣服' + (user ? '：' + user : '。'));
    }
    lines.push(buildPortraitCommercialFramingMoodLine(m));
    return lines;
}

module.exports = {
    normalizePortraitStylingMode,
    resolvePortraitStylingFromBody,
    assertPortraitStylingPromptRequired,
    buildPortraitPoseBySceneGeminiLine,
    buildPortraitCommercialFramingGeminiLine,
    buildPortraitCommercialFramingMoodLine,
    buildPortraitStylingGeminiLead,
    buildPortraitStylingHybridSwapLead,
    buildPortraitStylingMoodSwapClosing,
    buildPortraitStylingMoodFaceLines
};
