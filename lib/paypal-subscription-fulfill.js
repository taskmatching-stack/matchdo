'use strict';

/**
 * PayPal 訂閱付款入點／延長訂閱（首扣與週期扣款共用）
 */

async function hasPayPalCreditGrant(supabase, userId, metadata) {
    if (!userId || !metadata) return false;
    const orderId = metadata.order_id ? String(metadata.order_id) : '';
    const periodIndex = metadata.period_index != null ? String(metadata.period_index) : '';
    const saleId = metadata.sale_id ? String(metadata.sale_id) : '';
    let q = supabase
        .from('credit_transactions')
        .select('id')
        .eq('user_id', userId)
        .limit(1);
    if (saleId) {
        q = q.contains('metadata', { sale_id: saleId });
    } else if (orderId && periodIndex) {
        q = q.contains('metadata', { order_id: orderId, period_index: periodIndex });
    } else if (orderId) {
        q = q.contains('metadata', { order_id: orderId, provider: 'paypal' });
    } else {
        return false;
    }
    const { data } = await q.maybeSingle();
    return !!data;
}

async function grantPayPalCredits(supabase, order, metaExtra) {
    if (!order || !order.user_id) return { ok: false, reason: 'invalid_order' };
    const credits = parseInt(order.credits_to_grant, 10) || 0;
    if (credits <= 0) return { ok: false, reason: 'no_credits' };
    const metadata = Object.assign({
        order_id: order.order_id,
        provider: 'paypal'
    }, metaExtra || {});
    const dup = await hasPayPalCreditGrant(supabase, order.user_id, metadata);
    if (dup) return { ok: true, duplicate: true };

    const paidAt = new Date().toISOString();
    const { data: cred } = await supabase
        .from('user_credits')
        .select('balance, total_earned, total_spent')
        .eq('user_id', order.user_id)
        .maybeSingle();
    const balanceBefore = (cred && cred.balance) ? cred.balance : 0;
    const balanceAfter = balanceBefore + credits;
    const totalEarned = (cred && cred.total_earned) ? cred.total_earned + credits : credits;
    if (cred) {
        await supabase.from('user_credits').update({
            balance: balanceAfter,
            total_earned: totalEarned,
            updated_at: paidAt
        }).eq('user_id', order.user_id);
    } else {
        await supabase.from('user_credits').insert({
            user_id: order.user_id,
            balance: balanceAfter,
            total_earned: totalEarned,
            total_spent: 0,
            updated_at: paidAt
        });
    }
    const desc = order.order_type === 'subscription'
        ? 'PayPal 月訂閱'
        : (order.order_type === 'yearly' ? 'PayPal 年訂閱' : 'PayPal 儲值');
    await supabase.from('credit_transactions').insert({
        user_id: order.user_id,
        type: 'purchase',
        amount: credits,
        balance_after: balanceAfter,
        source: 'purchase',
        description: desc,
        metadata: metadata
    });
    return { ok: true, balance_after: balanceAfter, duplicate: false };
}

module.exports = {
    hasPayPalCreditGrant,
    grantPayPalCredits
};
