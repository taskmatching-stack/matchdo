/**
 * 金流：全站以 PayPal（USD）為主；綠界保留後端相容，前台預設 PayPal。
 */
(function (global) {
  var TWD_TO_USD = {
    300: 11, 900: 33, 1800: 66,
    3000: 110, 9000: 330, 18000: 660
  };

  var USD_MONTHLY_BY_SORT = { 0: 0, 1: 11, 2: 33, 3: 66 };

  var PRESETS = [
    { twd: 300, usd: 11, credits: 330 },
    { twd: 900, usd: 33, credits: 1100 },
    { twd: 1800, usd: 66, credits: 2400 }
  ];

  function isPayPalLocale(lang) {
    return true;
  }

  function isChineseLang(lang) {
    if (lang == null || lang === '') {
      if (global.i18n && typeof global.i18n.getLang === 'function') lang = global.i18n.getLang();
    }
    var l = String(lang || '').toLowerCase().replace(/_/g, '-');
    return l === 'zh' || l.indexOf('zh-') === 0;
  }

  /** 美金優先：僅繁中介面顯示台幣；英文／未載入／其他語系顯示 USD。 */
  function displayPricesInUsd(lang) {
    return !isChineseLang(lang);
  }

  function twdToUsd(twdAmount) {
    var n = parseInt(twdAmount, 10);
    if (isNaN(n)) return twdAmount;
    return Object.prototype.hasOwnProperty.call(TWD_TO_USD, n) ? TWD_TO_USD[n] : n;
  }

  function planUsdMonthly(sortOrder) {
    var k = sortOrder != null ? sortOrder : 0;
    return Object.prototype.hasOwnProperty.call(USD_MONTHLY_BY_SORT, k) ? USD_MONTHLY_BY_SORT[k] : 0;
  }

  function planUsdYearly(sortOrder) {
    var m = planUsdMonthly(sortOrder);
    return m > 0 ? m * 10 : 0;
  }

  function checkoutStatusUrl() {
    var lang = currentUiLang();
    return '/api/payment-checkout-status' + (lang ? ('?lang=' + encodeURIComponent(lang)) : '');
  }

  function currentUiLang() {
    if (global.i18n && typeof global.i18n.getLang === 'function') return global.i18n.getLang() || '';
    return '';
  }

  function checkoutAmount(twdAmount, lang) {
    return isPayPalLocale(lang) ? twdToUsd(twdAmount) : parseInt(twdAmount, 10);
  }

  function resolvePlanUsdMonthly(plan) {
    if (plan && plan.price_usd_monthly != null && plan.price_usd_monthly !== '') {
      var n = parseFloat(plan.price_usd_monthly);
      if (!isNaN(n) && n >= 0) return n;
    }
    var sort = plan && plan.sort_order != null ? parseInt(plan.sort_order, 10) : 0;
    return planUsdMonthly(sort);
  }

  function planUsdYearlyFromPlan(plan) {
    var m = resolvePlanUsdMonthly(plan);
    return m > 0 ? m * 10 : 0;
  }

  global.PaymentLocale = {
    TWD_TO_USD: TWD_TO_USD,
    PRESETS: PRESETS,
    isPayPalLocale: isPayPalLocale,
    isChineseLang: isChineseLang,
    displayPricesInUsd: displayPricesInUsd,
    twdToUsd: twdToUsd,
    planUsdMonthly: planUsdMonthly,
    planUsdYearly: planUsdYearly,
    resolvePlanUsdMonthly: resolvePlanUsdMonthly,
    planUsdYearlyFromPlan: planUsdYearlyFromPlan,
    checkoutAmount: checkoutAmount,
    currentUiLang: currentUiLang,
    checkoutStatusUrl: checkoutStatusUrl
  };
})(typeof window !== 'undefined' ? window : this);
