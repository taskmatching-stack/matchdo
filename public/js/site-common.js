(function(){
  function applyFooterI18n() {
    if (window.i18n && typeof window.i18n.applyPage === 'function') {
      window.i18n.applyPage();
    }
  }

  async function inject(id, url){
    const el = document.getElementById(id);
    if(!el) return;
    try{
      const res = await fetch(url, { cache: 'no-cache' });
      if(!res.ok) throw new Error('fetch failed');
      el.innerHTML = await res.text();
      if (id === 'site-footer') {
        if (window.i18n && window.i18n.ready) {
          window.i18n.ready.then(applyFooterI18n).catch(applyFooterI18n);
        } else {
          applyFooterI18n();
        }
      }
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
  /** 頁面已載入 site-header.js 時勿注入舊版 header（避免覆寫成正確選單） */
  function usesModernSiteHeader() {
    return !!document.querySelector('script[src*="site-header.js"]');
  }

  document.addEventListener('DOMContentLoaded', async function(){
    if (!usesModernSiteHeader()) {
      await inject('site-header', '/partials/header.html');
      await buildMenu();
    }
    await inject('site-footer', '/partials/footer.html');
    if (!document.querySelector('script[src*="ga4-loader"]')) {
      var ga4 = document.createElement('script');
      ga4.src = '/js/ga4-loader.js?v=20260917ga4';
      ga4.async = true;
      document.head.appendChild(ga4);
    }
  });
})();
