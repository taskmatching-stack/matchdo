'use strict';

/**
 * PayPal REST v1（Subscriptions / Catalog）— 使用 fetch + OAuth client_credentials
 */

function getPayPalApiBase(sandbox) {
    return sandbox !== false
        ? 'https://api-m.sandbox.paypal.com'
        : 'https://api-m.paypal.com';
}

let accessTokenCache = { token: '', expiresAt: 0, key: '' };

async function getPayPalAccessToken(paypalConfig) {
    if (!paypalConfig || !paypalConfig.clientId || !paypalConfig.clientSecret) {
        throw new Error('PayPal 金流尚未設定');
    }
    const cacheKey = paypalConfig.clientId + '|' + (paypalConfig.sandbox !== false ? 'sandbox' : 'live');
    const now = Date.now();
    if (accessTokenCache.key === cacheKey && accessTokenCache.token && accessTokenCache.expiresAt > now + 60000) {
        return accessTokenCache.token;
    }
    const base = getPayPalApiBase(paypalConfig.sandbox);
    const auth = Buffer.from(paypalConfig.clientId + ':' + paypalConfig.clientSecret).toString('base64');
    const res = await fetch(base + '/v1/oauth2/token', {
        method: 'POST',
        headers: {
            Authorization: 'Basic ' + auth,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
    });
    const data = await res.json().catch(function () { return {}; });
    if (!res.ok || !data.access_token) {
        throw new Error((data && data.error_description) || (data && data.message) || 'PayPal OAuth 失敗');
    }
    accessTokenCache = {
        key: cacheKey,
        token: data.access_token,
        expiresAt: now + (parseInt(data.expires_in, 10) || 3600) * 1000
    };
    return data.access_token;
}

async function paypalApiRequest(paypalConfig, method, apiPath, body) {
    const token = await getPayPalAccessToken(paypalConfig);
    const base = getPayPalApiBase(paypalConfig.sandbox);
    const opts = {
        method: method || 'GET',
        headers: {
            Authorization: 'Bearer ' + token,
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Prefer: 'return=representation'
        }
    };
    if (body != null && method !== 'GET') opts.body = JSON.stringify(body);
    const res = await fetch(base + apiPath, opts);
    const text = await res.text();
    let data = {};
    if (text) {
        try { data = JSON.parse(text); } catch (_) { data = { raw: text }; }
    }
    if (!res.ok) {
        const msg = (data && data.message) || (data && data.details && data.details[0] && data.details[0].description) || text || res.statusText;
        const err = new Error(msg || 'PayPal API 錯誤');
        err.status = res.status;
        err.paypal = data;
        throw err;
    }
    return data;
}

function billingPlanCacheKey(planKey, billing) {
    return 'paypal_billing_plan_' + String(planKey || '').trim() + '_' + String(billing || 'monthly');
}

function formatUsdPrice(amount) {
    const n = parseFloat(amount);
    if (!Number.isFinite(n) || n <= 0) return '0.00';
    return n.toFixed(2);
}

/**
 * @param {function(string): Promise<string>} getConfigValue
 * @param {function(string, string): Promise<void>} setConfigValue
 */
async function ensurePayPalCatalogProduct(paypalConfig, getConfigValue, setConfigValue) {
    const existing = await getConfigValue('paypal_catalog_product_id');
    if (existing) return existing;
    const created = await paypalApiRequest(paypalConfig, 'POST', '/v1/catalogs/products', {
        name: 'MATCHDO Subscription',
        description: 'MATCHDO platform subscription plans',
        type: 'SERVICE',
        category: 'SOFTWARE'
    });
    const id = created && created.id;
    if (!id) throw new Error('無法建立 PayPal Product');
    await setConfigValue('paypal_catalog_product_id', id);
    return id;
}

async function ensurePayPalBillingPlan(paypalConfig, opts, getConfigValue, setConfigValue) {
    const planKey = String(opts.planKey || '').trim();
    const billing = opts.billing === 'yearly' ? 'yearly' : 'monthly';
    const amountUsd = formatUsdPrice(opts.amountUsd);
    const cacheKey = billingPlanCacheKey(planKey, billing);
    const existing = await getConfigValue(cacheKey);
    if (existing) return existing;

    const productId = await ensurePayPalCatalogProduct(paypalConfig, getConfigValue, setConfigValue);
    const intervalUnit = billing === 'yearly' ? 'YEAR' : 'MONTH';
    const intervalCount = 1;
    const planName = 'MATCHDO ' + planKey + ' ' + (billing === 'yearly' ? 'Yearly' : 'Monthly');

    const created = await paypalApiRequest(paypalConfig, 'POST', '/v1/billing/plans', {
        product_id: productId,
        name: planName,
        description: planName,
        status: 'ACTIVE',
        billing_cycles: [{
            frequency: { interval_unit: intervalUnit, interval_count: intervalCount },
            tenure_type: 'REGULAR',
            sequence: 1,
            total_cycles: 0,
            pricing_scheme: {
                fixed_price: { value: amountUsd, currency_code: 'USD' }
            }
        }],
        payment_preferences: {
            auto_bill_outstanding: true,
            setup_fee_failure_action: 'CONTINUE',
            payment_failure_threshold: 3
        }
    });
    const planId = created && created.id;
    if (!planId) throw new Error('無法建立 PayPal Billing Plan');
    await setConfigValue(cacheKey, planId);
    return planId;
}

async function createPayPalSubscription(paypalConfig, opts) {
    const body = {
        plan_id: opts.planId,
        custom_id: String(opts.customId || '').slice(0, 127),
        application_context: {
            brand_name: 'MATCHDO',
            locale: 'zh-TW',
            shipping_preference: 'NO_SHIPPING',
            user_action: 'SUBSCRIBE_NOW',
            return_url: opts.returnUrl,
            cancel_url: opts.cancelUrl
        }
    };
    return paypalApiRequest(paypalConfig, 'POST', '/v1/billing/subscriptions', body);
}

async function getPayPalSubscription(paypalConfig, subscriptionId) {
    return paypalApiRequest(paypalConfig, 'GET', '/v1/billing/subscriptions/' + encodeURIComponent(subscriptionId));
}

async function cancelPayPalSubscription(paypalConfig, subscriptionId, reason) {
    const body = reason ? { reason: String(reason).slice(0, 128) } : {};
    return paypalApiRequest(
        paypalConfig,
        'POST',
        '/v1/billing/subscriptions/' + encodeURIComponent(subscriptionId) + '/cancel',
        body
    );
}

function isPayPalSubscriptionTerminalStatus(status) {
    const s = String(status || '').toUpperCase();
    return s === 'CANCELLED' || s === 'EXPIRED';
}

function isPayPalSubscriptionMustCancelStatus(status) {
    const s = String(status || '').toUpperCase();
    return s === 'ACTIVE' || s === 'APPROVED' || s === 'SUSPENDED' || s === 'APPROVAL_PENDING';
}

function extractPayPalApprovalUrl(resource) {
    const links = (resource && resource.links) || [];
    const found = links.find(function (l) { return l && l.rel === 'approve'; });
    return found && found.href ? found.href : null;
}

module.exports = {
    getPayPalApiBase,
    getPayPalAccessToken,
    paypalApiRequest,
    billingPlanCacheKey,
    ensurePayPalCatalogProduct,
    ensurePayPalBillingPlan,
    createPayPalSubscription,
    getPayPalSubscription,
    cancelPayPalSubscription,
    isPayPalSubscriptionTerminalStatus,
    isPayPalSubscriptionMustCancelStatus,
    extractPayPalApprovalUrl,
    formatUsdPrice
};
