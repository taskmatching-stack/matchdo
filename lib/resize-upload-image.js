'use strict';

const sharp = require('sharp');

const MAX_PX = 1024;
/** 材料 FLUX 編輯：最短邊至少此值（BFL 小圖易失真／重畫紋理） */
const MATERIAL_FLUX_MIN_SIDE = 256;

function roundFluxDimension(px) {
    const n = Math.max(MATERIAL_FLUX_MIN_SIDE, Math.min(MAX_PX, Math.round(Number(px) || 0)));
    return Math.max(MATERIAL_FLUX_MIN_SIDE, Math.round(n / 16) * 16);
}

/**
 * 材料 FLUX 前：最短邊 ≥256（不足則等比放大）、最長邊 ≤1024；維持比例。
 * @returns {Promise<{ buffer: Buffer, width: number, height: number, mimetype: string }>}
 */
async function prepareVendorMaterialFluxImage(buffer) {
    if (!buffer || !buffer.length) {
        throw new Error('無效的圖片');
    }
    const meta = await sharp(buffer, { failOn: 'none' }).rotate().metadata();
    let w = meta.width || 0;
    let h = meta.height || 0;
    if (w <= 0 || h <= 0) {
        throw new Error('無法讀取圖片尺寸');
    }
    const minSide = Math.min(w, h);
    const maxSide = Math.max(w, h);
    let scale = 1;
    if (minSide < MATERIAL_FLUX_MIN_SIDE) {
        scale = MATERIAL_FLUX_MIN_SIDE / minSide;
    }
    if (maxSide * scale > MAX_PX) {
        scale = MAX_PX / maxSide;
    }
    let newW = Math.max(1, Math.round(w * scale));
    let newH = Math.max(1, Math.round(h * scale));
    newW = roundFluxDimension(newW);
    newH = roundFluxDimension(newH);
    if (newW === w && newH === h) {
        return { buffer, width: w, height: h, mimetype: 'image/jpeg' };
    }
    const out = await sharp(buffer, { failOn: 'none' })
        .rotate()
        .resize(newW, newH, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
        .jpeg({ quality: 92, mozjpeg: true })
        .toBuffer();
    return { buffer: out, width: newW, height: newH, mimetype: 'image/jpeg' };
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
    MATERIAL_FLUX_MIN_SIDE,
    normalizeVendorUploadFile,
    prepareVendorMaterialFluxImage,
    roundFluxDimension
};
