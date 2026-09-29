'use strict';

const listDiscount = require('./pricing-list-discount');
const parseListDiscountPercent = listDiscount.parseListDiscountPercent;
const amountFromListDiscount = listDiscount.amountFromListDiscount;

const PUBLIC_YEARLY_PLAN_KEYS = Object.freeze(['tier2', 'tier3', 'tier4']);
const SORT_ORDER_TO_PLAN_KEY = Object.freeze({ 1: 'tier2', 2: 'tier3', 3: 'tier4' });
const DEFAULT_INPUT_TZ = 'Asia/Taipei';

function normalizePlanKey(raw) {
    const k = String(raw || '').trim().toLowerCase();
    return PUBLIC_YEARLY_PLAN_KEYS.indexOf(k) !== -1 ? k : '';
}

function resolvePublicPlanKey(plan) {
    if (!plan) return '';
    const fromKey = normalizePlanKey(plan.plan_key);
    if (fromKey) return fromKey;
    const sort = parseInt(plan.sort_order, 10);
    return SORT_ORDER_TO_PLAN_KEY[sort] || '';
}

function isChineseUiLang(lang) {
    const l = String(lang || '').trim().toLowerCase().replace(/_/g, '-');
    return l === 'zh' || l.indexOf('zh-') === 0;
}

function checkoutUsesTwd(lang) {
    return isChineseUiLang(lang);
}

function parseOptionalPositiveInt(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
}

function parseOptionalPositiveUsd(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = parseFloat(v);
    if (!Number.isFinite(n) || n <= 0) return null;
    return roundUsd(n);
}

function computeListYearlyPrices(plan, resolveUsdMonthly) {
    const twdMonthly = Math.abs(parseInt(plan && plan.price, 10) || 0);
    const usdMonthly = resolveUsdMonthly ? resolveUsdMonthly(plan) : 0;
    const customTwd = parseOptionalPositiveInt(plan && plan.yearly_price_twd);
    const customUsd = parseOptionalPositiveUsd(plan && plan.yearly_price_usd);
    return {
        yearly_list_twd: customTwd != null ? customTwd : (twdMonthly > 0 ? twdMonthly * 10 : 0),
        yearly_list_usd: customUsd != null ? customUsd : (usdMonthly > 0 ? roundUsd(usdMonthly * 10) : 0)
    };
}

function computeYearlyCredits(plan) {
    const monthly = Math.abs(parseInt(plan && plan.credits_monthly, 10) || 0);
    return monthly > 0 ? monthly * 12 : 0;
}

function computeListMonthlyPrices(plan, resolveUsdMonthly) {
    const twd = Math.abs(parseInt(plan && plan.price, 10) || 0);
    const usd = resolveUsdMonthly ? roundUsd(resolveUsdMonthly(plan)) : 0;
    return { list_twd: twd, list_usd: usd };
}

function roundUsd(n) {
    const x = parseFloat(n);
    if (!Number.isFinite(x) || x < 0) return 0;
    return Math.round(x * 100) / 100;
}

function campaignYearlySaleAmount(listAmount, rule, currency) {
    if (!rule || !(listAmount > 0)) return 0;
    const pct = parseListDiscountPercent(rule.list_discount_percent);
    if (pct != null) return amountFromListDiscount(listAmount, pct, currency);
    const cur = String(currency || 'TWD').toUpperCase() === 'USD' ? 'USD' : 'TWD';
    if (cur === 'TWD') return parseInt(rule.yearly_price_twd, 10) || 0;
    return roundUsd(rule.yearly_price_usd);
}

function ruleMapFromRows(rules) {
    const map = {};
    (rules || []).forEach(function (r) {
        const k = normalizePlanKey(r.plan_key);
        if (!k) return;
        map[k] = {
            yearly_price_twd: parseInt(r.yearly_price_twd, 10) || 0,
            yearly_price_usd: roundUsd(r.yearly_price_usd),
            list_discount_percent: parseListDiscountPercent(r.list_discount_percent)
        };
    });
    return map;
}

function attachCampaignPricingToPlans(plans, campaign, rules, resolveUsdMonthly) {
    const ruleMap = ruleMapFromRows(rules);
    const active = campaign && campaign.is_enabled !== false;
    const campaignMeta = active ? {
        id: campaign.id,
        title: campaign.title || '',
        title_en: campaign.title_en || campaign.title || '',
        starts_at: campaign.starts_at,
        ends_at: campaign.ends_at
    } : null;

    const enriched = (plans || []).map(function (plan) {
        const planKey = resolvePublicPlanKey(plan);
        const list = computeListYearlyPrices(plan, resolveUsdMonthly);
        const out = Object.assign({}, plan, {
            plan_key: planKey || plan.plan_key || null,
            yearly_list_twd: list.yearly_list_twd,
            yearly_list_usd: list.yearly_list_usd,
            yearly_sale_twd: null,
            yearly_sale_usd: null
        });
        if (active && planKey && ruleMap[planKey]) {
            const rule = ruleMap[planKey];
            const saleTwd = campaignYearlySaleAmount(list.yearly_list_twd, rule, 'TWD');
            const saleUsd = campaignYearlySaleAmount(list.yearly_list_usd, rule, 'USD');
            if (saleTwd > 0) out.yearly_sale_twd = saleTwd;
            if (saleUsd > 0) out.yearly_sale_usd = saleUsd;
        }
        return out;
    });

    return { plans: enriched, campaign: campaignMeta };
}

function buildCheckoutQuote(opts) {
    const o = opts && typeof opts === 'object' ? opts : {};
    const planKey = normalizePlanKey(o.planKey || o.plan);
    const billing = String(o.billing || '').trim().toLowerCase() === 'yearly' ? 'yearly' : 'monthly';
    const plan = o.plan;
    const resolveUsdMonthly = o.resolveUsdMonthly;
    const campaign = o.campaign;
    const rules = o.rules;
    const lang = o.lang;
    const useTwd = o.useTwd != null ? !!o.useTwd : checkoutUsesTwd(lang);

    if (!planKey || !plan) {
        const err = new Error('找不到方案');
        err.status = 400;
        throw err;
    }

    const creditsMonthly = Math.abs(parseInt(plan.credits_monthly, 10) || 0);
    if (billing === 'monthly') {
        const list = computeListMonthlyPrices(plan, resolveUsdMonthly);
        const amount = useTwd ? list.list_twd : list.list_usd;
        const currency = useTwd ? 'TWD' : 'USD';
        if (amount <= 0 || creditsMonthly <= 0) {
            const err = new Error('方案價格未設定');
            err.status = 400;
            throw err;
        }
        return {
            plan_key: planKey,
            billing: 'monthly',
            currency,
            amount: useTwd ? amount : roundUsd(amount),
            credits: creditsMonthly,
            list_amount: useTwd ? amount : roundUsd(amount),
            campaign_id: null,
            campaign_title: null,
            campaign_title_en: null
        };
    }

    const listYearly = computeListYearlyPrices(plan, resolveUsdMonthly);
    const listAmount = useTwd ? listYearly.yearly_list_twd : listYearly.yearly_list_usd;
    let amount = listAmount;
    let campaignId = null;
    let campaignTitle = null;
    let campaignTitleEn = null;

    if (campaign && campaign.is_enabled !== false) {
        const ruleMap = ruleMapFromRows(rules);
        const rule = ruleMap[planKey];
        if (rule) {
            const sale = campaignYearlySaleAmount(listAmount, rule, useTwd ? 'TWD' : 'USD');
            if (sale > 0) {
                amount = useTwd ? sale : roundUsd(sale);
                campaignId = campaign.id;
                campaignTitle = campaign.title || '';
                campaignTitleEn = campaign.title_en || campaign.title || '';
            }
        }
    }

    const credits = computeYearlyCredits(plan);
    const currency = useTwd ? 'TWD' : 'USD';
    if (amount <= 0 || credits <= 0) {
        const err = new Error('方案價格未設定');
        err.status = 400;
        throw err;
    }

    return {
        plan_key: planKey,
        billing: 'yearly',
        currency,
        amount: useTwd ? amount : roundUsd(amount),
        credits,
        list_amount: useTwd ? listAmount : roundUsd(listAmount),
        campaign_id: campaignId,
        campaign_title: campaignTitle,
        campaign_title_en: campaignTitleEn
    };
}

function amountsMatchQuote(quote, bodyAmount, bodyCredits) {
    if (!quote) return false;
    const credits = Math.abs(parseInt(bodyCredits, 10) || 0);
    if (credits !== quote.credits) return false;
    if (quote.currency === 'TWD') {
        const amt = Math.abs(parseInt(bodyAmount, 10) || 0);
        return amt === quote.amount;
    }
    const amt = roundUsd(bodyAmount);
    return amt === roundUsd(quote.amount);
}

function parseTaipeiLocalInput(raw) {
    const s = String(raw || '').trim();
    if (!s) return null;
    if (/[zZ]$/.test(s) || /[+-]\d{2}:\d{2}$/.test(s)) {
        const d = new Date(s);
        return Number.isNaN(d.getTime()) ? null : d.toISOString();
    }
    const normalized = s.replace(' ', 'T');
    const withSec = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalized)
        ? normalized + ':00'
        : normalized;
    const d = new Date(withSec + '+08:00');
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function formatInstantForTz(iso, timeZone) {
    if (!iso) return '';
    try {
        return new Date(iso).toLocaleString('zh-TW', {
            timeZone: timeZone || DEFAULT_INPUT_TZ,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    } catch (_) {
        return String(iso);
    }
}

function campaignLifecycle(campaign, now) {
    if (!campaign || campaign.is_enabled === false) return 'disabled';
    const t = now ? new Date(now).getTime() : Date.now();
    const start = new Date(campaign.starts_at).getTime();
    const end = new Date(campaign.ends_at).getTime();
    if (t < start) return 'scheduled';
    if (t >= end) return 'ended';
    return 'active';
}

function isCampaignActiveNow(campaign, now) {
    return campaignLifecycle(campaign, now) === 'active';
}

async function fetchActivePricingCampaign(supabase, now) {
    const at = now ? new Date(now).toISOString() : new Date().toISOString();
    const { data: rows, error } = await supabase
        .from('pricing_campaigns')
        .select('id, title, title_en, note_internal, starts_at, ends_at, input_timezone, is_enabled, priority')
        .eq('is_enabled', true)
        .lte('starts_at', at)
        .gt('ends_at', at)
        .order('priority', { ascending: false })
        .order('starts_at', { ascending: false })
        .limit(1);
    if (error) {
        if (error.code === '42P01') return { campaign: null, rules: [], error: 'MIGRATION_REQUIRED' };
        throw error;
    }
    const campaign = rows && rows[0] ? rows[0] : null;
    if (!campaign) return { campaign: null, rules: [] };
    const { data: rules, error: rErr } = await supabase
        .from('pricing_campaign_yearly_rules')
        .select('id, campaign_id, plan_key, yearly_price_twd, yearly_price_usd, list_discount_percent')
        .eq('campaign_id', campaign.id);
    if (rErr) throw rErr;
    return { campaign, rules: rules || [] };
}

async function fetchPricingCampaignById(supabase, id) {
    const { data: campaign, error } = await supabase
        .from('pricing_campaigns')
        .select('*')
        .eq('id', id)
        .maybeSingle();
    if (error) throw error;
    if (!campaign) return null;
    const { data: rules, error: rErr } = await supabase
        .from('pricing_campaign_yearly_rules')
        .select('*')
        .eq('campaign_id', id);
    if (rErr) throw rErr;
    return { campaign, rules: rules || [] };
}

async function listPricingCampaigns(supabase) {
    const { data: campaigns, error } = await supabase
        .from('pricing_campaigns')
        .select('*')
        .order('starts_at', { ascending: false });
    if (error) throw error;
    const ids = (campaigns || []).map(function (c) { return c.id; });
    let rules = [];
    if (ids.length) {
        const { data: ruleRows, error: rErr } = await supabase
            .from('pricing_campaign_yearly_rules')
            .select('*')
            .in('campaign_id', ids);
        if (rErr) throw rErr;
        rules = ruleRows || [];
    }
    return { campaigns: campaigns || [], rules };
}

function normalizeYearlyRulesInput(raw) {
    const list = Array.isArray(raw) ? raw : [];
    const out = [];
    list.forEach(function (row) {
        const plan_key = normalizePlanKey(row.plan_key);
        if (!plan_key) return;
        const pct = parseListDiscountPercent(row.list_discount_percent);
        if (pct != null) {
            out.push({
                plan_key,
                list_discount_percent: pct,
                yearly_price_twd: null,
                yearly_price_usd: null
            });
            return;
        }
        const yearly_price_twd = parseInt(row.yearly_price_twd, 10) || 0;
        const yearly_price_usd = roundUsd(row.yearly_price_usd);
        if (yearly_price_twd <= 0 || yearly_price_usd <= 0) return;
        out.push({ plan_key, yearly_price_twd, yearly_price_usd, list_discount_percent: null });
    });
    return out;
}

async function replaceCampaignRules(supabase, campaignId, rules) {
    await supabase.from('pricing_campaign_yearly_rules').delete().eq('campaign_id', campaignId);
    if (!rules.length) return;
    const rows = rules.map(function (r) {
        return {
            campaign_id: campaignId,
            plan_key: r.plan_key,
            yearly_price_twd: r.yearly_price_twd,
            yearly_price_usd: r.yearly_price_usd,
            list_discount_percent: r.list_discount_percent != null ? r.list_discount_percent : null
        };
    });
    const { error } = await supabase.from('pricing_campaign_yearly_rules').insert(rows);
    if (error) throw error;
}

async function createPricingCampaign(supabase, body) {
    const b = body && typeof body === 'object' ? body : {};
    const starts_at = parseTaipeiLocalInput(b.starts_at);
    const ends_at = parseTaipeiLocalInput(b.ends_at);
    if (!starts_at || !ends_at) {
        const err = new Error('請填寫有效的開始與結束時間（台北時間）');
        err.status = 400;
        throw err;
    }
    if (new Date(ends_at) <= new Date(starts_at)) {
        const err = new Error('結束時間必須晚於開始時間');
        err.status = 400;
        throw err;
    }
    const title = String(b.title || '').trim();
    if (!title) {
        const err = new Error('請填寫活動主題');
        err.status = 400;
        throw err;
    }
    const now = new Date().toISOString();
    const { data: row, error } = await supabase
        .from('pricing_campaigns')
        .insert({
            title,
            title_en: String(b.title_en || '').trim() || null,
            note_internal: String(b.note_internal || '').trim() || null,
            starts_at,
            ends_at,
            input_timezone: String(b.input_timezone || DEFAULT_INPUT_TZ).trim() || DEFAULT_INPUT_TZ,
            is_enabled: b.is_enabled !== false,
            priority: parseInt(b.priority, 10) || 0,
            updated_at: now
        })
        .select('*')
        .single();
    if (error) throw error;
    const rules = normalizeYearlyRulesInput(b.yearly_rules || b.rules);
    await replaceCampaignRules(supabase, row.id, rules);
    return fetchPricingCampaignById(supabase, row.id);
}

async function updatePricingCampaign(supabase, id, body) {
    const b = body && typeof body === 'object' ? body : {};
    const updates = { updated_at: new Date().toISOString() };
    if (b.title !== undefined) updates.title = String(b.title || '').trim();
    if (b.title_en !== undefined) updates.title_en = String(b.title_en || '').trim() || null;
    if (b.note_internal !== undefined) updates.note_internal = String(b.note_internal || '').trim() || null;
    if (b.is_enabled !== undefined) updates.is_enabled = !!b.is_enabled;
    if (b.priority !== undefined) updates.priority = parseInt(b.priority, 10) || 0;
    if (b.starts_at !== undefined) {
        const s = parseTaipeiLocalInput(b.starts_at);
        if (!s) {
            const err = new Error('開始時間格式無效');
            err.status = 400;
            throw err;
        }
        updates.starts_at = s;
    }
    if (b.ends_at !== undefined) {
        const e = parseTaipeiLocalInput(b.ends_at);
        if (!e) {
            const err = new Error('結束時間格式無效');
            err.status = 400;
            throw err;
        }
        updates.ends_at = e;
    }
    if (Object.keys(updates).length > 1) {
        const { error } = await supabase.from('pricing_campaigns').update(updates).eq('id', id);
        if (error) throw error;
    }
    if (b.yearly_rules !== undefined || b.rules !== undefined) {
        const rules = normalizeYearlyRulesInput(b.yearly_rules || b.rules);
        await replaceCampaignRules(supabase, id, rules);
    }
    return fetchPricingCampaignById(supabase, id);
}

async function deletePricingCampaign(supabase, id) {
    const { error } = await supabase.from('pricing_campaigns').delete().eq('id', id);
    if (error) throw error;
}

module.exports = {
    PUBLIC_YEARLY_PLAN_KEYS,
    DEFAULT_INPUT_TZ,
    normalizePlanKey,
    resolvePublicPlanKey,
    checkoutUsesTwd,
    computeListYearlyPrices,
    computeYearlyCredits,
    attachCampaignPricingToPlans,
    buildCheckoutQuote,
    amountsMatchQuote,
    parseTaipeiLocalInput,
    formatInstantForTz,
    campaignLifecycle,
    isCampaignActiveNow,
    fetchActivePricingCampaign,
    fetchPricingCampaignById,
    listPricingCampaigns,
    createPricingCampaign,
    updatePricingCampaign,
    deletePricingCampaign
};
