'use strict';

const crypto = require('crypto');

function ecpayCheckMacValue(params, hashKey, hashIV) {
    const exclude = ['CheckMacValue'];
    const pairs = Object.keys(params)
        .filter(function (k) { return !exclude.includes(k) && params[k] !== undefined && params[k] !== ''; })
        .sort()
        .map(function (k) { return k + '=' + params[k]; });
    const dataStr = pairs.join('&');
    const beforeHash = hashKey + dataStr + hashIV;
    const encoded = encodeURIComponent(beforeHash).toLowerCase().replace(/%20/g, '+');
    return crypto.createHash('sha256').update(encoded).digest('hex').toUpperCase();
}

function ecpayDoActionUrl(ecpayConfig) {
    const useProd = !!(ecpayConfig && ecpayConfig.useProduction);
    const api = (ecpayConfig && ecpayConfig.apiURL) || '';
    if (!useProd && /stage|payment-stage/i.test(api)) {
        return 'https://payment-stage.ecpay.com.tw/CreditDetail/DoAction';
    }
    if (useProd || /payment\.ecpay\.com\.tw/i.test(api)) {
        return 'https://payment.ecpay.com.tw/CreditDetail/DoAction';
    }
    return 'https://payment-stage.ecpay.com.tw/CreditDetail/DoAction';
}

function parseEcpayFormBody(text) {
    const out = {};
    String(text || '').split('&').forEach(function (pair) {
        const i = pair.indexOf('=');
        if (i < 0) return;
        const k = decodeURIComponent(pair.slice(0, i).replace(/\+/g, ' '));
        const v = decodeURIComponent(pair.slice(i + 1).replace(/\+/g, ' '));
        out[k] = v;
    });
    return out;
}

/**
 * 綠界信用卡退刷（Action=E，可部分金額）。
 * TradeNo = payment_orders.external_id
 */
async function refundEcpayCredit(ecpayConfig, opts) {
    const merchantId = ecpayConfig && ecpayConfig.merchantID;
    const hashKey = ecpayConfig && ecpayConfig.hashKey;
    const hashIV = ecpayConfig && ecpayConfig.hashIV;
    if (!merchantId || !hashKey || !hashIV) throw new Error('綠界金流尚未設定');
    const merchantTradeNo = String(opts.merchantTradeNo || '').trim();
    const tradeNo = String(opts.tradeNo || '').trim();
    const amount = Math.round(Number(opts.amount) || 0);
    if (!merchantTradeNo || !tradeNo) throw new Error('缺少綠界訂單號');
    if (amount < 1) throw new Error('退費金額無效');
    const params = {
        MerchantID: merchantId,
        MerchantTradeNo: merchantTradeNo,
        TradeNo: tradeNo,
        Action: 'E',
        TotalAmount: amount
    };
    params.CheckMacValue = ecpayCheckMacValue(params, hashKey, hashIV);
    const body = Object.keys(params).map(function (k) {
        return encodeURIComponent(k) + '=' + encodeURIComponent(String(params[k]));
    }).join('&');
    const res = await fetch(ecpayDoActionUrl(ecpayConfig), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body
    });
    const text = await res.text();
    const parsed = parseEcpayFormBody(text);
    const rtn = parseInt(parsed.RtnCode || parsed.Rtncode || '0', 10);
    if (rtn !== 1) {
        const msg = parsed.RtnMsg || parsed.Rtnmsg || text || ('綠界退費失敗 ' + res.status);
        const err = new Error(msg);
        err.ecpay = parsed;
        throw err;
    }
    return parsed;
}

module.exports = {
    ecpayCheckMacValue,
    ecpayDoActionUrl,
    refundEcpayCredit
};
