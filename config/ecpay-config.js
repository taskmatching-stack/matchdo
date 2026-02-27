/**
 * 綠界 ECPay 金流設定
 * 申請帳號後於 .env 填入 ECPAY_MERCHANT_ID、ECPAY_HASH_KEY、ECPAY_HASH_IV
 * 測試環境：綠界測試平台後台可取得測試用 MerchantID / HashKey / HashIV
 */
const BASE = process.env.BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

module.exports = {
  merchantID: process.env.ECPAY_MERCHANT_ID || '2000132',
  hashKey: process.env.ECPAY_HASH_KEY || '',
  hashIV: process.env.ECPAY_HASH_IV || '',

  returnURL: process.env.ECPAY_RETURN_URL || `${BASE}/payment/return`,
  notifyURL: process.env.ECPAY_NOTIFY_URL || `${BASE}/api/payment/notify`,

  isProduction: process.env.NODE_ENV === 'production' && process.env.ECPAY_USE_PRODUCTION === 'true',

  apiURL: (process.env.NODE_ENV === 'production' && process.env.ECPAY_USE_PRODUCTION === 'true')
    ? 'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5'
    : 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5',
};
