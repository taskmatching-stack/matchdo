'use strict';

const crypto = require('crypto');

class EmbedSimulatorError extends Error {
    constructor(code, httpStatus, message) {
        super(message || code);
        this.code = code;
        this.httpStatus = httpStatus || 400;
    }
}

const hourlyIpBuckets = new Map();

function computeEmbedSig(embedKey, secret) {
    return crypto.createHmac('sha256', String(secret || '')).update(String(embedKey || '')).digest('hex');
}

function verifyEmbedSig(embedKey, sig, secret) {
    if (!embedKey || !sig || !secret) return false;
    const expected = computeEmbedSig(embedKey, secret);
    const got = String(sig).trim();
    try {
        if (expected.length !== got.length) return false;
        return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(got, 'hex'));
    } catch (_) {
        return expected === got;
    }
}

function getRequestClientIp(req) {
    const xf = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (xf) return xf;
    return (req.socket && req.socket.remoteAddress) || req.ip || '';
}

function hashVisitorIp(ip) {
    return crypto.createHash('sha256').update(String(ip || 'unknown')).digest('hex');
}

function isMissingTableError(err) {
    return err && (err.code === '42P01' || String(err.message || '').includes('does not exist'));
}

function isMissingColumnError(err, col) {
    return err && err.code === '42703' && String(err.message || '').includes(col);
}

async function resolveEmbedInstance(supabase, embedId, sig) {
    const key = String(embedId || '').trim();
    if (!key || !sig) {
        throw new EmbedSimulatorError('invalid_signature', 403, '無效的嵌入連結');
    }
    let result;
    try {
        result = await supabase
            .from('manufacturer_embed_instances')
            .select('id, manufacturer_id, name, embed_key, embed_secret, prototype_asset_id, allowed_origins, rate_limit_per_ip_hour, daily_cap, monthly_cap, is_active')
            .eq('embed_key', key)
            .maybeSingle();
    } catch (e) {
        throw new EmbedSimulatorError('embed_schema', 503, 'Embed 尚未設定，請執行 docs/add-embed-simulator-schema.sql');
    }
    if (result.error) {
        if (isMissingTableError(result.error)) {
            throw new EmbedSimulatorError('embed_schema', 503, 'Embed 尚未設定，請執行 docs/add-embed-simulator-schema.sql');
        }
        throw result.error;
    }
    const row = result.data;
    if (!row || !row.is_active) {
        throw new EmbedSimulatorError('instance_disabled', 403, '試做服務暫停中');
    }
    if (!verifyEmbedSig(key, sig, row.embed_secret)) {
        throw new EmbedSimulatorError('invalid_signature', 403, '無效的嵌入連結');
    }
    const { data: mfr, error: mfrErr } = await supabase
        .from('manufacturers')
        .select('id, name, logo_url, user_id, contact_json, is_active')
        .eq('id', row.manufacturer_id)
        .maybeSingle();
    if (mfrErr) throw mfrErr;
    if (!mfr || !mfr.is_active) {
        throw new EmbedSimulatorError('instance_disabled', 403, '試做服務暫停中');
    }
    return {
        instance: row,
        manufacturer: mfr,
        vendorUserId: mfr.user_id || null
    };
}

async function assertEmbedFeatureEnabled(supabase, vendorUserId) {
    if (!vendorUserId) {
        throw new EmbedSimulatorError('embed_disabled', 403, '此功能未開通');
    }
    const now = new Date().toISOString();
    const { data: sub, error } = await supabase
        .from('user_subscriptions')
        .select('subscription_plans(embed_enabled, embed_generations_monthly)')
        .eq('user_id', vendorUserId)
        .eq('status', 'active')
        .gt('end_date', now)
        .limit(1)
        .maybeSingle();
    if (error && !isMissingColumnError(error, 'embed_enabled')) {
        if (isMissingColumnError(error, 'embed_generations_monthly')) return;
        throw error;
    }
    const plan = sub && sub.subscription_plans;
    if (plan && plan.embed_enabled === false) {
        throw new EmbedSimulatorError('embed_disabled', 403, '此功能未開通');
    }
}

function checkIpHourlyLimit(instanceId, ip, limit) {
    const max = Number(limit);
    if (!max || max <= 0) return;
    const bucketKey = String(instanceId) + ':' + hashVisitorIp(ip) + ':' + new Date().toISOString().slice(0, 13);
    const now = Date.now();
    let row = hourlyIpBuckets.get(bucketKey);
    if (!row || row.resetAt <= now) {
        row = { count: 0, resetAt: now + 3600000 };
        hourlyIpBuckets.set(bucketKey, row);
    }
    if (row.count >= max) {
        throw new EmbedSimulatorError('rate_limit_ip_hour', 429, '請稍後再試（1 小時內已達上限）');
    }
    row.count += 1;
}

async function getInstanceUsageCounts(supabase, instanceId) {
    const today = new Date().toISOString().slice(0, 10);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthStartIso = monthStart.toISOString().slice(0, 10);

    const { data: todayRow } = await supabase
        .from('embed_instance_usage_counters')
        .select('count')
        .eq('embed_instance_id', instanceId)
        .eq('date', today)
        .maybeSingle();

    const { data: monthRows, error: monthErr } = await supabase
        .from('embed_instance_usage_counters')
        .select('count, date')
        .eq('embed_instance_id', instanceId)
        .gte('date', monthStartIso);
    if (monthErr && !isMissingTableError(monthErr)) throw monthErr;

    let monthCount = 0;
    (monthRows || []).forEach(function (r) {
        monthCount += Number(r.count) || 0;
    });
    return {
        daily: Number(todayRow && todayRow.count) || 0,
        monthly: monthCount
    };
}

function assertCaps(instance, usage) {
    const dailyCap = Number(instance.daily_cap);
    if (dailyCap > 0 && usage.daily >= dailyCap) {
        throw new EmbedSimulatorError('daily_cap_reached', 429, '今日試做已額滿，明日再來');
    }
    const monthlyCap = Number(instance.monthly_cap);
    if (monthlyCap > 0 && usage.monthly >= monthlyCap) {
        throw new EmbedSimulatorError('monthly_cap_reached', 429, '本月試做已額滿');
    }
}

async function getManufacturerPlanEmbedQuota(supabase, vendorUserId) {
    const now = new Date().toISOString();
    const { data: sub, error } = await supabase
        .from('user_subscriptions')
        .select('subscription_plans(embed_generations_monthly)')
        .eq('user_id', vendorUserId)
        .eq('status', 'active')
        .gt('end_date', now)
        .limit(1)
        .maybeSingle();
    if (error && isMissingColumnError(error, 'embed_generations_monthly')) return 0;
    if (error) throw error;
    const n = sub && sub.subscription_plans && sub.subscription_plans.embed_generations_monthly;
    return Math.max(0, parseInt(n, 10) || 0);
}

async function countManufacturerEmbedQuotaUsage(supabase, manufacturerId) {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const { count, error } = await supabase
        .from('vendor_embed_designs')
        .select('id', { count: 'exact', head: true })
        .eq('manufacturer_id', manufacturerId)
        .eq('billing_type', 'plan_quota')
        .gte('created_at', monthStart.toISOString());
    if (error && isMissingTableError(error)) return 0;
    if (error) throw error;
    return count || 0;
}

async function resolveEmbedBilling(supabase, manufacturerId, vendorUserId, overagePoints) {
    const planQuota = await getManufacturerPlanEmbedQuota(supabase, vendorUserId);
    const used = await countManufacturerEmbedQuotaUsage(supabase, manufacturerId);
    if (planQuota > 0 && used < planQuota) {
        return { billing_type: 'plan_quota', points_charged: 0 };
    }
    if (!vendorUserId) {
        throw new EmbedSimulatorError('plan_quota_exhausted_no_credits', 402, '試做暫停，請聯絡廠商');
    }
    const { data: creditRow } = await supabase
        .from('user_credits')
        .select('balance')
        .eq('user_id', vendorUserId)
        .maybeSingle();
    const balance = creditRow ? (creditRow.balance || 0) : 0;
    if (balance < overagePoints) {
        throw new EmbedSimulatorError('insufficient_credits', 402, '試做暫停，請聯絡廠商');
    }
    return { billing_type: 'credit_overage', points_charged: overagePoints };
}

async function incrementDailyUsage(supabase, instanceId) {
    const today = new Date().toISOString().slice(0, 10);
    const { data: existing } = await supabase
        .from('embed_instance_usage_counters')
        .select('id, count')
        .eq('embed_instance_id', instanceId)
        .eq('date', today)
        .maybeSingle();
    if (existing && existing.id) {
        await supabase
            .from('embed_instance_usage_counters')
            .update({ count: (Number(existing.count) || 0) + 1, updated_at: new Date().toISOString() })
            .eq('id', existing.id);
        return;
    }
    await supabase.from('embed_instance_usage_counters').insert({
        embed_instance_id: instanceId,
        date: today,
        count: 1
    });
}

async function chargeVendorCredits(supabase, userId, amount, description) {
    if (!userId || !amount) return null;
    const { data: row } = await supabase.from('user_credits').select('balance').eq('user_id', userId).maybeSingle();
    const prev = row ? (row.balance || 0) : 0;
    const newBalance = prev - amount;
    if (newBalance < 0) {
        throw new EmbedSimulatorError('insufficient_credits', 402, '試做暫停，請聯絡廠商');
    }
    await supabase.from('user_credits').update({ balance: newBalance, updated_at: new Date().toISOString() }).eq('user_id', userId);
    await supabase.from('credit_transactions').insert({
        user_id: userId,
        type: 'consumed',
        amount: -amount,
        balance_after: newBalance,
        source: 'embed_simulator_generate',
        description: description || ('Embed 模擬器生圖（' + amount + ' 點）')
    });
    return newBalance;
}

function manufacturerLogoFromRow(mfr) {
    if (!mfr) return null;
    const direct = (mfr.logo_url && String(mfr.logo_url).trim()) || '';
    if (direct) return direct;
    const cj = mfr.contact_json;
    if (cj && typeof cj === 'object' && cj.logo_url) {
        return String(cj.logo_url).trim() || null;
    }
    return null;
}

function sendEmbedError(res, err, manufacturerName) {
    if (err instanceof EmbedSimulatorError) {
        let msg = err.message;
        if (manufacturerName && (err.code === 'insufficient_credits' || err.code === 'plan_quota_exhausted_no_credits')) {
            msg = '試做暫停，請聯絡 ' + manufacturerName;
        }
        return res.status(err.httpStatus).json({ error: msg, error_code: err.code });
    }
    console.error('[embed-simulator]', err);
    return res.status(500).json({ error: '系統錯誤', error_code: 'server_error' });
}

module.exports = {
    EmbedSimulatorError,
    computeEmbedSig,
    verifyEmbedSig,
    getRequestClientIp,
    hashVisitorIp,
    resolveEmbedInstance,
    assertEmbedFeatureEnabled,
    checkIpHourlyLimit,
    getInstanceUsageCounts,
    assertCaps,
    resolveEmbedBilling,
    incrementDailyUsage,
    chargeVendorCredits,
    manufacturerLogoFromRow,
    sendEmbedError
};
