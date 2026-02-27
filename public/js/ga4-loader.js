/**
 * GA4 載入器：從後端取得衡量 ID，有值則注入 gtag 並送 page_view
 */
(function () {
    fetch('/api/config/ga4', { cache: 'default' })
        .then(function (res) { return res.json(); })
        .then(function (data) {
            var id = (data && data.measurementId && data.measurementId.trim()) ? data.measurementId.trim() : '';
            if (!id) return;
            var s = document.createElement('script');
            s.async = true;
            s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
            document.head.appendChild(s);
            window.dataLayer = window.dataLayer || [];
            function gtag() { dataLayer.push(arguments); }
            window.gtag = gtag;
            gtag('js', new Date());
            gtag('config', id);
        })
        .catch(function () {});
})();
