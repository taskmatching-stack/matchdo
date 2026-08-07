'use strict';

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const sharp = require('sharp');
const { safeExportBasename, DISCLAIMER_ZH } = require('./provenance-resume');

const MARGIN = 48;
const REF_COLS = 3;
const REF_IMG_H = 72;

function resolvePdfFontPath() {
    const candidates = [
        path.join(__dirname, '..', 'assets', 'fonts', 'NotoSansTC-Regular.otf'),
        '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
        '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc'
    ];
    for (let i = 0; i < candidates.length; i++) {
        if (fs.existsSync(candidates[i])) return candidates[i];
    }
    return null;
}

function registerPdfFont(doc) {
    const fontPath = resolvePdfFontPath();
    if (!fontPath) return 'Helvetica';
    try {
        if (fontPath.endsWith('.ttc')) {
            doc.registerFont('CJK', fontPath, 'NotoSansCJK-Regular');
        } else {
            doc.registerFont('CJK', fontPath);
        }
        return 'CJK';
    } catch (e) {
        console.warn('provenance-resume-pdf: font register failed', e.message);
        return 'Helvetica';
    }
}

async function fetchImageForPdf(url) {
    const u = String(url || '').trim();
    if (!u) return null;
    try {
        const res = await fetch(u, { signal: AbortSignal.timeout(20000) });
        if (!res.ok) return null;
        const buf = Buffer.from(await res.arrayBuffer());
        return sharp(buf).rotate().jpeg({ quality: 82 }).toBuffer();
    } catch (e) {
        console.warn('provenance-resume-pdf: image fetch failed', u.slice(0, 80), e.message);
        return null;
    }
}

function fmtTime(iso) {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString('zh-TW', { hour12: false, timeZone: 'Asia/Taipei' });
    } catch (_) {
        return String(iso).slice(0, 19);
    }
}

function ensureSpace(doc, needed) {
    if (doc.y + needed > doc.page.height - MARGIN - 28) {
        doc.addPage();
    }
}

function writeLine(doc, font, label, value) {
    ensureSpace(doc, 20);
    doc.font(font).fontSize(9).fillColor('#555555').text(label, MARGIN, doc.y, { continued: true, width: 110 });
    doc.fillColor('#000000').text(String(value != null && value !== '' ? value : '—'), { width: doc.page.width - MARGIN * 2 - 110 });
    doc.moveDown(0.15);
}

function writeMaterialComboSection(doc, font, mc) {
    if (!mc || typeof mc !== 'object') return;
    const mainMat = mc.main_material || (mc.main && mc.main.material);
    const accentMat = mc.accent_material || (mc.accent && mc.accent.material);
    const thirdMat = mc.third_material || (mc.third && mc.third.material);
    const mainHex = mc.main_hex || (mc.main && mc.main.hex);
    const accentHex = mc.accent_hex || (mc.accent && mc.accent.hex);
    const thirdHex = mc.third_hex || (mc.third && mc.third.hex);
    const boundary = mc.boundary || null;
    const ratio = Array.isArray(mc.ratio_percents) && mc.ratio_percents.length
        ? mc.ratio_percents.join(' / ')
        : null;
    if (!mainMat && !accentMat && !mainHex && !accentHex && !boundary) return;
    doc.moveDown(0.3);
    doc.font(font).fontSize(11).text('材料組合');
    if (mainHex || mainMat) writeLine(doc, font, '主色', [mainHex, mainMat].filter(Boolean).join(' · '));
    if (accentHex || accentMat) writeLine(doc, font, '配色', [accentHex, accentMat].filter(Boolean).join(' · '));
    if (thirdHex || thirdMat) writeLine(doc, font, '輔色', [thirdHex, thirdMat].filter(Boolean).join(' · '));
    if (ratio) writeLine(doc, font, '比重', ratio + '%');
    if (boundary) writeLine(doc, font, '分界處', boundary);
    if (mc.palette_name || (mc.source_palette && mc.source_palette.name)) {
        writeLine(doc, font, '配色來源', mc.palette_name || (mc.source_palette && mc.source_palette.name));
    }
}

async function drawReferenceGrid(doc, refs, font) {
    const items = (refs || []).filter(function (r) { return r && r.image_url; });
    if (!items.length) {
        doc.font(font).fontSize(9).fillColor('#888888').text('（無參考圖記錄）');
        doc.moveDown(0.5);
        return;
    }
    const contentW = doc.page.width - MARGIN * 2;
    const cellW = contentW / REF_COLS;
    const rowH = REF_IMG_H + 28;
    let col = 0;
    let rowY = doc.y;

    for (let i = 0; i < items.length; i++) {
        if (rowY + rowH > doc.page.height - MARGIN - 24) {
            doc.addPage();
            rowY = doc.y;
            col = 0;
        }
        const it = items[i];
        const x = MARGIN + col * cellW + 4;
        const y = rowY;
        const buf = await fetchImageForPdf(it.image_url);
        if (buf) {
            try {
                doc.image(buf, x, y, { fit: [cellW - 8, REF_IMG_H], align: 'center', valign: 'center' });
            } catch (_) {
                doc.rect(x, y, cellW - 8, REF_IMG_H).stroke('#cccccc');
            }
        } else {
            doc.rect(x, y, cellW - 8, REF_IMG_H).stroke('#cccccc');
        }
        const lab = (it.ref_kind_label || '參考') + (it.title ? (' · ' + it.title) : '');
        doc.font(font).fontSize(7).fillColor('#333333').text(lab, x, y + REF_IMG_H + 2, {
            width: cellW - 8,
            align: 'center',
            lineBreak: true
        });
        col++;
        if (col >= REF_COLS) {
            col = 0;
            rowY += rowH;
            doc.y = rowY;
        }
    }
    if (col > 0) doc.y = rowY + rowH;
    doc.moveDown(0.4);
}

async function generateProvenanceResumePdf(resume, opts) {
    if (!resume || !resume.record_id) throw new Error('missing resume');

    return new Promise(function (resolve, reject) {
        const doc = new PDFDocument({
            size: 'A4',
            margin: MARGIN,
            info: {
                Title: safeExportBasename(resume) + ' - MATCHDO',
                Author: 'MATCHDO'
            }
        });
        const chunks = [];
        doc.on('data', function (c) { chunks.push(c); });
        doc.on('end', function () { resolve(Buffer.concat(chunks)); });
        doc.on('error', reject);

        (async function () {
            try {
                const font = registerPdfFont(doc);
                const audience = (opts && opts.audience) || 'owner';

                doc.font(font).fontSize(16).fillColor('#0f766e').text('MatchDO 生圖履歷');
                doc.font(font).fontSize(11).fillColor('#333333').text(resume.title || '—');
                doc.moveDown(0.3);

                const outUrl = resume.image && resume.image.output_url;
                if (outUrl) {
                    const mainBuf = await fetchImageForPdf(outUrl);
                    if (mainBuf) {
                        try {
                            const maxW = doc.page.width - MARGIN * 2;
                            doc.image(mainBuf, MARGIN, doc.y, { fit: [maxW, 200], align: 'center' });
                            doc.y += 204;
                        } catch (_) { /* skip */ }
                    }
                }

                doc.moveDown(0.4);
                doc.font(font).fontSize(11).fillColor('#000000').text('摘要');
                doc.moveDown(0.2);
                const ctx = resume.generation_context || {};
                writeLine(doc, font, '履歷編號', resume.record_id);
                writeLine(doc, font, '類型', resume.asset_kind);
                writeLine(doc, font, '生成入口', ctx.entry_surface_label || ctx.entry_surface);
                writeLine(doc, font, '生成時間', fmtTime(resume.timestamps && resume.timestamps.created_at));
                if (resume.timestamps && resume.timestamps.completed_at && resume.timestamps.completed_at !== resume.timestamps.created_at) {
                    writeLine(doc, font, '完成時間', fmtTime(resume.timestamps.completed_at));
                }
                writeLine(doc, font, '消耗點數', resume.billing && resume.billing.points_charged != null ? resume.billing.points_charged : '—');
                if (resume.provenance_links && resume.provenance_links.inspiration_url) {
                    writeLine(doc, font, '靈感牆', resume.provenance_links.inspiration_url);
                }

                if (audience === 'admin' && resume.actor) {
                    writeLine(doc, font, '帳號', resume.actor.email || resume.actor.user_id || '—');
                }

                doc.moveDown(0.4);
                doc.font(font).fontSize(11).text('參考來源');
                doc.moveDown(0.2);
                await drawReferenceGrid(doc, resume.references, font);

                doc.font(font).fontSize(11).fillColor('#000000').text('Prompt');
                doc.moveDown(0.15);
                const prompts = resume.prompts || {};
                writeLine(doc, font, '使用者描述', prompts.user_prompt);
                if (prompts.final_prompt && prompts.final_prompt !== prompts.user_prompt) {
                    writeLine(doc, font, '最終 prompt', (prompts.final_prompt || '').slice(0, 800));
                }
                if (prompts.seed != null) writeLine(doc, font, 'Seed', prompts.seed);

                if (ctx.camera_params && ctx.camera_params.length) {
                    doc.moveDown(0.3);
                    doc.font(font).fontSize(11).text('商攝參數');
                    ctx.camera_params.forEach(function (p) {
                        writeLine(doc, font, p.category_label, p.name);
                    });
                }

                const mc = ctx.material_combo_summary || ctx.material_combo;
                writeMaterialComboSection(doc, font, mc);
                if (Array.isArray(ctx.material_combos) && ctx.material_combos.length > 1) {
                    ctx.material_combos.slice(1).forEach(function (extra, idx) {
                        doc.moveDown(0.15);
                        doc.font(font).fontSize(10).text('材料組合（參考 ' + (idx + 2) + '）');
                        writeMaterialComboSection(doc, font, extra);
                    });
                }

                if (ctx.print_meta && typeof ctx.print_meta === 'object') {
                    doc.moveDown(0.3);
                    doc.font(font).fontSize(11).text('印花');
                    if (ctx.print_meta.print_type) writeLine(doc, font, '類型', ctx.print_meta.print_type);
                    if (ctx.print_meta.source_kind) writeLine(doc, font, '來源', ctx.print_meta.source_kind === 'redraw' ? 'AI 重繪' : '原圖');
                }

                if (ctx.referrer_host) {
                    writeLine(doc, font, 'Embed 來源網域', ctx.referrer_host);
                }

                if (audience === 'admin' && resume._internal) {
                    doc.moveDown(0.4);
                    doc.font(font).fontSize(9).fillColor('#666666').text('（內部）媒體牆公開：' + (resume._internal.show_on_homepage ? '是' : '否'));
                    if (resume._internal.is_vendor_self_serve != null) {
                        doc.text('（內部）廠商自產：' + (resume._internal.is_vendor_self_serve ? '是' : '否'));
                    }
                }

                doc.moveDown(0.8);
                ensureSpace(doc, 36);
                doc.font(font).fontSize(7).fillColor('#888888').text(
                    DISCLAIMER_ZH + '\n匯出：' + fmtTime(resume.timestamps && resume.timestamps.exported_at) +
                    ' · ID ' + resume.record_id
                );
                doc.end();
            } catch (e) {
                reject(e);
            }
        })();
    });
}

function safePdfFilename(resume) {
    return safeExportBasename(resume) + '.pdf';
}

module.exports = {
    generateProvenanceResumePdf,
    safePdfFilename
};
