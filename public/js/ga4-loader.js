/**
 * GA4 載入器：從後端取得衡量 ID，有值則注入 gtag 並送 page_view
 * 全站只初始化一次（各頁 head / site-header / site-common 可能重複掛本檔）
 */
(function () {
    if (window.__MATCHDO_GA4_INIT) return;
    window.__MATCHDO_GA4_INIT = true;
    window.dataLayer = window.dataLayer || [];
    function gtag() { dataLayer.push(arguments); }
    window.gtag = window.gtag || gtag;

    fetch('/api/config/ga4', { cache: 'default' })
        .then(function (res) { return res.json(); })
        .then(function (data) {
            var id = (data && data.measurementId && data.measurementId.trim()) ? data.measurementId.trim() : '';
            if (!id || !/^G-[A-Z0-9]+$/i.test(id)) return;
            if (!document.querySelector('script[src*="googletagmanager.com/gtag/js"]')) {
                var s = document.createElement('script');
                s.async = true;
                s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
                document.head.appendChild(s);
            }
            gtag('js', new Date());
            gtag('config', id);
        })
        .catch(function () {});
})();
