(function(){
  async function inject(id, url){
    const el = document.getElementById(id);
    if(!el) return;
    try{
      const res = await fetch(url, { cache: 'no-cache' });
      if(!res.ok) throw new Error('fetch failed');
      el.innerHTML = await res.text();
      highlightActive();
    }catch(e){
      // silent fallback
    }
  }
  function highlightActive(){
    var path = location.pathname.replace(/\/$/, '');
    document.querySelectorAll('#adminMenu a').forEach(a => {
      var href = a.getAttribute('href');
      if(!href) return;
      var full = new URL(href, location.origin).pathname.replace(/\/$/, '');
      if(full === path){
        a.classList.add('active');
      } else {
        a.classList.remove('active');
      }
    });
  }
  document.addEventListener('DOMContentLoaded', function(){
    inject('admin-header', '/admin/partials/header.html');
    inject('admin-sidebar', '/admin/partials/sidebar.html');
  });
})();
