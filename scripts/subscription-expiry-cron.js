#!/usr/bin/env node
'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { createClient } = require('@supabase/supabase-js');
const subscriptionExpiry = require('../lib/subscription-expiry');
const ugcRetention = require('../lib/ugc-retention');

async function reconcileUserTier(supabase, userId) {
    const now = new Date().toISOString();
    const { data: paidRows } = await supabase
        .from('user_subscriptions')
        .select('id, subscription_plans(price)')
        .eq('user_id', userId)
        .eq('status', 'active')
        .gt('end_date', now);
    const paidBySub = (paidRows || []).some(function (r) {
        return r.subscription_plans && (r.subscription_plans.price || 0) > 0;
    });
    if (paidBySub) return { userId, skipped: true };

    const { data: prof } = await supabase
        .from('profiles')
        .select('member_level, membership_catalog_tier')
        .eq('id', userId)
        .maybeSingle();
    const level = (prof && prof.member_level) ? String(prof.member_level).trim() : '一般';
    const tierPrev = (prof && prof.membership_catalog_tier) ? String(prof.membership_catalog_tier) : null;
    const tierNow = 'free';

    if (level !== '一般') {
        await supabase.from('profiles').update({ member_level: '一般' }).eq('id', userId);
    }
    if (tierPrev === tierNow) return { userId, tierChanged: false };

    await supabase.from('profiles').update({ membership_catalog_tier: tierNow }).eq('id', userId);
    const kind = await ugcRetention.resolveDowngradeKind(supabase, userId);
    await ugcRetention.applyDowngradeToFree(supabase, userId, { kind });
    return { userId, tierChanged: true, kind };
}

async function main() {
    const baseUrl = (process.env.BASE_URL || '').replace(/\/$/, '');
    const secret = process.env.INTERNAL_CRON_SECRET || '';
    if (baseUrl && secret) {
        const res = await fetch(baseUrl + '/api/internal/subscription-expiry-cron', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + secret,
                'Content-Type': 'application/json'
            }
        });
        const text = await res.text();
        let body;
        try { body = JSON.parse(text); } catch (_) { body = { raw: text }; }
        if (!res.ok) {
            console.error(JSON.stringify({ ok: false, status: res.status, body }, null, 2));
            process.exit(1);
        }
        console.log(JSON.stringify(body, null, 2));
        return;
    }

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (or set BASE_URL + INTERNAL_CRON_SECRET)');
        process.exit(1);
    }
    const supabase = createClient(url, key);
    const result = await subscriptionExpiry.expireOverdueSubscriptions(supabase);
    const reconciled = [];
    for (let i = 0; i < result.userIds.length; i++) {
        reconciled.push(await reconcileUserTier(supabase, result.userIds[i]));
    }
    console.log(JSON.stringify({
        ok: true,
        at: new Date().toISOString(),
        expired: result.expired,
        reconciled
    }, null, 2));
}

main().catch(function (e) {
    console.error(e);
    process.exit(1);
});
