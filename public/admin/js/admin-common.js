(function(){
  // 未通過權限前不顯示頁面（僅管理員、測試員可進入 /admin/）
  if (document.body) document.body.style.visibility = 'hidden';

  async function inject(id, url){
    const el = document.getElementById(id);
    if(!el) return;
    try{
      const res = await fetch(url, { cache: 'no-cache' });
      if(!res.ok) throw new Error('fetch failed');
      el.innerHTML = await res.text();
      highlightActive();
      if (id === 'admin-header') updateAdminHeaderAuth();
    }catch(e){
      // silent fallback
    }
  }
  function highlightActive(){
    var path = location.pathname.replace(/\/$/, '');
    var menu = document.getElementById('adminMenu');
    if (!menu) return;
    menu.querySelectorAll('a').forEach(a => {
      var href = a.getAttribute('href');
      if(!href) return;
      var full = new URL(href, location.origin).pathname.replace(/\/$/, '');
      a.classList.toggle('active', full === path);
    });
  }
  function updateAdminHeaderAuth() {
    var el = document.getElementById('adminHeaderAuth');
    if (!el) return;
    var path = (typeof location !== 'undefined' && location.pathname) ? location.pathname : '/admin/';
    var loginUrl = '/login.html?returnUrl=' + encodeURIComponent(path);
    var session = (window.getSessionFromStorage && window.getSessionFromStorage()) || null;
    if (session && session.user) {
      var email = (session.user.email || session.user.user_metadata?.email || '').replace(/\@.*/, '');
      var logoutUrl = '/logout.html';
      el.innerHTML = '<span class="text-muted small me-2">已登入：' + (email || '管理員') + '</span><a href="' + logoutUrl + '" id="adminHeaderLogoutBtn" class="btn btn-sm btn-outline-secondary">登出</a>';
      var logoutBtn = document.getElementById('adminHeaderLogoutBtn');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
          e.preventDefault();
          if (window.AuthService && typeof AuthService.signOut === 'function') AuthService.signOut();
          else window.location.href = logoutUrl;
        });
      }
    } else {
      el.innerHTML = '<a href="' + loginUrl + '" class="btn btn-sm btn-outline-primary">登入（登入後回此頁）</a>';
    }
  }
  document.addEventListener('DOMContentLoaded', async function(){
    var allowed = false;
    var path = (typeof location !== 'undefined' && location.pathname) ? location.pathname : '/admin/';
    var returnUrl = encodeURIComponent(path + (location.search || ''));
    try {
      var session = (window.AuthService && typeof AuthService.getSession === 'function') ? await AuthService.getSession() : null;
      if (!session || !session.user) {
        location.replace((window.AuthService && AuthService.getLoginUrl ? AuthService.getLoginUrl(path) : '/login.html') + '?returnUrl=' + returnUrl);
        return;
      }
      var token = session.access_token || (session.session && session.session.access_token);
      if (!token) {
        location.replace('/login.html?returnUrl=' + returnUrl);
        return;
      }
      var r = await fetch('/api/admin/can-access', { method: 'GET', headers: { Authorization: 'Bearer ' + token } });
      if (r.ok) {
        allowed = true;
      } else if (r.status === 401) {
        location.replace('/login.html?returnUrl=' + returnUrl);
        return;
      } else if (r.status === 403) {
        try {
          var body = await r.json();
          if (body.role !== undefined || body.hint) {
            console.warn('[後台權限] 目前角色: ' + (body.role == null ? 'null' : body.role) + (body.hint ? '\n建議在 Supabase 執行: ' + body.hint : ''));
            if (body.hint) alert('您的帳號角色為「' + (body.role || '未設定') + '」，無法進入後台。\n\n請在 Supabase SQL Editor 執行：\n' + body.hint);
          }
        } catch (e) {}
      }
    } catch (e) {}
    if (!allowed) {
      location.replace('/index.html');
      return;
    }
    if (document.body) document.body.style.visibility = 'visible';
    inject('admin-header', '/admin/partials/header.html');
    inject('admin-sidebar', '/admin/partials/sidebar.html');
  });
})();
