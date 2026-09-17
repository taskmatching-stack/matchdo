'use strict';

const proration = require('./subscription-proration');
const ecpayRefund = require('./ecpay-refund');

function parseMeta(metadata) {
    if (!metadata) return {};
    if (typeof metadata === 'object' && !Array.isArray(metadata)) return metadata;
    if (typeof metadata === 'string') {
        try { return JSON.parse(metadata); } catch (_) { return {}; }
    }
    return {};
}

function alreadyProcessed(meta) {
    const r = meta && meta.proration_refund;
    if (!r || typeof r !== 'object') return false;
    const st = String(r.status || '');
    return st === 'refunded' || st === 'skipped';
}

function isSimulatePaid(order) {
    const raw = order && order.raw_callback;
    if (raw && typeof raw === 'object' && String(raw.SimulatePaid) === '1') return true;
    const meta = parseMeta(order && order.metadata);
    return String(meta.SimulatePaid) === '1';
}

async function spentSincePaid(supabase, userId, paidAt) {
    if (!userId || !paidAt) return 0;
    const { data: txs } = await supabase
        .from('credit_transactions')
        .select('amount, type')
        .eq('user_id', userId)
        .eq('type', 'consumed')
        .gte('created_at', paidAt);
    return (txs || []).reduce(function (sum, t) {
        return sum + Math.abs(parseInt(t.amount, 10) || 0);
    }, 0);
}

async function planCreditsMonthly(supabase, planKey) {
    const key = String(planKey || '').trim();
    if (!key) return 0;
    const { data } = await supabase
        .from('subscription_plans')
        .select('credits_monthly, duration_months')
        .eq('plan_key', key)
        .maybeSingle();
    return {
        credits_monthly: data ? (parseInt(data.credits_monthly, 10) || 0) : 0,
        duration_months: data ? (parseInt(data.duration_months, 10) || 0) : 0
    };
}

async function listCandidateOrders(supabase, userId, excludeOrderId) {
    const { data, error } = await supabase
        .from('payment_orders')
        .select('id, order_id, user_id, provider, amount, currency, credits_to_grant, status, order_type, external_id, paid_at, metadata, raw_callback')
        .eq('user_id', userId)
        .eq('status', 'paid')
        .in('order_type', ['yearly', 'subscription'])
        .order('paid_at', { ascending: false });
    if (error) throw error;
    return (data || []).filter(function (o) {
        if (excludeOrderId && o.id === excludeOrderId) return false;
        if (!o.paid_at) return false;
        if (!(parseInt(o.amount, 10) > 0)) return false;
        return true;
    });
}

async function computeForOrder(supabase, order, now) {
    const meta = parseMeta(order.metadata);
    const plan = await planCreditsMonthly(supabase, meta.plan_key);
    const spent = await spentSincePaid(supabase, order.user_id, order.paid_at);
    return proration.computeProration({
        orderType: order.order_type,
        paidAmount: order.amount,
        currency: order.currency || (order.provider === 'paypal' ? 'USD' : 'TWD'),
        paidAt: order.paid_at,
        creditsToGrant: order.credits_to_grant,
        planCreditsMonthly: plan.credits_monthly,
        durationMonths: plan.duration_months,
        spentSincePaid: spent,
        now: now || new Date()
    });
}

function emptySummary() {
    return {
        refund_amount: 0,
        refundable_months: 0,
        claw_points: 0,
        currency: '',
        reason: 'none',
        orders: []
    };
}

async function userHasActivePaidSubscription(supabase, userId) {
    const now = new Date().toISOString();
    const { data } = await supabase
        .from('user_subscriptions')
        .select('id, subscription_plans(price)')
        .eq('user_id', userId)
        .eq('status', 'active')
        .gt('end_date', now);
    return (data || []).some(function (s) {
        return s.subscription_plans && (s.subscription_plans.price || 0) > 0;
    });
}

async function previewForUser(opts) {
    const supabase = opts.supabase;
    const userId = opts.userId;
    if (!supabase || !userId) return emptySummary();
    if (!(await userHasActivePaidSubscription(supabase, userId))) return emptySummary();
    const orders = await listCandidateOrders(supabase, userId, opts.excludeOrderId);
    const out = emptySummary();
    for (let i = 0; i < orders.length; i++) {
        const order = orders[i];
        const meta = parseMeta(order.metadata);
        if (alreadyProcessed(meta)) continue;
        const calc = await computeForOrder(supabase, order);
        out.orders.push({
            order_id: order.order_id,
            provider: order.provider,
            order_type: order.order_type,
            currency: order.currency,
            calc: calc
        });
        if (calc.refund_amount > 0) {
            out.refund_amount += calc.refund_amount;
            out.refundable_months += calc.refundable_months;
            out.claw_points += calc.claw_points;
            out.currency = out.currency || order.currency || '';
            out.reason = 'refundable';
        } else if (out.reason === 'none') {
            out.reason = calc.reason;
        }
    }
    return out;
}

async function refundViaProvider(opts, order, calc) {
    const provider = String(order.provider || '').toLowerCase();
    const meta = parseMeta(order.metadata);
    if (isSimulatePaid(order)) {
        return { skipped: true, reason: 'simulate_paid' };
    }
    if (provider === 'paypal') {
        const paypalCfg = opts.paypalConfig;
        const paypalRest = opts.paypalRest;
        if (!paypalCfg || !paypalRest) throw new Error('PayPal 金流尚未設定');
        let captureId = String(meta.paypal_capture_id || '').trim();
        if (!captureId) {
            captureId = await paypalRest.findPayPalCaptureIdFromOrder(paypalCfg, order.external_id);
        }
        if (!captureId) throw new Error('找不到 PayPal 請款編號，無法退費');
        const result = await paypalRest.refundPayPalCapture(
            paypalCfg,
            captureId,
            calc.refund_amount,
            order.currency || 'USD',
            'prorate-' + order.order_id
        );
        return { refund_id: (result && result.id) || '', capture_id: captureId };
    }
    if (provider === 'ecpay') {
        const ecpayCfg = opts.ecpayConfig;
        if (!ecpayCfg) throw new Error('綠界金流尚未設定');
        const result = await ecpayRefund.refundEcpayCredit(ecpayCfg, {
            merchantTradeNo: order.order_id,
            tradeNo: order.external_id,
            amount: calc.refund_amount
        });
        return { refund_id: (result && (result.TradeNo || result.MerchantTradeNo)) || '', ecpay: result };
    }
    throw new Error('不支援的金流：' + provider);
}

async function applyForUser(opts) {
    const supabase = opts.supabase;
    const userId = opts.userId;
    const consumeUserCredits = opts.consumeUserCredits;
    const summary = emptySummary();
    if (!supabase || !userId) return summary;
    if (!(await userHasActivePaidSubscription(supabase, userId))) return summary;
    const orders = await listCandidateOrders(supabase, userId, opts.excludeOrderId);
    const reason = opts.reason || 'user_voluntary';
    const nowIso = new Date().toISOString();

    for (let i = 0; i < orders.length; i++) {
        const order = orders[i];
        const meta = parseMeta(order.metadata);
        if (alreadyProcessed(meta)) continue;
        const calc = await computeForOrder(supabase, order);
        const rowOut = {
            order_id: order.order_id,
            provider: order.provider,
            order_type: order.order_type,
            calc: calc
        };
        if (calc.refund_amount <= 0) {
            await supabase.from('payment_orders').update({
                metadata: Object.assign({}, meta, {
                    proration_refund: {
                        status: 'skipped',
                        reason: calc.reason,
                        billed_months: calc.billed_months,
                        refundable_months: 0,
                        amount: 0,
                        at: nowIso,
                        trigger: reason
                    }
                })
            }).eq('id', order.id);
            rowOut.status = 'skipped';
            summary.orders.push(rowOut);
            if (summary.reason === 'none') summary.reason = calc.reason;
            continue;
        }
        let providerResult;
        try {
            providerResult = await refundViaProvider(opts, order, calc);
        } catch (err) {
            const msg = (err && err.message) || String(err);
            console.error('proration refund provider:', order.order_id, msg);
            await supabase.from('payment_orders').update({
                metadata: Object.assign({}, meta, {
                    proration_refund: {
                        status: 'failed',
                        reason: calc.reason,
                        billed_months: calc.billed_months,
                        refundable_months: calc.refundable_months,
                        amount: calc.refund_amount,
                        currency: order.currency,
                        error: msg.slice(0, 300),
                        at: nowIso,
                        trigger: reason
                    }
                })
            }).eq('id', order.id);
            rowOut.status = 'failed';
            rowOut.error = msg;
            summary.orders.push(rowOut);
            if (!summary.error) summary.error = msg;
            continue;
        }

        let clawed = 0;
        if (calc.claw_points > 0 && typeof consumeUserCredits === 'function') {
            const { data: cred } = await supabase.from('user_credits').select('balance').eq('user_id', userId).maybeSingle();
            const bal = cred ? (parseInt(cred.balance, 10) || 0) : 0;
            const claw = Math.min(calc.claw_points, Math.max(0, bal));
            if (claw > 0) {
                const consumed = await consumeUserCredits(
                    userId,
                    claw,
                    'subscription_proration',
                    '退訂／換方案收回未用月點數',
                    { order_id: order.order_id, refundable_months: calc.refundable_months }
                );
                if (consumed && consumed.ok) clawed = claw;
            }
        }

        await supabase.from('payment_orders').update({
            metadata: Object.assign({}, meta, {
                paypal_capture_id: (providerResult && providerResult.capture_id) || meta.paypal_capture_id || undefined,
                proration_refund: {
                    status: providerResult && providerResult.skipped ? 'skipped' : 'refunded',
                    reason: calc.reason,
                    billed_months: calc.billed_months,
                    refundable_months: calc.refundable_months,
                    amount: calc.refund_amount,
                    currency: order.currency,
                    claw_points: clawed,
                    refund_id: (providerResult && providerResult.refund_id) || '',
                    at: nowIso,
                    trigger: reason
                }
            })
        }).eq('id', order.id);

        rowOut.status = 'refunded';
        summary.orders.push(rowOut);
        summary.refund_amount += calc.refund_amount;
        summary.refundable_months += calc.refundable_months;
        summary.claw_points += clawed;
        summary.currency = summary.currency || order.currency || '';
        summary.reason = 'refundable';
    }
    return summary;
}

module.exports = {
    previewForUser,
    applyForUser,
    computeForOrder
};
