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

/** 付費 embed 方案（plan_key 或月費 price 對應） */
const EMBED_TIER_BY_PLAN_KEY = {
    '300': '300', tier2: '300',
    '900': '900', tier3: '900',
    '1800': '1800', tier4: '1800'
};
const EMBED_TIER_BY_PRICE = { 300: '300', 900: '900', 1800: '1800' };

const EMBED_TIER_CONFIG = {
    '300': { maxInstances: 3, showPoweredBy: true, wallMode: 'always' },
    '900': { maxInstances: null, showPoweredBy: true, wallMode: 'always' },
    '1800': { maxInstances: null, showPoweredBy: false, wallMode: 'configurable' }
};

function normalizeSubscriptionPlan(raw) {
    if (!raw) return null;
    if (Array.isArray(raw)) return raw[0] || null;
    return raw;
}

/** 由方案 price / plan_key 推 embed 等級；免費方案回 null */
function embedTierFromPlan(plan) {
    if (!plan) return null;
    const price = Number(plan.price);
    if (Number.isFinite(price) && price <= 0) return null;

    const keyRaw = plan.plan_key ? String(plan.plan_key).trim() : '';
    const keyLower = keyRaw.toLowerCase();
    if (keyLower && EMBED_TIER_BY_PLAN_KEY[keyLower]) return EMBED_TIER_BY_PLAN_KEY[keyLower];
    if (keyRaw && EMBED_TIER_BY_PLAN_KEY[keyRaw]) return EMBED_TIER_BY_PLAN_KEY[keyRaw];

    if (Number.isFinite(price)) {
        if (EMBED_TIER_BY_PRICE[price]) return EMBED_TIER_BY_PRICE[price];
        if (price >= 1800) return '1800';
        if (price >= 900) return '900';
        if (price >= 300) return '300';
    }
    return null;
}

function pickHigherEmbedTier(a, b) {
    const rank = { '300': 1, '900': 2, '1800': 3 };
    if (!a) return b || null;
    if (!b) return a;
    return (rank[b] || 0) > (rank[a] || 0) ? b : a;
}

async function resolveEmbedPlanTier(supabase, vendorUserId) {
    if (!vendorUserId) return null;
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', vendorUserId).maybeSingle();
    if (profile && (profile.role === 'admin' || profile.role === 'tester')) return '1800';

    const now = new Date().toISOString();
    let rows = null;
    let error = null;

    const withEmbedFlag = await supabase
        .from('user_subscriptions')
        .select('subscription_plans(plan_key, price, embed_enabled)')
        .eq('user_id', vendorUserId)
        .eq('status', 'active')
        .gt('end_date', now);

    if (withEmbedFlag.error && isMissingColumnError(withEmbedFlag.error, 'embed_enabled')) {
        const withoutEmbedFlag = await supabase
            .from('user_subscriptions')
            .select('subscription_plans(plan_key, price)')
            .eq('user_id', vendorUserId)
            .eq('status', 'active')
            .gt('end_date', now);
        rows = withoutEmbedFlag.data;
        error = withoutEmbedFlag.error;
    } else {
        rows = withEmbedFlag.data;
        error = withEmbedFlag.error;
    }

    if (error) {
        if (isMissingColumnError(error, 'plan_key')) throw error;
        throw error;
    }

    let bestTier = null;
    (rows || []).forEach(function (row) {
        const plan = normalizeSubscriptionPlan(row.subscription_plans);
        const tier = embedTierFromPlan(plan);
        if (tier) {
            bestTier = pickHigherEmbedTier(bestTier, tier);
            return;
        }
        if (plan && plan.embed_enabled === true) {
            bestTier = pickHigherEmbedTier(bestTier, '300');
        }
    });
    return bestTier;
}

function getEmbedTierConfig(tier) {
    return EMBED_TIER_CONFIG[tier] || null;
}

function embedBrandingForTier(tier) {
    const cfg = getEmbedTierConfig(tier);
    return {
        show_powered_by: cfg ? cfg.showPoweredBy !== false : true,
        tier: tier || null
    };
}

/** 公開 iframe 用：只讀實例建立時寫入的 branding，不查訂閱 */
function embedBrandingFromInstance(instanceRow) {
    if (!instanceRow) return { show_powered_by: true, tier: null };
    return {
        show_powered_by: instanceRow.show_powered_by !== false,
        tier: null
    };
}

function resolveEmbedMediaWallFromInstance(instanceRow) {
    return !!(instanceRow && instanceRow.show_on_media_wall !== false);
}

function resolveEmbedMediaWallVisible(tier, instanceRow) {
    const cfg = getEmbedTierConfig(tier);
    if (!cfg) return false;
    if (cfg.wallMode === 'always') return true;
    if (cfg.wallMode === 'configurable') {
        return instanceRow && instanceRow.show_on_media_wall !== false;
    }
    return false;
}

async function countActiveEmbedInstances(supabase, manufacturerId) {
    const { count, error } = await supabase
        .from('manufacturer_embed_instances')
        .select('id', { count: 'exact', head: true })
        .eq('manufacturer_id', manufacturerId)
        .eq('is_active', true);
    if (error) {
        if (isMissingTableError(error)) return 0;
        throw error;
    }
    return count || 0;
}

async function assertEmbedInstanceQuota(supabase, manufacturerId, vendorUserId) {
    const tier = await resolveEmbedPlanTier(supabase, vendorUserId);
    if (!tier) {
        throw new EmbedSimulatorError('embed_disabled', 403, '取得嵌入碼需付費方案（300／900／1800）');
    }
    const cfg = getEmbedTierConfig(tier);
    if (cfg && cfg.maxInstances != null) {
        const used = await countActiveEmbedInstances(supabase, manufacturerId);
        if (used >= cfg.maxInstances) {
            throw new EmbedSimulatorError('embed_instance_limit', 403, 'iframe 組數已達方案上限（' + cfg.maxInstances + ' 組）');
        }
    }
    return tier;
}

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
    if (!err) return false;
    if (err.code === '42P01') return true;
    if (err.code === '42703') return false;
    const msg = String(err.message || '');
    return /relation .* does not exist/i.test(msg) || /\btable .* does not exist/i.test(msg);
}

function isMissingColumnError(err, col) {
    return err && err.code === '42703' && String(err.message || '').includes(col);
}

const EMBED_INSTANCE_SELECT_FULL =
    'id, manufacturer_id, name, embed_key, embed_secret, prototype_asset_id, allowed_origins, rate_limit_per_ip_hour, daily_cap, monthly_cap, is_active, show_on_media_wall, show_powered_by';
const EMBED_INSTANCE_SELECT_BASE =
    'id, manufacturer_id, name, embed_key, embed_secret, prototype_asset_id, allowed_origins, rate_limit_per_ip_hour, daily_cap, monthly_cap, is_active';

async function fetchEmbedInstanceByKey(supabase, embedKey) {
    let result = await supabase
        .from('manufacturer_embed_instances')
        .select(EMBED_INSTANCE_SELECT_FULL)
        .eq('embed_key', embedKey)
        .maybeSingle();
    if (result.error && result.error.code === '42703') {
        result = await supabase
            .from('manufacturer_embed_instances')
            .select(EMBED_INSTANCE_SELECT_BASE)
            .eq('embed_key', embedKey)
            .maybeSingle();
        if (!result.error && result.data) {
            result.data.show_on_media_wall = true;
            result.data.show_powered_by = true;
        }
    } else if (!result.error && result.data) {
        if (result.data.show_on_media_wall === undefined) result.data.show_on_media_wall = true;
        if (result.data.show_powered_by === undefined) result.data.show_powered_by = true;
    }
    return result;
}

async function resolveEmbedInstance(supabase, embedId, sig) {
    const key = String(embedId || '').trim();
    if (!key || !sig) {
        throw new EmbedSimulatorError('invalid_signature', 403, '無效的嵌入連結');
    }
    let result;
    try {
        result = await fetchEmbedInstanceByKey(supabase, key);
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
    if (row && row.show_on_media_wall === undefined) row.show_on_media_wall = true;
    if (row && row.show_powered_by === undefined) row.show_powered_by = true;
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
    const tier = await resolveEmbedPlanTier(supabase, vendorUserId);
    if (!tier) {
        throw new EmbedSimulatorError('embed_disabled', 403, '取得嵌入碼需付費方案（300／900／1800）');
    }
    return tier;
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

/** 生圖前確認廠商點數足夠（成功後才扣，固定 pointsRequired 點／次） */
async function resolveEmbedBilling(supabase, vendorUserId, pointsRequired) {
    const pts = Math.max(0, parseInt(pointsRequired, 10) || 0);
    if (!vendorUserId) {
        throw new EmbedSimulatorError('insufficient_credits', 402, '試做暫停，請聯絡廠商');
    }
    if (pts <= 0) {
        return { billing_type: 'credit_points', points_charged: 0 };
    }
    const { data: creditRow } = await supabase
        .from('user_credits')
        .select('balance')
        .eq('user_id', vendorUserId)
        .maybeSingle();
    const balance = creditRow ? (creditRow.balance || 0) : 0;
    if (balance < pts) {
        throw new EmbedSimulatorError('insufficient_credits', 402, '試做暫停，請聯絡廠商');
    }
    return { billing_type: 'credit_points', points_charged: pts };
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

function buildSimulatorPagePath(embedKey, sig) {
    return '/embed/simulator.html?embed_id=' + encodeURIComponent(String(embedKey || '')) +
        '&sig=' + encodeURIComponent(String(sig || ''));
}

function buildSimulatorPageUrl(origin, embedKey, secret) {
    const sig = computeEmbedSig(embedKey, secret);
    const path = buildSimulatorPagePath(embedKey, sig);
    const base = String(origin || '').replace(/\/$/, '');
    return base ? base + path : path;
}

function buildSimulatorIframeSnippet(pageUrl, opts) {
    opts = opts || {};
    let h = Number(opts.height);
    if (!Number.isFinite(h) || h < 200) h = 680;
    const title = String(opts.title || '產品試做').replace(/"/g, '&quot;');
    const src = String(pageUrl || '').replace(/"/g, '&quot;');
    return '<iframe src="' + src + '" width="100%" height="' + h + '" style="border:0;" loading="lazy" title="' + title + '"></iframe>';
}

function randomEmbedKey() {
    return 'sim-' + crypto.randomBytes(10).toString('hex');
}

function randomEmbedSecret() {
    return crypto.randomBytes(32).toString('hex');
}

function publicOriginFromRequest(req) {
    const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0].trim();
    const host = (req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
    return host ? proto + '://' + host : '';
}

function mapEmbedInstanceForVendor(row, origin, opts) {
    if (!row || !row.embed_key || !row.embed_secret) return null;
    const pageUrl = buildSimulatorPageUrl(origin, row.embed_key, row.embed_secret);
    return {
        id: row.id,
        name: row.name || '',
        embed_key: row.embed_key,
        prototype_asset_id: row.prototype_asset_id,
        is_active: row.is_active !== false,
        show_on_media_wall: row.show_on_media_wall !== false,
        page_url: pageUrl,
        iframe_snippet: buildSimulatorIframeSnippet(pageUrl, opts || {}),
        preview_path: buildSimulatorPagePath(row.embed_key, computeEmbedSig(row.embed_key, row.embed_secret))
    };
}

module.exports = {
    EmbedSimulatorError,
    EMBED_TIER_CONFIG,
    computeEmbedSig,
    verifyEmbedSig,
    getRequestClientIp,
    hashVisitorIp,
    resolveEmbedInstance,
    resolveEmbedPlanTier,
    getEmbedTierConfig,
    embedBrandingForTier,
    embedBrandingFromInstance,
    resolveEmbedMediaWallFromInstance,
    resolveEmbedMediaWallVisible,
    countActiveEmbedInstances,
    assertEmbedInstanceQuota,
    assertEmbedFeatureEnabled,
    checkIpHourlyLimit,
    getInstanceUsageCounts,
    assertCaps,
    resolveEmbedBilling,
    incrementDailyUsage,
    chargeVendorCredits,
    manufacturerLogoFromRow,
    sendEmbedError,
    buildSimulatorPagePath,
    buildSimulatorPageUrl,
    buildSimulatorIframeSnippet,
    randomEmbedKey,
    randomEmbedSecret,
    publicOriginFromRequest,
    mapEmbedInstanceForVendor
};
