'use strict';

/** MatchDO 官方信箱（@matchdo.cc）：可單次儲值加點，不可線上訂閱自動扣款 */
function isMatchdoInternalEmail(email) {
    const e = String(email || '').trim().toLowerCase();
    return !!e && e.endsWith('@matchdo.cc');
}

async function isMatchdoInternalUserId(supabase, userId) {
    if (!supabase || !userId) return false;
    const { data } = await supabase.from('profiles').select('email').eq('id', userId).maybeSingle();
    return isMatchdoInternalEmail(data && data.email);
}

function blockMatchdoInternalSubscriptionCheckout(user, res) {
    if (!isMatchdoInternalEmail(user && user.email)) return false;
    res.status(403).json({
        error: 'MatchDO 官方帳號（@matchdo.cc）不開放線上訂閱扣款',
        hint: '可至「我的點數」單次儲值加點；會員方案請由管理員在後台開通（不含自動扣款）。'
    });
    return true;
}

module.exports = {
    isMatchdoInternalEmail,
    isMatchdoInternalUserId,
    blockMatchdoInternalSubscriptionCheckout
};
