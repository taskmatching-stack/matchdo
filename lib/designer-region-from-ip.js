'use strict';

/**
 * 設計者國家／地區：僅依請求 IP（CDN 標頭或 geoip-lite），不強制使用者填寫。
 * 結果寫入 custom_products 快照；不對前端暴露（見 stripInternalCustomProductFields）。
 */

function getClientIp(req) {
    if (!req) return '';
    const xf = req.headers['x-forwarded-for'];
    if (xf) return String(xf).split(',')[0].trim();
    if (req.headers['x-real-ip']) return String(req.headers['x-real-ip']).trim();
    return (req.socket && req.socket.remoteAddress) || req.ip || '';
}

function maskIp(ip) {
    const s = (ip || '').trim();
    if (!s) return null;
    if (s.includes('.')) {
        const p = s.split('.');
        if (p.length === 4) return `${p[0]}.${p[1]}.x.x`;
    }
    if (s.includes(':')) return s.split(':').slice(0, 3).join(':') + ':…';
    return 'masked';
}

/** CDN / 平台常見國家標頭（ISO 3166-1 alpha-2） */
function countryFromHeaders(req) {
    if (!req || !req.headers) return { code: null, header: null };
    const pairs = [
        ['cf-ipcountry', 'CF-IPCountry'],
        ['x-appengine-country', 'X-AppEngine-Country'],
        ['cloudfront-viewer-country', 'CloudFront-Viewer-Country'],
        ['x-country-code', 'X-Country-Code']
    ];
    for (const [lower, name] of pairs) {
        const raw = req.headers[lower] || req.headers[name];
        if (!raw) continue;
        const code = String(raw).trim().toUpperCase();
        if (!code || code === 'XX' || code === 'T1') continue;
        return { code: code.slice(0, 2), header: lower };
    }
    return { code: null, header: null };
}

function countryFromGeoIpLite(ip) {
    const s = (ip || '').trim();
    if (!s || s === '::1' || s.startsWith('127.') || s.startsWith('10.') || s.startsWith('192.168.')) {
        return null;
    }
    try {
        const geoip = require('geoip-lite');
        const hit = geoip.lookup(s);
        return hit && hit.country ? String(hit.country).toUpperCase().slice(0, 2) : null;
    } catch (_) {
        return null;
    }
}

/**
 * @param {import('express').Request} req
 * @param {{ uiLocale?: string }} [opts]
 */
function resolveDesignerRegionFromRequest(req, opts = {}) {
    const uiLocale = (opts.uiLocale || '').trim() || null;
    const clientIp = getClientIp(req);
    const hdr = countryFromHeaders(req);
    let country = hdr.code;
    let method = country ? 'header' : null;

    if (!country) {
        country = countryFromGeoIpLite(clientIp);
        if (country) method = 'geoip-lite';
    }

    const source = country ? 'ip' : 'unknown';

    return {
        designer_country_code: country || null,
        designer_region_codes: [],
        designer_region_source: source,
        designer_ui_locale: uiLocale,
        designer_region_json: {
            computed_at: new Date().toISOString(),
            method: method || 'none',
            header: hdr.header,
            client_ip_masked: maskIp(clientIp)
        }
    };
}

const DESIGNER_REGION_DB_KEYS = [
    'designer_country_code',
    'designer_region_codes',
    'designer_region_source',
    'designer_ui_locale',
    'designer_region_json'
];

module.exports = {
    resolveDesignerRegionFromRequest,
    getClientIp,
    DESIGNER_REGION_DB_KEYS
};
