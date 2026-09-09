'use strict';

const MESSAGE_VERSION = '2026-09-09-v1';

function formatDateZh(iso) {
    if (!iso) return '';
    try {
        return new Date(iso).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch (_) {
        return String(iso).slice(0, 10);
    }
}

function buildInvoluntaryNotice(wallGraceUntil, graceDays) {
    const untilStr = formatDateZh(wallGraceUntil);
    const days = graceDays != null ? graceDays : 15;
    const title = '付費方案已結束，帳號已調整為免費方案';
    const bodyText = [
        '您的訂閱已到期或續訂未成功，帳號已調整為免費方案。',
        '',
        '您有 ' + days + ' 天的緩衝期（至 ' + untilStr + '）：',
        '· 緩衝期內，您先前設定為不公開的作品仍會維持不公開。',
        '· 緩衝期結束後，非人像作品將依免費方案規則公開展示於媒體牆；人像作品預設不上牆。',
        '',
        '若不希望特定作品被公開，請在緩衝期內至「我的設計」刪除該作品，或重新訂閱以維持不公開權限。',
        '',
        '免費方案圖片享有至少 90 天儲存保證（常使用的作品會保留更久）。'
    ].join('\n');
    return {
        notice_kind: 'involuntary_wall_grace',
        message_version: MESSAGE_VERSION,
        title,
        body_text: bodyText,
        wall_grace_until: wallGraceUntil,
        payload_json: {
            grace_days: days,
            wall_grace_until: wallGraceUntil,
            rules: ['wall_grace_private_maintained', 'after_grace_free_wall_non_portrait', 'delete_or_resubscribe_option']
        }
    };
}

function buildInvoluntaryDay7Reminder(wallGraceUntil, daysLeft) {
    const untilStr = formatDateZh(wallGraceUntil);
    const left = daysLeft != null ? daysLeft : 8;
    const title = '上牆緩衝期提醒：尚餘約 ' + left + ' 天';
    const bodyText = [
        '您的付費方案已結束，帳號目前為免費方案。',
        '',
        '上牆控制緩衝期將於 ' + untilStr + ' 結束（約剩 ' + left + ' 天）。',
        '· 緩衝期內，您先前設定為不公開的作品仍會維持不公開。',
        '· 緩衝期結束後，非人像作品將依免費方案規則公開展示於媒體牆。',
        '',
        '若不希望特定作品被公開，請在緩衝期內至「我的設計」刪除該作品，或重新訂閱以維持不公開權限。',
        '',
        '免費方案圖片享有至少 90 天儲存保證（常使用的作品會保留更久）。'
    ].join('\n');
    return {
        notice_kind: 'involuntary_wall_grace_day7',
        message_version: MESSAGE_VERSION,
        title,
        body_text: bodyText,
        wall_grace_until: wallGraceUntil,
        payload_json: {
            reminder_day: 7,
            days_remaining: left,
            wall_grace_until: wallGraceUntil,
            rules: ['wall_grace_private_maintained', 'after_grace_free_wall_non_portrait', 'delete_or_resubscribe_option']
        }
    };
}

function buildVoluntaryNotice() {
    const title = '已調整為免費方案';
    const bodyText = [
        '您已主動調整為免費方案。',
        '',
        '非人像作品將依免費方案規則展示於媒體牆；人像作品預設不上牆，可自行選擇公開。',
        '若不希望特定作品被公開，請至「我的設計」刪除或調整設定。',
        '',
        '免費方案圖片享有至少 90 天儲存保證（常使用的作品會保留更久）。'
    ].join('\n');
    return {
        notice_kind: 'voluntary_immediate',
        message_version: MESSAGE_VERSION,
        title,
        body_text: bodyText,
        wall_grace_until: null,
        payload_json: {
            rules: ['immediate_free_wall_non_portrait', 'portrait_default_private', 'delete_or_resubscribe_option']
        }
    };
}

async function insertNoticeRow(supabase, userId, built) {
    if (!supabase || !userId || !built) return null;
    const row = {
        user_id: userId,
        notice_kind: built.notice_kind,
        message_version: built.message_version,
        title: built.title,
        body_text: built.body_text,
        payload_json: built.payload_json,
        wall_grace_until: built.wall_grace_until
    };
    const { data, error } = await supabase
        .from('membership_downgrade_notices')
        .insert(row)
        .select('id, notice_kind, title, body_text, wall_grace_until, created_at, message_version')
        .single();
    if (error) {
        if (error.code === '42P01' || error.code === '42703') return null;
        throw error;
    }
    return data;
}

async function createDowngradeNotice(supabase, userId, kind, opts) {
    if (!supabase || !userId) return null;
    const built = kind === 'voluntary'
        ? buildVoluntaryNotice()
        : buildInvoluntaryNotice(
            opts && opts.wallGraceUntil,
            opts && opts.graceDays
        );
    return insertNoticeRow(supabase, userId, built);
}

function msDays(d) {
    return d * 24 * 60 * 60 * 1000;
}

async function hasDay7ReminderForGrace(supabase, userId, wallGraceUntil) {
    const { count, error } = await supabase
        .from('membership_downgrade_notices')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('notice_kind', 'involuntary_wall_grace_day7')
        .eq('wall_grace_until', wallGraceUntil);
    if (error) {
        if (error.code === '42P01' || error.code === '42703') return true;
        throw error;
    }
    return (Number(count) || 0) > 0;
}

async function runWallGraceDay7Reminders(supabase) {
    const stats = { created: 0, skipped: 0, errors: [] };
    if (!supabase) return stats;
    const now = new Date();
    const minRemainMs = msDays(7);
    const maxRemainMs = msDays(8.5);
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, wall_grace_until')
        .not('wall_grace_until', 'is', null)
        .gt('wall_grace_until', now.toISOString())
        .limit(500);
    if (error) {
        if (error.code === '42703') return stats;
        stats.errors.push(error.message);
        return stats;
    }
    for (let i = 0; i < (profiles || []).length; i++) {
        const prof = profiles[i];
        const until = new Date(prof.wall_grace_until);
        if (!Number.isFinite(until.getTime())) {
            stats.skipped += 1;
            continue;
        }
        const remainMs = until.getTime() - now.getTime();
        if (remainMs <= minRemainMs || remainMs > maxRemainMs) {
            stats.skipped += 1;
            continue;
        }
        try {
            const exists = await hasDay7ReminderForGrace(supabase, prof.id, prof.wall_grace_until);
            if (exists) {
                stats.skipped += 1;
                continue;
            }
            const daysLeft = Math.max(1, Math.ceil(remainMs / msDays(1)));
            const built = buildInvoluntaryDay7Reminder(prof.wall_grace_until, daysLeft);
            const created = await insertNoticeRow(supabase, prof.id, built);
            if (created) stats.created += 1;
            else stats.skipped += 1;
        } catch (e) {
            stats.errors.push((prof.id || '?') + ': ' + (e && e.message ? e.message : String(e)));
        }
    }
    return stats;
}

async function listAdminDowngradeNotices(supabase, opts) {
    const limitN = Math.min(100, Math.max(1, parseInt(opts && opts.limit, 10) || 30));
    const offsetN = Math.max(0, parseInt(opts && opts.offset, 10) || 0);
    const userId = String((opts && opts.userId) || '').trim();
    let q = supabase
        .from('membership_downgrade_notices')
        .select('id, user_id, notice_kind, title, body_text, wall_grace_until, created_at, first_shown_at, acknowledged_at, acknowledged_via, message_version', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offsetN, offsetN + limitN - 1);
    if (userId) q = q.eq('user_id', userId);
    const { data, error, count } = await q;
    if (error) {
        if (error.code === '42P01') return { items: [], total: 0, tables_ready: false };
        throw error;
    }
    return {
        items: data || [],
        total: Number(count) || 0,
        offset: offsetN,
        limit: limitN,
        tables_ready: true
    };
}

async function listPendingNotices(supabase, userId) {
    if (!supabase || !userId) return [];
    const { data, error } = await supabase
        .from('membership_downgrade_notices')
        .select('id, notice_kind, title, body_text, wall_grace_until, created_at, message_version, first_shown_at')
        .eq('user_id', userId)
        .is('acknowledged_at', null)
        .order('created_at', { ascending: true })
        .limit(5);
    if (error) {
        if (error.code === '42P01') return [];
        throw error;
    }
    return data || [];
}

async function markNoticeShown(supabase, noticeId, userId) {
    if (!supabase || !noticeId || !userId) return false;
    const now = new Date().toISOString();
    const { data: row } = await supabase
        .from('membership_downgrade_notices')
        .select('id, first_shown_at')
        .eq('id', noticeId)
        .eq('user_id', userId)
        .maybeSingle();
    if (!row) return false;
    if (row.first_shown_at) return true;
    const { error } = await supabase
        .from('membership_downgrade_notices')
        .update({ first_shown_at: now })
        .eq('id', noticeId)
        .eq('user_id', userId);
    return !error;
}

async function acknowledgeNotice(supabase, noticeId, userId, via) {
    if (!supabase || !noticeId || !userId) return false;
    const now = new Date().toISOString();
    const { data, error } = await supabase
        .from('membership_downgrade_notices')
        .update({
            acknowledged_at: now,
            acknowledged_via: via ? String(via).slice(0, 64) : 'api'
        })
        .eq('id', noticeId)
        .eq('user_id', userId)
        .is('acknowledged_at', null)
        .select('id')
        .maybeSingle();
    return !error && !!data;
}

module.exports = {
    MESSAGE_VERSION,
    buildInvoluntaryNotice,
    buildInvoluntaryDay7Reminder,
    buildVoluntaryNotice,
    createDowngradeNotice,
    runWallGraceDay7Reminders,
    listAdminDowngradeNotices,
    listPendingNotices,
    markNoticeShown,
    acknowledgeNotice
};
