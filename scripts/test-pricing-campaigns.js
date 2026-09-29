'use strict';

const pc = require('../lib/pricing-campaigns');

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

const plan = { price: 300, price_usd_monthly: 11, credits_monthly: 330, sort_order: 1 };
const resolveUsd = function (p) { return parseFloat(p.price_usd_monthly); };

const listDefault = pc.computeListYearlyPrices(plan, resolveUsd);
assert(listDefault.yearly_list_twd === 3000, 'default yearly twd ×10');
assert(listDefault.yearly_list_usd === 110, 'default yearly usd ×10');

const planCustomYearly = Object.assign({}, plan, { yearly_price_twd: 2800, yearly_price_usd: 99 });
const listCustom = pc.computeListYearlyPrices(planCustomYearly, resolveUsd);
assert(listCustom.yearly_list_twd === 2800, 'db yearly twd');
assert(listCustom.yearly_list_usd === 99, 'db yearly usd');

const campaign = { id: 'c1', title: '開學季', title_en: 'Back to school', is_enabled: true };
const rules = [{ plan_key: 'tier2', yearly_price_twd: 2500, yearly_price_usd: 95 }];

const enriched = pc.attachCampaignPricingToPlans([plan], campaign, rules, resolveUsd);
assert(enriched.plans[0].yearly_sale_twd === 2500, 'sale twd');
assert(enriched.plans[0].yearly_sale_usd === 95, 'sale usd');
assert(enriched.campaign && enriched.campaign.id === 'c1', 'campaign meta');

const yearlyQuote = pc.buildCheckoutQuote({
    planKey: 'tier2',
    billing: 'yearly',
    plan,
    lang: 'en',
    campaign,
    rules,
    resolveUsdMonthly: resolveUsd
});
assert(yearlyQuote.amount === 95, 'yearly usd sale');
assert(yearlyQuote.credits === 3960, 'yearly credits');
assert(yearlyQuote.campaign_id === 'c1', 'campaign id on quote');

const monthlyQuote = pc.buildCheckoutQuote({
    planKey: 'tier2',
    billing: 'monthly',
    plan,
    lang: 'en',
    campaign,
    rules,
    resolveUsdMonthly: resolveUsd
});
assert(monthlyQuote.amount === 11, 'monthly ignores campaign');
assert(!monthlyQuote.campaign_id, 'no campaign on monthly');

assert(pc.amountsMatchQuote(yearlyQuote, 95, 3960), 'match usd');
assert(!pc.amountsMatchQuote(yearlyQuote, 1, 3960), 'reject bad amount');

const iso = pc.parseTaipeiLocalInput('2026-10-01T00:00');
assert(iso && iso.indexOf('T') !== -1, 'taipei parse');

console.log('test-pricing-campaigns: ok');
