'use strict';

function manufacturerMatchesServiceArea(mfr, areaCode) {
    if (!areaCode || !mfr) return !areaCode;
    const code = String(areaCode).trim().toLowerCase();
    const contact = mfr.contact_json && typeof mfr.contact_json === 'object' ? mfr.contact_json : {};
    let areas = contact.service_area;
    if (!areas && mfr.location) areas = [mfr.location];
    if (!areas) return false;
    if (typeof areas === 'string') {
        areas = areas.split(/[,，、\s]+/).map((s) => s.trim()).filter(Boolean);
    }
    if (!Array.isArray(areas)) return false;
    return areas.some((a) => {
        const s = String(a).trim().toLowerCase();
        return s === code || s.includes(code) || code.includes(s);
    });
}

function parseServiceAreaCodesFromQuery(req) {
    const q = req && req.query ? req.query : {};
    const parts = [];
    const single = String(q.service_area || '').trim();
    const multi = String(q.service_areas || '').trim();
    if (single) parts.push(...single.split(/[,，]/));
    if (multi) parts.push(...multi.split(/[,，]/));
    return [...new Set(parts.map((s) => String(s).trim().toLowerCase()).filter(Boolean))];
}

function manufacturerMatchesAnyServiceArea(mfr, areaCodes) {
    if (!areaCodes || !areaCodes.length) return true;
    return areaCodes.some((code) => manufacturerMatchesServiceArea(mfr, code));
}

function sortManufacturerRows(rows, sortKey) {
    const copy = (rows || []).slice();
    if (sortKey === 'name') {
        copy.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hant'));
        return copy;
    }
    copy.sort((a, b) => (parseFloat(b.rating) || 0) - (parseFloat(a.rating) || 0));
    return copy;
}

function paginateManufacturerRows(rows, page, perPage, sortKey, serviceAreaCodes) {
    let list = sortManufacturerRows(rows, sortKey);
    if (serviceAreaCodes && serviceAreaCodes.length) {
        list = list.filter((m) => manufacturerMatchesAnyServiceArea(m, serviceAreaCodes));
    }
    const total = list.length;
    const start = (Math.max(parseInt(page, 10) || 1, 1) - 1) * perPage;
    return { pageRows: list.slice(start, start + perPage), total };
}

module.exports = {
    manufacturerMatchesServiceArea,
    parseServiceAreaCodesFromQuery,
    manufacturerMatchesAnyServiceArea,
    sortManufacturerRows,
    paginateManufacturerRows
};
