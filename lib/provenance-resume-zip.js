'use strict';

const { PassThrough } = require('stream');
const { safeExportBasename } = require('./provenance-resume');
const provenanceResumePdf = require('./provenance-resume-pdf');

const MAX_BATCH_ITEMS = 40;

/**
 * @param {Array<{ resume: object, audience?: string }>} entries
 * @returns {Promise<Buffer>}
 */
async function buildProvenanceResumeZip(entries, opts) {
    opts = opts || {};
    const audience = opts.audience || 'admin';
    const includePdf = opts.includePdf !== false;
    const list = (entries || []).filter(function (e) { return e && e.resume; });
    if (!list.length) throw new Error('無可匯出履歷');

    const archiverMod = await import('archiver');
    const archiver = archiverMod.default || archiverMod;

    return new Promise(function (resolve, reject) {
        const chunks = [];
        const out = new PassThrough();
        out.on('data', function (c) { chunks.push(c); });
        out.on('end', function () { resolve(Buffer.concat(chunks)); });
        out.on('error', reject);

        const archive = archiver('zip', { zlib: { level: 6 } });
        archive.on('error', reject);
        archive.pipe(out);

        (async function () {
            for (let i = 0; i < list.length; i++) {
                const resume = list[i].resume;
                const base = safeExportBasename(resume);
                archive.append(JSON.stringify(resume, null, 2), { name: base + '.json' });
                if (includePdf) {
                    const pdf = await provenanceResumePdf.generateProvenanceResumePdf(resume, { audience: audience });
                    archive.append(pdf, { name: base + '.pdf' });
                }
            }
            await archive.finalize();
        })().catch(reject);
    });
}

module.exports = {
    MAX_BATCH_ITEMS,
    buildProvenanceResumeZip
};
