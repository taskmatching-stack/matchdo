'use strict';

const VALID_PLAN_KEYS = new Set(['tier2', 'tier3', 'tier4']);

function normalizePlanKey(raw) {
    const k = String(raw || '').trim().toLowerCase();
    return VALID_PLAN_KEYS.has(k) ? k : '';
}

function normalizeCurrency(raw) {
    const c = String(raw || '').trim().toUpperCase();
    return c === 'USD' ? 'USD' : 'TWD';
}

function parseLockedAmount(raw, currency) {
    const n = currency === 'TWD' ? parseInt(raw, 10) : parseFloat(raw);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return currency === 'TWD' ? n : Math.round(n * 100) / 100;
}

function applyLifetimeLockToQuote(quote, lock) {
    if (!quote || quote.billing !== 'yearly' || !lock) return quote;
    const currency = normalizeCurrency(quote.currency);
    if (normalizeCurrency(lock.currency) !== currency) return quote;
    const amt = parseLockedAmount(lock.locked_amount, currency);
    if (amt <= 0) return quote;
    return Object.assign({}, quote, {
        amount: amt,
        entitlement_lock: true,
        entitlement_id: lock.id || null
    });
}

async function findActiveLifetimeLock(client, userId, planKey, billing, currency) {
    if (!client || !userId || !planKey) return null;
    const pk = normalizePlanKey(planKey);
    if (!pk) return null;
    const bill = String(billing || 'yearly').trim().toLowerCase() === 'monthly' ? 'monthly' : 'yearly';
    const cur = normalizeCurrency(currency);
    const { data, error } = await client
        .from('user_pricing_entitlements')
        .select('id, locked_amount, currency, scope, campaign_id')
        .eq('user_id', userId)
        .eq('plan_key', pk)
        .eq('billing', bill)
        .eq('currency', cur)
        .eq('scope', 'lifetime')
        .is('revoked_at', null)
        .maybeSingle();
    if (error) {
        if (String(error.message || '').includes('does not exist')) return null;
        throw error;
    }
    return data || null;
}

async function upsertSubscriptionTermFromPaidOrder(client, payload) {
    const p = payload && typeof payload === 'object' ? payload : {};
    const userId = p.userId;
    const planKey = normalizePlanKey(p.planKey || (p.meta && p.meta.plan_key));
    if (!client || !userId || !planKey) return { ok: false, reason: 'missing_user_or_plan' };

    const meta = (p.meta && typeof p.meta === 'object') ? p.meta : {};
    const order = p.order && typeof p.order === 'object' ? p.order : {};
    const currency = normalizeCurrency(p.currency || order.currency || 'TWD');
    let locked = meta.quoted_amount != null ? meta.quoted_amount : order.amount;
    const lockedAmount = parseLockedAmount(locked, currency);
    if (lockedAmount <= 0) return { ok: false, reason: 'invalid_amount' };

    const { data: existing, error: findErr } = await client
        .from('user_pricing_entitlements')
        .select('id, scope')
        .eq('user_id', userId)
        .eq('plan_key', planKey)
        .eq('billing', 'yearly')
        .eq('currency', currency)
        .is('revoked_at', null)
        .maybeSingle();
    if (findErr) {
        if (String(findErr.message || '').includes('does not exist')) return { ok: false, reason: 'table_missing' };
        throw findErr;
    }
    if (existing && existing.scope === 'lifetime') {
        return { ok: true, skipped: true, reason: 'lifetime_active' };
    }

    const now = new Date().toISOString();
    const row = {
        user_id: userId,
        plan_key: planKey,
        billing: 'yearly',
        currency,
        locked_amount: lockedAmount,
        scope: 'subscription_term',
        source: meta.campaign_id ? 'campaign' : 'order',
        campaign_id: meta.campaign_id || null,
        order_id: order.order_id || p.orderId || null,
        expires_at: p.expiresAt || null,
        updated_at: now
    };

    if (existing && existing.id) {
        const { error: updErr } = await client
            .from('user_pricing_entitlements')
            .update(row)
            .eq('id', existing.id);
        if (updErr) throw updErr;
        return { ok: true, updated: true, id: existing.id };
    }

    const { data: ins, error: insErr } = await client
        .from('user_pricing_entitlements')
        .insert(Object.assign({}, row, { created_at: now }))
        .select('id')
        .single();
    if (insErr) throw insErr;
    return { ok: true, created: true, id: ins && ins.id };
}

async function grantAdminLifetimeLock(client, payload) {
    const p = payload && typeof payload === 'object' ? payload : {};
    const userId = p.userId;
    const planKey = normalizePlanKey(p.planKey);
    const currency = normalizeCurrency(p.currency);
    const lockedAmount = parseLockedAmount(p.lockedAmount, currency);
    if (!client || !userId || !planKey || lockedAmount <= 0) {
        return { ok: false, reason: 'invalid_input' };
    }

    const { data: existing, error: findErr } = await client
        .from('user_pricing_entitlements')
        .select('id')
        .eq('user_id', userId)
        .eq('plan_key', planKey)
        .eq('billing', 'yearly')
        .eq('currency', currency)
        .is('revoked_at', null)
        .maybeSingle();
    if (findErr) throw findErr;

    const now = new Date().toISOString();
    const row = {
        user_id: userId,
        plan_key: planKey,
        billing: 'yearly',
        currency,
        locked_amount: lockedAmount,
        scope: 'lifetime',
        source: 'admin_grant',
        campaign_id: null,
        order_id: null,
        expires_at: null,
        revoked_at: null,
        updated_at: now
    };

    if (existing && existing.id) {
        const { error: updErr } = await client.from('user_pricing_entitlements').update(row).eq('id', existing.id);
        if (updErr) throw updErr;
        return { ok: true, id: existing.id, updated: true };
    }

    const { data: ins, error: insErr } = await client
        .from('user_pricing_entitlements')
        .insert(Object.assign({}, row, { created_at: now }))
        .select('id')
        .single();
    if (insErr) throw insErr;
    return { ok: true, id: ins && ins.id, created: true };
}

async function revokeEntitlement(client, id) {
    if (!client || !id) return { ok: false, reason: 'missing_id' };
    const { data, error } = await client
        .from('user_pricing_entitlements')
        .update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', id)
        .is('revoked_at', null)
        .select('id')
        .maybeSingle();
    if (error) throw error;
    return data && data.id ? { ok: true, id: data.id } : { ok: false, reason: 'not_found' };
}

module.exports = {
    normalizePlanKey,
    normalizeCurrency,
    applyLifetimeLockToQuote,
    findActiveLifetimeLock,
    upsertSubscriptionTermFromPaidOrder,
    grantAdminLifetimeLock,
    revokeEntitlement
};
