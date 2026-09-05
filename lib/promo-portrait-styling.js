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

function buildPortraitStylingGeminiLead(mode) {
    const m = normalizePortraitStylingMode(mode);
    if (m === 'reference') {
        return 'Preserve the same person\'s facial identity and likeness from reference image 1. '
            + 'Keep clothing, major accessories, and outfit from reference image 1; do not invent or swap outfits. '
            + 'User description may adjust hairstyle, expression, and small props only—not the main outfit.';
    }
    if (m === 'scene') {
        return 'Preserve the same person\'s facial identity and likeness from reference image 1. '
            + 'Clothing and styling should follow the shoot theme and scene environment; do not copy outfit from reference image 1.';
    }
    return 'Preserve the same person\'s facial identity and likeness from reference image 1. '
        + 'Clothing, hairstyle, accessories, and styling must follow the user description.';
}

function buildPortraitStylingMoodSwapClosing(mode) {
    const m = normalizePortraitStylingMode(mode);
    if (m === 'reference') {
        return '成品：人與體型＝第一張；衣服＝第一張；場景＝第二張。光影與邊緣自然過渡。';
    }
    if (m === 'scene') {
        return '成品：人與體型＝第一張；衣服依主題與場景；場景＝第二張。光影與邊緣自然過渡。';
    }
    return '成品：人與體型＝第一張；衣服依描述；場景＝第二張。光影與邊緣自然過渡。';
}

/** 氛圍／混合「貼人」中文句（buildPromoPortraitMoodFaceRefinePrompt） */
function buildPortraitStylingMoodFaceLines(mode, userPrompt) {
    const m = normalizePortraitStylingMode(mode);
    const user = String(userPrompt || '').trim();
    const lines = [];
    if (user && m === 'reference') {
        lines.push('髮型、表情與小道具可參考描述（服裝維持上傳圖）：' + user);
    } else if (user && m === 'scene') {
        lines.push('姿勢、表情等可參考描述（服裝依主題與場景）：' + user);
    }
    if (m === 'reference') {
        lines.push('衣服用第一張上傳圖那套，不要另外發明服裝。');
    } else if (m === 'scene') {
        lines.push('衣服依拍攝主題與場景決定，不要用上傳圖的衣服。');
    } else {
        lines.push('衣服依描述，不要用上傳圖的衣服' + (user ? '：' + user : '。'));
    }
    return lines;
}

module.exports = {
    normalizePortraitStylingMode,
    resolvePortraitStylingFromBody,
    assertPortraitStylingPromptRequired,
    buildPortraitStylingGeminiLead,
    buildPortraitStylingMoodSwapClosing,
    buildPortraitStylingMoodFaceLines
};
