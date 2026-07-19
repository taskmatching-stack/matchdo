'use strict';

/**
 * Replicate nightmareai/real-esrgan
 * https://replicate.com/nightmareai/real-esrgan/api
 * scale: 2–10（本專案僅開放偶數階 2/4/6/8/10）
 */
const sharp = require('sharp');

const UPSCALE_SCALE_OPTIONS = [2, 4, 6, 8, 10];
const DEFAULT_UPSCALE_SCALE = 2;
/** pin version，避免 latest 靜默變更 */
const REAL_ESRGAN_VERSION =
    process.env.REPLICATE_REAL_ESRGAN_VERSION ||
    '42fed1c4974146d4d2414e2be2c5277c7fcf05fcc3a73abf41610695738c1d7b';
const PREDICT_URL = 'https://api.replicate.com/v1/predictions';
const POLL_MS = 1500;
const MAX_POLL_MS = 180000;

function normalizeUpscaleScale(raw) {
    const n = parseInt(raw, 10);
    return UPSCALE_SCALE_OPTIONS.includes(n) ? n : DEFAULT_UPSCALE_SCALE;
}

/**
 * 2× = base 點；每升一階（+2×）加 1 點 → 2/4/6/8/10 = base+0/+1/+2/+3/+4
 */
function pointsForUpscaleScale(basePoints, scale) {
    const base = Math.max(0, parseInt(basePoints, 10) || 1);
    const s = normalizeUpscaleScale(scale);
    return base + (s / 2 - 1);
}

function buildUpscalePointsByScale(basePoints) {
    const out = {};
    UPSCALE_SCALE_OPTIONS.forEach(function (s) {
        out[s] = pointsForUpscaleScale(basePoints, s);
    });
    return out;
}

/** Authorization 只能含 Latin-1；誤貼中文佔位會在 fetch 直接炸 */
function sanitizeReplicateToken(apiToken) {
    const token = String(apiToken || '').trim().replace(/^["']|["']$/g, '');
    if (!token) return null;
    if (!/^[\x21-\x7E]+$/.test(token)) return null;
    if (!/^r8_/i.test(token)) {
        // 仍允許非 r8_ 前綴的舊格式，但必須是 ASCII
        return token;
    }
    return token;
}

async function prepareImageDataUri(buffer, mimetype) {
    const mime = String(mimetype || '').toLowerCase();
    let buf = buffer;
    let outMime = 'image/jpeg';
    // 一律轉 JPEG，縮小 data-uri、避免 webp/png 相容問題
    try {
        buf = await sharp(buffer, { failOn: 'none' }).rotate().jpeg({ quality: 90, mozjpeg: true }).toBuffer();
        outMime = 'image/jpeg';
    } catch (_) {
        if (mime === 'image/png') outMime = 'image/png';
        else if (mime === 'image/webp') outMime = 'image/webp';
        else outMime = 'image/jpeg';
    }
    const b64 = Buffer.from(buf).toString('base64');
    return 'data:' + outMime + ';base64,' + b64;
}

async function sleep(ms) {
    return new Promise(function (resolve) {
        setTimeout(resolve, ms);
    });
}

/**
 * @param {Buffer} buffer
 * @param {string} mimetype
 * @param {string} apiToken
 * @param {{ scale?: number, faceEnhance?: boolean, maxOutputMp?: number, capFn?: Function }} [opts]
 */
async function realEsrganUpscale(buffer, mimetype, apiToken, opts) {
    const token = sanitizeReplicateToken(apiToken);
    if (!token) {
        const err = new Error(
            'REPLICATE_API_TOKEN 無效（須為純英文 r8_… token；勿貼中文說明）。請在 Cloud Run 重設環境變數。'
        );
        err.status = 503;
        err.details = 'invalid_or_non_ascii_token';
        throw err;
    }
    const scale = normalizeUpscaleScale(opts && opts.scale);
    const faceEnhance = !!(opts && opts.faceEnhance);
    const maxOutputMp = Math.max(0.25, Number(opts && opts.maxOutputMp) || 16);
    const image = await prepareImageDataUri(buffer, mimetype);

    let createRes;
    try {
        // 不用 Prefer: wait，避免 Cloud Run 請求逾時；改輪詢
        createRes = await fetch(PREDICT_URL, {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                version: REAL_ESRGAN_VERSION,
                input: {
                    image: image,
                    scale: scale,
                    face_enhance: faceEnhance
                }
            })
        });
    } catch (fetchErr) {
        const err = new Error('無法連線放大服務');
        err.status = 502;
        err.details = String((fetchErr && fetchErr.message) || fetchErr).slice(0, 300);
        throw err;
    }

    let prediction = await createRes.json().catch(function () {
        return null;
    });
    if (!createRes.ok) {
        const err = new Error('Replicate upscale failed');
        err.status = createRes.status;
        err.details = JSON.stringify(prediction || {}).slice(0, 400);
        throw err;
    }

    const started = Date.now();
    while (
        prediction &&
        prediction.status !== 'succeeded' &&
        prediction.status !== 'failed' &&
        prediction.status !== 'canceled'
    ) {
        if (Date.now() - started > MAX_POLL_MS) {
            const err = new Error('放大逾時，請稍後再試');
            err.status = 504;
            throw err;
        }
        await sleep(POLL_MS);
        const pollUrl = prediction.urls && prediction.urls.get ? prediction.urls.get : PREDICT_URL + '/' + prediction.id;
        const pollRes = await fetch(pollUrl, {
            headers: { Authorization: 'Bearer ' + token }
        });
        prediction = await pollRes.json().catch(function () {
            return null;
        });
        if (!pollRes.ok || !prediction) {
            const err = new Error('無法查詢放大進度');
            err.status = pollRes.status || 502;
            err.details = JSON.stringify(prediction || {}).slice(0, 300);
            throw err;
        }
    }

    if (!prediction || prediction.status !== 'succeeded') {
        const err = new Error('放大未完成');
        err.status = 502;
        err.details = ((prediction && (prediction.error || prediction.status)) || 'unknown').toString().slice(0, 300);
        throw err;
    }

    let outUrl = prediction.output;
    if (Array.isArray(outUrl)) outUrl = outUrl[0];
    if (!outUrl || typeof outUrl !== 'string') {
        const err = new Error('無法解析放大結果');
        err.status = 502;
        err.details = JSON.stringify(prediction).slice(0, 300);
        throw err;
    }

    const imgRes = await fetch(outUrl, { redirect: 'follow' });
    if (!imgRes.ok) {
        const err = new Error('無法下載放大結果');
        err.status = 502;
        err.details = 'download HTTP ' + imgRes.status;
        throw err;
    }
    const outBuf = Buffer.from(await imgRes.arrayBuffer());
    const outMime = (imgRes.headers.get('content-type') || 'image/jpeg').split(';')[0].trim() || 'image/jpeg';

    const capFn = opts && opts.capFn;
    if (typeof capFn === 'function') {
        const capped = await capFn(outBuf, maxOutputMp);
        return {
            buffer: capped.buffer,
            mimetype: capped.mimetype || 'image/jpeg',
            width: capped.width,
            height: capped.height,
            scale: scale
        };
    }

    const meta = await sharp(outBuf, { failOn: 'none' }).metadata();
    return {
        buffer: outBuf,
        mimetype: outMime,
        width: meta.width || 0,
        height: meta.height || 0,
        scale: scale
    };
}

module.exports = {
    UPSCALE_SCALE_OPTIONS,
    DEFAULT_UPSCALE_SCALE,
    REAL_ESRGAN_VERSION,
    normalizeUpscaleScale,
    pointsForUpscaleScale,
    buildUpscalePointsByScale,
    sanitizeReplicateToken,
    realEsrganUpscale
};
