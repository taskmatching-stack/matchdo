'use strict';

/**
 * 會員結構統計：當下與歷月月底的免費／付費、年付／月付、方案等級占比。
 * 不含管理員／測試員。歷史月底以當時有效訂閱區間重建（每人取 start 最晚的一筆），不是當月新訂單數。
 */

const FREE_LEVEL = '一般';
const PAGE_SIZE = 1000;
const FETCH_CAP = 20000;

function isStaffRole(role) {
    const r = String(role || 'user').toLowerCase();
    return r === 'admin' || r === 'tester';
}

function isPaidLevel(memberLevel) {
    const level = (memberLevel != null ? String(memberLevel).trim() : '') || FREE_LEVEL;
    return level !== FREE_LEVEL;
}

function levelFromPlanName(planName) {
    const name = (planName && String(planName).trim()) || '';
    if (name === '進階' || name === '尊榮' || name === 'VIP') return name;
    if (!name) return FREE_LEVEL;
    return '進階';
}

function recentMonthKeysDesc(monthCount) {
    const n = Math.min(Math.max(parseInt(monthCount, 10) || 12, 1), 36);
    const keys = [];
    const d = new Date();
    d.setUTCDate(1);
    d.setUTCHours(0, 0, 0, 0);
    for (let i = 0; i < n; i++) {
        keys.push(d.toISOString().slice(0, 7));
        d.setUTCMonth(d.getUTCMonth() - 1);
    }
    return keys;
}

/** YYYY-MM → 該 UTC 月底最後一毫秒 */
function monthEndIso(yyyyMm) {
    const parts = String(yyyyMm || '').split('-');
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (!y || !m) return new Date().toISOString();
    return new Date(Date.UTC(y, m, 1) - 1).toISOString();
}

function pct(n, total) {
    if (!total) return 0;
    return Math.round((Number(n) || 0) * 1000 / total) / 10;
}

function bump(map, key) {
    const k = key || '—';
    map[k] = (map[k] || 0) + 1;
}

async function fetchAllRows(supabase, table, selectCols) {
    const all = [];
    let from = 0;
    for (;;) {
        const { data, error } = await supabase.from(table).select(selectCols).range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        const rows = data || [];
        for (let i = 0; i < rows.length; i++) all.push(rows[i]);
        if (rows.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
        if (from >= FETCH_CAP) break;
    }
    return all;
}

function coveringSub(subsByUser, userId, asOfMs) {
    const list = subsByUser[userId] || [];
    let best = null;
    let bestStart = -1;
    for (let i = 0; i < list.length; i++) {
        const s = list[i];
        const start = Date.parse(s.start_date);
        const end = Date.parse(s.end_date);
        if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
        if (start <= asOfMs && end > asOfMs && start >= bestStart) {
            bestStart = start;
            best = s;
        }
    }
    return best;
}

function latestBillingOrder(ordersByUser, userId, asOfMs) {
    const list = ordersByUser[userId] || [];
    let best = null;
    let bestT = -1;
    for (let i = 0; i < list.length; i++) {
        const o = list[i];
        const t = Date.parse(o.paid_at || o.created_at);
        if (!Number.isFinite(t) || t > asOfMs) continue;
        if (t >= bestT) {
            bestT = t;
            best = o;
        }
    }
    return best;
}

function classifyBilling(sub, order) {
    if (order) {
        const t = String(order.order_type || '').toLowerCase();
        if (t === 'yearly') return 'yearly';
        if (t === 'subscription') return 'monthly';
    }
    if (sub) {
        const dur = parseInt(sub.duration_months, 10) || 0;
        if (dur >= 12) return 'yearly';
        const start = Date.parse(sub.start_date);
        const end = Date.parse(sub.end_date);
        if (Number.isFinite(start) && Number.isFinite(end) && (end - start) >= 10 * 30.44 * 86400000) {
            return 'yearly';
        }
    }
    return 'paid_other';
}

function snapshotAt(profiles, subsByUser, ordersByUser, asOfIso, opts) {
    const asOfMs = Date.parse(asOfIso);
    const isCurrent = !!(opts && opts.isCurrent);
    let staffExcluded = 0;
    const billing = { yearly: 0, monthly: 0, paid_other: 0, free: 0 };
    const levels = {};
    const plans = {};

    for (let i = 0; i < (profiles || []).length; i++) {
        const p = profiles[i];
        if (!p || !p.id) continue;
        if (p.created_at) {
            const created = Date.parse(p.created_at);
            if (Number.isFinite(created) && created > asOfMs) continue;
        }
        if (isStaffRole(p.role)) {
            staffExcluded += 1;
            continue;
        }
        const sub = coveringSub(subsByUser, p.id, asOfMs);
        const plan = sub && sub.plan ? sub.plan : null;
        const price = plan ? (parseInt(plan.price, 10) || 0) : 0;
        const paidBySub = !!(sub && price > 0);
        const paidByLevel = isCurrent && isPaidLevel(p.member_level);

        let bill;
        let level;
        let planLabel;
        if (paidBySub) {
            level = levelFromPlanName(plan && plan.name);
            planLabel = (plan && (plan.name || plan.plan_key)) || '付費方案';
            bill = classifyBilling({
                start_date: sub.start_date,
                end_date: sub.end_date,
                duration_months: plan && plan.duration_months
            }, latestBillingOrder(ordersByUser, p.id, asOfMs));
        } else if (paidByLevel) {
            level = String(p.member_level || '').trim() || '進階';
            planLabel = '後台等級（無有效訂閱）';
            bill = 'paid_other';
        } else {
            level = FREE_LEVEL;
            planLabel = '免費';
            bill = 'free';
        }
        bump(billing, bill);
        bump(levels, level);
        bump(plans, planLabel);
    }

    const memberCount = billing.yearly + billing.monthly + billing.paid_other + billing.free;
    return {
        as_of: asOfIso,
        member_count: memberCount,
        staff_excluded: staffExcluded,
        paid_count: memberCount - billing.free,
        free_count: billing.free,
        billing: billing,
        levels: levels,
        plans: plans
    };
}

function countMapToRows(obj, total) {
    const keys = Object.keys(obj || {});
    keys.sort(function (a, b) {
        return (obj[b] || 0) - (obj[a] || 0);
    });
    return keys.map(function (k) {
        return { key: k, count: obj[k] || 0, pct: pct(obj[k], total) };
    });
}

function withPercents(snapshot) {
    const total = snapshot.member_count || 0;
    const billing = snapshot.billing || {};
    return {
        as_of: snapshot.as_of,
        month: snapshot.month,
        label: snapshot.label,
        member_count: total,
        staff_excluded: snapshot.staff_excluded || 0,
        paid_count: snapshot.paid_count || 0,
        paid_pct: pct(snapshot.paid_count, total),
        free_count: snapshot.free_count || 0,
        free_pct: pct(snapshot.free_count, total),
        billing: {
            yearly: { count: billing.yearly || 0, pct: pct(billing.yearly, total) },
            monthly: { count: billing.monthly || 0, pct: pct(billing.monthly, total) },
            paid_other: { count: billing.paid_other || 0, pct: pct(billing.paid_other, total) },
            free: { count: billing.free || 0, pct: pct(billing.free, total) }
        },
        levels: countMapToRows(snapshot.levels, total),
        plans: countMapToRows(snapshot.plans, total)
    };
}

function indexSubsByUser(subRows) {
    const subsByUser = {};
    (subRows || []).forEach(function (s) {
        const uid = s && s.user_id;
        if (!uid) return;
        const plan = s.subscription_plans || {};
        if (!subsByUser[uid]) subsByUser[uid] = [];
        subsByUser[uid].push({
            start_date: s.start_date,
            end_date: s.end_date,
            plan: {
                name: plan.name,
                price: plan.price,
                plan_key: plan.plan_key,
                duration_months: plan.duration_months
            }
        });
    });
    return subsByUser;
}

function indexPaidBillingOrders(orderRows) {
    const ordersByUser = {};
    (orderRows || []).forEach(function (o) {
        if (!o || o.status !== 'paid') return;
        const t = String(o.order_type || '').toLowerCase();
        if (t !== 'yearly' && t !== 'subscription') return;
        const uid = o.user_id;
        if (!uid) return;
        if (!ordersByUser[uid]) ordersByUser[uid] = [];
        ordersByUser[uid].push(o);
    });
    return ordersByUser;
}

async function buildMembershipStructureStats(supabase, options) {
    const monthKeys = recentMonthKeysDesc(options && options.months);
    const nowIso = new Date().toISOString();

    let profiles;
    try {
        profiles = await fetchAllRows(supabase, 'profiles', 'id, role, member_level, created_at');
    } catch (_) {
        profiles = await fetchAllRows(supabase, 'profiles', 'id, role, member_level');
    }

    const subRows = await fetchAllRows(
        supabase,
        'user_subscriptions',
        'id, user_id, start_date, end_date, plan_id, subscription_plans(name, price, plan_key, duration_months)'
    );
    const subsByUser = indexSubsByUser(subRows);

    let orderRows = [];
    try {
        orderRows = await fetchAllRows(supabase, 'payment_orders', 'user_id, order_type, status, paid_at, created_at');
    } catch (_) {
        orderRows = [];
    }
    const ordersByUser = indexPaidBillingOrders(orderRows);

    const currentRaw = snapshotAt(profiles, subsByUser, ordersByUser, nowIso, { isCurrent: true });
    const current = withPercents(currentRaw);
    current.month = monthKeys[0];
    current.label = monthKeys[0] + '（目前）';

    const monthly = monthKeys.map(function (key, idx) {
        const asOf = idx === 0 ? nowIso : monthEndIso(key);
        const snap = withPercents(snapshotAt(profiles, subsByUser, ordersByUser, asOf, { isCurrent: idx === 0 }));
        snap.month = key;
        snap.label = idx === 0 ? (key + '（目前）') : (key + ' 月底');
        return snap;
    });

    return {
        generated_at: nowIso,
        current: current,
        monthly: monthly
    };
}

module.exports = {
    FREE_LEVEL,
    isStaffRole,
    isPaidLevel,
    levelFromPlanName,
    recentMonthKeysDesc,
    monthEndIso,
    pct,
    coveringSub,
    classifyBilling,
    snapshotAt,
    withPercents,
    indexSubsByUser,
    indexPaidBillingOrders,
    buildMembershipStructureStats
};
