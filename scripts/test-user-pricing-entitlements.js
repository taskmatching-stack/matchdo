'use strict';

const upe = require('../lib/user-pricing-entitlements');

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

const baseQuote = {
    plan_key: 'tier2',
    billing: 'yearly',
    currency: 'USD',
    amount: 110,
    list_amount: 110,
    credits: 3960
};

const locked = upe.applyLifetimeLockToQuote(baseQuote, {
    id: 'e1',
    currency: 'USD',
    locked_amount: 88
});
assert(locked.amount === 88, 'lifetime usd lock');
assert(locked.entitlement_lock === true, 'flag');

const twdQuote = Object.assign({}, baseQuote, { currency: 'TWD', amount: 3000 });
const lockedTwd = upe.applyLifetimeLockToQuote(twdQuote, {
    id: 'e2',
    currency: 'TWD',
    locked_amount: 2800
});
assert(lockedTwd.amount === 2800, 'lifetime twd lock');

const mismatch = upe.applyLifetimeLockToQuote(baseQuote, {
    id: 'e3',
    currency: 'TWD',
    locked_amount: 1
});
assert(mismatch.amount === 110, 'currency mismatch ignored');

console.log('test-user-pricing-entitlements: ok');
