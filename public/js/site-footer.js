/**
 * 共用頁腳：與首頁一致，載入 /partials/footer.html（MATCHDO、聯絡我們、連結、服務、版權）
 * 依語系切換描述與欄位標題（英文版：英文描述為主、連結/服務標題與文案改英文）
 */
(function () {
    var FOOTER_TAGLINE_ZH = '連結高端需求與卓越工藝。縮減設計與生產的摩擦，讓訂製不再靠想像。';
    var FOOTER_TAGLINE_EN = 'Connecting global vision with master craftsmanship. Beyond imagination, into reality.';

    function isFooterEnglish() {
        try {
            var lang = (window.i18n && typeof window.i18n.getLang === 'function') ? window.i18n.getLang() : '';
            if (lang) return String(lang).toLowerCase().indexOf('en') === 0;
            var docLang = document.documentElement.getAttribute('lang') || '';
            if (docLang.toLowerCase().indexOf('en') === 0) return true;
            var params = typeof window !== 'undefined' && window.location && window.location.search
                ? new URLSearchParams(window.location.search) : null;
            if (params && params.get('lang')) return String(params.get('lang')).toLowerCase().indexOf('en') === 0;
            return false;
        } catch (e) { return false; }
    }

    function applyFooterLocale(el) {
        if (!el || !isFooterEnglish()) return;
        var firstCol = el.querySelector('.col-md-6.col-lg-3');
        if (firstCol) {
            var p = firstCol.querySelector('p.mb-0');
            if (p) p.innerHTML = FOOTER_TAGLINE_EN + '<br><span class="text-white-50 small">' + FOOTER_TAGLINE_ZH + '</span>';
        }
        var h5s = el.querySelectorAll('h5.text-white.mb-4');
        h5s.forEach(function (h) {
            var t = h.textContent.trim();
            if (t === '聯絡我們') h.textContent = 'Contact Us';
            else if (t === '連結') h.textContent = 'Links';
            else if (t === '服務') h.textContent = 'Services';
        });
        var links = el.querySelectorAll('.btn.btn-link');
        links.forEach(function (a) {
            var t = a.textContent.trim();
            if (t === '首頁') a.textContent = 'Home';
            else if (t === '產品設計') a.textContent = 'Product Design';
            else if (t === '訂製產品') a.textContent = 'Custom Products';
            else if (t === '聯絡我們') a.textContent = 'Contact Us';
        });
    }

    async function render() {
        const el = document.getElementById('site-footer');
        if (!el) return;
        if (el.innerHTML.trim() !== '') return;
        try {
            const res = await fetch('/partials/footer.html', { cache: 'no-cache' });
            if (res.ok) {
                el.innerHTML = await res.text();
                applyFooterLocale(el);
                return;
            }
        } catch (e) {}
        el.innerHTML = `
            <div class="container-fluid bg-dark text-white-50 footer mt-5 pt-5">
                <div class="container py-5">
                    <div class="row g-5">
                        <div class="col-md-6 col-lg-3">
                            <a href="/index.html" class="d-inline-block mb-3"><h1 class="text-white">MATCHDO</h1></a>
                            <p class="mb-0">連結高端需求與卓越工藝。縮減設計與生產的摩擦，讓訂製不再靠想像。<br><span class="text-white-50 small">Connecting global vision with master craftsmanship. Beyond imagination, into reality.</span></p>
                        </div>
                        <div class="col-md-6 col-lg-3">
                            <h5 class="text-white mb-4">聯絡我們</h5>
                            <p><i class="fa fa-map-marker-alt me-3"></i>Taipei, Taiwan</p>
                            <p><i class="fa fa-envelope me-3"></i>support@matchdo.tw</p>
                        </div>
                        <div class="col-md-6 col-lg-3">
                            <h5 class="text-white mb-4">連結</h5>
                            <a class="btn btn-link" href="/index.html">首頁</a>
                            <a class="btn btn-link" href="/custom-product.html">產品設計</a>
                            <a class="btn btn-link" href="/custom/">訂製產品</a>
                            <a class="btn btn-link" href="/contact.html">聯絡我們</a>
                        </div>
                        <div class="col-md-6 col-lg-3">
                            <h5 class="text-white mb-4">服務</h5>
                            <a class="btn btn-link" href="/custom-product.html">產品設計</a>
                            <a class="btn btn-link" href="/custom/">訂製產品</a>
                        </div>
                    </div>
                </div>
                <div class="container">
                    <div class="row">
                        <div class="col-md-6 text-center text-md-start mb-3 mb-md-0">&copy; MATCHDO 合做. All Rights Reserved.</div>
                        <div class="col-md-6 text-center text-md-end"><a href="/index.html" class="text-white-50 text-decoration-none">Home</a></div>
                    </div>
                </div>
            </div>
        `;
        applyFooterLocale(el);
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { render(); });
    } else {
        render();
    }
})();
