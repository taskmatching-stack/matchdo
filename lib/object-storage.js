/**
 * GCS media storage (Phase 1): mirror Supabase bucket/path layout under matchdo-media.
 * Public URLs: https://media.matchdo.cc/{supabaseBucket}/{pathPrefix}/file.jpg
 */
'use strict';

const { Storage } = require('@google-cloud/storage');

const GCS_MEDIA_BUCKET = String(process.env.GCS_MEDIA_BUCKET || 'matchdo-media').trim();
const GCS_PUBLIC_BASE_URL = String(process.env.GCS_PUBLIC_BASE_URL || 'https://media.matchdo.cc').trim().replace(/\/$/, '');

let storageClient = null;

function getStorageClient() {
    if (!storageClient) storageClient = new Storage();
    return storageClient;
}

/**
 * @param {string} supabaseBucket e.g. custom-products, project-images
 * @param {string} pathPrefix e.g. vendor-assets/uuid
 * @param {string} filename
 */
function buildObjectKey(supabaseBucket, pathPrefix, filename) {
    const bucketPart = String(supabaseBucket || '').replace(/^\/+|\/+$/g, '');
    const prefixPart = String(pathPrefix || '').replace(/^\/+|\/+$/g, '');
    const namePart = String(filename || '').replace(/^\/+/, '');
    if (!bucketPart || !namePart) throw new Error('GCS upload: bucket and filename required');
    const key = prefixPart ? `${bucketPart}/${prefixPart}/${namePart}` : `${bucketPart}/${namePart}`;
    return key.replace(/\/+/g, '/');
}

function publicUrlForObjectKey(objectKey) {
    const key = String(objectKey || '').replace(/^\/+/, '');
    return `${GCS_PUBLIC_BASE_URL}/${key}`;
}

/**
 * Parse media.matchdo.cc or legacy path to GCS object key (bucket/folder/file).
 * @param {string} url
 * @returns {string|null}
 */
function parseMediaUrlToObjectKey(url) {
    const raw = String(url || '').trim();
    if (!raw) return null;
    try {
        if (raw.startsWith('http://') || raw.startsWith('https://')) {
            const u = new URL(raw);
            const host = u.hostname.toLowerCase();
            if (host === 'media.matchdo.cc' || host.endsWith('.storage.googleapis.com')) {
                return u.pathname.replace(/^\/+/, '') || null;
            }
            return null;
        }
        return raw.replace(/^\/+/, '');
    } catch (_) {
        return null;
    }
}

/**
 * @param {string} supabaseBucket
 * @param {string} pathPrefix
 * @param {Buffer} buffer
 * @param {string} contentType
 * @param {string} filename
 * @returns {Promise<{ path: string, publicUrl: string }>}
 */
async function uploadToGcsMedia(supabaseBucket, pathPrefix, buffer, contentType, filename) {
    if (!buffer || !buffer.length) throw new Error('GCS upload: empty buffer');
    const objectKey = buildObjectKey(supabaseBucket, pathPrefix, filename);
    const gcsFile = getStorageClient().bucket(GCS_MEDIA_BUCKET).file(objectKey);
    await gcsFile.save(buffer, {
        resumable: false,
        metadata: {
            contentType: contentType || 'image/jpeg',
            cacheControl: 'public, max-age=3600'
        }
    });
    return { path: objectKey, publicUrl: publicUrlForObjectKey(objectKey) };
}

async function setGcsStorageClass(objectKey, storageClass) {
    const key = String(objectKey || '').replace(/^\/+/, '');
    if (!key) return { ok: false, error: 'empty_key' };
    const cls = String(storageClass || 'STANDARD').toUpperCase();
    try {
        const file = getStorageClient().bucket(GCS_MEDIA_BUCKET).file(key);
        const [exists] = await file.exists();
        if (!exists) return { ok: false, error: 'not_found' };
        await file.setStorageClass(cls);
        return { ok: true, storageClass: cls };
    } catch (e) {
        return { ok: false, error: e.message || String(e) };
    }
}

async function deleteGcsObject(objectKey) {
    const key = String(objectKey || '').replace(/^\/+/, '');
    if (!key) return { ok: false, error: 'empty_key' };
    try {
        const file = getStorageClient().bucket(GCS_MEDIA_BUCKET).file(key);
        const [exists] = await file.exists();
        if (!exists) return { ok: true, deleted: false };
        await file.delete({ ignoreNotFound: true });
        return { ok: true, deleted: true };
    } catch (e) {
        return { ok: false, error: e.message || String(e) };
    }
}

module.exports = {
    GCS_MEDIA_BUCKET,
    GCS_PUBLIC_BASE_URL,
    buildObjectKey,
    publicUrlForObjectKey,
    parseMediaUrlToObjectKey,
    uploadToGcsMedia,
    setGcsStorageClass,
    deleteGcsObject
};
