(function(){
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

  async function inject(id, url){
    const el = document.getElementById(id);
    if(!el) return;
    try{
      const res = await fetch(url, { cache: 'no-cache' });
      if(!res.ok) throw new Error('fetch failed');
      el.innerHTML = await res.text();
      if (id === 'site-footer') applyFooterLocale(el);
    }catch(e){
      // silent
    }
  }
  async function buildMenu(){
    try{
      const res = await fetch('/config/site-menu.json', { cache: 'no-cache' });
      const data = await res.json();
      const items = Array.isArray(data.items) ? data.items : [];
      const nav = document.getElementById('nav-links');
      if(!nav) return;
      nav.innerHTML = '';
      items.forEach(it => {
        const a = document.createElement('a');
        a.className = 'nav-item nav-link';
        a.textContent = it.label || '';
        a.href = it.href || '#';
        // active highlight
        try{
          const current = new URL(location.href);
          const target = new URL(a.href, location.origin);
          if(current.pathname === target.pathname && (current.hash || '') === (target.hash || '')){
            a.classList.add('active');
          }
        }catch{}
        nav.appendChild(a);
      });
    }catch(e){
      // fallback minimal
      const nav = document.getElementById('nav-links');
      if(nav){
        nav.innerHTML = '<a class="nav-item nav-link" href="/index.html">首頁</a>';
      }
    }
  }
  document.addEventListener('DOMContentLoaded', async function(){
    await inject('site-header', '/partials/header.html');
    await inject('site-footer', '/partials/footer.html');
    await buildMenu();
    var ga4 = document.createElement('script');
    ga4.src = '/js/ga4-loader.js';
    ga4.async = true;
    document.head.appendChild(ga4);
  });
})();
