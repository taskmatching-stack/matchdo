'use strict';

const sharp = require('sharp');

const MAX_PX = 1024;

/**
 * 材料 AI 優化前：僅最長邊 >1024 時等比縮小，不放大、維持原解析度。
 * @returns {Promise<{ buffer: Buffer, width: number, height: number, mimetype: string }>}
 */
async function prepareVendorMaterialFluxImage(buffer) {
    if (!buffer || !buffer.length) {
        throw new Error('無效的圖片');
    }
    const meta = await sharp(buffer, { failOn: 'none' }).rotate().metadata();
    const w = meta.width || 0;
    const h = meta.height || 0;
    if (w <= 0 || h <= 0) {
        throw new Error('無法讀取圖片尺寸');
    }
    const mimeFromMeta = (meta.format === 'jpeg' || meta.format === 'jpg') ? 'image/jpeg'
        : meta.format === 'png' ? 'image/png'
            : meta.format === 'webp' ? 'image/webp' : 'image/jpeg';
    if (w <= MAX_PX && h <= MAX_PX) {
        return { buffer, width: w, height: h, mimetype: mimeFromMeta };
    }
    const out = await sharp(buffer, { failOn: 'none' })
        .rotate()
        .resize(MAX_PX, MAX_PX, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 92, mozjpeg: true })
        .toBuffer();
    const outMeta = await sharp(out).metadata();
    return {
        buffer: out,
        width: outMeta.width || w,
        height: outMeta.height || h,
        mimetype: 'image/jpeg'
    };
}

const D2P_TARGET_PX = 1024;
const D2P_MAX_SIDE_PX = 2048;

/**
 * 寫實化專用：小圖（如 100×100）高品質放大到最長邊 1024，再送 BFL。
 * 直送極小圖時模型會亂發明紋理；官網 playground 對低解析圖稿可跑，行為對齊於此。
 * 極大圖僅縮到最長邊 2048；中等尺寸原樣。不用材料色卡那套重壓。
 */
async function prepareDesignToPhysicalFluxImage(buffer, mimeType) {
    if (!buffer || !buffer.length) {
        throw new Error('無效的圖片');
    }
    const meta = await sharp(buffer, { failOn: 'none' }).rotate().metadata();
    const w = meta.width || 0;
    const h = meta.height || 0;
    if (w <= 0 || h <= 0) {
        throw new Error('無法讀取圖片尺寸');
    }
    const mimeFromMeta = (meta.format === 'jpeg' || meta.format === 'jpg') ? 'image/jpeg'
        : meta.format === 'png' ? 'image/png'
            : meta.format === 'webp' ? 'image/webp' : 'image/jpeg';
    const mimeIn = String(mimeType || '').split(';')[0].trim() || mimeFromMeta;
    const maxSide = Math.max(w, h);

    if (maxSide < D2P_TARGET_PX) {
        const out = await sharp(buffer, { failOn: 'none' })
            .rotate()
            .resize(D2P_TARGET_PX, D2P_TARGET_PX, {
                fit: 'inside',
                withoutEnlargement: false,
                kernel: sharp.kernel.lanczos3
            })
            .png({ compressionLevel: 6 })
            .toBuffer();
        const outMeta = await sharp(out).metadata();
        return {
            buffer: out,
            width: outMeta.width || D2P_TARGET_PX,
            height: outMeta.height || D2P_TARGET_PX,
            mimetype: 'image/png',
            upscaled: true
        };
    }

    if (maxSide > D2P_MAX_SIDE_PX) {
        const out = await sharp(buffer, { failOn: 'none' })
            .rotate()
            .resize(D2P_MAX_SIDE_PX, D2P_MAX_SIDE_PX, {
                fit: 'inside',
                withoutEnlargement: true,
                kernel: sharp.kernel.lanczos3
            })
            .jpeg({ quality: 95, mozjpeg: true })
            .toBuffer();
        const outMeta = await sharp(out).metadata();
        return {
            buffer: out,
            width: outMeta.width || w,
            height: outMeta.height || h,
            mimetype: 'image/jpeg',
            upscaled: false
        };
    }

    return { buffer, width: w, height: h, mimetype: mimeIn, upscaled: false };
}

/**
 * 廠商素材上傳：僅在寬或高超過 1024 時等比縮小（最長邊 ≤1024、不放大）；
 * 已落在 1024×1024 以內則不處理，維持原檔。
 * @param {{ buffer: Buffer, mimetype?: string, originalname?: string }|null} file
 * @returns {Promise<{ buffer: Buffer, mimetype: string, originalname: string }|null>}
 */
async function normalizeVendorUploadFile(file) {
    if (!file || !file.buffer || !file.buffer.length) return file;

    const mime = (file.mimetype || '').toLowerCase();
    if (!mime.startsWith('image/')) return file;
    const needsJpegFallback = mime === 'image/avif' || mime === 'image/heif' || mime === 'image/heic';

    try {
        const meta = await sharp(file.buffer, { failOn: 'none' }).metadata();
        const w = meta.width || 0;
        const h = meta.height || 0;
        if (!needsJpegFallback && w > 0 && h > 0 && w <= MAX_PX && h <= MAX_PX) {
            return file;
        }

        const out = await sharp(file.buffer, { failOn: 'none' })
            .rotate()
            .resize(MAX_PX, MAX_PX, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 88, mozjpeg: true })
            .toBuffer();
        return {
            buffer: out,
            mimetype: 'image/jpeg',
            originalname: jpegName(file.originalname)
        };
    } catch (e) {
        console.warn('normalizeVendorUploadFile:', e.message);
        return file;
    }
}

function jpegName(originalname) {
    const base = (originalname || 'image').replace(/\.[^.]+$/, '') || 'image';
    return base + '.jpg';
}

function parseImageDataUrl(dataUrl) {
    const m = String(dataUrl || '').trim().match(/^data:(image\/[^;]+);base64,(.+)$/i);
    if (!m) return null;
    return { mime: m[1].toLowerCase(), base64: m[2] };
}

function needsJpegFallbackMime(mime) {
    return mime === 'image/avif' || mime === 'image/heif' || mime === 'image/heic';
}

/**
 * 設計頁／生圖 API：data URL 若為 AVIF／HEIC 等 Storage／BFL 不支援格式，轉成 JPEG data URL。
 * @param {string} dataUrl
 * @returns {Promise<string>}
 */
async function normalizeImageDataUrl(dataUrl) {
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) return dataUrl;
    const parsed = parseImageDataUrl(dataUrl);
    if (!parsed || !needsJpegFallbackMime(parsed.mime)) return dataUrl;
    try {
        const buf = Buffer.from(parsed.base64, 'base64');
        const normalized = await normalizeVendorUploadFile({
            buffer: buf,
            mimetype: parsed.mime,
            originalname: 'image.jpg'
        });
        if (!normalized || !normalized.buffer || normalized.mimetype === parsed.mime) return dataUrl;
        return `data:${normalized.mimetype};base64,${normalized.buffer.toString('base64')}`;
    } catch (e) {
        console.warn('normalizeImageDataUrl:', e.message);
        return dataUrl;
    }
}

/**
 * FLUX 參考圖陣列：逐一將 AVIF／HEIC data URL 轉 JPEG。
 * @param {string[]} referenceImages
 * @returns {Promise<string[]>}
 */
async function normalizeReferenceImagesForFlux(referenceImages) {
    if (!Array.isArray(referenceImages) || !referenceImages.length) return referenceImages || [];
    const out = [];
    for (const img of referenceImages) {
        if (typeof img === 'string' && img.startsWith('data:image/')) {
            out.push(await normalizeImageDataUrl(img));
        } else {
            out.push(img);
        }
    }
    return out;
}

module.exports = {
    MAX_PX,
    normalizeVendorUploadFile,
    normalizeImageDataUrl,
    normalizeReferenceImagesForFlux,
    prepareVendorMaterialFluxImage,
    prepareDesignToPhysicalFluxImage
};
