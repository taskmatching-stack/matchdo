'use strict';

const p = require('../lib/subscription-proration');

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

function nearly(a, b) {
    return Math.abs(a - b) < 0.001;
}

const jan15 = '2026-01-15T10:00:00.000Z';

assert(p.usedCalendarMonths(jan15, '2026-01-20T00:00:00.000Z') === 1, 'same month = 1 used');
assert(p.usedCalendarMonths(jan15, '2026-02-01T00:00:00.000Z') === 2, 'next month = 2 used');
assert(p.usedCalendarMonths(jan15, '2026-12-15T00:00:00.000Z') === 12, 'dec = 12 used');
assert(p.billedMonthsForOrderType('yearly') === 12, 'yearly 12');
assert(p.billedMonthsForOrderType('subscription') === 1, 'monthly 1');

const yearlyNoSpend = p.computeProration({
    orderType: 'yearly',
    paidAmount: 9000,
    currency: 'TWD',
    paidAt: jan15,
    creditsToGrant: 14400,
    planCreditsMonthly: 1200,
    spentSincePaid: 0,
    now: '2026-01-20T00:00:00.000Z'
});
assert(yearlyNoSpend.used_months === 1, 'yearly used 1');
assert(yearlyNoSpend.refundable_months === 11, 'yearly unused 11');
assert(yearlyNoSpend.refund_amount === 8250, '9000 * 11/12');
assert(yearlyNoSpend.claw_points === 13200, '11*1200');
assert(yearlyNoSpend.reason === 'refundable', 'reason refundable');

const yearlySpentAll = p.computeProration({
    orderType: 'yearly',
    paidAmount: 9000,
    currency: 'TWD',
    paidAt: jan15,
    creditsToGrant: 14400,
    planCreditsMonthly: 1200,
    spentSincePaid: 14400,
    now: '2026-01-20T00:00:00.000Z'
});
assert(yearlySpentAll.refundable_months === 0, 'spent all → 0 months');
assert(yearlySpentAll.refund_amount === 0, 'spent all → no money');
assert(yearlySpentAll.reason === 'points_used', 'points_used');

const yearlySpentTwoMonths = p.computeProration({
    orderType: 'yearly',
    paidAmount: 9000,
    currency: 'TWD',
    paidAt: jan15,
    creditsToGrant: 14400,
    planCreditsMonthly: 1200,
    spentSincePaid: 2400,
    now: '2026-01-20T00:00:00.000Z'
});
assert(yearlySpentTwoMonths.unused_calendar_months === 11, 'calendar still 11');
assert(yearlySpentTwoMonths.refundable_months === 10, 'points cap 10 leftover months of grant');
assert(yearlySpentTwoMonths.refund_amount === 7500, '9000 * 10/12');

const monthly = p.computeProration({
    orderType: 'subscription',
    paidAmount: 900,
    currency: 'TWD',
    paidAt: jan15,
    creditsToGrant: 1200,
    planCreditsMonthly: 1200,
    spentSincePaid: 0,
    now: '2026-01-20T00:00:00.000Z'
});
assert(monthly.refundable_months === 0, 'monthly current month not refunded');
assert(monthly.refund_amount === 0, 'monthly no money');
assert(monthly.reason === 'current_period', 'current_period');

const usd = p.computeProration({
    orderType: 'yearly',
    paidAmount: 330,
    currency: 'USD',
    paidAt: jan15,
    creditsToGrant: 14400,
    planCreditsMonthly: 1200,
    spentSincePaid: 0,
    now: '2026-01-20T00:00:00.000Z'
});
assert(nearly(usd.refund_amount, 302.5), 'USD 330 * 11/12 = 302.50');

console.log('subscription-proration tests ok');
