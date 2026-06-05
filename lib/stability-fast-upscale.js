'use strict';

const sharp = require('sharp');

const ONE_MP = 1024 * 1024;
const UPSCALE_FACTOR = 4;
/** 素材頁：僅當原圖 < 0.5 MP 才提供放大；輸出依原圖比例、總像素最高 1MP */
const VENDOR_UPSCALE_MIN_MP = 0.5;
const VENDOR_MATERIALS_MAX_OUTPUT_MP = 1;
const AI_EDIT_UPSCALE_PAGE = '/client/ai-edit.html';

/**
 * 是否可在素材頁做 Fast 4×（原圖 ≥0.5 MP 則改引導至 AI 編輯區）
 * @returns {{ needed: boolean, megapixels: number, width: number, height: number, reason?: string, ai_edit_url?: string }}
 */
function evaluateVendorUpscaleNeed(width, height) {
    const w = Math.max(0, parseInt(width, 10) || 0);
    const h = Math.max(0, parseInt(height, 10) || 0);
    const px = w * h;
    const mp = px / ONE_MP;
    if (w <= 0 || h <= 0) {
        return { needed: false, megapixels: 0, width: w, height: h, reason: 'invalid_dimensions' };
    }
    if (mp >= VENDOR_UPSCALE_MIN_MP) {
        return {
            needed: false,
            megapixels: mp,
            width: w,
            height: h,
            reason: 'above_min_mp_threshold',
            ai_edit_url: AI_EDIT_UPSCALE_PAGE
        };
    }
    return { needed: true, megapixels: mp, width: w, height: h };
}

function vendorUpscaleRejectMessage(evalResult) {
    const mpText = evalResult.megapixels > 0 ? evalResult.megapixels.toFixed(2) : '';
    if (mpText) {
        return '圖片約 ' + mpText + ' MP（已 ≥0.5 MP），素材頁僅支援小圖放大；請至「我的 AI 編輯區」放大（4×，≤4MP）';
    }
    return '圖片已 ≥0.5 MP，請至「我的 AI 編輯區」放大（4×，≤4MP）';
}

/** 等比縮放至總像素不超過 maxMp（不拉長變形） */
async function capImageBufferToMaxMpPreserveAspect(buffer, maxMp) {
    const maxOutPx = Math.floor(Math.max(0.25, Number(maxMp) || 1) * ONE_MP);
    const meta = await sharp(buffer, { failOn: 'none' }).metadata();
    let ow = meta.width || 0;
    let oh = meta.height || 0;
    if (ow <= 0 || oh <= 0 || ow * oh <= maxOutPx) {
        return { buffer, width: ow, height: oh, mimetype: 'image/jpeg' };
    }
    const scale = Math.sqrt(maxOutPx / (ow * oh));
    const newW = Math.max(1, Math.floor(ow * scale));
    const newH = Math.max(1, Math.floor(oh * scale));
    const outBuf = await sharp(buffer, { failOn: 'none' })
        .rotate()
        .resize(newW, newH, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 90, mozjpeg: true })
        .toBuffer();
    return { buffer: outBuf, width: newW, height: newH, mimetype: 'image/jpeg' };
}

/** 素材頁：Stability Fast 後再確保等比、最高 1MP */
async function vendorMaterialUpscale(buffer, mimetype, apiKey) {
    const upscaled = await stabilityFastUpscale(buffer, mimetype, apiKey, {
        maxOutputMp: VENDOR_MATERIALS_MAX_OUTPUT_MP
    });
    const capped = await capImageBufferToMaxMpPreserveAspect(upscaled.buffer, VENDOR_MATERIALS_MAX_OUTPUT_MP);
    return {
        buffer: capped.buffer,
        mimetype: capped.mimetype,
        width: capped.width,
        height: capped.height
    };
}

async function evaluateVendorUpscaleNeedFromBuffer(buffer, maxOutputMp) {
    try {
        const meta = await sharp(buffer, { failOn: 'none' }).metadata();
        return evaluateVendorUpscaleNeed(meta.width, meta.height);
    } catch (_) {
        return evaluateVendorUpscaleNeed(0, 0);
    }
}

/**
 * Stability Fast Upscaler：固定 4×；可選輸出總像素上限（MP）。
 * @param {Buffer} buffer
 * @param {string} mimetype
 * @param {string} apiKey
 * @param {{ maxOutputMp?: number }} [opts] — 預設 4（AI 編輯區）；素材頁請傳 1
 * @returns {Promise<{ buffer: Buffer, mimetype: string, width: number, height: number }>}
 */
async function stabilityFastUpscale(buffer, mimetype, apiKey, opts) {
    const maxOutputMp = Math.max(0.25, Number(opts && opts.maxOutputMp) || 4);
    const maxOutPx = Math.floor(maxOutputMp * ONE_MP);
    const maxInPx = Math.floor(maxOutPx / (UPSCALE_FACTOR * UPSCALE_FACTOR));

    let inputBuf = buffer;
    let inputMime = mimetype || 'image/jpeg';
    const metaIn = await sharp(buffer, { failOn: 'none' }).metadata();
    const iw = metaIn.width || 0;
    const ih = metaIn.height || 0;
    if (iw > 0 && ih > 0 && iw * ih > maxInPx) {
        const scale = Math.sqrt(maxInPx / (iw * ih));
        const newW = Math.max(1, Math.floor(iw * scale));
        const newH = Math.max(1, Math.floor(ih * scale));
        inputBuf = await sharp(buffer, { failOn: 'none' })
            .rotate()
            .resize(newW, newH, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 90, mozjpeg: true })
            .toBuffer();
        inputMime = 'image/jpeg';
    }

    const form = new FormData();
    form.append('image', new Blob([inputBuf], { type: inputMime }), 'upscale-input.jpg');
    const stabilityRes = await fetch('https://api.stability.ai/v2beta/stable-image/upscale/fast', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + apiKey },
        body: form
    });
    if (!stabilityRes.ok) {
        const errText = await stabilityRes.text();
        const err = new Error('Stability upscale failed');
        err.status = stabilityRes.status;
        err.details = errText.slice(0, 300);
        throw err;
    }

    let outBuf;
    const contentType = stabilityRes.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
        const json = await stabilityRes.json();
        const artifact = json.artifacts && json.artifacts[0];
        const b64 = (artifact && artifact.base64) || json.image;
        if (!b64) throw new Error('無法解析放大結果');
        outBuf = Buffer.from(b64, 'base64');
    } else {
        outBuf = Buffer.from(await stabilityRes.arrayBuffer());
    }

    const capped = await capImageBufferToMaxMpPreserveAspect(outBuf, maxOutputMp);
    return {
        buffer: capped.buffer,
        mimetype: capped.mimetype,
        width: capped.width,
        height: capped.height
    };
}

module.exports = {
    ONE_MP,
    UPSCALE_FACTOR,
    VENDOR_UPSCALE_MIN_MP,
    VENDOR_MATERIALS_MAX_OUTPUT_MP,
    AI_EDIT_UPSCALE_PAGE,
    evaluateVendorUpscaleNeed,
    evaluateVendorUpscaleNeedFromBuffer,
    vendorUpscaleRejectMessage,
    capImageBufferToMaxMpPreserveAspect,
    vendorMaterialUpscale,
    stabilityFastUpscale
};
