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

    try {
        const meta = await sharp(file.buffer, { failOn: 'none' }).metadata();
        const w = meta.width || 0;
        const h = meta.height || 0;
        if (w > 0 && h > 0 && w <= MAX_PX && h <= MAX_PX) {
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

module.exports = {
    MAX_PX,
    normalizeVendorUploadFile,
    prepareVendorMaterialFluxImage
};
