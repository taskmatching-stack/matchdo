/**
 * 首頁 meta / JSON-LD 隨 ?lang=en 更新（B3 收尾）
 */
(function () {
    function tr(k, fb) {
        if (window.i18n && typeof window.i18n.t === 'function') {
            var v = window.i18n.t(k);
            if (v && v !== k) return v;
        }
        return fb != null ? fb : k;
    }

    function setMeta(sel, attr, val) {
        if (!val) return;
        var el = document.querySelector(sel);
        if (el) el.setAttribute(attr, val);
    }

    function applyHomePageMeta() {
        var lang = (window.i18n && window.i18n.getLang) ? window.i18n.getLang() : 'zh-TW';
        var isEn = String(lang).toLowerCase().indexOf('en') === 0;
        var title = tr('home.docTitle', document.title);
        var desc = tr('home.metaDesc', '');
        var ogTitle = tr('home.ogTitle', title);
        var siteName = tr('customProduct.ogSiteName', 'MATCHDO');
        var ogLocale = isEn ? 'en_US' : 'zh_TW';
        document.title = title;
        document.documentElement.lang = isEn ? 'en' : 'zh-TW';
        setMeta('meta[name="description"]', 'content', desc);
        setMeta('meta[property="og:site_name"]', 'content', siteName);
        setMeta('meta[property="og:title"]', 'content', ogTitle);
        setMeta('meta[property="og:description"]', 'content', desc);
        setMeta('meta[property="og:locale"]', 'content', ogLocale);
        setMeta('meta[name="twitter:title"]', 'content', ogTitle);
        setMeta('meta[name="twitter:description"]', 'content', desc);
        var org = document.getElementById('homeOrgJsonLd');
        if (org) {
            org.textContent = JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'Organization',
                name: tr('home.jsonLdOrgName', siteName),
                alternateName: 'MatchDO',
                url: 'https://matchdo.cc',
                logo: { '@type': 'ImageObject', url: 'https://matchdo.cc/img/matchdo-logo.png' },
                description: tr('home.jsonLdOrgDesc', desc),
                foundingDate: '2025',
                areaServed: 'TW',
                availableLanguage: ['Chinese', 'English'],
                contactPoint: {
                    '@type': 'ContactPoint',
                    contactType: 'customer service',
                    email: 'support@matchdo.cc',
                    availableLanguage: ['Chinese', 'English']
                }
            });
        }
        var site = document.getElementById('homeWebSiteJsonLd');
        if (site) {
            site.textContent = JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'WebSite',
                name: tr('home.jsonLdSiteName', siteName),
                url: 'https://matchdo.cc',
                potentialAction: {
                    '@type': 'SearchAction',
                    target: {
                        '@type': 'EntryPoint',
                        urlTemplate: 'https://matchdo.cc/custom/gallery.html?search={search_term_string}'
                    },
                    'query-input': 'required name=search_term_string'
                }
            });
        }
    }

    window.matchdoApplyHomePageMeta = applyHomePageMeta;
})();
