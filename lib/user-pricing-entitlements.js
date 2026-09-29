'use strict';

const listDiscount = require('./pricing-list-discount');

const VALID_PLAN_KEYS = new Set(['tier2', 'tier3', 'tier4']);
const parseListDiscountPercent = listDiscount.parseListDiscountPercent;
const amountFromListDiscount = listDiscount.amountFromListDiscount;

function normalizePlanKey(raw) {
    const k = String(raw || '').trim().toLowerCase();
    return VALID_PLAN_KEYS.has(k) ? k : '';
}

function normalizeCurrency(raw) {
    const c = String(raw || '').trim().toUpperCase();
    return c === 'USD' ? 'USD' : 'TWD';
}

function parseLockedAmount(raw, currency) {
    if (raw === null || raw === undefined || raw === '') return 0;
    const n = currency === 'TWD' ? parseInt(raw, 10) : parseFloat(raw);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return currency === 'TWD' ? n : Math.round(n * 100) / 100;
}

function applyLifetimeLockToQuote(quote, lock) {
    if (!quote || quote.billing !== 'yearly' || !lock) return quote;
    const currency = normalizeCurrency(quote.currency);
    if (normalizeCurrency(lock.currency) !== currency) return quote;

    const listAmount = quote.list_amount;
    const pct = parseListDiscountPercent(lock.list_discount_percent);
    if (pct != null && listAmount > 0) {
        const amt = amountFromListDiscount(listAmount, pct, currency);
        if (amt <= 0) return quote;
        const out = Object.assign({}, quote, {
            amount: amt,
            list_amount: listAmount,
            entitlement_lock: true,
            entitlement_id: lock.id || null,
            list_discount_percent: pct
        });
        out.campaign_id = null;
        out.campaign_title = null;
        out.campaign_title_en = null;
        return out;
    }

    // 舊資料：絕對鎖價（不再由後台 UI 建立）
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
        .select('id, locked_amount, list_discount_percent, currency, scope, campaign_id')
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

async function listActiveEntitlementsForUser(client, userId) {
    if (!client || !userId) return [];
    const { data, error } = await client
        .from('user_pricing_entitlements')
        .select('id, plan_key, billing, currency, list_discount_percent, locked_amount, scope, source, expires_at, created_at, updated_at')
        .eq('user_id', userId)
        .is('revoked_at', null)
        .order('created_at', { ascending: false });
    if (error) {
        if (String(error.message || '').includes('does not exist')) return [];
        throw error;
    }
    return data || [];
}

async function upsertSubscriptionTermFromPaidOrder(client, payload) {
    const p = payload && typeof payload === 'object' ? payload : {};
    const userId = p.userId;
    const planKey = normalizePlanKey(p.planKey || (p.meta && p.meta.plan_key));
    if (!client || !userId || !planKey) return { ok: false, reason: 'missing_user_or_plan' };

    const meta = (p.meta && typeof p.meta === 'object') ? p.meta : {};
    const order = p.order && typeof p.order === 'object' ? p.order : {};
    const currency = normalizeCurrency(p.currency || order.currency || 'TWD');
    const listAmt = parseLockedAmount(meta.list_amount, currency);
    const paid = parseLockedAmount(
        meta.quoted_amount != null ? meta.quoted_amount : order.amount,
        currency
    );
    if (paid <= 0) return { ok: false, reason: 'invalid_amount' };

    let discountPct = parseListDiscountPercent(meta.list_discount_percent);
    if (discountPct == null && listAmt > 0 && paid > 0 && paid <= listAmt) {
        discountPct = Math.round((1 - paid / listAmt) * 10000) / 100;
    }

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
        locked_amount: paid,
        list_discount_percent: discountPct,
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

async function grantAdminLifetimeDiscount(client, payload) {
    const p = payload && typeof payload === 'object' ? payload : {};
    const userId = p.userId;
    const planKey = normalizePlanKey(p.planKey);
    const currency = normalizeCurrency(p.currency);
    const discountPct = parseListDiscountPercent(
        p.listDiscountPercent != null ? p.listDiscountPercent : p.list_discount_percent
    );
    if (!client || !userId || !planKey || discountPct == null) {
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
        locked_amount: null,
        list_discount_percent: discountPct,
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

/** 換方案（new）：撤銷其他 tier 的本期 subscription_term 快照（不動 lifetime） */
async function revokeSubscriptionTermExceptPlan(client, userId, keepPlanKey) {
    const pk = normalizePlanKey(keepPlanKey);
    if (!client || !userId || !pk) return { ok: false, reason: 'invalid_input' };
    const now = new Date().toISOString();
    const { error } = await client
        .from('user_pricing_entitlements')
        .update({ revoked_at: now, updated_at: now })
        .eq('user_id', userId)
        .eq('scope', 'subscription_term')
        .is('revoked_at', null)
        .neq('plan_key', pk);
    if (error) {
        if (String(error.message || '').includes('does not exist')) return { ok: false, reason: 'table_missing' };
        throw error;
    }
    return { ok: true };
}

/** 訂閱過期／取消：撤銷該 tier 的本期 subscription_term */
async function revokeSubscriptionTermForPlan(client, userId, planKey) {
    const pk = normalizePlanKey(planKey);
    if (!client || !userId || !pk) return { ok: false, reason: 'invalid_input' };
    const now = new Date().toISOString();
    const { error } = await client
        .from('user_pricing_entitlements')
        .update({ revoked_at: now, updated_at: now })
        .eq('user_id', userId)
        .eq('plan_key', pk)
        .eq('scope', 'subscription_term')
        .is('revoked_at', null);
    if (error) {
        if (String(error.message || '').includes('does not exist')) return { ok: false, reason: 'table_missing' };
        throw error;
    }
    return { ok: true };
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
    parseListDiscountPercent,
    amountFromListDiscount,
    applyLifetimeLockToQuote,
    findActiveLifetimeLock,
    listActiveEntitlementsForUser,
    upsertSubscriptionTermFromPaidOrder,
    grantAdminLifetimeDiscount,
    revokeSubscriptionTermExceptPlan,
    revokeSubscriptionTermForPlan,
    revokeEntitlement
};
