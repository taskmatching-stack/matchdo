'use strict';

/**
 * 將已過 end_date 仍為 active 的訂閱標為 expired。
 * 若無 cancellation_reason，補上 expired_no_renew（非自願到期）。
 * @returns {{ expired: number, userIds: string[] }}
 */
async function expireOverdueSubscriptions(supabase) {
    if (!supabase) return { expired: 0, userIds: [] };
    const now = new Date().toISOString();
    const { data: rows, error } = await supabase
        .from('user_subscriptions')
        .select('id, user_id, cancellation_reason, end_date')
        .eq('status', 'active')
        .lte('end_date', now)
        .limit(500);
    if (error) {
        if (error.code === '42703') return { expired: 0, userIds: [], error: error.message };
        throw error;
    }
    const userIds = [];
    const seen = new Set();
    let expired = 0;
    for (let i = 0; i < (rows || []).length; i++) {
        const row = rows[i];
        const reason = row.cancellation_reason
            ? String(row.cancellation_reason)
            : 'expired_no_renew';
        const patch = { status: 'expired', cancellation_reason: reason };
        const { error: updErr } = await supabase
            .from('user_subscriptions')
            .update(patch)
            .eq('id', row.id);
        if (updErr) continue;
        expired += 1;
        if (row.user_id && !seen.has(row.user_id)) {
            seen.add(row.user_id);
            userIds.push(row.user_id);
        }
    }
    return { expired, userIds };
}

/**
 * 扣款失敗等：僅標記最近有效訂閱的 cancellation_reason，不立即改 status。
 */
async function markLatestActiveSubscriptionReason(supabase, userId, reason) {
    if (!supabase || !userId || !reason) return false;
    const now = new Date().toISOString();
    const { data: row } = await supabase
        .from('user_subscriptions')
        .select('id, cancellation_reason')
        .eq('user_id', userId)
        .eq('status', 'active')
        .gt('end_date', now)
        .order('end_date', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (!row || !row.id) return false;
    if (row.cancellation_reason === 'user_voluntary') return false;
    const { error } = await supabase
        .from('user_subscriptions')
        .update({ cancellation_reason: String(reason) })
        .eq('id', row.id);
    return !error;
}

module.exports = {
    expireOverdueSubscriptions,
    markLatestActiveSubscriptionReason
};
