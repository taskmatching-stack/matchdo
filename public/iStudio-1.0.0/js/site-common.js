(function(){
  async function inject(id, url){
    const el = document.getElementById(id);
    if(!el) return;
    try{
      const res = await fetch(url, { cache: 'no-cache' });
      if(!res.ok) throw new Error('fetch failed');
      el.innerHTML = await res.text();
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
    // 導覽列改由全站 /js/site-header.js 渲染，不再注入舊 partial，避免錯誤引用
    await inject('site-footer', '/iStudio-1.0.0/partials/footer.html');
    await buildMenu();
    var ga4 = document.createElement('script');
    ga4.src = '/js/ga4-loader.js';
    ga4.async = true;
    document.head.appendChild(ga4);
  });
})();
