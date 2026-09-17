'use strict';

/**
 * 訂閱退費：以「完整月」計，當月視同已使用；並以已消耗點數卡住未用月。
 * 年付 12 個月、月訂 1 個月。不依剩餘天數。
 */

function billedMonthsForOrderType(orderType, durationMonths) {
    const t = String(orderType || '').toLowerCase();
    if (t === 'yearly') {
        const d = parseInt(durationMonths, 10);
        return d > 0 ? d : 12;
    }
    if (t === 'subscription') return 1;
    return 0;
}

/** 含當月：1 月 15 日到 1 月 20 日 = 1；到 2 月 1 日 = 2 */
function usedCalendarMonths(startIso, now) {
    if (!startIso) return 0;
    const start = new Date(startIso);
    const n = now ? new Date(now) : new Date();
    if (Number.isNaN(start.getTime()) || Number.isNaN(n.getTime())) return 0;
    if (n.getTime() < start.getTime()) return 0;
    return (n.getUTCFullYear() - start.getUTCFullYear()) * 12
        + (n.getUTCMonth() - start.getUTCMonth())
        + 1;
}

function monthlyCreditsFromGrant(creditsToGrant, billedMonths, planCreditsMonthly) {
    const plan = parseInt(planCreditsMonthly, 10) || 0;
    if (plan > 0) return plan;
    const billed = Math.max(1, parseInt(billedMonths, 10) || 1);
    const granted = parseInt(creditsToGrant, 10) || 0;
    if (granted <= 0) return 0;
    return Math.max(1, Math.round(granted / billed));
}

function prorateMoney(paidAmount, unusedMonths, billedMonths, currency) {
    const paid = Number(paidAmount);
    const unused = Math.max(0, parseInt(unusedMonths, 10) || 0);
    const billed = Math.max(1, parseInt(billedMonths, 10) || 1);
    if (!Number.isFinite(paid) || paid <= 0 || unused <= 0) return 0;
    const raw = paid * unused / billed;
    const cur = String(currency || '').toUpperCase();
    if (cur === 'USD' || cur === 'EUR' || cur === 'GBP') {
        return Math.round(raw * 100) / 100;
    }
    return Math.round(raw);
}

/**
 * @param {object} input
 * @param {string} input.orderType yearly | subscription
 * @param {number} input.paidAmount
 * @param {string} [input.currency]
 * @param {string} input.paidAt
 * @param {number} [input.creditsToGrant]
 * @param {number} [input.planCreditsMonthly]
 * @param {number} [input.durationMonths]
 * @param {number} [input.spentSincePaid] 付款後消耗點數（絕對值加總）
 * @param {Date|string} [input.now]
 */
function computeProration(input) {
    const empty = {
        billed_months: 0,
        used_months: 0,
        unused_calendar_months: 0,
        unused_points_months: 0,
        refundable_months: 0,
        refund_amount: 0,
        claw_points: 0,
        monthly_credits: 0,
        remaining_grant: 0,
        reason: 'ineligible'
    };
    if (!input || !input.orderType) return empty;
    const billed = billedMonthsForOrderType(input.orderType, input.durationMonths);
    if (billed <= 0) return empty;
    const used = Math.min(billed, usedCalendarMonths(input.paidAt, input.now));
    const unusedCal = Math.max(0, billed - used);
    const monthly = monthlyCreditsFromGrant(input.creditsToGrant, billed, input.planCreditsMonthly);
    const granted = Math.max(0, parseInt(input.creditsToGrant, 10) || 0);
    const spent = Math.max(0, parseInt(input.spentSincePaid, 10) || 0);
    const remainingGrant = Math.max(0, granted - spent);
    const unusedPtsMonths = monthly > 0 ? Math.floor(remainingGrant / monthly) : unusedCal;
    const refundable = Math.min(unusedCal, unusedPtsMonths);
    let reason = 'refundable';
    if (unusedCal <= 0) reason = 'current_period';
    else if (refundable <= 0) reason = 'points_used';
    const refundAmount = prorateMoney(input.paidAmount, refundable, billed, input.currency);
    const claw = monthly > 0 ? refundable * monthly : 0;
    return {
        billed_months: billed,
        used_months: used,
        unused_calendar_months: unusedCal,
        unused_points_months: unusedPtsMonths,
        refundable_months: refundable,
        refund_amount: refundAmount,
        claw_points: claw,
        monthly_credits: monthly,
        remaining_grant: remainingGrant,
        reason: refundAmount > 0 ? 'refundable' : reason
    };
}

module.exports = {
    billedMonthsForOrderType,
    usedCalendarMonths,
    monthlyCreditsFromGrant,
    prorateMoney,
    computeProration
};
