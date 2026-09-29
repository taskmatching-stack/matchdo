'use strict';

const upe = require('../lib/user-pricing-entitlements');

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

assert(upe.amountFromListDiscount(3000, 17, 'TWD') === 2490, 'twd 17% off list');
assert(upe.amountFromListDiscount(110, 10, 'USD') === 99, 'usd 10% off list');

const baseQuote = {
    plan_key: 'tier2',
    billing: 'yearly',
    currency: 'USD',
    amount: 110,
    list_amount: 110,
    credits: 3960,
    campaign_id: 'camp-1'
};

const locked = upe.applyLifetimeLockToQuote(baseQuote, {
    id: 'e1',
    currency: 'USD',
    list_discount_percent: 20
});
assert(locked.amount === 88, 'lifetime percent off list');
assert(locked.list_discount_percent === 20, 'pct on quote');
assert(locked.campaign_id == null, 'campaign cleared when lifetime discount');

const twdQuote = Object.assign({}, baseQuote, { currency: 'TWD', amount: 3000, list_amount: 3000 });
const lockedTwd = upe.applyLifetimeLockToQuote(twdQuote, {
    id: 'e2',
    currency: 'TWD',
    list_discount_percent: 17
});
assert(lockedTwd.amount === 2490, 'lifetime twd percent');

assert(upe.parseListDiscountPercent(0) === null, 'reject 0');
assert(upe.parseListDiscountPercent(100) === null, 'reject 100');

console.log('test-user-pricing-entitlements: ok');
