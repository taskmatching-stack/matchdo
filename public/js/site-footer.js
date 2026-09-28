/**
 * 共用頁腳：載入 /partials/footer.html；文案由 data-i18n + locales（勿再用中文比對硬改）
 */
(function () {
    function applyFooterI18n() {
        if (window.i18n && typeof window.i18n.applyPage === 'function') {
            window.i18n.applyPage();
        }
    }

    function afterFooterMounted() {
        if (window.i18n && window.i18n.ready) {
            window.i18n.ready.then(applyFooterI18n).catch(applyFooterI18n);
        } else {
            applyFooterI18n();
        }
    }

    async function render() {
        const el = document.getElementById('site-footer');
        if (!el) return;
        if (el.innerHTML.trim() !== '') return;
        try {
            const res = await fetch('/partials/footer.html', { cache: 'no-cache' });
            if (res.ok) {
                el.innerHTML = await res.text();
                afterFooterMounted();
                return;
            }
        } catch (e) {}
        el.innerHTML = `
            <div class="container-fluid bg-dark text-white-50 footer mt-5 pt-5">
                <div class="container py-5">
                    <div class="row g-5">
                        <div class="col-md-6 col-lg-3">
                            <a href="/" class="d-inline-block mb-3"><h1 class="text-white">MATCHDO</h1></a>
                            <p class="mb-0" data-i18n-html="footer.taglineHtml">看見結果，才能更快決定。<br><span class="text-white-50 small">See the result first. Decide faster.</span></p>
                        </div>
                        <div class="col-md-6 col-lg-3">
                            <h5 class="text-white mb-4" data-i18n="contact.title">聯絡我們</h5>
                            <p><i class="fa fa-map-marker-alt me-3"></i>Taipei, Taiwan</p>
                            <p><i class="fa fa-envelope me-3"></i><a href="mailto:support@matchdo.cc" class="text-white-50">support@matchdo.cc</a></p>
                        </div>
                        <div class="col-md-6 col-lg-3">
                            <h5 class="text-white mb-4" data-i18n="footer.linksHeading">連結</h5>
                            <a class="btn btn-link" href="/" data-i18n="nav.home">首頁</a>
                            <a class="btn btn-link" href="/custom-product.html" data-i18n="nav.productDesign">產品設計</a>
                            <a class="btn btn-link" href="/contact.html" data-i18n="contact.title">聯絡我們</a>
                        </div>
                        <div class="col-md-6 col-lg-3">
                            <h5 class="text-white mb-4" data-i18n="footer.servicesHeading">服務</h5>
                            <a class="btn btn-link" href="/custom-product.html" data-i18n="nav.productDesign">產品設計</a>
                            <a class="btn btn-link" href="/subscription-plans.html" data-i18n="nav.subscriptionPlans">方案與定價</a>
                        </div>
                    </div>
                </div>
                <div class="container">
                    <div class="row">
                        <div class="col-md-6 text-center text-md-start mb-3 mb-md-0"><span data-i18n="footer.copyright">&copy; MATCHDO 合做. All Rights Reserved.</span></div>
                        <div class="col-md-6 text-center text-md-end"><a href="/" class="text-white-50 text-decoration-none" data-i18n="nav.home">首頁</a></div>
                    </div>
                </div>
            </div>
        `;
        afterFooterMounted();
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { render(); });
    } else {
        render();
    }
})();
