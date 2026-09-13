'use strict';

/** xAI Grok Imagine：人像實驗模式用圖生圖（/v1/images/edits） */

const XAI_API_BASE = 'https://api.x.ai/v1';
const GROK_IMAGINE_MODEL_DEFAULT = 'grok-imagine-image-2.0';
const GROK_ASPECT_ALLOWED = new Set([
    '1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3',
    '2:1', '1:2', '19.5:9', '9:19.5', '20:9', '9:20', '21:9', '5:2', 'auto'
]);
const GROK_ASPECT_FALLBACK = {
    '3:1': '21:9',
    '4:1': '2:1',
    '9:21': '9:16',
    '1:3': '9:16',
    '1:4': '1:2'
};
/** /images/edits 多圖時 aspect_ratio 枚舉比文生圖窄（見 xAI Multi-Image Editing） */
const GROK_EDIT_MULTI_ASPECT_ALLOWED = new Set([
    '1:1', '3:4', '4:3', '16:9', '2:3', '3:2', '9:19.5', '19.5:9', '9:20', '20:9', '1:2'
]);
const GROK_EDIT_MULTI_ASPECT_FALLBACK = {
    '9:16': '9:19.5',
    '16:9': '16:9',
    '21:9': '20:9',
    '5:2': '20:9',
    '3:1': '20:9',
    '4:1': '20:9',
    '9:21': '9:20',
    '1:3': '1:2',
    '1:4': '1:2',
    '2:1': '20:9',
    '19.5:9': '19.5:9',
    'auto': '1:1'
};

function isPlausibleGrokImagineModelId(id) {
    return /^grok-imagine-image(?:-[a-z0-9][a-z0-9.-]*)?$/i.test(String(id || '').trim());
}

function normalizeGrokImagineModelId(raw, fallback) {
    const id = String(raw || '').trim();
    if (isPlausibleGrokImagineModelId(id)) return id;
    const fb = String(fallback || GROK_IMAGINE_MODEL_DEFAULT).trim();
    if (isPlausibleGrokImagineModelId(fb)) return fb;
    return GROK_IMAGINE_MODEL_DEFAULT;
}

function normalizeGrokImagineQuality(raw) {
    const q = String(raw || '').trim().toLowerCase();
    if (q === 'low' || q === 'medium' || q === 'auto') return q;
    return 'auto';
}

function normalizeGrokImagineResolution(tier) {
    const t = String(tier || '').trim().toLowerCase();
    if (t === '2k' || t === '4k' || t === '2048') return '2k';
    return '1k';
}

function normalizeGrokImagineAspectRatio(raw) {
    const r = String(raw || '1:1').trim();
    if (GROK_ASPECT_ALLOWED.has(r)) return r;
    if (GROK_ASPECT_FALLBACK[r]) return GROK_ASPECT_FALLBACK[r];
    return '1:1';
}

function normalizeGrokImagineEditMultiAspectRatio(raw) {
    const mapped = normalizeGrokImagineAspectRatio(raw);
    if (GROK_EDIT_MULTI_ASPECT_ALLOWED.has(mapped)) return mapped;
    if (GROK_EDIT_MULTI_ASPECT_FALLBACK[mapped]) return GROK_EDIT_MULTI_ASPECT_FALLBACK[mapped];
    return '1:1';
}

function toDataUri(ref) {
    if (!ref) return '';
    if (typeof ref === 'string') {
        const s = ref.trim();
        if (s.indexOf('data:image/') === 0) return s;
        if (s) return 'data:image/jpeg;base64,' + s.replace(/^data:[^;]+;base64,/, '');
        return '';
    }
    const b64 = String(ref.base64 || '').trim().replace(/^data:[^;]+;base64,/, '');
    if (!b64) return '';
    const mime = String(ref.mime || ref.mimeType || 'image/jpeg').split(';')[0] || 'image/jpeg';
    return 'data:' + mime + ';base64,' + b64;
}

function toXaiImageObject(ref) {
    const url = toDataUri(ref);
    if (!url) return null;
    return { url: url, type: 'image_url' };
}

function collectXaiImages(imageRefs) {
    const list = Array.isArray(imageRefs) ? imageRefs : [imageRefs];
    const out = [];
    list.forEach(function (ref) {
        const obj = toXaiImageObject(ref);
        if (obj) out.push(obj);
    });
    return out.slice(0, 5);
}

function isGrokImaginePolicyError(status, payload, text) {
    const code = String((payload && (payload.code || payload.error_code || (payload.error && payload.error.code))) || '').toLowerCase();
    const msg = String(
        (payload && (payload.message || payload.error || (payload.error && payload.error.message))) || text || ''
    ).toLowerCase();
    if (code === 'content_policy_violation' || code.indexOf('moderation') !== -1) return true;
    if (/content_policy|moderation|prohibited|safety|blocked|nsfw/.test(msg)) return true;
    if (Number(status) === 400 && /policy|moderation|safety|prohibited/.test(msg)) return true;
    return false;
}

function grokPolicyError(detail) {
    const err = new Error('Image generation blocked by content policy' + (detail ? ': ' + String(detail).slice(0, 180) : ''));
    err.status = 400;
    err.code = 'image_gen_blocked';
    return err;
}

function extractB64FromResponse(data) {
    if (!data || typeof data !== 'object') return '';
    const rows = Array.isArray(data.data) ? data.data : [];
    const first = rows[0] || data;
    if (first && first.b64_json) return String(first.b64_json).replace(/^data:[^;]+;base64,/, '');
    if (data.b64_json) return String(data.b64_json).replace(/^data:[^;]+;base64,/, '');
    return '';
}

function extractUrlFromResponse(data) {
    if (!data || typeof data !== 'object') return '';
    const rows = Array.isArray(data.data) ? data.data : [];
    const first = rows[0] || data;
    if (first && first.url) return String(first.url).trim();
    if (data.url) return String(data.url).trim();
    return '';
}

function moderationRejected(data) {
    if (!data || typeof data !== 'object') return false;
    if (data.respect_moderation === false) return true;
    const rows = Array.isArray(data.data) ? data.data : [];
    if (rows.length && rows[0] && rows[0].respect_moderation === false) return true;
    if (Array.isArray(data.data) && data.data.length === 0 && data.respect_moderation === false) return true;
    return false;
}

async function downloadImageBuffer(url) {
    const res = await fetch(url, { headers: { Accept: 'image/*,application/octet-stream' } });
    if (!res.ok) throw new Error('下載生圖結果失敗（' + res.status + '）');
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length) throw new Error('生圖結果為空');
    return buf;
}

/**
 * @param {object} opts
 * @param {string} opts.apiKey
 * @param {string} [opts.model]
 * @param {string} opts.prompt
 * @param {Array} opts.images
 * @param {string} [opts.aspectRatio]
 * @param {string} [opts.resolution] 1k|2k
 * @param {string} [opts.quality] low|medium|auto
 * @returns {Promise<{ buffer: Buffer, model: string, usage: object|null, respect_moderation: boolean }>}
 */
/** 文生圖（無參考圖）：寬鬆尺度僅人像參考時用，避免 edits 鎖住原圖姿勢。 */
async function generateImageWithGrokImagine(opts) {
    const o = opts && typeof opts === 'object' ? opts : {};
    const apiKey = String(o.apiKey || '').trim();
    if (!apiKey) {
        const err = new Error('情境圖服務暫未設定，請稍後再試');
        err.status = 503;
        throw err;
    }
    const prompt = String(o.prompt || '').trim();
    if (!prompt) throw new Error('人像提示詞為空');
    const model = normalizeGrokImagineModelId(o.model, GROK_IMAGINE_MODEL_DEFAULT);
    const body = {
        model: model,
        prompt: prompt,
        n: 1,
        response_format: 'b64_json',
        aspect_ratio: normalizeGrokImagineAspectRatio(o.aspectRatio || o.aspect_ratio),
        resolution: normalizeGrokImagineResolution(o.resolution || o.tier)
    };
    if (/grok-imagine-image-2/i.test(model)) {
        body.quality = normalizeGrokImagineQuality(o.quality);
    }

    const res = await fetch(XAI_API_BASE + '/images/generations', {
        method: 'POST',
        headers: {
            Authorization: 'Bearer ' + apiKey,
            'Content-Type': 'application/json',
            Accept: 'application/json'
        },
        body: JSON.stringify(body)
    });
    const rawText = await res.text();
    let payload = null;
    try {
        payload = rawText ? JSON.parse(rawText) : null;
    } catch (_) {
        payload = null;
    }
    if (!res.ok) {
        if (isGrokImaginePolicyError(res.status, payload, rawText)) {
            throw grokPolicyError(payload && (payload.message || payload.error));
        }
        const detail = payload && (payload.message || (payload.error && payload.error.message) || payload.error);
        const err = new Error(String(detail || ('生圖失敗（' + res.status + '）')).slice(0, 300));
        err.status = res.status >= 400 && res.status < 600 ? res.status : 502;
        throw err;
    }
    if (moderationRejected(payload)) {
        throw grokPolicyError('filtered');
    }
    let buffer = null;
    const b64 = extractB64FromResponse(payload);
    if (b64) buffer = Buffer.from(b64, 'base64');
    if (!buffer || !buffer.length) {
        const url = extractUrlFromResponse(payload);
        if (url) buffer = await downloadImageBuffer(url);
    }
    if (!buffer || !buffer.length) {
        throw grokPolicyError('empty output');
    }
    return {
        buffer: buffer,
        model: model,
        usage: payload && payload.usage ? payload.usage : null,
        respect_moderation: payload ? payload.respect_moderation !== false : true
    };
}

async function editImageWithGrokImagine(opts) {
    const o = opts && typeof opts === 'object' ? opts : {};
    const apiKey = String(o.apiKey || '').trim();
    if (!apiKey) {
        const err = new Error('情境圖服務暫未設定，請稍後再試');
        err.status = 503;
        throw err;
    }
    const prompt = String(o.prompt || '').trim();
    if (!prompt) throw new Error('人像提示詞為空');
    const images = collectXaiImages(o.images);
    if (!images.length) throw new Error('請上傳一張人像參考圖');
    const model = normalizeGrokImagineModelId(o.model, GROK_IMAGINE_MODEL_DEFAULT);
    const body = {
        model: model,
        prompt: prompt,
        n: 1,
        response_format: 'b64_json',
        resolution: normalizeGrokImagineResolution(o.resolution || o.tier)
    };
    if (images.length === 1) {
        body.image = images[0];
    } else {
        body.images = images;
        body.aspect_ratio = normalizeGrokImagineEditMultiAspectRatio(o.aspectRatio || o.aspect_ratio);
    }

    const res = await fetch(XAI_API_BASE + '/images/edits', {
        method: 'POST',
        headers: {
            Authorization: 'Bearer ' + apiKey,
            'Content-Type': 'application/json',
            Accept: 'application/json'
        },
        body: JSON.stringify(body)
    });
    const rawText = await res.text();
    let payload = null;
    try {
        payload = rawText ? JSON.parse(rawText) : null;
    } catch (_) {
        payload = null;
    }
    if (!res.ok) {
        if (isGrokImaginePolicyError(res.status, payload, rawText)) {
            throw grokPolicyError(payload && (payload.message || payload.error));
        }
        const detail = payload && (payload.message || (payload.error && payload.error.message) || payload.error);
        const err = new Error(String(detail || ('生圖失敗（' + res.status + '）')).slice(0, 300));
        err.status = res.status >= 400 && res.status < 600 ? res.status : 502;
        throw err;
    }
    if (moderationRejected(payload)) {
        throw grokPolicyError('filtered');
    }
    let buffer = null;
    const b64 = extractB64FromResponse(payload);
    if (b64) buffer = Buffer.from(b64, 'base64');
    if (!buffer || !buffer.length) {
        const url = extractUrlFromResponse(payload);
        if (url) buffer = await downloadImageBuffer(url);
    }
    if (!buffer || !buffer.length) {
        throw grokPolicyError('empty output');
    }
    return {
        buffer: buffer,
        model: model,
        usage: payload && payload.usage ? payload.usage : null,
        respect_moderation: payload ? payload.respect_moderation !== false : true
    };
}

/** 寬鬆尺度：場景／產品參考在前、人像在最後；衣著依 portrait_styling_mode，姿勢不跟原圖。 */
function orderGrokExperimentImageRefs(imageRefs) {
    const refs = (Array.isArray(imageRefs) ? imageRefs : []).filter(function (r) {
        return r && (r.base64 || typeof r === 'string');
    });
    if (refs.length <= 1) return refs;
    const person = refs[0];
    return refs.slice(1).concat([person]);
}

module.exports = {
    XAI_API_BASE,
    GROK_IMAGINE_MODEL_DEFAULT,
    isPlausibleGrokImagineModelId,
    normalizeGrokImagineModelId,
    normalizeGrokImagineQuality,
    normalizeGrokImagineResolution,
    normalizeGrokImagineAspectRatio,
    generateImageWithGrokImagine,
    editImageWithGrokImagine,
    orderGrokExperimentImageRefs
};
