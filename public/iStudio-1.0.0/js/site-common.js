(function(){
  var FOOTER_TAGLINE_ZH = '看見結果，才能更快決定。';
  var FOOTER_TAGLINE_EN = 'See the result first. Decide faster.';

  function isFooterEnglish() {
    try {
      var lang = (window.i18n && typeof window.i18n.getLang === 'function') ? window.i18n.getLang() : '';
      if (lang) return String(lang).toLowerCase().indexOf('en') === 0;
      var docLang = document.documentElement.getAttribute('lang') || '';
      if (docLang.toLowerCase().indexOf('en') === 0) return true;
      var params = window.location && window.location.search
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
        nav.innerHTML = '<a class="nav-item nav-link" href="/">首頁</a>';
      }
    }
  }
  document.addEventListener('DOMContentLoaded', async function(){
    // 導覽列改由全站 /js/site-header.js 渲染，不再注入舊 partial，避免錯誤引用
    await inject('site-footer', '/iStudio-1.0.0/partials/footer.html');
    await buildMenu();
    var ga4 = document.createElement('script');
    ga4.src = '/js/ga4-loader.js';
    ga4.async = true;
    document.head.appendChild(ga4);
  });
})();
