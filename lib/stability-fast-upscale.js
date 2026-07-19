'use strict';

const sharp = require('sharp');
const {
    realEsrganUpscale,
    normalizeUpscaleScale,
    DEFAULT_UPSCALE_SCALE
} = require('./replicate-real-esrgan');

const ONE_MP = 1024 * 1024;
const UPSCALE_FACTOR = 4;
/** Stability Fast：輸入總像素不得超過 1MP（僅舊 prepare 路徑；放大已改 Replicate） */
const STABILITY_FAST_MAX_INPUT_MP = 1;
const STABILITY_FAST_MIN_SIDE = 64;
/** 素材頁：僅當原圖 < 0.5 MP 才提供放大；輸出依原圖比例、總像素最高 1MP */
const VENDOR_UPSCALE_MIN_MP = 0.5;
const VENDOR_MATERIALS_MAX_OUTPUT_MP = 1;
/** AI 編輯區輸出上限（MP）；高倍數仍受此帽 */
const AI_EDIT_MAX_OUTPUT_MP = 16;
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

/**
 * 素材頁：Replicate Real-ESRGAN 後再確保等比、最高 1MP
 * @param {{ scale?: number }} [opts]
 */
async function vendorMaterialUpscale(buffer, mimetype, apiToken, opts) {
    const scale = normalizeUpscaleScale(opts && opts.scale);
    return realEsrganUpscale(buffer, mimetype, apiToken, {
        scale: scale,
        faceEnhance: false,
        maxOutputMp: VENDOR_MATERIALS_MAX_OUTPUT_MP,
        capFn: capImageBufferToMaxMpPreserveAspect
    });
}

async function evaluateVendorUpscaleNeedFromBuffer(buffer) {
    try {
        const meta = await sharp(buffer, { failOn: 'none' }).metadata();
        return evaluateVendorUpscaleNeed(meta.width, meta.height);
    } catch (_) {
        return evaluateVendorUpscaleNeed(0, 0);
    }
}

/**
 * 送 Stability Fast 前：轉 JPEG、輸入 ≤1MP、最短邊 ≥64px（官網輸入限制）
 */
async function prepareStabilityFastInput(buffer, mimetype) {
    const maxInputPx = Math.floor(STABILITY_FAST_MAX_INPUT_MP * ONE_MP);
    const meta = await sharp(buffer, { failOn: 'none' }).metadata();
    const w = meta.width || 0;
    const h = meta.height || 0;
    if (w <= 0 || h <= 0) {
        const err = new Error('無法讀取圖片尺寸');
        err.code = 'invalid_image';
        throw err;
    }
    const px = w * h;
    const minSide = Math.min(w, h);
    const mime = (mimetype || '').toLowerCase();
    const isJpeg = mime === 'image/jpeg' || mime === 'image/jpg';
    const withinInputLimit = px <= maxInputPx && minSide >= STABILITY_FAST_MIN_SIDE && isJpeg;
    if (withinInputLimit) {
        return { buffer, mimetype: 'image/jpeg', width: w, height: h };
    }

    let pipeline = sharp(buffer, { failOn: 'none' }).rotate();
    if (px > maxInputPx) {
        const scale = Math.sqrt(maxInputPx / px);
        const newW = Math.max(STABILITY_FAST_MIN_SIDE, Math.floor(w * scale));
        const newH = Math.max(STABILITY_FAST_MIN_SIDE, Math.floor(h * scale));
        pipeline = pipeline.resize(newW, newH, { fit: 'inside', withoutEnlargement: true });
    } else if (minSide < STABILITY_FAST_MIN_SIDE) {
        const scale = STABILITY_FAST_MIN_SIDE / minSide;
        pipeline = pipeline.resize(
            Math.max(STABILITY_FAST_MIN_SIDE, Math.ceil(w * scale)),
            Math.max(STABILITY_FAST_MIN_SIDE, Math.ceil(h * scale)),
            { fit: 'inside' }
        );
    }
    const outBuf = await pipeline.jpeg({ quality: 90, mozjpeg: true }).toBuffer();
    const outMeta = await sharp(outBuf, { failOn: 'none' }).metadata();
    return {
        buffer: outBuf,
        mimetype: 'image/jpeg',
        width: outMeta.width || 0,
        height: outMeta.height || 0
    };
}

function parseStabilityFastUpscaleJson(json) {
    if (json && json.errors && json.errors.length) {
        const err = new Error('Stability upscale failed');
        err.details = JSON.stringify(json.errors).slice(0, 300);
        throw err;
    }
    const finish = json && json.finish_reason;
    if (finish && String(finish).toUpperCase() !== 'SUCCESS') {
        const err = new Error('放大未完成：' + finish);
        err.details = JSON.stringify(json).slice(0, 300);
        throw err;
    }
    const artifact = json.artifacts && json.artifacts[0];
    const b64 = (artifact && artifact.base64) || json.image;
    if (!b64) {
        const err = new Error('無法解析放大結果');
        err.details = JSON.stringify(json).slice(0, 300);
        throw err;
    }
    return Buffer.from(b64, 'base64');
}

/**
 * AI 編輯區放大（舊名 stabilityFastUpscale）：改為 Replicate Real-ESRGAN。
 * @param {{ scale?: number, maxOutputMp?: number }} [opts] — 預設 2×；輸出上限預設 16MP
 */
async function stabilityFastUpscale(buffer, mimetype, apiToken, opts) {
    const scale = normalizeUpscaleScale(
        opts && opts.scale != null ? opts.scale : DEFAULT_UPSCALE_SCALE
    );
    const maxOutputMp = Math.max(0.25, Number(opts && opts.maxOutputMp) || AI_EDIT_MAX_OUTPUT_MP);
    return realEsrganUpscale(buffer, mimetype, apiToken, {
        scale: scale,
        faceEnhance: false,
        maxOutputMp: maxOutputMp,
        capFn: capImageBufferToMaxMpPreserveAspect
    });
}

module.exports = {
    ONE_MP,
    UPSCALE_FACTOR,
    VENDOR_UPSCALE_MIN_MP,
    VENDOR_MATERIALS_MAX_OUTPUT_MP,
    AI_EDIT_MAX_OUTPUT_MP,
    AI_EDIT_UPSCALE_PAGE,
    evaluateVendorUpscaleNeed,
    evaluateVendorUpscaleNeedFromBuffer,
    vendorUpscaleRejectMessage,
    capImageBufferToMaxMpPreserveAspect,
    prepareStabilityFastInput,
    vendorMaterialUpscale,
    stabilityFastUpscale,
    normalizeUpscaleScale,
    DEFAULT_UPSCALE_SCALE
};
