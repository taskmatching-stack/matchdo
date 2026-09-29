'use strict';

/** 牌價年付折扣％：1–99.99（表示牌價減去該百分比） */
function parseListDiscountPercent(raw) {
    if (raw === null || raw === undefined || raw === '') return null;
    const n = parseFloat(raw);
    if (!Number.isFinite(n) || n <= 0 || n >= 100) return null;
    return Math.round(n * 100) / 100;
}

function amountFromListDiscount(listAmount, discountPercent, currency) {
    const cur = String(currency || 'TWD').toUpperCase() === 'USD' ? 'USD' : 'TWD';
    const list = cur === 'TWD'
        ? Math.abs(parseInt(listAmount, 10) || 0)
        : parseFloat(listAmount);
    const pct = parseListDiscountPercent(discountPercent);
    if (!list || !pct) return 0;
    const factor = (100 - pct) / 100;
    if (cur === 'TWD') return Math.max(1, Math.round(list * factor));
    return Math.max(0.01, Math.round(list * factor * 100) / 100);
}

module.exports = {
    parseListDiscountPercent,
    amountFromListDiscount
};
